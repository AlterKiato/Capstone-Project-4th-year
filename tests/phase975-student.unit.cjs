/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const Module = require('node:module');
const { resolveResearchTarget } = require('../lib/student-research-view.ts');
const model = {
    projects: [{ id: 2 }, { id: 1 }], submissions: [
        { id: 12, paperId: 1, version: 'v2', submittedAt: '2026-10-02', feedback: [] },
        { id: 11, paperId: 1, version: 'v1', submittedAt: '2026-10-01', feedback: [{ id: 91 }] },
        { id: 21, paperId: 2, version: 'v1', submittedAt: '2026-10-03', feedback: [{ id: 92 }] },
    ],
};
const blank = { project: undefined, submission: undefined, feedback: undefined };
assert.equal(resolveResearchTarget(model, blank).project.id, 2);
let view = resolveResearchTarget(model, { project: '1', submission: '11', feedback: '91' });
assert.equal(view.expandedId, 11); assert.equal(view.feedbackId, 91);
assert.deepEqual(view.submissions.map(item => item.id), [12, 11]);
for (const bad of ['0', '-1', '999', '1e0', '9007199254740992', ['1', '2']]) {
    view = resolveResearchTarget(model, { project: bad, submission: '11', feedback: '91' });
    assert.equal(view.project.id, 2); assert.equal(view.expandedId, 21); assert.equal(view.feedbackId, undefined);
}
view = resolveResearchTarget(model, { project: '1', submission: '21', feedback: '92' });
assert.equal(view.expandedId, 12); assert.equal(view.feedbackId, undefined);
assert.equal(resolveResearchTarget({ projects: [], submissions: [] }, blank).expandedId, null);

let active = true, role = 3, memberCalls = 0, paperCalls = [], feedbackCalls = [], creationCalls = [], failCreation = false;
const at = new Date('2026-10-01T00:00:00Z');
const mocks = {
    'server-only': {},
    '@/lib/auth/authorization': { requireRole: async () => ({ userId: 7, roleId: 3 }) },
    './dashboard-account.service': { getDashboardAccount: async () => active ? { roleId: role, email: 'synthetic@example.invalid' } : null },
    './student-research.service': {
        getStudentResearchGroups: async () => ({ success: true, data: [{ id: 1, groupName: 'Synthetic', strand: 'STEM' }] }),
        getStudentResearchProjects: async () => ({ success: true, data: [{ id: 2, groupId: 1, createdAt: at, updatedAt: at }, { id: 1, groupId: 1, createdAt: at, updatedAt: at }] }),
    },
    './submission.service': { getSubmissionsByPaper: async id => { paperCalls.push(id); return { success: true, data: [{ id: id * 10, paperId: id, submittedBy: id === 1 ? 8 : 7, submittedAt: at, fileUrl: 'PRIVATE_PATH', version: 'v1' }] }; } },
    './student-feedback.service': { getStudentFeedbackBySubmission: async id => { feedbackCalls.push(id); return { success: true, data: [{ id: 90, createdAt: at, comments: 'Synthetic', teacherId: 999 }] }; } },
    '@/lib/repositories/group-member.repository': { findGroupMembersByGroupId: async id => { memberCalls++; assert.equal(id, 1); return [{ id: 1, userId: 7 }]; } },
    '@/lib/repositories/user.repository': { findUserById: async () => ({ firstName: 'Synthetic', lastName: 'Student', password: 'PRIVATE_PASSWORD' }) },
};
const original = Module._load;
Module._load = function(id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args); };
const { getStudentWorkspace } = require('../lib/services/student-workspace.service.ts');
mocks['@/lib/services/dashboard-account.service'] = mocks['./dashboard-account.service'];
mocks['@/lib/services/student-research.service'] = { createStudentResearch: async (data, studentId) => {
    creationCalls.push({ data, studentId }); if (failCreation) throw new Error('PRIVATE_ERROR');
    return { success: true, data: { id: 123 } };
} };
mocks['next/cache'] = { revalidatePath: () => {} };
const { createStudentResearchAction } = require('../lib/actions/student-research.action.ts');
async function main() {
    active = false; assert.equal(await getStudentWorkspace(), null); assert.equal(memberCalls, 0);
    active = true; role = 2; assert.equal(await getStudentWorkspace(), null); assert.equal(memberCalls, 0);
    role = 3;
    const result = await getStudentWorkspace();
    assert.deepEqual(paperCalls.sort(), [1, 2]); assert.deepEqual(feedbackCalls, [20]);
    assert.equal(result.groups[0].members[0].name, 'Synthetic Student');
    assert.equal(result.submissions.find(item => item.id === 10).feedbackRestricted, true);
    assert.ok(!JSON.stringify(result).includes('PRIVATE_')); assert.ok(!JSON.stringify(result).includes('teacherId'));
    const form = new FormData(); form.set('groupId', '1'); form.set('title', 'Synthetic title'); form.set('abstract', 'Synthetic abstract'); form.set('category', ''); form.set('keywords', ''); form.set('userId', '999');
    active = false; assert.equal((await createStudentResearchAction(form)).success, false); assert.equal(creationCalls.length, 0);
    active = true; form.set('title', ''); assert.equal((await createStudentResearchAction(form)).success, false); assert.equal(creationCalls.length, 0);
    form.set('title', 'Synthetic title');
    assert.equal((await createStudentResearchAction(form)).projectId, 123);
    assert.equal((await createStudentResearchAction(form)).success, true); assert.equal(creationCalls.length, 2);
    assert.equal(creationCalls[0].studentId, 7); assert.equal(creationCalls[0].data.groupId, 1);
    failCreation = true; const failure = await createStudentResearchAction(form); assert.equal(failure.success, false); assert.ok(!failure.message.includes('PRIVATE_'));
    console.log('PASS Student target authorization, cross-project isolation, deterministic defaults, denied account/role, member names, submitter-only feedback and minimized DTO. No DB/storage operations.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
