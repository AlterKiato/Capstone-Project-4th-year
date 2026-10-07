/* eslint-disable @typescript-eslint/no-require-imports */
// Run manually against the explicitly approved development environment:
// $env:PHASE5_ACCEPTANCE_CONFIRMED='1'; node --import tsx tests/phase5-publication.acceptance.cjs
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
const marker = 'PHASE54_' + randomUUID();
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
const { publishResearch, changeResearchPublication } = require('../lib/services/repository-publication.service.ts');
const { getRepositoryManagementData, getPublishedResearchDetails } = require('../lib/services/repository.service.ts');
async function main() {
    assert.equal(process.env.PHASE5_ACCEPTANCE_CONFIRMED, '1');
    const target = new URL(process.env.DATABASE_URL);
    assert.equal(target.hostname, 'localhost'); assert.equal(target.pathname, '/thesishs_ai');
    assert.equal(new URL(process.env.SUPABASE_URL).hostname, 'cbkplqkkjuoglpimwmib.supabase.co');
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
    const bucket = await supabase.storage.getBucket('research-submissions'); assert.ifError(bucket.error); assert.equal(bucket.data.public,false);
    const actors=[]; const hash=await bcrypt.hash(password,10);
    for(const roleId of [3,3,2,2,1,4,1]) {
        const [user]=await db.insert(users).values({firstName:'Synthetic',lastName:marker,email:(marker+'-'+actors.length+'@example.invalid').toLowerCase(),password:hash,roleId}).returning();
        actors.push(user); ids.users.push(user.id);
    }
    const [student,outsider,adviser,otherAdviser,admin,panel,secondAdmin]=actors;
    for(const [index,owner] of [adviser,otherAdviser].entries()) {
        const [group]=await db.insert(researchGroups).values({groupName:marker+index,strand:'TEST',section:'TEST',schoolYear:'2026-2027',adviserId:owner.id}).returning();ids.groups.push(group.id);
        await db.insert(groupMembers).values({groupId:group.id,userId:index===0?student.id:outsider.id});
    }
    async function paper(status='Draft') {
        const [record]=await db.insert(researchPapers).values({groupId:ids.groups[0],title:marker+'-'+ids.papers.length,abstract:'Synthetic publication acceptance.',status}).returning();ids.papers.push(record.id);return record;
    }
    const research=await paper();
    const first=await submitResearch(research.id,student.id,pdfFile(),marker);assert.equal(first.success,true);ids.submissions.push(first.data.id);paths.add(first.data.fileUrl);
    assert.equal((await publishResearch(research.id,admin.id)).success,false);
    assert.equal((await startSubmissionReview(first.data.id,adviser.id)).success,true);
    assert.equal((await createAdviserFeedback(first.data.id,adviser.id,marker,'Revision Required')).success,true);
    const revision=await submitResearch(research.id,student.id,pdfFile(),marker);assert.equal(revision.success,true);assert.equal(revision.data.version,'v2');ids.submissions.push(revision.data.id);paths.add(revision.data.fileUrl);
    assert.equal((await startSubmissionReview(revision.data.id,adviser.id)).success,true);
    assert.equal((await createAdviserFeedback(revision.data.id,adviser.id,marker,'Approved')).success,true);
    assert.equal((await submitResearch(research.id,student.id,pdfFile(),marker)).success,false);
    const historyBefore=await db.select().from(submissions).where(eq(submissions.paperId,research.id));
    const feedbackBefore=await db.select().from(feedbacks).where(inArray(feedbacks.submissionId,ids.submissions));
    for(const actor of [student,outsider,adviser,otherAdviser,panel]) assert.equal((await publishResearch(research.id,actor.id)).success,false);
    for(const id of [0,-1,1.5,{},null,'1 OR 1=1',2147483647]) assert.equal((await publishResearch(id,admin.id)).success,false);
    await db.update(users).set({isActive:false}).where(eq(users.id,secondAdmin.id));assert.equal((await publishResearch(research.id,secondAdmin.id)).success,false);
    await db.update(users).set({isActive:true,roleId:3}).where(eq(users.id,secondAdmin.id));assert.equal((await publishResearch(research.id,secondAdmin.id)).success,false);
    await db.update(users).set({roleId:1}).where(eq(users.id,secondAdmin.id));
    passed('service authorization, active account/database role, nonapproved and tampered/nonexistent IDs');
    const noDocument=await paper('Approved');assert.equal((await publishResearch(noDocument.id,admin.id)).success,false);
    const badDocument=await paper('Approved');
    const [bad]=await db.insert(submissions).values({paperId:badDocument.id,submittedBy:student.id,version:'v1',status:'Approved',fileUrl:revision.data.fileUrl}).returning();ids.submissions.push(bad.id);
    assert.equal((await publishResearch(badDocument.id,admin.id)).success,false);
    await db.update(submissions).set({fileUrl:'research/'+badDocument.id+'/v1/missing.pdf'}).where(eq(submissions.id,bad.id));
    assert.equal((await publishResearch(badDocument.id,admin.id)).success,false);
    const tx=db.transaction; db.transaction=async()=>{throw Error('synthetic database failure');};
    try{assert.deepEqual(await publishResearch(research.id,admin.id),{success:false,message:'The publication request could not be completed.'});}finally{db.transaction=tx;}
    assert.equal((await db.select().from(repositories).where(inArray(repositories.paperId,ids.papers))).length,0);
    passed('missing approved document, cross-paper path, missing object and safe database failure leave no publication');
    browser=await chromium.launch();
    const adminBrowser=await login(admin,'/dashboard/admin/repository');
    const card=adminBrowser.page.locator('li').filter({hasText:research.title});assert.equal(await card.count(),1);
    const actionRequest=adminBrowser.page.waitForRequest(r=>r.method()==='POST'&&Boolean(r.headers()['next-action']));
    await card.getByRole('button',{name:'Publish to repository',exact:true}).click();
    const request=await actionRequest;
    await adminBrowser.page.getByRole('status').filter({hasText:'Research published successfully.'}).waitFor();
    const entry=await getPublishedResearchDetails(research.id);assert.ok(entry);assert.equal(entry.paperId,research.id);assert.equal(entry.submissionId,revision.data.id);assert.equal(entry.fileUrl,revision.data.fileUrl);
    const saved=(await db.select().from(repositories).where(eq(repositories.paperId,research.id)))[0];assert.equal(saved.isPublished,true);
    assert.equal((await publishResearch(research.id,admin.id)).success,false);
    const originalPublishedAt=saved.publishedAt;
    const race=await Promise.all([publishResearch(research.id,admin.id),publishResearch(research.id,secondAdmin.id)]);assert.equal(race.filter(r=>r.success).length,0);
    const body=request.postData();const headers={'Next-Action':request.headers()['next-action'],Origin:base,'Content-Type':request.headers()['content-type']};
    async function replay(context,data=body){return context.request.post(base+'/dashboard/admin/repository',{headers,data,maxRedirects:0});}
    const repeated=await replay(adminBrowser.context);assert.match(await repeated.text(),/already published/);
    for(const actor of [student,adviser,panel]) {
        const deniedBrowser=await login(actor,'/dashboard');const response=await replay(deniedBrowser.context);assert.ok([303,307].includes(response.status())||/NEXT_REDIRECT/.test(await response.text()));
    }
    const anon=await browser.newContext();const unauth=await replay(anon);assert.ok([303,307].includes(unauth.status())||/NEXT_REDIRECT/.test(await unauth.text()));
    await db.update(users).set({isActive:false}).where(eq(users.id,admin.id));assert.match(await (await replay(adminBrowser.context)).text(),/could not be completed/);
    await db.update(users).set({isActive:true,roleId:3}).where(eq(users.id,admin.id));assert.match(await (await replay(adminBrowser.context)).text(),/could not be completed/);
    await db.update(users).set({roleId:1}).where(eq(users.id,admin.id));
    const invalid=await adminBrowser.context.request.post(base+'/dashboard/admin/repository',{headers:{...headers,'Content-Type':'text/plain;charset=UTF-8'},data:JSON.stringify([{success:false,message:''},{paperId:research.id,roleId:1,status:'Approved'}]),maxRedirects:0});
    assert.match(await invalid.text(),/request is invalid/);
    assert.equal((await db.select().from(repositories).where(eq(repositories.paperId,research.id))).length,1);
    assert.equal((await db.select().from(repositories).where(eq(repositories.paperId,research.id)))[0].publishedAt.getTime(),originalPublishedAt.getTime());
    passed('real Chromium Admin publication success/relationship, duplicate replay, Student/Adviser/Panel/anonymous denial, stale account/role and malformed request');
    await browser.close();browser=null;
    assert.equal((await changeResearchPublication(saved.id,false,admin.id)).success,true);
    const concurrency=await Promise.all([publishResearch(research.id,admin.id),publishResearch(research.id,secondAdmin.id)]);assert.equal(concurrency.filter(r=>r.success).length,1);
    assert.equal((await db.select().from(repositories).where(eq(repositories.paperId,research.id))).length,1);
    // New-paper insert concurrency, rather than only republication of an existing row.
    const concurrentPaper=await paper('Approved');
    const upload=await submitResearch(concurrentPaper.id,student.id,pdfFile(),marker);assert.equal(upload.success,true);ids.submissions.push(upload.data.id);paths.add(upload.data.fileUrl);
    await startSubmissionReview(upload.data.id,adviser.id);await createAdviserFeedback(upload.data.id,adviser.id,marker,'Approved');
    const insertRace=await Promise.all([publishResearch(concurrentPaper.id,admin.id),publishResearch(concurrentPaper.id,secondAdmin.id)]);assert.equal(insertRace.filter(r=>r.success).length,1);
    assert.equal((await db.select().from(repositories).where(eq(repositories.paperId,concurrentPaper.id))).length,1);
    await assert.rejects(db.insert(repositories).values({paperId:concurrentPaper.id,isPublished:true}));
    const management=await getRepositoryManagementData(admin.id);assert.ok(management);assert.equal(management.eligiblePapers.some(p=>p.paperId===research.id),false);
    assert.deepEqual(await db.select().from(submissions).where(eq(submissions.paperId,research.id)),historyBefore);
    assert.deepEqual(await db.select().from(feedbacks).where(inArray(feedbacks.submissionId,[first.data.id,revision.data.id])),feedbackBefore);
    const secureUrl=await createSubmissionDocumentUrl(revision.data.id,student.id);assert.ok(secureUrl);const pdf=await fetch(secureUrl);assert.equal(pdf.status,200);assert.equal(await pdf.text(),await pdfFile().text());
    for(const actor of [admin,panel,outsider,otherAdviser])assert.equal(await createSubmissionDocumentUrl(revision.data.id,actor.id),null);
    assert.ok(await createSubmissionDocumentUrl(revision.data.id,adviser.id));
    const claims=JSON.parse(Buffer.from(new URL(secureUrl).searchParams.get('token').split('.')[1],'base64url').toString());assert.ok(claims.exp-Math.floor(Date.now()/1000)<=300);
    assert.ok((await fetch(process.env.SUPABASE_URL+'/storage/v1/object/public/research-submissions/'+revision.data.fileUrl)).status>=400);
    passed('concurrent new publication and republication exactly one winner, database uniqueness backstop, history unchanged and Phase 5.3 private 300-second access intact');
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


