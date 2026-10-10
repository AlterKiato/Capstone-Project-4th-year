/* eslint-disable @typescript-eslint/no-require-imports */
// Existing synthetic local accounts only; read-only SQL, no fixture writes/provider calls.
const assert = require('node:assert/strict');
const Module = require('node:module');
const { spawn } = require('node:child_process');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
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
const origin = 'http://127.0.0.1:3019';
let browser, server;
async function main() {
    const accounts = await db.execute(sql`SELECT id, role_id FROM users WHERE is_active = true
        AND (email ILIKE '%test%' OR email ILIKE '%phase%') ORDER BY id`);
    const actors = [1, 2, 3].map(role => accounts.find(row => row.role_id === role));
    assert.ok(actors.every(Boolean), 'Existing active synthetic accounts required');
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3019'], { windowsHide: true, stdio: 'ignore' });
    let ready = false;
    for (let i = 0; i < 60; i++) {
        if (server.exitCode !== null) throw new Error('Temporary server exited');
        try { if ((await fetch(origin + '/login')).ok) { ready = true; break; } } catch { /* startup */ }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready);
    browser = await chromium.launch();
    const errors = [];
    for (const width of [360, 1280]) {
        for (let i = 0; i < actors.length; i++) {
            const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'dark' });
            await context.route('**/*', route => {
                if (new URL(route.request().url()).origin !== origin) { errors.push('external request'); return route.abort(); }
                return route.continue();
            });
            const token = await createToken({ userId: actors[i].id, roleId: actors[i].role_id, email: 'phase9-synthetic@example.invalid' });
            await context.addCookies([{ name: 'thesishs_session', value: token, url: origin, httpOnly: true, sameSite: 'Lax' }]);
            const page = await context.newPage();
            page.on('pageerror', () => errors.push('page error'));
            page.on('console', message => { if (message.type() === 'error') errors.push('console error'); });
            page.on('response', response => { if (response.status() >= 500) errors.push('HTTP 5xx'); });
            const role = ['admin', 'adviser', 'student'][i];
            await page.goto(origin + '/dashboard/' + role);
            await expect(page.getByRole('heading', { level: 1 })).toHaveText(role[0].toUpperCase() + role.slice(1) + ' Dashboard');
            await expect(page.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute('aria-current', 'page');
            assert.equal(await page.title(), 'ThesiSHS AI');
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow');
            assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'light');
            for (const link of await page.getByRole('navigation').getByRole('link').all()) {
                const href = await link.getAttribute('href');
                assert.ok(href.startsWith('/dashboard/' + role) || href === '/dashboard/repository');
                const bounds = await link.boundingBox();
                assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.height >= 44);
            }
            await page.keyboard.press('Tab');
            assert.ok(await page.evaluate(() => {
                const element = document.activeElement;
                return element.matches(':focus-visible') && parseFloat(getComputedStyle(element).outlineWidth) >= 3;
            }), 'Keyboard focus visible');
            const shot = join(tmpdir(), `phase9-${role}-${width}.png`);
            await page.screenshot({ path: shot, fullPage: true });
            console.log('Screenshot: ' + shot);
            await page.getByRole('link', { name: 'Browse Repository', exact: true }).click();
            await expect(page).toHaveURL(origin + '/dashboard/repository');
            await page.goto(origin + '/dashboard');
            await expect(page.getByText('Role ID:', { exact: false })).toHaveCount(0);
            await expect(page.getByRole('heading', { level: 2 })).toHaveText(role[0].toUpperCase() + role.slice(1) + ' Workspace');
            for (const other of ['admin', 'adviser', 'student'].filter(other => other !== role)) {
                await expect(page.locator(`a[href="/dashboard/${other}"]`)).toHaveCount(0);
            }
            await page.goto(origin + '/dashboard/' + (role === 'admin' ? 'student' : 'admin'));
            await expect(page).toHaveURL(origin + '/dashboard');
            await page.getByRole('button', { name: 'Logout', exact: true }).click();
            await expect(page).toHaveURL(origin + '/login');
            assert.ok(!(await context.cookies()).some(cookie => cookie.name === 'thesishs_session'));
            await page.goto(origin + '/dashboard/' + role);
            await expect(page).toHaveURL(origin + '/login');
            await page.getByLabel('Email').fill('phase9-invalid@example.invalid');
            await page.getByLabel('Password').fill('Synthetic-invalid-password');
            await page.getByRole('button', { name: 'Login', exact: true }).click();
            await expect(page.getByText('Invalid email or password.', { exact: true })).toBeVisible();
            await context.close();
        }
    }
    assert.deepEqual(errors, []);
    console.log('PASS: three role entry screens at 360/1280, navigation, light theme, keyboard focus, restrictions, logout/anonymous redirect, invalid login. Successful password login not tested; sessions seeded with existing synthetic IDs. Zero DB writes/provider requests.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    await browser?.close(); server?.kill(); process.exit(process.exitCode || 0);
});
