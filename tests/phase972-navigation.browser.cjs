/* eslint-disable @typescript-eslint/no-require-imports */
// Existing local synthetic accounts only; no workflow mutations or fixture creation.
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
const { dashboardLinks, dashboardDestination } = require('../lib/constants/dashboard-navigation.ts');
const { chromium, expect } = require('@playwright/test');
const origin = 'http://127.0.0.1:3026';
let browser, server;
const errors = [];

async function contextFor(user, role = user.role_id) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies([{ name: 'thesishs_session', value: await createToken({ userId: user.id, roleId: role, email: 'navigation-test@example.invalid' }), url: origin, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 500) errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`); });
    return { context, page };
}

async function noOverflow(page) {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
    const sidebar = await page.getByRole('complementary', { name: 'Workspace sidebar' }).boundingBox();
    const main = await page.locator('main').boundingBox();
    assert.ok(main.x >= sidebar.x + sidebar.width, 'Page clears sidebar');
}

function contrast(a, b) {
    const luminance = color => {
        const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
            value /= 255;
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (values[0] + 0.05) / (values[1] + 0.05);
}

async function main() {
    const actors = await db.execute(sql`SELECT id, role_id, is_active FROM users
        WHERE (email ILIKE '%test%' OR email ILIKE '%phase%') ORDER BY id`);
    const users = [1, 2, 3].map(role => actors.find(actor => actor.role_id === role && actor.is_active));
    assert.ok(users.every(Boolean), 'Existing synthetic Admin/Adviser/Student required');
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3026'], { windowsHide: true, stdio: 'ignore' });
    let ready = false;
    for (let i = 0; i < 100; i++) {
        if (server.exitCode !== null) throw new Error('Temporary server exited');
        try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* startup */ }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready);
    browser = await chromium.launch();
    const anonymous = await browser.newPage();
    await anonymous.goto(`${origin}/dashboard`);
    await expect(anonymous).toHaveURL(`${origin}/login`);
    assert.equal((await (await anonymous.request.get(`${origin}/manifest.webmanifest`)).json()).start_url, '/dashboard');
    await anonymous.close();

    for (const user of users) {
        const { context, page } = await contextFor(user);
        const destination = dashboardDestination(user.role_id);
        await page.goto(`${origin}/dashboard`);
        await expect(page).toHaveURL(`${origin}${destination}`);
        const rail = page.getByRole('complementary', { name: 'Workspace sidebar' });
        const links = dashboardLinks(user.role_id);
        assert.deepEqual(await rail.locator('nav a').evaluateAll(elements => elements.map(el => el.getAttribute('href'))), links.map(link => link.href));
        await expect(rail.locator('[aria-current="page"]')).toHaveCount(1);
        const colors = await rail.locator('a, button').evaluateAll(elements => elements.map(el => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor]));
        assert.ok(colors.every(([fg, bg]) => contrast(fg, bg) >= 4.5), 'Navigation contrast');
        await noOverflow(page);
        await page.screenshot({ path: join(tmpdir(), `phase972-role${user.role_id}-1280.png`), fullPage: true });
        await rail.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
        await expect(rail.getByRole('button', { name: 'Expand sidebar', exact: true })).toHaveAttribute('aria-expanded', 'false');
        assert.equal(Math.round((await rail.boundingBox()).width), 64);
        await expect(rail.locator('nav a span').first()).not.toBeVisible();
        await page.screenshot({ path: join(tmpdir(), `phase972-role${user.role_id}-collapsed1280.png`), fullPage: true });
        for (const link of links) {
            const icon = rail.getByRole('link', { name: link.label, exact: true });
            await expect(icon).toHaveAttribute('title', link.label);
            const bounds = await icon.boundingBox();
            assert.ok(bounds.width >= 44 && bounds.height >= 44);
            await icon.click();
            await expect(page).toHaveURL(`${origin}${link.href}`);
            await expect(rail.getByRole('link', { name: link.label, exact: true })).toHaveAttribute('aria-current', 'page');
            assert.equal(Math.round((await rail.boundingBox()).width), 64, 'Collapsed state survives navigation');
            await noOverflow(page);
        }
        await rail.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
        assert.equal(Math.round((await rail.boundingBox()).width), 240);
        await page.goto(`${origin}/dashboard/${user.role_id === 1 ? 'student' : 'admin'}`);
        await expect(page).toHaveURL(`${origin}${destination}`);

        await page.setViewportSize({ width: 360, height: 800 });
        await noOverflow(page);
        assert.equal(Math.round((await rail.boundingBox()).width), 64);
        const menu = rail.getByRole('button', { name: 'Open navigation menu' });
        const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true });
        await menu.focus();
        await page.keyboard.press('Enter');
        await expect(drawer).toBeVisible();
        await expect(menu).toHaveAttribute('aria-expanded', 'true');
        await expect(drawer.getByRole('button', { name: 'Close navigation menu' })).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(drawer.getByRole('button', { name: 'Logout', exact: true })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(drawer.getByRole('button', { name: 'Close navigation menu' })).toBeFocused();
        for (let i = 0; i < links.length + 4; i++) {
            await page.keyboard.press('Tab');
            assert.ok(await drawer.evaluate(el => el.contains(document.activeElement)), 'Focus stays in modal drawer');
        }
        assert.ok(await page.locator(':focus').evaluate(el => el.matches(':focus-visible') && parseFloat(getComputedStyle(el).outlineWidth) >= 3));
        await page.keyboard.press('Escape');
        await expect(drawer).not.toBeVisible();
        await expect(menu).toBeFocused();
        await menu.click();
        await drawer.getByRole('button', { name: 'Close navigation menu' }).click();
        await expect(drawer).not.toBeVisible();
        await expect(menu).toBeFocused();
        await menu.click();
        await page.mouse.click(330, 400);
        await expect(drawer).not.toBeVisible();
        await expect(menu).toBeFocused();
        await menu.click();
        await page.screenshot({ path: join(tmpdir(), `phase972-role${user.role_id}-drawer360.png`), fullPage: true });
        await drawer.getByRole('link', { name: 'Browse Repository', exact: true }).click();
        await expect(page).toHaveURL(`${origin}/dashboard/repository`);
        await expect(drawer).not.toBeVisible();
        assert.ok(await page.locator('#workspace-content').evaluate(el => el.contains(document.activeElement)), 'Navigation focus moves into content');
        assert.equal(await page.evaluate(() => document.body.style.overflow), '');
        await noOverflow(page);
        const paper = page.locator('.repository-results h2 a').first();
        if (await paper.count()) {
            await paper.click();
            await expect(rail.getByRole('link', { name: 'Browse Repository', exact: true })).toHaveAttribute('aria-current', 'page');
            await expect(rail.getByRole('link', { name: 'Dashboard', exact: true })).not.toHaveAttribute('aria-current', 'page');
            await noOverflow(page);
        }
        await rail.getByRole('link', { name: 'Dashboard', exact: true }).click();
        await expect(page).toHaveURL(`${origin}${destination}`);
        await page.screenshot({ path: join(tmpdir(), `phase972-role${user.role_id}-360.png`), fullPage: true });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await menu.click();
        assert.equal(await drawer.getByRole('link', { name: 'Dashboard', exact: true }).evaluate(el => getComputedStyle(el).transitionDuration), '0s');
        await page.setViewportSize({ width: 360, height: 480 });
        await drawer.getByRole('link', { name: links.at(-1).label, exact: true }).scrollIntoViewIfNeeded();
        await expect(drawer.getByRole('button', { name: 'Logout', exact: true })).toBeInViewport();
        await page.setViewportSize({ width: 1280, height: 900 });
        await expect(drawer).not.toBeVisible();
        await rail.getByRole('button', { name: 'Logout', exact: true }).click();
        await expect(page).toHaveURL(`${origin}/login`);
        assert.ok(!(await context.cookies()).some(cookie => cookie.name === 'thesishs_session'));
        await page.goto(`${origin}/dashboard`);
        await expect(page).toHaveURL(`${origin}/login`);
        await context.close();
        console.log(`PASS role ${user.role_id}: desktop/mobile navigation, destinations, focus, dismissal, overflow and logout`);
    }

    const stale = await contextFor(users[2], 1);
    await stale.page.goto(`${origin}/dashboard`);
    await expect(stale.page.getByRole('heading', { name: 'Workspace unavailable' })).toBeVisible();
    await expect(stale.page.locator('nav')).toHaveCount(0);
    await stale.page.getByRole('button', { name: 'Logout', exact: true }).click();
    await expect(stale.page).toHaveURL(`${origin}/login`);
    await stale.context.close();
    const inactive = actors.find(actor => !actor.is_active);
    if (inactive) {
        const denied = await contextFor(inactive);
        await denied.page.goto(`${origin}/dashboard`);
        await expect(denied.page.getByRole('heading', { name: 'Workspace unavailable' })).toBeVisible();
        await denied.context.close();
    }
    const panel = actors.find(actor => actor.role_id === 4 && actor.is_active);
    if (panel) {
        const accepted = await contextFor(panel);
        await accepted.page.goto(`${origin}/dashboard`);
        await expect(accepted.page).toHaveURL(`${origin}/dashboard`);
        await expect(accepted.page.getByRole('heading', { name: 'Panel Workspace' })).toBeVisible();
        await accepted.page.goto(`${origin}/dashboard/panel`);
        await expect(accepted.page.getByRole('heading', { name: 'Panel Area' })).toBeVisible();
        await accepted.page.goto(`${origin}/dashboard/admin`);
        await expect(accepted.page).toHaveURL(`${origin}/dashboard`);
        await accepted.context.close();
    }
    assert.deepEqual(errors, []);
    console.log(`PASS Phase 9.7.2 Chromium navigation 360/1280, three roles, auth/role denial, modal focus/dismissal, logout, no overflow; Panel browser=${Boolean(panel)}, inactive browser=${Boolean(inactive)} (unit denial coverage always run separately)`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    await browser?.close();
    server?.kill();
    setTimeout(() => process.exit(process.exitCode || 0), 300);
});
