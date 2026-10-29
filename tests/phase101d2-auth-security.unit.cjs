/* eslint-disable @typescript-eslint/no-require-imports */
// Real JWT/bcrypt/services/authorization, synthetic cookie/repository/delivery boundaries only.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomBytes } = require('node:crypto');
const Module = require('node:module');
const bcrypt = require('bcrypt');
const previous = { NODE_ENV: process.env.NODE_ENV, JWT_SECRET: process.env.JWT_SECRET,
    THESISHS_LOCAL_MAILPIT: process.env.THESISHS_LOCAL_MAILPIT, THESISHS_VERIFICATION_ORIGIN: process.env.THESISHS_VERIFICATION_ORIGIN };
process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = randomBytes(64).toString('hex');
let cookie, account, allowed = true, lookupFailure = false, duplicateRace = false, uniqueInsert = false;
let reads = 0, inserts = 0, comparisons = 0, hashes = 0, protectedReads = 0, deleted = [], issued = 0, confirmed = [];
const limitCalls = [], order = [];
const users = {
    findUserById: async id => { if (lookupFailure) throw Error('private database failure'); return account?.id === id ? account : undefined; },
    findUserByEmail: async email => { reads++; order.push('lookup'); return account?.email === email ? account : undefined; },
    createUser: async data => {
        inserts++; if (duplicateRace || uniqueInsert && account) throw Error('unique email conflict');
        const created = { id: 21, ...data, isActive: true }; if (uniqueInsert) account = created; return created;
    },
};
const notices = [{ id: 1, userId: 21, isRead: false }, { id: 2, userId: 22, isRead: false }];
const query = value => async () => { protectedReads++; return value; };
const headers = new Headers({ origin: 'http://127.0.0.1:3031', host: '127.0.0.1:3031' });
const original = Module._load;
const mocks = {
    'server-only': {}, 'dotenv/config': {},
    'next/headers': { cookies: async () => ({ get: () => cookie ? { value: cookie } : undefined }), headers: async () => headers },
    'next/navigation': { redirect: path => { throw Error('REDIRECT ' + path); } },
    '@/lib/repositories/user.repository': users, '../repositories/user.repository': users,
    '@/lib/auth/hash': {
        hashPassword: async password => { hashes++; return bcrypt.hash(password, 12); },
        comparePassword: async (password, hash) => { comparisons++; order.push('bcrypt'); return bcrypt.compare(password, hash); },
    },
    '@/lib/services/auth-rate-limit.service': {
        allowAuthAttempt: async (...args) => { limitCalls.push(args); order.push('limit'); return allowed; },
        checkAuthAttempt: async (...args) => { limitCalls.push(args); order.push('limit'); return { status: allowed ? 'allowed' : 'limited' }; },
    },
    '@/lib/repositories/notification.repository': {
        findNotificationsByUserId: query(notices.slice(0, 1)), findNotificationPreview: query({ recent: [], unreadCount: 0 }),
        findNotificationById: async id => { protectedReads++; return notices.find(n => n.id === id); },
        deleteNotification: async id => deleted.push(id),
    },
    '@/lib/repositories/repository.repository': {
        findPublishedResearchPage: query({ items: [], total: 0 }), findPublishedRepositoryFilterOptions: query({}),
        findPublishedRepositoryEntry: query({ id: 1, paperId: 20 }), incrementRepositoryViewCount: query(undefined),
    },
    '@/lib/services/repository-publication.service': {}, '@/lib/services/repository-document.service': {},
    '@/lib/services/email-verification-status.service': { getCurrentStudentVerificationStatus: async () => ({ verified: false }) },
    '@/lib/email/mailpit-delivery': { createMailpitVerificationDelivery: () => ({}) },
    '@/lib/services/email-verification.service': {
        requestStudentEmailVerification: async () => { issued++; return { success: true }; },
        confirmStudentEmailVerification: async token => { confirmed.push(token); return { success: true }; },
    },
};
Module._load = function(id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args); };
const { createToken, verifyToken } = require('../lib/auth/jwt.ts');
const { requireAuth, requireRole } = require('../lib/auth/authorization.ts');
const { registerSchema, loginSchema } = require('../lib/validations/auth.ts');
const { managedAccountSchema } = require('../lib/validations/user.ts');
const { registerUser, loginUser } = require('../lib/services/auth.service.ts');
const notifications = require('../lib/services/notification.service.ts');
const repository = require('../lib/services/repository.service.ts');
const verification = require('../lib/actions/email-verification.action.ts');
const input = password => ({ firstName: 'Synthetic', lastName: 'Student', email: 'student@example.invalid', password, confirmPassword: password });
async function active(roleId = 3) {
    account = { id: 21, roleId, isActive: true, email: 'student@example.invalid' };
    cookie = await createToken({ userId: 21, roleId, email: account.email }); lookupFailure = false;
}
test('Authentication security and authorization (isolated boundaries)', async t => {
    const { SignJWT } = await import('jose');
    const key = new TextEncoder().encode(process.env.JWT_SECRET);
    const now = Math.floor(Date.now() / 1000);
    const claims = { userId: 21, roleId: 3, email: 'student@example.invalid', iat: now, exp: now + 604800 };
    const sign = payload => new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).sign(key);
    await t.test('normally issued existing-format tokens retain seven-day compatibility', async () => {
        const result = await verifyToken(await sign(claims)); assert.equal(result.exp - result.iat, 604800);
        assert.equal((await verifyToken(await createToken({ userId: 21, roleId: 3, email: claims.email }))).userId, 21);
    });
    await t.test('missing, incorrectly typed, unbounded, unsupported, expired and future claims reject safely', async () => {
        for (const name of ['exp', 'iat', 'userId', 'roleId', 'email']) {
            const value = { ...claims }; delete value[name]; assert.equal(await verifyToken(await sign(value)), null, name);
        }
        for (const patch of [{ userId: '21' }, { userId: 0 }, { userId: 2147483648 }, { userId: 1.5 },
            { roleId: '3' }, { roleId: 99 }, { email: null }, { email: 'bad' }, { exp: 'tomorrow' },
            { exp: Infinity }, { iat: 'today' }, { iat: -1 }, { iat: now + 300 }, { iat: 1.5 },
            { exp: now - 1 }, { iat: now + 1, exp: now + 1 }, { iat: Number.MAX_SAFE_INTEGER + 1 }])
            assert.equal(await verifyToken(await sign({ ...claims, ...patch })), null, JSON.stringify(patch));
        const forged = await new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).sign(randomBytes(64));
        assert.equal(await verifyToken(forged), null);
    });
    await t.test('new Student and managed passwords enforce UTF-8 bytes; legacy login schema is unchanged', () => {
        for (const password of ['a'.repeat(72), 'é'.repeat(36), '😀'.repeat(18)]) {
            assert.equal(registerSchema.safeParse(input(password)).success, true);
            assert.equal(managedAccountSchema.safeParse({ ...input(password), roleId: 2 }).success, true);
        }
        for (const password of ['a'.repeat(73), 'é'.repeat(37), '😀'.repeat(19)]) {
            assert.equal(registerSchema.safeParse(input(password)).success, false);
            assert.equal(managedAccountSchema.safeParse({ ...input(password), roleId: 1 }).success, false);
            assert.equal(loginSchema.safeParse({ email: claims.email, password }).success, true);
        }
    });
    await t.test('limiting precedes account lookup/bcrypt and has an existence-independent public response', async () => {
        await active(); allowed = false; const before = [reads, comparisons, hashes, inserts];
        const existing = await loginUser({ email: account.email, password: 'synthetic-password' });
        const unknown = await loginUser({ email: 'unknown@example.invalid', password: 'synthetic-password' });
        assert.deepEqual(existing, unknown); assert.equal(existing.success, false);
        assert.equal((await registerUser(input('synthetic-password'))).message, existing.message);
        assert.deepEqual([reads, comparisons, hashes, inserts], before); allowed = true;
    });
    await t.test('wrong, missing and inactive logins perform bcrypt and return the same failure', async () => {
        await active(); account.password = await bcrypt.hash('synthetic-password', 12);
        const before = comparisons; order.length = 0;
        const wrong = await loginUser({ email: account.email, password: 'synthetic-wrong' });
        account.isActive = false;
        const inactive = await loginUser({ email: account.email, password: 'synthetic-password' });
        const missing = await loginUser({ email: 'missing@example.invalid', password: 'synthetic-password' });
        assert.deepEqual(wrong, inactive); assert.deepEqual(wrong, missing); assert.equal(comparisons - before, 3);
        assert.deepEqual(order, ['limit', 'lookup', 'bcrypt', 'limit', 'lookup', 'bcrypt', 'limit', 'lookup', 'bcrypt']);
    });
    await t.test('real bcrypt legacy passwords over 72 bytes still log in; duplicate races are controlled', async () => {
        await active(); const password = 'é'.repeat(40); account.password = await bcrypt.hash(password, 12);
        assert.equal((await loginUser({ email: account.email.toUpperCase(), password })).success, true);
        const duplicate = await registerUser(input('synthetic-password'));
        account = undefined; duplicateRace = true;
        const race = await registerUser(input('synthetic-password')); duplicateRace = false;
        assert.deepEqual(duplicate, race);
        const before = hashes; assert.equal((await registerUser(input('é'.repeat(37)))).success, false); assert.equal(hashes, before);
    });
    const readOperations = () => [() => notifications.getUserNotifications(21), () => notifications.getCurrentNotificationPreview(),
        () => notifications.removeUserNotification(1, 21), () => repository.getPublishedResearch({}),
        () => repository.getPublishedResearchDetails(20), () => repository.getPublishedResearchFilterOptions(),
        () => repository.recordResearchRepositoryView(1)];
    await t.test('concurrent normalized registration relies on unique email and yields one successful account', async () => {
        account = undefined; uniqueInsert = true;
        const results = await Promise.all([registerUser(input('synthetic-password')),
            registerUser({ ...input('synthetic-password'), email: 'STUDENT@example.invalid' })]);
        assert.equal(results.filter(result => result.success).length, 1);
        assert.equal(account.email, 'student@example.invalid'); assert.equal(account.roleId, 3); uniqueInsert = false;
    });
    await t.test('valid JWTs for deleted, deactivated, stale-role and database-unavailable accounts deny protected reads/deletes', async () => {
        for (const change of [() => { account = undefined; }, () => { account.isActive = false; },
            () => { account.roleId = 2; }, () => { lookupFailure = true; }]) {
            await active(); change(); const before = [protectedReads, deleted.length];
            await assert.rejects(requireAuth(), /REDIRECT \/login/);
            for (const operation of readOperations()) await assert.rejects(operation, /REDIRECT \/login/);
            assert.deepEqual([protectedReads, deleted.length], before);
        }
    });
    await t.test('all active roles keep repository/self-notification reads despite limiter unavailability', async () => {
        allowed = false; const before = limitCalls.length;
        for (const roleId of [1, 2, 3, 4]) {
            await active(roleId); assert.equal((await notifications.getUserNotifications(21)).success, true);
            await repository.getPublishedResearch({}); await repository.getPublishedResearchDetails(20);
            await repository.getPublishedResearchFilterOptions(); assert.equal((await requireAuth()).roleId, roleId);
        }
        assert.equal(limitCalls.length, before, 'Research reads do not use the mutation limiter'); allowed = true;
    });
    await t.test('notification deletion/read ownership and current cross-role checks reject forged scope', async () => {
        await active(); const before = deleted.length;
        assert.equal((await notifications.removeUserNotification(2, 21)).success, false);
        assert.equal((await notifications.removeUserNotification(1, 22)).success, false);
        assert.equal((await notifications.getUserNotifications(22)).success, false);
        assert.equal(deleted.length, before);
        assert.equal((await notifications.removeUserNotification(1, 21)).success, true); assert.equal(deleted.at(-1), 1);
        await assert.rejects(requireRole([1]), /REDIRECT \/dashboard/);
    });
    await t.test('shared verification denial stops issuance and malformed-token lookup; production remains closed', async () => {
        await active(); process.env.NODE_ENV = 'development'; process.env.THESISHS_LOCAL_MAILPIT = 'enabled';
        process.env.THESISHS_VERIFICATION_ORIGIN = 'http://127.0.0.1:3031';
        globalThis.verificationEndpointBuckets.clear(); allowed = false;
        const form = new FormData(); form.set('token', 'synthetic-malformed');
        assert.equal((await verification.requestVerificationAction({}, form)).success, false);
        assert.equal((await verification.confirmVerificationAction({}, form)).success, false);
        assert.equal(issued, 0); assert.equal(confirmed.length, 0);
        assert.deepEqual(limitCalls.at(-1), ['verificationConfirm']);
        allowed = true; assert.equal((await verification.requestVerificationAction({}, form)).success, true);
        assert.equal((await verification.confirmVerificationAction({}, form)).success, true);
        assert.deepEqual(confirmed, ['synthetic-malformed']);
        const before = limitCalls.length; process.env.NODE_ENV = 'production';
        assert.equal((await verification.requestVerificationAction({}, form)).success, false);
        assert.equal((await verification.confirmVerificationAction({}, form)).success, false);
        assert.equal(limitCalls.length, before); assert.equal(issued, 1); assert.equal(confirmed.length, 1);
    });
}).finally(() => {
    Module._load = original;
    for (const [n, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[n]; else process.env[n] = value;
    }
});
