/* eslint-disable @typescript-eslint/no-require-imports */
// Existing local synthetic accounts, read-only data, no research/storage mutations.
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
const originalLoad = Module._load;
Module._load = function(id, ...args) { return id === 'server-only' ? {} : originalLoad.call(this, id, ...args); };
const { db } = require('../lib/db.ts');
const { sql } = require('drizzle-orm');
const { createToken } = require('../lib/auth/jwt.ts');
const { chromium, expect } = require('@playwright/test');
// Render the real feedback component without a route or database mutation.
Module._load = function(id, ...args) {
    if (id === 'next/navigation') return { useRouter: () => ({ refresh() {} }) };
    if (id === '@/lib/actions/adviser-feedback.action') return { createAdviserFeedbackAction: async () => { throw new Error('No action in static render'); } };
    return id === 'server-only' ? {} : originalLoad.call(this, id, ...args);
};
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const FeedbackForm = require('../app/dashboard/adviser/submissions/FeedbackForm.tsx').default;
Module._load = function(id, ...args) { return id === 'server-only' ? {} : originalLoad.call(this, id, ...args); };
const origin = 'http://127.0.0.1:3021';
let browser;
const captureScreenshots = !process.argv.includes('--no-screenshots');
async function main(lifecycle) {
    const actors = await db.execute(sql`SELECT id, role_id FROM users WHERE is_active = true
        AND (email ILIKE '%test%' OR email ILIKE '%phase%') ORDER BY id`);
    const records = await db.execute(sql`SELECT s.id, s.submitted_by, s.paper_id, p.group_id, s.version, s.status, p.title, g.adviser_id
        FROM submissions s JOIN research_papers p ON p.id=s.paper_id JOIN research_groups g ON g.id=p.group_id
        JOIN users u ON u.id=s.submitted_by JOIN users a ON a.id=g.adviser_id
        WHERE u.is_active=true AND a.is_active=true
        AND (p.title LIKE 'SPRINT%' OR p.title LIKE 'PHASE%')
        AND (u.email ILIKE '%test%' OR u.email ILIKE '%phase%')
        AND (a.email ILIKE '%test%' OR a.email ILIKE '%phase%') ORDER BY s.submitted_at DESC`);
    const memberships = await db.execute(sql`SELECT group_id,user_id FROM group_members`);
    const student = actors.find(a => a.role_id === 3 && records.some(s => s.submitted_by === a.id && memberships.some(m => m.user_id === a.id && m.group_id === s.group_id)))
        ?? actors.find(a => a.role_id === 3 && memberships.some(m => m.user_id === a.id));
    const owned = records.filter(s => s.submitted_by === student?.id && memberships.some(m => m.user_id === student?.id && m.group_id === s.group_id));
    const adviser = actors.find(a => a.role_id === 2 && records.some(s => s.adviser_id === a.id));
    assert.ok(student && adviser, 'Existing synthetic Student membership and Adviser history required');
    const foreign = actors.find(a => a.role_id === 2 && a.id !== adviser.id);
    const detailRecords = records.filter(s => actors.some(a => a.id === s.adviser_id && a.role_id === 2))
        .filter((s,i,a) => a.findIndex(x => x.status === s.status) === i);
    const feedback = await db.execute(sql`SELECT f.id, f.submission_id, f.decision, f.comments FROM feedbacks f
        JOIN submissions s ON s.id=f.submission_id WHERE s.submitted_by=${student.id} ORDER BY f.id`);
    const adviserFeedback = await db.execute(sql`SELECT f.submission_id,f.decision,f.comments FROM feedbacks f
        JOIN submissions s ON s.id=f.submission_id JOIN research_papers p ON p.id=s.paper_id
        WHERE p.title LIKE 'SPRINT%' OR p.title LIKE 'PHASE%' ORDER BY f.id`);
    const feedbackBefore = await db.execute(sql`SELECT id, md5(comments) AS digest FROM feedbacks ORDER BY id`);
    const before = await db.execute(sql`SELECT id, status, version FROM submissions ORDER BY id`);
    console.log('Preflight: existing synthetic accounts; available detail statuses: ' + detailRecords.map(s => s.status).join(', '));
    if (process.argv.includes('--probe')) return;
    await lifecycle.startServer(3021);
    browser = await lifecycle.launchBrowser(chromium);
    const errors = [];
    for (const width of [360, 1280]) {
        const context = await browser.newContext({ viewport: { width, height: 900 } });
        let blockedDocument = false;
        let abortedDocumentRequests = 0;
        let expectedNotFound = false;
        await context.route('**/*', route => {
            if (new URL(route.request().url()).origin !== origin) { errors.push('external request'); return route.abort(); }
            if (blockedDocument && route.request().method() === 'POST') { abortedDocumentRequests++; return route.abort(); }
            return route.continue();
        });
        const page = await context.newPage();
        page.on('dialog', dialog => dialog.accept());
        page.on('pageerror', () => errors.push('page error'));
        page.on('console', m => {
            if (m.type() !== 'error') return;
            if (blockedDocument && m.text().includes('net::ERR_FAILED')) return;
            if (expectedNotFound && m.text().includes('404')) return;
            errors.push('unexpected console error');
        });
        page.on('response', r => { if (r.status() >= 500) errors.push('HTTP 5xx'); });
        async function signIn(actor) {
            const token = await createToken({ userId: actor.id, roleId: actor.role_id, email: 'phase93-synthetic@example.invalid' });
            await context.addCookies([{ name: 'thesishs_session', value: token, url: origin, httpOnly: true, sameSite: 'Lax' }]);
        }
        async function layout() {
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow');
            await page.keyboard.press('Tab');
            assert.ok(await page.evaluate(() => document.activeElement.matches(':focus-visible') && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 3), 'Visible focus');
        }
        await signIn(student);
        await page.goto(origin+'/dashboard/student/submissions');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Research Submissions');
        const projects = page.getByLabel('Research project', { exact: true });
        if (!owned.length) console.log('LIMIT: no marked historical submissions belong to a current synthetic Student member; Student version/feedback history is not live-certified.');
        if (await projects.count()) {
        await expect(projects).toBeVisible();
        for (const record of owned) {
            await projects.selectOption(String(record.paper_id));
            const body = page.locator('#version-' + record.id);
            const article = body.locator('..');
            if (!await body.isVisible()) await article.locator('h3 button').click();
            await expect(body).toBeVisible();
            await expect(article.locator('h3 button')).toContainText(String(record.version));
            await expect(article.locator('h3 button')).toContainText(record.status);
            for (const item of feedback.filter(f => f.submission_id === record.id)) {
                await expect(article.getByText('Decision: '+item.decision, { exact: true })).toBeVisible();
                await expect(article.getByText(item.comments, { exact: true })).toBeVisible();
            }
        }
        await layout();
        if (captureScreenshots) await page.screenshot({ path: join(tmpdir(), 'phase93-student-'+width+'.png') });
        const revisionArticle = page.locator('[id^="version-"]').filter({ hasText: 'Decision: Revision Required' }).first();
        if (captureScreenshots && await revisionArticle.count()) await revisionArticle.screenshot({ path: join(tmpdir(), 'phase93-history-feedback-'+width+'.png') });
        // Invalid paper ID reaches only action validation, never the upload service.
        await page.getByRole('button', { name: 'Create Project', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Create Research Project', exact: true }).getByLabel('Research Title')).toHaveAttribute('required', '');
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Submit PDF', exact: true }).click();
        const upload = page.getByRole('dialog', { name: 'Submit Research PDF', exact: true });
        await expect(upload.getByLabel('Research PDF', { exact: true })).toHaveAttribute('accept', 'application/pdf,.pdf');
        await expect(upload.getByText('PDF files only. Maximum file size: 10 MB.', { exact: true })).toBeVisible();
        if (captureScreenshots) await upload.screenshot({ path: join(tmpdir(), 'phase93-upload-'+width+'.png') });
        await page.getByLabel('Research PDF', { exact: true }).setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF synthetic validation only') });
        // Alter only this request's hidden ID; validation fails before any service/upload.
        await upload.locator('input[name="paperId"]').evaluate(input => { input.value = '0'; });
        await page.route('**/dashboard/student/submissions', async route => {
            if (route.request().method() === 'POST') await new Promise(resolve => setTimeout(resolve, 400));
            await route.fallback();
        });
        await page.getByRole('button', { name: 'Submit Research PDF', exact: true }).click();
        await expect(upload.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
        await expect(upload.getByRole('status')).toHaveText('Select a research project and keep remarks within 500 characters.');
        if (captureScreenshots) await upload.screenshot({ path: join(tmpdir(), 'phase93-upload-error-'+width+'.png') });
        await upload.getByRole('button', { name: 'Close Submit Research PDF', exact: true }).click();
        // Transport failure only: no signer, storage access or private PDF request occurs.
        const studentDocument = page.getByRole('button', { name: 'View / Download PDF', exact: true });
        if (await studentDocument.count()) {
            blockedDocument = true;
            await studentDocument.first().click();
            await expect(page.getByText('The research document could not be accessed.', { exact: true })).toBeVisible();
            assert.equal(abortedDocumentRequests, 1, 'Document error request aborted before signer');
            blockedDocument = false;
        }
        await (await navigation(page)).getByRole('link', { name: 'Dashboard', exact: true }).click();
        await expect(page).toHaveURL(origin+'/dashboard/student');
        } else {
            console.log('LIMIT: selected existing Student has no project; live upload-modal assertions skipped, existing Student adapter/unit coverage retained.');
            await layout();
        }
        await signIn(adviser);
        await page.goto(origin+'/dashboard/adviser/submissions');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Research Submissions');
        await expect(page.getByLabel('Search submissions')).toBeVisible();
        await expect(page.getByLabel('Status filter')).toHaveValue('all');
        await layout();
        if (captureScreenshots) await page.screenshot({ path: join(tmpdir(), 'phase93-adviser-list-'+width+'.png') });
        const rightmostLink = page.locator('main a[href*="/submissions/"]:visible').last();
        await rightmostLink.scrollIntoViewIfNeeded();
        const rightBounds = await rightmostLink.boundingBox();
        assert.ok(rightBounds.x >= 0 && rightBounds.x+rightBounds.width <= width, 'Directory action reachable');
        const stylesheets = await page.locator('link[rel="stylesheet"]').evaluateAll(links => links.map(link => link.getAttribute('href')));
        let styles = '';
        for (const href of stylesheets) {
            assert.ok(href.startsWith('/_next/'));
            styles += await (await page.request.get(origin+href)).text();
        }
        const harness = await context.newPage();
        await harness.setContent('<style>'+styles+'</style><main class="dashboard-page research-workspace"><section class="dashboard-panel"><h1>Feedback form component check</h1>'+renderToStaticMarkup(React.createElement(FeedbackForm, { submissionId: 1 }))+'</section></main>');
        await expect(harness.getByLabel('Feedback Comments')).toHaveAttribute('required', '');
        await expect(harness.getByLabel('Review Decision').locator('option')).toHaveText(['Revision Required','Approved']);
        await harness.getByLabel('Review Decision').selectOption('Approved');
        await expect(harness.getByLabel('Review Decision')).toHaveValue('Approved');
        await harness.getByLabel('Feedback Comments').focus();
        await harness.keyboard.press('Tab');
        assert.ok(await harness.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await expect(harness.getByRole('button', { name: 'Submit Feedback & Decision' })).toBeVisible();
        if (captureScreenshots) await harness.screenshot({ path: join(tmpdir(), 'phase93-feedback-component-'+width+'.png'), fullPage: true });
        await harness.close();
        for (const record of detailRecords) {
            await signIn(actors.find(a => a.id === record.adviser_id));
            await page.goto(origin+'/dashboard/adviser/submissions');
            const toggle = page.locator('#history-toggle-' + record.paper_id);
            if (await toggle.count()) await toggle.click();
            await page.locator('a[href="/dashboard/adviser/submissions/'+record.id+'"]').first().click();
            await expect(page).toHaveURL(origin+'/dashboard/adviser/submissions/'+record.id);
            await expect(page.getByRole('heading', { level: 1 })).toHaveText(record.title);
            await expect(page.locator('main').getByText(record.status, { exact: true }).first()).toBeVisible();
            const review = page.getByRole('region', { name: 'Adviser Review', exact: true });
            for (const item of adviserFeedback.filter(item => item.submission_id === record.id)) {
                await expect(review.getByText(item.comments, { exact: true })).toBeVisible();
                await expect(review.getByText(item.decision, { exact: true })).toBeVisible();
            }
            await expect(page.getByRole('button', { name: 'View / Download PDF', exact: true })).toBeVisible();
            if (!abortedDocumentRequests) {
                blockedDocument = true;
                await page.getByRole('button', { name: 'View / Download PDF', exact: true }).click();
                await expect(page.getByText('The research document could not be accessed.', { exact: true })).toBeVisible();
                assert.equal(abortedDocumentRequests, 1, 'Document error request aborted before signer');
                blockedDocument = false;
            }
            await expect(page.getByRole('button', { name: 'Start Review', exact: true })).toHaveCount(record.status === 'Submitted' ? 1 : 0);
            await expect(page.locator('#comments')).toHaveCount(record.status === 'Under Review' ? 1 : 0);
            if (record.status === 'Under Review') {
                await expect(page.getByLabel('Review Decision').locator('option')).toHaveText(['Revision Required','Approved']);
                await page.getByLabel('Feedback Comments').fill(' ');
                await page.getByRole('button', { name: 'Submit Feedback & Decision', exact: true }).click();
                await expect(page.locator('#feedback-message')).toHaveText('Feedback comments are required.');
            }
            await layout();
            if (captureScreenshots) await page.screenshot({ path: join(tmpdir(), 'phase93-detail-'+record.status.replaceAll(' ','-')+'-'+width+'.png'), fullPage: true });
            await page.getByRole('link', { name: 'Back to Submissions', exact: true }).click();
            await expect(page).toHaveURL(origin+'/dashboard/adviser/submissions');
        }
        if (foreign) {
            expectedNotFound = true;
            await signIn(foreign);
            const foreignRecord = records.find(record => record.adviser_id === adviser.id);
            const response = await page.goto(origin+'/dashboard/adviser/submissions/'+foreignRecord.id);
            assert.equal(response.status(), 404, 'Cross-Adviser detail denied');
            await expect(page.getByText(foreignRecord.title, { exact: true })).toHaveCount(0);
            expectedNotFound = false;
        }
        await context.clearCookies();
        await page.goto(origin+'/dashboard/student/submissions');
        await expect(page).toHaveURL(origin+'/login');
        await context.close();
    }
    assert.deepEqual(await db.execute(sql`SELECT id, status, version FROM submissions ORDER BY id`), before, 'Submission state unchanged');
    assert.deepEqual(await db.execute(sql`SELECT id, md5(comments) AS digest FROM feedbacks ORDER BY id`), feedbackBefore, 'Feedback unchanged');
    assert.deepEqual(errors, []);
    console.log('PASS: current Student controls/invalid-input modal where available; marked Student history cases='+owned.length+'; Adviser directory/details/version-specific recorded feedback, pre-signer transport failure, 360/1280 layout/focus, anonymous/foreign denial and unchanged submission/feedback snapshots.');
    console.log('PASS: isolated real feedback component labels, required fields, both decisions and mobile/desktop layout; router/action stubbed only in static rendering.');
    console.log('LIMIT: no upload/review/approval mutations or real signed PDF fetch; live Under Review controls covered only when existing records are available.');
}
runBrowserAcceptance(main, { client: db.$client, label: 'Phase 9.6 submissions', timeoutMs: 180000 });
