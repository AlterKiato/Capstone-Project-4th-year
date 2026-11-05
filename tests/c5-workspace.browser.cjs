/* eslint-disable @typescript-eslint/no-require-imports */
// Explicit real password login / Next Server Actions / local PostgreSQL. No server lifecycle or mocked auth.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { tmpdir } = require('node:os');
const { randomUUID, randomBytes } = require('node:crypto');
const { lookup } = require('node:dns/promises');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
const args = process.argv.slice(2).join(' ');
if (!['--execute', '--execute --navigation-and-deletion'].includes(args)) process.exit(1);
// Focused follow-up for the corrected canceled-reload assertion; never reuses failed-run records.
const remainingOnly = args.endsWith('--navigation-and-deletion');
require('dotenv').config({ quiet: true });
const original = Module._load;
Module._load = function(id, ...args) { return id === 'server-only' ? {} : original.call(this, id, ...args); };
const postgres = require('postgres');
const { databaseConfiguration } = require('../lib/db/config.ts');
const { inspectLocalWorkspace } = require('../scripts/migrate-local-workspace.ts');
const { privateFile } = require('../scripts/upload-acceptance-safety.ts');
const { chromium, expect: baseExpect } = require('@playwright/test');
const expect = baseExpect.configure({ timeout: 20000 });
const origin = 'http://localhost:3000', workspace = '/dashboard/student/workspace';
const marker = 'C5_' + randomUUID().replaceAll('-', ''), password = randomBytes(24).toString('hex');
const owned = { users: [], groups: [], members: [], papers: [], tasks: [], notes: [] }, contexts = [], pages = [];
const results = [], limitations = [], pageErrors = [], requests = [], networkFailures = [];
let client, before, browser, manifest, stage = 'preflight', outcome = 'BLOCKED', cleanupVerified = false, fixturesCommitted = false, failure;
let acceptConfirm = true;
const navigationEvidence = {};
function persist() { fs.writeFileSync(manifest, JSON.stringify({ marker, owned, stage, fixturesCommitted, cleanupVerified }), { mode: 0o600 }); }
async function check(name, work) {
    if (remainingOnly && !/^(committed marked|real creator password|dirty notes lock|task deletion confirms|actual Next rendering)/.test(name)) return;
    stage = name; await work(); results.push(name); console.log('PASS ' + name);
}
const href = (paper, tab = 'tasks') => origin + workspace + '?project=' + paper + '&tab=' + tab;
const dialog = page => page.getByRole('dialog').filter({ has: page.locator('form') });
async function closed(page) { await expect(dialog(page)).toHaveCount(0, { timeout: 25000 }); }
async function detail(page, title, note = false) {
    const d = page.locator('details').filter({ has: page.getByLabel((note ? 'Read note: ' : 'Details: ') + title, { exact: true }) });
    await expect(d).toBeVisible(); if (await d.getAttribute('open') === null) await d.locator('summary').click(); return d;
}
async function save(page, label = 'Save changes') { await dialog(page).getByRole('button', { name: label, exact: true }).click(); await closed(page); }
async function login(user) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' }); contexts.push(context);
    await context.route('**/*', route => {
        const url = new URL(route.request().url());
        return url.origin === origin && !url.pathname.startsWith('/api/push/') ? route.continue() : route.abort();
    });
    const page = await context.newPage(); pages.push(page);
    page.setDefaultTimeout(25000);
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('requestfailed', request => { const url = new URL(request.url()); if (url.origin === origin) networkFailures.push({ path: url.pathname, error: request.failure()?.errorText }); });
    page.on('dialog', async d => { if (acceptConfirm) await d.accept(); else await d.dismiss(); });
    page.on('request', request => {
        if (request.method() === 'POST' && request.headers()['next-action']) {
            const type = request.headers()['content-type'] || '', body = request.postData();
            if (type.startsWith('text/plain') && body?.startsWith('[{')) {
                try { const [input] = JSON.parse(body); if (input.paperId) requests.push({ action: request.headers()['next-action'], type, input }); } catch { /* not a workspace action */ }
            }
        }
    });
    await page.goto(origin + '/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.waitForURL(origin + '/dashboard/student', { timeout: 60000 });
    const cookie = (await context.cookies()).find(c => c.name === 'thesishs_session');
    assert.ok(cookie?.httpOnly && cookie.value.length > 30, 'Real login must establish the session cookie');
    return { context, page };
}
async function denied(context, template, input) {
    assert.ok(template, 'A real observed Server Action request is required');
    const response = await context.request.post(href(input.paperId), { headers: { 'next-action': template.action, 'content-type': template.type, origin }, data: JSON.stringify([input]), maxRedirects: 0, timeout: 25000 });
    assert.equal(response.status(), 200);
    const body = await response.text(); assert.match(body, /"success":false/); assert.match(body, /"kind":"unavailable"/);
}
async function noteRow(id) { return (await client`select * from task_notes where id=${id} and paper_id=any(${owned.papers}::integer[])`)[0]; }
async function main() {
    try {
        const config = databaseConfiguration({ ...process.env, NODE_ENV: 'development' });
        assert.equal(config.environment, 'development'); assert.equal(config.endpoint.database, 'thesishs_ai'); assert.equal(config.endpoint.port, 5432);
        assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(config.endpoint.host));
        assert.ok((await lookup(config.endpoint.host.replace(/^\[|\]$/g, ''), { all: true })).every(a => a.address === '::1' || /^127\./.test(a.address)));
        // Match the repository's ordinary development environment; do not override limiter/provider settings.
        assert.ok(!process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'development');
        client = postgres(config.url, { ...config.options, max: 1, onnotice: () => {}, connection: { application_name: 'thesishs_c5_browser', statement_timeout: 10000, lock_timeout: 3000 } });
        before = await client.begin('read only', tx => inspectLocalWorkspace(tx, 17));
        const ready = await fetch(origin + '/login', { signal: AbortSignal.timeout(15000) });
        assert.equal(ready.status, 200); assert.ok((await ready.text()).includes('ThesiSHS'));
        const directory = fs.mkdtempSync(path.join(tmpdir(), 'thesishs-c5-'));
        if (process.platform === 'win32') execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
            "$ErrorActionPreference='Stop'; $p=Get-Item -LiteralPath $env:THESISHS_C5_ARTIFACT_DIR; if(!$p.PSIsContainer -or $p.Name -notlike 'thesishs-c5-*' -or ($p.Attributes -band [IO.FileAttributes]::ReparsePoint)){exit 1}; $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User; $a=[Security.AccessControl.DirectorySecurity]::new(); $a.SetOwner($sid); $a.SetAccessRuleProtection($true,$false); foreach($v in @($sid.Value,'S-1-5-18','S-1-5-32-544')){$r=[Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($v),'FullControl','ContainerInherit,ObjectInherit','None','Allow'); $a.AddAccessRule($r)}; Set-Acl -LiteralPath $p.FullName -AclObject $a"],
        { env: { ...process.env, THESISHS_C5_ARTIFACT_DIR: directory }, windowsHide: true, stdio: 'pipe', timeout: 10000 });
        manifest = path.join(directory, 'owned-fixtures.json'); persist(); privateFile(manifest);
        let creator, assignee, external, editor, taskId, noteId, peerNoteId, taskEdit, taskAssign, noteEdit, noteLink;
        await check('committed marked fixtures after local identity/17-entry ledger verification', async () => {
            const hash = await require('bcrypt').hash(password, 12);
            await client.begin(async tx => {
                await inspectLocalWorkspace(tx, 17);
                for (const [tag, role] of (remainingOnly ? [['adviser', 2], ['creator', 3]] : [['adviser', 2], ['creator', 3], ['member', 3], ['outside', 3]])) {
                    const [u] = await tx`insert into users(first_name,last_name,email,password,role_id,is_active) values(${marker},${tag},${marker.toLowerCase() + '-' + tag + '@example.invalid'},${hash},${role},true) returning id,email,role_id`;
                    owned.users.push(u);
                }
                const [g] = await tx`insert into research_groups(group_name,strand,section,school_year,adviser_id,status) values(${marker},'TEST','C5','TEST',${owned.users[0].id},'active') returning id`; owned.groups.push(g.id);
                for (const user of owned.users.slice(1, 3)) { const [m] = await tx`insert into group_members(group_id,user_id) values(${g.id},${user.id}) returning id`; owned.members.push(m.id); }
                for (const suffix of ['A', 'B']) { const [p] = await tx`insert into research_papers(group_id,title,abstract) values(${g.id},${marker + ' ' + suffix},${marker}) returning id`; owned.papers.push(p.id); }
                if (remainingOnly) {
                    // Minimal fresh equivalents of the already accepted prefix; UI checks below own every change.
                    const [t] = await tx`insert into group_tasks(paper_id,title,created_by,status) values(${owned.papers[0]},${marker + ' Task'},${owned.users[1].id},'Done') returning id`;
                    taskId = t.id; owned.tasks.push(t.id);
                    const [n] = await tx`insert into task_notes(paper_id,title,content,created_by,version) values(${owned.papers[0]},${marker + ' Edited note'},'C5 reviewed final note',${owned.users[1].id},8) returning id`;
                    noteId = n.id; owned.notes.push(n.id);
                }
                persist(); // Exact base fixture IDs are recorded before commit, with no password/token.
            }); fixturesCommitted = true; persist();
        });
        browser = await chromium.launch();
        const actor = owned.users[1], member = owned.users[2], outsider = owned.users[3], [paperA, paperB] = owned.papers;
        const taskTitle = marker + ' Task', noteTitle = marker + ' Note', editedTitle = marker + ' Edited note', peerTitle = marker + ' Peer deleted note';
        await check('real creator password login, session, Student dashboard and workspace navigation', async () => {
            creator = await login(actor);
            await expect(creator.page.getByRole('heading', { level: 1 })).toBeVisible();
            await creator.page.getByRole('link', { name: 'Group Workspace', exact: true }).first().click();
            await expect(creator.page.getByRole('heading', { name: 'Group Workspace', exact: true })).toBeVisible();
            await creator.page.waitForLoadState('networkidle', { timeout: 25000 });
            await expect(creator.page.getByLabel('Research project', { exact: true })).toHaveValue(String(paperB));
            if (remainingOnly) await creator.page.goto(href(paperA, 'notes'));
        });
        await check('project default, selector, refresh and browser Back/Forward with tab retention', async () => {
            const p = creator.page, select = p.getByLabel('Research project', { exact: true });
            await select.selectOption(String(paperA)); await expect(p).toHaveURL(href(paperA));
            await p.getByRole('tab', { name: 'Notes', exact: true }).click(); await expect(p).toHaveURL(href(paperA, 'notes'));
            await select.selectOption(String(paperB)); await expect(p).toHaveURL(href(paperB, 'notes'));
            await p.reload(); await expect(select).toHaveValue(String(paperB)); await expect(p.getByRole('tab', { name: 'Notes', exact: true })).toHaveAttribute('aria-selected', 'true');
            await p.goBack(); await expect(select).toHaveValue(String(paperA)); await p.goForward(); await expect(select).toHaveValue(String(paperB));
            await p.goto(href(paperA));
        });
        await check('task create, To Do persistence, creator edit and eligible assignment', async () => {
            const p = creator.page;
            await p.getByRole('button', { name: 'New Task', exact: true }).click();
            await dialog(p).getByLabel('Title', { exact: true }).fill(taskTitle); await dialog(p).getByLabel('Description (optional)').fill('C5 synthetic task description');
            await save(p, 'Create task');
            const [task] = await client`select * from group_tasks where paper_id=${paperA} and title=${taskTitle}`; assert.ok(task); taskId = task.id; owned.tasks.push(taskId); persist();
            assert.equal(task.created_by, actor.id); assert.equal(task.status, 'To Do');
            await p.reload(); await expect(p.getByRole('region', { name: 'To Do', exact: true })).toContainText(taskTitle);
            let d = await detail(p, taskTitle); await d.getByRole('button', { name: 'Edit', exact: true }).click();
            await dialog(p).getByLabel('Description (optional)').fill('C5 creator edited description'); await save(p); taskEdit = requests.at(-1);
            assert.equal((await client`select description from group_tasks where id=${taskId}`)[0].description, 'C5 creator edited description');
            d = await detail(p, taskTitle); await d.getByRole('button', { name: 'Assign', exact: true }).click();
            await expect(dialog(p).getByLabel('Assigned Student (optional)').locator('option[value="' + outsider.id + '"]')).toHaveCount(0);
            await dialog(p).getByLabel('Assigned Student (optional)').selectOption(String(member.id)); await save(p); taskAssign = requests.at(-1);
            assert.equal((await client`select assigned_student_id from group_tasks where id=${taskId}`)[0].assigned_student_id, member.id);
            await denied(creator.context, taskAssign, { paperId: paperA, taskId, assignedStudentId: outsider.id });
            assert.equal((await client`select assigned_student_id from group_tasks where id=${taskId}`)[0].assigned_student_id, member.id);
        });
        await check('assignee real login, In Progress/Done persistence and creator-only edit denial', async () => {
            assignee = await login(member); const p = assignee.page; await p.goto(href(paperA));
            let d = await detail(p, taskTitle); await expect(d.getByRole('button', { name: /^(Edit|Delete|Assign)$/ })).toHaveCount(0);
            await denied(assignee.context, taskEdit, { paperId: paperA, taskId, title: marker + ' Forbidden', description: null, dueDate: null });
            assert.equal((await client`select title from group_tasks where id=${taskId}`)[0].title, taskTitle);
            for (const status of ['In Progress', 'Done']) {
                d = await detail(p, taskTitle); await d.getByRole('button', { name: 'Change status', exact: true }).click();
                await dialog(p).getByLabel('Task status', { exact: true }).selectOption(status); await save(p);
                await expect(p.getByRole('region', { name: status, exact: true })).toContainText(taskTitle);
                assert.equal((await client`select status from group_tasks where id=${taskId}`)[0].status, status);
            }
            await p.reload(); await expect(p.getByRole('region', { name: 'Done', exact: true })).toContainText(taskTitle);
        });
        await check('plain-text note create/persistence, creator edit, same-paper link and unlink versions', async () => {
            const p = creator.page; await p.getByRole('tab', { name: 'Notes', exact: true }).click();
            await p.getByRole('button', { name: 'New Note', exact: true }).click();
            await dialog(p).getByLabel('Title', { exact: true }).fill(noteTitle); await dialog(p).getByLabel('Content', { exact: true }).fill('C5 literal <script>text only</script>\nResearch observations.');
            await save(p, 'Create note'); const [note] = await client`select * from task_notes where paper_id=${paperA} and title=${noteTitle}`; assert.ok(note); noteId = note.id; owned.notes.push(noteId); persist();
            assert.equal(note.created_by, actor.id); assert.equal(note.version, 1); assert.equal(note.task_id, null);
            await p.reload(); let d = await detail(p, noteTitle, true); await expect(d).toContainText('C5 literal <script>text only</script>');
            await d.getByRole('button', { name: 'Edit', exact: true }).click(); await dialog(p).getByLabel('Title', { exact: true }).fill(editedTitle);
            await dialog(p).getByLabel('Content', { exact: true }).fill('C5 revised plain text'); await save(p); noteEdit = requests.at(-1);
            assert.equal((await noteRow(noteId)).version, 2); assert.equal((await noteRow(noteId)).content, 'C5 revised plain text');
            d = await detail(p, editedTitle, true); await d.getByRole('button', { name: 'Link / unlink task', exact: true }).click();
            await dialog(p).getByLabel('Linked task (optional)').selectOption(String(taskId)); await save(p); noteLink = requests.at(-1);
            assert.equal((await noteRow(noteId)).task_id, taskId); assert.equal((await noteRow(noteId)).version, 3);
            await denied(creator.context, noteLink, { paperId: paperB, noteId, expectedVersion: 3, taskId }); assert.equal((await noteRow(noteId)).version, 3);
            d = await detail(p, editedTitle, true); await d.getByRole('button', { name: 'Link / unlink task', exact: true }).click();
            await dialog(p).getByLabel('Linked task (optional)').selectOption(''); await save(p);
            assert.equal((await noteRow(noteId)).task_id, null); assert.equal((await noteRow(noteId)).version, 4);
        });
        await check('peer read-only UI and actual Server Action note edit denial', async () => {
            const p = assignee.page; await p.goto(href(paperA, 'notes')); const d = await detail(p, editedTitle, true);
            await expect(d.getByRole('button')).toHaveCount(0); await expect(d).toContainText('Read only');
            await denied(assignee.context, noteEdit, { paperId: paperA, noteId, expectedVersion: 4, title: editedTitle, content: 'C5 forbidden peer write' });
            assert.equal((await noteRow(noteId)).version, 4); assert.equal((await noteRow(noteId)).content, 'C5 revised plain text');
            // One peer-owned deleted note provides meaningful creator-only deleted-list evidence.
            await p.getByRole('button', { name: 'New Note', exact: true }).click(); await dialog(p).getByLabel('Title', { exact: true }).fill(peerTitle);
            await dialog(p).getByLabel('Content', { exact: true }).fill('C5 peer-only recovery content'); await save(p, 'Create note');
            const [peer] = await client`select id from task_notes where paper_id=${paperA} and title=${peerTitle}`; peerNoteId = peer.id; owned.notes.push(peerNoteId); persist();
            const own = await detail(p, peerTitle, true); await own.getByRole('button', { name: 'Delete', exact: true }).click(); await save(p, 'Move to Recently Deleted');
        });
        await check('creator soft deletion, private Recently Deleted, restoration and durable content', async () => {
            const p = creator.page; let d = await detail(p, editedTitle, true); await d.getByRole('button', { name: 'Delete', exact: true }).click();
            await expect(dialog(p)).toContainText('stored content is preserved'); await dialog(p).getByRole('button', { name: 'Cancel', exact: true }).click(); await closed(p);
            await d.getByRole('button', { name: 'Delete', exact: true }).click(); await save(p, 'Move to Recently Deleted');
            assert.ok((await noteRow(noteId)).deleted_at); assert.equal((await noteRow(noteId)).version, 5);
            await p.reload(); await expect(p.getByLabel('Read note: ' + editedTitle, { exact: true })).toHaveCount(0);
            await p.getByRole('button', { name: 'Recently Deleted', exact: true }).click(); d = await detail(p, editedTitle, true);
            await expect(p.getByLabel('Read note: ' + peerTitle, { exact: true })).toHaveCount(0);
            await d.getByRole('button', { name: 'Restore', exact: true }).click(); await save(p, 'Restore note');
            await expect(p).toHaveURL(href(paperA, 'notes')); await detail(p, editedTitle, true);
            assert.equal((await noteRow(noteId)).deleted_at, null); assert.equal((await noteRow(noteId)).version, 6); assert.equal((await noteRow(noteId)).content, 'C5 revised plain text');
            const q = assignee.page; await q.getByRole('button', { name: 'Recently Deleted', exact: true }).click(); await detail(q, peerTitle, true);
            await expect(q.getByLabel('Read note: ' + editedTitle, { exact: true })).toHaveCount(0);
        });
        await check('outside-group real login, foreign project rejection and Server Action denial', async () => {
            external = await login(outsider); const p = external.page; await p.goto(href(paperA, 'notes'));
            await expect(p.getByRole('heading', { name: 'Project unavailable', exact: true })).toBeVisible();
            await expect(p.getByLabel('Read note: ' + editedTitle, { exact: true })).toHaveCount(0);
            await denied(external.context, taskEdit, { paperId: paperA, taskId, title: marker + ' Forbidden', description: null, dueDate: null });
            await denied(external.context, noteEdit, { paperId: paperA, noteId, expectedVersion: 6, title: editedTitle, content: 'C5 forbidden outsider write' });
            assert.equal((await noteRow(noteId)).version, 6);
            await creator.page.goto(origin + workspace + '?project=2147483647&tab=notes');
            await expect(creator.page.getByRole('heading', { name: 'Project unavailable', exact: true })).toBeVisible();
            await creator.page.goto(href(paperB, 'notes')); await expect(creator.page.locator('#workspace-notes-panel details')).toHaveCount(0);
            await creator.page.getByRole('tab', { name: 'Tasks', exact: true }).click(); await expect(creator.page.locator('#workspace-tasks-panel details')).toHaveCount(0);
            await creator.page.goto(href(paperA, 'notes'));
        });
        await check('two real creator sessions: stale save rejected, draft kept, warned explicit latest reload', async () => {
            editor = await login(actor); const q = editor.page, p = creator.page; await q.goto(href(paperA, 'notes'));
            await (await detail(p, editedTitle, true)).getByRole('button', { name: 'Edit', exact: true }).click();
            await dialog(p).getByLabel('Content', { exact: true }).fill('C5 stale unsaved draft');
            await (await detail(q, editedTitle, true)).getByRole('button', { name: 'Edit', exact: true }).click();
            await dialog(q).getByLabel('Content', { exact: true }).fill('C5 other session saved content'); await save(q);
            const version = (await noteRow(noteId)).version; assert.equal(version, 7);
            await dialog(p).getByRole('button', { name: 'Save changes', exact: true }).click();
            await expect(dialog(p)).toContainText('Your draft is still here'); await expect(dialog(p).getByLabel('Content', { exact: true })).toHaveValue('C5 stale unsaved draft');
            assert.equal((await noteRow(noteId)).content, 'C5 other session saved content'); assert.equal((await noteRow(noteId)).version, version);
            acceptConfirm = false; await dialog(p).getByRole('button', { name: 'Reload latest version', exact: true }).click();
            await expect(dialog(p).getByLabel('Content', { exact: true })).toHaveValue('C5 stale unsaved draft');
            acceptConfirm = true; await dialog(p).getByRole('button', { name: 'Reload latest version', exact: true }).click();
            await expect(dialog(p).getByLabel('Content', { exact: true })).toHaveValue('C5 other session saved content');
            assert.equal((await noteRow(noteId)).version, version); // Latest read is not an automatic retry.
            await dialog(p).getByLabel('Content', { exact: true }).fill('C5 reviewed final note'); await save(p);
            assert.equal((await noteRow(noteId)).version, 8);
        });
        await check('dirty notes lock tabs/projects and preserve drafts on canceled close, Back and refresh', async () => {
            const p = creator.page;
            // Known same-document history predecessor for the actual Back attempt.
            await p.getByLabel('Research project', { exact: true }).selectOption(String(paperB)); await expect(p).toHaveURL(href(paperB, 'notes'));
            await p.getByLabel('Research project', { exact: true }).selectOption(String(paperA)); await expect(p).toHaveURL(href(paperA, 'notes'));
            await p.getByRole('button', { name: 'New Note', exact: true }).click(); await dialog(p).getByLabel('Title', { exact: true }).fill('C5 unsaved navigation draft');
            await dialog(p).getByLabel('Content', { exact: true }).fill('C5 retained navigation content');
            await expect(p.getByRole('tab', { name: 'Tasks', exact: true })).toBeDisabled(); await expect(p.getByLabel('Research project', { exact: true })).toBeDisabled();
            acceptConfirm = false; await p.keyboard.press('Escape'); await expect(dialog(p)).toBeVisible();
            const confirms = []; const record = d => confirms.push({ type: d.type(), message: d.message() }); p.on('dialog', record);
            const navigationSupported = await p.evaluate(() => {
                window.__c5NavigateEvents = [];
                window.navigation?.addEventListener('navigate', e => window.__c5NavigateEvents.push({ cancelable: e.cancelable, type: e.navigationType, sameDocument: e.destination.sameDocument }));
                return Boolean(window.navigation);
            });
            await p.evaluate(() => history.back());
            if (navigationSupported) await expect.poll(() => p.evaluate(() => window.__c5NavigateEvents?.length || 0)).toBeGreaterThan(0);
            const events = await p.evaluate(() => window.__c5NavigateEvents);
            navigationEvidence.backEvents = events;
            if (!events.some(e => e.type === 'traverse' && e.cancelable)) {
                limitations.push('Chromium Back had no supported cancelable traversal event: ' + JSON.stringify(events));
                acceptConfirm = true; await p.goto(href(paperA, 'notes'));
                await p.getByRole('button', { name: 'New Note', exact: true }).click();
                await dialog(p).getByLabel('Title', { exact: true }).fill('C5 unsaved navigation draft');
                await dialog(p).getByLabel('Content', { exact: true }).fill('C5 retained navigation content'); acceptConfirm = false;
            } else {
                assert.ok(confirms.some(d => d.type === 'confirm' && d.message.includes('Discard')));
                await expect(dialog(p).getByLabel('Content', { exact: true })).toHaveValue('C5 retained navigation content');
                await expect(p).toHaveURL(href(paperA, 'notes'));
            }
            await p.reload({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(error => {
                assert.match(error.message, /ERR_ABORTED|aborted|canceled|cancelled|Timeout/i);
                assert.ok(confirms.some(d => d.type === 'beforeunload'), 'A canceled refresh must actually show the unsaved-change warning');
            });
            await expect(dialog(p).getByLabel('Content', { exact: true })).toHaveValue('C5 retained navigation content');
            assert.ok(confirms.some(d => d.type === 'beforeunload'), 'Browser refresh should offer standard unsaved-change warning');
            navigationEvidence.canceledRefreshRetainedDraft = true;
            p.off('dialog', record); acceptConfirm = true; await dialog(p).getByRole('button', { name: 'Cancel', exact: true }).click(); await closed(p);
        });
        await check('task deletion confirms and preserves linked note content/creator while incrementing version', async () => {
            const p = creator.page; await (await detail(p, editedTitle, true)).getByRole('button', { name: 'Link / unlink task', exact: true }).click();
            await dialog(p).getByLabel('Linked task (optional)').selectOption(String(taskId)); await save(p); const linked = await noteRow(noteId); assert.equal(linked.version, 9);
            await p.getByRole('tab', { name: 'Tasks', exact: true }).click(); let d = await detail(p, taskTitle);
            await d.getByRole('button', { name: 'Delete', exact: true }).click(); await expect(dialog(p)).toContainText('preserved and unlinked');
            await dialog(p).getByRole('button', { name: 'Cancel', exact: true }).click(); await closed(p);
            assert.equal((await client`select count(*)::int as n from group_tasks where id=${taskId}`)[0].n, 1);
            d = await detail(p, taskTitle); await d.getByRole('button', { name: 'Delete', exact: true }).click(); await save(p, 'Permanently delete task');
            await p.reload(); await expect(p.getByLabel('Details: ' + taskTitle, { exact: true })).toHaveCount(0);
            assert.equal((await client`select count(*)::int as n from group_tasks where id=${taskId}`)[0].n, 0);
            const preserved = await noteRow(noteId); assert.equal(preserved.task_id, null); assert.equal(preserved.version, linked.version + 1);
            for (const field of ['content', 'title', 'created_by', 'paper_id', 'deleted_at']) assert.deepEqual(preserved[field], linked[field]);
            await p.getByRole('tab', { name: 'Notes', exact: true }).click(); d = await detail(p, editedTitle, true); await expect(d).toContainText('Unlinked');
        });
        await check('actual Next rendering at 360/1280, Light/Dark, mobile menu, dialogs and keyboard focus', async () => {
            const p = creator.page;
            for (const width of [360, 1280]) for (const theme of ['light', 'dark']) {
                await p.setViewportSize({ width, height: 850 });
                await p.evaluate(theme => { localStorage.setItem('thesishs-theme', theme); document.documentElement.dataset.theme = theme; }, theme);
                assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                if (width === 360) {
                    await p.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
                    await expect(p.getByRole('dialog', { name: 'Navigation', exact: true }).getByRole('link', { name: 'Group Workspace', exact: true })).toBeVisible();
                    await p.getByRole('button', { name: 'Close navigation menu', exact: true }).click();
                }
                await p.getByRole('button', { name: 'New Note', exact: true }).click();
                assert.ok(await dialog(p).evaluate(d => d.getBoundingClientRect().width <= innerWidth && d.getBoundingClientRect().bottom <= innerHeight));
                await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab'); assert.ok(await dialog(p).evaluate(d => d.contains(document.activeElement)));
                await p.keyboard.press('Escape'); await closed(p); await expect(p.getByRole('button', { name: 'New Note', exact: true })).toBeFocused();
                await p.getByRole('tab', { name: 'Tasks', exact: true }).click(); await p.getByRole('button', { name: 'New Task', exact: true }).click();
                assert.ok(await dialog(p).evaluate(d => d.getBoundingClientRect().width <= innerWidth && d.getBoundingClientRect().bottom <= innerHeight));
                await p.keyboard.press('Escape'); await closed(p); assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                await p.getByRole('tab', { name: 'Notes', exact: true }).click();
            }
            await p.screenshot({ path: path.join(path.dirname(manifest), 'workspace-desktop.png'), fullPage: true, mask: [p.getByText(actor.email, { exact: false })] });
            await p.setViewportSize({ width: 360, height: 850 }); await p.screenshot({ path: path.join(path.dirname(manifest), 'workspace-mobile.png'), fullPage: true, mask: [p.getByText(actor.email, { exact: false })] });
            assert.deepEqual(pageErrors, []);
        });
        assert.equal((await client`select count(*)::int as n from research_papers where id=any(${owned.papers}::integer[]) and status='Draft'`)[0].n, 2);
        outcome = limitations.length ? 'PARTIAL' : 'PASS';
    } catch (error) {
        if (manifest) {
            const page = pages[0];
            if (page && !page.isClosed()) {
                try { await page.screenshot({ path: path.join(path.dirname(manifest), 'failure.png'), fullPage: true, timeout: 5000 }); } catch { /* Diagnostics must not block cleanup. */ }
            }
            fs.writeFileSync(path.join(path.dirname(manifest), 'browser-diagnostics.json'), JSON.stringify({ pageErrors, networkFailures, urls: pages.filter(p => !p.isClosed()).map(p => p.url()), lastWorkspaceRequests: requests.slice(-3) }, null, 2), { mode: 0o600 });
        }
        failure = String(error?.message || error).replaceAll(password, '[redacted]').replaceAll(marker, '[C5 marker]').replace(/postgres(?:ql)?:\/\/\S+/gi, '[redacted connection]').replace(/\b[^\s"']+@example\.invalid\b/g, '[redacted synthetic email]').slice(0, 1800);
        console.error(JSON.stringify({ status: outcome === 'BLOCKED' && fixturesCommitted ? 'FAIL' : 'BLOCKED', stage, error: failure }));
        outcome = fixturesCommitted && stage !== 'real creator password login, session, Student dashboard and workspace navigation' ? 'FAIL' : 'BLOCKED'; process.exitCode = 1;
    } finally {
        // Log out via the real application before exact-ID fixture cleanup. Never stop the reused server.
        for (const page of pages) {
            try {
                acceptConfirm = true;
                if (!page.isClosed()) {
                    await page.goto(origin + '/dashboard/student', { waitUntil: 'domcontentloaded', timeout: 20000 });
                    await page.waitForLoadState('networkidle', { timeout: 15000 });
                    await page.setViewportSize({ width: 1280, height: 850 });
                    const logout = page.getByRole('button', { name: 'Logout', exact: true });
                    if (await logout.count()) { await logout.first().click(); await page.waitForURL(origin + '/login', { timeout: 20000 }); }
                    assert.ok(!(await page.context().cookies()).some(c => c.name === 'thesishs_session'));
                }
            } catch { limitations.push('A synthetic browser logout could not be confirmed; context closed and account removed.'); }
        }
        await browser?.close();
        if (client && before) {
            try {
                if (owned.users.length) await client.begin(async tx => {
                    await inspectIdentity(tx);
                    const users = await tx`select id,first_name,email from users where id=any(${owned.users.map(u => u.id)}::integer[]) for update`;
                    assert.ok(users.every(u => u.first_name === marker && u.email.startsWith(marker.toLowerCase() + '-') && u.email.endsWith('@example.invalid')));
                    const papers = await tx`select id,group_id,abstract from research_papers where id=any(${owned.papers}::integer[]) for update`;
                    assert.ok(papers.every(p => p.abstract === marker && owned.groups.includes(p.group_id)));
                    const notes = owned.papers.length ? await tx`select id,created_by,title from task_notes where paper_id=any(${owned.papers}::integer[]) for update` : [];
                    const tasks = owned.papers.length ? await tx`select id,created_by,title from group_tasks where paper_id=any(${owned.papers}::integer[]) for update` : [];
                    assert.ok([...notes, ...tasks].every(row => owned.users.some(u => u.id === row.created_by) && row.title.startsWith(marker + ' ')));
                    for (const row of notes) { if (!owned.notes.includes(row.id)) owned.notes.push(row.id); }
                    for (const row of tasks) { if (!owned.tasks.includes(row.id)) owned.tasks.push(row.id); } persist();
                    for (const row of notes) await tx`delete from task_notes where id=${row.id} and paper_id=any(${owned.papers}::integer[]) and created_by=${row.created_by}`;
                    for (const row of tasks) await tx`delete from group_tasks where id=${row.id} and paper_id=any(${owned.papers}::integer[]) and created_by=${row.created_by}`;
                    for (const id of owned.papers) await tx`delete from research_papers where id=${id} and abstract=${marker}`;
                    for (const id of owned.members) await tx`delete from group_members where id=${id} and group_id=any(${owned.groups}::integer[]) and user_id=any(${owned.users.map(u => u.id)}::integer[])`;
                    for (const id of owned.groups) await tx`delete from research_groups where id=${id} and group_name=${marker}`;
                    for (const u of owned.users) await tx`delete from users where id=${u.id} and first_name=${marker}`;
                });
                const after = await client.begin('read only', async tx => {
                    for (const [table, ids] of Object.entries({ users: owned.users.map(u => u.id), research_groups: owned.groups, group_members: owned.members, research_papers: owned.papers, group_tasks: owned.tasks, task_notes: owned.notes })) {
                        const [row] = await tx`select count(*)::int as n from ${tx('public.' + table)} where id=any(${ids}::integer[])`; assert.equal(row.n, 0, 'Exact owned fixture IDs must be absent');
                    }
                    return inspectLocalWorkspace(tx, 17);
                });
                assert.deepEqual(after.rows, before.rows); assert.deepEqual(after.catalog, before.catalog); assert.deepEqual(after.ledger, before.ledger); assert.deepEqual(after.identity, before.identity);
                const changedSequences = Object.keys(before.sequences).filter(name => JSON.stringify(before.sequences[name]) !== JSON.stringify(after.sequences[name]));
                for (const name of changedSequences) { assert.ok(['users_id_seq', 'research_groups_id_seq', 'group_members_id_seq', 'research_papers_id_seq', 'group_tasks_id_seq', 'task_notes_id_seq'].includes(name)); assert.deepEqual(after.sequences[name].definition, before.sequences[name].definition); }
                cleanupVerified = true;
                if (manifest) { persist(); fs.writeFileSync(path.join(path.dirname(manifest), 'result.json'), JSON.stringify({ status: outcome, remainingOnly, results, limitations, navigationEvidence, failure, owned, baselineCounts: Object.fromEntries(Object.entries(before.rows).map(([t, r]) => [t, r.count])), cleanupVerified, changedSequences, sourceMatchingLedgerEntries: 17 }, null, 2), { mode: 0o600 }); }
                console.log(JSON.stringify({ cleanupVerified, exactFixtureIdsAbsent: true, original19TablesPreserved: true, existingTasks: before.rows.group_tasks.count, existingNotes: before.rows.task_notes.count, ledgerEntries: 17, changedSequences, sequencesNotReset: true }));
            } catch (error) {
                cleanupVerified = false; process.exitCode = 1; outcome = 'FAIL';
                if (manifest) persist(); console.error(JSON.stringify({ cleanupVerified: false, stage: 'cleanup/preservation', type: error.name, remainingIdsManifest: manifest }));
            }
        }
        await client?.end({ timeout: 2 });
        if (limitations.length && outcome === 'PASS') outcome = 'PARTIAL';
        console.log(JSON.stringify({ status: outcome, passedGroups: results.length, cleanupVerified, limitations, stage, evidenceDirectory: manifest && path.dirname(manifest), reusedServerLeftRunning: true }));
    }
}
async function inspectIdentity(tx) {
    const { verifyLocalIdentity, verifyLocalLedger } = require('../scripts/migrate-local-workspace.ts');
    const [identity] = await tx`select current_database() as database,current_user as username,session_user as login,host(inet_server_addr()) as address,inet_server_port() as port,(select oid::text from pg_database where datname=current_database()) as oid,(select system_identifier::text from pg_control_system()) as cluster,(select pg_get_userbyid(datdba) from pg_database where datname=current_database()) as owner,(select rolsuper from pg_roles where rolname=current_user) as superuser`;
    verifyLocalIdentity(identity); verifyLocalLedger(await tx`select id,hash,created_at::text from drizzle.__drizzle_migrations order by created_at,id`, 17);
}
void main();
