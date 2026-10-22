/* eslint-disable @typescript-eslint/no-require-imports */
// Standalone opt-in harness, not a Playwright spec. No execution on import or without all explicit flags.
const { spawn, spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const { browserTarget, privateFile, inspectState, validateState, validateIdentity, CLUSTER, DATABASE_OID } = require('../scripts/upload-acceptance-safety.ts');
const { fixturePlan, validateManifest } = require('../scripts/upload-acceptance-fixtures.ts');
const denied = () => Error('Isolated browser acceptance refused or unconfirmed. Inspect prerequisites privately; no automatic cleanup.');

function pdf() {
    let body = '%PDF-1.4\n'; const offsets = [0];
    for (const [i, object] of ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>'].entries()) {
        offsets.push(Buffer.byteLength(body)); body += `${i + 1} 0 obj\n${object}\nendobj\n`;
    }
    const xref = Buffer.byteLength(body);
    body += 'xref\n0 4\n0000000000 65535 f \n' + offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('');
    return Buffer.from(body + `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}
async function main() {
    let client, browser, server;
    try {
        const args = process.argv.slice(2);
        if (args.length !== 9 || args[0] !== '--execute') throw denied();
        const options = new Map();
        for (let i = 1; i < args.length; i += 2) {
            if (!['--run', '--base-url', '--confirm-base', '--private-fixtures'].includes(args[i]) || options.has(args[i])) throw denied();
            options.set(args[i], args[i + 1]);
        }
        const run = options.get('--run'), plan = fixturePlan(run);
        const origin = browserTarget(options.get('--base-url'), options.get('--confirm-base'));
        if (Number(new URL(origin).port) < 1024 || new URL(origin).port === '3000') throw denied();
        // Never enable debug protocol/API logs: they can contain URLs, credentials or request bodies.
        for (const key of ['DEBUG', 'PWDEBUG', 'PW_LOG_COMMS']) delete process.env[key];
        require('dotenv').config({ quiet: true });
        for (const key of ['DEBUG', 'PWDEBUG', 'PW_LOG_COMMS']) delete process.env[key];
        const input = JSON.parse(readFileSync(privateFile(options.get('--private-fixtures')), 'utf8'));
        const manifest = input.fixture; validateManifest(manifest);
        if (manifest.run !== run || plan.accounts.some(a => typeof input.credentials?.[a.tag] !== 'string' || input.credentials[a.tag].length < 16)) throw denied();
        const { databaseConfiguration } = require('../lib/db/config.ts');
        const configuration = databaseConfiguration({ ...process.env, NODE_ENV: 'test', VERCEL_ENV: 'development', THESISHS_DATABASE_ENV: 'development' });
        if (configuration.endpoint.database !== 'thesishs_ai' || configuration.endpoint.port !== 5432 || !['localhost', '127.0.0.1', '[::1]'].includes(configuration.endpoint.host)) throw denied();
        const supabase = new URL(process.env.SUPABASE_URL || '');
        if (supabase.protocol !== 'https:' || createHash('sha256').update(supabase.origin).digest('hex').slice(0, 16) !== '2df59fc572539320' ||
            !/^sb_publishable_/.test(process.env.SUPABASE_PUBLISHABLE_KEY || '')) throw denied();
        const postgres = require('postgres');
        client = postgres(configuration.url, { ...configuration.options, max: 1, onnotice: () => {} });
        await client.begin('read only', async tx => {
            await tx`set local statement_timeout = '10s'`;
            const state = await inspectState(tx); validateIdentity(state.identity, { cluster: CLUSTER, oid: DATABASE_OID }); validateState(state, true);
            if (state.target !== manifest.target) throw denied();
            for (const account of plan.accounts) {
                const rows = await tx`select id from users where id=${manifest.users[account.tag]} and email=${account.email} and first_name=${plan.marker} and last_name=${account.tag} and role_id=${account.role} and is_active`;
                if (rows.length !== 1) throw denied();
            }
            const groups = await tx`select id,group_name,adviser_id from research_groups where id in ${tx(manifest.groups)} and status='active'`;
            if (groups.length !== 2 || plan.groupNames.some((name, i) => !groups.some(g => g.id === manifest.groups[i] && g.group_name === name && g.adviser_id === manifest.users.adviser))) throw denied();
            for (let i = 0; i < 3; i++) {
                const rows = await tx`select p.id from research_papers p join group_members m on m.group_id=p.group_id where p.id=${manifest.papers[i]} and p.title=${plan.titles[i]} and p.group_id=${manifest.groups[i === 2 ? 1 : 0]} and m.user_id=${manifest.users[i === 2 ? 'student-c' : 'student-a']} and not exists(select 1 from submissions s where s.paper_id=p.id)`;
                if (rows.length !== 1) throw denied();
            }
        });
        const childEnvironment = { ...process.env, NODE_ENV: 'development', VERCEL_ENV: 'development', THESISHS_DATABASE_ENV: 'development',
            THESISHS_UPLOAD_ACCEPTANCE_RUN: run, THESISHS_LOCAL_MAILPIT: 'false', DEBUG: '', PWDEBUG: '0' };
        delete childEnvironment.THESISHS_DATABASE_ADMIN_URL; delete childEnvironment.THESISHS_UPLOAD_RESTORE_URL;
        server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', new URL(origin).hostname.replace(/[\[\]]/g, ''), '--port', new URL(origin).port], { env: childEnvironment, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        // Wait for this child's readiness, never silently attach to an existing server at the URL.
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(denied()), 45000);
            server.stdout.on('data', data => { if (/Ready in/.test(String(data))) { clearTimeout(timeout); resolve(); } });
            server.stderr.on('data', () => {});
            server.once('error', () => { clearTimeout(timeout); reject(denied()); });
            server.once('exit', () => { clearTimeout(timeout); reject(denied()); });
        });
        const { chromium, expect } = require('@playwright/test');
        browser = await chromium.launch({ headless: true });
        let failOnce = true;
        async function context() {
            // No tracing, HAR, video, screenshots, console listeners or exported storage state.
            const ctx = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false });
            await ctx.route('**/*', async route => {
                const request = route.request(), url = new URL(request.url());
                if (url.origin === origin) return route.continue();
                if (url.origin === supabase.origin && ['PUT', 'OPTIONS'].includes(request.method()) &&
                    /^\/storage\/v1\/object\/upload\/sign\/research-submissions\/staging\/submissions\/[0-9a-f-]{36}\/upload\.pdf$/.test(url.pathname)) {
                    if (failOnce && request.method() === 'PUT') { failOnce = false; return route.abort('failed'); }
                    return route.continue();
                }
                return route.abort('blockedbyclient');
            });
            return ctx;
        }
        async function login(tag) {
            const ctx = await context(), page = await ctx.newPage(), account = plan.accounts.find(a => a.tag === tag);
            await page.goto(origin + '/login'); await page.getByLabel('Email', { exact: true }).fill(account.email);
            await page.getByLabel('Password', { exact: true }).fill(input.credentials[tag]);
            await page.getByRole('button', { name: 'Login', exact: true }).click(); await page.waitForURL('**/dashboard');
            return page;
        }
        const student = await login('student-a');
        await student.goto(origin + '/dashboard/student/submissions');
        await student.getByLabel('Research project', { exact: true }).selectOption(String(manifest.papers[0]));
        await student.getByRole('button', { name: 'Submit PDF', exact: true }).click();
        const dialog = student.getByRole('dialog');
        await dialog.getByLabel('Research PDF', { exact: true }).setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: pdf() });
        await dialog.getByRole('button', { name: 'Upload PDF', exact: true }).click();
        await expect(dialog.getByRole('button', { name: 'Check upload status', exact: true })).toBeVisible({ timeout: 30000 });
        await dialog.getByRole('button', { name: 'Check upload status', exact: true }).click();
        await expect(dialog.getByRole('button', { name: 'Retry PDF upload', exact: true })).toBeVisible({ timeout: 30000 });
        await dialog.getByRole('button', { name: 'Retry PDF upload', exact: true }).click();
        await expect(dialog.getByRole('progressbar')).toBeVisible({ timeout: 30000 });
        await expect(dialog.getByRole('button', { name: 'Submit research', exact: true })).toBeVisible({ timeout: 30000 });
        const [prior] = await client`select count(*)::int as count from submissions where paper_id=${manifest.papers[0]}`;
        if (prior.count !== 0) throw denied();
        await dialog.getByRole('button', { name: 'Submit research', exact: true }).click();
        await expect(dialog).not.toBeVisible({ timeout: 65000 });
        await expect(student.getByText('Research submitted successfully.', { exact: true })).toBeVisible();
        const [committed] = await client`select count(*)::int as count from submissions where paper_id=${manifest.papers[0]} and submitted_by=${manifest.users['student-a']} and version='v1'`;
        if (committed.count !== 1) throw denied();
        const adviser = await login('adviser'); await adviser.goto(origin + '/dashboard/adviser/submissions');
        await expect(adviser.getByText(plan.titles[0], { exact: true }).first()).toBeVisible();
        console.log('PASS isolated Chromium login/project/progress/controlled retry/explicit finalization/history/Adviser visibility. Fixtures retained; no captures.');
    } catch { console.error(denied().message); process.exitCode = 1; }
    finally {
        try { await browser?.close(); } catch { process.exitCode = 1; }
        if (server && server.exitCode === null && server.pid) {
            if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
            else server.kill('SIGTERM');
        }
        try { await client?.end({ timeout: 2 }); } catch { process.exitCode = 1; }
    }
}
if (require.main === module) void main();
module.exports = { pdf };
