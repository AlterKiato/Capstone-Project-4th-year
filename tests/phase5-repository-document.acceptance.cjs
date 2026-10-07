/* eslint-disable @typescript-eslint/no-require-imports */
// Run manually against the explicitly approved development environment:
// $env:PHASE5_ACCEPTANCE_CONFIRMED='1'; node --import tsx tests/phase5-repository-document.acceptance.cjs
// No environment configuration is changed. All fixtures are synthetic and removed in finally.
const assert = require('node:assert/strict');
const Module = require('node:module');
const { randomUUID } = require('node:crypto');
require('dotenv/config');

// Next handles this marker at build time. Allow server modules in this Node-only acceptance runner.
const originalLoad = Module._load;
Module._load = function (id, ...args) {
    if (id === 'server-only') return {};
    return originalLoad.call(this, id, ...args);
};
const { db } = require('../lib/db.ts');
const schema = require('../db/schema/index.ts');
const { eq, inArray } = require('drizzle-orm');
const { chromium } = require('@playwright/test');
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');
const { createSubmissionDocumentUrl } = require('../lib/services/submission-document.service.ts');
const { submitResearch } = require('../lib/services/submission.service.ts');
const { startSubmissionReview } = require('../lib/services/adviser-review.service.ts');
const { createAdviserFeedback } = require('../lib/services/adviser-feedback.service.ts');
const { repositories, users, researchGroups, researchPapers, groupMembers, submissions, feedbacks, notifications, activityLogs } = schema;
const base = 'http://localhost:3000';
// Optional practical final pass; the default remains the full Phase 5.5 acceptance.
const finalVerification = process.env.PHASE5_FINAL_VERIFICATION === '1';
const marker = (finalVerification ? 'PHASE56_' : 'PHASE55_') + randomUUID();
const password = randomUUID();
const ids = { users: [], groups: [], papers: [], submissions: [] };
const paths = new Set();
let browser;
let supabase;
function passed(label) { console.log('PASS ' + label); }
function pdfFile(label = "synthetic") {
    const pdf = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 /Kids [] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n';
    return new File([pdf + '%' + label + '\n'], 'synthetic.pdf', { type: 'application/pdf' });
}
async function login(user, route) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(base + '/login');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await page.waitForURL(base + '/dashboard');
    await page.goto(base + route);
    return { context, page };
}
const { publishResearch, changeResearchPublication } = require('../lib/services/repository-publication.service.ts');
const { getPublishedResearchDetails } = require('../lib/services/repository.service.ts');
const { createPublishedResearchDocumentUrl } = require('../lib/services/repository-document.service.ts');
async function main() {
    assert.equal(process.env.PHASE5_ACCEPTANCE_CONFIRMED, '1');
    const target = new URL(process.env.DATABASE_URL);
    assert.equal(target.hostname, 'localhost'); assert.equal(target.pathname, '/thesishs_ai');
    assert.equal(new URL(process.env.SUPABASE_URL).hostname, 'cbkplqkkjuoglpimwmib.supabase.co');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
    const bucket = await supabase.storage.getBucket('research-submissions'); assert.ifError(bucket.error); assert.equal(bucket.data.public, false);
    const actors = [], hash = await bcrypt.hash(password, 10);
    for (const roleId of [3, 3, 2, 2, 1, 4, 1]) {
        const [user] = await db.insert(users).values({ firstName: 'Synthetic', lastName: marker, email: (marker + '-' + actors.length + '@example.invalid').toLowerCase(), password: hash, roleId }).returning();
        actors.push(user); ids.users.push(user.id);
    }
    const [student, outsider, adviser, otherAdviser, admin, panel, secondAdmin] = actors;
    for (const [index, owner] of [adviser, otherAdviser].entries()) {
        const [group] = await db.insert(researchGroups).values({ groupName: marker + index, strand: 'TEST', section: 'TEST', schoolYear: '2026-2027', adviserId: owner.id }).returning(); ids.groups.push(group.id);
        await db.insert(groupMembers).values({ groupId: group.id, userId: index === 0 ? student.id : outsider.id });
    }
    async function paper() {
        const [record] = await db.insert(researchPapers).values({ groupId: ids.groups[0], title: marker + '-' + ids.papers.length, abstract: 'Synthetic repository document acceptance.', status: 'Draft' }).returning(); ids.papers.push(record.id); return record;
    }
    const research = await paper();
    const first = await submitResearch(research.id, student.id, pdfFile('revision-v1'), marker); assert.equal(first.success, true); ids.submissions.push(first.data.id); paths.add(first.data.fileUrl);
    if (finalVerification) assert.equal((await startSubmissionReview(first.data.id, otherAdviser.id)).success, false);
    assert.equal((await startSubmissionReview(first.data.id, adviser.id)).success, true);
    assert.equal((await createAdviserFeedback(first.data.id, adviser.id, marker, 'Revision Required')).success, true);
    const approved = await submitResearch(research.id, student.id, pdfFile('approved-v2'), marker); assert.equal(approved.success, true); ids.submissions.push(approved.data.id); paths.add(approved.data.fileUrl);
    assert.equal((await startSubmissionReview(approved.data.id, adviser.id)).success, true);
    assert.equal((await createAdviserFeedback(approved.data.id, adviser.id, marker, 'Approved')).success, true);
    if (finalVerification) {
        assert.equal(approved.data.version, 'v2');
        assert.equal((await submitResearch(research.id, student.id, pdfFile('blocked-v3'), marker)).success, false);
        for (const actor of [student, adviser, panel]) assert.equal((await publishResearch(research.id, actor.id)).success, false);
    }
    const race = finalVerification ? [await publishResearch(research.id, admin.id)] :
        await Promise.all([publishResearch(research.id, admin.id), publishResearch(research.id, secondAdmin.id)]);
    assert.equal(race.filter(r => r.success).length, 1);
    assert.equal((await publishResearch(research.id, admin.id)).success, false);
    assert.equal((await db.select().from(repositories).where(eq(repositories.paperId, research.id))).length, 1);
    if (!finalVerification) await assert.rejects(db.insert(repositories).values({ paperId: research.id, isPublished: true }));
    passed(finalVerification ? 'Admin-only publication, duplicate prevention, foreign Adviser denial, revision v2 and approved resubmission block' : '18 duplicate/concurrent publication and unique constraint intact');
    const saved = (await db.select().from(repositories).where(eq(repositories.paperId, research.id)))[0];
    const history = await db.select().from(submissions).where(eq(submissions.paperId, research.id)).orderBy(submissions.id);
    const feedbackHistory = await db.select().from(feedbacks).where(inArray(feedbacks.submissionId, ids.submissions)).orderBy(feedbacks.id);
    const expected = Buffer.from(await pdfFile('approved-v2').arrayBuffer());
    const resolved = await getPublishedResearchDetails(research.id);
    assert.equal(resolved.submissionId, approved.data.id); assert.equal(resolved.version, 'v2'); assert.equal(resolved.fileUrl, approved.data.fileUrl);
    for (const actor of (finalVerification ? [student, outsider] : [student, adviser, admin, panel, outsider, otherAdviser])) {
        const result = await createPublishedResearchDocumentUrl(research.id, 'view', actor.id);
        assert.equal(result.success, true);
        const response = await fetch(result.url); assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /^application\/pdf/);
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
        const claims = JSON.parse(Buffer.from(new URL(result.url).searchParams.get('token').split('.')[1], 'base64url'));
        assert.equal(claims.exp - claims.iat, 300, 'Verify issuer lifetime independently of workstation clock skew');
    }
    passed(finalVerification ? 'Student and foreign-group repository PDF HTTP 200 application/pdf, exact v2 bytes and 300-second lifetime' : '1-4,9-12 all four roles plus foreign-group users retrieve exact approved v2 PDF HTTP 200 application/pdf; token lifetime approximately 300 seconds');
    assert.ok(await createSubmissionDocumentUrl(approved.data.id, student.id)); assert.ok(await createSubmissionDocumentUrl(approved.data.id, adviser.id));
    for (const actor of [admin, panel, outsider, otherAdviser]) assert.equal(await createSubmissionDocumentUrl(approved.data.id, actor.id), null);
    passed('17 Phase 5.3 submitted-document permissions remain isolated');
    async function denied(paperId = research.id, userId = student.id, mode = 'view') {
        const result = await createPublishedResearchDocumentUrl(paperId, mode, userId);
        assert.equal(result.success, false); assert.equal(result.url, null);
        assert.equal(JSON.stringify(result).includes(approved.data.fileUrl), false);
        return result;
    }
    for (const id of (finalVerification ? [0, approved.data.fileUrl] : [0, -1, 1.5, {}, null, '1 OR 1=1', 2147483647, approved.data.fileUrl])) await denied(id);
    await denied(research.id, 0); await denied(research.id, student.id, { path: first.data.fileUrl });
    await db.update(users).set({ isActive: false }).where(eq(users.id, outsider.id)); await denied(research.id, outsider.id);
    await db.update(users).set({ isActive: true }).where(eq(users.id, outsider.id));
    const draft = await paper(); await denied(draft.id);
    assert.equal((await changeResearchPublication(saved.id, false, admin.id)).success, true); await denied();
    assert.equal((await publishResearch(research.id, admin.id)).success, true);
    if (!finalVerification) {
    for (const fileUrl of [null, '', first.data.fileUrl, 'research/' + research.id + '/v2/../synthetic.pdf', 'research/' + research.id + '/v2/missing.pdf']) {
        // fileUrl is NOT NULL; blank and malformed metadata exercise the same safe boundary.
        if (fileUrl === null) continue;
        await db.update(submissions).set({ fileUrl }).where(eq(submissions.id, approved.data.id)); await denied();
    }
    await db.update(submissions).set({ fileUrl: approved.data.fileUrl, status: 'Revision Required' }).where(eq(submissions.id, approved.data.id)); await denied();
    await db.update(submissions).set({ status: 'Approved' }).where(eq(submissions.id, approved.data.id));
    }
    const publicationBeforeAccess = (await db.select().from(repositories).where(eq(repositories.id, saved.id)))[0];
    passed(finalVerification ? 'Unpublished and obvious tampered ID/path denial' : '6-10,14 unpublished, missing approved version, invalid identifiers, path/version binding and missing object fail safely');
    if (!finalVerification) {
    const originalFetch = global.fetch;
    global.fetch = async (input, ...args) => {
        const url = String(input instanceof Request ? input.url : input);
        if (url.includes('/storage/v1/object/sign/')) throw new Error('Synthetic sensitive storage failure');
        return originalFetch(input, ...args);
    };
    try { const result = await denied(); assert.equal(JSON.stringify(result).includes('sensitive'), false); } finally { global.fetch = originalFetch; }
    }
    for (const segment of ['object/public/', 'object/']) {
        const response = await fetch(process.env.SUPABASE_URL + '/storage/v1/' + segment + 'research-submissions/' + approved.data.fileUrl);
        assert.equal(response.status, 400);
    }
    passed(finalVerification ? 'Anonymous public/unsigned storage HTTP 400; private bucket preserved' : '13,15 anonymous public/unsigned HTTP 400; process-local storage failure returns generic controlled result');
    browser = await chromium.launch();
    let captured;
    for (const actor of (finalVerification ? [student] : [student, adviser, admin, panel])) {
        const live = await login(actor, finalVerification ? '/dashboard/repository?search=' + encodeURIComponent(marker) : '/dashboard/repository/' + research.id);
        if (finalVerification) {
            await live.page.getByRole('link', { name: research.title, exact: true }).click();
            await live.page.waitForURL(base + '/dashboard/repository/' + research.id);
        }
        assert.equal(await live.page.getByRole('heading', { name: research.title, exact: true }).count(), 1);
        assert.equal((await live.page.content()).includes('/storage/v1/object/sign/'), false);
        const requestPromise = live.page.waitForRequest(r => r.method() === 'POST' && Boolean(r.headers()['next-action']));
        const downloadPromise = live.page.waitForEvent('download');
        await live.page.getByRole('button', { name: 'Download PDF', exact: true }).click();
        const request = await requestPromise, download = await downloadPromise;
        assert.equal(await download.failure(), null);
        const stream = await download.createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk);
        assert.deepEqual(Buffer.concat(chunks), expected);
        await live.page.getByRole('status').filter({ hasText: 'Document ready' }).waitFor();
        if (actor === student) {
            captured = { ...live, request };
            const pdfResponse = new Promise(resolve => {
                const listener = response => {
                    if (response.url().includes('/storage/v1/object/sign/')) {
                        live.context.off('response', listener); resolve(response);
                    }
                };
                live.context.on('response', listener);
            });
            const popupPromise = live.page.waitForEvent('popup');
            await live.page.getByRole('button', { name: 'View PDF', exact: true }).click();
            const popup = await popupPromise;
            const viewResponse = await Promise.race([pdfResponse, new Promise((_, reject) => setTimeout(() => reject(new Error('PDF view response timeout')), 15000))]);
            assert.equal(viewResponse.status(), 200); assert.match(viewResponse.headers()['content-type'], /^application\/pdf/);
            await popup.close();
        }
        else await live.context.close();
    }
    const headers = { 'Next-Action': captured.request.headers()['next-action'], Origin: base, 'Content-Type': 'text/plain;charset=UTF-8' };
    async function replay(context, args) {
        return context.request.post(base + '/dashboard/repository/' + research.id, { headers, data: JSON.stringify(args), maxRedirects: 0 });
    }
    const anon = await browser.newContext(); const anonymous = await replay(anon, [research.id, 'view']);
    assert.ok([303, 307].includes(anonymous.status()) || /NEXT_REDIRECT/.test(await anonymous.text()));
    for (const args of [[0, 'view'], [draft.id, 'view'], [research.id, { path: first.data.fileUrl }], [approved.data.fileUrl, 'view']]) {
        const response = await replay(captured.context, args); assert.match(await response.text(), /"success":false/);
    }
    // Extra client arguments cannot choose a submission or path; only authoritative v2 is signed.
    const injected = await replay(captured.context, [research.id, 'view', { path: first.data.fileUrl, submissionId: first.data.id, version: 'v1', roleId: 1 }]);
    const responseText = await injected.text(); assert.match(responseText, /"success":true/); assert.equal(responseText.includes(first.data.fileUrl), false);
    await db.update(users).set({ isActive: false }).where(eq(users.id, student.id));
    assert.match(await (await replay(captured.context, [research.id, 'view'])).text(), /"success":false/);
    await db.update(users).set({ isActive: true }).where(eq(users.id, student.id));
    const unchangedPublication = (await db.select().from(repositories).where(eq(repositories.id, saved.id)))[0];
    assert.equal(unchangedPublication.publishedAt.getTime(), publicationBeforeAccess.publishedAt.getTime());
    assert.equal(unchangedPublication.isPublished, publicationBeforeAccess.isPublished);
    assert.equal((await changeResearchPublication(saved.id, false, admin.id)).success, true);
    assert.match(await (await replay(captured.context, [research.id, 'view'])).text(), /"success":false/);
    await captured.page.goto(base + '/dashboard/repository/' + research.id); assert.equal(await captured.page.getByRole('button', { name: 'Download PDF', exact: true }).count(), 0);
    // Restore the synthetic publication before checking that access itself preserved its state.
    await db.update(repositories).set({ isPublished: publicationBeforeAccess.isPublished, publishedAt: publicationBeforeAccess.publishedAt }).where(eq(repositories.id, saved.id));
    const publicationAfterAccess = (await db.select().from(repositories).where(eq(repositories.id, saved.id)))[0];
    assert.equal(publicationAfterAccess.publishedAt.getTime(), publicationBeforeAccess.publishedAt.getTime());
    assert.equal(publicationAfterAccess.isPublished, publicationBeforeAccess.isPublished);
    assert.deepEqual(await db.select().from(submissions).where(eq(submissions.paperId, research.id)).orderBy(submissions.id), history);
    assert.deepEqual(await db.select().from(feedbacks).where(inArray(feedbacks.submissionId, ids.submissions)).orderBy(feedbacks.id), feedbackHistory);
    passed(finalVerification ? 'Chromium repository listing/detail/view/download, authentication/tampering/private access and preserved publication/history' : '5,7,8,16 Chromium four-role real Server Action/download exact bytes, anonymous/tampered/stale/unpublished denial, injected path ignored, publication timestamp/state and history preserved');
    passed('regression Student upload/revision/v2 -> Adviser approval -> Admin publication -> authenticated repository PDF');
    console.log('CLEANUP_IDS ' + JSON.stringify(ids));
}

async function cleanup() {
    if (browser) await browser.close();
    if (paths.size) {
        const removed = await supabase.storage.from('research-submissions').remove([...paths]);
        assert.ifError(removed.error);
        for (const path of paths) {
            const result = await supabase.storage.from('research-submissions').createSignedUrl(path, 300);
            assert.ok(result.error, 'Deleted synthetic PDF must be absent');
        }
    }
    if (ids.papers.length) await db.delete(repositories).where(inArray(repositories.paperId, ids.papers));
    if (ids.submissions.length) await db.delete(feedbacks).where(inArray(feedbacks.submissionId, ids.submissions));
    if (ids.papers.length) await db.delete(submissions).where(inArray(submissions.paperId, ids.papers));
    if (ids.users.length) {
        await db.delete(notifications).where(inArray(notifications.userId, ids.users));
        await db.delete(activityLogs).where(inArray(activityLogs.userId, ids.users));
    }
    if (ids.papers.length) await db.delete(researchPapers).where(inArray(researchPapers.id, ids.papers));
    if (ids.groups.length) {
        await db.delete(groupMembers).where(inArray(groupMembers.groupId, ids.groups));
        await db.delete(researchGroups).where(inArray(researchGroups.id, ids.groups));
    }
    if (ids.users.length) {
        await db.delete(users).where(inArray(users.id, ids.users));
        assert.equal((await db.select().from(users).where(inArray(users.id, ids.users))).length, 0);
    }
    passed('synthetic storage and database fixtures cleaned up');
}
main().then(async () => { await cleanup(); process.exit(0); }).catch(async (error) => {
    console.error('FAIL acceptance ' + error.name); console.error(error.stack.split('\n').filter(line => line.trim().startsWith('at ')).join('\n'));
    try { await cleanup(); } catch { console.error('FAIL cleanup; inspect synthetic marker ' + marker); }
    process.exit(1);
});


