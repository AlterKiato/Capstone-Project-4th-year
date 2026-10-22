/* eslint-disable @typescript-eslint/no-require-imports */
// Actual Drizzle SQL/repositories with a remote driver double. NO DB/network.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const { drizzle } = require('drizzle-orm/pg-proxy');
const schema = require('../db/schema/index.ts');
const queries = [], transactions = [];
const time = new Date('2026-10-21T00:00:00Z');
let verificationMode = false, missingAccountUpdate = false;
const db = drizzle(async (query, params, method) => {
    queries.push({ query, params });
    if (query.includes('clock_timestamp()')) return { rows: [{ now: time.toISOString() }] };
    if (method === 'execute') return { rows: [{ id: 21 }] };
    if (query.startsWith('update "users"')) return { rows: missingAccountUpdate ? [] : [[21]] };
    if (query.startsWith('update "email_verification_requests"')) return { rows: [[21]] };
    if (query.includes('from "email_verification_requests"')) {
        if (!query.includes('"requested_email"')) return { rows: [[21]] };
        return { rows: [[21, 'student@example.invalid', 'a'.repeat(64), new Date(time.getTime() + 3600000).toISOString(),
            null, time.toISOString(), [time.toISOString()]]] };
    }
    if (query.includes('from "users"')) {
        if (verificationMode) return { rows: [[21, 'student@example.invalid', 3, true, null]] };
        assert.ok(!query.includes('email_verified_at'), 'Legacy SQL must work before migration');
        if (!query.includes('first_name')) return { rows: [[1, true]] };
        return { rows: [[21, 'Synthetic', 'Student', 'student@example.invalid', 'synthetic-hash', 3,
            null, true, null, time.toISOString(), time.toISOString()]] };
    }
    return { rows: [] };
}, { schema });
// The proxy driver has no transaction support. This records callback boundaries only;
// database lock/rollback behavior remains subject to separately authorized live tests.
db.transaction = async work => {
    transactions.push('begin');
    try { const value = await work(db); transactions.push('commit'); return value; }
    catch (error) { transactions.push('rollback'); throw error; }
};
const originalLoad = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (id === '@/lib/db') return { db };
    return originalLoad.call(this, id, ...args);
};
const users = require('../lib/repositories/user.repository.ts');
const publication = require('../lib/repositories/repository-publication.repository.ts');
const verification = require('../lib/repositories/email-verification.repository.ts');

test('Verification and Stage 1 SQL contracts (driver double)', async t => {
    await t.test('existing reads/inserts and managed creation omit the pending user column', async () => {
        const input = { firstName: 'Synthetic', lastName: 'Student', email: 'student@example.invalid',
            password: 'synthetic-hash', roleId: 3 };
        await users.findUserByEmail(input.email); await users.findUserById(21); await users.findUsersByRoleId(3);
        const user = await users.createUser(input); assert.equal(user.id, 21); assert.equal(user.email, input.email);
        await users.createManagedUserForAdmin({ ...input, roleId: 2 }, 10);
        await publication.withPublicationContext(21, 10, async () => {});
        const inserts = queries.filter(item => item.query.startsWith('insert into "users"'));
        assert.equal(inserts.length, 2);
        for (const item of queries) assert.ok(!item.query.includes('email_verified_at'));
        assert.ok(inserts.every(item => item.params.includes('synthetic-hash') && !item.query.includes('synthetic-hash')));
        assert.ok(inserts.every(item => item.query.includes('default')));
        queries.length = 0;
    });
    await t.test('request operations lock the user before getting the clock and upserting one row', async () => {
        verificationMode = true;
        await verification.withVerificationAccount(21, async store => {
            assert.equal(store.account.id, 21); assert.deepEqual(store.now, time);
            const request = await store.readRequest();
            assert.ok(request.expiresAt instanceof Date); assert.ok(request.requestTimes[0] instanceof Date);
            await store.saveRequest(request);
        });
        assert.match(queries[0].query, /from "users".*for update/);
        assert.match(queries[1].query, /clock_timestamp\(\)/);
        const upsert = queries.find(item => item.query.startsWith('insert into "email_verification_requests"'));
        assert.match(upsert.query, /on conflict \("user_id"\) do update/);
        assert.ok(upsert.params.some(value => Array.isArray(value) || typeof value === 'string' && value.includes('2026')));
        assert.equal(transactions.at(-1), 'commit'); queries.length = 0;
    });
    await t.test('digest lookup is parameterized and consumption updates both rows in the same transaction', async () => {
        assert.equal(await verification.findVerificationUserId('a'.repeat(64)), 21);
        assert.ok(!queries[0].query.includes('a'.repeat(64))); queries.length = 0;
        await verification.withVerificationAccount(21, store => store.consume('a'.repeat(64), 'student@example.invalid'));
        const mutations = queries.filter(item => item.query.startsWith('update '));
        assert.equal(mutations.length, 2);
        assert.match(mutations[0].query, /"consumed_at" is null/);
        assert.match(mutations[0].query, /"expires_at" > \$/);
        assert.match(mutations[1].query, /"email_verified_at" is null/);
        assert.match(mutations[1].query, /"email" = \$/);
        assert.match(mutations[1].query, /"is_active" = \$/);
        assert.match(mutations[1].query, /"role_id" = \$/);
        assert.ok(mutations[1].params.includes(3));
        assert.equal(transactions.at(-1), 'commit'); queries.length = 0;
    });
    await t.test('failed account update throws out of the transaction callback for rollback', async () => {
        missingAccountUpdate = true;
        await assert.rejects(verification.withVerificationAccount(21, store => store.consume('a'.repeat(64), 'student@example.invalid')));
        assert.equal(transactions.at(-1), 'rollback');
    });
}).finally(() => { Module._load = originalLoad; });
