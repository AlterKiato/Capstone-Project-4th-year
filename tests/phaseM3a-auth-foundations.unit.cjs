/* eslint-disable @typescript-eslint/no-require-imports */
// Real jose, limiter/service/resolver and web session modules; synthetic I/O boundaries only.
// No dotenv loading, database driver, network, real accounts or secret-file access.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomBytes } = require('node:crypto');
const Module = require('node:module');
const names = ['NODE_ENV', 'JWT_SECRET', 'THESISHS_MOBILE_JWT_SECRET', 'THESISHS_MOBILE_JWT_ISSUER',
    'THESISHS_SHARED_AUTH_LIMITS', 'THESISHS_AUTH_LIMIT_SECRET', 'THESISHS_AUTH_LIMITS_JSON',
    'VERCEL', 'THESISHS_AUTH_SOURCE_MODE'];
const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
const webKey = randomBytes(64).toString('hex'), mobileKey = randomBytes(64).toString('hex');
const issuer = 'https://synthetic-mobile.example.invalid';
let account, cookie, admission, lookupFailure, hashFailure, calls, reads, comparisons;
const principal = { id: 21, email: 'student@example.invalid', roleId: 3, firstName: 'Synthetic', lastName: 'Student' };
function reset() {
    names.forEach(name => delete process.env[name]);
    Object.assign(process.env, { NODE_ENV: 'production', JWT_SECRET: webKey,
        THESISHS_MOBILE_JWT_SECRET: mobileKey, THESISHS_MOBILE_JWT_ISSUER: issuer,
        THESISHS_AUTH_LIMIT_SECRET: randomBytes(32).toString('hex') });
    account = { ...principal, password: 'synthetic-hash', isActive: true, emailVerifiedAt: null };
    cookie = undefined; admission = true; lookupFailure = hashFailure = false;
    calls = []; reads = comparisons = 0;
}
reset();
const users = {
    findUserById: async id => { reads++; if (lookupFailure) throw Error('private database detail'); return account?.id === id ? account : undefined; },
    findUserByEmail: async email => { reads++; if (lookupFailure) throw Error('private database detail'); return account?.email === email ? account : undefined; },
};
const original = Module._load;
const mocks = {
    'server-only': {}, 'dotenv/config': {},
    'next/headers': {
        headers: async () => new Headers(),
        cookies: async () => ({ get: () => cookie ? { value: cookie } : undefined }),
    },
    '@/lib/repositories/user.repository': users, '../repositories/user.repository': users,
    '@/lib/repositories/auth-rate-limit.repository': { consumeAuthBuckets: async (...args) => {
        calls.push(args); if (admission === 'unavailable') throw Error('private limiter detail'); return admission;
    } },
    '@/lib/auth/hash': { comparePassword: async (password, hash) => {
        comparisons++; if (hashFailure) throw Error('private hash detail');
        return password === 'synthetic-password' && hash === 'synthetic-hash';
    } },
};
Module._load = function(id, ...args) {
    if (id === '@/lib/db' || id === 'postgres') throw Error('Database imports forbidden in this isolated test');
    return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args);
};
const web = require('../lib/auth/jwt.ts');
const mobile = require('../lib/auth/mobile-jwt.ts');
const { resolveCurrentAccount } = require('../lib/auth/account-principal.ts');
const { getCurrentAccount } = require('../lib/auth/current-account.ts');
const { validateCredentials, loginUser } = require('../lib/services/auth.service.ts');
const { checkAuthAttempt, allowAuthAttempt } = require('../lib/services/auth-rate-limit.service.ts');
const { AUTH_RETRY_MESSAGE } = require('../lib/auth/auth-rate-limit-config.ts');
const credentials = { email: principal.email, password: 'synthetic-password' };

test('M.3A shared authentication and isolated mobile JWT foundations', async t => {
    const { SignJWT } = await import('jose');
    const now = Math.floor(Date.now() / 1000);
    const profile = { userId: principal.id, email: principal.email, roleId: 3, iss: issuer,
        aud: mobile.MOBILE_TOKEN_AUDIENCE, iat: now, exp: now + 86400 };
    const sign = (payload = profile, header = { alg: 'HS256', typ: mobile.MOBILE_TOKEN_TYPE }, key = mobileKey) =>
        new SignJWT(payload).setProtectedHeader(header).sign(new TextEncoder().encode(key));

    await t.test('absent mobile configuration does not break seven-day web JWTs or module loading', async () => {
        reset(); delete process.env.THESISHS_MOBILE_JWT_SECRET; delete process.env.THESISHS_MOBILE_JWT_ISSUER;
        const token = await web.createToken({ userId: principal.id, email: principal.email, roleId: 3 });
        const claims = await web.verifyToken(token);
        assert.equal(claims.exp - claims.iat, 604800);
        assert.deepEqual(await mobile.verifyMobileToken(token), { status: 'unavailable' });
        await assert.rejects(mobile.createMobileToken(principal), /Mobile authentication unavailable/);
    });
    await t.test('issuance uses only the server Student principal and fixed 24-hour expiry', async () => {
        reset();
        const issued = await mobile.createMobileToken({ ...principal, userId: 999, iat: 0, exp: 1, iss: 'forged', aud: 'forged' });
        const result = await mobile.verifyMobileToken(issued.token);
        assert.equal(result.status, 'valid');
        assert.deepEqual(Object.keys(result.claims).sort(), ['aud', 'email', 'exp', 'iat', 'iss', 'roleId', 'userId'].sort());
        assert.equal(result.claims.userId, principal.id); assert.equal(result.claims.roleId, 3);
        assert.equal(result.claims.exp - result.claims.iat, 86400);
        assert.equal(issued.expiresAt, new Date(result.claims.exp * 1000).toISOString());
        assert.ok(!issued.token.includes('synthetic-hash'));
    });
    await t.test('non-Student roles and invalid identities cannot be issued mobile tokens', async () => {
        reset();
        for (const patch of [{ roleId: 1 }, { roleId: 2 }, { roleId: 4 }, { roleId: '3' },
            { id: 0 }, { id: 2147483648 }, { id: 1.5 }, { email: 'invalid' }])
            await assert.rejects(mobile.createMobileToken({ ...principal, ...patch }));
    });
    await t.test('missing, reused, weak or malformed configuration fails closed without web-key fallback', async () => {
        for (const [name, value] of [
            ['THESISHS_MOBILE_JWT_SECRET', undefined], ['THESISHS_MOBILE_JWT_SECRET', webKey],
            ['THESISHS_MOBILE_JWT_SECRET', 'short'], ['THESISHS_MOBILE_JWT_SECRET', ' ' + mobileKey],
            ['THESISHS_MOBILE_JWT_SECRET', 'a'.repeat(4097)],
            ['THESISHS_MOBILE_JWT_ISSUER', undefined], ['THESISHS_MOBILE_JWT_ISSUER', ''],
            ['THESISHS_MOBILE_JWT_ISSUER', issuer + ' '], ['THESISHS_MOBILE_JWT_ISSUER', 'a'.repeat(256)],
            ['JWT_SECRET', undefined],
        ]) {
            reset(); if (value === undefined) delete process.env[name]; else process.env[name] = value;
            assert.deepEqual(await mobile.verifyMobileToken(await sign()), { status: 'unavailable' }, name);
            await assert.rejects(mobile.createMobileToken(principal), /Mobile authentication unavailable/);
        }
    });
    await t.test('web and mobile reject each other; web-format tokens under the mobile key also reject', async () => {
        reset();
        const issued = await mobile.createMobileToken(principal);
        const webToken = await web.createToken({ userId: principal.id, roleId: 3, email: principal.email });
        assert.equal(await web.verifyToken(issued.token), null);
        assert.deepEqual(await mobile.verifyMobileToken(webToken), { status: 'invalid' });
        const webFormatUsingMobileKey = await sign({ userId: principal.id, roleId: 3, email: principal.email, iat: now, exp: now + 604800 }, { alg: 'HS256' });
        assert.deepEqual(await mobile.verifyMobileToken(webFormatUsingMobileKey), { status: 'invalid' });
        assert.deepEqual(await mobile.verifyMobileToken(await sign(profile, undefined, webKey)), { status: 'invalid' });
    });
    await t.test('wrong or absent issuer, audience, type, algorithm and role profiles reject', async () => {
        reset();
        for (const patch of [{ iss: issuer + '/other' }, { aud: 'other' }, { aud: [profile.aud, 'other'] },
            { roleId: 1 }, { roleId: 2 }, { roleId: 4 }, { roleId: '3' }, { userId: '21' },
            { userId: 0 }, { userId: 2147483648 }, { email: 'invalid' }, { extra: 'unsupported' }])
            assert.deepEqual(await mobile.verifyMobileToken(await sign({ ...profile, ...patch })), { status: 'invalid' });
        for (const name of ['iss', 'aud', 'iat', 'exp', 'userId', 'email', 'roleId']) {
            const payload = { ...profile }; delete payload[name];
            assert.deepEqual(await mobile.verifyMobileToken(await sign(payload)), { status: 'invalid' }, name);
        }
        for (const header of [{ alg: 'HS256' }, { alg: 'HS256', typ: 'JWT' },
            { alg: 'HS256', typ: 'application/' + mobile.MOBILE_TOKEN_TYPE },
            { alg: 'HS256', typ: mobile.MOBILE_TOKEN_TYPE.toUpperCase() },
            { alg: 'HS384', typ: mobile.MOBILE_TOKEN_TYPE }])
            assert.deepEqual(await mobile.verifyMobileToken(await sign(profile, header)), { status: 'invalid' });
    });
    await t.test('expiry, future/fractional timestamps and non-24-hour lifetimes reject', async () => {
        reset();
        for (const patch of [{ iat: now - 86400, exp: now }, { iat: now + 60, exp: now + 86460 },
            { exp: now + 86401 }, { exp: now + 3600 }, { iat: now + 0.5, exp: now + 86400.5 },
            { iat: -1, exp: 86399 }, { iat: 'today' }, { exp: 'tomorrow' }])
            assert.deepEqual(await mobile.verifyMobileToken(await sign({ ...profile, ...patch })), { status: 'invalid' });
        const nearExpiry = await mobile.verifyMobileToken(await sign({ ...profile, iat: now - 86340, exp: now + 60 }));
        assert.equal(nearExpiry.status, 'valid'); assert.equal(nearExpiry.claims.exp, now + 60);
    });
    await t.test('tampering, malformed compact tokens, unsigned tokens and other keys reject', async () => {
        reset();
        const token = await sign(), parts = token.split('.');
        parts[1] = Buffer.from(JSON.stringify({ ...profile, userId: 999 })).toString('base64url');
        for (const value of [parts.join('.'), 'malformed', '', null, token.split('.').slice(0, 2).join('.') + '.',
            await sign(profile, undefined, randomBytes(64).toString('hex'))])
            assert.deepEqual(await mobile.verifyMobileToken(value), { status: 'invalid' });
    });
    await t.test('fresh account resolution returns only current safe identity and preserves the web wrapper', async () => {
        reset();
        const token = await sign(), verified = await mobile.verifyMobileToken(token);
        account.email = 'current@example.invalid';
        assert.deepEqual(await resolveCurrentAccount(verified.claims), { status: 'active', user: { ...principal, email: account.email } });
        cookie = await web.createToken({ userId: principal.id, roleId: 3, email: 'stale@example.invalid' });
        const current = await getCurrentAccount();
        assert.equal(current.email, account.email); assert.equal(current.roleId, 3);
        assert.equal(current.exp - current.iat, 604800); assert.equal(current.password, undefined);
        assert.equal(current.emailVerifiedAt, undefined);
    });
    await t.test('deleted, inactive or changed-role accounts are invalid; database failure is unavailable', async () => {
        for (const change of [() => { account = undefined; }, () => { account.isActive = false; }, () => { account.roleId = 2; }]) {
            reset(); change(); assert.deepEqual(await resolveCurrentAccount(profile), { status: 'invalid' });
        }
        reset(); lookupFailure = true;
        assert.deepEqual(await resolveCurrentAccount(profile), { status: 'unavailable' });
        cookie = await web.createToken(profile); assert.equal(await getCurrentAccount(), null);
        reset();
        for (const patch of [{ userId: '21' }, { userId: 0 }, { userId: 2147483648 }, { roleId: 99 }])
            assert.deepEqual(await resolveCurrentAccount({ ...profile, ...patch }), { status: 'invalid' });
        assert.equal(reads, 0);
    });
    await t.test('typed credentials distinguish failures with one limiter admission before lookup/hash', async () => {
        reset();
        assert.deepEqual(await validateCredentials({ ...credentials, email: principal.email.toUpperCase() }, 3),
            { status: 'authenticated', user: principal });
        assert.equal(calls.length, 1); assert.equal(reads, 1); assert.equal(comparisons, 1);
        reset(); admission = false;
        assert.deepEqual(await validateCredentials(credentials), { status: 'rate_limited' });
        assert.equal(calls.length, 1); assert.equal(reads, 0); assert.equal(comparisons, 0);
        reset(); admission = 'unavailable';
        assert.deepEqual(await validateCredentials(credentials), { status: 'unavailable', source: 'limiter' });
        assert.equal(calls.length, 1); assert.equal(reads, 0);
        reset(); lookupFailure = true;
        assert.deepEqual(await validateCredentials(credentials), { status: 'unavailable', source: 'credentials' });
        assert.equal(calls.length, 1); assert.equal(comparisons, 0);
        reset(); hashFailure = true;
        assert.deepEqual(await validateCredentials(credentials), { status: 'unavailable', source: 'credentials' });
        reset();
        assert.deepEqual(await validateCredentials({ ...credentials, password: 'short' }), { status: 'invalid_credentials' });
        assert.equal(calls.length, 0); assert.equal(reads, 0);
    });
    await t.test('ineligible accounts are internal only; web messages and unrestricted web roles remain unchanged', async () => {
        reset(); account.isActive = false;
        assert.deepEqual(await validateCredentials(credentials, 3), { status: 'ineligible_account' });
        assert.deepEqual(await loginUser(credentials), { success: false, message: 'Invalid email or password.' });
        for (const roleId of [1, 2, 4]) {
            reset(); account.roleId = roleId;
            assert.deepEqual(await validateCredentials(credentials, 3), { status: 'ineligible_account' });
            assert.equal((await loginUser(credentials)).data.roleId, roleId);
        }
        reset(); account = undefined;
        assert.deepEqual(await validateCredentials(credentials), { status: 'invalid_credentials' });
        assert.equal(comparisons, 1, 'Missing users still receive a password comparison');
        reset(); admission = false;
        assert.deepEqual(await loginUser(credentials), { success: false, message: AUTH_RETRY_MESSAGE });
        reset(); admission = 'unavailable';
        assert.deepEqual(await loginUser(credentials), { success: false, message: AUTH_RETRY_MESSAGE });
        assert.equal(calls.length, 1);
        reset(); lookupFailure = true;
        assert.deepEqual(await loginUser(credentials), { success: false, message: 'Unable to process login. Please try again.' });
        reset(); assert.equal((await loginUser(credentials)).success, true, 'Unverified Students remain eligible');
    });
    await t.test('typed and boolean limiter boundaries each consume once and fail closed', async () => {
        reset(); assert.deepEqual(await checkAuthAttempt('login', principal.email), { status: 'allowed' });
        assert.equal(calls.length, 1);
        admission = false; assert.deepEqual(await checkAuthAttempt('login', principal.email), { status: 'limited' });
        admission = 'unavailable'; assert.deepEqual(await checkAuthAttempt('login', principal.email), { status: 'unavailable' });
        assert.equal(await allowAuthAttempt('login', principal.email), false); assert.equal(calls.length, 4);
        delete process.env.THESISHS_AUTH_LIMIT_SECRET;
        assert.deepEqual(await checkAuthAttempt('login', principal.email), { status: 'unavailable' });
        assert.equal(await allowAuthAttempt('login', principal.email), false); assert.equal(calls.length, 4);
    });
}).finally(() => {
    Module._load = original;
    names.forEach(name => previous[name] === undefined ? delete process.env[name] : process.env[name] = previous[name]);
});
