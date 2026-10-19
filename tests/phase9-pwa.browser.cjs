/* eslint-disable @typescript-eslint/no-require-imports */
// Existing synthetic accounts, read-only database lookup, cookie-only logout.
// Standalone media emulation is not an operating-system installation.
const assert = require('node:assert/strict');
const Module = require('node:module');
const { runBrowserAcceptance } = require('./helpers/phase96-lifecycle.cjs');
const { navigation } = require('./helpers/phase96-navigation.cjs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
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
const origin = 'http://127.0.0.1:3023';
let browser;
const captureScreenshots = !process.argv.includes('--no-screenshots');

async function main(lifecycle) {
    const actors = await db.execute(sql`SELECT id, role_id FROM users WHERE is_active=true
        AND (email ILIKE '%test%' OR email ILIKE '%phase%') ORDER BY id`);
    const users = [1, 2, 3].map(role => actors.find(actor => actor.role_id === role));
    assert.ok(users.every(Boolean), 'Existing active synthetic Admin/Adviser/Student accounts required');
    await lifecycle.startServer(3023);
    browser = await lifecycle.launchBrowser(chromium);
    const errors = [];
    for (const width of [360, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        await context.route('**/*', route => {
            if (new URL(route.request().url()).origin !== origin) {
                errors.push('Unexpected external request');
                return route.abort();
            }
            return route.continue();
        });
        const page = await context.newPage();
        page.on('pageerror', () => errors.push('Page error'));
        page.on('console', message => { if (message.type() === 'error') errors.push('Console error'); });
        page.on('response', response => { if (response.status() >= 500) errors.push('HTTP 5xx'); });
        await page.goto(origin + '/dashboard');
        await expect(page).toHaveURL(origin + '/login');
        await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
        const manifestPath = await page.locator('link[rel="manifest"]').getAttribute('href');
        assert.equal(manifestPath, '/manifest.webmanifest');
        const response = await context.request.get(origin + manifestPath);
        assert.equal(response.status(), 200);
        assert.match(response.headers()['content-type'], /application\/manifest\+json/);
        const manifest = await response.json();
        assert.equal(manifest.name, 'ThesiSHS AI');
        assert.equal(manifest.short_name, 'ThesiSHS');
        assert.equal(manifest.description, 'Senior High School research management system.');
        assert.equal(manifest.start_url, '/dashboard');
        assert.equal(manifest.scope, '/');
        assert.equal(manifest.display, 'standalone');
        assert.equal(manifest.theme_color, '#f6f8fb');
        assert.equal(manifest.background_color, '#f6f8fb');
        assert.equal(manifest.icons.length, 2);
        for (const [index, size] of [192, 512].entries()) {
            const icon = manifest.icons[index];
            assert.equal(icon.sizes, `${size}x${size}`);
            assert.equal(icon.type, 'image/png');
            const image = await context.request.get(origin + icon.src);
            assert.equal(image.status(), 200);
            assert.match(image.headers()['content-type'], /image\/png/);
            const bytes = await image.body();
            assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
            assert.equal(bytes.readUInt32BE(16), size);
            assert.equal(bytes.readUInt32BE(20), size);
        }
        await expect(page.locator('meta[name="application-name"]')).toHaveAttribute('content', manifest.name);
        await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', manifest.theme_color);
        await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'light dark');
        await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
        await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content', 'default');
        const applePath = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
        const apple = await context.request.get(origin + applePath);
        assert.equal(apple.status(), 200);
        assert.match(apple.headers()['content-type'], /image\/png/);
        const appleBytes = await apple.body();
        assert.equal(appleBytes.readUInt32BE(16), 180);
        assert.equal(appleBytes.readUInt32BE(20), 180);
        assert.equal((await context.request.get(origin + '/favicon.ico')).status(), 200);
        const cdp = await context.newCDPSession(page);
        const parsed = await cdp.send('Page.getAppManifest');
        assert.equal(parsed.errors.length, 0, 'Chromium manifest parser');
        assert.equal(new URL(parsed.url).pathname, manifestPath);

        // Exercise the existing launch path in browser mode and emulated standalone media.
        for (const standalone of [false, true]) {
            await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'display-mode', value: standalone ? 'standalone' : 'browser' }] });
            const standaloneMedia = await page.evaluate(() => matchMedia('(display-mode: standalone)').matches);
            if (standalone && !standaloneMedia) {
                console.log(`LIMIT: Chromium does not emulate standalone display-mode at ${width}px; installed launch remains unverified.`);
                continue;
            }
            assert.equal(standaloneMedia, standalone);
            for (const actor of users) {
                await context.addCookies([{ name: 'thesishs_session', value: await createToken({ userId: actor.id, roleId: actor.role_id, email: 'phase95-synthetic@example.invalid' }), url: origin, httpOnly: true, sameSite: 'Lax' }]);
                await page.goto(origin + manifest.start_url);
                const role = ['Admin', 'Adviser', 'Student'][actor.role_id - 1];
                await expect(page).toHaveURL(origin + '/dashboard/' + role.toLowerCase());
                await expect(page.getByRole('heading', { level: 1 })).toHaveText(role + ' Dashboard');
                if (actor.role_id === 3) {
                    const summary = page.locator('.installation-help summary');
                    // Reach the native disclosure through the actual keyboard tab order.
                    const tabStops = await page.locator('a[href],button,input,select,textarea,summary,[tabindex]').evaluateAll(nodes => nodes.filter(node => node.tabIndex >= 0 && node.getClientRects().length).length);
                    for (let tab = 0; tab <= tabStops; tab++) {
                        await page.keyboard.press('Tab');
                        if (await summary.evaluate(element => element === document.activeElement)) break;
                    }
                    assert.ok(await summary.evaluate(element => element === document.activeElement));
                    assert.ok(await summary.evaluate(element => element.matches(':focus-visible') && parseFloat(getComputedStyle(element).outlineWidth) >= 3));
                    await page.keyboard.press('Enter');
                    await expect(page.locator('.installation-help details')).toHaveAttribute('open', '');
                    for (const platform of ['Android Chrome:', 'iPhone Safari:', 'Desktop Chrome / Edge:']) {
                        await expect(page.getByText(platform, { exact: true })).toBeVisible();
                    }
                    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
                    await expect(page.getByText(/An internet connection is required for research work/)).toBeVisible();
                    if (captureScreenshots) await page.screenshot({ path: join(tmpdir(), `phase95-help-${width}-${standalone ? 'standalone' : 'browser'}.png`), fullPage: true });
                    await page.keyboard.press('Space');
                    await expect(page.locator('.installation-help details')).not.toHaveAttribute('open', '');
                    await page.goto(origin + '/dashboard/admin/reports');
                    await expect(page).toHaveURL(origin + '/dashboard/student');
                }
                await (await navigation(page)).getByRole('link', { name: 'Settings', exact: true }).click();
                for (const [theme, effective] of [['Light', 'light'], ['Dark', 'dark'], ['System', 'dark']]) {
                    if (theme === 'System') await page.emulateMedia({ colorScheme: 'dark' });
                    await page.getByRole('radio', { name: theme, exact: true }).check();
                    await expect(page.locator('html')).toHaveAttribute('data-theme', effective);
                }
                await page.emulateMedia({ colorScheme: 'light' });
                await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
                await (await navigation(page)).getByRole('link', { name: 'Dashboard', exact: true }).click();
                await expect(page).toHaveURL(origin + '/dashboard/' + role.toLowerCase());
                await (await navigation(page)).getByRole('button', { name: 'Logout', exact: true }).click();
                await expect(page).toHaveURL(origin + '/login');
                assert.ok(!(await context.cookies()).some(cookie => cookie.name === 'thesishs_session'));
                await page.goto(origin + manifest.start_url);
                await expect(page).toHaveURL(origin + '/login');
            }
        }
        const storage = await page.evaluate(async () => ({
            workers: (await navigator.serviceWorker.getRegistrations()).length,
            caches: await caches.keys(),
            local: Object.keys(localStorage),
            session: sessionStorage.length,
            databases: (await indexedDB.databases()).length,
        }));
        assert.deepEqual(storage, { workers: 0, caches: [], local: ['thesishs-theme'], session: 0, databases: 0 });
        await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS: manifest/icons/current metadata, Chromium parser, 360/1280 keyboard guidance/online requirement, current role launch/navigation/logout, Settings Light/Dark/System, anonymous/role denial, no workers/caches/research stores; only the theme preference persisted.');
    console.log('LIMIT: standalone tested only if media emulation is supported, never as OS installation. No real Android/iPhone/Edge testing or installed cookie-lifecycle acceptance. No database mutations, storage/provider calls or private document visits.');
}

runBrowserAcceptance(main, { client: db.$client, label: 'Phase 9.6 PWA', timeoutMs: 120000 });
