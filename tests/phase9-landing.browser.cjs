/* eslint-disable @typescript-eslint/no-require-imports */
// Existing synthetic accounts only. Read-only lookup and signed browser sessions.
const assert = require('node:assert/strict');
const Module = require('node:module');
const { spawn, execFileSync } = require('node:child_process');
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
const origin = 'http://127.0.0.1:3024';
let browser, server;
const approvedCss = execFileSync('git', ['show', 'f3b6dd5:app/page.module.css'], { encoding: 'utf8', windowsHide: true });
function approved(selector, property) {
    const start = approvedCss.indexOf(selector + ' {');
    assert.ok(start >= 0, selector);
    const block = approvedCss.slice(start + selector.length + 2, approvedCss.indexOf('}', start));
    return block.match(new RegExp('(?:^|;)\\s*' + property + ':\\s*([^;]+)'))[1].trim();
}
const rgb = hex => `rgb(${[1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)).join(', ')})`;

function contrast(a, b) {
    const luminance = value => {
        const rgb = value.match(/[\d.]+/g).slice(0, 3).map(Number).map(c => {
            c /= 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (values[0] + 0.05) / (values[1] + 0.05);
}

async function main() {
    const actors = await db.execute(sql`SELECT id, role_id FROM users WHERE is_active=true
        AND (email ILIKE '%test%' OR email ILIKE '%phase%') ORDER BY id`);
    const users = [1, 2, 3].map(role => actors.find(actor => actor.role_id === role));
    assert.ok(users.every(Boolean), 'Existing synthetic Admin/Adviser/Student required');
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3024'], { windowsHide: true, stdio: 'ignore' });
    let ready = false;
    for (let i = 0; i < 60; i++) {
        if (server.exitCode !== null) throw new Error('Temporary server exited');
        try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* startup */ }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready, 'Production server ready');
    browser = await chromium.launch();
    const errors = [];
    for (const width of [360, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: 'dark' });
        await context.route('**/*', route => {
            if (new URL(route.request().url()).origin !== origin) {
                errors.push('External request');
                return route.abort();
            }
            return route.continue();
        });
        const page = await context.newPage();
        page.on('pageerror', () => errors.push('Page error'));
        page.on('console', message => { if (message.type() === 'error') errors.push('Console error'); });
        page.on('response', response => { if (response.status() >= 500) errors.push('HTTP 5xx'); });
        const response = await page.goto(origin);
        assert.equal(response.status(), 200);
        await expect(page).toHaveURL(origin + '/');
        const publicText = await page.locator('body').innerText();
        const supportPlaceholder = 'support@example.com';
        assert.ok(!publicText.replace(supportPlaceholder, '').includes('@') && !/SPRINT|PHASE|Next\.js|Vercel|—/.test(publicText));
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('From research drafts to approved studies.');
        await expect(page.locator('dt')).toHaveText(['Submit', 'Review', 'Discover']);
        await expect(page.locator('dd')).toHaveText([
            'Organize research PDFs and preserve submission versions.',
            'Receive adviser feedback and track revisions.',
            'Browse approved and published research.',
        ]);
        assert.equal(await page.locator('header > p svg[aria-hidden="true"]').count(), 1);
        assert.equal(await page.locator('dt svg[aria-hidden="true"]').count(), 3);
        const preview = page.getByRole('figure', { name: 'Illustrative interface preview. Sample content only.' });
        await expect(preview).toBeVisible();
        for (const text of ['Student Workspace', 'Research Overview', 'Submission v2', 'Revision Required', 'Adviser Feedback', 'Review latest comments']) {
            await expect(preview.getByText(text, { exact: true })).toBeVisible();
        }
        assert.equal(await preview.locator('a, button, input, select, textarea, [tabindex]').count(), 0);
        const footer = page.getByRole('contentinfo');
        for (const heading of ['About ThesiSHS AI', 'Quick Links', 'Contact & Support']) {
            await expect(footer.getByRole('heading', { level: 2, name: heading, exact: true })).toBeVisible();
        }
        await expect(footer.getByText('Email: ' + supportPlaceholder, { exact: true })).toBeVisible();
        await expect(footer.getByText('Phone: To be announced', { exact: true })).toBeVisible();
        await expect(footer.getByText('Organization/contact details: To be confirmed', { exact: true })).toBeVisible();
        await expect(footer.getByText('Contact information is provisional and not yet an active support channel.', { exact: true })).toBeVisible();
        assert.equal(await page.locator('a[href^="mailto:"], a[href^="tel:"]').count(), 0);
        const appearance = page.getByRole('button', { name: 'Change theme', exact: true });
        await expect(appearance).toBeEnabled();
        await expect(appearance).toHaveAttribute('title', 'Theme: System');
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
        await appearance.click();
        await page.getByRole('menuitemradio', { name: 'Light', exact: true }).click();
        await expect(appearance).toHaveAttribute('title', 'Theme: Light');
        await expect(page.getByRole('menu')).not.toBeVisible();
        const lightPublicText = await page.locator('body').innerText();
        assert.equal(await page.evaluate(() => localStorage.getItem('thesishs-theme')), 'light');
        assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'light');
        // Approved f3b6dd5 geometry and light colors, not merely theme state.
        const primary = page.locator('header nav a').last();
        const secondary = page.locator('header nav a').first();
        assert.equal(await primary.evaluate(el => getComputedStyle(el).backgroundColor), rgb(approved('.primaryAction', 'background')));
        assert.equal(await primary.evaluate(el => getComputedStyle(el).borderRadius), '8px');
        assert.equal(await secondary.evaluate(el => getComputedStyle(el).color), rgb(approved('.secondaryAction', 'color')));
        assert.equal(await secondary.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
        assert.equal(await preview.evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(255, 255, 255)');
        assert.equal(await preview.evaluate(el => getComputedStyle(el).borderTopColor), rgb(approved('.preview', 'border').split(' ').at(-1)));
        const heading = page.locator('h1');
        assert.equal(await heading.evaluate(el => getComputedStyle(el).color), rgb(approved('.hero h1', 'color')));
        assert.equal(await heading.evaluate(el => getComputedStyle(el).fontWeight), '700');
        const headline = await heading.boundingBox();
        const previewLayout = await preview.boundingBox();
        if (width === 1280) {
            assert.ok(previewLayout.x > headline.x + headline.width, 'Approved split hero');
            assert.equal(await page.locator('main section').first().evaluate(el => getComputedStyle(el).paddingTop), '44px');
        } else assert.ok(previewLayout.y > headline.y + headline.height, 'Approved stacked mobile hero');
        const triggerBounds = await appearance.boundingBox();
        assert.equal(triggerBounds.width, 44);
        assert.equal(triggerBounds.height, 44);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const previewBounds = await preview.boundingBox();
        assert.ok(previewBounds.x >= 0 && previewBounds.x + previewBounds.width <= width);
        assert.ok(await preview.evaluate(el => el.scrollWidth <= el.clientWidth));
        const links = page.getByRole('link');
        const destinations = ['/login', '/register', '/register', '/login', '/', '/login', '/register'];
        assert.deepEqual(await links.evaluateAll(elements => elements.map(el => el.getAttribute('href'))), destinations);
        for (let i = 0; i < destinations.length; i++) {
            if (i === 0) {
                await links.first().focus();
                await page.keyboard.press('Tab');
                await page.keyboard.press('Shift+Tab');
            }
            else await page.keyboard.press('Tab');
            if (i === 2) {
                await expect(appearance).toBeFocused();
                await page.keyboard.press('Tab');
            }
            assert.equal(await links.nth(i).evaluate(el => el === document.activeElement), true);
            assert.ok(await links.nth(i).evaluate(el => el.matches(':focus-visible') && parseFloat(getComputedStyle(el).outlineWidth) >= 3));
            const bounds = await links.nth(i).boundingBox();
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.height >= 44);
        }
        const colors = await page.locator('h1, h2, p, dt, dd, a, button, small, figcaption').evaluateAll(elements => elements.map(el => {
            let parent = el;
            while (getComputedStyle(parent).backgroundColor === 'rgba(0, 0, 0, 0)' && parent.parentElement) parent = parent.parentElement;
            return [getComputedStyle(el).color, getComputedStyle(parent).backgroundColor];
        }));
        for (const [foreground, background] of colors) assert.ok(contrast(foreground, background) >= 4.5, 'AA text contrast');
        await page.screenshot({ path: join(tmpdir(), `phase971-landing-${width}.png`), fullPage: true });
        for (let i = 0; i < destinations.length; i++) {
            if (i === 2) {
                await links.nth(i).focus();
                await page.keyboard.press('Enter');
            } else await links.nth(i).click();
            await expect(page).toHaveURL(origin + destinations[i]);
            const heading = destinations[i] === '/' ? 'From research drafts to approved studies.' : destinations[i] === '/login' ? 'Login' : 'Create a Student account';
            await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
            await page.goto(origin);
        }
        const manifestResponse = await context.request.get(origin + '/manifest.webmanifest');
        assert.equal(manifestResponse.status(), 200);
        assert.equal((await manifestResponse.json()).start_url, '/dashboard');
        await page.goto(origin + '/dashboard');
        await expect(page).toHaveURL(origin + '/login');
        for (const [i, role] of ['Admin', 'Adviser', 'Student'].entries()) {
            const token = await createToken({ userId: users[i].id, roleId: users[i].role_id, email: 'phase9-synthetic@example.invalid' });
            await context.addCookies([{ name: 'thesishs_session', value: token, url: origin, httpOnly: true, sameSite: 'Lax' }]);
            await page.goto(origin);
            assert.equal(await page.locator('body').innerText(), lightPublicText, 'Same public content and preference with a session');
            for (const route of ['/login', '/register', '/dashboard']) {
                await page.goto(origin + route);
                await expect(page).toHaveURL(origin + '/dashboard/' + role.toLowerCase());
                await expect(page.getByRole('heading', { name: role + ' Dashboard', exact: true })).toBeVisible();
            }
            await context.clearCookies();
        }
        await context.close();
        console.log(`PASS ${width}px: f3b6dd5 light palette/hero/buttons/preview, approved content and icons, compact theme menu; seven link click-throughs, Enter navigation, ordered Tab/focus including theme trigger, contrast, 44px targets, no overflow; auth pages, three signed-session role destinations, manifest launch.`);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: no page/console/HTTP 5xx errors or external requests. Screenshots in OS temp. No database/workflow writes; successful password login and registration not retested.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    await browser?.close();
    server?.kill();
    await db.$client.end();
});
