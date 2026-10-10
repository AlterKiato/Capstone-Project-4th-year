/* eslint-disable @typescript-eslint/no-require-imports */
// node --import tsx tests/phase8-chatbot-guide.browser.cjs
// Existing local users/JWT only; no fixtures, research reads or database/storage writes.
const assert = require('node:assert/strict');
const Module = require('node:module');
const { spawn } = require('node:child_process');
require('dotenv/config');
const database = new URL(process.env.DATABASE_URL);
assert.equal(database.hostname, 'localhost');
assert.equal(database.pathname, '/thesishs_ai');
const originalLoad = Module._load;
Module._load = function(id, ...args) { return id === 'server-only' ? {} : originalLoad.call(this, id, ...args); };
const { db } = require('../lib/db.ts');
const { sql } = require('drizzle-orm');
const { createToken } = require('../lib/auth/jwt.ts');
const { chromium, expect } = require('@playwright/test');
const origin = 'http://127.0.0.1:3018';
let browser;
let server;
async function main() {
    const accounts = await db.execute(sql`SELECT id, role_id, email FROM users WHERE is_active = true
        ORDER BY CASE WHEN email ILIKE '%test%' OR email ILIKE '%phase%' THEN 0 ELSE 1 END, id`);
    const actors = [1, 2, 3, 4].map(role => accounts.find(row => row.role_id === role));
    assert.ok(actors.every(Boolean), 'Existing active local accounts for all roles required');
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3018'],
        { windowsHide: true, stdio: 'ignore' });
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
        if (server.exitCode !== null) throw new Error('Temporary server exited');
        try { const response = await fetch(origin + '/login'); if (response.ok) { ready = true; break; } } catch { /* starting */ }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready, 'Temporary production server ready');
    browser = await chromium.launch();
    const errors = [];
    const external = [];
    async function signedPage(actor, claimedRole = actor?.role_id) {
        const context = await browser.newContext();
        await context.route('**/*', route => {
            if (new URL(route.request().url()).origin !== origin) { external.push('unexpected external request'); return route.abort(); }
            return route.continue();
        });
        if (actor) {
            const token = await createToken({ userId: actor.id, roleId: claimedRole, email: actor.email });
            await context.addCookies([{ name: 'thesishs_session', value: token, url: origin, httpOnly: true, sameSite: 'Lax' }]);
        }
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.name));
        page.on('console', message => { if (message.type() === 'error') errors.push('console error'); });
        page.on('response', response => { if (response.status() >= 500) errors.push('HTTP 5xx'); });
        return page;
    }
    const questions = [
        'Where do I manage users?',
        'How do I start a submission review?',
        'How do revisions and version history work?',
    ];
    const expected = ['User Management', 'Under Review', 'Revision Required'];
    for (let index = 0; index < 3; index++) {
        const page = await signedPage(actors[index]);
        await page.goto(origin + '/dashboard');
        await page.getByRole('link', { name: 'System Guide', exact: true }).click();
        await expect(page).toHaveURL(origin + '/dashboard/guide');
        await expect(page.getByRole('heading', { name: 'ThesiSHS AI System Guide', exact: true })).toBeVisible();
        assert.equal(await page.locator('input, textarea').count(), 0);
        for (const other of questions.filter(question => question !== questions[index])) {
            await expect(page.getByRole('button', { name: other, exact: true })).toHaveCount(0);
        }
        await page.getByRole('button', { name: questions[index], exact: true }).click();
        await expect(page.locator('#guide-answer').locator('..')).toContainText(expected[index]);
        await expect(page.getByRole('status')).toContainText('AI explanations are disabled');
        const response = page.locator('#guide-answer').locator('..');
        assert.ok((await response.getByRole('link').getAttribute('href')).startsWith('/dashboard/'));
        await page.getByRole('button', { name: 'What can this guide help with?', exact: true }).click();
        await expect(response).toContainText('cannot grade research');
        await page.getByRole('link', { name: 'Back to Dashboard', exact: true }).click();
        await expect(page).toHaveURL(origin + '/dashboard');
    }
    const panel = await signedPage(actors[3]);
    await panel.goto(origin + '/dashboard');
    await expect(panel.getByRole('link', { name: 'System Guide', exact: true })).toHaveCount(0);
    await panel.goto(origin + '/dashboard/guide');
    await expect(panel).toHaveURL(origin + '/dashboard');
    const anonymous = await signedPage(null);
    await anonymous.goto(origin + '/dashboard/guide'); await expect(anonymous).toHaveURL(origin + '/login');
    const stale = await signedPage(actors[2], 1);
    await stale.goto(origin + '/dashboard/guide');
    await expect(stale.getByRole('status')).toContainText('System guidance is unavailable');
    await expect(stale.getByRole('button', { name: questions[0], exact: true })).toHaveCount(0);
    // Read-only production route acceptance for new governance controls; no certification/consent writes.
    const adminUsers = await signedPage(actors[0]);
    await adminUsers.goto(origin + '/dashboard/admin/users');
    const creation = adminUsers.getByRole('region', { name: 'Create Admin or Adviser account' });
    await expect(creation).toBeVisible();
    assert.deepEqual(await creation.locator('select[name=roleId] option').allTextContents(), ['Admin','Adviser']);
    await adminUsers.getByRole('button', { name: 'AI eligibility', exact: true }).first().click();
    await expect(adminUsers.getByRole('dialog').getByRole('button', { name: 'Record eligibility' })).toBeDisabled();
    await expect(adminUsers.getByRole('dialog').getByRole('checkbox')).not.toBeChecked();
    await adminUsers.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    for (const [actor, route] of [[actors[0], '/dashboard/admin/reports'], [actors[1], '/dashboard/adviser/submissions']]) {
        const entry = await signedPage(actor);
        await entry.goto(origin + route);
        await entry.getByRole('button', { name: 'AI Terms & Consent', exact: true }).click();
        const popup = entry.getByRole('dialog');
        await expect(popup).toContainText('DRAFT: Institutional and provider');
        await expect(popup).toContainText('3 attempts per account');
        await expect(popup.getByRole('checkbox')).not.toBeChecked();
        await expect(popup.getByRole('button', { name: 'Accept terms' })).toBeDisabled();
        await popup.getByRole('button', { name: 'Close', exact: true }).click();
        await entry.getByRole('button', { name: actor.role_id === 1 ? 'Explain report metrics' : 'How do I start review?', exact: true }).click();
        await expect(entry.getByRole('region', { name: actor.role_id === 1 ? 'Admin report assistance' : 'Adviser workflow assistance' }).getByRole('status')).toContainText(actor.role_id === 1 ? 'AI interpretation is disabled' : 'No AI provider is used');
    }
    const studentUsers = await signedPage(actors[2]);
    await studentUsers.goto(origin + '/dashboard/admin/users');
    await expect(studentUsers).toHaveURL(origin + '/dashboard');
    await expect(studentUsers.getByRole('region', { name: 'Create Admin or Adviser account' })).toHaveCount(0);
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log('PASS Chromium: all three roles navigate/select canonical answers and static fallback; no free text or cross-role cards; Panel/anonymous/stale role denied; no external/console/page/5xx errors');
}
async function cleanup() { await browser?.close(); server?.kill(); }
main().then(async () => { await cleanup(); process.exit(0); }).catch(async error => {
    console.error('FAIL guide browser acceptance: ' + error.name);
    console.error(error.stack.split('\n').filter(line => line.trim().startsWith('at ')).join('\n'));
    await cleanup(); process.exit(1);
});
