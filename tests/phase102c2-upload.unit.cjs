/* eslint-disable @typescript-eslint/no-require-imports */
// Actual workflow and validators; serialized transactional repository and private Storage doubles. No external I/O.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID, createHash } = require('node:crypto');
const Module = require('node:module');
const { AsyncLocalStorage } = require('node:async_hooks');
const original = Module._load;
Module._load = function(id, ...args) { return id === 'server-only' ? {} : original.call(this, id, ...args); };
const { createSubmissionUploadWorkflow } = require('../lib/uploads/submission-upload-workflow.ts');
const { UploadFailure, UPLOAD_MAX_BYTES, stagingPathFor } = require('../lib/uploads/contract.ts');
const { assertUploadPdf } = require('../lib/services/submission-upload-storage.service.ts');
const { planUploadCleanup } = require('../lib/uploads/cleanup-plan.ts');
const { uploadPdfDirect } = require('../lib/uploads/browser-upload.ts');
Module._load = original;
const pdf = () => new Uint8Array(Buffer.from('%PDF-1.7\nsynthetic fixture'));
function fixture() {
    const state = { time: Date.now(), actor: 11, active: true, role: 3, member: true, groupStatus: 'active',
        intents: new Map(), submissions: [], objects: new Map(), notifications: [], reads: 0, writes: 0, minted: 0, activeTx: 0,
        failSubmit: false, failComplete: false, loseCommit: false, offline: false, beforeWrite: null, duringRead: null };
    let queue = Promise.resolve(); const transactionScope = new AsyncLocalStorage();
    const repository = {
        owned: async (id, student) => { if (state.offline) throw Error('synthetic-private-database-error'); const i = state.intents.get(id); return i?.studentId === student ? structuredClone(i) : undefined; },
        locked: (studentId, paperId, work, signal) => {
            const pending = queue.then(async () => {
                if (state.offline || signal?.aborted) throw Error('synthetic-private-driver-error');
                const before = structuredClone({ intents: state.intents, submissions: state.submissions }); state.activeTx++;
                let result;
                try {
                    const context = { account: { isActive: state.active, roleId: state.role },
                        paper: { id: paperId, groupId: paperId === 99 ? 2 : 1, title: 'Synthetic project' },
                        group: { id: paperId === 99 ? 2 : 1, status: state.groupStatus, adviserId: 22 },
                        member: state.member && paperId !== 99, submissions: state.submissions.filter(r => r.paperId === paperId) };
                    result = await transactionScope.run(true, () => work({ context, now: async () => new Date(state.time),
                        intent: async id => { const i = state.intents.get(id); return i?.studentId === studentId && i.paperId === paperId ? structuredClone(i) : undefined; },
                        byRequest: async key => structuredClone([...state.intents.values()].find(i => i.studentId === studentId && i.requestKey === key)),
                        recent: async () => structuredClone([...state.intents.values()].filter(i => i.studentId === studentId && i.createdAt.getTime() > state.time - 3600000)),
                        insert: async row => { state.intents.set(row.id, structuredClone(row)); return structuredClone(row); },
                        patch: async (id, data) => {
                            if (data.state === 'completed' && state.failComplete) throw Error('synthetic-private-commit-failure');
                            const row = { ...state.intents.get(id), ...data }; state.intents.set(id, row); return structuredClone(row);
                        },
                        submit: async (intent, version) => {
                            if (state.failSubmit) throw Error('synthetic-private-insert-failure');
                            assert.ok(!state.submissions.some(r => r.paperId === paperId && r.version === version));
                            const row = { id: state.submissions.length + 1, paperId, submittedBy: studentId, version, status: 'Submitted', fileUrl: intent.finalPath };
                            state.submissions.push(row); return structuredClone(row);
                        },
                    }));
                } catch (e) { state.intents = before.intents; state.submissions = before.submissions; throw e; }
                finally { state.activeTx--; }
                if (state.loseCommit && [...state.intents.values()].some(i => i.state === 'completed')) { state.loseCommit = false; throw Error('synthetic-lost-ack'); }
                return result;
            }); queue = pending.catch(() => {}); return pending;
        },
    };
    const noLock = () => assert.notEqual(transactionScope.getStore(), true, 'Storage transfer must not hold its database transaction open');
    const storage = {
        issue: async path => { noLock(); state.minted++; assert.match(path, /^staging\/submissions\/[a-f0-9-]{36}\/upload.pdf$/); return { url: 'https://storage.example.invalid/synthetic-upload', publishableKey: 'sb_publishable_synthetic', expiresAt: new Date(state.time + 7200000) }; },
        exists: async path => { noLock(); return state.objects.has(path); },
        read: async (path, size) => { noLock(); state.reads++; await state.duringRead?.(); const bytes = state.objects.get(path); if (!bytes) throw new UploadFailure('unavailable'); assertUploadPdf(bytes, size); return bytes.slice(); },
        writeOrReconcile: async (path, bytes, hash) => {
            noLock(); await state.beforeWrite?.(); state.writes++;
            const existing = state.objects.get(path);
            if (existing) assert.equal(createHash('sha256').update(existing).digest('hex'), hash);
            else state.objects.set(path, bytes.slice());
        },
    };
    const workflow = createSubmissionUploadWorkflow({ repository, storage, actor: async () => state.actor,
        notify: async (...args) => { state.notifications.push(args); } });
    const input = (paperId = 10) => ({ requestKey: randomUUID(), paperId, fileName: '../Synthetic thesis.pdf', size: pdf().length, contentType: 'application/pdf', remarks: ' Synthetic remarks ' });
    const start = async (paperId = 10) => { const data = input(paperId), result = await workflow.initiate(data); assert.equal(result.success, true); return { data, result, intent: state.intents.get(result.intentId) }; };
    const uploaded = async (paperId = 10) => { const row = await start(paperId); state.objects.set(row.intent.stagingPath, pdf()); return row; };
    return { state, workflow, repository, storage, input, start, uploaded };
}
test('intent ownership, current account/group authorization and strict inputs fail before external effects', async () => {
    for (const patch of [{ actor: null }, { active: false }, { role: 1 }, { role: 2 }, { role: 4 }, { member: false }, { groupStatus: 'archived' }]) {
        const f = fixture(); Object.assign(f.state, patch); assert.equal((await f.workflow.initiate(f.input())).success, false);
        assert.equal(f.state.intents.size, 0); assert.equal(f.state.minted, 0);
    }
    const f = fixture(); assert.equal((await f.workflow.initiate(f.input(99))).success, false);
    for (const change of [{ size: 0 }, { size: UPLOAD_MAX_BYTES + 1 }, { contentType: 'text/plain' }, { paperId: -1 }, { requestKey: 'bad' }, { storagePath: 'research/10/v1/other.pdf' }, { studentId: 12 }, { remarks: 'x'.repeat(501) }])
        assert.equal((await f.workflow.initiate({ ...f.input(), ...change })).success, false);
    assert.equal(f.state.intents.size, 0);
});
test('initiation idempotency, immutable metadata and renewal expiry bound are durable before exposure', async () => {
    const f = fixture(), { data, result, intent } = await f.start();
    assert.equal(intent.stagingPath, stagingPathFor(intent.id)); assert.equal(intent.fileName, 'Synthetic-thesis.pdf');
    assert.equal(intent.expiresAt.getTime() - intent.createdAt.getTime(), 900000);
    assert.equal(intent.capabilityExpiresAt.getTime(), f.state.time + 7200000);
    assert.ok(result.capability); await f.workflow.initiate(data); assert.equal(f.state.intents.size, 1);
    assert.equal((await f.workflow.initiate({ ...data, remarks: 'different' })).code, 'conflict');
    const original = intent.capabilityExpiresAt.getTime(); f.state.time += 1000;
    await f.workflow.renew(intent.id); assert.ok(f.state.intents.get(intent.id).capabilityExpiresAt.getTime() > original);
});
test('two-live/per-paper limits, cancelled-attempt rolling quotas and exact one-hour boundary', async () => {
    const f = fixture(); const a = await f.start();
    assert.equal((await f.workflow.initiate(f.input())).code, 'conflict'); await f.start(20);
    assert.equal((await f.workflow.initiate(f.input(30))).code, 'conflict');
    await f.workflow.cancel(a.intent.id);
    const second = [...f.state.intents.values()].find(i => i.paperId === 20); await f.workflow.cancel(second.id);
    for (let i = 2; i < 10; i++) { const n = await f.start(); await f.workflow.cancel(n.intent.id); }
    assert.equal((await f.workflow.initiate(f.input())).code, 'conflict');
    f.state.time += 3600000; assert.equal((await f.workflow.initiate(f.input())).success, true);
});
test('simultaneous initiation shares one row; separate requests cannot bypass per-paper quota', async () => {
    const f = fixture(), data = f.input();
    await Promise.all([f.workflow.initiate(data), f.workflow.initiate(data)]); assert.equal(f.state.intents.size, 1);
    const results = await Promise.all(Array.from({ length: 10 }, () => f.workflow.initiate(f.input())));
    assert.equal(results.filter(r => r.success).length, 0); assert.equal(f.state.intents.size, 1);
});
test('status is self-only and side-effect free; cancellation/expiry block renewal and late finalization', async () => {
    const f = fixture(), { intent } = await f.uploaded(); const before = structuredClone(f.state.intents);
    assert.equal((await f.workflow.status(intent.id)).uploaded, true); await f.workflow.status(intent.id); assert.deepEqual(f.state.intents, before);
    f.state.actor = 12; assert.equal((await f.workflow.status(intent.id)).success, false); assert.equal((await f.workflow.finalize(intent.id)).success, false);
    f.state.actor = 11; await f.workflow.cancel(intent.id); assert.equal((await f.workflow.cancel(intent.id)).success, true);
    assert.equal((await f.workflow.renew(intent.id)).code, 'closed'); assert.equal(f.state.objects.size, 1);
    const f2 = fixture(), row = await f2.uploaded(); f2.state.time = row.intent.expiresAt.getTime();
    assert.equal((await f2.workflow.finalize(row.intent.id)).code, 'closed'); assert.equal((await f2.workflow.renew(row.intent.id)).code, 'closed');
});
test('normal finalize preserves private path/history and notifies once; completed retries survive expiry', async () => {
    const f = fixture(), { intent } = await f.uploaded(); const result = await f.workflow.finalize(intent.id);
    assert.equal(result.code, 'completed'); assert.equal(result.version, 'v1'); assert.equal(f.state.notifications.length, 1);
    assert.equal(f.state.intents.get(intent.id).state, 'completed');
    assert.match(f.state.submissions[0].fileUrl, new RegExp(`^research/10/v1/${intent.id}-`));
    const reads = f.state.reads; f.state.time += 10800000;
    assert.deepEqual(await f.workflow.finalize(intent.id), result); assert.equal(f.state.reads, reads); assert.equal(f.state.notifications.length, 1);
    assert.equal((await f.workflow.cancel(intent.id)).code, 'completed'); assert.equal(f.state.submissions.length, 1);
});
test('same-intent concurrent finalization and two-Student same-paper contention yield one version', async () => {
    const f = fixture(), { intent } = await f.uploaded();
    const results = await Promise.all([f.workflow.finalize(intent.id), f.workflow.finalize(intent.id)]);
    assert.ok(results.every(r => r.code === 'completed')); assert.equal(f.state.submissions.length, 1); assert.equal(f.state.notifications.length, 1);
    const g = fixture(), first = await g.uploaded(); g.state.actor = 12; const second = await g.uploaded();
    const a = g.workflow.finalize(first.intent.id); // Actor reads before switching back, so use separate secured entry factories below.
    await a; assert.equal(g.state.submissions.length, 0);
    const services = [11, 12].map(id => createSubmissionUploadWorkflow({ repository: g.repository, storage: g.storage, actor: async () => id, notify: async () => g.state.notifications.push('new') }));
    const settled = await Promise.all([services[0].finalize(first.intent.id), services[1].finalize(second.intent.id)]);
    assert.equal(settled.filter(r => r.code === 'completed').length, 1); assert.equal(g.state.submissions.length, 1); assert.equal(g.state.notifications.length, 1);
});
test('membership/account revocation and Adviser decisions during transfer prevent commit', async () => {
    for (const change of [s => { s.member = false; }, s => { s.active = false; }, s => { s.groupStatus = 'archived'; }, s => {
        s.submissions[0].status = 'Approved';
    }]) {
        const f = fixture(); f.state.submissions.push({ id: 1, paperId: 10, submittedBy: 11, version: 'v1', status: 'Revision Required', fileUrl: 'research/10/v1/history.pdf' });
        const { intent } = await f.uploaded(); f.state.beforeWrite = async () => change(f.state);
        const result = await f.workflow.finalize(intent.id); assert.equal(result.success, false); assert.equal(f.state.submissions.length, 1); assert.equal(f.state.notifications.length, 0);
    }
});
test('rollback retains a durable final plan/object; retry reconciles without duplicate submission', async () => {
    const f = fixture(), { intent } = await f.uploaded(); f.state.failComplete = true;
    assert.equal((await f.workflow.finalize(intent.id)).success, false); assert.equal(f.state.submissions.length, 0);
    const planned = f.state.intents.get(intent.id); assert.ok(planned.finalPath && planned.contentSha256); assert.ok(f.state.objects.has(planned.finalPath));
    assert.equal(planned.state, 'pending'); f.state.failComplete = false;
    assert.equal((await f.workflow.finalize(intent.id)).code, 'completed'); assert.equal(f.state.submissions.length, 1); assert.equal(f.state.notifications.length, 1);
});
test('lost database acknowledgement resolves committed state; unavailable DB never deletes a final object', async () => {
    const f = fixture(), { intent } = await f.uploaded(); f.state.loseCommit = true;
    assert.equal((await f.workflow.finalize(intent.id)).code, 'completed'); assert.equal(f.state.submissions.length, 1);
    await f.workflow.finalize(intent.id); assert.equal(f.state.notifications.length, 0, 'uncertain commit keeps best-effort delivery limitation, without duplicates');
    const g = fixture(), row = await g.uploaded(); g.state.beforeWrite = async () => { g.state.offline = true; };
    assert.equal((await g.workflow.finalize(row.intent.id)).success, false); assert.equal(g.state.objects.size, 2);
    g.state.offline = false; g.state.beforeWrite = null; assert.equal((await g.workflow.finalize(row.intent.id)).code, 'completed');
});
test('missing staging is retryable; invalid contents close the intent without creating a submission', async () => {
    const f = fixture(), { intent } = await f.start(); assert.equal((await f.workflow.finalize(intent.id)).success, false);
    assert.equal(f.state.intents.get(intent.id).state, 'pending');
    f.state.objects.set(intent.stagingPath, new Uint8Array(Buffer.from('not a PDF')));
    assert.equal((await f.workflow.finalize(intent.id)).code, 'invalid'); assert.equal(f.state.intents.get(intent.id).state, 'rejected'); assert.equal(f.state.submissions.length, 0);
});
test('multiple papers remain independent and previous revision records remain intact', async () => {
    const f = fixture(); const previous = { id: 1, paperId: 10, submittedBy: 11, version: 'v1', status: 'Revision Required', fileUrl: 'research/10/v1/history.pdf' };
    f.state.submissions.push({ ...previous }); const a = await f.uploaded(), b = await f.uploaded(20);
    assert.equal((await f.workflow.finalize(a.intent.id)).version, 'v2'); assert.equal((await f.workflow.finalize(b.intent.id)).version, 'v1');
    assert.deepEqual(f.state.submissions[0], previous);
});
test('resource admission bounds expensive work to two concurrent finalizations per workflow instance', async () => {
    const f = fixture(), { intent } = await f.uploaded(); let release;
    const pause = new Promise(resolve => { release = resolve; }); f.state.duringRead = () => pause;
    const first = f.workflow.finalize(intent.id), second = f.workflow.finalize(intent.id);
    assert.equal((await f.workflow.finalize(intent.id)).code, 'unavailable'); release(); await Promise.all([first, second]);
});
test('dry-run cleanup waits for every issued capability and protects committed/corrupt paths', async () => {
    const f = fixture(), { intent } = await f.start(); const current = f.state.intents.get(intent.id);
    const cutoff = current.capabilityExpiresAt.getTime() + 600000;
    assert.equal(planUploadCleanup(current, new Date(cutoff - 1), false).eligible, false);
    assert.equal(planUploadCleanup(current, new Date(cutoff), false).staging, true);
    const planned = { ...current, finalPath: `research/10/v1/${current.id}-synthetic.pdf`, contentSha256: 'a'.repeat(64) };
    assert.equal(planUploadCleanup(planned, new Date(cutoff), true).final, false);
    assert.equal(planUploadCleanup({ ...planned, state: 'completed', submissionId: 1 }, new Date(cutoff), false).final, false);
    assert.equal(planUploadCleanup({ ...planned, finalPath: '../other.pdf' }, new Date(cutoff), false).eligible, false);
});
test('browser transport sends the File directly, exposes real progress/cancellation and no JWT/cookies', async () => {
    const calls = []; const request = { upload: {}, status: 200, open: (...a) => calls.push(['open', ...a]),
        setRequestHeader: (...a) => calls.push(['header', ...a]), send: file => calls.push(['body', file]), abort() { this.onabort?.(); } };
    const controller = new AbortController(), file = new File([pdf()], 'synthetic.pdf', { type: 'application/pdf' }), progress = [];
    const promise = uploadPdfDirect(file, { url: 'https://storage.example.invalid/upload', publishableKey: 'sb_publishable_synthetic', expiresAt: new Date().toISOString() }, controller.signal, value => progress.push(value), () => request);
    request.upload.onprogress({ lengthComputable: true, loaded: 5, total: 10 }); request.onload(); await promise;
    assert.equal(request.withCredentials, false); assert.equal(calls.at(-1)[1], file); assert.deepEqual(progress, [50]);
    assert.equal(calls.filter(c => c[0] === 'header').some(c => c[1].toLowerCase() === 'authorization'), false);
    const cancelled = uploadPdfDirect(file, { url: 'https://storage.example.invalid/upload', publishableKey: 'sb_publishable_synthetic', expiresAt: '' }, controller.signal, () => {}, () => request);
    controller.abort(); await assert.rejects(cancelled); assert.equal(request.upload.onprogress, null);
});
