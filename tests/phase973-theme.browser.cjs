/* eslint-disable @typescript-eslint/no-require-imports */
// Read-only existing local synthetic accounts; no data or workflow mutations.
const assert = require('node:assert/strict');
const Module = require('node:module');
const { spawn } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { readFileSync } = require('node:fs');
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
const origin = process.env.PHASE973_ORIGIN || 'http://127.0.0.1:3027';
let browser, server;
const errors = [];
const css = readFileSync(join(__dirname, '../app/globals.css'), 'utf8');
const tokens = selector => Object.fromEntries([...css.match(selector)[1].matchAll(/(--[\w-]+):\s*(#[\da-f]+);/g)].map(match => [match[1], match[2]]));
const light = tokens(/:root\s*\{([^}]+)\}/);
const palettes = { light, dark: { ...light, ...tokens(/:root\[data-theme="dark"\]\s*\{([^}]+)\}/) } };
const rgb = hex => `rgb(${[1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)).join(', ')})`;
const selected = page => page.locator('[data-theme-preference]');

async function renderedPalette(page, effective) {
    await expect(page.locator('html')).toHaveAttribute('data-theme', effective);
    await expect.poll(() => page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(rgb(palettes[effective]['--background']));
    assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).color), rgb(palettes[effective]['--foreground']));
    for (const selector of ['figure', '.auth-page', '.dashboard-panel', 'aside[aria-label="Workspace sidebar"]']) {
        const surface = page.locator(selector).first();
        if (await surface.count()) await expect.poll(() => surface.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(rgb(palettes[effective]['--surface']));
    }
    const input = page.locator('input:not([type="checkbox"]):not([type="radio"]), textarea').first();
    if (await input.count()) {
        assert.equal(await input.evaluate(el => getComputedStyle(el).color), rgb(palettes[effective]['--foreground']));
        assert.equal(await input.evaluate(el => getComputedStyle(el).borderTopColor), rgb(palettes[effective]['--input-border']));
    }
}

async function appearance(page, preference, effective = preference) {
    const control = page.getByRole('button', { name: 'Change theme', exact: true });
    await expect(control).toBeEnabled();
    await control.click();
    const option = page.getByRole('menuitemradio', { name: preference, exact: false });
    await option.click();
    await expect(selected(page)).toHaveAttribute('data-theme-preference', preference);
    await expect(page.getByRole('menu', { name: 'Theme', exact: true })).not.toBeVisible();
    await expect(control).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute('data-theme', effective);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), effective);
    // Existing navigation hover transitions also run when their tokens change.
    await page.evaluate(() => Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))));
    await renderedPalette(page, effective);
}

async function inspect(page, label, screenshot = false) {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: no overflow`);
    const failures = await page.evaluate(() => {
        function luminance(color) {
            const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => {
                v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            });
            return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        }
        return [...document.querySelectorAll('h1,h2,h3,p,a,button,label,select,input,textarea,dt,dd,th,td,small,figcaption,summary')].flatMap(el => {
            if (!el.getClientRects().length || el.closest('[aria-hidden="true"]') || el.disabled || !el.textContent.trim() && !el.matches('input,textarea')) return [];
            const style = getComputedStyle(el);
            let bg = style.backgroundColor, ancestor = el;
            while (bg === 'rgba(0, 0, 0, 0)' && ancestor.parentElement) { ancestor = ancestor.parentElement; bg = getComputedStyle(ancestor).backgroundColor; }
            if (bg === 'rgba(0, 0, 0, 0)') bg = getComputedStyle(document.body).backgroundColor;
            const values = [luminance(style.color), luminance(bg)].sort((a, b) => b - a);
            const ratio = (values[0] + 0.05) / (values[1] + 0.05);
            const large = parseFloat(style.fontSize) >= 24 || parseFloat(style.fontSize) >= 18.66 && parseFloat(style.fontWeight) >= 700;
            return ratio + 0.01 < (large ? 3 : 4.5) ? [`${el.tagName} ${el.textContent.trim().slice(0, 45)}: ${ratio.toFixed(2)} (${style.color} on ${bg})`] : [];
        });
    });
    assert.deepEqual(failures, [], `${label}: text contrast`);
    const control = page.getByRole('button', { name: 'Change theme', exact: true });
    await expect(control).toHaveCount(1);
    await expect(page.getByText('Appearance', { exact: true })).toHaveCount(0);
    await expect(page.locator('[data-theme-preference] select')).toHaveCount(0);
    const bounds = await control.boundingBox();
    assert.equal(bounds.height, 44);
    assert.equal(bounds.width, 44);
    const card = page.locator('.auth-page');
    if (await card.count()) {
        assert.ok(await control.evaluate(el => !el.closest('.auth-page') && !el.closest('form')));
        const cardBounds = await card.boundingBox();
        assert.ok(bounds.y + bounds.height <= cardBounds.y, 'Theme control above auth card without overlap');
        assert.ok(bounds.x > page.viewportSize().width / 2, 'Auth theme control in top-right area');
    }
    await control.focus();
    // Tab away and back ensures the native control uses keyboard focus styling.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    assert.ok(await control.evaluate(el => el.matches(':focus-visible') && parseFloat(getComputedStyle(el).outlineWidth) >= 3));
    if (screenshot) await page.screenshot({ path: join(tmpdir(), `phase973-corrected-${label}.png`), fullPage: true });
    await control.click();
    const menu = page.getByRole('menu', { name: 'Theme', exact: true });
    const menuBounds = await menu.boundingBox();
    assert.ok(menuBounds.x >= 0 && menuBounds.x + menuBounds.width <= page.viewportSize().width, 'Popover inside viewport');
    await expect(menu.getByRole('menuitemradio', { checked: true })).toHaveCount(1);
    if (screenshot && /^(landing|login|role[1-4])-/.test(label)) await page.screenshot({ path: join(tmpdir(), `phase973-corrected-${label}-popover.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
    await expect(control).toBeFocused();
}

async function main() {
    if (!process.env.PHASE973_ORIGIN) server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3027'], { windowsHide: true, stdio: 'ignore' });
    let ready = false;
    for (let i = 0; i < 100; i++) {
        if (server && server.exitCode !== null) throw new Error('Temporary server exited');
        try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* startup */ }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready);
    browser = await chromium.launch({ executablePath: process.env.PHASE973_BROWSER_EXECUTABLE });
    const context = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1280, height: 900 } });
    context.on('page', page => {
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        page.on('response', response => { if (response.status() >= 500) errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`); });
    });
    const page = await context.newPage();
    await page.goto(origin);
    await expect(selected(page)).toHaveAttribute('data-theme-preference', 'system');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await renderedPalette(page, 'dark');
    assert.equal(await page.evaluate(() => localStorage.length), 0, 'Default does not write storage');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await renderedPalette(page, 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await renderedPalette(page, 'dark');
    await appearance(page, 'light');
    await page.emulateMedia({ colorScheme: 'light' });
    await appearance(page, 'dark');
    await page.reload();
    await expect(selected(page)).toHaveAttribute('data-theme-preference', 'dark');
    await renderedPalette(page, 'dark');
    assert.equal(await page.evaluate(() => localStorage.getItem('thesishs-theme')), 'dark');

    for (const width of [360, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of ['/', '/login', '/register']) {
            await page.goto(`${origin}${path}`);
            for (const theme of ['light', 'dark']) {
                await appearance(page, theme);
                await inspect(page, `${path === '/' ? 'landing' : path.slice(1)}-${theme}-${width}`, true);
            }
        }
    }
    await page.goto(`${origin}/login`);
    await appearance(page, 'system', 'light');
    const trigger = page.getByRole('button', { name: 'Change theme', exact: true });
    await trigger.focus();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('menuitemradio', { name: 'System', exact: true })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByRole('menuitemradio', { name: 'Light', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitemradio', { name: 'Dark', exact: true })).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByRole('menuitemradio', { name: 'System', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(selected(page)).toHaveAttribute('data-theme-preference', 'light');
    await expect(trigger).toBeFocused();
    await renderedPalette(page, 'light');
    await trigger.click();
    await page.locator('h1').click();
    await expect(page.getByRole('menu')).not.toBeVisible();
    await trigger.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('menu')).not.toBeVisible();

    // A second tab receives preference changes; no competing selector state.
    const second = await context.newPage();
    await second.goto(origin);
    await appearance(page, 'dark');
    await expect(selected(second)).toHaveAttribute('data-theme-preference', 'dark');
    await renderedPalette(second, 'dark');
    await second.close();

    await page.evaluate(() => localStorage.setItem('thesishs-theme', 'invalid'));
    await page.reload();
    await expect(selected(page)).toHaveAttribute('data-theme-preference', 'system');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    // Pause all React scripts: the initial root attribute and palette must already be correct.
    const firstPaint = await browser.newContext({ colorScheme: 'dark' });
    await firstPaint.addInitScript(() => localStorage.setItem('thesishs-theme', 'light'));
    await firstPaint.route('**/_next/**/*.js', route => route.abort());
    const early = await firstPaint.newPage();
    await early.goto(origin, { waitUntil: 'domcontentloaded' });
    await expect(early.locator('html')).toHaveAttribute('data-theme', 'light');
    assert.equal(await early.evaluate(() => getComputedStyle(document.body).backgroundColor), rgb(light['--background']));
    await firstPaint.close();

    const blocked = await browser.newContext({ colorScheme: 'dark' });
    await blocked.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
    const noStorage = await blocked.newPage();
    noStorage.on('pageerror', error => errors.push(error.message));
    await noStorage.goto(origin);
    await expect(noStorage.locator('html')).toHaveAttribute('data-theme', 'dark');
    await appearance(noStorage, 'light');
    await noStorage.getByRole('link', { name: 'Log In', exact: true }).first().click();
    await expect(noStorage).toHaveURL(`${origin}/login`);
    await expect(noStorage.getByRole('heading', { name: 'Login', exact: true })).toBeVisible();
    await expect(selected(noStorage)).toHaveAttribute('data-theme-preference', 'light');
    await appearance(noStorage, 'system', 'dark');
    await noStorage.emulateMedia({ colorScheme: 'light' });
    await expect(noStorage.locator('html')).toHaveAttribute('data-theme', 'light');
    await blocked.close();

    await page.goto(`${origin}/dashboard`);
    await expect(page).toHaveURL(`${origin}/login`);
    const actors = await db.execute(sql`SELECT id, role_id FROM users WHERE is_active = true AND (email ILIKE '%test%' OR email ILIKE '%phase%') ORDER BY id`);
    for (const role of [1, 2, 3, 4]) {
        const user = actors.find(actor => actor.role_id === role);
        if (!user && role === 4) { console.log('LIMIT Panel browser check: no existing synthetic Panel account'); continue; }
        assert.ok(user, `Existing synthetic role ${role} required`);
        await context.addCookies([{ name: 'thesishs_session', value: await createToken({ userId: user.id, roleId: role, email: 'theme-test@example.invalid' }), url: origin, httpOnly: true, sameSite: 'Lax' }]);
        await page.goto(`${origin}/dashboard`);
        const destination = role === 4 ? '/dashboard' : `/dashboard/${({ 1: 'admin', 2: 'adviser', 3: 'student' })[role]}`;
        await expect(page).toHaveURL(`${origin}${destination}`);
        for (const width of [360, 1280]) {
            await page.setViewportSize({ width, height: 900 });
            for (const theme of ['light', 'dark']) {
                await appearance(page, theme);
                await inspect(page, `role${role}-${theme}-${width}`, true);
            }
        }
        await appearance(page, 'dark');
        const paths = role === 1 ? ['/dashboard/admin/users', '/dashboard/admin/groups', '/dashboard/admin/repository', '/dashboard/admin/reports', '/dashboard/admin/notifications']
            : role === 2 ? ['/dashboard/adviser/groups', '/dashboard/adviser/submissions', '/dashboard/adviser/notifications']
            : role === 3 ? ['/dashboard/student/submissions', '/dashboard/student/notifications', '/dashboard/guide'] : [];
        for (const path of [...paths, '/dashboard/repository']) {
            await page.goto(`${origin}${path}`);
            await expect(selected(page)).toHaveAttribute('data-theme-preference', 'dark');
            await renderedPalette(page, 'dark');
            await inspect(page, `role${role}-${path.split('/').at(-1)}-dark-1280`, true);
            if (path === '/dashboard/admin/users') {
                const eligibility = page.getByRole('button', { name: 'AI eligibility', exact: true }).first();
                if (await eligibility.count()) {
                    await eligibility.click();
                    const dialog = page.locator('dialog[open]');
                    await expect(dialog).toBeVisible();
                    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeEnabled();
                    assert.equal(await dialog.evaluate(el => getComputedStyle(el).backgroundColor), rgb(palettes.dark['--surface']));
                    await page.screenshot({ path: join(tmpdir(), 'phase973-admin-dialog-dark-1280.png'), fullPage: true });
                    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
                }
            }
        }
        const paper = page.locator('.repository-results h2 a').first();
        if (await paper.count()) { await paper.click(); await inspect(page, `role${role}-repository-detail-dark-1280`, true); }
        await page.goto(`${origin}${destination}`);
        const rail = page.getByRole('complementary', { name: 'Workspace sidebar' });
        await rail.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
        assert.equal(Math.round((await rail.boundingBox()).width), 64);
        await appearance(page, 'light');
        await rail.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
        await page.setViewportSize({ width: 360, height: 800 });
        await appearance(page, 'dark');
        await rail.getByRole('button', { name: 'Open navigation menu' }).click();
        await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).toBeVisible();
        await page.screenshot({ path: join(tmpdir(), `phase973-role${role}-drawer-dark-360.png`), fullPage: true });
        await page.keyboard.press('Escape');
        await expect(rail.getByRole('button', { name: 'Open navigation menu' })).toBeFocused();
        // The development-only Next.js indicator can cover the 64px rail footer.
        // Exercise the real logout with keyboard activation rather than forcing a click.
        await rail.getByRole('button', { name: 'Logout', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(`${origin}/login`);
        await expect(selected(page)).toHaveAttribute('data-theme-preference', 'dark');
        assert.ok(!(await context.cookies()).some(cookie => cookie.name === 'thesishs_session'));
        console.log(`PASS role ${role}: shared appearance, route surfaces, mobile/desktop, drawer and logout`);
    }
    assert.deepEqual(errors, [], 'No hydration, browser, console or HTTP 5xx errors');
    await context.close();
    console.log('PASS Phase 9.7.3 behavior, public/auth rendering, contrast, focus, persistence, blocked storage and pre-hydration palette');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    await browser?.close();
    server?.kill();
    const client = require('../lib/db.ts').client;
    if (client?.end) await client.end();
    process.exit(process.exitCode || 0);
});
