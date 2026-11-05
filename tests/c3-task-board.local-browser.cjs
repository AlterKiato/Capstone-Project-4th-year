/* eslint-disable @typescript-eslint/no-require-imports */
// Explicit local Next/browser/Server Action acceptance with exact, marked synthetic cleanup.
const assert = require('node:assert/strict');
const Module = require('node:module');
const { spawn, execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { lookup } = require('node:dns/promises');
const fs = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
if (process.argv.slice(2).join(' ') !== '--execute') process.exit(1);
require('dotenv').config({ quiet: true });
const original = Module._load;
Module._load = function(id, ...args) { return id === 'server-only' ? {} : original.call(this, id, ...args); };
const postgres = require('postgres');
const { databaseConfiguration } = require('../lib/db/config.ts');
const { inspectLocalWorkspace } = require('../scripts/migrate-local-workspace.ts');
const { createToken } = require('../lib/auth/jwt.ts');
const { chromium, expect } = require('@playwright/test');
const origin = 'http://127.0.0.1:3043', marker = 'C3_' + randomUUID().replaceAll('-', '');
const owned = { users: [], groups: [], members: [], papers: [], tasks: [] };
let client, server, browser, before, stage = 'configuration', outcome = 'BLOCKED', cleanup = false;
async function main() {
    try {
        const config = databaseConfiguration({ ...process.env, NODE_ENV: 'test' });
        assert.equal(config.environment, 'development'); assert.equal(config.endpoint.database, 'thesishs_ai'); assert.equal(config.endpoint.port, 5432);
        assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(config.endpoint.host));
        const addresses = await lookup(config.endpoint.host.replace(/^\[|\]$/g, ''), { all: true }); assert.ok(addresses.every(a => a.address === '::1' || /^127\./.test(a.address)));
        client = postgres(config.url, { ...config.options, max: 1, onnotice: () => {}, connection: { application_name: 'thesishs_c3_browser', statement_timeout: 10000, lock_timeout: 3000 } });
        before = await client.begin('read only', tx => inspectLocalWorkspace(tx, 17));
        // Do not borrow an unidentified local server.
        const net = require('node:net'); await new Promise((resolve, reject) => { const probe = net.createServer(); probe.once('error', reject); probe.listen(3043, '127.0.0.1', () => probe.close(resolve)); });
        stage = 'Next startup'; console.log('C3 local browser: verified database; starting owned loopback Next dev server.');
        server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3043'], { windowsHide: true, stdio: 'ignore' });
        let ready = false;
        for (let n = 0; n < 80; n++) {
            if (server.exitCode !== null) break;
            let response;
            try { response = await fetch(origin + '/login', { signal: AbortSignal.timeout(2000) }); } catch { /* bounded warmup only */ }
            if (response?.ok) { ready = true; break; }
            if (response && response.status >= 500) break;
            await new Promise(r => setTimeout(r, 250));
        }
        assert.ok(ready, 'Local Next startup unavailable. No fixtures created.');
        stage = 'synthetic fixture setup';
        await client.begin(async tx => {
            await inspectLocalWorkspace(tx, 17);
            for (const [tag, role] of [['adviser', 2], ['actor', 3], ['member', 3], ['outside', 3]]) {
                const [u] = await tx`insert into users(first_name,last_name,email,password,role_id,is_active) values(${marker},${tag},${marker + tag + '@example.invalid'},'!unusable-synthetic',${role},true) returning id,role_id,email`;
                owned.users.push(u);
            }
            const [g] = await tx`insert into research_groups(group_name,strand,section,school_year,adviser_id,status) values(${marker},'TEST','C3','TEST',${owned.users[0].id},'active') returning id`; owned.groups.push(g.id);
            for (const u of owned.users.slice(1, 3)) { const [m] = await tx`insert into group_members(group_id,user_id) values(${g.id},${u.id}) returning id`; owned.members.push(m.id); }
            for (const suffix of ['A', 'B']) { const [p] = await tx`insert into research_papers(group_id,title,abstract) values(${g.id},${marker + ' ' + suffix},${marker}) returning id`; owned.papers.push(p.id); }
        });
        stage = 'authenticated Next workspace and durable actions'; console.log('C3 local browser: synthetic fixtures ready; checking route, actions and persisted rows.');
        browser = await chromium.launch();
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
        const actor = owned.users[1], member = owned.users[2];
        const cookie = async u => context.addCookies([{ name: 'thesishs_session', value: await createToken({ userId: u.id, roleId: u.role_id, email: u.email }), url: origin, httpOnly: true, sameSite: 'Lax' }]);
        await cookie(actor); const page = await context.newPage();
        await page.goto(origin + '/dashboard/student/workspace?project=' + owned.papers[0], { timeout: 60000 });
        await expect(page.getByRole('heading', { name: marker + ' A', exact: true })).toBeVisible({ timeout: 30000 });
        await expect(page.getByRole('link', { name: 'Group Workspace', exact: true }).first()).toBeVisible();
        await page.getByRole('button', { name: 'New Task', exact: true }).click(); let dialog = page.getByRole('dialog', { name: 'New Task', exact: true });
        await dialog.getByLabel('Title', { exact: true }).fill(marker + ' Task'); await dialog.getByLabel('Description (optional)').fill('C3 durable synthetic description');
        await dialog.getByLabel('Assigned Student (optional)').selectOption(String(member.id)); await dialog.getByLabel('Due date (optional)').fill('2026-12-01');
        await dialog.getByRole('button', { name: 'Create task', exact: true }).click(); await expect(dialog).toHaveCount(0, { timeout: 15000 });
        let [saved] = await client`select id,paper_id,created_by,assigned_student_id,status from group_tasks where paper_id=${owned.papers[0]} and title=${marker + ' Task'}`;
        assert.ok(saved); owned.tasks.push(saved.id); assert.equal(saved.created_by, actor.id); assert.equal(saved.assigned_student_id, member.id); assert.equal(saved.status, 'To Do');
        const details = () => page.locator('details').filter({ has: page.getByLabel('Details: ' + marker + ' Task', { exact: true }) });
        await details().locator('summary').click(); await details().getByRole('button', { name: 'Edit', exact: true }).click(); dialog = page.getByRole('dialog', { name: 'Edit Task', exact: true });
        await dialog.getByLabel('Description (optional)').fill('C3 edited durable description'); await dialog.getByRole('button', { name: 'Save changes', exact: true }).click(); await expect(dialog).toHaveCount(0, { timeout: 15000 });
        assert.equal((await client`select description from group_tasks where id=${saved.id}`)[0].description, 'C3 edited durable description');
        await details().getByRole('button', { name: 'Assign', exact: true }).click(); dialog = page.getByRole('dialog', { name: 'Assign Task', exact: true });
        await dialog.getByLabel('Assigned Student (optional)').selectOption(''); await dialog.getByRole('button', { name: 'Save changes', exact: true }).click(); await expect(dialog).toHaveCount(0, { timeout: 15000 });
        assert.equal((await client`select assigned_student_id from group_tasks where id=${saved.id}`)[0].assigned_student_id, null);
        await details().getByRole('button', { name: 'Change status', exact: true }).click(); dialog = page.getByRole('dialog', { name: 'Change Task Status', exact: true });
        await dialog.getByLabel('Task status', { exact: true }).selectOption('Done'); await dialog.getByRole('button', { name: 'Save changes', exact: true }).click(); await expect(dialog).toHaveCount(0, { timeout: 15000 });
        await expect(page.getByRole('region', { name: 'Done', exact: true })).toContainText(marker + ' Task'); assert.equal((await client`select status from group_tasks where id=${saved.id}`)[0].status, 'Done');
        await page.getByLabel('Research project', { exact: true }).selectOption(String(owned.papers[1])); await expect(page.getByRole('heading', { name: marker + ' B', exact: true })).toBeVisible(); await expect(page.getByLabel('Details: ' + marker + ' Task', { exact: true })).toHaveCount(0);
        await page.reload(); await expect(page.getByRole('heading', { name: marker + ' B', exact: true })).toBeVisible();
        await page.getByLabel('Research project', { exact: true }).selectOption(String(owned.papers[0])); await expect(page.getByRole('heading', { name: marker + ' A', exact: true })).toBeVisible();
        await details().locator('summary').click(); await details().getByRole('button', { name: 'Delete', exact: true }).click(); dialog = page.getByRole('dialog', { name: 'Delete Task', exact: true });
        await dialog.getByRole('button', { name: 'Permanently delete task', exact: true }).click(); await expect(dialog).toHaveCount(0, { timeout: 15000 });
        assert.equal((await client`select count(*)::int as n from group_tasks where id=${saved.id}`)[0].n, 0);
        await page.goto(origin + '/dashboard/student/workspace?project=2147483647'); await expect(page.getByRole('heading', { name: 'Project unavailable', exact: true })).toBeVisible();
        await cookie(owned.users[3]); await page.goto(origin + '/dashboard/student/workspace?project=' + owned.papers[0]); await expect(page.getByRole('heading', { name: 'Project unavailable', exact: true })).toBeVisible(); await expect(page.getByText(marker + ' A', { exact: true })).toHaveCount(0);
        await cookie(owned.users[0]); await page.goto(origin + '/dashboard/student/workspace'); await expect(page).not.toHaveURL(/\/student\/workspace/);
        await cookie(actor); await page.goto(origin + '/dashboard/student/workspace?project=' + owned.papers[0]);
        for (const width of [1280, 390]) { await page.setViewportSize({ width, height: 850 }); await expect(page.getByRole('heading', { name: marker + ' A', exact: true })).toBeVisible(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); }
        outcome = 'PASS'; console.log('C3 local browser: durable create/edit/unassign/status/delete, URL refresh, outsider/Adviser route denial and responsive route PASS.');
    } catch { console.error(JSON.stringify({ status: 'BLOCKED', stage, secretsRedacted: true })); process.exitCode = 1; }
    finally {
        await browser?.close();
        if (server?.pid) { try { if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore', windowsHide: true }); else server.kill(); } catch { /* already stopped */ } }
        if (client && before) {
            try {
                await client.begin(async tx => {
                    if (!owned.users.length) return;
                    const users = await tx`select id,first_name,email from users where id=any(${owned.users.map(u => u.id)}::integer[]) for update`;
                    assert.equal(users.length, owned.users.length); assert.ok(users.every(u => u.first_name === marker && u.email.endsWith('@example.invalid')));
                    const papers = await tx`select id,abstract,group_id from research_papers where id=any(${owned.papers}::integer[]) for update`;
                    assert.ok(papers.every(p => p.abstract === marker && owned.groups.includes(p.group_id)));
                    const tasks = owned.papers.length ? await tx`select id,created_by,title from group_tasks where paper_id=any(${owned.papers}::integer[]) for update` : [];
                    assert.ok(tasks.every(t => owned.users.some(u => u.id === t.created_by) && t.title === marker + ' Task'));
                    for (const t of tasks) await tx`delete from group_tasks where id=${t.id} and created_by=${t.created_by}`;
                    for (const id of owned.papers) await tx`delete from research_papers where id=${id} and abstract=${marker}`;
                    for (const id of owned.members) await tx`delete from group_members where id=${id} and group_id=any(${owned.groups}::integer[]) and user_id=any(${owned.users.map(u => u.id)}::integer[])`;
                    for (const id of owned.groups) await tx`delete from research_groups where id=${id} and group_name=${marker}`;
                    for (const u of owned.users) await tx`delete from users where id=${u.id} and first_name=${marker}`;
                });
                const after = await client.begin('read only', tx => inspectLocalWorkspace(tx, 17));
                assert.deepEqual(after.rows, before.rows); assert.deepEqual(after.catalog, before.catalog); assert.deepEqual(after.ledger, before.ledger);
                cleanup = true;
            } catch {
                const dir = fs.mkdtempSync(join(tmpdir(), 'thesishs-c3-cleanup-')); fs.writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ marker, owned, stage }), { mode: 0o600 }); process.exitCode = 1;
            }
        }
        await client?.end({ timeout: 2 });
        console.log(JSON.stringify({ status: outcome, cleanupVerified: cleanup, fixtureRowsRemoved: owned.users.length > 0, existingRecordsCatalogLedgerPreserved: cleanup, sequencesNotReset: true, stage }));
    }
}
void main();
