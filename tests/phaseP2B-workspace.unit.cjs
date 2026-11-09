/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { PgDialect } = require('drizzle-orm/pg-core');
const { SubmissionPdfAccess, PDF_ACCESS_WINDOW_MS, ADVISER_REVIEW_PDF_RENEWAL_SECONDS } = require('../lib/utils/submission-pdf-access.ts');
const { createReviewConfirmation, matchesReviewConfirmation } = require('../lib/utils/review-confirmation.ts');

function clock() {
    let now = 1000, serial = 0;
    const timers = new Map();
    return { now: () => now, advance: n => { now += n; }, timers,
        schedule: (fn, ms) => { const id = ++serial; timers.set(id, { fn, at: now + ms }); return id; }, cancel: id => timers.delete(id) };
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function access(id, sign, c) { return new SubmissionPdfAccess(id, sign, c.now, c.schedule, c.cancel); }

test('official Swipe Toast can pre-render without window/document and retains accessible dismissal', () => {
    const React = require('react'), { renderToString } = require('react-dom/server');
    const sandbox = vm.createContext({ exports: {}, require: id => id.endsWith('.css') ? {} : require(id) });
    const compiled = ts.transpileModule(readFileSync(require.resolve('../components/react-bits/SwipeToast.tsx'), 'utf8'),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInContext(compiled, sandbox);
    const html = renderToString(React.createElement(sandbox.exports.default, { title: 'Unsaved feedback', duration: 7000, closeButton: true }));
    assert.match(html, /Unsaved feedback/); assert.match(html, /role="status"/);
    assert.match(html, /aria-label="Dismiss unsaved feedback notification"/);
    assert.match(html, /data-mounted="false"/);
});

test('Adviser review remains available until exactly 28 minutes and renews only explicitly', async () => {
    assert.equal(ADVISER_REVIEW_PDF_RENEWAL_SECONDS, 1680);
    assert.equal(PDF_ACCESS_WINDOW_MS, 1_680_000);
    const c = clock(); let calls = 0;
    const pdf = access(16, async () => 'synthetic-' + ++calls, c);
    await pdf.request();
    c.advance(240_000); pdf.reassess();
    assert.equal(pdf.validUrl(), 'synthetic-1', 'The former four-minute deadline no longer expires Adviser access');
    c.advance(1_439_999); pdf.reassess(); assert.equal(pdf.validUrl(), 'synthetic-1');
    c.advance(1); [...c.timers.values()][0].fn();
    assert.equal(pdf.snapshot().phase, 'expired'); assert.equal(pdf.validUrl(), null);
    assert.equal(calls, 1); assert.equal(c.timers.size, 0);
    await pdf.request(); assert.equal(pdf.validUrl(), 'synthetic-2'); assert.equal(calls, 2);
    pdf.dispose(); assert.equal(c.timers.size, 0);
});

test('default browser timers retain their global receiver when requesting and disposing', async () => {
    const sandbox = vm.createContext({ exports: {} });
    vm.runInContext(`
        globalThis.timers = new Map(); let serial = 0;
        globalThis.setTimeout = function(fn, delay) {
            if (this !== globalThis) throw new TypeError('Illegal invocation');
            const id = ++serial; timers.set(id, {fn, delay}); return id;
        };
        globalThis.clearTimeout = function(id) {
            if (this !== globalThis) throw new TypeError('Illegal invocation');
            timers.delete(id);
        };
    `, sandbox);
    const compiled = ts.transpileModule(readFileSync(require.resolve('../lib/utils/submission-pdf-access.ts'), 'utf8'),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInContext(compiled, sandbox);
    const pdf = new sandbox.exports.SubmissionPdfAccess(16, async () => 'synthetic-capability');
    assert.equal(await pdf.request(), 'synthetic-capability');
    assert.equal(pdf.snapshot().phase, 'available'); assert.equal(sandbox.timers.size, 1);
    pdf.dispose(); assert.equal(sandbox.timers.size, 0);
});

test('confirmation captures a frozen independent copy of the exact submission, decision and comments', () => {
    const draft = { submissionId: 16, comments: ' Synthetic comments\nsecond line ', decision: 'Approved' };
    const confirmation = createReviewConfirmation(draft);
    assert.deepEqual(confirmation, draft); assert.notEqual(confirmation, draft); assert.ok(Object.isFrozen(confirmation));
    draft.comments = 'Changed'; draft.submissionId = 17;
    assert.equal(confirmation.submissionId, 16); assert.equal(confirmation.comments, ' Synthetic comments\nsecond line ');
});

test('any submission, comment or decision mismatch rejects stale confirmation', () => {
    const draft = { submissionId: 16, comments: 'Synthetic feedback', decision: 'Revision Required' };
    const confirmation = createReviewConfirmation(draft);
    assert.equal(matchesReviewConfirmation(confirmation, { ...draft }), true);
    for (const changed of [{ submissionId: 17 }, { comments: 'Synthetic feedback ' }, { decision: 'Approved' }]) {
        assert.equal(matchesReviewConfirmation(confirmation, { ...draft, ...changed }), false);
    }
});

test('root typography configures one variable Manrope font with swap and applies its variable globally', () => {
    const requests = [], sandbox = vm.createContext({ exports: {}, require: name => {
        if (name === 'next/font/google') return { Manrope: options => { requests.push(options); return { variable: 'manrope-test-variable' }; } };
        if (name === './globals.css') return {};
        if (name === '@/components/theme-provider') return { ThemeProvider: () => null };
        if (name === '@/lib/theme') return { THEME_INITIALIZATION: '' };
        return require(name);
    } });
    vm.runInContext(ts.transpileModule(readFileSync(require.resolve('../app/layout.tsx'), 'utf8'),
        { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, sandbox);
    const root = sandbox.exports.default({ children: null });
    assert.equal(requests.length, 1); assert.equal(requests[0].variable, '--font-manrope');
    assert.equal(requests[0].display, 'swap'); assert.equal(requests[0].subsets[0], 'latin');
    assert.ok(requests[0].fallback.includes('Arial')); assert.match(root.props.className, /manrope-test-variable/);
    assert.equal(requests[0].weight, undefined, 'Keep the variable font weight range');
    assert.match(readFileSync('public/licenses/manrope-OFL.txt', 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/);
});

test('timer initialization failures terminate requesting state and permit a safe retry', async () => {
    const c = clock(); let fail = true, signs = 0;
    const pdf = new SubmissionPdfAccess(16, async () => { signs++; return 'synthetic-capability'; }, c.now,
        (fn, ms) => { if (fail) throw TypeError('Illegal invocation'); return c.schedule(fn, ms); }, c.cancel);
    assert.equal(await pdf.request(), null); assert.equal(pdf.snapshot().phase, 'unavailable');
    assert.equal(signs, 0); assert.equal(pdf.snapshot().url, null);
    fail = false;
    assert.equal(await pdf.request(), 'synthetic-capability'); assert.equal(c.timers.size, 1);
    pdf.dispose(); assert.equal(c.timers.size, 0);
});

test('repeated requests retain one timer and cancelled callbacks cannot expire a newer request', async () => {
    const c = clock(); let signs = 0;
    const pdf = access(16, async () => 'synthetic-' + ++signs, c);
    await pdf.request(); const staleTimer = [...c.timers.values()][0].fn;
    c.advance(1000); await pdf.request(); assert.equal(c.timers.size, 1);
    c.advance(PDF_ACCESS_WINDOW_MS); staleTimer();
    assert.equal(pdf.snapshot().phase, 'available', 'A cancelled generation must not change current state');
    pdf.reassess(); assert.equal(pdf.snapshot().phase, 'expired');
    assert.equal(c.timers.size, 0); pdf.dispose();
});

test('disposal finishes even if cancellation throws; pending responses and timer callbacks stay inert', async () => {
    const c = clock(), pending = deferred(); let updates = 0;
    const pdf = new SubmissionPdfAccess(16, () => pending.promise, c.now, c.schedule,
        () => { throw TypeError('synthetic cancellation failure'); });
    pdf.subscribe(() => updates++);
    const request = pdf.request(), callback = [...c.timers.values()][0].fn;
    assert.doesNotThrow(() => pdf.dispose()); const disposedUpdates = updates;
    c.advance(PDF_ACCESS_WINDOW_MS + 1); callback(); pdf.reassess();
    pending.resolve('synthetic-stale');
    assert.equal(await request, null); assert.equal(updates, disposedUpdates);
    assert.equal(pdf.snapshot().phase, 'idle'); assert.equal(pdf.validUrl(), null);
    assert.equal(await pdf.request(), null);
});

test('PDF access is explicit, bound to its ID, deduplicated, and expires from request start including latency', async () => {
    const c = clock(), pending = deferred(), calls = [];
    const pdf = access(12, id => { calls.push(id); return pending.promise; }, c);
    assert.equal(pdf.snapshot().url, null); assert.deepEqual(calls, []);
    const request = pdf.request(); assert.equal(await pdf.request(), null);
    c.advance(30_000); pending.resolve('synthetic-capability');
    assert.equal(await request, 'synthetic-capability'); assert.deepEqual(calls, [12]);
    assert.equal(pdf.snapshot().deadline, 1000 + PDF_ACCESS_WINDOW_MS);
    assert.equal([...c.timers.values()][0].at, 1000 + PDF_ACCESS_WINDOW_MS);
    c.advance(PDF_ACCESS_WINDOW_MS - 30_000);
    [...c.timers.values()][0].fn();
    assert.equal(pdf.snapshot().phase, 'expired'); assert.equal(pdf.snapshot().url, null);
    assert.deepEqual(calls, [12], 'Expiry must not sign automatically');
    pdf.dispose(); assert.equal(c.timers.size, 0);
});

test('foreground reassessment clears expired capabilities and renewal requires a new explicit request', async () => {
    const c = clock(); let calls = 0;
    const pdf = access(3, async () => 'synthetic-' + ++calls, c);
    await pdf.request(); c.advance(PDF_ACCESS_WINDOW_MS + 1); pdf.reassess();
    assert.equal(pdf.validUrl(), null); assert.equal(calls, 1);
    await pdf.request(); assert.equal(pdf.validUrl(), 'synthetic-2'); assert.equal(calls, 2);
    pdf.dispose();
});

test('a signing request that hangs past the local deadline permits renewal and its late result is ignored', async () => {
    const c = clock(), pending = deferred(); let calls = 0;
    const pdf = access(8, () => ++calls === 1 ? pending.promise : Promise.resolve('renewed'), c);
    const old = pdf.request(); c.advance(PDF_ACCESS_WINDOW_MS + 1); [...c.timers.values()][0].fn();
    assert.equal(pdf.snapshot().phase, 'expired'); assert.equal(pdf.snapshot().url, null);
    assert.equal(await pdf.request(), 'renewed');
    pending.resolve('stale'); assert.equal(await old, null); assert.equal(pdf.validUrl(), 'renewed'); pdf.dispose();
});

test('late, failed and disposed signing responses cannot activate a PDF or cross submission boundaries', async () => {
    const c = clock(), slow = deferred();
    const first = access(1, () => slow.promise, c), second = access(2, async () => 'second-only', c);
    const stale = first.request(); first.dispose(); first.activate();
    await second.request(); slow.resolve('first-only'); assert.equal(await stale, null);
    assert.equal(first.snapshot().url, null); assert.equal(second.snapshot().submissionId, 2);
    assert.equal(second.validUrl(), 'second-only');
    const late = deferred(), expired = access(4, () => late.promise, c), lateRequest = expired.request();
    c.advance(PDF_ACCESS_WINDOW_MS + 1); late.resolve('too-late');
    assert.equal(await lateRequest, null); assert.equal(expired.snapshot().phase, 'expired');
    const failed = access(5, async () => { throw Error('synthetic failure'); }, c);
    assert.equal(await failed.request(), null); assert.equal(failed.snapshot().phase, 'unavailable');
    second.dispose(); expired.dispose(); failed.dispose(); first.dispose();
});

const rows = [
    { id: 1, paperId: 10, adviserId: 7, version: 'v2', status: 'Submitted' },
    { id: 2, paperId: 10, adviserId: 7, version: 'v1', status: 'Revision Required' },
    { id: 3, paperId: 20, adviserId: 8, version: 'v1', status: 'Submitted' },
    { id: 4, paperId: 11, adviserId: 7, version: 'v1', status: 'Approved' },
];
const state = { role: 2, active: true, actorId: 7, persisted: 'Submitted', race: null, writes: 0, predicates: [], metadataCalls: 0 };
const dialect = new PgDialect();
const db = {
    transaction: async fn => fn({ update: () => ({ set: values => ({ where: predicate => ({ returning: async () => {
        const query = dialect.sqlToQuery(predicate); state.predicates.push(query);
        if (state.race) state.persisted = state.race;
        if (!query.params.includes('Submitted') || state.persisted === 'Submitted') {
            state.persisted = values.status; state.writes++; return [{ id: 1, status: state.persisted }];
        }
        return [];
    } }) }) }) }),
    select: columns => ({ from: () => {
        const chain = { innerJoin: () => chain, where: predicate => ({ orderBy: async () => {
            state.metadataCalls++;
            assert.deepEqual(Object.keys(columns).sort(), ['id', 'status', 'version']);
            const query = dialect.sqlToQuery(predicate);
            assert.match(query.sql, /main_adviser_designation/); assert.match(query.sql, /submissions.*paper_id/);
            return rows.filter(row => row.paperId === query.params[0] && state.actorId === 7)
                .map(({ id, version, status }) => ({ id, version, status }));
        } }) }; return chain;
    } }),
};
const mocks = {
    'server-only': {}, '@/lib/db': { db },
    '@/lib/auth/current-account': { getCurrentAccount: async () => state.active ? { userId: state.actorId, roleId: state.role } : null },
    '@/lib/auth/main-adviser': { getCurrentMainAdviser: async expected => state.active && state.role === 2 && state.actorId === 7 && (expected === undefined || expected === 7) ? { userId: 7, roleId: 2 } : null },
    '@/lib/repositories/co-adviser.repository': { readDelegatedDocument: async () => null },
    '@/lib/auth/authorization': { requireRole: async roles => { if (!state.active || !roles.includes(state.role)) throw Error('DENIED'); return { userId: state.actorId, roleId: state.role }; } },
    './dashboard-account.service': { getDashboardAccount: async () => state.active ? { roleId: state.role } : null },
    '@/lib/auth/research-mutation-account': { getActiveResearchActor: async (role, id) => state.active && state.role === role && id === state.actorId },
    '@/lib/repositories/user.repository': { findUserByIdForUpdate: async () => ({ isActive: state.active, roleId: state.role }), findUserById: async id => ({ id, isActive: state.active, roleId: state.role }) },
    '@/lib/repositories/research-group.repository': { findResearchGroupsForMainAdviser: async () => [{ id: 100 }, { id: 200 }], findResearchGroupById: async () => ({ id: 100, adviserId: 8 }) },
    '@/lib/repositories/research-paper.repository': { findResearchPaperById: async () => ({ id: 10, groupId: 100 }) },
    '@/lib/repositories/group-member.repository': { findGroupMember: async () => null },
    '@/lib/repositories/adviser-review-details.repository': { readOwnedSubmissionFeedback: async id => [{ submissionId: id, comments: 'Synthetic feedback' }] },
};
const original = Module._load;
Module._load = function(id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args); };
const supervision = require('../lib/repositories/research-supervision.repository.ts');
mocks['./research-supervision.repository'] = { ...supervision, lockCurrentMainAdviser: async () => state.active && state.role === 2 && state.actorId === 7 ? [] : null };
const repository = require('../lib/repositories/submission.repository.ts');
const metadata = require('../lib/repositories/adviser-submission.repository.ts');
let signCalls = 0;
mocks['@/lib/repositories/submission.repository'] = { ...repository, findSubmissionById: async id => id === 1 ? { id, paperId: 10, version: 'v2', fileUrl: 'research/10/v2/synthetic.pdf' } : undefined };
mocks['@/lib/services/storage.service'] = { createResearchDocumentSignedUrl: async (path, ttl) => { assert.equal(path, 'research/10/v2/synthetic.pdf'); assert.equal(ttl, 300); signCalls++; return 'synthetic-capability'; } };
mocks['@/lib/repositories/adviser-submission.repository'] = {
    ...metadata,
    findSubmissionForAdviser: async (id, groups) => {
        const row = rows.find(row => row.id === id && groups.includes(row.adviserId === 7 ? 100 : 200));
        return row ? { ...row, groupId: groups[0], fileUrl: 'PRIVATE_PATH', status: 'Submitted' } : undefined;
    },
};
const ui = require('../lib/services/adviser-submissions-ui.service.ts');
const review = require('../lib/services/adviser-review.service.ts');
const documentAccess = require('../lib/actions/storage.action.ts');
Module._load = original;

test('version metadata is minimal and project scoped for current Main; other Advisers and roles are denied before querying', async () => {
    const detail = await ui.getAdviserReviewDetails(1);
    assert.deepEqual(detail.versions.map(row => row.id), [1, 2]);
    assert.ok(!JSON.stringify(detail.versions).includes('PRIVATE_PATH'));
    assert.equal(detail.feedback[0].submissionId, 1);
    assert.deepEqual((await ui.getAdviserReviewDetails(3)).versions.map(row => row.id), [3], 'Main may inspect foreign historical ownership');
    const calls = state.metadataCalls;
    state.actorId = 8; assert.equal(await ui.getAdviserReviewDetails(3), null); assert.equal(state.metadataCalls, calls); state.actorId = 7;
    for (const role of [1, 3, 4]) { state.role = role; await assert.rejects(ui.getAdviserReviewDetails(1), /DENIED/); }
    state.role = 2; state.active = false; await assert.rejects(ui.getAdviserReviewDetails(1), /DENIED/);
    state.active = true; assert.equal(state.metadataCalls, calls);
});

test('Start Review SQL prevents stale Approved/Revision Required and repeated requests from overwriting state', async () => {
    for (const later of ['Approved', 'Revision Required', 'Under Review']) {
        state.persisted = 'Submitted'; state.race = later; const writes = state.writes;
        const result = await review.startSubmissionReview(1, 7);
        assert.equal(result.success, false); assert.match(result.message, /Refresh/);
        assert.equal(state.persisted, later); assert.equal(state.writes, writes);
    }
    state.race = null; state.persisted = 'Submitted';
    assert.equal((await review.startSubmissionReview(1, 7)).success, true);
    const writes = state.writes;
    assert.equal((await review.startSubmissionReview(1, 7)).success, false); assert.equal(state.writes, writes);
    assert.match(state.predicates.at(-1).sql, /status/); assert.ok(state.predicates.at(-1).params.includes('Submitted'));
    state.active = false; assert.equal(await repository.updateSubmissionStatusForAdviser(1, 'Under Review', 7), undefined);
    state.active = true; state.actorId = 8; assert.equal((await review.startSubmissionReview(3, 8)).success, false); state.actorId = 7;
});

test('the existing document action enforces active roles and current Main authority before exact-version signing', async () => {
    state.actorId = 7; state.role = 2; state.active = true;
    assert.equal(await documentAccess.getSubmissionDownloadUrlAction(1), 'synthetic-capability');
    assert.equal(signCalls, 1);
    for (const id of [0, -1, 1.5, 2]) assert.equal(await documentAccess.getSubmissionDownloadUrlAction(id), null);
    state.actorId = 8; assert.equal(await documentAccess.getSubmissionDownloadUrlAction(1), null);
    for (const role of [1, 4]) { state.role = role; await assert.rejects(documentAccess.getSubmissionDownloadUrlAction(1), /DENIED/); }
    state.role = 2; state.active = false; await assert.rejects(documentAccess.getSubmissionDownloadUrlAction(1), /DENIED/);
    assert.equal(signCalls, 1); state.active = true; state.actorId = 7;
});
