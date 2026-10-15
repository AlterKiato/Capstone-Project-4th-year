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
const { createToken } = require('../lib/auth/jwt.ts');
const { readOwnedSubmissionFeedback } = require('../lib/repositories/adviser-review-details.repository.ts');
const { findSubmissionsByGroupIds } = require('../lib/repositories/adviser-submission.repository.ts');
const { chromium } = require('@playwright/test');
const expect = require('@playwright/test').expect.configure({ timeout: 15000 });
const marker = `PHASE976C_${Date.now()}`;
const origin = 'http://127.0.0.1:3040', path = '/dashboard/adviser/submissions';
const userIds = [], groupIds = [], paperIds = [], submissionIds = [], contexts = [], errors = [];
let browser, server, before;
async function row(query) { return (await db.execute(query))[0]; }
const tables = ['users', 'research_groups', 'group_members', 'research_papers', 'submissions', 'feedbacks', 'notifications', 'activity_logs'];
async function fingerprints() {
    const result = {};
    for (const table of tables) result[table] = (await row(sql`SELECT md5(coalesce(string_agg(to_jsonb(t)::text, '' ORDER BY to_jsonb(t)::text), '')) digest FROM ${sql.identifier(table)} t`)).digest;
    return result;
}
async function contextFor(user, role = user?.role_id) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } }); contexts.push(context);
    if (user) await context.addCookies([{ name: 'thesishs_session', value: await createToken({ userId: user.id, roleId: role, email: 'synthetic@example.invalid' }), url: origin, httpOnly: true, sameSite: 'Lax' }]);
    await context.route('**/*', route => {
        if (new URL(route.request().url()).origin !== origin) { errors.push('Unexpected external browser request'); return route.abort(); }
        return route.continue();
    });
    return context;
}
async function navigate(page, suffix = '') { await page.goto(origin + path + suffix); await page.waitForFunction(() => !document.querySelector('[hidden][id^="S:"]')); }
async function checkLayout(page) {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
    const failures = await page.locator('main').evaluate(root => {
        const lum = color => { const v = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return v[0] * .2126 + v[1] * .7152 + v[2] * .0722; };
        return [...root.querySelectorAll('h1,h2,h3,h4,p,dt,dd,button,label,input,select,span,strong,a')].flatMap(el => {
            if (!el.getClientRects().length || el.closest('[hidden]') || !el.textContent.trim() || el.disabled) return [];
            const style = getComputedStyle(el); let parent = el, bg = style.backgroundColor;
            while (bg === 'rgba(0, 0, 0, 0)' && parent.parentElement) { parent = parent.parentElement; bg = getComputedStyle(parent).backgroundColor; }
            const [high, low] = [lum(style.color), lum(bg)].sort((a, b) => b - a);
            const required = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
            return (high + .05) / (low + .05) < required ? [el.textContent.slice(0, 80)] : [];
        });
    }); assert.deepEqual(failures, [], 'AA text contrast');
}
async function main() {
    before = await fingerprints();
    const users = [];
    for (const role of [2, 2, 3, 1, 4, 2]) {
        const user = await row(sql`INSERT INTO users(first_name,last_name,email,password,role_id) VALUES ('Synthetic',${users.length === 2 ? 'Submitting Student' : 'Reviewer'},${marker + users.length + '@example.invalid'},'!unusable',${role}) RETURNING id,role_id`);
        users.push(user); userIds.push(user.id);
    }
    const [adviser, foreign, student, admin, panel, empty] = users;
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3040'], { windowsHide: true, stdio: 'ignore' });
    let ready = false;
    for (let n = 0; n < 120; n++) { try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* startup */ } await new Promise(resolve => setTimeout(resolve, 250)); }
    assert.ok(ready); browser = await chromium.launch();
    const context = await contextFor(adviser), page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 500) errors.push('HTTP ' + response.status()); });
    await navigate(page); await expect(page.getByText(/^No research submissions from your groups yet/)).toBeVisible();
    assert.deepEqual(await page.locator('dl[aria-label="Submission versions"] dd').allTextContents(), ['0', '0', '0']);
    for (const owner of [adviser, foreign]) {
        const group = await row(sql`INSERT INTO research_groups(group_name,strand,section,school_year,adviser_id) VALUES (${marker + (owner === adviser ? ' Same Group' : ' FOREIGN')},'STEM','A','2026-2027',${owner.id}) RETURNING id`); groupIds.push(group.id);
    }
    await db.execute(sql`INSERT INTO group_members(group_id,user_id) VALUES (${groupIds[0]},${student.id})`);
    const titles = [marker + ' Project Alpha ' + 'LongTitle'.repeat(12), marker + ' Project Beta', marker + ' Completed', marker + ' FOREIGN'];
    for (let i = 0; i < titles.length; i++) {
        const paper = await row(sql`INSERT INTO research_papers(group_id,title,abstract,status) VALUES (${i === 3 ? groupIds[1] : groupIds[0]},${titles[i]},'Synthetic abstract','In Review') RETURNING id`); paperIds.push(paper.id);
    }
    const specs = [[0, 'v9', 'Submitted', '2026-01-01'], [0, 'v2', 'Revision Required', '2026-02-01'], [0, 'v1', 'Approved', '2026-02-01'], [1, 'v1', 'Under Review', '2026-03-01'], [1, 'v2', 'Submitted', '2026-04-01'], [2, 'v1', 'Approved', '2026-05-01'], [3, 'v1', 'Submitted', '2026-06-01']];
    for (const [paper, version, status, date] of specs) {
        const submission = await row(sql`INSERT INTO submissions(paper_id,submitted_by,version,file_url,remarks,status,submitted_at) VALUES (${paperIds[paper]},${student.id},${version},${`research/${paperIds[paper]}/${version}/synthetic.pdf`},${paper === 0 ? 'Synthetic remarks\n' + 'LongRemarks'.repeat(30) : null},${status},${date}) RETURNING id`); submissionIds.push(submission.id);
        if (submissionIds.length === 1) { await navigate(page); await page.getByLabel('Status filter').selectOption('reviewed'); await expect(page.getByText('No reviewed submissions yet.')).toBeVisible(); }
    }
    for (const index of [1, 2]) await db.execute(sql`INSERT INTO feedbacks(submission_id,teacher_id,comments,decision,created_at) VALUES (${submissionIds[index]},${adviser.id},${marker + ' feedback only ' + specs[index][1] + '\nLine two.'},${specs[index][2]},'2026-02-02')`);
    assert.equal((await readOwnedSubmissionFeedback(submissionIds[1], adviser.id))[0].comments, marker + ' feedback only v2\nLine two.');
    assert.deepEqual(await readOwnedSubmissionFeedback(submissionIds[1], foreign.id), []);
    assert.equal((await findSubmissionsByGroupIds([groupIds[0]])).length, 6);
    await navigate(page);
    const assistance = page.getByRole('region', { name: 'Adviser workflow assistance' });
    await assistance.getByRole('button', { name: 'How do I start review?', exact: true }).click();
    await expect(assistance.getByRole('status')).toContainText('Verified static procedural guidance. No AI provider is used.');
    await assistance.getByRole('button', { name: 'AI Terms & Consent', exact: true }).click();
    const consent = page.getByRole('dialog', { name: 'AI Terms & Consent', exact: true }); await expect(consent).toBeVisible();
    await expect(consent.getByRole('button', { name: 'Accept terms', exact: true })).toBeDisabled(); await consent.getByRole('button', { name: 'Close', exact: true }).click();
    assert.deepEqual(await page.locator('dl[aria-label="Submission versions"] dd').allTextContents(), ['2', '1', '3']);
    const projects = page.getByRole('heading', { level: 3 }); await expect(projects).toHaveCount(3);
    assert.deepEqual(await projects.allTextContents(), [titles[1], titles[0], titles[2]]);
    const alpha = page.locator('li').filter({ has: page.getByRole('heading', { name: titles[0], exact: true }) });
    await expect(alpha.getByRole('link', { name: 'View Details: ' + titles[0] + ', v1', exact: true })).toHaveAttribute('href', path + '/' + submissionIds[2]);
    const toggles = page.locator('button[aria-controls^="submission-history-"]');
    await expect(toggles).toHaveCount(2); await toggles.nth(0).click();
    await toggles.nth(1).focus(); await page.keyboard.press('Enter'); await expect(toggles.nth(0)).toHaveAttribute('aria-expanded', 'false');
    assert.ok(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none'));
    await page.keyboard.press('Space'); await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'false');
    const search = page.getByRole('searchbox', { name: 'Search submissions' }), filter = page.getByLabel('Status filter');
    for (const query of ['  pRoJeCt   AlPhA ', '  SAME   GROUP ', '  SUBMITTING   student  ']) { await search.fill(query); await expect(projects).toHaveCount(query.toLowerCase().includes('alpha') ? 1 : 3); }
    await search.fill('missing'); await expect(page.getByText('No projects match your search and filters.')).toBeVisible(); await page.getByRole('button', { name: 'Clear filters' }).click();
    await filter.selectOption('pending'); await expect(projects).toHaveCount(2);
    await expect(alpha.getByRole('heading', { name: 'Earlier versions needing review' })).toBeVisible();
    await expect(alpha.getByRole('link', { name: 'View Details: ' + titles[0] + ', v9' })).toHaveAttribute('href', path + '/' + submissionIds[0]);
    await filter.selectOption('reviewed'); await expect(projects).toHaveCount(2);
    await expect(alpha.getByRole('heading', { name: 'Earlier reviewed versions' })).toBeVisible();
    await alpha.getByRole('button', { name: /Show version history/ }).click();
    await search.fill('alpha'); await expect(alpha.getByRole('button', { name: /Hide version history/ })).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(alpha.getByRole('button', { name: /Hide version history/ })).toHaveAttribute('aria-expanded', 'true');
    const historyLinks = alpha.locator('[role="region"] a'); assert.deepEqual(await historyLinks.evaluateAll(links => links.map(link => link.getAttribute('href'))), [path + '/' + submissionIds[1], path + '/' + submissionIds[0]]);
    await historyLinks.first().click(); await expect(page).toHaveURL(origin + path + '/' + submissionIds[1]);
    await expect(page.getByRole('heading', { level: 1, name: titles[0] })).toBeVisible();
    await expect(page.getByText(marker + ' feedback only v2\nLine two.', { exact: true })).toBeVisible(); assert.ok(!(await page.locator('main').textContent()).includes('feedback only v1'));
    await expect(page.getByText('Synthetic Reviewer', { exact: true })).toBeVisible(); await expect(page.getByRole('textbox')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'View / Download PDF' })).toBeVisible();
    // Keep the unchanged private-document action failure path usable; never contact storage.
    let pdfAttempts = 0; await page.route('**/dashboard/adviser/submissions/*', route => { if (route.request().method() === 'POST') { pdfAttempts++; return route.abort(); } return route.continue(); });
    await page.getByRole('button', { name: 'View / Download PDF' }).click(); await expect(page.getByText('The research document could not be accessed.')).toBeVisible(); assert.equal(pdfAttempts, 1); await page.unroute('**/dashboard/adviser/submissions/*');
    for (const width of [1280, 360]) for (const theme of ['Light', 'Dark']) {
        await page.setViewportSize({ width, height: 900 });
        await page.getByRole('button', { name: 'Change theme', exact: true }).click(); await page.getByRole('menuitemradio', { name: theme, exact: true }).click(); await page.waitForTimeout(250);
        await checkLayout(page); await page.screenshot({ path: join(tmpdir(), `phase976c-details-${width}-${theme}.png`), fullPage: true });
        await page.getByRole('link', { name: 'Back to Submissions' }).click(); await expect(page).toHaveURL(origin + path);
        await checkLayout(page);
        await page.locator(`#history-toggle-${paperIds[0]}`).click(); await checkLayout(page);
        await page.screenshot({ path: join(tmpdir(), `phase976c-list-${width}-${theme}.png`), fullPage: true });
        await expect(page.getByText('AI interpretation is disabled. Choose a predefined question for verified static guidance.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'AI Terms & Consent' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Use ThesiSHS AI as an app' })).toBeVisible();
        await navigate(page, '/' + submissionIds[1]);
    }
    await navigate(page, '/' + submissionIds[5]); await expect(page.getByText('No recorded feedback is available for this submission version.')).toBeVisible();
    // Actual unchanged Start Review -> feedback -> final decision on only this run's synthetic versions.
    for (const [index, decision] of [[0, 'Revision Required'], [4, 'Approved']]) {
        await navigate(page, '/' + submissionIds[index]);
        await page.getByRole('button', { name: 'Start Review', exact: true }).click();
        const submit = page.getByRole('button', { name: 'Submit Feedback & Decision', exact: true }); await expect(submit).toBeVisible();
        await page.getByLabel('Feedback Comments', { exact: true }).fill(marker + ' real workflow ' + decision);
        await page.getByLabel('Review Decision', { exact: true }).selectOption(decision);
        await submit.click(); await expect(page.getByText(marker + ' real workflow ' + decision, { exact: true })).toBeVisible();
        await expect(page.getByRole('textbox')).toHaveCount(0); await expect(page.getByText(/The recorded decision is read-only/)).toBeVisible();
        const result = await row(sql`SELECT s.status,p.status paper_status,f.comments FROM submissions s JOIN research_papers p ON p.id=s.paper_id JOIN feedbacks f ON f.submission_id=s.id WHERE s.id=${submissionIds[index]}`);
        assert.equal(result.status, decision); assert.equal(result.paper_status, decision); assert.equal(result.comments, marker + ' real workflow ' + decision);
    }
    const historical = await row(sql`SELECT comments FROM feedbacks WHERE submission_id=${submissionIds[1]}`); assert.equal(historical.comments, marker + ' feedback only v2\nLine two.');
    assert.equal(Number((await row(sql`SELECT count(*) n FROM notifications WHERE user_id=${student.id} AND message LIKE ${'%' + titles[0] + '%'}`)).n), 1);
    assert.equal(Number((await row(sql`SELECT count(*) n FROM activity_logs WHERE user_id=${adviser.id}`)).n), 2);
    await db.execute(sql`UPDATE submissions SET status='Approved' WHERE id=${submissionIds[3]}`);
    await navigate(page); await page.getByLabel('Status filter').selectOption('pending'); await expect(page.getByText('No submissions currently require review.')).toBeVisible();
    const foreignContext = await contextFor(foreign), foreignPage = await foreignContext.newPage(); await navigate(foreignPage); assert.ok(!(await foreignPage.locator('main').textContent()).includes(titles[0]));
    assert.equal((await foreignPage.goto(origin + path + '/' + submissionIds[1])).status(), 404);
    for (const actor of [student, admin, panel, null]) {
        const denied = await contextFor(actor), deniedPage = await denied.newPage(); await navigate(deniedPage);
        await expect(deniedPage).toHaveURL(origin + (actor ? ({ 1: '/dashboard/admin', 3: '/dashboard/student', 4: '/dashboard' }[actor.role_id]) : '/login'));
        assert.equal(await deniedPage.getByRole('heading', { name: 'Research Submissions', exact: true }).count(), 0);
    }
    const emptyContext = await contextFor(empty), emptyPage = await emptyContext.newPage(); await navigate(emptyPage); await emptyPage.getByLabel('Status filter').selectOption('pending'); await expect(emptyPage.getByText(/^No research submissions/)).toBeVisible();
    await db.execute(sql`UPDATE users SET is_active=false WHERE id=${adviser.id}`); await navigate(page); await expect(page.getByText('Workspace unavailable')).toBeVisible();
    await db.execute(sql`UPDATE users SET is_active=true,role_id=3 WHERE id=${adviser.id}`); await navigate(page); await expect(page.getByText('Workspace unavailable')).toBeVisible();
    assert.deepEqual(errors, []);
    console.log('PASS local synthetic SQL ownership/exact feedback; directory/counts/multiple projects/latest timestamp+ID/history/search/filters/exact navigation; completed version feedback+fallback; real review and both decisions; private PDF failure UI; 360/1280 Light/Dark overflow/contrast/focus; AI-disabled/consent/PWA presence; foreign/Student/Admin/Panel/anonymous/inactive/stale denial. Screenshots in OS temp. No storage/provider calls.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    for (const context of contexts) await context.close(); if (browser) await browser.close(); if (server) server.kill();
    if (userIds.length) {
        const users = sql.join(userIds.map(id => sql`${id}`), sql`,`);
        await db.execute(sql`DELETE FROM notifications WHERE user_id IN (${users})`);
        await db.execute(sql`DELETE FROM activity_logs WHERE user_id IN (${users})`);
        if (submissionIds.length) { const ids = sql.join(submissionIds.map(id => sql`${id}`), sql`,`); await db.execute(sql`DELETE FROM feedbacks WHERE submission_id IN (${ids})`); await db.execute(sql`DELETE FROM submissions WHERE id IN (${ids})`); }
        if (paperIds.length) await db.execute(sql`DELETE FROM research_papers WHERE id IN (${sql.join(paperIds.map(id => sql`${id}`), sql`,`)})`);
        if (groupIds.length) { const ids = sql.join(groupIds.map(id => sql`${id}`), sql`,`); await db.execute(sql`DELETE FROM group_members WHERE group_id IN (${ids})`); await db.execute(sql`DELETE FROM research_groups WHERE id IN (${ids})`); }
        await db.execute(sql`DELETE FROM users WHERE id IN (${users})`);
    }
    if (before) assert.deepEqual(await fingerprints(), before, 'All pre-existing rows unchanged and all synthetic data removed');
    console.log('PASS exact fixture cleanup independently fingerprinted across eight affected tables. No existing records changed; local sequences advance normally.');
    process.exit(process.exitCode || 0);
});
