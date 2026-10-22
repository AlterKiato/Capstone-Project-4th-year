/* eslint-disable @typescript-eslint/no-require-imports */
// Real actions/services/repositories and PDF validation, deterministic transactional
// database + private-storage doubles. No environment, database connection or network.
const assert = require('node:assert/strict');
const Module = require('node:module');
const { getTableName } = require('drizzle-orm');
const { PgDialect } = require('drizzle-orm/pg-core');
const dialect = new PgDialect();
const diagnostics = [], originalError = console.error;
console.error = (...args) => diagnostics.push(args);
let session, accounts, state, objects, events, onUpload, onPaperLock, onAccountLock;
let failInsert = false, failCleanup = false, failActivity = false, noticeFailure = false;
let groupActive = true, membership = true, ownGroup = true, transactions = 0;
const pdf = () => new File(['%PDF-1.7\nsynthetic F1'], 'synthetic.pdf', { type: 'application/pdf' });
const account = (id, roleId) => ({ id, roleId, isActive: true });
const actor = role => { session = { userId: role === 3 ? 30 : 20, roleId: role }; };
function reset() {
    accounts = [account(20, 2), account(30, 3), account(99, 1)];
    state = { submissions: [], research_papers: [{ id: 10, groupId: 5, title: 'Synthetic F1', status: 'Draft' }, { id: 11, groupId: 5, title: 'Second project', status: 'Draft' }], feedbacks: [], activity_logs: [], notifications: [] };
    objects = new Map([['unrelated.pdf', Buffer.from('preserved')]]); events = [];
    onUpload = onPaperLock = onAccountLock = null;
    failInsert = failCleanup = failActivity = noticeFailure = false;
    groupActive = membership = ownGroup = true; transactions = 0; actor(3);
}
function matches(row, predicate) {
    if (!predicate) return true;
    const { sql, params } = dialect.sqlToQuery(predicate);
    const comparisons = [...sql.matchAll(/"\w+"\."(\w+)" = \$(\d+)/g)];
    assert.ok(comparisons.length, 'unsupported predicate: ' + sql);
    const names = { paper_id: 'paperId', role_id: 'roleId', is_active: 'isActive' };
    return comparisons.every(([, column, index]) => row[names[column] || column] === params[Number(index) - 1]);
}
function executor(draft = state, context = null) {
    const rows = table => getTableName(table) === 'users' ? accounts : draft[getTableName(table)];
    const write = table => {
        assert.ok(context, 'writes must be transactional');
        assert.ok(context.locked, 'actor account lock must precede every protected write');
        events.push('write:' + getTableName(table));
    };
    return {
        query: { users: { findFirst: async ({ where }) => {
            events.push(context ? 'account:transaction-read' : 'account:initial-read');
            return structuredClone(accounts.find(row => matches(row, where)));
        } } },
        execute: async query => {
            assert.match(dialect.sqlToQuery(query).sql, /pg_advisory_xact_lock/);
            events.push('paper:lock'); if (onPaperLock) onPaperLock();
        },
        select: projection => {
            let table, predicate;
            const result = () => rows(table).filter(row => matches(row, predicate)).map(row => {
                if (!projection) return structuredClone(row);
                return Object.fromEntries(Object.keys(projection).map(key => [key, row[key]]));
            });
            const chain = {
                from(value) { table = value; return chain; },
                where(value) { predicate = value; return chain; },
                orderBy() { return chain; },
                async for(mode) {
                    assert.equal(getTableName(table), 'users'); assert.equal(mode, 'update');
                    assert.ok(context); if (onAccountLock) onAccountLock();
                    context.locked = true; events.push('account:lock'); return result();
                },
                then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
            };
            return chain;
        },
        insert: table => ({ values: data => {
            const run = () => {
                write(table);
                if (failInsert || (failActivity && getTableName(table) === 'activity_logs')) throw Error('synthetic persistence failure');
                const row = { id: rows(table).length + 1, submittedAt: new Date('2026-10-18T00:00:00Z'), ...data };
                rows(table).push(row); return [structuredClone(row)];
            };
            return { returning: async () => run(), then: (resolve, reject) => Promise.resolve().then(run).then(resolve, reject) };
        } }),
        update: table => ({ set: data => ({ where: predicate => ({ returning: async () => {
            write(table);
            return rows(table).filter(row => matches(row, predicate)).map(row => { Object.assign(row, data); return structuredClone(row); });
        } }) }) }),
    };
}
const db = {
    query: { users: { findFirst: args => executor().query.users.findFirst(args) } },
    transaction: async operation => {
        assert.equal(transactions++, 0, 'no nested/unmanaged transactions');
        const draft = structuredClone(state), context = { locked: false };
        try { const value = await operation(executor(draft, context)); state = draft; events.push('commit'); return value; }
        catch (error) { events.push('rollback'); throw error; }
        finally { context.locked = false; transactions--; }
    },
};
const notify = async (...args) => {
    assert.equal(transactions, 0, 'notification must follow commit');
    events.push('notification'); if (!noticeFailure) state.notifications.push(args);
    return { success: !noticeFailure, message: 'synthetic unavailable' };
};
const mocks = {
    'server-only': {},
    '@/lib/db': { db },
    '@/lib/auth/session': { getSession: async () => session },
    'next/navigation': { redirect: path => { throw Error('REDIRECT ' + path); } },
    'next/cache': { revalidatePath: () => {} },
    '@/lib/repositories/research-paper.repository': { findResearchPaperById: async id => state.research_papers.find(paper => paper.id === id) },
    '@/lib/repositories/research-group.repository': {
        findResearchGroupById: async id => id === 5 ? { id, adviserId: 20, status: groupActive ? 'active' : 'archived' } : undefined,
        findResearchGroupsByAdviserId: async id => ownGroup && id === 20 ? [{ id: 5 }] : [{ id: 999 }],
    },
    '@/lib/repositories/group-member.repository': { findGroupMember: async (group, id) => membership && group === 5 && id === 30 ? { groupId: group, userId: id } : undefined },
    '@/lib/repositories/adviser-submission.repository': { findSubmissionForAdviser: async (id, groups) => {
        const submission = state.submissions.find(row => row.id === id);
        return submission && groups.includes(5) ? { ...submission, researchTitle: 'Synthetic F1' } : undefined;
    } },
    '@/lib/services/notification.service': { notifyAdviserNewSubmission: notify, notifyStudentSubmissionApproved: notify, notifyStudentSubmissionRevisionRequired: notify },
    '@/lib/supabase/server': { getSupabaseServerClient: () => ({ storage: { from: bucket => {
        assert.equal(bucket, 'research-submissions');
        return {
            upload: async (path, bytes, options) => {
                assert.equal(options.upsert, false); assert.equal(options.contentType, 'application/pdf');
                assert.equal(events.includes('account:lock'), false, 'no actor row lock across network upload');
                assert.ok(events.includes('account:transaction-read'));
                assert.ok(!objects.has(path)); objects.set(path, Buffer.from(bytes)); events.push('upload');
                if (onUpload) onUpload(); return { data: { path }, error: null };
            },
            remove: async paths => {
                events.push('cleanup'); if (failCleanup) return { error: new Error('synthetic cleanup failure') };
                for (const path of paths) { assert.notEqual(path, 'unrelated.pdf'); objects.delete(path); }
                return { error: null };
            },
        };
    } } }) },
};
const original = Module._load;
Module._load = function(id, ...args) {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    assert.ok(!/^(postgres|dotenv|@supabase\/supabase-js)$/.test(id), 'unexpected live adapter: ' + id);
    return original.call(this, id, ...args);
};
global.fetch = async () => { throw Error('network forbidden'); };
const { submitResearch } = require('../lib/services/submission.service.ts');
const { startSubmissionReview } = require('../lib/services/adviser-review.service.ts');
const { createAdviserFeedback } = require('../lib/services/adviser-feedback.service.ts');
const { submitResearchAction } = require('../lib/actions/submission.action.ts');
const { startSubmissionReviewAction } = require('../lib/actions/adviser-review.action.ts');
const { createAdviserFeedbackAction } = require('../lib/actions/adviser-feedback.action.ts');
const form = entries => { const value = new FormData(); for (const [key, data] of Object.entries(entries)) value.set(key, data); return value; };
const uploadForm = () => form({ paperId: '10', remarks: 'Synthetic F1', file: pdf(), userId: '99', roleId: '1', isActive: 'true' });
const feedbackForm = decision => form({ submissionId: '1', comments: 'Version-specific feedback', decision, adviserId: '99', roleId: '1', isActive: 'true' });
const seed = status => state.submissions.push({ id: 1, paperId: 10, submittedBy: 30, version: 'v1', fileUrl: 'research/10/v1/history.pdf', status });
const snapshot = () => JSON.stringify({ state, objects: [...objects].map(([path, bytes]) => [path, bytes.toString('hex')]) });
async function noEffects(operation, redirect = false) {
    const before = snapshot(), beforeEvents = events.length;
    if (redirect) await assert.rejects(operation, /REDIRECT \/(login|dashboard)/);
    else assert.equal((await operation()).success, false);
    assert.equal(snapshot(), before, 'denial must preserve every domain record and storage byte');
    assert.ok(!events.slice(beforeEvents).some(event => /^(write:|upload|notification|cleanup)/.test(event)));
}
async function main() {
    for (const [name, direct, action, role, status] of [
        ['upload', () => submitResearch(10, 30, pdf()), () => submitResearchAction(uploadForm()), 3, 'Submitted'],
        ['start-review', () => startSubmissionReview(1, 20), () => startSubmissionReviewAction(1), 2, 'Submitted'],
        ...['Approved', 'Revision Required'].map(decision => ['feedback ' + decision, () => createAdviserFeedback(1, 20, 'Feedback', decision), () => createAdviserFeedbackAction(feedbackForm(decision)), 2, 'Under Review']),
    ]) {
        for (const change of [
            () => { session = null; },
            () => { accounts = accounts.filter(row => row.id !== session.userId); },
            () => { accounts.find(row => row.id === session.userId).isActive = false; },
            ...[1, 2, 3, 4].filter(other => other !== role).map(other => () => { accounts.find(row => row.id === session.userId).roleId = other; }),
            ...[1, 2, 3, 4].filter(other => other !== role).map(other => () => { session.roleId = other; }),
            () => { session.userId = 0; },
            () => { session.userId = 99; }, // cannot use a supplied actor instead of session identity
        ]) {
            reset(); seed(status); actor(role); change();
            await noEffects(direct);
            // Invalid current accounts now fail at the shared action guard, before the service.
            const current = accounts.find(row => row.id === session?.userId);
            await noEffects(action, !session || session.roleId !== role || !current?.isActive || current.roleId !== session.roleId);
        }
        reset(); seed(status); actor(role); membership = ownGroup = false;
        await noEffects(direct); await noEffects(action);
        console.log('PASS ' + name + ': anonymous/missing/inactive/stale role/all wrong roles/forged actor/ownership denial; zero DB/storage/log/notice effects.');
    }

    // Revoke after initial verification, before upload or persistence lock.
    for (const revoke of [() => { accounts[1].isActive = false; }, () => { accounts[1].roleId = 4; }, () => { accounts.splice(1, 1); }]) {
        reset(); onPaperLock = revoke;
        await noEffects(() => submitResearchAction(uploadForm()));
    }
    for (const decision of [null, 'Approved', 'Revision Required']) {
        for (const revoke of [() => { accounts[0].isActive = false; }, () => { accounts[0].roleId = 3; }, () => { accounts.splice(0, 1); }]) {
            reset(); actor(2); seed(decision ? 'Under Review' : 'Submitted'); onAccountLock = revoke;
            await noEffects(() => decision ? createAdviserFeedbackAction(feedbackForm(decision)) : startSubmissionReviewAction(1));
            assert.ok(events.includes('account:lock'));
        }
    }
    console.log('PASS queued-paper and Adviser write-boundary revocation: inactive/demoted/deleted denied before writes.');

    for (const revoke of [() => { accounts[1].isActive = false; }, () => { accounts[1].roleId = 2; }, () => { accounts.splice(1, 1); }]) {
        reset(); const before = snapshot(); onUpload = revoke;
        assert.equal((await submitResearchAction(uploadForm())).success, false);
        assert.equal(snapshot(), before); assert.ok(events.includes('cleanup')); assert.ok(events.includes('rollback'));
        assert.ok(!events.some(event => event.startsWith('write:') || event === 'notification'));
    }
    reset(); failInsert = true; const beforeFailure = snapshot();
    assert.equal((await submitResearchAction(uploadForm())).success, false); assert.equal(snapshot(), beforeFailure);
    reset(); onUpload = () => { accounts[1].isActive = false; }; failCleanup = true;
    assert.equal((await submitResearchAction(uploadForm())).success, false);
    assert.equal(state.submissions.length, 0); assert.equal(state.notifications.length, 0); assert.equal(objects.size, 2);
    assert.ok(events.includes('cleanup')); // Explicit best-effort limit: the object can remain if deletion fails.
    objects.delete('research/10/v1/synthetic.pdf'); assert.equal(objects.size, 1);
    console.log('PASS upload-time revocation + insert failure: rollback and exact owned-object cleanup; failed cleanup limit exercised and synthetic object removed.');

    reset(); groupActive = false; await noEffects(() => submitResearchAction(uploadForm()));
    for (const invalid of [new File(['%PDF-1'], 'x.pdf', { type: 'text/plain' }), new File(['bad header'], 'x.pdf', { type: 'application/pdf' }), new File([], 'empty.pdf', { type: 'application/pdf' }), new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.pdf', { type: 'application/pdf' })]) {
        reset(); await noEffects(() => submitResearch(10, 30, invalid));
    }
    reset(); await noEffects(() => submitResearchAction(form({ paperId: '0', file: pdf() })));
    reset(); actor(2); seed('Under Review');
    for (const [comments, decision] of [['', 'Approved'], ['Comment', 'Invalid']]) await noEffects(() => createAdviserFeedback(1, 20, comments, decision));
    console.log('PASS existing active-group/PDF MIME/signature/empty/size/input/decision validation before external effects.');

    reset();
    assert.equal((await submitResearchAction(uploadForm())).success, true);
    assert.equal(state.submissions[0].version, 'v1'); assert.equal(state.submissions[0].submittedBy, 30);
    assert.ok(objects.get('research/10/v1/synthetic.pdf').equals(Buffer.from('%PDF-1.7\nsynthetic F1')));
    const originalV1 = { ...state.submissions[0] };
    events = []; await noEffects(() => submitResearchAction(uploadForm()));
    actor(2); assert.equal((await startSubmissionReviewAction(1)).success, true);
    assert.equal(state.submissions[0].status, 'Under Review');
    assert.equal((await createAdviserFeedbackAction(feedbackForm('Revision Required'))).success, true);
    assert.equal(state.research_papers[0].status, 'Revision Required');
    assert.equal(state.submissions[0].status, 'Revision Required');
    const history = structuredClone({ submission: state.submissions[0], feedback: state.feedbacks[0] });
    assert.equal(history.feedback.teacherId, 20); assert.equal(history.feedback.submissionId, 1);
    actor(3); events = []; assert.equal((await submitResearchAction(uploadForm())).success, true);
    assert.equal(state.submissions[1].version, 'v2'); assert.equal(state.submissions[1].submittedBy, 30);
    assert.deepEqual({ submission: state.submissions[0], feedback: state.feedbacks[0] }, history);
    assert.ok(objects.has(originalV1.fileUrl));
    actor(2); assert.equal((await startSubmissionReviewAction(2)).success, true);
    assert.equal((await createAdviserFeedback(2, 20, 'Approved v2', 'Approved')).success, true);
    assert.equal(state.submissions[1].status, 'Approved'); assert.equal(state.research_papers[0].status, 'Approved');
    assert.equal(state.feedbacks[1].submissionId, 2); assert.equal(state.activity_logs.length, 2); assert.equal(state.notifications.length, 4);
    assert.deepEqual({ submission: state.submissions[0], feedback: state.feedbacks[0] }, history);
    actor(3); events = []; assert.equal((await submitResearch(11, 30, pdf())).data.version, 'v1');
    assert.equal(state.submissions[2].paperId, 11);
    console.log('PASS authorized v1 -> start review -> Revision Required -> v2 -> Approved, paper synchronization, session actor, version-specific history/feedback, activities/notices and second project per group.');

    reset(); actor(2); seed('Under Review'); failActivity = true;
    const beforeDecision = snapshot();
    await assert.rejects(() => createAdviserFeedback(1, 20, 'Rollback', 'Approved'), /synthetic persistence/);
    assert.equal(snapshot(), beforeDecision);
    reset(); actor(2); seed('Under Review'); noticeFailure = true;
    assert.equal((await createAdviserFeedback(1, 20, 'Keep decision', 'Approved')).success, true);
    assert.equal(state.feedbacks.length, 1); assert.equal(state.activity_logs.length, 1);
    console.log('PASS atomic feedback/status/activity rollback and post-commit notification failure preserves success.');
    reset(); assert.equal(objects.size, 1); assert.equal(transactions, 0);
    assert.ok(diagnostics.some(args => String(args[0]).includes('Failed to clean up research document')));
    assert.ok(diagnostics.some(args => String(args[0]).includes('Failed to notify student')));
    console.log('PASS synthetic cleanup complete; unrelated storage sentinel preserved; zero live DB/storage/provider calls. Row-lock ordering is simulated, not real PostgreSQL scheduling acceptance.');
}
main().catch(error => { originalError(error); process.exitCode = 1; }).finally(() => { console.error = originalError; });
