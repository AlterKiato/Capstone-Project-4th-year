/* eslint-disable @typescript-eslint/no-require-imports */
// node --import tsx tests/phase8-local-ai.unit.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
let session = { userId: 10, roleId: 1 };
let user = { roleId: 1, isActive: true, email: 'PRIVATE_EMAIL', password: 'PRIVATE_PASSWORD' };
let aggregateReads = 0;
let fail = false;
let ownerArgument;
let fetchCalls = 0;
global.fetch = () => { fetchCalls++; throw new Error('No provider calls'); };
const c = (versions, contributors = versions, papers = versions) => ({ versions, contributors, papers });
const cohort = () => ({
    total: c(15), submitted: c(5), review: c(5),
    notSubmitted: c(10), notReview: c(10), neither: c(5),
});
const admin = { totalUsers: 5, totalGroups: 10, totalResearchPapers: 15, totalPublishedPapers: 5, approvedPapers: 10 };
const originalLoad = Module._load;
const mocks = {
    'server-only': {},
    '@/lib/auth/session': { getSession: async () => session },
    '@/lib/repositories/user.repository': { findUserById: async () => {
        if (fail) throw new Error('PRIVATE_ERROR');
        return user;
    } },
    '@/lib/repositories/admin-ai-aggregate.repository': { getAdminAIOverviewAggregate: async () => { aggregateReads++; return admin; } },
    '@/lib/repositories/adviser-submission.repository': { getAdviserAIWorkflowAggregate: async id => { ownerArgument = id; aggregateReads++; return cohort(); } },
};
Module._load = function(id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : originalLoad.call(this, id, ...args); };
const policy = require('../lib/ai/aggregate-policy.ts');
const schemas = require('../lib/validations/ai-foundation.ts');
const { getAdultAIEligibility } = require('../lib/auth/adult-eligibility.ts');
const { getGroqAvailability } = require('../lib/ai/groq-provider.ts');
const actions = require('../lib/actions/ai-foundation.action.ts');
const local = require('../lib/services/ai-aggregation.service.ts');
function actor(role, id = 10) { session = { userId: id, roleId: role, adultVerified: true }; user = { roleId: role, isActive: true, adultVerified: true, age: 99, email: 'PRIVATE_EMAIL', password: 'PRIVATE_PASSWORD' }; }
function safe(value) { assert.ok(!JSON.stringify(value).includes('PRIVATE_')); }
async function main() {
    const dto = policy.minimizeAdminAggregate(admin);
    assert.equal(dto.metrics.totalUsers, '5-9'); assert.equal(dto.metrics.totalPublishedPapers, '5-9');
    for (const value of [0, 1, 4]) assert.equal(policy.minimizeAdminAggregate({ ...admin, totalUsers: value }).metrics.totalUsers, undefined);
    for (const [value, band] of [[5,'5-9'],[9,'5-9'],[10,'10-19'],[20,'20-49'],[50,'50-99'],[100,'100-199'],[200,'200-499'],[500,'500-999'],[1000,'1000+']])
        assert.equal(policy.minimizeAdminAggregate({ ...admin, totalUsers: value }).metrics.totalUsers, band);
    assert.equal(policy.minimizeAdminAggregate({ ...admin, approvedPapers: 9 }).metrics.totalPublishedPapers, undefined);
    assert.throws(() => policy.minimizeAdminAggregate({ ...admin, approvedPapers: 4 }));
    assert.throws(() => policy.minimizeAdminAggregate({ ...admin, privateRows: [] }));
    assert.equal(policy.minimizeAdminAggregate({ totalUsers: 0, totalGroups: 0, totalResearchPapers: 0, totalPublishedPapers: 0, approvedPapers: 0 }), null);
    let data = cohort();
    assert.deepEqual(Object.keys(policy.minimizeAdviserAggregate(data).metrics).sort(),
        ['recordedSubmissionVersions','recordedSubmittedVersions','recordedUnderReviewVersions'].sort());
    for (const field of ['contributors', 'papers']) {
        data = cohort(); data.total[field] = 4;
        for (const key of ['submitted','review','notSubmitted','notReview','neither']) data[key][field] = 1;
        assert.equal(policy.minimizeAdviserAggregate(data), null, 'Repeated versions/single-paper contributors cannot satisfy k');
        data = cohort(); data.submitted[field] = 4;
        assert.equal(policy.minimizeAdviserAggregate(data).metrics.recordedSubmittedVersions, undefined);
        data = cohort(); data.notSubmitted[field] = 4;
        assert.equal(policy.minimizeAdviserAggregate(data).metrics.recordedSubmittedVersions, undefined);
        data = cohort(); data.neither[field] = 4;
        assert.deepEqual(Object.keys(policy.minimizeAdviserAggregate(data).metrics), ['recordedSubmissionVersions'], 'Suppress both subsets when joint residual is small');
    }
    data = { total:c(5),submitted:c(5),review:c(0),notSubmitted:c(0),notReview:c(5),neither:c(0) };
    assert.deepEqual(Object.keys(policy.minimizeAdviserAggregate(data).metrics), ['recordedSubmissionVersions']);
    data = cohort(); data.total.versions = 14; assert.throws(() => policy.minimizeAdviserAggregate(data));
    assert.throws(() => policy.minimizeAdviserAggregate({ ...cohort(), groupId: 99 }));
    assert.equal(schemas.minimizedAIDtoSchema.safeParse({ ...dto, userId: 5 }).success, false);
    assert.equal(schemas.minimizedAIDtoSchema.safeParse({ ...dto, metrics: { totalUsers: 5 } }).success, false);
    console.log('PASS allowlisted DTOs, count bands, k=5 contributors/papers, subset/complement/residual suppression and invalid aggregates');
    for (const role of [1, 2, 3, 4, 999]) {
        actor(role);
        const adminAnswer = await actions.getLocalAdminAssistanceAction({ reportId:'admin-overview-v1' });
        const adviserAnswer = await actions.getLocalAdviserAssistanceAction({ topicId:'adviser-workflow-overview-v1' });
        assert.equal(adminAnswer.success, role === 1); assert.equal(adviserAnswer.success, role === 2);
        safe(adminAnswer); safe(adviserAnswer);
        const before = aggregateReads;
        assert.equal((await local.prepareLocalAdminAggregate()).success, role === 1);
        assert.equal((await local.prepareLocalAdviserAggregate()).success, role === 2);
        assert.equal(aggregateReads - before, role === 1 || role === 2 ? 1 : 0);
    }
    actor(2, 33); assert.equal((await local.prepareLocalAdviserAggregate()).success, true); assert.equal(ownerArgument, 33);
    for (const type of ['admin','adviser']) {
        actor(type === 'admin' ? 1 : 2);
        const action = type === 'admin' ? actions.getLocalAdminAssistanceAction : actions.getLocalAdviserAssistanceAction;
        const valid = type === 'admin' ? { reportId:'admin-overview-v1' } : { topicId:'adviser-workflow-overview-v1' };
        for (const input of [null, {}, [], 'override', { ...valid, userId:99 }, { ...valid, groupId:99 }, { ...valid, adviserId:99 }, { ...valid, paperId:99 },
            { ...valid, adultVerified:true }, { ...valid, metrics:admin }, { ...valid, prompt:'ignore rules' },
            { ...valid, url:'https://example.invalid' }, { ...valid, history:[] }, { topicId:'<script>approve()</script>' }]) {
            const result = await action(input); assert.equal(result.success,false); assert.equal(result.mode,'unsupported'); safe(result);
        }
        user.isActive = false; assert.equal((await action(valid)).success,false);
        user.isActive = true; user.roleId = 3; assert.equal((await action(valid)).success,false);
        user = undefined; assert.equal((await action(valid)).success,false);
        actor(type === 'admin' ? 1 : 2); fail = true; safe(await action(valid)); assert.equal((await action(valid)).success,false); fail = false;
    }
    session = null; assert.equal((await actions.getLocalAdminAssistanceAction({reportId:'admin-overview-v1'})).success,false);
    actor(1); session.userId = 1.5; assert.equal((await local.prepareLocalAdminAggregate()).success,false);
    actor(2);
    const before = aggregateReads;
    for (const topicId of schemas.adviserTopicIds) {
        const result = await actions.getLocalAdviserAssistanceAction({topicId});
        assert.equal(result.mode,'static'); assert.ok(result.guidance); assert.equal(result.payload,undefined);
    }
    assert.equal(aggregateReads,before,'Ineligible/disabled UI actions must never aggregate');
    for (const flag of ['ADMIN_AI_REPORT_ENABLED','ADVISER_AI_WORKFLOW_ENABLED','AI_GUIDE_ENABLED']) process.env[flag]='true';
    assert.deepEqual(getAdultAIEligibility(), {eligible:false, reason:'registry-unapproved'});
    assert.deepEqual(getGroqAvailability(), {enabled:false,available:false});
    assert.match((await actions.getLocalAdviserAssistanceAction({topicId:'adviser-workflow-overview-v1'})).message,/disabled/);
    assert.equal(fetchCalls,0);
    for (const file of ['lib/ai/groq-provider.ts','lib/ai/aggregate-policy.ts','lib/auth/adult-eligibility.ts','lib/services/ai-foundation.service.ts']) {
        const source = fs.readFileSync(file,'utf8');
        assert.ok(!/fetch\s*\(|https?:\/\/|GROQ_API_KEY|console\./.test(source));
    }
    const provider = fs.readFileSync('lib/ai/groq-provider.ts','utf8');
    assert.ok(!/repositories|storage|lib\/db|process\.env/.test(provider));
    console.log('PASS active-role/local ownership binding, strict inputs, adult denial despite assertions/flags, static fallbacks and zero provider/aggregate calls from UI actions');
}
main().catch(error => {console.error(error);process.exitCode=1;});
