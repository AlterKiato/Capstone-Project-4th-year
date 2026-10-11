/* eslint-disable @typescript-eslint/no-require-imports */
// Existing synthetic accounts, read-only SQL and signed sessions. No account/workflow writes.
const assert = require('node:assert/strict');
const Module = require('node:module');
const { spawn } = require('node:child_process');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
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
const origin = 'http://127.0.0.1:3020';
let browser, server;
const errors = [];
async function checkLayout(page, width) {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
    for (const control of await page.locator('input, select, textarea, button, a').all()) {
        if (!await control.isVisible()) continue;
        const bounds = await control.boundingBox();
        assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'Control within viewport');
    }
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.activeElement.matches(':focus-visible') && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 3), 'Visible keyboard focus');
}
async function main() {
    const accounts = await db.execute(sql`SELECT id, role_id, email FROM users WHERE is_active = true
        AND (email ILIKE '%test%' OR email ILIKE '%phase%') ORDER BY id`);
    const actors = [1, 2, 3].map(role => accounts.find(row => row.role_id === role));
    assert.ok(actors.every(Boolean), 'Existing active synthetic local accounts required');
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3020'], { windowsHide: true, stdio: 'ignore' });
    let ready = false;
    for (let i = 0; i < 60; i++) {
        if (server.exitCode !== null) throw new Error('Temporary server exited');
        try { if ((await fetch(origin + '/login')).ok) { ready = true; break; } } catch { /* startup */ }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready);
    browser = await chromium.launch();
    for (const width of [360, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'dark' });
        await context.route('**/*', route => {
            if (new URL(route.request().url()).origin !== origin) { errors.push('external request'); return route.abort(); }
            return route.continue();
        });
        const page = await context.newPage();
        page.on('pageerror', () => errors.push('page error'));
        page.on('console', message => { if (message.type() === 'error') errors.push('console error'); });
        page.on('response', response => { if (response.status() >= 500) errors.push('HTTP 5xx'); });
        await page.goto(origin + '/dashboard/student');
        await expect(page).toHaveURL(origin + '/login');
        await checkLayout(page, width);
        await expect(page.getByLabel('Email')).toHaveAttribute('autocomplete', 'username');
        await expect(page.getByLabel('Password')).toHaveAttribute('autocomplete', 'current-password');
        await page.getByRole('button', { name: 'Login', exact: true }).click();
        assert.equal(await page.getByLabel('Email').evaluate(element => element.validity.valueMissing), true);
        // Use the existing account's email with a deliberately wrong password.
        await page.getByLabel('Email').fill(actors[2].email);
        await page.getByLabel('Password').fill('Phase9-deliberately-invalid-password');
        // Delay transport only, so the real pending UI can be inspected.
        await page.route('**/login', async route => {
            if (route.request().method() === 'POST') await new Promise(resolve => setTimeout(resolve, 400));
            await route.continue();
        });
        await page.getByRole('button', { name: 'Login', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Logging in...' })).toBeDisabled();
        await expect(page.locator('#login-message')).toHaveText('Invalid email or password.');
        await expect(page.locator('#login-message')).toHaveAttribute('aria-live', 'polite');
        await page.screenshot({ path: join(tmpdir(), `phase92-login-${width}.png`), fullPage: true });
        await page.getByRole('link', { name: 'Create an account' }).click();
        await expect(page).toHaveURL(origin + '/register');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create a Student account');
        await checkLayout(page, width);
        for (const [label, autocomplete] of [['First Name', 'given-name'], ['Last Name', 'family-name'], ['Email', 'email'], ['Password', 'new-password'], ['Confirm Password', 'new-password']]) {
            await expect(page.getByLabel(label, { exact: true })).toHaveAttribute('autocomplete', autocomplete);
            await expect(page.getByLabel(label, { exact: true })).toHaveAttribute('required', '');
        }
        await page.getByLabel('First Name').fill('Synthetic');
        await page.getByLabel('Last Name').fill('Validation');
        await page.getByLabel('Email').fill('phase92-validation@example.invalid');
        await page.getByLabel('Password', { exact: true }).fill('Synthetic-password-A');
        await page.getByLabel('Confirm Password').fill('Synthetic-password-B');
        await page.getByRole('button', { name: 'Create Student account' }).click();
        await expect(page.locator('#register-message')).toHaveText('Passwords do not match');
        await page.screenshot({ path: join(tmpdir(), `phase92-register-${width}.png`), fullPage: true });
        await page.getByRole('link', { name: 'Login', exact: true }).click();
        await expect(page).toHaveURL(origin + '/login');
        for (const [i, role] of ['admin', 'adviser', 'student'].entries()) {
            const token = await createToken({ userId: actors[i].id, roleId: actors[i].role_id, email: 'phase9-synthetic@example.invalid' });
            await context.addCookies([{ name: 'thesishs_session', value: token, url: origin, httpOnly: true, sameSite: 'Lax' }]);
            await page.goto(origin + '/login');
            await expect(page).toHaveURL(origin + '/dashboard');
            await expect(page.getByRole('heading', { level: 2 })).toHaveText(role[0].toUpperCase() + role.slice(1) + ' Workspace');
            await page.goto(origin + '/dashboard/' + role);
            await expect(page.getByRole('heading', { level: 1 })).toHaveText(role[0].toUpperCase() + role.slice(1) + ' Dashboard');
            await expect(page.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute('aria-current', 'page');
            await checkLayout(page, width);
            assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'light');
            await page.screenshot({ path: join(tmpdir(), `phase92-${role}-${width}.png`), fullPage: true });
            // Click every existing destination on the entry screen, without submitting workflow forms.
            const hrefs = await page.locator('a').evaluateAll(links => [...new Set(links.map(link => link.getAttribute('href')))]);
            for (const href of hrefs) {
                await page.locator(`a[href="${href}"]`).first().click();
                await expect(page).toHaveURL(origin + href);
                await page.goto(origin + '/dashboard/' + role);
            }
            for (const other of ['admin', 'adviser', 'student'].filter(other => other !== role)) {
                await page.goto(origin + '/dashboard/' + other);
                await expect(page).toHaveURL(origin + '/dashboard');
            }
            await page.getByRole('button', { name: 'Logout', exact: true }).click();
            await expect(page).toHaveURL(origin + '/login');
            assert.ok(!(await context.cookies()).some(cookie => cookie.name === 'thesishs_session'));
            await page.goto(origin + '/dashboard/' + role);
            await expect(page).toHaveURL(origin + '/login');
        }
        await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: auth rendering/native validation/server mismatch/pending/invalid-password error, three role dashboards, every entry link, all six cross-role denials, signed-session hub navigation, logout and anonymous restriction, 360/1280 layout/focus/light theme. No account or research writes, no external requests.');
    console.log('LIMIT: successful password login unavailable; no supplied synthetic password. Signed-session navigation does not prove password login. Screenshots: OS temp/phase92-{login,register,admin,adviser,student}-{360,1280}.png');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    await browser?.close(); server?.kill(); process.exit(process.exitCode || 0);
});
