/* eslint-disable @typescript-eslint/no-require-imports */
// Actual request actions/domain services with isolated persistence/scheduling boundaries only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, mocks = {}, globals = {}) {
    const exports = {}, localRequire = createRequire(resolve(path));
    vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, { exports, require: id => id === 'server-only' ? {} : Object.hasOwn(mocks, id) ? mocks[id] : localRequire(id),
        Buffer, URL, performance, AbortController, setTimeout, clearTimeout, ...globals });
    return exports;
}
const plain = value => JSON.parse(JSON.stringify(value));

test('actual upload action maps fresh server callback v1/v2 to Adviser events; failures and ordinary completed results do not schedule', async () => {
    const events = [], revalidations = [];
    let version = 'v1', fresh = true, success = true;
    const actions = load('lib/actions/submission-upload.action.ts', {
        'next/cache': { revalidatePath: path => revalidations.push(path) },
        '@/lib/push/request': { requestResearchPush: () => event => events.push(event) },
        '@/lib/services/submission-upload.service': { submissionUploads: { finalize: async (id, committed) => {
            assert.equal(id, 'opaque-intent'); if (fresh && success) committed(22, version);
            return { success, code: success ? 'completed' : 'unavailable', version, message: 'Synthetic' };
        } } },
    });
    assert.equal((await actions.finalizeSubmissionUploadAction('opaque-intent')).success, true);
    version = 'v2'; await actions.finalizeSubmissionUploadAction('opaque-intent');
    fresh = false; await actions.finalizeSubmissionUploadAction('opaque-intent');
    success = false; await actions.finalizeSubmissionUploadAction('opaque-intent');
    assert.deepEqual(plain(events), [{ recipientId: 22, event: 'initial-submission' }, { recipientId: 22, event: 'revised-submission' }]);
    assert.equal(revalidations.length, 6);
});

function feedbackFixture(changes = {}) {
    const state = { active: true, owned: true, status: 'Under Review', failCommit: false, failNotification: false, ...changes };
    const order = [], inApp = [], scheduled = [], writes = [];
    const notifications = load('lib/services/notification.service.ts', {
        '@/lib/repositories/notification.repository': { createNotification: async (userId, title, message) => {
            order.push('in-app'); if (state.failNotification) throw Error('synthetic private database error');
            const record = { id: 1, userId, title, message }; inApp.push(record); return record;
        } },
        '@/lib/auth/authorization': {}, '@/lib/services/dashboard-account.service': {},
    });
    const service = load('lib/services/adviser-feedback.service.ts', {
        '@/lib/auth/research-mutation-account': { getActiveResearchActor: async (role, id) => state.active && role === 2 && id === 7 ? 7 : null },
        '@/lib/repositories/research-group.repository': { findResearchGroupsByAdviserId: async id => [{ id: id === 7 ? 100 : 200 }] },
        '@/lib/repositories/adviser-submission.repository': { findSubmissionForAdviser: async (id, groups) =>
            state.owned && id === 5 && groups[0] === 100 ? { id, paperId: 10, submittedBy: 99, version: 'v2', status: state.status, researchTitle: 'PRIVATE research title' } : null },
        '@/lib/repositories/feedback.repository': { persistAdviserDecision: async data => {
            order.push('transaction'); if (state.failCommit) throw Error('synthetic transaction failure');
            writes.push(data); order.push('committed'); return { ...data, id: 1 };
        } },
        '@/lib/services/notification.service': notifications,
    }, { console: { error: () => {} } });
    const action = load('lib/actions/adviser-feedback.action.ts', {
        'next/cache': { revalidatePath: () => {} }, '@/lib/auth/authorization': { requireRole: async roles => {
            assert.deepEqual(plain(roles), [2]); return { userId: 7, roleId: 2 };
        } },
        '@/lib/push/request': { requestResearchPush: () => event => { order.push('scheduled'); scheduled.push(event); if (state.failSchedule) throw Error('synthetic after failure'); } },
        '@/lib/services/adviser-feedback.service': service,
    });
    const form = decision => { const data = new FormData(); data.set('submissionId', '5'); data.set('comments', 'PRIVATE feedback body'); data.set('decision', decision); return data; };
    return { state, action, service, form, order, inApp, scheduled, writes };
}
test('actual Adviser action/service sends revision/approval only to persisted submitter after commit; in-app contents remain unchanged', async () => {
    for (const [decision, event, title] of [['Revision Required', 'revision-required', 'Research Submission Revision Required'], ['Approved', 'approved', 'Research Submission Approved']]) {
        const f = feedbackFixture(); assert.equal((await f.action.createAdviserFeedbackAction(f.form(decision))).success, true);
        assert.deepEqual(plain(f.scheduled), [{ recipientId: 99, event }]);
        assert.deepEqual(f.order, ['transaction', 'committed', 'scheduled', 'in-app']);
        assert.equal(f.writes[0].comments, 'PRIVATE feedback body'); assert.equal(f.writes[0].decision, decision);
        assert.equal(f.inApp.length, 1); assert.equal(f.inApp[0].userId, 99); assert.equal(f.inApp[0].title, title);
        assert.ok(f.inApp[0].message.includes('PRIVATE research title')); assert.ok(!JSON.stringify(f.scheduled).includes('PRIVATE'));
    }
});
test('Adviser authorization, validation and failed transactions schedule nothing; scheduling/in-app failures preserve academic success independently', async () => {
    for (const patch of [{ active: false }, { owned: false }, { status: 'Submitted' }]) {
        const f = feedbackFixture(patch); assert.equal((await f.action.createAdviserFeedbackAction(f.form('Approved'))).success, false);
        assert.equal(f.scheduled.length, 0); assert.equal(f.writes.length, 0);
    }
    const invalid = feedbackFixture(); assert.equal((await invalid.action.createAdviserFeedbackAction(invalid.form('Rejected'))).success, false); assert.equal(invalid.scheduled.length, 0);
    const failed = feedbackFixture({ failCommit: true });
    await assert.rejects(failed.action.createAdviserFeedbackAction(failed.form('Approved'))); assert.equal(failed.scheduled.length, 0); assert.equal(failed.inApp.length, 0);
    const schedule = feedbackFixture({ failSchedule: true });
    assert.equal((await schedule.action.createAdviserFeedbackAction(schedule.form('Approved'))).success, true); assert.equal(schedule.inApp.length, 1);
    const notification = feedbackFixture({ failNotification: true });
    assert.equal((await notification.action.createAdviserFeedbackAction(notification.form('Approved'))).success, true); assert.equal(notification.scheduled.length, 1); assert.equal(notification.writes.length, 1);
});
test('actual request adapter uses Next after, lazy delivery and only structured outcome logging; disabled configuration stays inert', async () => {
    const delivery = load('lib/push/delivery.ts'), scheduler = load('lib/push/schedule.ts', { './delivery': delivery });
    const jobs = [], delivered = [], logs = []; let enabled = true;
    const adapter = load('lib/push/request.ts', {
        'next/server': { after: job => jobs.push(job) }, './config': { pushDeliveryConfiguration: () => enabled ? {} : null }, './schedule': scheduler,
        '@/lib/services/research-push.service': { deliverResearchPush: async (target, budget) => { budget.check(); delivered.push(target); return 'accepted'; } },
    }, { console: { info: (...args) => logs.push(args) } });
    adapter.requestResearchPush()({ event: 'approved', recipientId: 99 }); assert.equal(jobs.length, 1); assert.equal(delivered.length, 0);
    await jobs[0](); assert.deepEqual(plain(delivered), [{ event: 'approved', recipientId: 99 }]);
    assert.deepEqual(plain(logs), [['research_push', { outcome: 'accepted' }]]);
    enabled = false; adapter.requestResearchPush()({ event: 'approved', recipientId: 99 }); assert.equal(jobs.length, 1);
    for (const path of ['app/dashboard/student/submissions/page.tsx', 'app/dashboard/adviser/submissions/[submissionId]/page.tsx']) {
        const source = readFileSync(path, 'utf8'); assert.match(source, /export const runtime = "nodejs"/); assert.match(source, /export const maxDuration = 60/);
    }
});
