/* eslint-disable @typescript-eslint/no-require-imports */
// node --import tsx --test tests/phase101b1-email-verification.unit.cjs
// Real services/crypto/delivery and transactional in-memory double; NO DB/network.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const crypto = require('node:crypto');
const { createHmac } = crypto;
let forcedRandom, admission = true;
process.env.THESISHS_EMAIL_OTP_SECRET = 'isolated-otp-test-key-'.repeat(3);
const Module = require('node:module');
let session, account, request, now, messages, failSend, failSave, failConsume, failCommit, writes, gate;
const originalEnvironment = process.env.NODE_ENV;
const initialTime = Date.parse('2026-10-21T00:00:00Z');
function reset() {
    forcedRandom = undefined; admission = true;
    process.env.NODE_ENV = 'test';
    session = { userId: 21, roleId: 3, email: 'student@example.invalid' };
    account = { id: 21, roleId: 3, email: 'student@example.invalid', isActive: true, emailVerifiedAt: null };
    request = undefined; now = new Date(initialTime); messages = [];
    failSend = failSave = failConsume = failCommit = false; writes = 0;
    gate = Promise.resolve();
}
function advance(milliseconds) { now = new Date(now.getTime() + milliseconds); }
const digest = token => createHmac('sha256', require('../lib/auth/email-otp-config.ts').emailOtpKey('code')).update(JSON.stringify(['student-email-otp-v1', account.id, account.email, request.lastRequestedAt.toISOString(), token])).digest('hex');
const tokenFrom = message => message.text.match(/code is ([0-9]{6})/)[1];
const persistence = {
    withVerificationAccount: async (userId, work) => {
        const waiting = gate; let release;
        gate = new Promise(resolve => { release = resolve; });
        await waiting;
        const before = structuredClone({ account, request });
        try {
            const result = await work({
                account: account?.id === userId ? structuredClone(account) : undefined,
                now: new Date(now),
                readRequest: async () => structuredClone(request),
                saveRequest: async value => {
                    if (failSave) throw Error('PRIVATE_SAVE');
                    writes++; request = structuredClone(value);
                },
                recordFailure: async () => { request.failedAttempts++; },
                consume: async (value, email) => {
                    assert.equal(request.tokenDigest, value); assert.equal(account.email, email);
                    assert.equal(request.consumedAt, null);
                    request.consumedAt = new Date(now);
                    if (failConsume) throw Error('PRIVATE_CONSUME');
                    account.emailVerifiedAt = new Date(now); writes++;
                },
            });
            if (failCommit) throw Error('PRIVATE_COMMIT');
            return result;
        } catch (error) {
            ({ account, request } = before); throw error;
        } finally { release(); }
    },
};
let authUser, authInserts, sessionsCreated, findEmail;
const mocks = {
    'server-only': {},
    'node:crypto': { ...crypto, randomInt: (...args) => forcedRandom ?? crypto.randomInt(...args) },
    'dotenv/config': {},
    '@/lib/db': { db: {} },
    './auth-rate-limit.service': { allowAuthAttempt: async () => admission },
    '@/lib/services/auth-rate-limit.service': { allowAuthAttempt: async () => true, checkAuthAttempt: async () => ({ status: 'allowed' }) },
    '@/lib/auth/pending-verification': { getPendingVerification: async () => null, createPendingVerification: async value => { session = { ...value, roleId: 3 }; }, deletePendingVerification: async () => {} },
    './email-verification.action': { requestVerificationAction: async () => ({ success: true }) },
    '@/lib/auth/session': {
        getSession: async () => session,
        createSession: async () => { sessionsCreated++; },
        deleteSession: async () => {},
    },
    '@/lib/repositories/email-verification.repository': persistence,
    '../repositories/user.repository': {
        findUserByEmail: async () => findEmail ? authUser : null,
        createUser: async input => { authInserts++; authUser = { id: 21, ...input, isActive: true, emailVerifiedAt: null }; return authUser; },
    },
    'next/navigation': { redirect: path => { throw Error('REDIRECT ' + path); } },
};
const originalLoad = Module._load;
Module._load = function(id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : originalLoad.call(this, id, ...args); };
const { requestStudentEmailVerification: issue, confirmStudentEmailVerification: confirm } = require('../lib/services/email-verification.service.ts');
const { createDevelopmentVerificationDelivery: createDelivery } = require('../lib/email/verification-delivery.ts');
function delivery() {
    return createDelivery('http://127.0.0.1:3000/verify-email', async message => {
        if (failSend) throw Error('PRIVATE_DELIVERY');
        messages.push(message);
    });
}
async function issueToken() {
    assert.equal((await issue(delivery())).success, true);
    return tokenFrom(messages.at(-1));
}
async function denied(token) { assert.equal((await confirm(token)).success, false); assert.equal(account?.emailVerifiedAt ?? null, null); }

test('Student verification core (isolated mocks)', async t => {
    await t.test('leading zeros and an immediate random collision preserve distinct resend codes', async () => {
        reset(); forcedRandom = 7; const first = await issueToken(); assert.equal(first, '000007');
        advance(60000); const second = await issueToken(); assert.equal(second, '000008');
        await denied(first); assert.equal((await confirm(second)).success, true);
    });
    await t.test('durable limiter denial stops both issuance and confirmation before persistence', async () => {
        reset(); const code = await issueToken(); const before = structuredClone(request); admission = false;
        assert.equal((await issue(delivery())).success, false); await denied(code);
        assert.deepEqual(request, before); assert.equal(messages.length, 1);
    });
    await t.test('six digits, HMAC-only persistence, exact expiry, safe public results and current email', async () => {
        reset(); const result = await issue(delivery()); const token = tokenFrom(messages[0]);
        assert.equal(result.success, true); assert.match(token, /^[0-9]{6}$/);
        assert.equal(messages[0].to, account.email); assert.equal(messages[0].to, session.email);
        assert.equal(request.tokenDigest, digest(token)); assert.notEqual(request.tokenDigest, token);
        assert.equal(request.expiresAt.getTime() - request.lastRequestedAt.getTime(), 300000);
        assert.equal(request.requestTimes.length, 1); assert.equal(request.consumedAt, null);
        assert.ok(!JSON.stringify(result).includes(token)); assert.ok(!JSON.stringify(result).includes(request.tokenDigest));
        advance(60000); const another = await issueToken(); assert.notEqual(another, token);
    });
    await t.test('valid explicit confirmation consumes once without a session or account mutations beyond timestamp', async () => {
        reset(); const token = await issueToken(); const original = structuredClone(account);
        const result = await confirm(token);
        assert.equal(result.success, true); assert.deepEqual(account, { ...original, emailVerifiedAt: now });
        assert.deepEqual(request.consumedAt, now); assert.equal((await confirm(token)).success, false);
    });
    await t.test('delivering a code does not consume it', async () => {
        reset(); await issueToken(); assert.equal(account.emailVerifiedAt, null); assert.equal(request.consumedAt, null);
    });
    await t.test('five wrong submissions invalidate the challenge, including malformed codes', async () => {
        reset(); const token = await issueToken();
        for (let i = 0; i < 5; i++) await denied('bad');
        assert.equal(request.failedAttempts, 5); await denied(token);
        advance(60000); const next = await issueToken();
        assert.equal(request.failedAttempts, 0); assert.equal((await confirm(next)).success, true);
    });
    await t.test('expiry boundary is exclusive; just-before expiry works', async () => {
        reset(); const expired = await issueToken(); advance(300000); await denied(expired);
        reset(); const valid = await issueToken(); advance(299999); assert.equal((await confirm(valid)).success, true);
    });
    await t.test('resend cooldown, exact 60-second boundary and previous-token invalidation', async () => {
        reset(); const previous = await issueToken(); advance(59999);
        assert.equal((await issue(delivery())).success, false); assert.equal(messages.length, 1);
        advance(1); const next = await issueToken(); await denied(previous);
        assert.equal((await confirm(next)).success, true);
    });
    await t.test('five requests per true rolling hour, not a fixed window', async () => {
        reset(); await issueToken();
        for (let i = 1; i < 5; i++) { advance(60000); await issueToken(); }
        advance(60000); assert.equal((await issue(delivery())).success, false);
        now = new Date(initialTime + 3599999); assert.equal((await issue(delivery())).success, false);
        advance(1); await issueToken(); assert.equal(request.requestTimes.length, 5);
        advance(60000); await issueToken(); // Exactly one older request has aged out.
        advance(60000); await issueToken();
        assert.equal(request.requestTimes.length, 5);
    });
    await t.test('concurrent first requests and resends produce one winner; hourly quota survives contention', async () => {
        reset(); let results = await Promise.all(Array.from({ length: 12 }, () => issue(delivery())));
        assert.equal(results.filter(r => r.success).length, 1); assert.equal(messages.length, 1);
        const first = tokenFrom(messages[0]); advance(60000);
        results = await Promise.all(Array.from({ length: 12 }, () => issue(delivery())));
        assert.equal(results.filter(r => r.success).length, 1); await denied(first);
        for (let i = 2; i < 5; i++) { advance(60000); await issueToken(); }
        advance(60000); results = await Promise.all(Array.from({ length: 12 }, () => issue(delivery())));
        assert.equal(results.filter(r => r.success).length, 0); assert.equal(request.requestTimes.length, 5);
    });
    await t.test('concurrent confirmation has exactly one winner', async () => {
        reset(); const token = await issueToken();
        const results = await Promise.all(Array.from({ length: 12 }, () => confirm(token)));
        assert.equal(results.filter(r => r.success).length, 1);
    });
    await t.test('confirmation racing resend follows the account lock and never verifies twice', async () => {
        reset(); const token = await issueToken(); advance(60000);
        const results = await Promise.all([issue(delivery()), confirm(token)]);
        assert.equal(results[0].success, true); assert.equal(results[1].success, false);
        assert.equal((await confirm(tokenFrom(messages.at(-1)))).success, true);
    });
    await t.test('unauthorized sessions cannot request or choose another account', async () => {
        for (const value of [null, { userId: 21, roleId: 1 }, { userId: 21, roleId: 2 }, { userId: 21, roleId: 4 },
            { userId: '21', roleId: 3 }, { userId: 0, roleId: 3 }, { userId: 2147483648, roleId: 3 }, { userId: 22, roleId: 3 }]) {
            reset(); session = value; assert.equal((await issue(delivery())).success, false); assert.equal(writes, 0);
        }
    });
    await t.test('current inactive, missing, non-Student and verified accounts reject requests and confirmation', async () => {
        for (const patch of [{ isActive: false }, { roleId: 1 }, { roleId: 2 }, { roleId: 4 }]) {
            reset(); const token = await issueToken(); Object.assign(account, patch);
            await denied(token); assert.equal((await issue(delivery())).success, false);
        }
        reset(); const token = await issueToken(); account = undefined; await denied(token);
        reset(); await issueToken(); account.emailVerifiedAt = new Date(now);
        assert.equal((await issue(delivery())).success, false);
    });
    await t.test('changed email invalidates old code; revalidated identity can request the new email', async () => {
        reset(); const old = await issueToken(); account.email = 'changed@example.invalid'; await denied(old); session.email = account.email;
        advance(60000); const fresh = await issueToken(); assert.equal(request.requestTimes.length, 2);
        assert.equal(messages.at(-1).to, account.email); assert.equal((await confirm(fresh)).success, true);
    });
    await t.test('invalid current email and backward clock fail closed', async () => {
        reset(); account.email = 'invalid'; assert.equal((await issue(delivery())).success, false);
        reset(); const token = await issueToken(); advance(-1); await denied(token);
        assert.equal((await issue(delivery())).success, false);
    });
    await t.test('delivery failure preserves quota and permits a later replacement without leakage', async () => {
        reset(); failSend = true; const result = await issue(delivery());
        assert.equal(result.success, false); assert.equal(request.requestTimes.length, 1); assert.equal(account.emailVerifiedAt, null);
        assert.ok(!JSON.stringify(result).includes('PRIVATE')); failSend = false;
        assert.equal((await issue(delivery())).success, false); advance(60000);
        const token = await issueToken(); assert.equal(request.requestTimes.length, 2);
        assert.equal((await confirm(token)).success, true);
    });
    await t.test('persistence/commit failures roll back and never deliver an uncommitted token', async () => {
        for (const mode of ['save', 'commit']) {
            reset(); failSave = mode === 'save'; failCommit = mode === 'commit';
            const result = await issue(delivery()); assert.equal(result.success, false);
            assert.equal(request, undefined); assert.equal(messages.length, 0); assert.ok(!JSON.stringify(result).includes('PRIVATE'));
        }
        reset(); const token = await issueToken(); failConsume = true; await denied(token); assert.equal(request.consumedAt, null);
        failConsume = false; failCommit = true; await denied(token); assert.equal(request.consumedAt, null);
        failCommit = false; assert.equal((await confirm(token)).success, true);
    });
    await t.test('development delivery refuses production, missing environments and non-loopback links', async () => {
        reset(); const adapter = delivery(); process.env.NODE_ENV = 'production';
        assert.throws(delivery); assert.equal((await issue(adapter)).success, false); assert.equal(writes, 0);
        await assert.rejects(adapter.sendVerificationCode(account.email, 'synthetic')); assert.equal(messages.length, 0);
        delete process.env.NODE_ENV; assert.throws(delivery); process.env.NODE_ENV = 'test';
        for (const url of ['https://example.invalid/verify', 'http://example.invalid/verify', 'file:///verify',
            'http://user:secret@localhost/verify', 'http://localhost/verify?x=1', 'http://localhost/verify#token'])
            assert.throws(() => createDelivery(url, async () => {}));
    });
    await t.test('registration and password recovery stay pending; existing Students and staff retain login', async () => {
        reset(); const { registerAction, loginAction } = require('../lib/actions/auth.action.ts');
        authInserts = sessionsCreated = 0; findEmail = false;
        const form = new FormData();
        for (const [key, value] of Object.entries({ firstName: 'Synthetic', lastName: 'Student', email: 'NEW@example.invalid',
            password: 'synthetic-test-only-password', confirmPassword: 'synthetic-test-only-password' })) form.set(key, value);
        await assert.rejects(registerAction({}, form), /REDIRECT \/verify-email/);
        assert.equal(authUser.roleId, 3); assert.equal(authUser.emailVerifiedAt, null); assert.equal(authInserts, 1);
        assert.notEqual(authUser.password, form.get('password')); assert.equal(sessionsCreated, 0); assert.equal(authUser.emailVerificationRequired, true);
        findEmail = true;
        await assert.rejects(loginAction({}, form), /REDIRECT \/verify-email/);
        authUser.emailVerificationRequired = false;
        for (const roleId of [3, 1, 2]) {
            authUser.roleId = roleId; await assert.rejects(loginAction({}, form), /REDIRECT \/dashboard/);
        }
        assert.equal(sessionsCreated, 3); assert.equal(messages.length, 0); assert.equal(writes, 0);
        authUser.isActive = false; assert.equal((await loginAction({}, form)).success, false);
    });
}).finally(() => {
    Module._load = originalLoad;
    if (originalEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalEnvironment;
});
