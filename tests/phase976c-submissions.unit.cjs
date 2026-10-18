/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const Module = require('node:module');
const directory = require('../lib/utils/adviser-submissions.ts');
const item = (id, paperId, status, date = '2026-01-01', extra = {}) => ({ id, paperId, status, submittedAt: date, researchTitle: 'Synthetic Research', groupName: 'Same Group', studentFirstName: 'Test', studentLastName: 'Student', version: 'v' + id, ...extra });
const records = [item(1, 10, 'Submitted', '2026-01-01', { version: 'v9' }), item(2, 10, 'Approved', '2026-02-01', { version: 'v1' }), item(3, 10, 'Revision Required', '2026-02-01'), item(4, 20, 'Under Review'), item(5, 30, 'Approved', '2026-04-01')];
const { projects, counts } = directory.groupAdviserSubmissions([...records, records[0]]);
assert.equal(projects.length, 3); assert.deepEqual(counts, { submitted: 1, underReview: 1, reviewed: 3 });
assert.deepEqual(projects.map(project => project.paperId), [10, 20, 30]);
assert.equal(projects[0].latest.id, 3); assert.deepEqual(projects[0].history.map(item => item.id), [2, 1]);
assert.equal(projects[0].history[1].version, 'v9');
assert.deepEqual(directory.filterAdviserProjects(projects, '', 'pending').map(project => project.paperId), [10, 20]);
assert.deepEqual(directory.filterAdviserProjects(projects, '', 'reviewed').map(project => project.paperId), [10, 30]);
for (const search of ['  SYNTHETIC   research ', '  SAME   GROUP ', '  test   STUDENT ']) assert.equal(directory.filterAdviserProjects(projects, search, 'all').length, 3);
assert.deepEqual(directory.filterAdviserProjects(projects, 'missing', 'all'), []);
assert.deepEqual(directory.groupAdviserSubmissions([]), { projects: [], counts: { submitted: 0, underReview: 0, reviewed: 0 } });
for (const item of records) assert.equal(directory.submissionDetailsHref(item.id), `/dashboard/adviser/submissions/${item.id}`);
let session = { userId: 7, roleId: 2, email: 'synthetic@example.invalid' }, account = { roleId: 2 }, fail = false, feedbackFail = false;
const calls = [], feedbackCalls = [];
let reviewStatus = 'Submitted', writes = 0;
const mocks = {
    'server-only': {},
    '@/lib/auth/session': { getSession: async () => session },
    '@/lib/auth/authorization': { requireRole: async roles => { assert.deepEqual(roles, [2]); if (!session || session.roleId !== 2) throw Error('redirect'); return session; } },
    './dashboard-account.service': { getDashboardAccount: async () => account },
    '@/lib/repositories/user.repository': { findUserById: async () => ({ roleId: 2, isActive: true }) },
    '@/lib/repositories/research-group.repository': { findResearchGroupsByAdviserId: async id => [{ id: id === 7 ? 100 : 200 }] },
    '@/lib/repositories/adviser-submission.repository': {
        findSubmissionsByGroupIds: async groups => { calls.push(groups); if (fail) throw Error('PRIVATE'); return groups[0] === 100 ? [{ ...records[0], submittedAt: new Date(records[0].submittedAt), fileUrl: 'PRIVATE', remarks: 'PRIVATE' }] : []; },
        findSubmissionForAdviser: async (id, groups) => { calls.push([id, groups]); return id === 1 && groups[0] === 100 ? { ...records[0], status: reviewStatus, submittedBy: 99 } : undefined; },
    },
    '@/lib/repositories/submission.repository': { updateSubmissionStatusForAdviser: async (id, status, actorId) => { assert.equal(actorId, session.userId); writes++; reviewStatus = status; return { id, status }; } },
    '@/lib/repositories/feedback.repository': { persistAdviserDecision: async data => { writes++; return { ...data, id: 1 }; } },
    '@/lib/services/notification.service': { notifyStudentSubmissionApproved: async () => ({ success: true }), notifyStudentSubmissionRevisionRequired: async () => ({ success: true }) },
    '@/lib/repositories/adviser-review-details.repository': { readOwnedSubmissionFeedback: async (id, adviserId) => { feedbackCalls.push([id, adviserId]); if (feedbackFail) throw Error('PRIVATE'); return [{ submissionId: id, comments: 'This exact version' }]; } },
};
const original = Module._load;
Module._load = function(id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args); };
const service = require('../lib/services/adviser-submissions-ui.service.ts');
const { startSubmissionReview } = require('../lib/services/adviser-review.service.ts');
const { createAdviserFeedback } = require('../lib/services/adviser-feedback.service.ts');
async function main() {
    for (const denied of [null, { roleId: 1 }, { roleId: 3 }, { roleId: 4 }]) { account = denied; assert.equal(await service.getAdviserSubmissionsDirectory(), null); assert.equal(await service.getAdviserReviewDetails(1), null); }
    account = { roleId: 2 };
    for (const bad of [0, -1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1]) { session.userId = bad; assert.equal(await service.getAdviserSubmissionsDirectory(), null); }
    assert.deepEqual(calls, []);
    session.userId = 7;
    for (const bad of [0, -1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.equal(await service.getAdviserReviewDetails(bad), null);
    const data = await service.getAdviserSubmissionsDirectory(); assert.equal(data.submissions.length, 1); assert.ok(!JSON.stringify(data).includes('PRIVATE'));
    let detail = await service.getAdviserReviewDetails(1); assert.equal(detail.feedback[0].submissionId, 1); assert.deepEqual(feedbackCalls, [[1, 7]]);
    assert.equal(await service.getAdviserReviewDetails(2), null); assert.equal(feedbackCalls.length, 1);
    session.userId = 8; assert.deepEqual((await service.getAdviserSubmissionsDirectory()).submissions, []); assert.equal(await service.getAdviserReviewDetails(1), null); assert.equal(feedbackCalls.length, 1);
    session.userId = 7; feedbackFail = true; detail = await service.getAdviserReviewDetails(1); assert.equal(detail.feedbackUnavailable, true); assert.deepEqual(detail.feedback, []);
    fail = true; assert.equal(await service.getAdviserSubmissionsDirectory(), null);
    assert.equal((await startSubmissionReview(1, 8)).success, false);
    assert.equal((await createAdviserFeedback(1, 8, 'Foreign', 'Approved')).success, false); assert.equal(writes, 0);
    assert.equal((await createAdviserFeedback(1, 7, 'Not under review', 'Approved')).success, false);
    assert.equal((await startSubmissionReview(1, 7)).success, true);
    assert.equal((await startSubmissionReview(1, 7)).success, false);
    for (const [comments, decision] of [['', 'Approved'], ['Comments', 'Invalid']]) assert.equal((await createAdviserFeedback(1, 7, comments, decision)).success, false);
    assert.equal((await createAdviserFeedback(1, 7, 'Authorized', 'Revision Required')).success, true);
    for (const status of ['Approved', 'Revision Required']) { reviewStatus = status; assert.equal((await startSubmissionReview(1, 7)).success, false); assert.equal((await createAdviserFeedback(1, 7, 'Again', 'Approved')).success, false); }
    assert.equal(writes, 2);
    for (const role of [1, 3, 4]) { session.roleId = role; await assert.rejects(service.getAdviserSubmissionsDirectory, /redirect/); }
    session = null; await assert.rejects(service.getAdviserSubmissionsDirectory, /redirect/);
    console.log('PASS project-ID grouping/multiple projects, timestamp/ID recency independent of version label, history order, distinct version counts, historical filters, normalized search, exact links, role/account/ID denials, foreign read/review/feedback isolation, original review-transition and validation rules, exact feedback, safe failures and minimal DTO. No DB writes.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
