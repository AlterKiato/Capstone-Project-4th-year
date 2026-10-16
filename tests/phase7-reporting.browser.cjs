/* eslint-disable @typescript-eslint/no-require-imports */
// node --import tsx tests/phase7-reporting.browser.cjs
// One focused Chromium scenario; existing local accounts/data and JWT helper, no writes.
const assert = require('node:assert/strict');
const Module = require('node:module');
require('dotenv/config');
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, 'localhost');
assert.equal(target.pathname, '/thesishs_ai');
const originalLoad = Module._load;
Module._load = function(id, ...args) { return id === 'server-only' ? {} : originalLoad.call(this, id, ...args); };
const { db } = require('../lib/db.ts');
const { sql } = require('drizzle-orm');
const { createToken } = require('../lib/auth/jwt.ts');
const { chromium, expect } = require('@playwright/test');
const base = new URL(process.env.PHASE7_BASE_URL || 'http://127.0.0.1:3017');
assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname));
let browser;
async function main() {
    const accounts = await db.execute(sql`SELECT id, role_id, email FROM users WHERE is_active = true
        ORDER BY CASE WHEN email ILIKE '%test%' OR email ILIKE '%phase%' THEN 0 ELSE 1 END, id`);
    const admin = accounts.find(row => row.role_id === 1);
    const student = accounts.find(row => row.role_id === 3);
    assert.ok(admin && student, 'Existing active local Admin and Student test accounts required');
    browser = await chromium.launch();
    const errors = [];
    const signedPage = async actor => {
        const context = await browser.newContext();
        const token = await createToken({ userId: actor.id, roleId: actor.role_id, email: actor.email });
        await context.addCookies([{ name: 'thesishs_session', value: token, url: base.origin, httpOnly: true, sameSite: 'Lax' }]);
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.name));
        page.on('console', message => { if (message.type() === 'error') errors.push('browser console error'); });
        page.on('response', response => { if (response.url().startsWith(base.origin) && response.status() >= 500) errors.push('HTTP ' + response.status()); });
        return page;
    };
    const page = await signedPage(admin);
    await page.goto(base.origin + '/dashboard');
    await expect(page).toHaveURL(base.origin + '/dashboard/admin');
    await page.getByRole('navigation', { name: 'Dashboard pages' }).getByRole('link', { name: 'Reports', exact: true }).click();
    await expect(page).toHaveURL(base.origin + '/dashboard/admin/reports');
    for (const name of ['Admin Reports', 'System Overview', 'Users by Role', 'Research Papers by Status', 'Recent System Activity']) {
        await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }
    for (const label of ['Total Users', 'Total Research Groups', 'Total Research Papers', 'Total Published Repository Papers']) {
        await expect(page.locator('dl[aria-label="System statistics"] dt', { hasText: label }).first()).toBeVisible();
    }
    await expect(page.locator('main')).not.toContainText('Admin reporting is unavailable.');
    await page.screenshot({ path: '.next/phase7-reporting-browser.png', fullPage: true });
    const denied = await signedPage(student);
    await denied.goto(base.origin + '/dashboard/admin/reports');
    await expect(denied).toHaveURL(base.origin + '/dashboard/student');
    await expect(denied.getByRole('heading', { name: 'Admin Reports', exact: true })).toHaveCount(0);
    assert.deepEqual(errors, [], 'No runtime, console or server-rendering errors');
    console.log('PASS Chromium: existing Admin navigates Dashboard -> Admin Dashboard -> Reports; reporting sections/metrics visible; no runtime/console/HTTP 5xx errors; existing Student direct URL redirects to Dashboard without reports');
}
main().then(async () => { await browser?.close(); process.exit(0); }).catch(async error => {
    console.error('FAIL focused Phase 7 browser acceptance: ' + error.name);
    console.error(error.stack.split('\n').filter(line => line.trim().startsWith('at ')).join('\n'));
    await browser?.close(); process.exit(1);
});
