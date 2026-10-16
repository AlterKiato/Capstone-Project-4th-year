/* eslint-disable @typescript-eslint/no-require-imports */
// Read-only production acceptance. Existing local accounts; no fixtures or provider calls.
const assert = require('node:assert/strict');
const Module = require('node:module');
const { spawn } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
require('dotenv/config');
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, 'localhost'); assert.equal(target.pathname, '/thesishs_ai');
const original = Module._load;
Module._load = function(id, ...args) { return id === 'server-only' ? {} : original.call(this, id, ...args); };
const { db } = require('../lib/db.ts');
const { sql } = require('drizzle-orm');
const { createToken } = require('../lib/auth/jwt.ts');
const { chromium, expect } = require('@playwright/test');
const origin = 'http://127.0.0.1:3041';
let browser, server;
const contexts = [], errors = [], providerRequests = [];
async function signedPage(actor, claimedRole = actor?.role_id) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/New_York' }); contexts.push(context);
    await context.route('**/*', route => {
        if (/groq|openai|anthropic/i.test(new URL(route.request().url()).hostname)) { providerRequests.push('provider request'); return route.abort(); }
        return route.continue();
    });
    if (actor) await context.addCookies([{ name: 'thesishs_session', value: await createToken({ userId: actor.id, roleId: claimedRole, email: 'readonly@example.invalid' }), url: origin, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.url().startsWith(origin) && r.status() >= 500) errors.push('HTTP ' + r.status()); });
    return page;
}
async function contrast(page) {
    const failures = await page.locator('main.dashboard-page').evaluate(root => {
        const lum = color => { const v = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return v[0] * .2126 + v[1] * .7152 + v[2] * .0722; };
        return [...root.querySelectorAll('h1,h2,p,dt,dd,a,span,time')].flatMap(el => {
            if (!el.getClientRects().length || !el.textContent.trim()) return [];
            const style = getComputedStyle(el); let parent = el, bg = style.backgroundColor;
            while (bg === 'rgba(0, 0, 0, 0)' && parent.parentElement) { parent = parent.parentElement; bg = getComputedStyle(parent).backgroundColor; }
            const [high, low] = [lum(style.color), lum(bg)].sort((a, b) => b - a);
            const required = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
            return (high + .05) / (low + .05) < required ? [el.textContent.slice(0, 80)] : [];
        });
    }); assert.deepEqual(failures, []);
}
async function main() {
    const actors = await db.execute(sql`SELECT id, role_id FROM users WHERE is_active = true ORDER BY id`);
    const admin = actors.find(a => a.role_id === 1); assert.ok(admin);
    const [counts] = await db.execute(sql`SELECT
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM research_groups) AS groups,
        (SELECT count(*)::int FROM research_papers) AS papers,
        (SELECT count(DISTINCT p.id)::int FROM research_papers p JOIN repositories r ON r.paper_id=p.id JOIN research_groups g ON g.id=p.group_id WHERE r.is_published=true AND p.status='Approved' AND EXISTS(SELECT 1 FROM submissions s WHERE s.paper_id=p.id AND s.status='Approved')) AS published`);
    const activity = await db.execute(sql`SELECT id, action, created_at FROM activity_logs ORDER BY created_at DESC, id DESC LIMIT 5`);
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3041'], { windowsHide: true, stdio: 'ignore' });
    let ready = false;
    for (let i = 0; i < 120; i++) { try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* startup */ } await new Promise(r => setTimeout(r, 250)); }
    assert.ok(ready, 'production server ready'); browser = await chromium.launch();
    const page = await signedPage(admin);
    for (const path of ['/dashboard/admin', '/dashboard/admin/reports']) {
        await page.goto(origin + path);
        const reports = path.endsWith('reports');
        await expect(page.getByRole('heading', { name: reports ? 'Admin Reports' : 'Admin Dashboard', exact: true })).toBeVisible();
        assert.deepEqual(await page.locator('dl[aria-label="System statistics"] > div > dd:first-of-type').allTextContents(), [counts.users, counts.groups, counts.papers, counts.published].map(String));
        const region = page.getByRole('region', { name: reports ? 'Recent System Activity' : 'Recent Activity', exact: true });
        assert.deepEqual(await region.locator('li > span').allTextContents(), activity.map(a => a.action));
        for (const time of await region.locator('time').allTextContents()) assert.ok(/\d{4}.*\d+:\d{2}/.test(time));
        if (reports) {
            for (const name of ['Users by Role', 'Research Papers by Status', 'Admin report assistance']) await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
            await expect(page.getByText('AI interpretation is disabled. Choose a predefined question for verified static guidance.')).toBeVisible();
            await page.getByRole('button', { name: 'Explain report metrics', exact: true }).click();
            await expect(page.getByText(/Loading static guidance/)).toHaveCount(0);
            await expect(page.locator('.assistance-panel > div[role="status"]')).toContainText('AI interpretation is disabled. Verified static guidance is available.');
            const consent = page.getByRole('button', { name: 'AI Terms & Consent', exact: true });
            await consent.click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
        } else {
            await expect(page.locator('dl[aria-label="Additional user statistics"]')).toContainText('Total Students');
            await expect(page.getByRole('navigation', { name: 'Administrative shortcuts' })).toHaveCount(0);
            for (const [name, href] of [['Manage Users', '/dashboard/admin/users'], ['Manage Groups', '/dashboard/admin/groups'], ['Repository Management', '/dashboard/admin/repository'], ['Reports', '/dashboard/admin/reports']]) {
                const link = page.getByRole('navigation', { name: 'Dashboard pages' }).getByRole('link', { name, exact: true });
                await expect(link).toHaveAttribute('href', href); await link.click(); await expect(page).toHaveURL(origin + href); await page.goto(origin + path);
            }
        }
        for (const width of [1280, 360]) for (const theme of ['Light', 'Dark']) {
            await page.setViewportSize({ width, height: 900 });
            await page.getByRole('button', { name: 'Change theme', exact: true }).click();
            await page.getByRole('menuitemradio', { name: theme, exact: true }).click();
            await expect(page.locator('html')).toHaveAttribute('data-theme', theme.toLowerCase());
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            assert.ok(await page.locator('main').evaluate(root => [...root.querySelectorAll('section,li,dl,dt,dd,a,time')].every(el => el.scrollWidth <= el.clientWidth + 1)));
            const ys = await page.locator('dl[aria-label="System statistics"] > div').evaluateAll(nodes => nodes.map(el => el.offsetTop));
            assert.equal(new Set(ys).size, width === 1280 ? 1 : 4);
            if (reports) {
                const typography = await page.locator('dl[aria-label="System statistics"] > div').evaluateAll(cards => cards.map(card => {
                    const title = getComputedStyle(card.querySelector('dt'));
                    const value = getComputedStyle(card.querySelector('dd'));
                    const help = getComputedStyle(card.querySelector('dd:last-of-type'));
                    return [title.fontSize, title.fontWeight, value.fontSize, value.fontWeight, help.fontSize];
                }));
                assert.deepEqual(typography, Array.from({ length: 4 }, () => ['18px', '600', '52px', '700', '16px']));
            }
            if (width === 1280) {
                const cards = page.locator('dl[aria-label="System statistics"] > div');
                for (const selector of ['dt', 'dd:first-of-type', 'dd:last-of-type']) {
                    const tops = await cards.locator(selector).evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().top));
                    assert.ok(Math.max(...tops) - Math.min(...tops) <= 1, `${path}: aligned ${selector} rows`);
                }
                const heights = await cards.evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().height));
                assert.ok(Math.max(...heights) - Math.min(...heights) <= 1, 'equal metric card heights');
                const valueBottoms = await cards.locator('dd:first-of-type').evaluateAll(nodes => nodes.map(el => {
                    const text = document.createRange(); text.selectNodeContents(el); return text.getBoundingClientRect().bottom;
                }));
                assert.ok(Math.max(...valueBottoms) - Math.min(...valueBottoms) <= 1, 'numeric text baselines align');
                const title = cards.last().locator('dt');
                assert.ok(await title.evaluate(el => {
                    const text = document.createRange(); text.selectNodeContents(el);
                    return text.getBoundingClientRect().height > parseFloat(getComputedStyle(el).lineHeight);
                }), 'long title wraps naturally');
            }
            await contrast(page);
            await page.getByRole('button', { name: 'Change theme', exact: true }).focus(); await page.keyboard.press('Tab');
            assert.ok(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none'));
            await page.getByRole('button', { name: 'Notifications', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Notifications', exact: true })).toBeVisible(); await page.keyboard.press('Escape');
            if (width === 360) { await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).toBeVisible(); await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Open navigation menu', exact: true })).toBeFocused(); }
            else { await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click(); await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click(); }
            await expect(page.getByRole('heading', { name: 'Use ThesiSHS AI as an app', exact: true })).toBeVisible();
            await page.getByText('Installation instructions', { exact: true }).click(); await expect(page.getByText('Android Chrome:', { exact: true })).toBeVisible(); await page.getByText('Installation instructions', { exact: true }).click();
            await page.screenshot({ path: join(tmpdir(), `phase977a-${reports ? 'reports' : 'dashboard'}-${width}-${theme}.png`), fullPage: true });
        }
    }
    for (const role of [2, 3]) {
        const actor = actors.find(a => a.role_id === role); assert.ok(actor);
        const denied = await signedPage(actor);
        for (const path of ['/dashboard/admin', '/dashboard/admin/reports']) { await denied.goto(origin + path); await expect(denied).toHaveURL(origin + (role === 2 ? '/dashboard/adviser' : '/dashboard/student')); }
        const stale = await signedPage(actor, 1); await stale.goto(origin + '/dashboard/admin/reports'); assert.equal(await stale.locator('dl').count(), 0);
        await denied.goto(origin + (role === 2 ? '/dashboard/adviser' : '/dashboard/student'));
        await expect(denied.getByRole('heading', { name: role === 2 ? 'Adviser Dashboard' : 'Student Dashboard', exact: true })).toBeVisible();
    }
    const anonymous = await signedPage(null); await anonymous.goto(origin + '/dashboard/admin'); await expect(anonymous).toHaveURL(origin + '/login');
    // Isolated renderer checks cover zero/error/empty UI without changing live data or breaking the database.
    const React = require('react'); global.React = React;
    const css = {}; require.extensions['.css'] = module => { module.exports = css; };
    const { renderToStaticMarkup } = require('react-dom/server');
    const { AdminActivity, AdminMetrics } = require('../components/dashboard/admin-overview.tsx');
    css.metrics = await page.locator('dl[aria-label="System statistics"]').getAttribute('class');
    const states = renderToStaticMarkup(React.createElement(React.Fragment, null,
        React.createElement(AdminMetrics, { stats: { totalUsers: 0, totalGroups: 0, totalResearchPapers: 0, totalPublishedPapers: 0 } }),
        React.createElement(AdminActivity, { title: 'Empty activity', result: { success: true, data: [] } }),
        React.createElement(AdminActivity, { title: 'Unavailable activity', result: { success: false, message: 'Admin reporting is unavailable.' } })));
    await page.locator('main').evaluate((root, html) => { root.innerHTML = html; }, states);
    await expect(page.getByText('No system activity has been recorded yet.', { exact: true })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Admin reporting is unavailable.' })).toBeVisible();
    assert.deepEqual(await page.locator('dl dd:first-of-type').allTextContents(), ['0', '0', '0', '0']);
    assert.deepEqual(errors, []); assert.deepEqual(providerRequests, []);
    console.log('PASS read-only Admin metrics/roles/status/activity, sidebar destinations and absent redundant shortcuts, static assistance/consent, 360/1280 Light/Dark layout/AA contrast/focus/sidebar/bell/PWA, Student/Adviser regression and unauthorized/stale/anonymous denial; zero browser provider requests. Screenshots in OS temp.');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
    for (const context of contexts) await context.close(); if (browser) await browser.close(); if (server) server.kill(); process.exit(process.exitCode || 0);
});
