/* eslint-disable @typescript-eslint/no-require-imports */
// Local synthetic fixtures only; notification fixtures are removed in finally.
const assert = require('node:assert/strict');
const Module = require('node:module');
const { spawn } = require('node:child_process');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
require('dotenv/config');
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, 'localhost'); assert.equal(target.port, '5432'); assert.equal(target.pathname, '/thesishs_ai');
const original = Module._load;
Module._load = function(id, ...args) { return id === 'server-only' ? {} : original.call(this, id, ...args); };
const { db } = require('../lib/db.ts');
const { sql } = require('drizzle-orm');
const { createToken } = require('../lib/auth/jwt.ts');
const { chromium, expect } = require('@playwright/test');
const origin = 'http://127.0.0.1:3035';
const marker = `PHASE975_${Date.now()}_`;
let browser, server, syntheticStudentId;
const ids = [], errors = [];
async function main() {
    const actors = await db.execute(sql`SELECT id, role_id FROM users WHERE is_active = true AND (email ILIKE '%test%' OR email ILIKE '%phase%') ORDER BY id`);
    const users = [1, 2, 3, 4].map(role => actors.find(actor => actor.role_id === role));
    assert.ok(users.every(Boolean), 'Four existing synthetic roles');
    const created = await db.execute(sql`INSERT INTO users(first_name,last_name,email,password,role_id) VALUES ('Synthetic','Notification test',${marker + '@example.invalid'},'!unusable-test-password',3) RETURNING id, role_id`);
    syntheticStudentId = created[0].id;
    users[2] = created[0];
    // Read-only SQL observes actual bounded repository and count queries.
    const { findNotificationPreview } = require('../lib/repositories/notification.repository.ts');
    for (const user of users) {
        const initial = await findNotificationPreview(user.id);
        const count = await db.execute(sql`SELECT count(*)::int AS n FROM notifications WHERE user_id = ${user.id} AND is_read = false`);
        assert.equal(initial.unreadCount, count[0].n);
        assert.ok(initial.recent.length <= 5);
    }
    // One role gets >9 unread, identical timestamps exercise the stable ID tie-breaker.
    for (let n = 0; n < 12; n++) {
        const rows = await db.execute(sql`INSERT INTO notifications(user_id,title,message,created_at) VALUES (${users[2].id}, ${marker + n}, ${'Long synthetic message ' + 'WrapThisLongWord'.repeat(35)}, '2099-01-01') RETURNING id`);
        ids.push(rows[0].id);
    }
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3035'], { windowsHide: true, stdio: 'ignore' });
    let ready = false;
    for (let i = 0; i < 100; i++) {
        if (server.exitCode !== null) throw new Error('Temporary server exited');
        try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* startup */ }
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready); browser = await chromium.launch();
    for (const user of users) {
        const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', hasTouch: true });
        await context.addCookies([{ name: 'thesishs_session', value: await createToken({ userId: user.id, roleId: user.role_id, email: 'fixture@example.invalid' }), url: origin, httpOnly: true, sameSite: 'Lax' }]);
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${origin}/dashboard/settings`);
        const bell = page.getByRole('button', { name: 'Notifications', exact: true });
        const panel = page.getByRole('dialog', { name: 'Notifications', exact: true });
        await expect(bell).toHaveCount(1);
        await expect(page.getByRole('status').filter({ hasText: 'updating' })).toHaveCount(0);
        const rail = page.getByRole('complementary', { name: 'Workspace sidebar' });
        await rail.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
        await expect(rail.getByRole('link', { name: 'Settings', exact: true })).toHaveAttribute('title', 'Settings');
        await rail.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
        assert.equal(await page.getByRole('complementary').getByRole('link', { name: 'Notifications', exact: true }).count(), 0);
        const actual = await findNotificationPreview(user.id);
        await bell.click(); await expect(panel).toBeVisible();
        await expect(panel.getByText('Loading notifications...', { exact: true })).toHaveCount(0);
        await expect(panel.locator('li')).toHaveCount(actual.recent.length);
        assert.deepEqual(await panel.locator('h3').allTextContents(), actual.recent.map(item => item.title));
        if (user.role_id !== 3) assert.ok(!(await panel.textContent()).includes(marker), 'Other recipients cannot see Student fixture');
        if (actual.recent.length === 0) await expect(panel.getByText("You're all caught up.", { exact: true })).toBeVisible();
        if (user.role_id === 3) {
            await expect(bell).toHaveText('9+');
            await expect(page.getByRole('status').filter({ hasText: `${actual.unreadCount} unread notifications` })).toHaveCount(1);
            assert.deepEqual(actual.recent.map(item => item.id), ids.slice(-5).reverse());
        }
        await page.keyboard.press('Escape'); await expect(panel).not.toBeVisible(); await expect(bell).toBeFocused();
        await bell.click(); await page.getByRole('heading', { name: 'Settings', exact: true }).click(); await expect(panel).not.toBeVisible();
        await bell.click(); await bell.click(); await expect(panel).not.toBeVisible();
        for (const width of [1280, 360]) {
            await page.setViewportSize({ width, height: 900 });
            for (const theme of ['Light', 'Dark']) {
                await page.getByRole('radio', { name: theme, exact: true }).check();
                await bell.click(); await expect(panel).toBeVisible();
                await expect(panel.getByText('Loading notifications...', { exact: true })).toHaveCount(0);
                const bounds = await panel.boundingBox();
                assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                assert.ok(await panel.evaluate(el => el.scrollWidth <= el.clientWidth));
                const contrast = await panel.locator('h2, h3, p, button, a').evaluateAll(elements => {
                    function lum(color) {
                        const c = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
                        return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
                    }
                    return elements.flatMap(el => {
                        const s = getComputedStyle(el); let ancestor = el, bg = s.backgroundColor;
                        while (bg === 'rgba(0, 0, 0, 0)' && ancestor.parentElement) { ancestor = ancestor.parentElement; bg = getComputedStyle(ancestor).backgroundColor; }
                        const l = [lum(s.color), lum(bg)].sort((a, b) => b - a);
                        return (l[0] + .05) / (l[1] + .05) < 4.5 ? [el.textContent] : [];
                    });
                });
                assert.deepEqual(contrast, [], 'Popover text contrast at least 4.5:1');
                await page.screenshot({ path: join(tmpdir(), `phase975-role${user.role_id}-${width}-${theme}.png`), fullPage: true });
                await page.keyboard.press('Tab');
                assert.ok(await page.locator(':focus').evaluate(el => el.matches(':focus-visible') && parseFloat(getComputedStyle(el).outlineWidth) >= 3));
                await page.keyboard.press('Escape');
            }
        }
        await bell.click(); await page.getByRole('button', { name: 'Change theme', exact: true }).click();
        await expect(panel).not.toBeVisible(); await expect(page.getByRole('menu', { name: 'Theme' })).toBeVisible();
        await page.keyboard.press('Escape');
        await bell.click();
        if (user.role_id !== 4) {
            const path = { 1: 'admin', 2: 'adviser', 3: 'student' }[user.role_id];
            await panel.getByRole('link', { name: 'View all notifications' }).click();
            await expect(page).toHaveURL(`${origin}/dashboard/${path}/notifications`);
            await expect(panel).not.toBeVisible();
        } else await expect(panel.getByRole('link', { name: 'View all notifications' })).toHaveCount(0);
        await page.goto(`${origin}/dashboard/settings`);
        await page.getByRole('radio', { name: 'System', exact: true }).check();
        await page.emulateMedia({ colorScheme: 'dark' });
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        if (user.role_id === 3) {
            await bell.click(); await expect(panel.getByText('Loading notifications...', { exact: true })).toHaveCount(0);
            assert.equal(await panel.evaluate(el => getComputedStyle(el).scrollbarWidth), 'none');
            assert.ok(await panel.evaluate(el => el.scrollHeight > el.clientHeight));
            const bounds = await panel.boundingBox();
            await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            await page.mouse.wheel(0, 400);
            await expect.poll(() => panel.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
            await panel.evaluate(el => { el.scrollTop = 0; }); await panel.focus();
            await page.keyboard.press('PageDown');
            await expect.poll(() => panel.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
            await panel.evaluate(el => { el.scrollTop = 0; });
            const cdp = await context.newCDPSession(page);
            const x = Math.round(bounds.x + bounds.width / 2), y = Math.round(bounds.y + bounds.height * .7);
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
            for (let offset = 20; offset <= 160; offset += 20) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - offset }] });
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await expect.poll(() => panel.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
            await cdp.detach();
            const before = (await findNotificationPreview(user.id)).unreadCount;
            let failedReadRequests = 0;
            await page.route('**/dashboard/settings', async route => {
                if (route.request().method() === 'POST') { failedReadRequests++; await new Promise(resolve => setTimeout(resolve, 400)); await route.abort(); }
                else await route.continue();
            });
            await panel.getByRole('button', { name: 'Mark as Read', exact: true }).first().evaluate(el => { el.click(); el.click(); });
            await expect(panel.getByRole('button', { name: 'Marking as read...' })).toBeDisabled();
            await expect(panel.getByRole('alert')).toContainText('could not be marked as read');
            await expect(panel.getByText(`${before} unread`, { exact: true })).toBeVisible();
            assert.equal((await findNotificationPreview(user.id)).unreadCount, before);
            assert.equal(failedReadRequests, 1, 'Rapid repeat clicks produce one request');
            await page.unroute('**/dashboard/settings');
            await panel.getByRole('button', { name: 'Mark as Read', exact: true }).first().click();
            await expect(panel.getByText(`${before - 1} unread`, { exact: true })).toBeVisible();
            let bulkRequests = 0;
            await page.route('**/dashboard/settings', async route => {
                if (route.request().method() === 'POST') { bulkRequests++; await new Promise(resolve => setTimeout(resolve, 400)); await route.abort(); }
                else await route.continue();
            });
            await panel.getByRole('button', { name: 'Mark all as read', exact: true }).evaluate(el => { el.click(); el.click(); });
            await expect(panel.getByRole('button', { name: 'Marking all as read...' })).toBeDisabled();
            await expect(panel.getByRole('alert')).toContainText('could not be marked as read');
            assert.equal(bulkRequests, 1);
            assert.equal((await findNotificationPreview(user.id)).unreadCount, before - 1);
            await page.unroute('**/dashboard/settings');
            const otherUnreadBefore = await db.execute(sql`SELECT id FROM notifications WHERE user_id <> ${user.id} AND is_read = false ORDER BY id`);
            await panel.getByRole('button', { name: 'Mark all as read', exact: true }).click();
            await expect(panel.getByText('0 unread', { exact: true })).toBeVisible();
            await expect(panel.getByRole('button', { name: 'Mark all as read', exact: true })).toBeDisabled();
            await expect(bell).toHaveText('');
            assert.equal((await findNotificationPreview(user.id)).unreadCount, 0, 'All records read, including beyond five previews');
            assert.deepEqual(await db.execute(sql`SELECT id FROM notifications WHERE user_id <> ${user.id} AND is_read = false ORDER BY id`), otherUnreadBefore);
            const marked = await db.execute(sql`SELECT is_read FROM notifications WHERE id = ${ids.at(-1)}`);
            assert.equal(marked[0].is_read, true);
            await page.keyboard.press('Escape');
            await page.route('**/dashboard/settings', async route => {
                if (route.request().method() === 'POST') { await new Promise(resolve => setTimeout(resolve, 400)); await route.abort(); }
                else await route.continue();
            });
            await bell.click(); await expect(panel.getByText('Loading notifications...', { exact: true })).toBeVisible();
            await expect(panel.getByRole('alert')).toContainText('could not be loaded');
            await expect(page.getByRole('status').filter({ hasText: 'Unread count unavailable' })).toHaveCount(1);
            await expect(bell).toHaveText('');
            await expect(panel.getByRole('link', { name: 'View all notifications' })).toHaveAttribute('href', '/dashboard/student/notifications');
            await page.unroute('**/dashboard/settings');
            await panel.getByRole('button', { name: 'Retry', exact: true }).click();
            await expect(panel.getByText('0 unread', { exact: true })).toBeVisible();
        }
        await page.setViewportSize({ width: 360, height: 900 });
        const menu = page.getByRole('button', { name: 'Open navigation menu' });
        await menu.click(); await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).toBeVisible();
        await expect(panel).not.toBeVisible(); await page.keyboard.press('Escape'); await expect(menu).toBeFocused();
        await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('PASS actual SQL scoped counts/limit/order; four-role popovers/history, individual and bulk reads with failure/deduplication/recipient isolation; hidden scrollbar with wheel/keyboard/touch scrolling; theme and drawer exclusion, 360/1280 Light/Dark contrast/containment/screenshots');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    await browser?.close(); server?.kill();
    if (ids.length) await db.execute(sql`DELETE FROM notifications WHERE id IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)}) AND title LIKE ${marker + '%'}`);
    const remaining = await db.execute(sql`SELECT count(*)::int AS n FROM notifications WHERE title LIKE ${marker + '%'}`);
    assert.equal(remaining[0].n, 0); console.log('PASS independent synthetic notification cleanup; no existing records modified');
    if (syntheticStudentId) {
        await db.execute(sql`DELETE FROM users WHERE id = ${syntheticStudentId} AND email = ${marker + '@example.invalid'}`);
        assert.equal((await db.execute(sql`SELECT id FROM users WHERE id = ${syntheticStudentId}`)).length, 0);
        console.log('PASS temporary bulk-read account cleanup');
    }
    setTimeout(() => process.exit(process.exitCode || 0), 150).unref();
});
