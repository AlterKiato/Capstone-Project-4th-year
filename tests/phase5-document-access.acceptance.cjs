/* eslint-disable @typescript-eslint/no-require-imports */
// Run manually against the explicitly approved development environment:
// $env:PHASE5_ACCEPTANCE_CONFIRMED='1'; node --import tsx tests/phase5-document-access.acceptance.cjs
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
const { isSubmissionDocumentPath } = require('../lib/validations/submission-document.ts');
const { users, researchGroups, researchPapers, groupMembers, submissions, feedbacks, notifications, activityLogs } = schema;
const base = 'http://localhost:3000';
const marker = 'PHASE53_' + randomUUID();
const password = randomUUID();
const ids = { users: [], groups: [], papers: [], submissions: [] };
const paths = new Set();
let browser;
let supabase;
function passed(label) { console.log('PASS ' + label); }
function pdfFile() {
    const pdf = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 0 /Kids [] >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n';
    return new File([pdf], 'synthetic.pdf', { type: 'application/pdf' });
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
async function main() {
    assert.equal(process.env.PHASE5_ACCEPTANCE_CONFIRMED, '1', 'Explicit environment confirmation required');
    const databaseUrl = new URL(process.env.DATABASE_URL);
    assert.equal(databaseUrl.hostname, 'localhost');
    assert.equal(databaseUrl.pathname, '/thesishs_ai');
    assert.equal(new URL(process.env.SUPABASE_URL).hostname, 'cbkplqkkjuoglpimwmib.supabase.co');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
    const bucket = await supabase.storage.getBucket('research-submissions');
    assert.ifError(bucket.error);
    assert.equal(bucket.data.public, false);
    const hash = await bcrypt.hash(password, 10);
    const actors = [];
    for (const roleId of [3, 3, 2, 2, 1, 4, 3]) {
        const [actor] = await db.insert(users).values({ firstName: 'Synthetic', lastName: marker, email: `${marker}-${actors.length}@example.invalid`.toLowerCase(), password: hash, roleId }).returning();
        ids.users.push(actor.id);
        actors.push(actor);
    }
    const [student, outsider, adviser, otherAdviser, admin, panel, member] = actors;
    for (const [index, owner] of [adviser, otherAdviser].entries()) {
        const [group] = await db.insert(researchGroups).values({ groupName: marker.slice(0, 90) + index, strand: 'TEST', section: 'TEST', schoolYear: '2026-2027', adviserId: owner.id }).returning();
        ids.groups.push(group.id);
        await db.insert(groupMembers).values({ groupId: group.id, userId: index === 0 ? student.id : outsider.id });
        if (index === 0) await db.insert(groupMembers).values({ groupId: group.id, userId: member.id });
        const [paper] = await db.insert(researchPapers).values({ groupId: group.id, title: marker + index, abstract: 'Synthetic secure access acceptance only.' }).returning();
        ids.papers.push(paper.id);
    }
    const first = await submitResearch(ids.papers[0], student.id, pdfFile(), marker);
    assert.equal(first.success, true);
    ids.submissions.push(first.data.id); paths.add(first.data.fileUrl);
    const second = await submitResearch(ids.papers[1], outsider.id, pdfFile(), marker);
    assert.equal(second.success, true);
    ids.submissions.push(second.data.id); paths.add(second.data.fileUrl);
    const submission = first.data;
    const url = await createSubmissionDocumentUrl(submission.id, student.id);
    assert.ok(url);
    assert.ok(await createSubmissionDocumentUrl(submission.id, member.id));
    assert.ok(await createSubmissionDocumentUrl(submission.id, adviser.id));
    for (const actor of [outsider, otherAdviser, admin, panel]) assert.equal(await createSubmissionDocumentUrl(submission.id, actor.id), null);
    passed('service membership (including group peer), Adviser ownership, cross-group denial, Admin/Panel denial');
    for (const invalid of [0, -1, 1.5, '1', {}, null, Number.MAX_SAFE_INTEGER, 2147483647]) {
        assert.equal(await createSubmissionDocumentUrl(invalid, student.id), null);
    }
    assert.equal(await createSubmissionDocumentUrl(submission.id, 2147483647), null);
    await db.update(users).set({ isActive: false }).where(eq(users.id, member.id));
    assert.equal(await createSubmissionDocumentUrl(submission.id, member.id), null);
    await db.update(users).set({ isActive: true, roleId: 1 }).where(eq(users.id, member.id));
    assert.equal(await createSubmissionDocumentUrl(submission.id, member.id), null);
    passed('invalid identifiers, absent account, disabled account and revoked role');
    const badPaths = ['', ' ', `research/${ids.papers[1]}/v1/synthetic.pdf`, `research/${ids.papers[0]}/v2/synthetic.pdf`, `research/${ids.papers[0]}/v1/../synthetic.pdf`, `research/${ids.papers[0]}/v1/%2e%2e.pdf`, `research/${ids.papers[0]}/v1/sub/file.pdf`, 'https://example.invalid/document.pdf'];
    for (const path of badPaths) {
        await db.update(submissions).set({ fileUrl: path }).where(eq(submissions.id, submission.id));
        assert.equal(await createSubmissionDocumentUrl(submission.id, student.id), null);
    }
    assert.equal(isSubmissionDocumentPath(null, ids.papers[0], 'v1'), false);
    await db.update(submissions).set({ fileUrl: submission.fileUrl, version: '../v1' }).where(eq(submissions.id, submission.id));
    assert.equal(await createSubmissionDocumentUrl(submission.id, student.id), null);
    await db.update(submissions).set({ fileUrl: `research/${ids.papers[0]}/v1/missing.pdf`, version: 'v1' }).where(eq(submissions.id, submission.id));
    assert.equal(await createSubmissionDocumentUrl(submission.id, student.id), null);
    await db.update(submissions).set({ fileUrl: submission.fileUrl }).where(eq(submissions.id, submission.id));
    passed('empty/cross-paper/cross-version/traversal/encoded/nested/public-path metadata and missing object fail safely');
    // Fault inject only the signing boundary; never change credentials or environment.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('synthetic storage failure'); };
    try { assert.equal(await createSubmissionDocumentUrl(submission.id, student.id), null); }
    finally { globalThis.fetch = originalFetch; }
    passed('fault-injected signing failure returns null');
    const pdf = await fetch(url);
    assert.equal(pdf.status, 200); assert.match(pdf.headers.get('content-type'), /application\/pdf/);
    assert.equal(await pdf.text(), await pdfFile().text(), 'Retrieved PDF must match the uploaded synthetic bytes');
    const claims = JSON.parse(Buffer.from(new URL(url).searchParams.get('token').split('.')[1], 'base64url').toString());
    const remaining = claims.exp - Math.floor(Date.now() / 1000);
    assert.ok(remaining >= 270 && remaining <= 300);
    passed('signed URL expiry claim has ' + remaining + ' seconds remaining; policy remains 300 seconds');
    const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/research-submissions/${submission.fileUrl}`;
    const publicResponse = await fetch(publicUrl);
    assert.ok(publicResponse.status >= 400);
    passed('anonymous public-object request denied HTTP ' + publicResponse.status);
    const rawUrl = `${process.env.SUPABASE_URL}/storage/v1/object/research-submissions/${submission.fileUrl}`;
    const rawResponse = await fetch(rawUrl);
    assert.ok(rawResponse.status >= 400);
    passed('anonymous unsigned-object request denied HTTP ' + rawResponse.status);
    passed('signed PDF HTTP 200, five-minute exp claim, public and unsigned anonymous denial');
    browser = await chromium.launch();
    const studentBrowser = await login(student, '/dashboard/student/submissions');
    const actionRequest = studentBrowser.page.waitForRequest(r => r.method() === 'POST' && Boolean(r.headers()['next-action']));
    const pdfResponse = studentBrowser.page.waitForResponse(r => r.url().includes('/storage/v1/object/sign/'));
    await studentBrowser.page.getByRole('button', { name: 'View / Download' }).click();
    const request = await actionRequest;
    assert.equal((await pdfResponse).status(), 200);
    const actionId = request.headers()['next-action'];
    assert.equal(request.postData(), JSON.stringify([submission.id]));
    async function rawAction(context, value) {
        return context.request.post(base + '/dashboard/student/submissions', {
            headers: { 'Next-Action': actionId, Origin: base, 'Content-Type': 'text/plain;charset=UTF-8' },
            data: JSON.stringify([value]), maxRedirects: 0,
        });
    }
    for (const value of [second.data.id, -1, '1', { submissionId: submission.id, paperId: ids.papers[1], path: second.data.fileUrl, roleId: 1 }, 2147483647]) {
        const response = await rawAction(studentBrowser.context, value);
        assert.equal(response.status(), 200);
        assert.match(await response.text(), /1:null/);
    }
    const adviserBrowser = await login(adviser, '/dashboard/adviser/submissions/' + submission.id);
    const adviserPdf = adviserBrowser.page.waitForResponse(r => r.url().includes('/storage/v1/object/sign/'));
    await adviserBrowser.page.getByRole('button', { name: 'View / Download' }).click();
    assert.equal((await adviserPdf).status(), 200);
    assert.match(await (await rawAction(adviserBrowser.context, second.data.id)).text(), /1:null/);
    const adminBrowser = await login(admin, '/dashboard');
    const adminDenied = await rawAction(adminBrowser.context, submission.id);
    assert.ok([303, 307].includes(adminDenied.status()) || /NEXT_REDIRECT/.test(await adminDenied.text()));
    const panelBrowser = await login(panel, '/dashboard');
    const panelDenied = await rawAction(panelBrowser.context, submission.id);
    assert.ok([303, 307].includes(panelDenied.status()) || /NEXT_REDIRECT/.test(await panelDenied.text()));
    const anonymous = await browser.newContext();
    const denied = await rawAction(anonymous, submission.id);
    assert.ok([303, 307].includes(denied.status()) || /NEXT_REDIRECT/.test(await denied.text()));
    passed('Chromium Student/Adviser buttons load PDF; direct Server Action rejects cross-group/tampered requests, Admin, Panel and anonymous');
    await browser.close(); browser = null;
    assert.equal((await startSubmissionReview(submission.id, adviser.id)).success, true);
    assert.equal((await createAdviserFeedback(submission.id, adviser.id, marker, 'Revision Required')).success, true);
    const revision = await submitResearch(ids.papers[0], student.id, pdfFile(), marker);
    assert.equal(revision.success, true); assert.equal(revision.data.version, 'v2');
    ids.submissions.push(revision.data.id); paths.add(revision.data.fileUrl);
    assert.equal((await startSubmissionReview(revision.data.id, adviser.id)).success, true);
    assert.equal((await createAdviserFeedback(revision.data.id, adviser.id, marker, 'Approved')).success, true);
    assert.equal((await submitResearch(ids.papers[0], student.id, pdfFile(), marker)).success, false);
    assert.equal((await db.select().from(feedbacks).where(inArray(feedbacks.submissionId, ids.submissions))).length, 2);
    assert.ok(await createSubmissionDocumentUrl(submission.id, student.id));
    assert.ok(await createSubmissionDocumentUrl(revision.data.id, adviser.id));
    const paper = await db.query.researchPapers.findFirst({ where: eq(researchPapers.id, ids.papers[0]) });
    assert.equal(paper.status, 'Approved');
    assert.equal((await db.select().from(notifications).where(inArray(notifications.userId, ids.users))).length, 5);
    assert.equal((await db.select().from(activityLogs).where(inArray(activityLogs.userId, ids.users))).length, 2);
    passed('Phase 5.1/5.2 upload, revision, approval, version/feedback history, notifications/logs, approved resubmission denial');
    console.log('WAIT expiry; browser acceptance complete');
    const delay = Math.max(0, claims.exp * 1000 - Date.now() + 5000);
    await new Promise(resolve => setTimeout(resolve, delay));
    const expired = await fetch(url);
    assert.ok(expired.status >= 400);
    passed('original signed URL denied after its five-minute expiry (HTTP ' + expired.status + ')');
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


