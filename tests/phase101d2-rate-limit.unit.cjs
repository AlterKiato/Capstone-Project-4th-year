/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomBytes } = require('node:crypto');
const Module = require('node:module');
const names = ['NODE_ENV', 'THESISHS_SHARED_AUTH_LIMITS', 'THESISHS_AUTH_LIMIT_SECRET', 'THESISHS_AUTH_LIMITS_JSON', 'VERCEL', 'THESISHS_AUTH_SOURCE_MODE'];
const previous = Object.fromEntries(names.map(n => [n, process.env[n]]));
let requestHeaders, calls, fail;
const counters = new Map();
const original = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (id === 'next/headers') return { headers: async () => requestHeaders };
    if (id === '@/lib/repositories/auth-rate-limit.repository') return { consumeAuthBuckets: async (global, identities) => {
        calls.push([global, identities]); if (fail) throw Error('private connection error');
        for (const item of [global, ...identities]) {
            const count = counters.get(item.keyDigest) ?? 0;
            if (count >= item.limit) return false;
            counters.set(item.keyDigest, count + 1);
        }
        return true;
    } };
    return original.call(this, id, ...args);
};
const { allowAuthAttempt } = require('../lib/services/auth-rate-limit.service.ts');
const { trustedAuthSource } = require('../lib/auth/request-source.ts');
function reset() {
    names.forEach(n => delete process.env[n]); process.env.NODE_ENV = 'production';
    process.env.THESISHS_AUTH_LIMIT_SECRET = randomBytes(32).toString('hex');
    counters.clear(); calls = []; fail = false; requestHeaders = new Headers();
}
test('Shared authentication limiter boundaries (isolated counters)', async t => {
    await t.test('login normalizes identifiers and caps both existing and unknown accounts identically', async () => {
        reset(); for (let i = 0; i < 10; i++) assert.equal(await allowAuthAttempt('login', 'STUDENT@example.invalid'), true);
        assert.equal(await allowAuthAttempt('login', 'student@example.invalid'), false);
        for (let i = 0; i < 10; i++) assert.equal(await allowAuthAttempt('login', 'unknown@example.invalid'), true);
        assert.equal(await allowAuthAttempt('login', 'UNKNOWN@example.invalid'), false);
    });
    await t.test('registration account and aggregate budgets count duplicates and distinct accounts', async () => {
        reset(); for (let i = 0; i < 5; i++) assert.equal(await allowAuthAttempt('registration', 'same@example.invalid'), true);
        assert.equal(await allowAuthAttempt('registration', 'same@example.invalid'), false);
        for (let i = 6; i < 120; i++) assert.equal(await allowAuthAttempt('registration', `synthetic${i}@example.invalid`), true);
        assert.equal(await allowAuthAttempt('registration', 'new@example.invalid'), false);
    });
    await t.test('verification request and confirmation source budgets apply before delivery/lookup', async () => {
        for (const operation of ['verificationRequest', 'verificationConfirm']) {
            reset(); process.env.VERCEL = '1'; process.env.THESISHS_AUTH_SOURCE_MODE = 'vercel-direct';
            requestHeaders.set('x-vercel-forwarded-for', '192.0.2.1');
            for (let i = 0; i < 120; i++) assert.equal(await allowAuthAttempt(operation, String(i)), true);
            assert.equal(await allowAuthAttempt(operation, 'different'), false);
        }
    });
    await t.test('shared school source permits many accounts but has a finite login budget', async () => {
        reset(); process.env.VERCEL = '1'; process.env.THESISHS_AUTH_SOURCE_MODE = 'vercel-direct';
        requestHeaders.set('x-vercel-forwarded-for', '192.0.2.1');
        for (let i = 0; i < 300; i++) assert.equal(await allowAuthAttempt('login', `synthetic${i}@example.invalid`), true);
        assert.equal(await allowAuthAttempt('login', 'another@example.invalid'), false);
        reset(); for (let i = 0; i < 10; i++) assert.equal(await allowAuthAttempt('verificationRequest', '21'), true);
        assert.equal(await allowAuthAttempt('verificationRequest', '21'), false);
    });
    await t.test('arbitrary forwarded headers are ignored; opt-in Vercel sources require a single valid address', async () => {
        reset(); requestHeaders = new Headers({ 'x-forwarded-for': '192.0.2.1', 'x-real-ip': '192.0.2.2', 'x-vercel-forwarded-for': '192.0.2.3' });
        assert.equal(trustedAuthSource(requestHeaders), null);
        process.env.THESISHS_AUTH_SOURCE_MODE = 'vercel-direct'; assert.equal(trustedAuthSource(requestHeaders), null);
        process.env.VERCEL = '1'; assert.equal(trustedAuthSource(requestHeaders), '192.0.2.3');
        for (const bad of ['unknown', '192.0.2.1,192.0.2.2', '1'.repeat(65), 'fe80::1%eth0']) {
            requestHeaders.set('x-vercel-forwarded-for', bad); assert.equal(trustedAuthSource(requestHeaders), null);
        }
        requestHeaders.set('x-vercel-forwarded-for', '2001:0db8:0000:0000:0000:0000:0000:0001');
        const normalized = trustedAuthSource(requestHeaders);
        requestHeaders.set('x-vercel-forwarded-for', '2001:db8::1'); assert.equal(trustedAuthSource(requestHeaders), normalized);
    });
    await t.test('only HMAC digests and limits reach persistence; unknown source falls back to account/global', async () => {
        reset(); await allowAuthAttempt('login', 'student@example.invalid');
        assert.equal(calls[0][1].length, 1);
        process.env.VERCEL = '1'; process.env.THESISHS_AUTH_SOURCE_MODE = 'vercel-direct'; requestHeaders.set('x-vercel-forwarded-for', '192.0.2.8');
        await allowAuthAttempt('login', 'student@example.invalid'); assert.equal(calls[1][1].length, 2);
        const persisted = JSON.stringify(calls);
        assert.ok(!persisted.includes('@') && !persisted.includes('192.0.2.') && !persisted.includes(process.env.THESISHS_AUTH_LIMIT_SECRET));
        for (const [global, identities] of calls) for (const b of [global, ...identities]) assert.match(b.keyDigest, /^[a-f0-9]{64}$/);
        assert.notEqual(calls[1][0].keyDigest, calls[1][1][0].keyDigest);
    });
    await t.test('database/configuration errors fail closed with no production disable bypass', async () => {
        reset(); fail = true; assert.equal(await allowAuthAttempt('login', 'student@example.invalid'), false);
        fail = false; delete process.env.THESISHS_AUTH_LIMIT_SECRET; process.env.THESISHS_SHARED_AUTH_LIMITS = 'disabled';
        assert.equal(await allowAuthAttempt('login', 'student@example.invalid'), false);
        delete process.env.NODE_ENV; assert.equal(await allowAuthAttempt('login', 'student@example.invalid'), false);
        for (const invalid of ['{}x', '{"login":{"global":0}}', '{"unexpected":1}', '{"login":{"global":1}}']) {
            reset(); process.env.THESISHS_AUTH_LIMITS_JSON = invalid;
            assert.equal(await allowAuthAttempt('login', 'student@example.invalid'), false); assert.equal(calls.length, 0);
        }
    });
    await t.test('explicit local activation gate and validated threshold overrides', async () => {
        reset(); process.env.NODE_ENV = 'development'; delete process.env.THESISHS_AUTH_LIMIT_SECRET;
        assert.equal(await allowAuthAttempt('login'), true); assert.equal(calls.length, 0);
        process.env.THESISHS_SHARED_AUTH_LIMITS = 'enabled'; assert.equal(await allowAuthAttempt('login'), false);
        process.env.THESISHS_AUTH_LIMIT_SECRET = randomBytes(32).toString('hex');
        process.env.THESISHS_AUTH_LIMITS_JSON = JSON.stringify({ login: { account: 1, source: 2, global: 3 } });
        assert.equal(await allowAuthAttempt('login', 'student@example.invalid'), true);
        assert.equal(await allowAuthAttempt('login', 'student@example.invalid'), false);
    });
}).finally(() => { Module._load = original; names.forEach(n => previous[n] === undefined ? delete process.env[n] : process.env[n] = previous[n]); });
