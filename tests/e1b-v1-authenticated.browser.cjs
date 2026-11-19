/* eslint-disable @typescript-eslint/no-require-imports */
// Real copied application + real Server Actions/authentication + owned PostgreSQL only.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { chromium, expect } = require('@playwright/test');

exports.run = async function({ state, root, save, verify, connect }) {
    const home = path.join(root, state.run), app = path.join(home, 'application'), origin = 'http://127.0.0.1:3057';
    await new Promise((resolve, reject) => { const listener = require('node:net').createServer(); listener.once('error', reject); listener.listen(3057, '127.0.0.1', () => listener.close(resolve)); });
    assert.equal(fs.readFileSync(path.join(home, 'owner'), 'utf8'), state.run);
    if (fs.existsSync(app)) assert.equal(fs.lstatSync(app).isSymbolicLink(), false);
    else fs.mkdirSync(app);
    for (const folder of ['app','components','lib','db','types','public']) fs.cpSync(path.resolve(folder), path.join(app, folder), { recursive: true });
    for (const file of ['package.json','package-lock.json','next.config.ts','tsconfig.json','tsconfig.verification.json','postcss.config.mjs','next-env.d.ts']) if (fs.existsSync(file)) fs.copyFileSync(file, path.join(app, file));
    if (fs.existsSync(path.join(app, 'node_modules'))) {
        assert.equal(fs.lstatSync(path.join(app, 'node_modules')).isSymbolicLink(), true);
        assert.equal(fs.realpathSync(path.join(app, 'node_modules')), fs.realpathSync('node_modules'));
    } else fs.symlinkSync(path.resolve('node_modules'), path.join(app, 'node_modules'), 'junction');
    assert.equal(fs.readdirSync(app).some(name => name.startsWith('.env')), false);
    const fontMock = path.join(home, 'font-fallback.cjs');
    fs.writeFileSync(fontMock, "module.exports=new Proxy({}, {get(){return '@font-face {font-family: Manrope; src: local(Arial); font-style: normal; font-weight: 200 800;}';}});\n");
    const networkGuard = path.join(home, 'network-guard.cjs');
    fs.writeFileSync(networkGuard, `
const net=require('node:net');const original=net.Socket.prototype.connect;
net.Socket.prototype.connect=function(...args){const o=Array.isArray(args[0])?args[0][0]:net._normalizeArgs(args)[0];
if(o.path){if(!String(o.path).startsWith('\\\\\\\\.\\\\pipe\\\\'))throw Error('E1BV1_BLOCKED_SOCKET_PATH');}
else if(!['127.0.0.1','localhost','::1'].includes(o.host||'localhost')||![55447,3057].includes(Number(o.port)))throw Error('E1BV1_BLOCKED_EGRESS');
return original.apply(this,args)};
const fetch=globalThis.fetch;globalThis.fetch=(input,...rest)=>{const u=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);if(u.origin!=='${origin}')throw Error('E1BV1_BLOCKED_FETCH');return fetch(input,...rest)};
`);
    const env = {};
    for (const key of ['SystemRoot','WINDIR','PATH','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA','COMSPEC']) if (process.env[key]) env[key] = process.env[key];
    const endpoint = user => ({ host: '127.0.0.1', port: state.port, database: state.database, user });
    Object.assign(env, { NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', THESISHS_VERIFICATION_ACCEPTANCE: '1',
        JWT_SECRET: state.jwt, THESISHS_DATABASE_ENV: 'development', DATABASE_URL: `postgresql://e1bv1_runtime:${state.runtimePassword}@127.0.0.1:${state.port}/${state.database}?sslmode=disable`,
        THESISHS_DATABASE_TARGETS_JSON: JSON.stringify({ development: { identity: 'owned-e1bv1-'+state.run, runtime: endpoint('e1bv1_runtime'), operator: endpoint(state.operator),
            observed: { databaseOid: state.databaseOid, cluster: state.cluster, provider: 'postgres', runtimeRole: 'e1bv1_runtime', operatorRole: state.operator } } }),
        THESISHS_WEB_PUSH_ENABLED: 'false', GROQ_DEMO_ENABLED: '0', NEXT_FONT_GOOGLE_MOCKED_RESPONSES: fontMock,
        NODE_OPTIONS: '--require='+JSON.stringify(networkGuard) });
    const logPath = path.join(home, 'next.log'), log = fs.openSync(logPath, 'a');
    const resumeVisual = state.browserStage === 'unsaved/visual' && state.browserChecks?.length === 4;
    let server, browser; const sql = connect(state), errors = [], unexpected = [], checks = resumeVisual ? [...state.browserChecks] : [];
    let stage = 'startup';
    try {
        await verify(sql, state, state.database);
        server = spawn(process.execPath, [path.resolve('node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3057'], { cwd: app, env, windowsHide: true, stdio: ['ignore', log, log] });
        state.nextPid = server.pid; save(state);
        console.log('E1B-V1 browser: isolated copied app, generated local environment, external egress blocked; starting owned Next server.');
        let ready = false;
        for (let n = 0; n < 60; n++) {
            if (server.exitCode !== null) break;
            try {
                const response = await fetch(origin+'/login', { signal: AbortSignal.timeout(2000) });
                if (response.ok) { ready = true; break; }
                if (response.status >= 500) throw Error('Owned Next login returned '+response.status);
            } catch (error) { if (/Owned Next/.test(error.message)) throw error; }
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        assert.ok(ready, 'Owned Next startup unavailable');
        console.log('E1B-V1 browser: Next ready; authenticating disposable Main through the actual login form.');
        browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        await context.route('**/*', route => route.request().url().startsWith(origin+'/') ? route.continue() : (unexpected.push(route.request().url()), route.abort()));
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', item => { if (item.type() === 'error') errors.push(item.text()); });
        page.setDefaultTimeout(15000);
        await page.goto(origin+'/login', { timeout: 60000 });
        await page.getByLabel('Email', { exact: true }).fill('e1bv1-1@example.invalid');
        await page.getByLabel('Password', { exact: true }).fill(state.loginPassword);
        await page.getByRole('button', { name: 'Login', exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard(?:\/adviser)?$/, { timeout: 120000 });
        const cookie = (await context.cookies()).find(item => item.name === 'thesishs_session'); assert.ok(cookie?.httpOnly);
        stage = 'directory';
        await page.goto(origin+'/dashboard/adviser/submissions', { timeout: 60000 });
        await expect(page.getByRole('heading', { name: 'Research Submissions', exact: true })).toBeVisible();
        await expect(page.getByLabel('Status filter', { exact: true })).toBeVisible();
        await page.getByRole('link', { name: 'Evaluation templates', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Saved templates', exact: true })).toBeVisible();
        let createRequest, capturedDuplicate;
        if (!resumeVisual) {
        checks.push('real credential login, verified HttpOnly session, unchanged directory and secondary entry');
        stage = 'create';
        let [stored] = await sql`select * from evaluation_templates where name='E1B V1 browser template' and owner_id=1`;
        if (!stored) {
        await page.getByRole('button', { name: 'Create template', exact: true }).click();
        await page.getByLabel('Template name', { exact: true }).fill('E1B V1 browser template');
        await page.getByLabel('Criterion 1', { exact: true }).fill('Method');
        await page.getByRole('button', { name: 'Add criterion', exact: true }).click();
        await page.getByLabel('Criterion 2', { exact: true }).fill('Evidence');
        await page.getByRole('button', { name: 'Move criterion 2 up', exact: true }).focus(); await page.keyboard.press('Enter');
        await expect(page.getByLabel('Criterion 1', { exact: true })).toHaveValue('Evidence');
        await page.getByText('Criterion 1 options', { exact: true }).click();
        await page.getByLabel('Allow N/A for this criterion', { exact: true }).first().check();
        await page.getByText('Customize scale', { exact: true }).click();
        await page.getByLabel('Number of rating levels', { exact: true }).selectOption('5');
        await page.getByLabel('5 points: label', { exact: true }).fill('Highest');
        const actionRequest = page.waitForRequest(request => request.method() === 'POST' && !!request.headers()['next-action']);
        await page.getByRole('button', { name: 'Save template', exact: true }).click();
        createRequest = await actionRequest;
        await expect(page.getByRole('heading', { name: 'E1B V1 browser template', exact: true })).toBeVisible();
        [stored] = await sql`select * from evaluation_templates where name='E1B V1 browser template' and owner_id=1`;
        }
        assert.ok(stored); assert.equal(stored.scale.levels.length, 5);
        const storedCriteria = await sql`select * from evaluation_template_criteria where template_id=${stored.id} order by position`;
        assert.deepEqual(storedCriteria.map(row => row.name), ['Evidence','Method']); assert.equal(storedCriteria[0].allows_na, true);
        checks.push('real create Server Action persisted custom five-level scale, N/A and keyboard order');
        stage = 'edit';
        await page.getByRole('button', { name: 'Edit template: E1B V1 browser template', exact: true }).click();
        await page.getByLabel('Template name', { exact: true }).fill(' ');
        await page.getByRole('button', { name: 'Save template', exact: true }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'Enter a name' })).toBeVisible();
        await page.getByLabel('Template name', { exact: true }).fill('E1B V1 updated template');
        const editRequest = page.waitForRequest(request => request.method() === 'POST' && !!request.headers()['next-action']);
        await page.getByRole('button', { name: 'Save template', exact: true }).click();
        const capturedEdit = await editRequest;
        if (!createRequest) {
            const input = JSON.parse(capturedEdit.postDataBuffer().toString('utf8'));
            assert.equal(input[0].operation, 'update');
            input[0] = { operation: 'create', draft: input[0].draft };
            createRequest = { headers: () => capturedEdit.headers(), postDataBuffer: () => Buffer.from(JSON.stringify(input)) };
        }
        await expect(page.getByRole('heading', { name: 'E1B V1 updated template', exact: true })).toBeVisible();
        stored = (await sql`select * from evaluation_templates where id=${stored.id}`)[0]; assert.equal(stored.name, 'E1B V1 updated template'); assert.equal(stored.revision, 1);
        checks.push('real edit persisted with revision advancement; concise whitespace-name validation');
        stage = 'duplicate/archive';
        const duplicateRequest = page.waitForRequest(request => request.method() === 'POST' && !!request.headers()['next-action']);
        await page.getByRole('button', { name: 'Duplicate template: E1B V1 updated template', exact: true }).click();
        capturedDuplicate = await duplicateRequest;
        await expect(page.getByRole('heading', { name: 'E1B V1 updated template (copy)', exact: true })).toBeVisible();
        const [copy] = await sql`select * from evaluation_templates where name='E1B V1 updated template (copy)' and owner_id=1`;
        assert.notEqual(copy.id, stored.id);
        const keys = await sql`select criterion_key from evaluation_template_criteria where template_id=${copy.id}`;
        assert.ok(keys.every(item => !storedCriteria.some(old => old.criterion_key === item.criterion_key)));
        await page.getByRole('button', { name: 'Archive template: E1B V1 updated template (copy)', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.getByRole('dialog').getByRole('button', { name: 'Archive template', exact: true }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        assert.ok((await sql`select archived_at from evaluation_templates where id=${copy.id}`)[0].archived_at);
        await expect(page.getByRole('heading', { name: 'E1B V1 updated template (copy)', exact: true })).toHaveCount(0);
        checks.push('real duplicate creates independent IDs; archive confirmation persists and removes active row');
        } else {
            // Reuse completed persistence/UI evidence; capture fresh transport after the owned server restart.
            await page.getByRole('button', { name: 'Edit template: E1B V1 updated template', exact: true }).click();
            await expect(page.getByLabel('Template name', { exact: true })).toHaveValue('E1B V1 updated template');
            const request = page.waitForRequest(item => item.method() === 'POST' && !!item.headers()['next-action']);
            await page.getByRole('button', { name: 'Save template', exact: true }).click();
            const captured = await request;
            await expect(page.getByRole('heading', { name: 'Saved templates', exact: true })).toBeVisible();
            const input = JSON.parse(captured.postDataBuffer().toString('utf8'))[0];
            assert.equal(input.operation, 'update');
            const transport = value => ({ headers: () => captured.headers(), postDataBuffer: () => Buffer.from(JSON.stringify([value])) });
            createRequest = transport({ operation: 'create', draft: input.draft });
            capturedDuplicate = transport({ operation: 'duplicate', templateId: input.templateId, expectedRevision: input.expectedRevision + 1 });
        }
        stage = 'unsaved/visual';
        for (const theme of ['light','dark']) {
            await page.setViewportSize({ width: 1440, height: 1000 });
            await page.evaluate(value => localStorage.setItem('thesishs-theme', value), theme);
            await page.reload({ waitUntil: 'networkidle' });
            await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
            await expect(page.getByRole('heading', { name: 'Saved templates', exact: true })).toBeVisible();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1), true);
            await page.screenshot({ path: path.join(home, 'authenticated-list-'+theme+'-1440.png'), fullPage: true });
        }
        await page.getByRole('button', { name: 'Edit template: E1B V1 updated template', exact: true }).click();
        await page.getByLabel('Template name', { exact: true }).fill('Unsaved disposable draft');
        page.once('dialog', dialog => dialog.dismiss());
        await page.getByRole('button', { name: 'Back to templates', exact: true }).click();
        await expect(page.getByLabel('Template name', { exact: true })).toHaveValue('Unsaved disposable draft');
        page.once('dialog', dialog => dialog.accept());
        await page.getByRole('button', { name: 'Back to templates', exact: true }).click();
        for (const theme of ['light','dark']) {
            await page.setViewportSize({ width: 360, height: 1000 });
            await page.evaluate(value => localStorage.setItem('thesishs-theme', value), theme);
            await page.reload({ waitUntil: 'networkidle' });
            await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
            await expect(page.getByRole('heading', { name: 'Saved templates', exact: true })).toBeVisible();
            await page.getByRole('button', { name: 'Edit template: E1B V1 updated template', exact: true }).click();
            await page.getByLabel('Criterion 1', { exact: true }).focus();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1), true);
            assert.equal(await page.getByLabel('Criterion 1', { exact: true }).evaluate(el => getComputedStyle(el).outlineStyle !== 'none'), true);
            await page.screenshot({ path: path.join(home, 'authenticated-editor-'+theme+'-360.png') });
            await page.getByRole('button', { name: 'Back to templates', exact: true }).click();
        }
        checks.push('unsaved-discard cancel/accept; actual 1440 Light/Dark list and 360 Light/Dark editor; focus/no overflow');
        stage = 'authenticated denial';
        const { SignJWT } = require('jose');
        async function as(userId, roleId) {
            const token = await new SignJWT({ userId, roleId, email: 'e1bv1-'+userId+'@example.invalid' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(state.jwt));
            await context.clearCookies(); await context.addCookies([{ name: 'thesishs_session', value: token, url: origin, httpOnly: true, sameSite: 'Lax' }]);
        }
        async function replay(request) {
            const response = await context.request.post(origin+'/dashboard/adviser/submissions?view=templates', { headers: { 'next-action': request.headers()['next-action'], 'content-type': request.headers()['content-type'], accept: 'text/x-component', origin }, data: request.postDataBuffer() });
            assert.equal(response.status(), 200); assert.match(await response.text(), /Evaluation templates are unavailable for this account or template/);
        }
        const beforeCount = Number((await sql`select count(*) as count from evaluation_templates`)[0].count);
        for (const [userId, roleId] of [[2,2],[3,1],[4,3],[5,4]]) { await as(userId, roleId); await replay(createRequest); }
        assert.equal(Number((await sql`select count(*) as count from evaluation_templates`)[0].count), beforeCount);
        await verify(sql, state, state.database);
        await sql`update main_adviser_designation set main_adviser_id=2,revision=revision+1 where id=1`;
        try {
            await as(1, 2); await replay(createRequest);
            await as(2, 2); await replay(capturedDuplicate);
            await page.goto(origin+'/dashboard/adviser/submissions?view=templates', { timeout: 60000 });
            await expect(page.getByText('No active templates.', { exact: false })).toBeVisible();
        } finally { await sql`update main_adviser_designation set main_adviser_id=1,revision=revision+1 where id=1`; }
        checks.push('actual authenticated action replays deny non-Main/Student/Admin/Panel, former Main and successor duplication; successor list private');
        assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
        state.browserPass = true; state.browserChecks = checks; save(state);
        fs.writeFileSync(path.join(home, 'browser-result.json'), JSON.stringify({ result: 'PASS', checks, errors, unexpected, environment: 'owned disposable PostgreSQL + actual copied Next application; offline font fallback' }, null, 2));
        console.log('PASS authenticated browser: '+checks.length+' groups; actual Server Actions and PostgreSQL persistence; zero unexpected requests or page errors.');
    } catch (error) {
        state.browserStage = stage; state.browserChecks = checks; save(state);
        fs.writeFileSync(path.join(home, 'browser-attempt.json'), JSON.stringify({ stage, checks, errors, unexpected, failure: error.message }, null, 2));
        try { const page = browser?.contexts()[0]?.pages()[0]; if (page) await page.screenshot({ path: path.join(home, 'browser-attempt-failure.png'), fullPage: true, timeout: 5000 }); } catch { /* Preserve original failure. */ }
        throw Error('Authenticated browser '+stage+': '+error.message);
    } finally {
        await browser?.close(); await sql.end();
        if (server && server.exitCode === null) execFileSync('taskkill.exe', ['/PID', String(server.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        fs.closeSync(log);
        delete state.nextPid; save(state);
    }
};
