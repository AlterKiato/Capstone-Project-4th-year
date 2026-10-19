/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { normalizeLoopback, validatePinnedTarget, canonical, sha256 } = require('./fixture-core.cjs');
const { createJournal, privateDirectory, createProtectedState, nativeProtection } = require('./private-state.cjs');
const { runMockProvisioning, withBoundedCleanup } = require('./provision-runtime.cjs');
const { targets, memoryIO, location, fakeProtector, harness, runId, key, clock } = require('./provision-test-doubles.cjs');
const digest = sha256(canonical(targets().pin));
const expectCode = (fn, code) => assert.throws(fn, e => e.message === code);
const rejectCode = (promise, code) => assert.rejects(promise, e => e.message === code);
function journalFixture() {
    const io = memoryIO(), journal = createJournal({ io, key, runId, targetDigest: digest, clock });
    const event = state => ({ step: 'admin', attemptId: `${runId}:admin:1`, payloadDigest: sha256('account-fields-without-password'),
        parents: {}, state, resources: [] });
    return { io, journal, event, reopen: () => createJournal({ io, key, runId, targetDigest: digest, clock, mode: 'inspect-resume' }) };
}

test('complete owner-reviewed pin comparison and observed budget', () => {
    const t = targets();
    assert.equal(validatePinnedTarget(t.pin, t.observed, t.effective, t.localMigrations).spareConnections, 91);
    const legacy = targets(); legacy.pin.roles[2].name = 'User'; legacy.observed.roles[2].name = 'User';
    assert.ok(validatePinnedTarget(legacy.pin, legacy.observed, legacy.effective, legacy.localMigrations));
});
test('only literal or mapped equivalent loopback identities normalize', () => {
    for (const address of ['::1', '::1/128', '0:0:0:0:0:0:0:1', '[::1]', '127.0.0.1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:127.0.0.1/128'])
        assert.ok(normalizeLoopback(address), address);
    for (const address of ['localhost', '::1/64', '127.0.0.1/128', '127.0.0.2', '10.0.0.1', '::ffff:10.0.0.1', '::2', '::1%lo', 'example.invalid'])
        assert.equal(normalizeLoopback(address), null, address);
});
test('instance/OID/role/privilege/mapping/schema/migration mismatches fail closed', () => {
    const changes = [o => o.systemIdentifier = '9999999999999999999', o => o.databaseOid = 42,
        o => o.dbRole = 'other', o => o.sessionRole = 'other', o => o.roleAttributes.superuser = true,
        o => o.privileges.insert = false, o => o.roles[2].name = 'Unexpected', o => o.applicationRoles.Student = 4,
        o => o.schemaHash = sha256('other'), o => o.migrations.reverse(), o => delete o.roleAttributes,
        o => o.serverAddress = '10.0.0.1', o => o.database = 'other', o => o.port = 5433];
    for (const mutate of changes) { const t = targets(); mutate(t.observed); assert.throws(() => validatePinnedTarget(t.pin, t.observed, t.effective, t.localMigrations)); }
});
test('Storage project, exact endpoint, bucket/privacy and path convention reject drift', () => {
    for (const change of [{ projectRef: 'zzzzzzzzzzzzzzzzzzzz' }, { storageEndpoint: 'https://other.invalid' },
        { bucket: 'other' }, { bucketPublic: true }]) {
        const t = targets(); Object.assign(t.observed, change); assert.throws(() => validatePinnedTarget(t.pin, t.observed, t.effective, t.localMigrations));
    }
    for (const endpoint of ['http://abcdefghijklmnopqrst.supabase.co', 'https://abcdefghijklmnopqrst.supabase.co/override', 'https://user:password@abcdefghijklmnopqrst.supabase.co']) {
        const t = targets(); t.effective.storageEndpoint = endpoint;
        expectCode(() => validatePinnedTarget(t.pin, t.observed, t.effective, t.localMigrations), 'STORAGE_TARGET_REJECTED');
    }
    const t = targets(); t.pin.pathConvention = 'new-prefix/{runId}';
    expectCode(() => validatePinnedTarget(t.pin, t.observed, t.effective, t.localMigrations), 'TARGET_METADATA_UNAVAILABLE');
});
test('headroom derives from actual reserves/client count and role/database limits', () => {
    for (const change of [{ clientBackends: 90 }, { reserved: 90 }, { roleLimit: 10 }, { databaseLimit: 10 }]) {
        const t = targets(); Object.assign(t.observed, change);
        expectCode(() => validatePinnedTarget(t.pin, t.observed, t.effective, t.localMigrations), 'INSUFFICIENT_CONNECTION_HEADROOM');
    }
    const t = targets(); delete t.observed.maxConnections;
    expectCode(() => validatePinnedTarget(t.pin, t.observed, t.effective, t.localMigrations), 'TARGET_METADATA_UNAVAILABLE');
});

test('full mocked creation has exact primary/secondary IDs and normal notifications', async () => {
    const h = harness(), result = await runMockProvisioning(h.spec, h.deps);
    assert.deepEqual(result.counts, { accounts: 3, groups: 1, memberships: 1, projects: 1, pdfs: 2, auditLogs: 1, notifications: 2 });
    assert.equal(result.storageWrites, 0);
    assert.equal(h.journal.resumeStatus().steps.filter(x => x.state === 'verified').length, 12);
    assert.ok(h.trace.indexOf('commit') < h.trace.indexOf('password:admin'));
    assert.ok(h.trace.indexOf('password:adviser') < h.trace.indexOf('insert:group'));
    assert.ok(h.trace.indexOf('password:student') < h.trace.indexOf('insert:paper'));
    assert.equal(h.rows.get('paper').payload.status, 'Draft'); assert.equal(h.rows.get('paper').payload.submissions, 0);
    assert.ok(h.rows.has('notification-900') && h.rows.has('notification-901'));
    assert.ok(h.dbClosed && h.helperClosed && !h.io.locked);
    for (const password of Object.values(h.passwords)) { assert.ok(!h.io.text.includes(password)); assert.ok(!h.io.protected.includes(Buffer.from(password))); }
});
test('target mismatch occurs before credential generation or first insert, with observer shutdown', async () => {
    const h = harness(); h.observed.databaseOid++;
    await rejectCode(runMockProvisioning(h.spec, h.deps), 'RUNTIME_TARGET_MISMATCH');
    assert.equal(h.rows.size, 0); assert.equal(h.io.protected, null); assert.ok(h.dbClosed && !h.io.locked);
});
test('no native defaults, automatic permits or invocation path can enable runtime', async () => {
    await rejectCode(runMockProvisioning({ runId }, {}), 'LIVE_ADAPTER_UNAVAILABLE');
    const h = harness(); h.spec.permit.kind = 'live-approved';
    await rejectCode(runMockProvisioning(h.spec, h.deps), 'MOCK_AUTHORIZATION_REQUIRED');
    assert.equal(h.rows.size, 0); h.journal.close();
    expectCode(() => nativeProtection(), 'NATIVE_PROTECTION_UNAVAILABLE');
});
test('public refusal ignores force/confirm/environment attempts before runtime or configuration imports', () => {
    const Module = require('node:module'), original = Module._load;
    const { main } = require('./prepare.cjs');
    const previous = process.env.ALLOW_TEST_PROVISIONING;
    let forbidden = 0;
    try {
        process.env.ALLOW_TEST_PROVISIONING = '1';
        Module._load = function(id, ...args) {
            if (/provision-runtime|private-state|dotenv|node:fs|postgres|supabase/.test(id)) { forbidden++; throw Error('FORBIDDEN_IMPORT'); }
            return original.call(this, id, ...args);
        };
        for (const args of [['provision'], ['provision', '--force'], ['provision', '--confirm'], ['provision', '--enable'], ['provision', '--runtime=live']])
            expectCode(() => main(args), 'PROVISIONING_NOT_AUTHORIZED');
        for (const args of [['--force'], ['bootstrap'], ['resume'], ['--provision']]) expectCode(() => main(args), 'UNKNOWN_MODE');
        assert.equal(forbidden, 0);
    } finally {
        Module._load = original;
        if (previous === undefined) delete process.env.ALLOW_TEST_PROVISIONING; else process.env.ALLOW_TEST_PROVISIONING = previous;
    }
});
test('unique Admin conflict refuses without promotion/reset and records definite rollback', async () => {
    const h = harness(); h.existingAccount = true;
    await rejectCode(runMockProvisioning(h.spec, h.deps), 'EXISTING_ACCOUNT_CONFLICT');
    assert.equal(h.rows.size, 0); assert.ok(h.trace.includes('rollback')); assert.ok(!h.trace.includes('commit'));
    assert.equal(h.journal.snapshot().at(-1).state, 'failed');
});
test('insert failure rolls back; rollback failure is uncertain', async () => {
    const h = harness(); h.insertFailure = true;
    await rejectCode(runMockProvisioning(h.spec, h.deps), 'BOOTSTRAP_ROLLED_BACK'); assert.equal(h.rows.size, 0);
    const second = harness(); second.insertFailure = true; second.rollbackFailure = true;
    await rejectCode(runMockProvisioning(second.spec, second.deps), 'OPERATION_UNCERTAIN');
    assert.equal(second.journal.snapshot().at(-1).state, 'uncertain');
});
test('lost commit response never becomes returned/verified or starts Adviser creation', async () => {
    const h = harness(); h.commitFailure = true;
    await rejectCode(runMockProvisioning(h.spec, h.deps), 'COMMIT_UNCERTAIN');
    assert.ok(h.rows.has('admin')); assert.ok(!h.rows.has('adviser'));
    assert.deepEqual(h.journal.snapshot().filter(x => x.step === 'admin').map(x => x.state), ['planned', 'started', 'uncertain']);
    assert.equal(h.journal.snapshot().at(-1).candidateResources[0].id, h.rows.get('admin').id);
    assert.ok(!h.trace.includes('rollback'));
});
test('wrong hash policy and reused credentials fail before account writes', async () => {
    const h = harness(); h.deps.hashPolicy = 'bcrypt-10';
    await rejectCode(runMockProvisioning(h.spec, h.deps), 'HASH_POLICY_MISMATCH'); assert.equal(h.rows.size, 0);
    const second = harness(); second.passwords.adviser = second.passwords.admin;
    await rejectCode(runMockProvisioning(second.spec, second.deps), 'CREDENTIAL_REUSE_REJECTED'); assert.equal(second.rows.size, 0);
});
test('password authentication and current-role denial prevent subsequent role operations', async () => {
    for (const role of ['admin', 'adviser', 'student']) {
        const h = harness(); h.badPassword = role;
        await rejectCode(runMockProvisioning(h.spec, h.deps), 'PASSWORD_AUTHENTICATION_FAILED');
        assert.ok(!h.rows.has(role === 'admin' ? 'adviser' : role === 'adviser' ? 'group' : 'paper'));
    }
    const h = harness(); h.denyRole = 2;
    await assert.rejects(runMockProvisioning(h.spec, h.deps)); assert.ok(!h.rows.has('group'));
});
test('swallowed notification failure retains group/log and receipts successful historical-recipient effects', async () => {
    const h = harness(); h.failWrite = 'notification-900';
    await rejectCode(runMockProvisioning(h.spec, h.deps), 'SECONDARY_EFFECTS_INCOMPLETE');
    assert.ok(h.rows.has('group') && h.rows.has('activity') && h.rows.has('notification-901'));
    assert.ok(!h.rows.has('membership')); assert.equal(h.trace.filter(x => x === 'insert:group').length, 1);
    assert.equal(h.journal.resumeStatus().steps.find(s => s.step === 'notification-900').state, 'uncertain');
});
test('audit failure leaves the committed group and stops before notification fan-out', async () => {
    const h = harness(); h.failWrite = 'activity';
    await rejectCode(runMockProvisioning(h.spec, h.deps), 'OPERATION_UNCERTAIN');
    assert.ok(h.rows.has('group')); assert.ok(!h.rows.has('notification-900'));
});
test('wrong independent ID verification produces uncertain state without blind retry', async () => {
    const h = harness(); h.badVerification = 'adviser';
    await rejectCode(runMockProvisioning(h.spec, h.deps), 'OPERATION_UNCERTAIN');
    assert.ok(h.rows.has('adviser')); assert.ok(!h.rows.has('student'));
    assert.equal(h.journal.snapshot().at(-1).state, 'uncertain');
});
test('matching IDs cannot verify inactive accounts or a project that is no longer Draft', async () => {
    for (const step of ['adviser', 'paper']) {
        const h = harness(); h.badPayload = step;
        await rejectCode(runMockProvisioning(h.spec, h.deps), 'OPERATION_UNCERTAIN');
        assert.equal(h.journal.resumeStatus().steps.find(s => s.step === step).state, 'uncertain');
        assert.ok(!h.rows.has(step === 'adviser' ? 'student' : 'pdf1'));
    }
});

test('journal lock, intent durability, exact transitions and repeated-run rejection', () => {
    const { io, journal, event, reopen } = journalFixture();
    expectCode(() => reopen(), 'LOCK_HELD');
    journal.append(event('planned')); journal.append(event('started'));
    assert.equal(io.cursor.seq, 2);
    expectCode(() => journal.append(event('started')), 'INVALID_JOURNAL_TRANSITION');
    journal.close();
    expectCode(() => createJournal({ io, key, runId, targetDigest: digest, clock }), 'PRIOR_RUN_EXISTS');
    const reader = reopen(); assert.ok(reader.resumeStatus().uncertain);
    expectCode(() => reader.append(event('returned')), 'JOURNAL_NOT_WRITABLE'); reader.close();
});
test('journal HMAC rejects edits, whole-record truncation and incomplete trailing writes', () => {
    for (const corruption of [io => { io.text = io.text.replace('planned', 'started'); },
        io => { io.text = ''; }, io => { io.text = io.text.slice(0, -2); }]) {
        const { io, journal, event, reopen } = journalFixture(); journal.append(event('planned')); journal.close();
        corruption(io); assert.throws(reopen); assert.ok(!io.locked);
    }
});
test('journal rejects another target, ownership shape, unknown secret fields and wrong IDs', () => {
    const { io, journal, event } = journalFixture(); journal.append(event('planned')); journal.append(event('started'));
    const returned = { ...event('returned'), resources: [{ kind: 'users', id: 100, parents: {} }] };
    journal.append(returned);
    expectCode(() => journal.append({ ...returned, state: 'verified', evidence: sha256('verification'), resources: [{ kind: 'users', id: 101, parents: {} }] }), 'UNVERIFIED_RECEIPT');
    expectCode(() => journal.append({ ...event('uncertain'), password: 'DO_NOT_LOG_ME' }), 'INVALID_JOURNAL_RECORD');
    expectCode(() => journal.append({ ...event('uncertain'), targetDigest: sha256('other') }), 'INVALID_JOURNAL_RECORD');
    assert.ok(!io.text.includes('DO_NOT_LOG_ME')); journal.close();
    assert.throws(() => createJournal({ io, key, runId, targetDigest: sha256('other'), clock, mode: 'inspect-resume' }));
});
test('unverified parents and duplicate IDs cannot become owned receipts', () => {
    const { journal, event } = journalFixture();
    expectCode(() => journal.append({ ...event('planned'), step: 'group', attemptId: `${runId}:group:1`, parents: { adviserId: 100 } }), 'UNVERIFIED_PARENT');
    journal.append(event('planned')); journal.append(event('started'));
    const resource = { kind: 'users', id: 100, parents: {} };
    journal.append({ ...event('returned'), resources: [resource] });
    journal.append({ ...event('verified'), resources: [resource], evidence: sha256('checked') });
    const child = { ...event('planned'), step: 'adviser', attemptId: `${runId}:adviser:1`, parents: { adminId: 100 } };
    journal.append(child); journal.append({ ...child, state: 'started' });
    expectCode(() => journal.append({ ...child, state: 'returned', resources: [{ ...resource, parents: child.parents }] }), 'DUPLICATE_RESOURCE_RECEIPT');
    journal.close();
});
test('flush failure before write poisons journal and prevents bootstrap', async () => {
    const h = harness(); h.io.failFlush = 6;
    await rejectCode(runMockProvisioning(h.spec, h.deps), 'JOURNAL_FLUSH_UNCERTAIN');
    assert.equal(h.rows.size, 0); assert.ok(!h.trace.includes('begin')); assert.ok(!h.io.locked);
});
test('failure after commit but before receipt stops with durable intent and cursor mismatch', async () => {
    const h = harness(); h.io.failFlush = 7;
    await assert.rejects(runMockProvisioning(h.spec, h.deps));
    assert.ok(h.rows.has('admin') && !h.rows.has('adviser'));
    expectCode(() => createJournal({ io: h.io, key, runId, targetDigest: digest, clock, mode: 'inspect-resume' }), 'JOURNAL_CURSOR_MISMATCH');
});
test('unawaited asynchronous journal adapters are rejected before database writes', async () => {
    const h = harness(); h.io.appendAndFlush = async () => {};
    await rejectCode(runMockProvisioning(h.spec, h.deps), 'JOURNAL_FLUSH_UNCERTAIN');
    assert.equal(h.rows.size, 0); assert.ok(!h.trace.includes('begin'));
});

test('private paths enforce external local directory, SID, ACL and ancestor reparse checks', () => {
    assert.ok(privateDirectory(location(digest)).includes(runId));
    const changes = [l => l.workspace = 'C:\\FakeUser', l => l.localAppData = '\\\\server\\share',
        l => l.security.ownerSid = 'other', l => l.security.inherited = true, l => l.security.reparse = true,
        l => l.security.ancestors[0].reparse = true, l => l.security.grants.push('S-1-1-0')];
    for (const mutate of changes) { const l = location(digest); mutate(l); assert.throws(() => privateDirectory(l)); }
});
test('protected-state interface uses CurrentUser, exclusive ciphertext storage and fails closed', async () => {
    const io = memoryIO(), protector = fakeProtector(), l = location(digest);
    const state = createProtectedState({ io, protector, location: l });
    await rejectCode(state.load(), 'PROTECTED_STATE_UNAVAILABLE');
    const input = { runId, targetDigest: digest, journalKey: key.toString('hex'),
        accounts: Object.fromEntries(['admin', 'adviser', 'student'].map((role, i) => [role, { email: role + '@example.invalid', password: String(i).repeat(43) }])) };
    await state.save(input); assert.deepEqual(await state.load(), input);
    await rejectCode(state.save(input), 'PROTECTION_FAILED');
    protector.unprotect = async () => { throw Error('DPAPI unavailable with sensitive details'); };
    await rejectCode(state.load(), 'PROTECTED_STATE_UNAVAILABLE');
    expectCode(() => createProtectedState({ io, protector: { ...protector, scope: 'LocalMachine' }, location: l }), 'NATIVE_PROTECTION_UNAVAILABLE');
});
test('missing or unreadable protected credentials stop provisioning without replacement', async () => {
    const h = harness(); h.deps.protectedState.load = async () => { throw Error('PROTECTED_STATE_UNAVAILABLE'); };
    await rejectCode(runMockProvisioning(h.spec, h.deps), 'PROTECTED_STATE_UNAVAILABLE'); assert.equal(h.rows.size, 0);
});
test('observer open and helper-close timeouts are bounded and cleanup-only failure is reported', async () => {
    const h = harness(); h.timeout = 'connect-observer';
    await assert.rejects(runMockProvisioning(h.spec, h.deps));
    assert.equal(h.rows.size, 0); assert.ok(h.helperClosed && !h.io.locked);
    const second = harness(); second.timeout = 'HELPER_CLOSE_FAILED';
    await rejectCode(runMockProvisioning(second.spec, second.deps), 'HELPER_CLOSE_FAILED');
    assert.ok(second.dbClosed && !second.io.locked);
});
test('bounded cleanup preserves original failure and independently attempts owned resource shutdown', async () => {
    const primary = Error('original failure'), calls = [];
    const deps = { bound: async (name, ms, operation) => { assert.equal(ms, 5000); calls.push(name); return operation(); },
        closeDatabase: async () => { throw Error('db close failure'); }, closeHelper: async () => { throw Error('helper close failure'); }, closeJournal: () => calls.push('released') };
    await assert.rejects(withBoundedCleanup(async () => { throw primary; }, deps), e => e === primary);
    assert.deepEqual(primary.cleanupErrors, ['DATABASE_CLOSE_FAILED', 'HELPER_CLOSE_FAILED']);
    assert.ok(calls.includes('released'));
    await rejectCode(withBoundedCleanup(async () => 'success', deps), 'DATABASE_CLOSE_FAILED');
});
test('modeled statement/commit deadlines and cleanup deadlines never touch an application server', async () => {
    const h = harness(); h.timeout = 'observe';
    await assert.rejects(runMockProvisioning(h.spec, h.deps)); assert.ok(h.dbClosed && h.helperClosed && !h.io.locked);
    const second = harness(); second.timeout = 'bootstrap-commit';
    await rejectCode(runMockProvisioning(second.spec, second.deps), 'COMMIT_UNCERTAIN');
    assert.ok(second.dbClosed && second.helperClosed && !second.io.locked);
    assert.ok(!second.trace.some(x => /application-server|kill|restart|startServer/.test(x)));
});
test('inactive/current-role and foreign-group guards are represented before dependent writes', async () => {
    for (const fault of ['inactive', 'role', 'foreign-group']) {
        const h = harness();
        if (fault === 'foreign-group') {
            const original = h.deps.adapters.addMembership;
            h.deps.adapters.addMembership = (...args) => { h.rows.get('group').payload.adviserId = 999; return original(...args); };
        } else {
            const original = h.deps.adapters.requireCurrentActor;
            h.deps.adapters.requireCurrentActor = (actor, role) => {
                if (role === 2) h.rows.get('adviser').payload[fault === 'inactive' ? 'isActive' : 'roleId'] = fault === 'inactive' ? false : 3;
                return original(actor, role);
            };
        }
        await assert.rejects(runMockProvisioning(h.spec, h.deps));
        assert.ok(!h.rows.has(fault === 'foreign-group' ? 'membership' : 'group'));
    }
});
