/* eslint-disable @typescript-eslint/no-require-imports */
// Real local HTTP/actions/cookies/PostgreSQL/Mailpit. No migrations or external email.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { fork, execFileSync } = require('node:child_process');
const postgres = require('postgres');
const { readMigrationFiles } = require('drizzle-orm/migrator');
const { chromium, expect } = require('@playwright/test');
const { runBrowserAcceptance } = require('./helpers/phase96-lifecycle.cjs');
const { startLocalMailpit, cache } = require('../scripts/mailpit-local.cjs');
const marker = 'PHASE101B2_' + crypto.randomUUID();
const password = crypto.randomBytes(24).toString('hex');
const origin = 'http://127.0.0.1:3031';
const statusPath = '/dashboard/student/verify-email';
const runtime = path.resolve(cache, marker);
const screenshots = path.resolve('test-results/phase101b2');
const emails = [0, 1, 2, 3].map(n => `${marker.toLowerCase()}-${n}@example.invalid`);
let client, mailpit, baseline, studentId, stage = 'preflight', passed = 0, failed = false, serverLogs = '';
const ids = [], tokens = [], requestURLs = [];
const originalEnvironment = { enabled: process.env.THESISHS_LOCAL_MAILPIT, origin: process.env.THESISHS_VERIFICATION_ORIGIN };
const nextEnvBefore = fs.existsSync('next-env.d.ts') ? fs.readFileSync('next-env.d.ts') : null;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function check(name, work) { stage = name; await work(); passed++; console.log('PASS ' + name); }
function target() {
    assert.ok(process.argv.includes('--confirmed-test-data'));
    const candidates = process.env.DATABASE_URL ? [process.env.DATABASE_URL] : [];
    for (const file of ['.env', '.env.local', '.env.development', '.env.development.local']) if (fs.existsSync(file)) {
        const value = require('dotenv').parse(fs.readFileSync(file)).DATABASE_URL; if (value) candidates.push(value);
    }
    assert.ok(candidates.length && candidates.every(value => value === candidates[0]));
    const value = new URL(candidates[0]); assert.equal(value.hostname, 'localhost'); assert.equal(value.port, '5432');
    assert.equal(value.pathname, '/thesishs_ai'); assert.equal(value.search, ''); return candidates[0];
}
async function fingerprint(connection) {
    const tables = await connection`select tablename from pg_tables where schemaname='public' order by tablename`;
    const result = {};
    for (const { tablename } of tables) {
        const identifier = '"public"."' + tablename.replaceAll('"', '""') + '"';
        const key = tablename === 'email_verification_requests' ? 'user_id' : 'id';
        const excluded = ['users', 'email_verification_requests'].includes(tablename) && ids.length ? `where "${key}" <> ALL($1::int[])` : '';
        result[tablename] = (await connection.unsafe(`select count(*)::int as count,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by "${key}"),'')) as hash from ${identifier} t ${excluded}`, excluded ? [ids] : []))[0];
    }
    return result;
}
async function stopMailpit() {
    if (mailpit && mailpit.exitCode === null) { const exited = new Promise(resolve => mailpit.once('exit', resolve)); mailpit.kill(); await exited; }
}
async function startMailpit() {
    mailpit = startLocalMailpit(path.join(runtime, 'inbox.sqlite'));
    for (let i = 0; i < 50; i++) {
        if (mailpit.exitCode !== null) throw Error('Owned Mailpit stopped');
        try { if ((await fetch('http://127.0.0.1:8025/readyz')).ok) return; } catch {}
        await pause(100);
    }
    throw Error('Owned Mailpit not ready');
}
async function inbox() { return (await (await fetch('http://127.0.0.1:8025/api/v1/messages')).json()).messages; }
async function latestLink() {
    const summaries = await inbox(); const message = await (await fetch('http://127.0.0.1:8025/api/v1/message/' + summaries[0].ID)).json();
    assert.equal(message.To[0].Address, emails[0]);
    const link = message.Text.match(/http:\/\/127\.0\.0\.1:3031\/verify-email#[^\s]+/)[0];
    const url = new URL(link); assert.equal(url.search, '');
    tokens.push(new URLSearchParams(url.hash.slice(1)).get('token')); return link;
}
async function ageCooldown() {
    await client`update email_verification_requests set last_requested_at=last_requested_at-interval '61 seconds',
        request_times=array(select instant-interval '61 seconds' from unnest(request_times) instant) where user_id=${studentId}`;
}
async function verified() { return (await client`select email_verified_at from users where id=${studentId}`)[0].email_verified_at; }
async function login(page, email) {
    await page.goto(origin + '/login'); await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.waitForURL(/\/dashboard\/(student|admin|adviser)$/); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}
async function replay(context, template, extra = {}) {
    return context.request.post(origin + statusPath, { headers: { 'next-action': template.action,
        'content-type': template.type, origin, ...extra }, data: template.body, maxRedirects: 0 });
}
async function appearance(page, theme) {
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const bad = await page.locator('main').last().evaluate(root => {
        const rgb = color => color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
        const luminance = values => values.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
        let failures = 0;
        for (const element of root.querySelectorAll('h1,h2,p,a,button')) {
            const bounds = element.getBoundingClientRect(); if (!bounds.width || !bounds.height || element.disabled) continue;
            const style = getComputedStyle(element); let parent = element, background;
            while (parent) { const color = getComputedStyle(parent).backgroundColor;
                if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') { background = rgb(color); break; } parent = parent.parentElement; }
            if (!background) continue;
            const values = [luminance(rgb(style.color)), luminance(background)].sort((a, b) => b - a);
            const threshold = parseFloat(style.fontSize) >= 24 || parseFloat(style.fontSize) >= 18.66 && parseInt(style.fontWeight) >= 700 ? 3 : 4.5;
            if ((values[0] + .05) / (values[1] + .05) < threshold) failures++;
            if (element.tagName === 'BUTTON' && bounds.height < 44) failures++;
        }
        return failures;
    });
    assert.equal(bad, 0, 'Scoped text contrast and enabled button targets');
}

async function main(lifecycle) {
    let browser;
    try {
        await check('database isolation and applied 0012 ledger', async () => {
            const [identity] = await client`select current_database() as name,inet_server_addr()::text as address,
                (select oid from pg_database where datname=current_database()) as oid,
                (select system_identifier::text from pg_control_system()) as cluster`;
            assert.equal(identity.name, 'thesishs_ai'); assert.equal(identity.oid, 16387); assert.equal(identity.cluster, '7652422818440234372');
            assert.ok(['127.0.0.1/32', '::1/128'].includes(identity.address));
            const source = readMigrationFiles({ migrationsFolder: 'db/migrations' });
            const ledger = await client`select hash,created_at from drizzle.__drizzle_migrations order by created_at,id`;
            assert.equal(ledger.length, 13); source.forEach((value, i) => { assert.equal(ledger[i].hash, value.hash); assert.equal(Number(ledger[i].created_at), value.folderMillis); });
            baseline = await fingerprint(client);
        });
        await check('owned Mailpit loopback binds, fresh inbox and real development server', async () => {
            fs.mkdirSync(runtime, { recursive: true }); fs.mkdirSync(screenshots, { recursive: true }); await startMailpit();
            const binds = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-Command',
                `Get-NetTCPConnection -State Listen | Where-Object {$_.OwningProcess -eq ${mailpit.pid}} | Select-Object LocalAddress,LocalPort | ConvertTo-Json -Compress`], { encoding: 'utf8', windowsHide: true }));
            assert.equal(binds.length, 2); assert.ok(binds.every(value => value.LocalAddress === '127.0.0.1'));
            assert.deepEqual(binds.map(value => value.LocalPort).sort((a, b) => a - b), [1025, 8025]); assert.equal((await inbox()).length, 0);
            stage = 'development server readiness'; await lifecycle.startServer(3031);
            stage = 'Chromium launch'; browser = await lifecycle.launchBrowser(chromium);
        });
        const studentContext = await browser.newContext();
        await studentContext.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
        const page = await studentContext.newPage(); const pageErrors = []; let requestTemplate, confirmTemplate;
        page.on('pageerror', () => pageErrors.push(true));
        page.on('request', request => {
            requestURLs.push(request.url());
            if (request.method() === 'POST' && request.headers()['next-action']) {
                const template = { action: request.headers()['next-action'], type: request.headers()['content-type'], body: request.postDataBuffer() };
                if (new URL(request.url()).pathname === statusPath) requestTemplate = template;
            }
        });
        await check('real Student registration, optional workspace, Settings navigation and no automatic email', async () => {
            const hash = await require('bcrypt').hash(password, 12);
            for (const [index, role] of [[1, 3], [2, 1], [3, 2]]) {
                const [created] = await client`insert into users(first_name,last_name,email,password,role_id) values('Synthetic',${marker},${emails[index]},${hash},${role}) returning id`;
                ids.push(created.id);
            }
            await page.goto(origin + '/register');
            await page.getByLabel('First Name').fill('Synthetic'); await page.getByLabel('Last Name').fill(marker);
            await page.getByLabel('Email', { exact: true }).fill(emails[0]); await page.getByLabel('Password', { exact: true }).fill(password);
            await page.getByLabel('Confirm Password').fill(password); await page.getByRole('button', { name: 'Create Student account' }).click();
            await page.waitForURL(origin + '/dashboard/student');
            const [student] = await client`select id from users where email=${emails[0]} and last_name=${marker}`; studentId = student.id; ids.push(studentId);
            await page.goto(origin + '/dashboard/student/submissions'); await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
            await page.goto(origin + '/dashboard/settings'); await page.getByRole('link', { name: 'Email verification', exact: true }).click();
            await expect(page.getByRole('heading', { name: 'Email not verified', exact: true })).toBeVisible();
            await expect(page.getByText(emails[0], { exact: true })).toBeVisible(); assert.equal(await page.getByText(emails[1], { exact: true }).count(), 0);
            assert.equal((await inbox()).length, 0);
        });
        let firstLink, validLink;
        await check('authorized request ignores spoofed account fields; SMTP captures recipient/link; cooldown', async () => {
            await page.locator('form').evaluate(form => { for (const [name, value] of [['userId', '999'], ['email', 'other@example.invalid']]) {
                const input = document.createElement('input'); input.type = 'hidden'; input.name = name; input.value = value; form.append(input); } });
            await page.getByRole('button', { name: 'Request verification email' }).click();
            await expect(page.getByRole('status').filter({ hasText: 'submitted for delivery' })).toBeVisible(); firstLink = await latestLink();
            assert.equal((await client`select count(*)::int as count from email_verification_requests where user_id=any(${ids.filter(id => id !== studentId)})`)[0].count, 0);
            await page.getByRole('button', { name: 'Resend verification email' }).click();
            await expect(page.getByRole('status').filter({ hasText: 'unavailable' })).toBeVisible(); assert.equal((await inbox()).length, 1);
        });
        await check('360/1280 Light/Dark/System, contrast, focus, private GET headers and no GET consumption', async () => {
            for (const width of [360, 1280]) for (const theme of ['light', 'dark', 'system']) {
                const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'dark', storageState: await studentContext.storageState() });
                await context.addInitScript(value => localStorage.setItem('thesishs-theme', value), theme);
                await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
                const view = await context.newPage(); const response = await view.goto(origin + statusPath);
                assert.equal(response.headers()['referrer-policy'], 'no-referrer');
                // Installed Next.js explicitly overrides all dev page cache headers to this policy.
                assert.match(response.headers()['cache-control'], /no-cache, must-revalidate/);
                await expect(view.getByRole('heading', { name: 'Email not verified', exact: true })).toBeVisible(); await appearance(view, theme);
                if (theme !== 'system') await view.screenshot({ path: path.join(screenshots, `status-${width}-${theme}.png`) });
                const confirmResponse = await view.goto(firstLink); await expect(view.getByRole('button', { name: 'Confirm my email' })).toBeEnabled();
                assert.equal(confirmResponse.headers()['referrer-policy'], 'no-referrer'); assert.match(confirmResponse.headers()['cache-control'], /no-cache, must-revalidate/);
                assert.equal(await view.evaluate(() => location.hash), ''); assert.equal(await verified(), null);
                assert.ok(!await view.locator('body').innerText().then(text => text.includes(tokens[0]))); await appearance(view, theme);
                const button = view.getByRole('button', { name: 'Confirm my email' }); await button.focus();
                assert.equal(await button.evaluate(el => el.matches(':focus-visible') && parseFloat(getComputedStyle(el).outlineWidth) >= 3), true);
                if (theme !== 'system') await view.screenshot({ path: path.join(screenshots, `confirm-${width}-${theme}.png`) });
                await context.close();
            }
        });
        const anonymous = await browser.newContext(); const confirmation = await anonymous.newPage();
        confirmation.on('request', request => {
            requestURLs.push(request.url());
            if (request.method() === 'POST' && request.headers()['next-action']) confirmTemplate = {
                action: request.headers()['next-action'], type: request.headers()['content-type'], body: request.postDataBuffer(),
            };
        });
        await check('resend replacement, explicit anonymous confirmation once, no authentication cookie', async () => {
            await ageCooldown(); await page.reload(); await page.getByRole('button', { name: 'Request verification email' }).click();
            await expect(page.getByRole('status').filter({ hasText: 'submitted for delivery' })).toBeVisible(); validLink = await latestLink();
            await confirmation.goto(firstLink); await confirmation.getByRole('button', { name: 'Confirm my email' }).click();
            await expect(confirmation.getByRole('status').filter({ hasText: 'invalid or expired' })).toBeVisible(); assert.equal(await verified(), null);
            await confirmation.goto(validLink);
            await expect(confirmation.locator('input[name="token"]')).toHaveValue(new URLSearchParams(new URL(validLink).hash.slice(1)).get('token'));
            await expect(confirmation.getByRole('button', { name: 'Confirm my email' })).toBeEnabled();
            const responseWait = confirmation.waitForResponse(r => r.request().method() === 'POST');
            await confirmation.getByRole('button', { name: 'Confirm my email' }).press('Enter'); const response = await responseWait;
            await expect(confirmation.getByRole('status').filter({ hasText: 'Email verified.' })).toBeVisible();
            assert.ok(await verified()); assert.ok(!String(response.headers()['set-cookie']).includes('thesishs_session'));
            assert.equal((await anonymous.cookies()).filter(cookie => cookie.name === 'thesishs_session').length, 0);
            assert.ok(!await response.text().then(text => text.includes(tokens.at(-1))));
            await confirmation.getByRole('link', { name: 'Continue to password login' }).click(); await expect(confirmation).toHaveURL(origin + '/login');
            await confirmation.goto(validLink); await confirmation.getByRole('button', { name: 'Confirm my email' }).click();
            await expect(confirmation.getByRole('status').filter({ hasText: 'invalid or expired' })).toBeVisible();
            await page.reload(); await expect(page.getByRole('heading', { name: 'Email verified', exact: true })).toBeVisible();
            await page.getByRole('link', { name: 'Return to Student dashboard' }).click(); await expect(page).toHaveURL(origin + '/dashboard/student');
        });
        await check('expired and missing links fail safely; recovery navigation exists', async () => {
            await client`update users set email_verified_at=null where id=${studentId}`; await ageCooldown();
            await page.goto(origin + statusPath); await page.getByRole('button', { name: 'Request verification email' }).click();
            await expect(page.getByRole('status').filter({ hasText: 'submitted for delivery' })).toBeVisible(); const expired = await latestLink();
            await client`update email_verification_requests set expires_at=clock_timestamp()-interval '1 second',last_requested_at=clock_timestamp()-interval '61 minutes' where user_id=${studentId}`;
            await confirmation.goto(expired); await confirmation.getByRole('button', { name: 'Confirm my email' }).click();
            await expect(confirmation.getByRole('status').filter({ hasText: 'invalid or expired' })).toBeVisible(); assert.equal(await verified(), null);
            await confirmation.goto(origin + '/verify-email'); await expect(confirmation.getByRole('button', { name: 'Confirm my email' })).toBeDisabled();
            await confirmation.getByRole('link', { name: 'Request a new verification email' }).click(); await expect(confirmation).toHaveURL(origin + '/login');
        });
        await check('SMTP failure keeps account usable; resend recovery and hourly quota', async () => {
            await stopMailpit(); await page.reload(); await page.getByRole('button', { name: 'Request verification email' }).click();
            await expect(page.getByRole('status').filter({ hasText: 'unavailable' })).toBeVisible(); assert.equal(await verified(), null);
            assert.equal((await client`select is_active from users where id=${studentId}`)[0].is_active, true);
            await startMailpit(); await ageCooldown(); await page.reload(); await page.getByRole('button', { name: 'Request verification email' }).click();
            await expect(page.getByRole('status').filter({ hasText: 'submitted for delivery' })).toBeVisible(); const recovered = await latestLink();
            await ageCooldown(); await page.getByRole('button', { name: 'Resend verification email' }).click();
            await expect(page.getByRole('status').filter({ hasText: 'unavailable' })).toBeVisible();
            assert.equal((await client`select cardinality(request_times)::int as count from email_verification_requests where user_id=${studentId}`)[0].count, 5);
            await confirmation.goto(recovered); await confirmation.getByRole('button', { name: 'Confirm my email' }).click();
            await expect(confirmation.getByRole('status').filter({ hasText: 'Email verified.' })).toBeVisible();
        });
        await check('direct anonymous/Admin/Adviser/inactive POST denial and real password login', async () => {
            const before = await client`select token_digest,last_requested_at from email_verification_requests where user_id=${studentId}`;
            const denied = await replay(anonymous, requestTemplate); assert.match(await denied.text(), /unavailable/);
            const anonStatus = await anonymous.request.get(origin + statusPath); assert.ok(anonStatus.url().endsWith('/login'));
            for (const [index, role] of [[2, 'admin'], [3, 'adviser']]) {
                const context = await browser.newContext(); const actorPage = await context.newPage(); await login(actorPage, emails[index]);
                assert.ok(actorPage.url().endsWith('/' + role)); const response = await replay(context, requestTemplate);
                assert.match(await response.text(), /unavailable/); await context.close();
            }
            await client`update users set is_active=false where id=${studentId}`;
            assert.match(await (await replay(studentContext, requestTemplate)).text(), /unavailable/);
            await client`update users set is_active=true where id=${studentId}`;
            assert.deepEqual(await client`select token_digest,last_requested_at from email_verification_requests where user_id=${studentId}`, before);
            const fresh = await browser.newContext(); const loginPage = await fresh.newPage(); await login(loginPage, emails[1]);
            await loginPage.goto(origin + '/dashboard/student/submissions'); await expect(loginPage.getByRole('heading', { level: 1 })).toBeVisible(); await fresh.close();
            await page.goto(origin + statusPath); await expect(page.getByRole('heading', { name: 'Email verified', exact: true })).toBeVisible();
            const already = await replay(studentContext, requestTemplate); assert.match(await already.text(), /already verified/);
        });
        await check('confirmation HTTP burst throttled; fragments absent from URLs/logs and no page errors', async () => {
            let limited = false;
            for (let i = 0; i < 35; i++) {
                const response = await anonymous.request.post(origin + '/verify-email', { headers: { 'next-action': confirmTemplate.action,
                    'content-type': confirmTemplate.type, origin, 'x-forwarded-for': `192.0.2.${i}` }, data: confirmTemplate.body });
                if ((await response.text()).includes('Wait a minute')) { limited = true; break; }
            }
            assert.equal(limited, true); assert.equal(pageErrors.length, 0);
            for (const token of tokens) { assert.ok(!serverLogs.includes(token)); assert.ok(requestURLs.every(url => !url.includes(token))); }
        });
    } finally {
        if (baseline) {
            const owned = await client`select id from users where first_name='Synthetic' and last_name=${marker} and email=any(${emails})`;
            for (const { id } of owned) if (!ids.includes(id)) ids.push(id);
            if (ids.length) await client.begin(async tx => {
                await tx`delete from email_verification_requests where user_id=any(${ids})`;
                await tx`delete from users where id=any(${ids}) and first_name='Synthetic' and last_name=${marker}`;
            });
            const independent = postgres(target(), { max: 1, connect_timeout: 5, idle_timeout: 2 });
            try { assert.equal((await independent`select count(*)::int as count from users where last_name=${marker}`)[0].count, 0);
                assert.deepEqual(await fingerprint(independent), baseline); console.log('PASS independent fixture cleanup and all existing record fingerprints'); }
            finally { await independent.end({ timeout: 3 }); }
        }
    }
}

(async () => {
    try {
        client = postgres(target(), { max: 2, connect_timeout: 5, idle_timeout: 2 });
        process.env.THESISHS_LOCAL_MAILPIT = 'enabled'; process.env.THESISHS_VERIFICATION_ORIGIN = origin;
        await runBrowserAcceptance(main, { client, label: 'Phase 10.1B.2 verification', timeoutMs: 240000, deps: {
            fork: (_module, args, options) => {
                const child = fork(require.resolve('./helpers/phase101b2-server.cjs'), args, { ...options,
                    env: { ...options.env, THESISHS_VERIFICATION_ACCEPTANCE: '1' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
                child.stdout.on('data', data => { serverLogs += data; }); child.stderr.on('data', data => { serverLogs += data; }); return child;
            },
            report: (_prefix, error) => { failed = true;
                const frame = String(error?.stack ?? '').split('\n').find(line => /at .*phase101b2-verification\.browser\.cjs/.test(line));
                console.log('FAIL ' + stage + '; category=' + (error?.code || error?.name || 'unknown') + (frame ? '; ' + frame.trim() : ''));
                if (stage === 'development server readiness') {
                    const reason = ['Owned server exited before Ready', 'Owned server did not become ready', 'Spawned server identity could not be verified'].find(value => error?.message?.includes(value));
                    console.log('Startup reason: ' + (reason || 'unclassified'));
                    console.log(serverLogs.split(/\r?\n/).filter(line => /Error|error|Unable|invalid|lock|config|TypeScript/.test(line)).slice(-8)
                        .map(line => line.replace(/(?:postgres(?:ql)?|https?):\/\/\S+/gi, '[URL]').replace(/[a-f0-9]{32,}/gi, '[opaque]')
                            .replace(/\beyJ[A-Za-z0-9_.-]+/g, '[opaque]').replace(/(password|secret|token)\s*[:=]\s*\S+/gi, '[redacted]')).join(' | '));
                } },
        } });
    } catch { failed = true; process.exitCode = 1; console.log('FAIL ' + stage + '; details withheld.'); }
    finally {
        await stopMailpit(); if (client) await client.end({ timeout: 3 });
        // Restore only the generated reference written by our alternate build directory.
        if (nextEnvBefore && fs.readFileSync('next-env.d.ts', 'utf8').includes('.next/phase101b2/')) fs.writeFileSync('next-env.d.ts', nextEnvBefore);
        if (runtime.startsWith(cache + path.sep) && path.basename(runtime) === marker && fs.existsSync(runtime)) fs.rmSync(runtime, { recursive: true });
        for (const [key, value] of Object.entries({ THESISHS_LOCAL_MAILPIT: originalEnvironment.enabled, THESISHS_VERIFICATION_ORIGIN: originalEnvironment.origin }))
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    console.log(JSON.stringify({ passed, failed, actualExternalEmails: 0, migrationsExecuted: 0, screenshots: 'test-results/phase101b2' }));
})();
