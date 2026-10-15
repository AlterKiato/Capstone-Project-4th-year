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
const { readAdviserDashboard } = require('../lib/repositories/adviser-dashboard.repository.ts');
const { createToken } = require('../lib/auth/jwt.ts');
const { chromium, expect } = require('@playwright/test');
const marker = `PHASE976A_${Date.now()}`;
const origin = 'http://127.0.0.1:3038';
let browser, server;
const userIds = [], groupIds = [], paperIds = [], submissionIds = [], contexts = [], errors = [];
async function row(query) { return (await db.execute(query))[0]; }
async function contextFor(user, role = user.role_id) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/New_York' }); contexts.push(context);
    await context.addCookies([{ name: 'thesishs_session', value: await createToken({ userId: user.id, roleId: role, email: 'synthetic@example.invalid' }), url: origin, httpOnly: true, sameSite: 'Lax' }]);
    return context;
}
async function navigate(page, path = '/dashboard/adviser') {
    await page.goto(origin + path);
    await page.waitForFunction(() => !document.querySelector('[hidden][id^="S:"]'));
}
async function contrast(page) {
    const failures = await page.locator('main.dashboard-page').evaluate(root => {
        const lum = color => { const v = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return v[0] * .2126 + v[1] * .7152 + v[2] * .0722; };
        return [...root.querySelectorAll('h1,h2,h3,p,dt,dd,a,span,time')].flatMap(el => {
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
    const users = [];
    for (const role of [2, 2, 3, 1]) { const user = await row(sql`INSERT INTO users(first_name,last_name,email,password,role_id) VALUES ('Synthetic','Dashboard',${marker + role + users.length + '@example.invalid'},'!unusable',${role}) RETURNING id, role_id`); users.push(user); userIds.push(user.id); }
    const [adviser, foreign, student, admin] = users;
    // Empty state verified against actual authorized zero records.
    assert.deepEqual(await readAdviserDashboard(adviser.id), { totalGroups: 0, pending: 0, reviewed: 0, attention: [], groups: [] });
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3038'], { windowsHide: true, stdio: 'ignore' });
    let ready = false;
    for (let n = 0; n < 120; n++) { try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* startup */ } await new Promise(resolve => setTimeout(resolve, 250)); }
    assert.ok(ready, 'production server started'); browser = await chromium.launch();
    const context = await contextFor(adviser), page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 500) errors.push('HTTP ' + response.status()); });
    await navigate(page);
    await expect(page.getByText("You're all caught up. No submissions currently need your review.")).toBeVisible();
    await expect(page.getByText(/You have no research groups yet/)).toBeVisible();
    for (let i = 0; i < 5; i++) {
        const group = await row(sql`INSERT INTO research_groups(group_name,strand,section,school_year,adviser_id,created_at,status) VALUES (${i === 0 ? marker + ' Long research group name '.repeat(3) : marker + ' Group ' + i},'STEM','Synthetic Section','2026-2027',${i === 4 ? foreign.id : adviser.id},'2026-01-01',${i === 3 ? 'archived' : 'active'}) RETURNING id`); groupIds.push(group.id);
    }
    await db.execute(sql`INSERT INTO group_members(group_id,user_id) VALUES (${groupIds[0]},${student.id})`);
    for (const groupId of [groupIds[0], groupIds[0], groupIds[4]]) { const paper = await row(sql`INSERT INTO research_papers(group_id,title,abstract) VALUES (${groupId},${marker + (groupId === groupIds[4] ? ' FOREIGN PRIVATE' : ' Research title '.repeat(9))},'Synthetic abstract') RETURNING id`); paperIds.push(paper.id); }
    const statuses = ['Submitted', 'Under Review', 'Submitted', 'Under Review', 'Submitted', 'Submitted', 'Approved', 'Revision Required', 'Unknown'];
    for (let i = 0; i < statuses.length; i++) {
        const item = await row(sql`INSERT INTO submissions(paper_id,submitted_by,version,file_url,status,submitted_at) VALUES (${paperIds[i % 2]},${student.id},${'v' + (i + 1)},'PRIVATE_STORAGE_PATH',${statuses[i]},${i < 2 ? '2026-03-01' : '2026-04-01'}) RETURNING id`); submissionIds.push(item.id);
    }
    const foreignItem = await row(sql`INSERT INTO submissions(paper_id,submitted_by,version,file_url,status,submitted_at) VALUES (${paperIds[2]},${student.id},'v1','FOREIGN_PRIVATE_PATH','Submitted','2025-01-01') RETURNING id`); submissionIds.push(foreignItem.id);
    // Multiple feedback rows must not inflate the completed version count.
    await db.execute(sql`INSERT INTO feedbacks(submission_id,teacher_id,comments,decision) VALUES (${submissionIds[6]},${adviser.id},'Synthetic one','Approved'),(${submissionIds[6]},${adviser.id},'Synthetic two','Approved')`);
    const data = await readAdviserDashboard(adviser.id);
    assert.equal(data.totalGroups, 4); assert.equal(data.pending, 6); assert.equal(data.reviewed, 2);
    assert.deepEqual(data.attention.map(item => item.id), submissionIds.slice(0, 5));
    assert.deepEqual(data.groups.map(item => item.id), groupIds.slice(1, 4).reverse());
    // Separate member/project counts, including the group excluded by the three-row preview.
    const foreignData = await readAdviserDashboard(foreign.id);
    assert.equal(foreignData.totalGroups, 1); assert.equal(foreignData.pending, 1); assert.equal(foreignData.reviewed, 0);
    assert.deepEqual(foreignData.attention.map(item => item.id), [foreignItem.id]);
    assert.ok(!JSON.stringify(data).includes('PRIVATE'));
    // Bring the multi-project group into the preview without changing unrelated data.
    await db.execute(sql`UPDATE research_groups SET created_at = '2026-02-01' WHERE id = ${groupIds[0]}`);
    const preview = await readAdviserDashboard(adviser.id);
    assert.equal(preview.groups[0].memberCount, 1); assert.equal(preview.groups[0].projectCount, 2);
    await navigate(page);
    const attention = page.getByRole('region', { name: 'Needs Your Attention' });
    const groups = page.getByRole('region', { name: 'My Research Groups' });
    assert.deepEqual(await page.locator('dl dd:first-of-type').allTextContents(), ['4', '6', '2']);
    await expect(groups.getByText('1 member · 2 research projects')).toBeVisible();
    assert.equal(await groups.locator('li').count(), 3);
    assert.ok(!(await page.locator('main').textContent()).includes('FOREIGN PRIVATE'));
    for (let i = 0; i < 5; i++) await expect(attention.getByRole('link').nth(i)).toHaveAttribute('href', '/dashboard/adviser/submissions/' + submissionIds[i]);
    for (const width of [1280, 360]) for (const theme of ['Light', 'Dark']) {
        await page.setViewportSize({ width, height: 900 });
        await page.getByRole('button', { name: 'Change theme', exact: true }).click();
        await page.getByRole('menuitemradio', { name: theme, exact: true }).click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme.toLowerCase());
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.ok(await page.locator('main').evaluate(root => [...root.querySelectorAll('li,dl,section,a,h3')].every(el => el.scrollWidth <= el.clientWidth + 1)));
        const rects = await page.locator('dl > div').evaluateAll(nodes => nodes.map(el => ({ x: el.offsetLeft, y: el.offsetTop })));
        if (width === 1280) assert.equal(new Set(rects.map(r => r.y)).size, 1); else assert.equal(new Set(rects.map(r => r.x)).size, 1);
        await contrast(page);
        await attention.getByRole('link').first().focus(); await expect(attention.getByRole('link').first()).toBeFocused();
        // Keyboard-triggered focus uses the shared visible outline.
        await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none'));
        await page.screenshot({ path: join(tmpdir(), `phase976a-${width}-${theme}.png`), fullPage: true });
        await page.getByRole('button', { name: 'Notifications', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Notifications', exact: true })).toBeVisible(); await page.keyboard.press('Escape');
        if (width === 1280) {
            await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
            await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
        } else {
            await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click();
            await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).toBeVisible();
            await page.keyboard.press('Escape');
            await expect(page.getByRole('button', { name: 'Open navigation menu', exact: true })).toBeFocused();
        }
    }
    // Every queue destination is opened; none starts review or fetches a PDF.
    for (let i = 0; i < 5; i++) { await attention.getByRole('link').nth(i).click(); await expect(page).toHaveURL(origin + '/dashboard/adviser/submissions/' + submissionIds[i]); await expect(page.getByText('v' + (i + 1), { exact: true })).toBeVisible(); await navigate(page); }
    for (let i = 0; i < 3; i++) { await groups.getByRole('link', { name: /^View Groups:/ }).nth(i).click(); await expect(page).toHaveURL(origin + '/dashboard/adviser/groups'); await navigate(page); }
    await groups.getByRole('link', { name: 'View All Groups', exact: true }).click(); await expect(page).toHaveURL(origin + '/dashboard/adviser/groups');
    const foreignContext = await contextFor(foreign), foreignPage = await foreignContext.newPage();
    await navigate(foreignPage); assert.deepEqual(await foreignPage.locator('dl dd:first-of-type').allTextContents(), ['1', '1', '0']);
    await navigate(foreignPage, '/dashboard/adviser/submissions/' + submissionIds[0]); assert.ok(!(await foreignPage.locator('body').textContent()).includes(marker));
    for (const user of [student, admin]) { const denied = await contextFor(user), deniedPage = await denied.newPage(); await navigate(deniedPage); await expect(deniedPage).not.toHaveURL(origin + '/dashboard/adviser'); assert.ok(!(await deniedPage.content()).includes(marker)); }
    const anonymous = await browser.newContext(); contexts.push(anonymous); const anonPage = await anonymous.newPage(); await navigate(anonPage); await expect(anonPage).toHaveURL(origin + '/login');
    await db.execute(sql`UPDATE users SET is_active = false WHERE id = ${adviser.id}`); await navigate(page); assert.equal(await page.locator('dl').count(), 0); assert.ok(!(await page.content()).includes(marker));
    await db.execute(sql`UPDATE users SET is_active = true, role_id = 3 WHERE id = ${adviser.id}`); await navigate(page); assert.equal(await page.locator('dl').count(), 0); assert.ok(!(await page.content()).includes(marker));
    assert.deepEqual(errors, []);
    console.log('PASS real SQL ownership/counts/statuses/limits/ties/multiple projects/duplicate feedback, empty state, queue/group links, foreign/role/anonymous/inactive/stale denial, 360/1280 Light/Dark overflow/alignment/AA contrast/keyboard/bell. Screenshots in temp directory.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    for (const context of contexts) await context.close(); if (browser) await browser.close(); if (server) server.kill();
    if (submissionIds.length) await db.execute(sql`DELETE FROM feedbacks WHERE submission_id IN (${sql.join(submissionIds.map(id => sql`${id}`), sql`,`)})`);
    if (paperIds.length) await db.execute(sql`DELETE FROM submissions WHERE paper_id IN (${sql.join(paperIds.map(id => sql`${id}`), sql`,`)})`);
    if (groupIds.length) {
        await db.execute(sql`DELETE FROM research_papers WHERE group_id IN (${sql.join(groupIds.map(id => sql`${id}`), sql`,`)})`);
        await db.execute(sql`DELETE FROM group_members WHERE group_id IN (${sql.join(groupIds.map(id => sql`${id}`), sql`,`)})`);
        await db.execute(sql`DELETE FROM research_groups WHERE id IN (${sql.join(groupIds.map(id => sql`${id}`), sql`,`)})`);
    }
    if (userIds.length) await db.execute(sql`DELETE FROM users WHERE id IN (${sql.join(userIds.map(id => sql`${id}`), sql`,`)})`);
    assert.equal(Number((await row(sql`SELECT count(*) AS n FROM users WHERE email LIKE ${marker + '%'} `)).n), 0);
    assert.equal(Number((await row(sql`SELECT count(*) AS n FROM research_groups WHERE group_name LIKE ${marker + '%'} `)).n), 0);
    console.log('PASS isolated synthetic fixture cleanup; no storage objects or pre-existing records changed.');
    process.exit(process.exitCode || 0);
});
