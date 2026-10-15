/* eslint-disable @typescript-eslint/no-require-imports */
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
const { readAdviserGroups, readEligibleGroupStudents } = require('../lib/repositories/adviser-groups.repository.ts');
const { createToken } = require('../lib/auth/jwt.ts');
const { chromium } = require('@playwright/test');
const expect = require('@playwright/test').expect.configure({ timeout: 15000 });
const marker = `PHASE976B_${Date.now()}`;
const origin = 'http://127.0.0.1:3039', path = '/dashboard/adviser/groups';
const userIds = [], groupIds = [], contexts = [], errors = [];
let browser, server;
async function row(query) { return (await db.execute(query))[0]; }
async function contextFor(user, role = user?.role_id) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }); contexts.push(context);
    if (user) await context.addCookies([{ name: 'thesishs_session', value: await createToken({ userId: user.id, roleId: role, email: 'synthetic@example.invalid' }), url: origin, httpOnly: true, sameSite: 'Lax' }]);
    return context;
}
async function navigate(page) {
    await page.goto(origin + path); await page.waitForFunction(() => !document.querySelector('[hidden][id^="S:"]'));
}
async function contrast(page) {
    const failures = await page.locator('main').evaluate(root => {
        const lum = color => { const v = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return v[0] * .2126 + v[1] * .7152 + v[2] * .0722; };
        return [...root.querySelectorAll('h1,h2,h3,h4,p,dt,dd,button,label,input,select,span,strong')].flatMap(el => {
            if (!el.getClientRects().length || !el.textContent.trim() || el.disabled) return [];
            const style = getComputedStyle(el); let parent = el, bg = style.backgroundColor;
            while (bg === 'rgba(0, 0, 0, 0)' && parent.parentElement) { parent = parent.parentElement; bg = getComputedStyle(parent).backgroundColor; }
            const [high, low] = [lum(style.color), lum(bg)].sort((a, b) => b - a);
            const required = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
            return (high + .05) / (low + .05) < required ? [el.textContent.slice(0, 80)] : [];
        });
    }); assert.deepEqual(failures, []);
}
async function main() {
    const users = [];
    for (const role of [2, 2, 3, 3, 3]) {
        const user = await row(sql`INSERT INTO users(first_name,last_name,email,password,role_id) VALUES ('Synthetic',${'Student' + users.length},${marker + users.length + '@example.invalid'},'!unusable',${role}) RETURNING id, role_id`);
        users.push(user); userIds.push(user.id);
    }
    const [adviser, foreign, student, eligible, other] = users;
    assert.deepEqual(await readAdviserGroups(adviser.id), []);
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3039'], { windowsHide: true, stdio: 'ignore' });
    let ready = false;
    for (let n = 0; n < 120; n++) { try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* startup */ } await new Promise(resolve => setTimeout(resolve, 250)); }
    assert.ok(ready); browser = await chromium.launch();
    const context = await contextFor(adviser), page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 500) errors.push('HTTP ' + response.status()); });
    await navigate(page);
    await expect(page.getByText('You have no research groups yet. Select New Group to create one.')).toBeVisible();
    assert.deepEqual(await page.locator('dl dd').allTextContents(), ['0', '0', '0']);
    const names = [marker + ' Alpha ' + 'LongGroupName'.repeat(4), marker + ' Beta', marker + ' Archived', marker + ' FOREIGN'];
    for (let i = 0; i < names.length; i++) {
        const group = await row(sql`INSERT INTO research_groups(group_name,strand,section,school_year,adviser_id,status,created_at) VALUES (${names[i]},${i === 1 ? 'HUMSS' : 'STEM'},${i === 1 ? 'Section B' : 'Section A'},'2026-2027',${i === 3 ? foreign.id : adviser.id},${i === 2 ? 'archived' : 'active'},'2026-01-01') RETURNING id`); groupIds.push(group.id);
    }
    await db.execute(sql`INSERT INTO group_members(group_id,user_id) VALUES (${groupIds[0]},${student.id}),(${groupIds[2]},${student.id}),(${groupIds[3]},${other.id})`);
    for (let i = 0; i < 2; i++) await db.execute(sql`INSERT INTO research_papers(group_id,title,abstract) VALUES (${groupIds[0]},${marker + ' Project ' + i},'Synthetic abstract')`);
    const directory = await readAdviserGroups(adviser.id);
    assert.deepEqual(directory.map(group => group.id), groupIds.slice(0, 3).reverse());
    assert.equal(directory.find(group => group.id === groupIds[0]).projects.length, 2);
    const available = await readEligibleGroupStudents(groupIds[1]);
    assert.ok(available.some(user => user.id === eligible.id)); assert.ok(!available.some(user => [student.id, other.id].includes(user.id)));
    assert.ok(!JSON.stringify(directory).includes('password')); assert.ok(!JSON.stringify(directory).includes('FOREIGN'));
    await navigate(page); assert.deepEqual(await page.locator('dl dd').allTextContents(), ['3', '1', '1']);
    const toggles = page.locator('button[aria-controls^="group-details-"]');
    assert.equal(await page.locator('button[aria-expanded="true"][aria-controls^="group-details-"]').count(), 0);
    await toggles.nth(0).click(); await expect(toggles.nth(0)).toHaveAttribute('aria-expanded', 'true');
    await toggles.nth(1).focus(); await page.keyboard.press('Enter'); await expect(toggles.nth(0)).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Space'); await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'false');
    const search = page.getByRole('searchbox', { name: 'Search groups' });
    for (const query of ['  bEtA  ', 'humss', '  section   b ']) { await search.fill(query); await expect(toggles).toHaveCount(1); await expect(toggles.first()).toContainText('Beta'); }
    await search.fill('unmatched'); await expect(page.getByText(/^No Matching Groups/)).toBeVisible();
    // Creation uses the real existing workflow. Any synthetic in-app notices are removed in finally.
    await page.getByRole('button', { name: 'New Group', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Create Research Group', exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Group Name', { exact: true }).fill('X');
    page.once('dialog', prompt => prompt.dismiss()); await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
    for (const [label, text] of [['Strand', 'STEM'], ['Section', 'A'], ['School Year', '2026-2027']]) await dialog.getByLabel(label, { exact: true }).fill(text);
    await dialog.getByRole('button', { name: 'Create Research Group', exact: true }).click(); await expect(dialog.getByRole('status')).toContainText('at least 2');
    await dialog.getByLabel('Group Name', { exact: true }).fill(marker + ' Created');
    await dialog.getByRole('button', { name: 'Create Research Group', exact: true }).click(); await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'New Group', exact: true })).toBeFocused();
    await expect(page.locator('dl dd').first()).toHaveText('4'); await expect(page.getByText(/^No Matching Groups/)).toBeVisible(); await expect(search).toHaveValue('unmatched');
    assert.equal(Number((await row(sql`SELECT count(*) n FROM research_groups WHERE group_name = ${marker + ' Created'} AND adviser_id = ${adviser.id}`)).n), 1);
    await page.getByRole('button', { name: 'Clear search', exact: true }).click();
    const beta = page.locator(`#group-toggle-${groupIds[1]}`), betaRegion = page.locator(`#group-details-${groupIds[1]}`);
    await beta.click(); await expect(betaRegion.getByText('No students are currently assigned to this group.')).toBeVisible(); await expect(betaRegion.getByText('This group has no research projects yet.')).toBeVisible();
    await betaRegion.getByRole('button', { name: 'Manage Members' }).click();
    dialog = page.getByRole('dialog', { name: 'Manage Members: ' + names[1], exact: true }); await expect(dialog).toBeVisible();
    const select = dialog.getByLabel('Add Student', { exact: true }); await expect(select).toBeVisible();
    await select.selectOption(String(eligible.id));
    // Hold the real request to exercise disabled controls, duplicate prevention and pending Escape.
    let writes = 0, assignmentAction;
    await page.route('**/dashboard/adviser/groups', async route => {
        if (route.request().method() === 'POST' && route.request().postData() === JSON.stringify([groupIds[1], eligible.id])) { writes++; assignmentAction = route.request().headers()['next-action']; await new Promise(resolve => setTimeout(resolve, 650)); }
        await route.continue();
    });
    await dialog.getByRole('button', { name: 'Add Student', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeDisabled(); await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Current Members (1)', exact: true })).toBeVisible();
    await expect(page.locator('dl dd').nth(1)).toHaveText('2'); assert.equal(writes, 1);
    await page.unroute('**/dashboard/adviser/groups');
    // Replay the genuine assignment action against a foreign group with the same Adviser session.
    assert.ok(assignmentAction);
    const denied = await page.request.post(origin + path, { headers: { 'next-action': assignmentAction, 'content-type': 'text/plain;charset=UTF-8', origin }, data: JSON.stringify([groupIds[3], eligible.id]) });
    assert.ok((await denied.text()).includes('not available'));
    assert.equal(Number((await row(sql`SELECT count(*) n FROM group_members WHERE group_id = ${groupIds[3]} AND user_id = ${eligible.id}`)).n), 0);
    await dialog.getByRole('button', { name: 'Remove Synthetic Student3', exact: true }).click();
    await expect(dialog.getByText('Remove', { exact: false }).filter({ has: page.locator('strong') })).toHaveCount(1);
    assert.equal(Number((await row(sql`SELECT count(*) n FROM group_members WHERE group_id = ${groupIds[1]} AND user_id = ${eligible.id}`)).n), 1);
    await dialog.getByRole('button', { name: 'Cancel removal', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Remove Synthetic Student3', exact: true })).toBeFocused();
    await dialog.getByRole('button', { name: 'Remove Synthetic Student3', exact: true }).click();
    await dialog.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Current Members (0)', exact: true })).toBeVisible(); await expect(page.locator('dl dd').nth(1)).toHaveText('1');
    await expect(dialog.getByText(`Synthetic Student3 removed from ${names[1]}.`)).toBeVisible();
    await dialog.getByRole('button', { name: /^Close Manage Members:/ }).click(); await expect(betaRegion.getByRole('button', { name: 'Manage Members' })).toBeFocused();
    // Transport-only overrides verify unavailable/empty eligibility without changing unrelated students.
    for (const mode of ['empty', 'error']) {
        let replaced = false;
        await page.route('**/dashboard/adviser/groups', async route => {
            if (route.request().method() !== 'POST' || route.request().postData() !== JSON.stringify([groupIds[1]])) return route.continue();
            const response = await route.fetch();
            const body = (await response.text()).split('\n').map(line => {
                const split = line.indexOf(':');
                try {
                    const data = JSON.parse(line.slice(split + 1));
                    if (data?.success === true && Array.isArray(data.data)) { replaced = true; return line.slice(0, split + 1) + JSON.stringify(mode === 'empty' ? { ...data, data: [] } : { success: false, message: 'Synthetic eligible-student read unavailable.' }); }
                } catch { /* non-JSON Flight chunks */ }
                return line;
            }).join('\n');
            await route.fulfill({ response, body });
        });
        await betaRegion.getByRole('button', { name: 'Manage Members' }).click();
        await expect(page.getByText(mode === 'empty' ? 'No eligible students are available to assign.' : 'Synthetic eligible-student read unavailable.')).toBeVisible();
        assert.ok(replaced); await expect(dialog.getByRole('button', { name: 'Add Student', exact: true })).toBeDisabled();
        await page.keyboard.press('Escape'); await page.unroute('**/dashboard/adviser/groups');
    }
    await expect(beta).toHaveAttribute('aria-expanded', 'true'); await beta.click(); await expect(beta).toHaveAttribute('aria-expanded', 'false');
    // Real multi-project details and responsive/theme/keyboard dialog checks.
    await page.locator(`#group-toggle-${groupIds[0]}`).click();
    await expect(page.getByRole('heading', { name: 'Research Projects (2)' })).toBeVisible();
    for (const width of [1280, 360]) for (const theme of ['Light', 'Dark']) {
        await page.setViewportSize({ width, height: width === 360 ? 640 : 900 });
        await page.getByRole('button', { name: 'Change theme', exact: true }).click(); await page.getByRole('menuitemradio', { name: theme, exact: true }).click();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await contrast(page);
        await page.screenshot({ path: join(tmpdir(), `phase976b-${width}-${theme}.png`), fullPage: true });
        await page.locator(`#group-details-${groupIds[0]}`).getByRole('button', { name: 'Manage Members' }).click();
        const modal = page.getByRole('dialog', { name: 'Manage Members: ' + names[0], exact: true }); await expect(modal).toBeVisible();
        assert.ok(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1)); await contrast(page);
        await modal.getByRole('button', { name: 'Cancel', exact: true }).focus(); await page.keyboard.press('Tab'); await expect(modal.getByRole('button', { name: /^Close Manage Members:/ })).toBeFocused();
        await page.keyboard.press('Shift+Tab'); await expect(modal.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
        assert.ok(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none'));
        await page.screenshot({ path: join(tmpdir(), `phase976b-dialog-${width}-${theme}.png`) }); await page.keyboard.press('Escape'); await expect(modal).not.toBeVisible();
    }
    await page.locator(`#group-toggle-${groupIds[2]}`).click(); await page.locator(`#group-details-${groupIds[2]}`).getByRole('button', { name: 'Manage Members' }).click();
    await expect(page.getByText('Students can only be added to active research groups.')).toBeVisible(); await page.keyboard.press('Escape');
    const foreignContext = await contextFor(foreign), foreignPage = await foreignContext.newPage(); await navigate(foreignPage);
    await expect(foreignPage.locator('dl dd').first()).toHaveText('1'); assert.ok(!(await foreignPage.locator('main').textContent()).includes(names[0]));
    const studentContext = await contextFor(student), studentPage = await studentContext.newPage(); await navigate(studentPage); await expect(studentPage).not.toHaveURL(origin + path);
    const anonContext = await contextFor(null), anonPage = await anonContext.newPage(); await navigate(anonPage); await expect(anonPage).toHaveURL(origin + '/login');
    await db.execute(sql`UPDATE users SET is_active = false WHERE id = ${adviser.id}`); await navigate(page); assert.equal(await page.locator('dl').count(), 0);
    await db.execute(sql`UPDATE users SET is_active = true, role_id = 3 WHERE id = ${adviser.id}`); await navigate(page); assert.equal(await page.locator('dl').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS real SQL scoped directory/counts/ties/multiple projects/eligibility; real create/assign/confirmed-remove and refreshed counts; trimmed search, one-or-none accordion, validation/discard guard, pending Escape/disabled duplicate prevention, 360/1280 Light/Dark overflow/AA contrast/focus loop/restoration; foreign/Student/anonymous/inactive/stale denial. Screenshots in OS temp.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    for (const context of contexts) await context.close(); if (browser) await browser.close(); if (server) server.kill();
    // Only marker-owned fixtures and exact messages produced by this run.
    await db.execute(sql`DELETE FROM notifications WHERE title = 'New Research Group Created' AND message = ${`A new research group named "${marker} Created" was created.`}`);
    if (userIds.length) {
        await db.execute(sql`DELETE FROM activity_logs WHERE user_id IN (${sql.join(userIds.map(id => sql`${id}`), sql`,`)})`);
        const owned = sql`SELECT id FROM research_groups WHERE adviser_id IN (${sql.join(userIds.map(id => sql`${id}`), sql`,`)})`;
        await db.execute(sql`DELETE FROM research_papers WHERE group_id IN (${owned})`);
        await db.execute(sql`DELETE FROM group_members WHERE group_id IN (${owned})`);
        await db.execute(sql`DELETE FROM research_groups WHERE adviser_id IN (${sql.join(userIds.map(id => sql`${id}`), sql`,`)})`);
        await db.execute(sql`DELETE FROM users WHERE id IN (${sql.join(userIds.map(id => sql`${id}`), sql`,`)})`);
    }
    for (const query of [sql`SELECT count(*) n FROM users WHERE email LIKE ${marker + '%'}`, sql`SELECT count(*) n FROM research_groups WHERE group_name LIKE ${marker + '%'}`, sql`SELECT count(*) n FROM notifications WHERE message LIKE ${'%' + marker + '%'}`]) assert.equal(Number((await row(query)).n), 0);
    console.log('PASS synthetic user/group/project/member/activity/creation-notice cleanup. No pre-existing rows edited; no storage or provider operations.');
    process.exit(process.exitCode || 0);
});
