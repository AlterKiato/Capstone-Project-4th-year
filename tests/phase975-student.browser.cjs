/* eslint-disable @typescript-eslint/no-require-imports */
// Only isolated, marked local fixtures are written; no storage object is created.
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
const origin = 'http://127.0.0.1:3037';
const marker = `PHASE975_STUDENT_${Date.now()}`;
let browser, server, student, adviser, group, foreignGroup, projectA, projectB, version1, version2, review;
const errors = [];
async function row(query) { return (await db.execute(query))[0]; }
async function checkContrast(page, root) {
    const failures = await page.locator(root).evaluate(root => {
        const luminance = color => {
            const parts = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
            return parts[0] * .2126 + parts[1] * .7152 + parts[2] * .0722;
        };
        return [...root.querySelectorAll('h1,h2,h3,h4,p,label,button,span,time')].flatMap(el => {
            if (!el.getClientRects().length || el.closest('[hidden]') || el.matches(':disabled') || !el.textContent.trim()) return [];
            const style = getComputedStyle(el); let bg = style.backgroundColor, ancestor = el;
            while (bg === 'rgba(0, 0, 0, 0)' && ancestor.parentElement) { ancestor = ancestor.parentElement; bg = getComputedStyle(ancestor).backgroundColor; }
            const [high, low] = [luminance(style.color), luminance(bg)].sort((a, b) => b - a);
            const required = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
            return (high + .05) / (low + .05) < required ? [el.textContent.slice(0, 70)] : [];
        });
    });
    assert.deepEqual(failures, []);
}
async function main() {
    adviser = await row(sql`INSERT INTO users(first_name,last_name,email,password,role_id) VALUES ('Synthetic','Adviser',${marker + 'a@example.invalid'},'!unusable',2) RETURNING id`);
    student = await row(sql`INSERT INTO users(first_name,last_name,email,password,role_id) VALUES ('Synthetic','Student',${marker + 's@example.invalid'},'!unusable',3) RETURNING id`);
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3037'], { windowsHide: true, stdio: 'ignore' });
    for (let n = 0; n < 120; n++) { try { if ((await fetch(origin)).ok) break; } catch { /* startup */ } await new Promise(resolve => setTimeout(resolve, 250)); }
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/New_York' });
    await context.addCookies([{ name: 'thesishs_session', value: await createToken({ userId: student.id, roleId: 3, email: 'synthetic@example.invalid' }), url: origin, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    // Wait for React's streamed replacement tree to be installed before strict DOM assertions.
    for (const method of ['goto', 'reload']) {
        const navigate = page[method].bind(page);
        page[method] = async (...args) => {
            const response = await navigate(...args);
            await page.waitForFunction(() => !document.querySelector('[hidden][id^="S:"]'));
            return response;
        };
    }
    await page.goto(origin + '/dashboard/student');
    await expect(page.getByRole('heading', { name: 'No Research Group Assigned' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Latest Feedback', exact: true })).toHaveCount(0);
    group = await row(sql`INSERT INTO research_groups(group_name,strand,section,school_year,adviser_id) VALUES (${marker},'STEM','Synthetic','2026-2027',${adviser.id}) RETURNING id`);
    await db.execute(sql`INSERT INTO group_members(group_id,user_id) VALUES (${group.id},${student.id})`);
    await page.reload(); await expect(page.getByText('No research project yet', { exact: true })).toBeVisible();
    await expect(page.getByText('No adviser feedback yet.', { exact: true })).toBeVisible();
    const members = page.getByRole('button', { name: '1 Group Members' });
    await members.click(); await expect(members).toHaveAttribute('aria-expanded', 'true'); await expect(page.getByText('Synthetic Student', { exact: true })).toBeVisible(); await members.click();
    projectA = await row(sql`INSERT INTO research_papers(group_id,title,abstract,category,keywords,created_at) VALUES (${group.id},${marker + ' A'},'Abstract A','Category A','Keywords A','2026-01-01') RETURNING id`);
    projectB = await row(sql`INSERT INTO research_papers(group_id,title,abstract,category,keywords,created_at) VALUES (${group.id},${marker + ' B'},'Abstract B','Category B','Keywords B','2026-02-01') RETURNING id`);
    await page.reload(); await expect(page.getByText('Not yet submitted', { exact: true })).toHaveCount(1); await expect(page.getByText('Not yet submitted', { exact: true })).toBeVisible();
    version1 = await row(sql`INSERT INTO submissions(paper_id,submitted_by,version,file_url,status,remarks,submitted_at) VALUES (${projectA.id},${student.id},'v1',${'research/' + projectA.id + '/v1/synthetic.pdf'},'Revision Required','A old remarks','2026-03-01') RETURNING id`);
    version2 = await row(sql`INSERT INTO submissions(paper_id,submitted_by,version,file_url,status,remarks,submitted_at) VALUES (${projectA.id},${student.id},'v2',${'research/' + projectA.id + '/v2/synthetic.pdf'},'Submitted','A latest remarks','2026-04-01') RETURNING id`);
    review = await row(sql`INSERT INTO feedbacks(submission_id,teacher_id,comments,decision) VALUES (${version1.id},${adviser.id},${'Synthetic review. '.repeat(50)},'Revision Required') RETURNING id`);
    await page.reload(); await expect(page.getByText('Submitted', { exact: true })).toHaveCount(1); await expect(page.getByText('Submitted', { exact: true })).toBeVisible();
    assert.ok((await page.locator('main').textContent()).includes(marker + ' A'));
    assert.equal(await page.locator('main').getByRole('link', { name: 'My Research & Submissions', exact: true }).count(), 0);
    assert.equal(await page.locator('header a').count(), 0);
    const excerpt = page.locator('p').filter({ hasText: /^Synthetic review/ });
    assert.equal(await excerpt.evaluate(el => getComputedStyle(el).webkitLineClamp), '3');
    await page.getByRole('link', { name: 'View Full Feedback' }).click();
    const select = page.getByLabel('Research project', { exact: true });
    await expect(select).toHaveValue(String(projectA.id));
    await expect(page.locator(`#version-${version1.id}`)).toBeVisible();
    await expect(page.locator(`#feedback-${review.id}`)).toBeFocused();
    await page.screenshot({ path: join(tmpdir(), 'phase975-student-target.png'), fullPage: true });
    await expect(page.locator(`#version-${version2.id}`)).toBeHidden();
    await page.getByRole('button', { name: 'View Details', exact: true }).click(); await expect(page.getByText('Abstract A', { exact: true })).toBeVisible();
    await select.selectOption(String(projectB.id)); await expect(page.getByRole('heading', { name: marker + ' B', exact: true })).toBeVisible();
    await expect(page.getByText('A old remarks')).toHaveCount(0); await expect(page.locator(`#feedback-${review.id}`)).toHaveCount(0);
    await page.getByRole('button', { name: 'Submit PDF', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Submit Research PDF', exact: true });
    await expect(dialog.locator('input[name=paperId]')).toHaveValue(String(projectB.id));
    await expect(select).toBeDisabled();
    await dialog.getByLabel('Remarks (optional)').fill('Preserve these remarks');
    await dialog.getByLabel('Research PDF', { exact: true }).setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') });
    let releaseUpload;
    const uploadGate = new Promise(resolve => { releaseUpload = resolve; });
    let uploadRequests = 0;
    await page.route('**/dashboard/student/submissions**', async route => {
        if (route.request().method() === 'POST') { uploadRequests++; await uploadGate; }
        await route.continue();
    });
    await dialog.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await expect(dialog.locator('form')).toHaveAttribute('aria-busy', 'true');
    await expect(dialog.getByRole('button', { name: 'Close Submit Research PDF' })).toBeDisabled();
    await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
    releaseUpload();
    await expect(dialog.getByRole('status')).toContainText('could not be completed');
    assert.equal(uploadRequests, 1); await page.unroute('**/dashboard/student/submissions**');
    await dialog.getByLabel('Research PDF', { exact: true }).setInputFiles({ name: 'oversized.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
    await dialog.getByRole('button', { name: 'Submit Research PDF', exact: true }).click();
    await expect(dialog.locator('form')).toHaveAttribute('aria-busy', 'false');
    await expect(dialog.getByRole('status')).toContainText('could not be completed');
    await expect(dialog.getByLabel('Remarks (optional)')).toHaveValue('Preserve these remarks');
    assert.equal(await dialog.locator('input[type=file]').evaluate(el => el.files.length), 1);
    page.once('dialog', event => event.dismiss()); await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
    page.once('dialog', event => event.accept()); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Submit PDF', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Create Project', exact: true }).click();
    dialog = page.getByRole('dialog', { name: 'Create Research Project', exact: true });
    await dialog.getByRole('button', { name: 'Create Research Project', exact: true }).click(); await expect(dialog).toBeVisible();
    await dialog.getByLabel('Research Title').fill(marker + ' Created'); await dialog.getByLabel('Abstract', { exact: true }).fill('Created synthetic abstract');
    await dialog.getByRole('button', { name: 'Create Research Project', exact: true }).click(); await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: marker + ' Created', exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('status').filter({ hasText: 'Research project created successfully.' })).toBeVisible();
    await expect(select.locator('option')).toHaveCount(3);
    foreignGroup = await row(sql`INSERT INTO research_groups(group_name,strand,section,school_year,adviser_id) VALUES (${marker + ' Foreign'},'STEM','Synthetic','2026-2027',${adviser.id}) RETURNING id`);
    const foreignProject = await row(sql`INSERT INTO research_papers(group_id,title,abstract) VALUES (${foreignGroup.id},${marker + ' FOREIGN PRIVATE'},'Foreign abstract') RETURNING id`);
    const foreignSubmission = await row(sql`INSERT INTO submissions(paper_id,submitted_by,version,file_url) VALUES (${foreignProject.id},${student.id},'v1',${'research/' + foreignProject.id + '/v1/foreign.pdf'}) RETURNING id`);
    const foreignFeedback = await row(sql`INSERT INTO feedbacks(submission_id,teacher_id,comments) VALUES (${foreignSubmission.id},${adviser.id},'FOREIGN PRIVATE REVIEW') RETURNING id`);
    await page.goto(`${origin}/dashboard/student/submissions?project=${foreignProject.id}&submission=${foreignSubmission.id}&feedback=${foreignFeedback.id}`);
    await expect(page.getByRole('heading', { name: marker + ' Created', exact: true })).toBeVisible();
    assert.ok(!(await page.content()).includes('FOREIGN PRIVATE'));
    await page.goto(origin + '/dashboard/student/submissions?project=999999999&submission=' + version1.id + '&feedback=' + review.id);
    await expect(page.locator(`#feedback-${review.id}`)).toHaveCount(0);
    await page.goto(origin + '/dashboard/student/submissions?project=' + projectA.id);
    await expect(page.locator(`#version-${version2.id}`)).toHaveCount(1);
    await expect(page.locator(`#version-${version2.id}`)).toBeVisible();
    const rowButton = page.locator(`button[aria-controls="version-${version2.id}"]`);
    await rowButton.click(); await expect(page.locator(`#version-${version2.id}`)).toBeHidden();
    await page.getByRole('button', { name: 'View Details', exact: true }).click(); await expect(page.locator(`#version-${version2.id}`)).toBeHidden();
    for (const width of [1280, 360]) for (const theme of ['Light', 'Dark']) {
        await page.setViewportSize({ width, height: 900 });
        await page.getByRole('button', { name: 'Change theme', exact: true }).click();
        await page.getByRole('menuitemradio', { name: theme, exact: true }).click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme.toLowerCase());
        await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState === 'finished'));
        assert.ok(await page.locator('main.dashboard-page h1').evaluate(el => {
            const canvas = document.createElement('canvas'); const context = canvas.getContext('2d');
            context.font = getComputedStyle(el).font;
            return el.textContent.split(/\s+/).every(word => context.measureText(word).width <= el.clientWidth);
        }));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await checkContrast(page, 'main.dashboard-page');
        await page.screenshot({ path: join(tmpdir(), `phase975-student-${width}-${theme}.png`), fullPage: true });
        await page.getByRole('button', { name: 'Create Project', exact: true }).click();
        const modal = page.getByRole('dialog', { name: 'Create Research Project', exact: true });
        await checkContrast(page, 'dialog[open]');
        assert.ok(await modal.evaluate(el => el.scrollHeight >= el.clientHeight && el.getBoundingClientRect().right <= innerWidth));
        await page.screenshot({ path: join(tmpdir(), `phase975-student-modal-${width}-${theme}.png`), fullPage: true });
        await page.keyboard.press('Shift+Tab'); assert.ok(await modal.evaluate(el => el.contains(document.activeElement)));
        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: 'Create Project', exact: true })).toBeFocused();
        await page.getByRole('button', { name: 'Create Project', exact: true }).click();
        await modal.getByRole('button', { name: 'Close Create Research Project', exact: true }).click();
        await expect(modal).toHaveCount(0);
        if (width === 360) {
            await page.setViewportSize({ width, height: 640 });
            await page.getByRole('button', { name: 'Create Project', exact: true }).click();
            assert.ok(await modal.evaluate(el => el.scrollHeight > el.clientHeight));
            await page.keyboard.press('Shift+Tab');
            assert.ok(await modal.evaluate(el => el.scrollTop > 0 && el.contains(document.activeElement)));
            await page.keyboard.press('Escape'); await page.setViewportSize({ width, height: 900 });
        }
        await page.getByRole('button', { name: 'Create Project', exact: true }).click();
        await page.mouse.click(1, 1); await expect(modal).toHaveCount(0);
        await page.getByRole('button', { name: 'Notifications', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Notifications', exact: true })).toBeVisible(); await page.keyboard.press('Escape');
    }
    for (const width of [1280, 360]) for (const theme of ['Light', 'Dark']) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(origin + '/dashboard/student');
        await expect(page.getByRole('heading', { name: 'Research Group', exact: true })).toHaveCount(1);
        await page.getByRole('button', { name: 'Change theme', exact: true }).click();
        await page.getByRole('menuitemradio', { name: theme, exact: true }).click();
        await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState === 'finished'));
        await page.getByRole('button', { name: '1 Group Members' }).click();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const cards = page.locator('main.dashboard-page section.dashboard-panel');
        const a = await cards.nth(0).boundingBox(), b = await cards.nth(1).boundingBox();
        assert.ok(width === 1280 ? Math.abs(a.y - b.y) < 2 && b.x > a.x : b.y > a.y && Math.abs(a.x - b.x) < 2);
        await checkContrast(page, 'main.dashboard-page');
        await page.screenshot({ path: join(tmpdir(), `phase975-student-overview-${width}-${theme}.png`), fullPage: true });
    }
    const anon = await browser.newPage(); await anon.goto(origin + '/dashboard/student/submissions'); await expect(anon).toHaveURL(/\/login/); await anon.close();
    await db.execute(sql`UPDATE users SET is_active=false WHERE id=${student.id}`);
    await page.reload(); await expect(page.getByRole('heading', { name: 'Workspace unavailable' })).toBeVisible();
    assert.deepEqual(errors, []);
    console.log('PASS focused Student Chromium: no-group/no-project/no-submission states, actual members, latest submission across projects, older-feedback deep-link/focus, project isolation, modal validation/data retention/unsaved guards, creation with existing projects, newest/collapse-all, 360/1280 Light/Dark containment, focus trap, bell coexistence, anonymous/inactive denial. No storage writes.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    await browser?.close(); server?.kill();
    for (const fixtureGroup of [group, foreignGroup]) if (fixtureGroup) {
        await db.execute(sql`DELETE FROM feedbacks WHERE submission_id IN (SELECT id FROM submissions WHERE paper_id IN (SELECT id FROM research_papers WHERE group_id=${fixtureGroup.id}))`);
        await db.execute(sql`DELETE FROM submissions WHERE paper_id IN (SELECT id FROM research_papers WHERE group_id=${fixtureGroup.id})`);
        await db.execute(sql`DELETE FROM research_papers WHERE group_id=${fixtureGroup.id}`);
        await db.execute(sql`DELETE FROM group_members WHERE group_id=${fixtureGroup.id}`);
        await db.execute(sql`DELETE FROM research_groups WHERE id=${fixtureGroup.id}`);
    }
    for (const user of [student, adviser]) if (user) await db.execute(sql`DELETE FROM users WHERE id=${user.id}`);
    const remaining = await row(sql`SELECT count(*)::int AS n FROM users WHERE email LIKE ${marker + '%'}`); assert.equal(remaining.n, 0);
    console.log('Synthetic fixtures removed; no pre-existing records changed. Sequence advancement is expected.');
    process.exit(process.exitCode || 0);
});
