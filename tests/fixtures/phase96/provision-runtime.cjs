/* eslint-disable @typescript-eslint/no-require-imports */
// Contract implementation for explicit in-memory tests. No real service bridge,
// database/Storage imports, native secret generation or executable activation.
const { validatePinnedTarget, canonical, sha256, pdfBytes, PREVIEW_RUN } = require('./fixture-core.cjs');
const deny = code => { throw new Error(code); };
const goodId = n => Number.isInteger(n) && n > 0 && n <= 2147483647;

async function withBoundedCleanup(work, { bound, closeDatabase, closeHelper, closeJournal = () => {} }) {
    let primary, result;
    const cleanupErrors = [];
    try { result = await work(); } catch (error) { primary = error; }
    for (const [name, close] of [['DATABASE_CLOSE_FAILED', closeDatabase], ['HELPER_CLOSE_FAILED', closeHelper], ['JOURNAL_CLOSE_FAILED', closeJournal]]) {
        try { await bound(name, 5000, close); } catch { cleanupErrors.push(name); }
    }
    if (primary) {
        try { Object.defineProperty(primary, 'cleanupErrors', { value: cleanupErrors, enumerable: false, configurable: true }); } catch { /* Preserve the original error even when frozen. */ }
        throw primary;
    }
    if (cleanupErrors.length) deny(cleanupErrors[0]);
    return result;
}

async function runMockProvisioning(spec, deps) {
    if (deps?.kind !== 'phase96-memory' || typeof deps.bound !== 'function' ||
        deps.adapters?.kind !== 'phase96-memory' || deps.protectedState?.kind !== 'phase96-memory' ||
        !/^phase96-[a-f0-9]{32}$/.test(spec.runId) || spec.runId === PREVIEW_RUN) deny('LIVE_ADAPTER_UNAVAILABLE');
    // The fingerprint is a target comparison, not authorization. No live authority
    // type exists in this gate; this object is explicitly a synthetic test permit.
    const digest = sha256(canonical(spec.pin));
    if (spec.permit?.kind !== 'synthetic-test-permit' || spec.permit.runId !== spec.runId ||
        spec.permit.targetDigest !== digest || spec.permit.notificationFanout !== true) deny('MOCK_AUTHORIZATION_REQUIRED');
    let observer;
    const controller = new AbortController(), receipts = new Map();
    const journal = deps.journal;
    const invoke = (label, fn) => deps.bound(label, 3000, async () => {
        controller.signal.throwIfAborted();
        const result = await fn(controller.signal);
        controller.signal.throwIfAborted(); return result;
    });
    const append = (step, payload, parents, state, resources = [], extra = {}) => journal.append({ step,
        attemptId: `${spec.runId}:${step}:1`, payloadDigest: sha256(canonical(payload)), parents, state, resources, ...extra });
    async function confirm(step, payload, parents, receipt) {
        append(step, payload, parents, 'returned', [receipt]);
        const verification = await invoke('verify-' + step, signal => deps.adapters.verifyOwned(step, receipt, signal, payload));
        if (!verification || canonical(verification.observed) !== canonical(receipt) ||
            verification.payloadDigest !== sha256(canonical(payload)) || !/^[a-f0-9]{64}$/.test(verification.evidence)) deny('VERIFICATION_FAILED');
        append(step, payload, parents, 'verified', [receipt], { evidence: verification.evidence });
        receipts.set(step, receipt); return receipt;
    }
    async function write(step, payload, parents, kind, operation) {
        if (receipts.has(step)) deny('DUPLICATE_OPERATION');
        controller.signal.throwIfAborted();
        append(step, payload, parents, 'planned'); append(step, payload, parents, 'started');
        try {
            // Receipt adapter returns only after its operation has committed.
            const row = await invoke(step, operation);
            if (!goodId(row?.id)) deny('MISSING_CREATION_RECEIPT');
            return await confirm(step, payload, parents, { kind, id: row.id, parents });
        } catch {
            append(step, payload, parents, 'uncertain', [], { error: 'OPERATION_UNCERTAIN' });
            deny('OPERATION_UNCERTAIN');
        }
    }
    return withBoundedCleanup(async () => {
        try {
            observer = await invoke('connect-observer', () => deps.openReadOnly({ max: 1, connectTimeoutMs: 2000, statementTimeoutMs: 3000, readOnly: true }));
            const observed = await invoke('observe', signal => observer.observe(signal));
            const admitted = validatePinnedTarget(spec.pin, observed, spec.effective, spec.localMigrations);
            if (admitted.targetDigest !== digest) deny('RUNTIME_TARGET_MISMATCH');
            if (journal.binding?.runId !== spec.runId || journal.binding?.targetDigest !== digest) deny('JOURNAL_OWNERSHIP_MISMATCH');
            if (journal.binding.mode !== 'new' || journal.snapshot().length) deny('PRIOR_RUN_EXISTS');
            if (!/^[a-f0-9]{64}$/.test(deps.journalKey) || sha256(Buffer.from(deps.journalKey, 'hex')) !== journal.binding.keyDigest) deny('JOURNAL_KEY_MISMATCH');
            // Password generation is injected and synthetic here. Real entropy,
            // hashPassword, registerSchema and DPAPI integration remain unavailable.
            const accounts = {};
            for (const role of ['admin', 'adviser', 'student']) {
                const password = await deps.generatePassword(role);
                if (typeof password !== 'string' || password.length < 32 || password.length > 64) deny('INVALID_CREDENTIAL_GENERATOR');
                accounts[role] = { email: `${spec.runId}-${role}@example.invalid`, password };
            }
            if (new Set(Object.values(accounts).map(x => x.password)).size !== 3) deny('CREDENTIAL_REUSE_REJECTED');
            const secretPayload = { scope: 'CurrentUser', roles: ['admin', 'adviser', 'student'] };
            append('credentials', secretPayload, {}, 'planned'); append('credentials', secretPayload, {}, 'started');
            const secretReceipt = await deps.protectedState.save({ runId: spec.runId, targetDigest: digest, journalKey: deps.journalKey, accounts });
            const recovered = await deps.protectedState.load();
            if (canonical(recovered.accounts) !== canonical(accounts) || recovered.runId !== spec.runId || recovered.targetDigest !== digest) deny('PROTECTED_STATE_UNAVAILABLE');
            await confirm('credentials', secretPayload, {}, secretReceipt);
            const input = role => ({ firstName: 'Synthetic', lastName: 'Phase96', ...accounts[role], confirmPassword: accounts[role].password });
            for (const role of ['admin', 'adviser', 'student']) await deps.schemas.register(input(role));

            const adminPayload = { firstName: 'Synthetic', lastName: 'Phase96', email: accounts.admin.email, roleId: 1, isActive: true };
            const passwordHash = await deps.hashPassword(accounts.admin.password);
            if (deps.hashPolicy !== 'bcrypt-12' || !/^\$2[aby]\$12\$[./A-Za-z0-9]{53}$/.test(passwordHash)) deny('HASH_POLICY_MISMATCH');
            append('admin', adminPayload, {}, 'planned'); append('admin', adminPayload, {}, 'started');
            let tx, commitAttempted = false, committed = false, stagedId;
            try {
                tx = await invoke('bootstrap-begin', () => deps.bootstrap.begin());
                if (await invoke('bootstrap-conflict', () => tx.findByEmail(accounts.admin.email))) deny('EXISTING_ACCOUNT_CONFLICT');
                const staged = await invoke('bootstrap-insert', () => tx.insertAdmin({ ...adminPayload, password: passwordHash }));
                if (!goodId(staged?.id)) deny('MISSING_CREATION_RECEIPT');
                stagedId = staged.id;
                commitAttempted = true;
                await invoke('bootstrap-commit', () => tx.commit()); // A returned ID before this is not durable success.
                committed = true;
                await confirm('admin', adminPayload, {}, { kind: 'users', id: staged.id, parents: {} });
            } catch (error) {
                if (!commitAttempted && tx) {
                    try { await invoke('bootstrap-rollback', () => tx.rollback()); }
                    catch { append('admin', adminPayload, {}, 'uncertain', [], { error: 'OPERATION_UNCERTAIN' }); deny('OPERATION_UNCERTAIN'); }
                    append('admin', adminPayload, {}, 'failed', [], { error: 'PREWRITE_REJECTED' });
                    deny(error.message === 'EXISTING_ACCOUNT_CONFLICT' ? 'EXISTING_ACCOUNT_CONFLICT' : 'BOOTSTRAP_ROLLED_BACK');
                }
                append('admin', adminPayload, {}, 'uncertain', [], { error: commitAttempted && !committed ? 'COMMIT_UNCERTAIN' : 'OPERATION_UNCERTAIN',
                    ...(commitAttempted && !committed && stagedId ? { candidateResources: [{ kind: 'users', id: stagedId, parents: {} }] } : {}) });
                deny(commitAttempted && !committed ? 'COMMIT_UNCERTAIN' : 'OPERATION_UNCERTAIN');
            }
            async function authenticate(role, roleId, accountId) {
                const result = await invoke('password-auth-' + role, signal => deps.adapters.authenticate(accounts[role], signal));
                if (!result?.success || result.data?.id !== accountId || result.data?.roleId !== roleId) deny('PASSWORD_AUTHENTICATION_FAILED');
                const actor = { userId: accountId, roleId };
                if (!await deps.adapters.requireCurrentActor(actor, roleId)) deny('CURRENT_ACCOUNT_DENIED');
                return actor;
            }
            const admin = await authenticate('admin', 1, receipts.get('admin').id);
            const adviser = await write('adviser', { firstName: 'Synthetic', lastName: 'Phase96', email: accounts.adviser.email, roleId: 2, isActive: true }, { adminId: admin.userId }, 'users',
                signal => deps.adapters.createAdviser({ ...input('adviser'), roleId: 2 }, admin, signal));
            const student = await write('student', { firstName: 'Synthetic', lastName: 'Phase96', email: accounts.student.email, roleId: 3, isActive: true }, {}, 'users',
                signal => deps.adapters.registerStudent(input('student'), signal));
            const adviserActor = await authenticate('adviser', 2, adviser.id);
            const groupInput = { groupName: `PHASE96 ${spec.runId}`, strand: 'SYNTHETIC', section: 'TEST', schoolYear: '2026-2027' };
            let recipients = null;
            // New adapter contract, NOT an existing application API. A future
            // reviewed bridge must forward normal services and capture each
            // repository return, including errors swallowed by sendNotification.
            await invoke('group-with-effects', signal => deps.adapters.createGroup(groupInput, adviserActor, {
                signal,
                recipients(values) {
                    if (recipients || !Array.isArray(values) || values.some(x => !goodId(x)) || new Set(values).size !== values.length) deny('INVALID_NOTIFICATION_RECIPIENTS');
                    recipients = [...values];
                },
                async record(step, payload, operation) {
                    if (step === 'group') return write(step, { ...groupInput, status: 'active', adviserId: adviser.id }, { adviserId: adviser.id }, 'research_groups', operation);
                    const groupId = receipts.get('group')?.id;
                    if (!groupId) deny('MISSING_PARENT_RECEIPT');
                    if (step === 'activity') return write(step, payload, { adviserId: adviser.id, groupId }, 'activity_logs', operation);
                    const recipient = Number(step.replace('notification-', ''));
                    if (!recipients?.includes(recipient) || step !== `notification-${recipient}`) deny('UNAPPROVED_SECONDARY_WRITE');
                    return write(step, payload, { adminId: recipient, adviserId: adviser.id, groupId }, 'notifications', operation);
                },
            }));
            if (!receipts.has('group') || !receipts.has('activity') || !recipients || recipients.some(id => !receipts.has(`notification-${id}`))) deny('SECONDARY_EFFECTS_INCOMPLETE');
            const groupId = receipts.get('group').id;
            await write('membership', { groupId, userId: student.id }, { groupId, studentId: student.id }, 'group_members',
                signal => deps.adapters.addMembership(groupId, student.id, adviserActor, signal));
            const studentActor = await authenticate('student', 3, student.id);
            const project = { groupId, title: `PHASE96 ${spec.runId} synthetic research`, abstract: 'Synthetic workflow acceptance only.' };
            await write('paper', { ...project, status: 'Draft', submissions: 0 }, { groupId }, 'research_papers', signal => deps.adapters.createProject(project, studentActor, signal));
            for (const [step, version] of [['pdf1', 'v1'], ['pdf2', 'v2']]) {
                const bytes = pdfBytes(version), payload = { version, checksum: sha256(bytes), bytes: bytes.length };
                append(step, payload, {}, 'planned'); append(step, payload, {}, 'started');
                await invoke(step, signal => deps.writeLocalPdf(`${spec.runId}-${version}.pdf`, bytes, signal));
                await confirm(step, payload, {}, { kind: 'pdf', parents: {}, ...payload });
            }
            return { status: 'MOCK_VERIFIED', counts: { accounts: 3, groups: 1, memberships: 1, projects: 1, pdfs: 2,
                auditLogs: 1, notifications: recipients.length }, storageWrites: 0 };
        } finally { controller.abort(); }
    }, { bound: deps.bound, closeDatabase: () => observer?.close(), closeHelper: deps.closeHelper, closeJournal: () => journal.close() });
}

if (require.main === module) { process.stderr.write('RUNTIME_NOT_EXECUTABLE\n'); process.exitCode = 1; }
module.exports = { runMockProvisioning, withBoundedCleanup };
