/* eslint-disable @typescript-eslint/no-require-imports */
// Existing synthetic accounts, read-only SQL and temporary signed sessions only.
const assert = require('node:assert/strict');
const Module = require('node:module');
const { spawn } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
require('dotenv/config');
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, 'localhost');
assert.equal(target.port, '5432');
assert.equal(target.pathname, '/thesishs_ai');
const original = Module._load;
Module._load = function(id, ...args) { return id === 'server-only' ? {} : original.call(this, id, ...args); };
const { db } = require('../lib/db.ts');
const { sql } = require('drizzle-orm');
const { createToken } = require('../lib/auth/jwt.ts');
const { chromium, expect } = require('@playwright/test');
const origin = 'http://127.0.0.1:3029';
let browser, server;
const errors = [];
async function inspect(page) {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
    const failures = await page.locator('main h1, main h2, main p, main dt, main dd, main label, main button').evaluateAll(elements => {
        function lum(color) {
            const c = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
            return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
        }
        return elements.flatMap(el => {
            if (!el.getClientRects().length) return [];
            const s = getComputedStyle(el); let ancestor = el, bg = s.backgroundColor;
            while (bg === 'rgba(0, 0, 0, 0)' && ancestor.parentElement) { ancestor = ancestor.parentElement; bg = getComputedStyle(ancestor).backgroundColor; }
            const l = [lum(s.color), lum(bg)].sort((a, b) => b - a);
            const large = parseFloat(s.fontSize) >= 24 || parseFloat(s.fontSize) >= 18.66 && parseFloat(s.fontWeight) >= 700;
            return (l[0] + .05) / (l[1] + .05) < (large ? 3 : 4.5) ? [el.textContent] : [];
        });
    });
    assert.deepEqual(failures, [], 'Text contrast');
}
async function main() {
    const actors = await db.execute(sql`SELECT id, role_id, email, is_active FROM users WHERE (email ILIKE '%test%' OR email ILIKE '%phase%') ORDER BY id`);
    const users = [1, 2, 3, 4].map(role => actors.find(actor => actor.role_id === role && actor.is_active));
    assert.ok(users.every(Boolean), 'Four existing synthetic roles required');
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3029'], { windowsHide: true, stdio: 'ignore' });
    let ready = false;
    for (let i = 0; i < 100; i++) {
        if (server.exitCode !== null) throw new Error('Temporary server exited');
        try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* startup */ }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready);
    browser = await chromium.launch();
    const anonymous = await browser.newPage();
    await anonymous.goto(`${origin}/dashboard/settings`);
    await expect(anonymous).toHaveURL(`${origin}/login`);
    await anonymous.close();
    for (const user of users) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light' });
        await context.addCookies([{ name: 'thesishs_session', value: await createToken({ userId: user.id, roleId: user.role_id, email: 'untrusted@example.invalid' }), url: origin, httpOnly: true, sameSite: 'Lax' }]);
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        page.on('response', response => { if (response.status() >= 500) errors.push(`HTTP ${response.status()}`); });
        await page.goto(`${origin}/dashboard/settings`);
        await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
        await expect(page.getByRole('definition').filter({ hasText: user.email })).toHaveCount(1);
        assert.equal(await page.locator('main input:not([type=radio]), main textarea, main select').count(), 0);
        await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeChecked();
        const rail = page.getByRole('complementary', { name: 'Workspace sidebar' });
        const settings = rail.getByRole('link', { name: 'Settings', exact: true });
        await expect(settings).toHaveAttribute('aria-current', 'page');
        await rail.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
        await expect(settings).toHaveAttribute('title', 'Settings');
        await settings.click();
        await rail.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
        for (const width of [1280, 360]) {
            await page.setViewportSize({ width, height: 900 });
            for (const theme of ['Light', 'Dark']) {
                await page.getByRole('radio', { name: theme, exact: true }).check();
                await expect(page.locator('html')).toHaveAttribute('data-theme', theme.toLowerCase());
                await expect(page.locator('[data-theme-preference]')).toHaveAttribute('data-theme-preference', theme.toLowerCase());
                assert.equal(await page.evaluate(() => localStorage.getItem('thesishs-theme')), theme.toLowerCase());
                await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
                await inspect(page);
                await page.screenshot({ path: join(tmpdir(), `phase974-role${user.role_id}-${width}-${theme}.png`), fullPage: true });
            }
        }
        await page.getByRole('button', { name: 'Change theme', exact: true }).click();
        await page.getByRole('menuitemradio', { name: 'Light', exact: true }).click();
        await expect(page.getByRole('radio', { name: 'Light', exact: true })).toBeChecked();
        await page.getByRole('radio', { name: 'System', exact: true }).check();
        await page.emulateMedia({ colorScheme: 'dark' });
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        await page.reload();
        await expect(page.getByRole('radio', { name: 'System', exact: true })).toBeChecked();
        const radio = page.getByRole('radio', { name: 'System', exact: true });
        await radio.focus();
        await page.keyboard.press('ArrowLeft');
        await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
        assert.ok(await page.locator('input:focus').evaluate(el => el.matches(':focus-visible') && parseFloat(getComputedStyle(el).outlineWidth) >= 3));
        const menu = rail.getByRole('button', { name: 'Open navigation menu' });
        const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true });
        await menu.click();
        await expect(drawer).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(menu).toBeFocused();
        await menu.click();
        await drawer.getByRole('link', { name: 'Browse Repository', exact: true }).click();
        await expect(drawer).not.toBeVisible();
        await menu.click();
        await drawer.getByRole('link', { name: 'Settings', exact: true }).click();
        await expect(drawer).not.toBeVisible();
        await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeChecked();
        let requests = 0;
        page.on('request', request => { if (request.method() === 'POST') requests++; });
        await page.route('**/dashboard/settings', async route => {
            if (route.request().method() === 'POST') await new Promise(resolve => setTimeout(resolve, 350));
            await route.continue();
        });
        await page.getByRole('region', { name: 'Sign Out', exact: true }).getByRole('button', { name: 'Logout', exact: true }).click();
        await expect(page.getByRole('region', { name: 'Sign Out', exact: true }).getByRole('button', { name: 'Logging out...' })).toBeDisabled();
        await expect(page).toHaveURL(`${origin}/login`);
        assert.equal(requests, 1, 'One secure logout operation');
        assert.ok(!(await context.cookies()).some(cookie => cookie.name === 'thesishs_session'));
        await page.goto(`${origin}/dashboard/settings`);
        await expect(page).toHaveURL(`${origin}/login`);
        await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS Settings four roles, anonymous denial, validated email, theme synchronization/persistence/system/keyboard, navigation, single secure logout, contrast and 360/1280 light/dark screenshots');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    await browser?.close(); server?.kill();
    setTimeout(() => process.exit(process.exitCode || 0), 150).unref();
});
