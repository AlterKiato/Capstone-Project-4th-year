/* eslint-disable @typescript-eslint/no-require-imports */
// Production Chromium + real local PostgreSQL. Only unique synthetic accounts are mutated.
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
const { chromium } = require('@playwright/test');
const expect = require('@playwright/test').expect.configure({ timeout: 15000 });
const origin = 'http://127.0.0.1:3043', path = '/dashboard/admin/users';
const marker = 'PHASE977B_BROWSER_' + Date.now();
const contexts = [], errors = [], providers = [], ids = [];
let browser, server;
const row = async query => (await db.execute(query))[0];
const list = values => values.length ? sql.join(values.map(value => sql`${value}`), sql`, `) : sql`NULL`;
async function pageFor(actor, role = actor?.role_id) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }); contexts.push(context);
    await context.route('**/*', route => { if (/groq|openai|anthropic/i.test(new URL(route.request().url()).hostname)) { providers.push('blocked'); return route.abort(); } return route.continue(); });
    if (actor) await context.addCookies([{ name: 'thesishs_session', value: await createToken({ userId: actor.id, roleId: role, email: 'synthetic@example.invalid' }), url: origin, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 500) errors.push('HTTP ' + response.status()); });
    return page;
}
async function contrast(page) {
    const failures = await page.locator('main').evaluate(root => {
        const lum = color => { const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
        return [...root.querySelectorAll('h1,h2,h3,p,button,label,input,select,span,strong,time')].flatMap(el => {
            if (!el.getClientRects().length || !el.textContent.trim() || el.disabled || el.closest('fieldset:disabled')) return [];
            const style = getComputedStyle(el); let parent = el, bg = style.backgroundColor;
            while (bg === 'rgba(0, 0, 0, 0)' && parent.parentElement) { parent = parent.parentElement; bg = getComputedStyle(parent).backgroundColor; }
            const [high, low] = [lum(style.color), lum(bg)].sort((a, b) => b - a);
            const required = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
            return (high + .05) / (low + .05) < required ? [el.textContent.slice(0, 65)] : [];
        });
    }); assert.deepEqual(failures, []);
}
async function focusLoop(page, modal) {
    await expect(modal).toBeVisible();
    const close = modal.getByRole('button', { name: /^Close / }), cancel = modal.getByRole('button', { name: 'Cancel', exact: true });
    await expect(close).toBeFocused(); await cancel.focus(); await page.keyboard.press('Tab'); await expect(close).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(cancel).toBeFocused();
    assert.ok(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none'));
}
async function main() {
    assert.equal((await row(sql`SELECT current_database() name`)).name, 'thesishs_ai');
    const fixtures = [];
    for (const [first, role, active] of [['Synthetic Admin', 1, true], ['Synthetic   Alpha' + 'LongName'.repeat(8), 2, true], ['Synthetic Student', 3, false]]) {
        const user = await row(sql`INSERT INTO users(first_name,last_name,email,password,role_id,is_active) VALUES (${first},${marker},${marker.toLowerCase() + ids.length + 'longemail'.repeat(10) + '@example.invalid'},'!unusable',${role},${active}) RETURNING id,role_id`);
        fixtures.push(user); ids.push(user.id);
    }
    const [admin, subject, student] = fixtures;
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3043'], { windowsHide: true, stdio: 'ignore' });
    let ready = false;
    for (let i = 0; i < 120; i++) { try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* startup */ } await new Promise(resolve => setTimeout(resolve, 250)); }
    assert.ok(ready); browser = await chromium.launch();
    const page = await pageFor(admin); await page.goto(origin + path);
    await expect(page.getByRole('heading', { name: 'User Management', exact: true })).toBeVisible();
    await expect(page.locator('.dashboard-welcome')).not.toBeVisible();
    const search = page.getByRole('searchbox', { name: 'Search users' }), roleFilter = page.getByLabel('Role filter'), statusFilter = page.getByLabel('Status filter');
    const users = page.locator('section[aria-labelledby="users-heading"] > ul > li');
    assert.equal(await users.count(), Number((await row(sql`SELECT count(*) n FROM users`)).n));
    await search.fill(marker.toLowerCase()); await expect(users).toHaveCount(3);
    for (const [role, n] of [['1', 1], ['2', 1], ['3', 1], ['4', 0], ['', 3]]) { await roleFilter.selectOption(role); await expect(users).toHaveCount(n); }
    await statusFilter.selectOption('inactive'); await expect(users).toHaveCount(1); await roleFilter.selectOption('2'); await expect(users).toHaveCount(0);
    await expect(page.getByText(/^No users match/)).toBeVisible(); await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
    await search.fill('  sYnTheTic     aLpHa'); await expect(users).toHaveCount(1);
    const subjectButton = page.locator(`#manage-user-${subject.id}`);
    // Layout, short-screen scrolling, focus, shared navigation and all three dialogs in both themes.
    for (const width of [1280, 360]) for (const theme of ['Light', 'Dark']) {
        await page.setViewportSize({ width, height: width === 360 ? 560 : 900 });
        await page.getByRole('button', { name: 'Change theme', exact: true }).click(); await page.getByRole('menuitemradio', { name: theme, exact: true }).click();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await contrast(page);
        assert.ok(await users.first().evaluate(el => el.scrollWidth <= el.clientWidth + 1));
        await page.screenshot({ path: join(tmpdir(), `phase977b-directory-${width}-${theme}.png`), fullPage: true });
        await page.getByRole('button', { name: 'New Account', exact: true }).click();
        let modal = page.getByRole('dialog', { name: 'Create Account', exact: true }); await focusLoop(page, modal);
        assert.ok(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.clientHeight <= innerHeight));
        if (width === 360) assert.ok(await modal.evaluate(el => el.scrollHeight > el.clientHeight));
        await contrast(page); await modal.evaluate(el => { el.scrollTop = 0; }); await page.screenshot({ path: join(tmpdir(), `phase977b-create-${width}-${theme}.png`) }); await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'New Account', exact: true })).toBeFocused();
        await subjectButton.click(); modal = page.getByRole('dialog', { name: 'Manage Account', exact: true }); await focusLoop(page, modal); await contrast(page);
        assert.ok(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
        await modal.evaluate(el => { el.scrollTop = 0; }); await page.screenshot({ path: join(tmpdir(), `phase977b-manage-${width}-${theme}.png`) });
        await modal.getByRole('button', { name: 'AI eligibility', exact: true }).click();
        modal = page.getByRole('dialog', { name: 'Institutional AI eligibility', exact: true }); await focusLoop(page, modal);
        await expect(page.locator('dialog[open]')).toHaveCount(1); await expect(modal.getByText('Current status:', { exact: false })).toContainText('Pending Verification');
        await expect(modal.getByRole('checkbox')).toBeDisabled(); await expect(modal.getByRole('button', { name: 'Record eligibility', exact: true })).toBeDisabled();
        await contrast(page); await modal.evaluate(el => { el.scrollTop = 0; }); await page.screenshot({ path: join(tmpdir(), `phase977b-eligibility-${width}-${theme}.png`) }); await page.keyboard.press('Escape'); await expect(subjectButton).toBeFocused();
        await page.getByRole('button', { name: 'Notifications', exact: true }).click(); await page.keyboard.press('Escape');
        if (width === 360) { await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click(); await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Open navigation menu', exact: true })).toBeFocused(); }
        else { await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click(); await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click(); }
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('button', { name: 'New Account', exact: true }).click();
    let modal = page.getByRole('dialog', { name: 'Create Account', exact: true });
    await modal.getByRole('button', { name: 'Create account', exact: true }).click(); await expect(modal.getByLabel('First name', { exact: true })).toBeFocused();
    await modal.getByLabel('First name', { exact: true }).fill('Synthetic');
    page.once('dialog', prompt => prompt.dismiss()); await page.keyboard.press('Escape'); await expect(modal).toBeVisible();
    page.once('dialog', prompt => prompt.accept()); await modal.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(modal).not.toBeVisible();
    await page.getByRole('button', { name: 'New Account', exact: true }).click();
    for (const [label, value] of [['First name', 'Synthetic'], ['Last name', marker], ['Email', marker.toLowerCase() + 'created@example.invalid'], ['Password', 'synthetic-test-password'], ['Confirm password', 'mismatch']]) await modal.getByLabel(label, { exact: true }).fill(value);
    await modal.getByRole('button', { name: 'Create account', exact: true }).click(); await expect(modal.getByRole('status')).toContainText('Passwords do not match');
    await modal.getByLabel('Confirm password', { exact: true }).fill('synthetic-test-password');
    let creations = 0;
    await page.route('**/dashboard/admin/users', async route => { if (route.request().method() === 'POST' && route.request().postData()?.includes('confirmPassword')) { creations++; await new Promise(resolve => setTimeout(resolve, 800)); } await route.continue(); });
    await modal.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(modal.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled(); await page.keyboard.press('Escape'); await page.mouse.click(1, 1); await expect(modal).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Institutional AI eligibility', exact: true })).toBeVisible(); await expect(page.locator('dialog[open]')).toHaveCount(1); assert.equal(creations, 1);
    await page.unroute('**/dashboard/admin/users');
    const created = await row(sql`SELECT id FROM users WHERE email=${marker.toLowerCase() + 'created@example.invalid'}`); assert.ok(created); ids.push(created.id);
    await expect(page.getByText('Current status:', { exact: false })).toContainText('Pending Verification'); await page.keyboard.press('Escape');
    await expect(search).toHaveValue('  sYnTheTic     aLpHa'); await expect(users).toHaveCount(1);
    await roleFilter.selectOption('2'); await subjectButton.click(); modal = page.getByRole('dialog', { name: 'Manage Account', exact: true });
    await modal.getByLabel('New role', { exact: true }).selectOption('4');
    assert.equal((await row(sql`SELECT role_id FROM users WHERE id=${subject.id}`)).role_id, 2);
    await modal.getByRole('button', { name: 'Update Role', exact: true }).click(); await expect(modal.getByText(/Change .* from Adviser to Panel\?/)).toBeVisible();
    await modal.getByRole('button', { name: 'Back to account actions', exact: true }).click(); await modal.getByRole('button', { name: 'Update Role', exact: true }).click();
    let roleWrites = 0;
    await page.route('**/dashboard/admin/users', async route => { if (route.request().method() === 'POST' && route.request().postData() === JSON.stringify([subject.id, 4])) { roleWrites++; await new Promise(resolve => setTimeout(resolve, 800)); } await route.continue(); });
    await modal.getByRole('button', { name: 'Confirm role change', exact: true }).click(); await page.keyboard.press('Escape'); await expect(modal).toBeVisible();
    await expect(modal).not.toBeVisible(); await expect(users).toHaveCount(0); assert.equal(roleWrites, 1); await page.unroute('**/dashboard/admin/users');
    await expect(page.locator('main > p[role="status"]')).toContainText('User role updated successfully.');
    await roleFilter.selectOption(''); await statusFilter.selectOption('active'); await expect(users).toHaveCount(1); await subjectButton.click();
    await modal.getByRole('button', { name: 'Deactivate', exact: true }).click(); await expect(modal.getByText(/Deactivate .*\?/)).toBeVisible();
    await modal.getByRole('button', { name: 'Confirm status change', exact: true }).click(); await expect(modal).not.toBeVisible(); await expect(users).toHaveCount(0);
    await statusFilter.selectOption('inactive'); await expect(users).toHaveCount(1); await subjectButton.click(); await expect(modal.getByText(/Current role: Panel · Status: Inactive/)).toBeVisible();
    await modal.getByRole('button', { name: 'Activate', exact: true }).click(); await modal.getByRole('button', { name: 'Confirm status change', exact: true }).click(); await expect(modal).not.toBeVisible(); await expect(users).toHaveCount(0);
    await page.getByRole('button', { name: 'Clear filters', exact: true }).click(); await page.locator(`#manage-user-${admin.id}`).click();
    await expect(modal.getByLabel('New role', { exact: true })).toBeDisabled(); await expect(modal.getByRole('button', { name: 'Deactivate', exact: true })).toBeDisabled(); await page.keyboard.press('Escape');
    for (const [actor, claim] of [[subject, 1], [student, 3], [null, null]]) { const denied = await pageFor(actor, claim); await denied.goto(origin + path); await expect(denied.locator('#users-heading')).toHaveCount(0); }
    await db.execute(sql`UPDATE users SET is_active=false WHERE id=${admin.id}`); await page.reload(); await expect(page.locator('#users-heading')).toHaveCount(0); await expect(page.locator('p[role="alert"]')).toContainText('account access could not be verified');
    assert.deepEqual(errors, []); assert.deepEqual(providers, []);
    console.log('PASS production Chromium: authorized directory; normalized search/all/combined filters; real create/validation/single eligibility handoff; named role/status confirmations and authoritative refresh/filter preservation; pending/duplicate guards, self restrictions, unauthorized/inactive routes; 360/1280 Light/Dark/short-screen overflow, long identity wrapping, AA contrast, keyboard loop/restoration, sidebar/bell. Zero provider requests/runtime errors. Screenshots in OS temp.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    for (const context of contexts) await context.close(); if (browser) await browser.close(); if (server) server.kill();
    const owned = await db.execute(sql`SELECT id FROM users WHERE last_name=${marker} AND email ILIKE ${marker + '%@example.invalid'}`);
    const ownedIds = owned.map(user => user.id); assert.ok(ownedIds.length <= 4);
    await db.execute(sql`DELETE FROM activity_logs WHERE user_id IN (${list(ownedIds)})`);
    await db.execute(sql`DELETE FROM users WHERE id IN (${list(ownedIds)}) AND last_name=${marker}`);
    assert.equal(Number((await row(sql`SELECT count(*) n FROM users WHERE last_name=${marker}`)).n), 0);
    assert.equal(Number((await row(sql`SELECT count(*) n FROM activity_logs WHERE user_id IN (${list(ownedIds)})`)).n), 0);
    console.log('PASS independent synthetic account/activity cleanup; no real account, storage, governance records or migrations changed.'); process.exit(process.exitCode || 0);
});
