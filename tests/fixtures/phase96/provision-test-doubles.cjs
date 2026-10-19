/* eslint-disable @typescript-eslint/no-require-imports */
// All persistence, credentials, services, database and process operations here
// are deterministic in-memory doubles. This file imports no application modules.
const assert = require('node:assert/strict');
const { canonical, sha256, pdfBytes } = require('./fixture-core.cjs');
const { createJournal, createProtectedState } = require('./private-state.cjs');
const runId = 'phase96-1234567890abcdef1234567890abcdef';
const clock = () => '2026-10-20T00:00:00.000Z';
const key = Buffer.alloc(32, 42);
function targets() {
    const pin = { schemaVersion: 2, database: 'thesishs_ai', port: 5432, host: 'localhost',
        systemIdentifier: '1234567890123456789', databaseOid: 16384, serverVersion: 180004,
        dbRole: 'fixture_tester', roleAttributes: { canLogin: true, superuser: false, bypassRls: false,
            inherit: true, createRole: false, createDb: false, replication: false },
        privileges: { connect: true, schemaUsage: true, select: true, insert: true, sequenceUsage: true, rowLocks: true },
        applicationRoles: { Admin: 1, Adviser: 2, Student: 3, Panel: 4 },
        roles: ['Admin', 'Adviser', 'Student', 'Panel'].map((name, i) => ({ id: i + 1, name })),
        migrations: Array.from({ length: 12 }, (_, i) => sha256('migration-' + i)), schemaHash: sha256('catalog'),
        projectRef: 'abcdefghijklmnopqrst', storageEndpoint: 'https://abcdefghijklmnopqrst.supabase.co',
        bucket: 'research-submissions', bucketPublic: false,
        pathConvention: 'research/{paperId}/{version}/{sanitizedFileName}', plannedConnections: 1, minimumSpare: 10 };
    const observed = { database: pin.database, port: pin.port, serverAddress: '::1/128',
        systemIdentifier: pin.systemIdentifier, databaseOid: pin.databaseOid, serverVersion: pin.serverVersion,
        dbRole: pin.dbRole, sessionRole: pin.dbRole, roleAttributes: structuredClone(pin.roleAttributes), privileges: { ...pin.privileges },
        applicationRoles: { ...pin.applicationRoles }, roles: structuredClone(pin.roles), migrations: [...pin.migrations], schemaHash: pin.schemaHash,
        projectRef: pin.projectRef, storageEndpoint: pin.storageEndpoint, bucket: pin.bucket, bucketPublic: false,
        maxConnections: 100, superuserReserved: 3, reserved: 0, clientBackends: 5,
        roleLimit: -1, roleConnections: 1, databaseLimit: -1, databaseConnections: 5 };
    const effective = { host: pin.host, database: pin.database, port: pin.port, storageEndpoint: pin.storageEndpoint,
        projectRef: pin.projectRef, bucket: pin.bucket };
    return { pin, observed, effective, localMigrations: [...pin.migrations] };
}
function memoryIO() {
    return { kind: 'phase96-memory', text: '', cursor: { seq: 0, mac: '0'.repeat(64) }, locked: false, protected: null,
        acquireExclusive() { if (this.locked) throw Error('LOCK_HELD'); this.locked = true; return 'owned-lock'; },
        releaseExclusive(lock) { assert.equal(lock, 'owned-lock'); this.locked = false; },
        readJournal() { return this.text; }, readProtectedCursor() { return structuredClone(this.cursor); },
        appendAndFlush(line) { this.text += line; if (this.failFlush === JSON.parse(line).record.seq) throw Error('fake flush failure'); },
        sealCursor(cursor) { if (this.failSeal) throw Error('fake cursor failure'); this.cursor = structuredClone(cursor); },
        async createProtectedExclusive(directory, bytes) { if (this.protected) throw Error('ALREADY_EXISTS'); this.protected = Buffer.from(bytes); this.directory = directory; },
        async readProtected() { if (!this.protected) throw Error('MISSING_SECRET'); return Buffer.from(this.protected); },
    };
}
function location(targetDigest) {
    const sid = 'S-1-5-21-111-222-333-1001';
    return { localAppData: 'C:\\FakeUser\\AppData\\Local', workspace: 'C:\\Workspace\\repo', runId, targetDigest, sid,
        security: { ownerSid: sid, inherited: false, reparse: false, ancestors: [{ reparse: false }], grants: [sid, 'S-1-5-18'] } };
}
function fakeProtector() {
    // Explicit toy reversible encoding, NOT encryption or a real DPAPI substitute.
    const convert = b => Buffer.from(b.map(x => x ^ 0xa5));
    return { kind: 'phase96-memory', scope: 'CurrentUser', protect: async b => convert(b), unprotect: async b => convert(b) };
}
function harness() {
    const target = targets(), digest = sha256(canonical(target.pin)), io = memoryIO();
    const journal = createJournal({ io, key, runId, targetDigest: digest, clock });
    const protectedState = createProtectedState({ io, protector: fakeProtector(), location: location(digest) });
    const h = { ...target, io, journal, rows: new Map(), trace: [], nextId: 100, dbClosed: false, helperClosed: false,
        recipients: [900, 901], passwords: { admin: 'A'.repeat(43), adviser: 'B'.repeat(43), student: 'C'.repeat(43) } };
    function insert(step, kind, payload) {
        const intent = journal.snapshot().findLast(r => r.step === step);
        assert.equal(intent.step, step); assert.equal(intent.state, 'started'); assert.ok(io.cursor.seq >= intent.seq);
        if (h.failWrite === step) throw Error('fake write error with secret that must not escape');
        const row = { id: h.nextId++, kind, parents: { ...intent.parents }, payload: structuredClone(payload) };
        h.rows.set(step, row); h.trace.push('insert:' + step); return { id: row.id };
    }
    function actor(account, roleId) {
        const row = [...h.rows.values()].find(r => r.id === account.userId && r.kind === 'users');
        if (!row || row.payload.roleId !== roleId || row.payload.isActive !== true || h.denyRole === roleId) throw Error('fake authorization denied');
        h.trace.push('authorize:' + roleId); return true;
    }
    const adapters = { kind: 'phase96-memory',
        async authenticate(credentials) {
            const role = Object.keys(h.passwords).find(role => credentials.email === `${runId}-${role}@example.invalid`);
            const row = h.rows.get(role);
            if (!row || credentials.password !== h.passwords[role] || h.badPassword === role) return { success: false };
            h.trace.push('password:' + role); return { success: true, data: { id: row.id, roleId: row.payload.roleId } };
        },
        async requireCurrentActor(account, roleId) { return actor(account, roleId); },
        async createAdviser(input, account) { actor(account, 1); assert.equal(input.roleId, 2); return insert('adviser', 'users', { firstName: input.firstName, lastName: input.lastName, roleId: 2, isActive: true, email: input.email }); },
        async registerStudent(input) { return insert('student', 'users', { firstName: input.firstName, lastName: input.lastName, roleId: 3, isActive: true, email: input.email }); },
        async createGroup(input, account, hooks) {
            actor(account, 2);
            const group = await hooks.record('group', input, () => insert('group', 'research_groups', { ...input, adviserId: account.userId, status: 'active' }));
            await hooks.record('activity', { action: 'Research Group Created' }, () => insert('activity', 'activity_logs', { adviserId: account.userId, action: 'Research Group Created' }));
            hooks.recipients(h.recipients);
            await Promise.all(h.recipients.map(async recipient => {
                try { await hooks.record(`notification-${recipient}`, { recipient, title: 'New Research Group Created' },
                    () => insert(`notification-${recipient}`, 'notifications', { recipient, title: 'New Research Group Created' })); }
                catch { h.trace.push('swallowed-notification-failure'); }
            }));
            return { success: true, data: { id: group.id } };
        },
        async addMembership(groupId, studentId, account) {
            actor(account, 2); const group = h.rows.get('group'), student = h.rows.get('student');
            assert.equal(group.id, groupId); assert.equal(group.payload.adviserId, account.userId);
            assert.equal(student.id, studentId); assert.equal(group.payload.status, 'active');
            assert.equal(student.payload.isActive, true); assert.ok(!h.rows.has('membership'));
            return insert('membership', 'group_members', { groupId, userId: studentId });
        },
        async createProject(input, account) {
            actor(account, 3); assert.equal(h.rows.get('membership').payload.userId, account.userId);
            assert.equal(h.rows.get('membership').payload.groupId, input.groupId);
            return insert('paper', 'research_papers', { ...input, status: 'Draft', submissions: 0 });
        },
        async verifyOwned(step, ...args) {
            const expectedPayload = args[2];
            if (step === 'credentials') {
                const observed = { kind: 'protected_state', parents: {}, checksum: sha256(io.protected), bytes: io.protected.length };
                const stored = await protectedState.load();
                return { observed, payloadDigest: sha256(canonical({ scope: 'CurrentUser', roles: Object.keys(stored.accounts).sort((a, b) => ['admin', 'adviser', 'student'].indexOf(a) - ['admin', 'adviser', 'student'].indexOf(b)) })),
                    evidence: sha256(canonical(observed)) };
            }
            const row = h.rows.get(step);
            if (h.badPayload === step) row.payload[step === 'paper' ? 'status' : 'isActive'] = step === 'paper' ? 'Approved' : false;
            const readPayload = Object.fromEntries(Object.keys(expectedPayload).map(k => [k, row.payload[k]]));
            const observed = row.kind === 'pdf' ? { kind: 'pdf', parents: {}, ...row.payload } : { kind: row.kind, id: row.id, parents: row.parents };
            if (h.badVerification === step) observed.id = 999999;
            return { observed, payloadDigest: sha256(canonical(readPayload)), evidence: sha256(canonical(observed)) };
        },
    };
    h.deps = { kind: 'phase96-memory', adapters, protectedState, journal, journalKey: key.toString('hex'), hashPolicy: 'bcrypt-12',
        bound: async (label, ms, operation) => { h.trace.push(`bounded:${label}:${ms}`); if (h.timeout === label) throw Error('fake timeout'); return operation(); },
        openReadOnly: async options => { assert.deepEqual(options, { max: 1, connectTimeoutMs: 2000, statementTimeoutMs: 3000, readOnly: true });
            return { observe: async () => h.observed, close: async () => { h.dbClosed = true; if (h.closeDbFailure) throw Error('fake close'); } }; },
        generatePassword: async role => h.passwords[role],
        schemas: { register: async input => { assert.ok(input.firstName.length >= 2 && input.lastName.length >= 2);
            assert.equal(input.password, input.confirmPassword); assert.ok(input.email.endsWith('@example.invalid')); h.trace.push('validate-register'); } },
        hashPassword: async password => { assert.equal(password, h.passwords.admin); h.trace.push('bcrypt-12'); return '$2b$12$' + 'h'.repeat(53); },
        bootstrap: { begin: async () => {
            h.trace.push('begin'); let staged, stagedPayload;
            return { findByEmail: async () => h.existingAccount ? { id: 42 } : undefined,
                insertAdmin: async input => { stagedPayload = structuredClone(input); staged = insert('admin', 'users', input); h.rows.delete('admin');
                    if (h.insertFailure) throw Error('fake transaction failure'); return staged; },
                commit: async () => { h.rows.set('admin', { id: staged.id, kind: 'users', parents: {}, payload: stagedPayload });
                    h.trace.push('commit'); if (h.commitFailure) throw Error('fake lost commit response'); },
                rollback: async () => { h.trace.push('rollback'); if (h.rollbackFailure) throw Error('fake rollback failure'); } };
        } },
        writeLocalPdf: async (name, bytes) => {
            const step = name.endsWith('v1.pdf') ? 'pdf1' : 'pdf2', version = step === 'pdf1' ? 'v1' : 'v2';
            assert.ok(bytes.equals(pdfBytes(version))); assert.equal(journal.snapshot().at(-1).state, 'started');
            h.rows.set(step, { kind: 'pdf', payload: { version, checksum: sha256(bytes), bytes: bytes.length } });
        },
        closeHelper: async () => { h.helperClosed = true; if (h.closeHelperFailure) throw Error('fake helper close'); },
    };
    h.spec = { ...target, runId, permit: { kind: 'synthetic-test-permit', runId, targetDigest: digest, notificationFanout: true } };
    return h;
}
module.exports = { targets, memoryIO, location, fakeProtector, harness, runId, key, clock };
