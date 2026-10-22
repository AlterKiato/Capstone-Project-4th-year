/* eslint-disable @typescript-eslint/no-require-imports */
// Real auth actions, bcrypt, JWT and session code; repository/cookie/navigation doubles.
// No database, network, environment-file writes or real account credentials.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomBytes } = require('node:crypto');
const Module = require('node:module');
const previousEnvironment = { node: process.env.NODE_ENV, secret: process.env.JWT_SECRET };
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(64).toString('hex');
const cookies = new Map(), writes = [];
let account, inserts = 0;
const cookieStore = {
    get: name => cookies.has(name) ? { value: cookies.get(name) } : undefined,
    set: (name, value, options) => { cookies.set(name, value); writes.push({ name, options }); },
    delete: name => cookies.delete(name),
};
const originalLoad = Module._load;
const mocks = {
    'server-only': {},
    '@/lib/db': { db: {} }, // Limiting is disabled here; importing it must not initialize a runtime connection.
    'dotenv/config': {},
    'next/headers': { cookies: async () => cookieStore },
    'next/navigation': { redirect: path => { throw Error('REDIRECT ' + path); } },
    '@/lib/repositories/user.repository': { findUserById: async id => account?.id === id ? account : undefined },
    '../repositories/user.repository': {
        findUserByEmail: async email => account?.email === email ? account : undefined,
        createUser: async data => { inserts++; account = { id: 21, ...data, isActive: true, emailVerifiedAt: null }; return account; },
    },
};
Module._load = function(id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : originalLoad.call(this, id, ...args); };
const { registerAction, loginAction, logoutAction } = require('../lib/actions/auth.action.ts');
const { createSession, getSession } = require('../lib/auth/session.ts');
const { verifyToken } = require('../lib/auth/jwt.ts');
const { requireRole } = require('../lib/auth/authorization.ts');
const password = 'synthetic-compatibility-password';
function form() {
    const value = new FormData();
    for (const [name, item] of Object.entries({ firstName: 'Synthetic', lastName: 'Student',
        email: 'COMPATIBILITY@example.invalid', password, confirmPassword: password, roleId: '1' })) value.set(name, item);
    return value;
}

test('Framework upgrade auth compatibility (isolated boundaries)', async t => {
    const { SignJWT } = await import('jose');
    await t.test('Student registration hashes the password and creates an optional-verification session', async () => {
        await assert.rejects(registerAction({}, form()), /REDIRECT \/dashboard/);
        assert.equal(inserts, 1); assert.equal(account.roleId, 3); assert.equal(account.emailVerifiedAt, null);
        assert.equal(account.email, 'compatibility@example.invalid'); assert.notEqual(account.password, password);
        assert.match(account.password, /^\$2[ab]\$12\$/);
        const session = await getSession(); assert.equal(session.userId, 21); assert.equal(session.roleId, 3);
        assert.equal(session.exp - session.iat, 604800);
        assert.deepEqual(writes.at(-1), { name: 'thesishs_session', options: {
            httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 604800,
        } });
    });
    await t.test('Student, Admin and Adviser password login preserve signed role sessions', async () => {
        for (const roleId of [3, 1, 2]) {
            account.roleId = roleId;
            await assert.rejects(loginAction({}, form()), /REDIRECT \/dashboard/);
            const session = await getSession(); assert.equal(session.userId, account.id); assert.equal(session.roleId, roleId);
        }
        assert.equal(inserts, 1);
    });
    await t.test('wrong passwords and inactive accounts do not issue a session', async () => {
        const before = writes.length, invalid = form(); invalid.set('password', 'synthetic-wrong-password');
        assert.equal((await loginAction({}, invalid)).success, false);
        account.isActive = false; assert.equal((await loginAction({}, form())).success, false);
        account.isActive = true; assert.equal(writes.length, before);
    });
    await t.test('real JWT verification rejects malformed, tampered, expired and wrong-algorithm tokens', async () => {
        const token = cookies.get('thesishs_session');
        const parts = token.split('.'); parts[1] = Buffer.from(JSON.stringify({ userId: 999, roleId: 1 })).toString('base64url');
        assert.equal(await verifyToken(parts.join('.')), null); assert.equal(await verifyToken('malformed'), null);
        const key = new TextEncoder().encode(process.env.JWT_SECRET);
        const expired = await new SignJWT({ userId: 21, roleId: 3, email: account.email })
            .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(Math.floor(Date.now() / 1000) - 1).sign(key);
        const wrongAlgorithm = await new SignJWT({ userId: 21, roleId: 3, email: account.email })
            .setProtectedHeader({ alg: 'HS384' }).setIssuedAt().setExpirationTime('7d').sign(key);
        assert.equal(await verifyToken(expired), null); assert.equal(await verifyToken(wrongAlgorithm), null);
    });
    await t.test('production cookies are Secure and HttpOnly; role checks and logout remain functional', async () => {
        process.env.NODE_ENV = 'production';
        account.roleId = 3; // Current database role must agree with this valid Student session.
        await createSession({ userId: 21, roleId: 3, email: account.email });
        assert.equal(writes.at(-1).options.secure, true); assert.equal(writes.at(-1).options.httpOnly, true);
        assert.equal((await requireRole([3])).userId, 21);
        await assert.rejects(requireRole([1]), /REDIRECT \/dashboard/);
        await logoutAction(); assert.equal(await getSession(), null);
        await assert.rejects(requireRole([3]), /REDIRECT \/login/);
    });
}).finally(() => {
    Module._load = originalLoad;
    for (const [key, value] of Object.entries({ NODE_ENV: previousEnvironment.node, JWT_SECRET: previousEnvironment.secret }))
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
});
