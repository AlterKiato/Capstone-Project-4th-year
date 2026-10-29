/* eslint-disable @typescript-eslint/no-require-imports */
// Actual routes, M.3A services/jose and Drizzle SQL. Synthetic repositories/cookies/DB driver only.
// No dotenv files, sockets, PostgreSQL, Storage or hosted requests.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomBytes, createHmac } = require('node:crypto');
const Module = require('node:module');
const jose = require('jose');
const { drizzle } = require('drizzle-orm/pg-proxy');
const names = ['NODE_ENV', 'JWT_SECRET', 'THESISHS_MOBILE_JWT_SECRET', 'THESISHS_MOBILE_JWT_ISSUER',
    'THESISHS_AUTH_LIMIT_SECRET', 'THESISHS_AUTH_LIMITS_JSON', 'THESISHS_SHARED_AUTH_LIMITS', 'VERCEL', 'THESISHS_AUTH_SOURCE_MODE'];
const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
const webKey = randomBytes(64).toString('hex'), mobileKey = randomBytes(64).toString('hex');
const limiterKey = randomBytes(32).toString('hex'), issuer = 'https://mobile.example.invalid';
const student = { id: 21, roleId: 3, firstName: 'Synthetic', lastName: 'Student', email: 'student@example.invalid' };
const credentials = { email: student.email, password: 'synthetic-password' };
let account, requestHeaders, rows, queries, events, clock, admissions, failAdmission, credentialCalls;
let lookupFailure, resolveFailure, verifierFailure, signingFailure, cookieCalls;
function reset() {
    names.forEach(name => delete process.env[name]);
    Object.assign(process.env, { NODE_ENV: 'production', JWT_SECRET: webKey,
        THESISHS_MOBILE_JWT_SECRET: mobileKey, THESISHS_MOBILE_JWT_ISSUER: issuer, THESISHS_AUTH_LIMIT_SECRET: limiterKey });
    account = { ...student, password: 'synthetic-hash', isActive: true, emailVerifiedAt: null, privateField: 'must-not-project' };
    requestHeaders = new Headers(); rows = new Map(); queries = []; events = []; clock = Date.now();
    admissions = failAdmission = cookieCalls = 0; credentialCalls = [];
    lookupFailure = resolveFailure = verifierFailure = signingFailure = false;
}
reset();
const db = drizzle(async (query, params) => {
    queries.push({ query, params });
    if (query.startsWith('delete')) return { rows: [] };
    if (query.startsWith('select')) return { rows: [{ now: new Date(clock).toISOString() }] };
    assert.match(query, /^insert into "auth_rate_limit_buckets"/);
    const [digest, start, expiry, limit] = params;
    assert.equal(typeof start, 'string'); assert.equal(typeof expiry, 'string');
    const key = digest + ':' + new Date(start).getTime();
    const count = rows.get(key) ?? 0;
    if (count >= limit) return { rows: [] };
    rows.set(key, count + 1);
    return { rows: [{ hit_count: count + 1 }] };
});
db.transaction = async work => {
    events.push('admission'); admissions++;
    if (admissions === failAdmission) throw Error('PRIVATE_DRIVER_DETAIL');
    const before = new Map(rows);
    try { return await work(db); } catch (error) { rows = before; throw error; }
};
const users = {
    findUserByEmail: async email => {
        events.push('lookup'); if (lookupFailure) throw Error('PRIVATE_ACCOUNT_DETAIL');
        return account?.email.toLowerCase() === email ? account : undefined;
    },
    findUserById: async id => {
        events.push('resolve'); if (resolveFailure) throw Error('PRIVATE_ACCOUNT_DETAIL');
        return account?.id === id ? account : undefined;
    },
};
const original = Module._load;
const mocks = {
    'server-only': {}, 'dotenv/config': {}, '@/lib/db': { db },
    'next/headers': { headers: async () => requestHeaders, cookies: async () => { cookieCalls++; throw Error('Cookie access forbidden'); } },
    'next/navigation': { redirect: () => { throw Error('Redirect forbidden'); } },
    '@/lib/repositories/user.repository': users, '../repositories/user.repository': users,
    '@/lib/auth/hash': { comparePassword: async (password, hash) => {
        events.push('bcrypt'); return password === credentials.password && hash === 'synthetic-hash';
    } },
    jose: { ...jose,
        jwtVerify: async (...args) => {
            events.push('verify'); if (verifierFailure) throw Error('PRIVATE_VERIFIER_DETAIL');
            return jose.jwtVerify(...args);
        },
        SignJWT: class extends jose.SignJWT {
            async sign(...args) { if (signingFailure) throw Error('PRIVATE_SIGNING_DETAIL'); return super.sign(...args); }
        },
    },
};
Module._load = function(id, ...args) {
    if (id === 'postgres') throw Error('Live database imports forbidden');
    return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args);
};
const auth = require('../lib/services/auth.service.ts');
mocks['@/lib/services/auth.service'] = { validateCredentials: (...args) => {
    credentialCalls.push(args[1]); return auth.validateCredentials(...args);
} };
const { POST } = require('../app/api/mobile/v1/auth/login/route.ts');
const { GET } = require('../app/api/mobile/v1/session/route.ts');
const http = require('../lib/auth/mobile-http.ts');
const mobile = require('../lib/auth/mobile-jwt.ts');
const web = require('../lib/auth/jwt.ts');
const limitConfig = require('../lib/auth/auth-rate-limit-config.ts');
const origin = 'https://backend.example.invalid';
function login(body = JSON.stringify(credentials), headers = {}) {
    requestHeaders = new Headers({ 'content-type': 'application/json', ...headers });
    return POST(new Request(origin + '/api/mobile/v1/auth/login', { method: 'POST', headers: requestHeaders, body }));
}
const tokenProfile = patch => {
    const now = Math.floor(Date.now() / 1000);
    return { userId: student.id, email: student.email, roleId: 3, iss: issuer,
        aud: mobile.MOBILE_TOKEN_AUDIENCE, iat: now, exp: now + 86400, ...patch };
};
const sign = (patch = {}, header = { alg: 'HS256', typ: mobile.MOBILE_TOKEN_TYPE }) =>
    new jose.SignJWT(tokenProfile(patch)).setProtectedHeader(header).sign(new TextEncoder().encode(mobileKey));
function session(token, extra = {}) {
    const headers = new Headers({ ...(token === undefined ? {} : { authorization: `Bearer ${token}` }), ...extra });
    return GET(new Request(origin + '/api/mobile/v1/session?userId=999&roleId=1&groupId=999', { headers }));
}
async function rejected(response, status, code, sessionResponse = false) {
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.success, false); assert.equal(body.code, code);
    assert.deepEqual(Object.keys(body).sort(), ['code', 'message', 'success']);
    assert.equal(typeof body.message, 'string');
    assert.ok(!JSON.stringify(body).includes('PRIVATE_'));
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('set-cookie'), null); assert.equal(response.headers.get('location'), null);
    if (sessionResponse) assert.equal(response.headers.get('vary'), 'Authorization');
    assert.equal(cookieCalls, 0);
}
const digest = (dimension, value, operation = 'mobileSession') => createHmac('sha256', limiterKey)
    .update(JSON.stringify(['thesishs-auth-limit-v1', operation, dimension, value])).digest('hex');
const rowKey = (dimension, value, operation) => digest(dimension, value, operation) + ':' + Math.floor(clock / 900000) * 900000;
const inserts = () => queries.filter(query => query.query.startsWith('insert'));

test('M.3C Student mobile HTTP routes (offline synthetic boundaries)', async t => {
    await t.test('Student login returns the exact envelope, safe identity and isolated 24-hour JWT with one admission', async () => {
        reset(); const response = await login(); const body = await response.json();
        assert.equal(response.status, 200); assert.equal(body.success, true);
        assert.equal(body.code, 'AUTHENTICATED'); assert.equal(body.message, 'Login successful.');
        assert.deepEqual(Object.keys(body.data).sort(), ['expiresAt', 'token', 'user']);
        assert.deepEqual(body.data.user, student); assert.deepEqual(credentialCalls, [3]);
        const verified = await mobile.verifyMobileToken(body.data.token);
        assert.equal(verified.status, 'valid'); assert.equal(verified.claims.exp - verified.claims.iat, 86400);
        assert.equal(body.data.expiresAt, new Date(verified.claims.exp * 1000).toISOString());
        assert.equal(await web.verifyToken(body.data.token), null);
        assert.deepEqual(events.slice(0, 3), ['admission', 'lookup', 'bcrypt']);
        assert.equal(admissions, 1); assert.equal(inserts().length, 2);
        assert.deepEqual(inserts().map(q => q.params[3]).sort((a, b) => a - b), [10, 1200]);
        assert.equal(response.headers.get('set-cookie'), null); assert.equal(response.headers.get('location'), null);
        assert.match(response.headers.get('cache-control'), /no-store/); assert.equal(cookieCalls, 0);
    });
    await t.test('wrong/missing credentials use 401; inactive and all non-Student roles use generic 403', async () => {
        reset(); await rejected(await login(JSON.stringify({ ...credentials, password: 'wrong-password' })), 401, 'INVALID_CREDENTIALS');
        reset(); account = undefined; await rejected(await login(), 401, 'INVALID_CREDENTIALS');
        for (const roleId of [1, 2, 4]) {
            reset(); account.roleId = roleId; await rejected(await login(), 403, 'STUDENT_ACCESS_REQUIRED');
            assert.deepEqual(credentialCalls, [3]);
        }
        reset(); account.isActive = false; await rejected(await login(), 403, 'STUDENT_ACCESS_REQUIRED');
    });
    await t.test('backend 255-character email compatibility is retained; Expo boundary reconciliation remains separate', async () => {
        reset();
        const email = 'a'.repeat(64) + '@' + 'b'.repeat(63) + '.' + 'c'.repeat(63) + '.' + 'd'.repeat(62);
        assert.equal(email.length, 255); account.email = email;
        const response = await login(JSON.stringify({ ...credentials, email }));
        assert.equal(response.status, 200);
        const body = await response.json(); assert.equal(body.data.user.email, email);
        assert.equal((await mobile.verifyMobileToken(body.data.token)).status, 'valid');
    });
    await t.test('malformed, nested, unknown, duplicate and escaped duplicate fields reject before credentials', async () => {
        for (const body of ['', 'null', '[]', '{}', '{', JSON.stringify({ ...credentials, roleId: 3 }),
            JSON.stringify({ ...credentials, email: 21 }), JSON.stringify({ ...credentials, password: [] }),
            '{"email":"a@example.invalid","email":"student@example.invalid","password":"synthetic-password"}',
            '{"email":"student@example.invalid","pass\\u0077ord":"first-password","password":"synthetic-password"}',
            '{"email":{},"email":"student@example.invalid","password":"synthetic-password"}',
            JSON.stringify(credentials).replace('}', ',}'), JSON.stringify(credentials) + '{}',
            JSON.stringify({ ...credentials, password: 'short' }), '\uFEFF' + JSON.stringify(credentials)]) {
            reset(); await rejected(await login(body), 400, 'INVALID_REQUEST');
            assert.equal(credentialCalls.length, 0); assert.equal(admissions, 0);
        }
    });
    await t.test('legal escapes, whitespace, key order and UTF-8 passwords preserve significant characters', async () => {
        reset();
        const body = ' \n {"password":"synthetic-\\u0070assword", "em\\u0061il":"STUDENT@example.invalid"}\r\n';
        assert.equal((await login(body, { 'content-type': 'Application/JSON; charset="UTF-8"' })).status, 200);
        reset();
        const parsed = await http.readMobileCredentials(new Request(origin, { method: 'POST',
            headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...credentials, password: '  密碼123456  ' }) }));
        assert.equal(parsed.status, 'valid'); assert.equal(parsed.input.password, '  密碼123456  ');
        assert.equal(credentialCalls.length, 0);
    });
    await t.test('unsupported media/charset/encoding reject with 415; broken UTF-8 rejects with 400', async () => {
        for (const type of ['', 'text/plain', 'application/json; charset=latin1', 'application/json; charset=utf-8; charset=utf-8']) {
            reset(); await rejected(await login(undefined, { 'content-type': type }), 415, 'UNSUPPORTED_MEDIA_TYPE');
            assert.equal(admissions, 0);
        }
        reset(); await rejected(await login(undefined, { 'content-encoding': 'gzip' }), 415, 'UNSUPPORTED_MEDIA_TYPE');
        reset(); await rejected(await login(new Uint8Array([0xc3, 0x28])), 400, 'INVALID_REQUEST');
    });
    await t.test('actual byte count accepts 4096 and rejects 4097 even without a length header', async () => {
        reset(); const base = JSON.stringify(credentials);
        assert.equal((await login(base.padEnd(4096, ' '))).status, 200);
        reset(); await rejected(await login(base.padEnd(4097, ' ')), 413, 'PAYLOAD_TOO_LARGE');
        assert.equal(credentialCalls.length, 0); assert.equal(admissions, 0);
        reset(); await rejected(await login(base.padEnd(4097, ' '), { 'content-length': '1' }), 413, 'PAYLOAD_TOO_LARGE');
        reset(); await rejected(await login(base, { 'content-length': '1' }), 400, 'INVALID_REQUEST');
        reset(); await rejected(await login(base, { 'content-length': 'invalid' }), 400, 'INVALID_REQUEST');
        reset(); await rejected(await login(base, { 'content-length': '4097' }), 413, 'PAYLOAD_TOO_LARGE');
        reset();
        const unicode = JSON.stringify({ ...credentials, password: '密'.repeat(100) });
        const bytes = Buffer.byteLength(unicode);
        assert.equal((await http.readMobileCredentials(new Request(origin, { method: 'POST', headers: {
            'content-type': 'application/json' }, body: unicode.padEnd(unicode.length + 4096 - bytes, ' ') }))).status, 'valid');
    });
    await t.test('chunked oversize/error streams cancel and never enter credential validation', async () => {
        reset(); let cancelled = false;
        const stream = new ReadableStream({ start(controller) {
            controller.enqueue(new Uint8Array(3000)); controller.enqueue(new Uint8Array(1097));
        }, cancel() { cancelled = true; } });
        const response = await POST(new Request(origin, { method: 'POST', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half' }));
        await rejected(response, 413, 'PAYLOAD_TOO_LARGE'); assert.equal(cancelled, true); assert.equal(admissions, 0);
        const broken = new ReadableStream({ start(controller) { controller.error(Error('PRIVATE_STREAM_DETAIL')); } });
        await rejected(await POST(new Request(origin, { method: 'POST', headers: { 'content-type': 'application/json' }, body: broken, duplex: 'half' })), 400, 'INVALID_REQUEST');
        const locked = new Request(origin, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(credentials) });
        const reader = locked.body.getReader();
        await rejected(await POST(locked), 400, 'INVALID_REQUEST'); reader.releaseLock();
        await rejected(await POST(new Request(origin, { method: 'POST', headers: { 'content-type': 'application/json' } })), 400, 'INVALID_REQUEST');
    });
    await t.test('stalled body has a total read deadline and cancels without admission', async tt => {
        reset(); tt.mock.timers.enable({ apis: ['setTimeout'] }); let cancelled = false;
        const stream = new ReadableStream({ cancel() { cancelled = true; } });
        const pending = POST(new Request(origin, { method: 'POST', headers: { 'content-type': 'application/json' }, body: stream, duplex: 'half' }));
        tt.mock.timers.tick(http.MOBILE_BODY_READ_TIMEOUT_MS + 1);
        await rejected(await pending, 400, 'INVALID_REQUEST'); assert.equal(cancelled, true); assert.equal(admissions, 0);
    });
    await t.test('login infrastructure/signing configuration failures are 503; unexpected signing failures are 500', async () => {
        reset(); failAdmission = 1; await rejected(await login(), 503, 'AUTH_UNAVAILABLE'); assert.ok(!events.includes('lookup'));
        reset(); lookupFailure = true; await rejected(await login(), 503, 'AUTH_UNAVAILABLE');
        reset(); delete process.env.THESISHS_MOBILE_JWT_SECRET; await rejected(await login(), 503, 'AUTH_UNAVAILABLE');
        reset(); signingFailure = true; await rejected(await login(), 500, 'INTERNAL_ERROR');
    });
    await t.test('login exhaustion still uses the existing account budget and consumes no second admission', async () => {
        reset(); rows.set(rowKey('account', student.email, 'login'), 10);
        await rejected(await login(), 429, 'AUTH_RATE_LIMITED');
        assert.equal(admissions, 1); assert.deepEqual(credentialCalls, [3]); assert.ok(!events.includes('lookup'));
    });
    await t.test('session resolves current safe Student identity and returns exactly the original expiry without a replacement', async () => {
        reset(); const token = await sign({ iat: Math.floor(Date.now() / 1000) - 86000, exp: Math.floor(Date.now() / 1000) + 400 });
        const originalExpiry = jose.decodeJwt(token).exp;
        account.email = 'updated@example.invalid'; account.firstName = 'Current';
        const response = await session(token); const body = await response.json();
        assert.equal(response.status, 200); assert.equal(body.code, 'SESSION_VALID'); assert.equal(body.message, 'Session valid.');
        assert.deepEqual(body.data, { user: { ...student, email: account.email, firstName: 'Current' }, expiresAt: new Date(originalExpiry * 1000).toISOString() });
        assert.deepEqual(events, ['admission', 'verify', 'admission', 'resolve']);
        assert.equal(response.headers.get('vary'), 'Authorization'); assert.equal(response.headers.get('set-cookie'), null);
        assert.match(response.headers.get('cache-control'), /no-store/); assert.equal(cookieCalls, 0);
    });
    await t.test('missing, duplicate, cookie-only and malformed bearer input never reaches token/account verification', async () => {
        for (const authorization of [undefined, 'Basic abc', 'Bearer abc', 'Bearer a.b.c, Bearer d.e.f', 'Bearer  a.b.c', 'Bearer a.b.c extra']) {
            reset(); await rejected(await session(undefined, { cookie: 'thesishs_session=synthetic',
                ...(authorization === undefined ? {} : { authorization }) }), 401, 'SESSION_INVALID', true);
            assert.deepEqual(events, ['admission']); assert.equal(inserts().length, 1);
        }
        reset(); const headers = new Headers(); headers.append('authorization', 'Bearer a.b.c'); headers.append('authorization', 'Bearer d.e.f');
        await rejected(await GET(new Request(origin, { headers })), 401, 'SESSION_INVALID', true);
        assert.deepEqual(events, ['admission']);
    });
    await t.test('8192-character bearer boundary is checked before JWT verification', async () => {
        reset(); await rejected(await session('a'.repeat(8188) + '.a.a'), 401, 'SESSION_INVALID', true);
        assert.deepEqual(events, ['admission', 'verify']);
        reset(); await rejected(await session('a'.repeat(8189) + '.a.a'), 401, 'SESSION_INVALID', true);
        assert.deepEqual(events, ['admission']);
    });
    await t.test('expired, tampered, foreign-profile and web JWTs cannot allocate verified-account buckets', async () => {
        const now = Math.floor(Date.now() / 1000);
        const webToken = await web.createToken({ userId: student.id, roleId: 3, email: student.email });
        const invalid = [webToken, await sign({ iat: now - 86400, exp: now }), await sign({ iss: issuer + '/foreign' }),
            await sign({ aud: 'foreign' }), await sign({ roleId: 1 }), await sign({ exp: now + 3600 }),
            await sign({}, { alg: 'HS256', typ: 'JWT' }), await sign({}, { alg: 'HS384', typ: mobile.MOBILE_TOKEN_TYPE })];
        const parts = (await sign()).split('.'); parts[1] = Buffer.from(JSON.stringify(tokenProfile({ userId: 999 }))).toString('base64url');
        invalid.push(parts.join('.'));
        for (const token of invalid) {
            reset(); await rejected(await session(token), 401, 'SESSION_INVALID', true);
            assert.deepEqual(events, ['admission', 'verify']); assert.equal(inserts().length, 1);
        }
    });
    await t.test('deleted, deactivated and changed-role accounts cannot retain session authority', async () => {
        const token = await sign();
        for (const change of [() => { account = undefined; }, () => { account.isActive = false; }, () => { account.roleId = 2; }]) {
            reset(); change(); await rejected(await session(token), 401, 'SESSION_INVALID', true);
            assert.deepEqual(events, ['admission', 'verify', 'admission', 'resolve']);
        }
    });
    await t.test('unknown/malicious forwarding is ignored; opted-in validated Vercel source is counted once', async () => {
        reset(); const token = await sign();
        assert.equal((await session(token, { 'x-forwarded-for': '192.0.2.1', 'x-vercel-forwarded-for': '192.0.2.2' })).status, 200);
        assert.equal(inserts().length, 2); assert.deepEqual(inserts().map(q => q.params[3]), [1200, 60]);
        reset(); process.env.VERCEL = '1'; process.env.THESISHS_AUTH_SOURCE_MODE = 'vercel-direct';
        assert.equal((await session(token, { 'x-vercel-forwarded-for': '192.0.2.2' })).status, 200);
        assert.deepEqual(inserts().map(q => q.params[3]), [1200, 300, 60]);
        assert.equal(rows.get(rowKey('global', 'all')), 1); assert.equal(rows.get(rowKey('source', '192.0.2.2')), 1);
        assert.equal(rows.get(rowKey('account', String(student.id))), 1);
        assert.ok(!JSON.stringify(queries).includes(student.email)); assert.ok(!JSON.stringify(queries).includes('192.0.2.2'));
        reset(); process.env.VERCEL = '1'; process.env.THESISHS_AUTH_SOURCE_MODE = 'vercel-direct';
        assert.equal((await session(token, { 'x-vercel-forwarded-for': '192.0.2.1, 192.0.2.2' })).status, 200);
        assert.equal(inserts().length, 2);
    });
    await t.test('account limit admits exactly 60 and the existing DB-clock fixed window resets at its boundary', async () => {
        reset(); const token = await sign();
        for (let i = 0; i < 60; i++) assert.equal((await session(token)).status, 200);
        await rejected(await session(token), 429, 'AUTH_RATE_LIMITED', true);
        assert.equal(rows.get(rowKey('global', 'all')), 61); assert.equal(rows.get(rowKey('account', String(student.id))), 60);
        const start = Math.floor(clock / 900000) * 900000;
        clock = start + 899999; await rejected(await session(token), 429, 'AUTH_RATE_LIMITED', true);
        clock++; assert.equal((await session(token)).status, 200);
        assert.equal(rows.get(rowKey('global', 'all')), 1); assert.equal(rows.get(rowKey('account', String(student.id))), 1);
    });
    await t.test('global/source exhaustion stops before verification; an invalid token consumes no account budget', async () => {
        reset(); rows.set(rowKey('global', 'all'), 1200);
        await rejected(await session(await sign()), 429, 'AUTH_RATE_LIMITED', true); assert.deepEqual(events, ['admission']);
        reset(); process.env.VERCEL = '1'; process.env.THESISHS_AUTH_SOURCE_MODE = 'vercel-direct';
        rows.set(rowKey('source', '192.0.2.2'), 300);
        await rejected(await session(await sign(), { 'x-vercel-forwarded-for': '192.0.2.2' }), 429, 'AUTH_RATE_LIMITED', true);
        assert.deepEqual(events, ['admission']); assert.equal(rows.get(rowKey('global', 'all')), 1);
        reset(); await rejected(await session(await sign({ userId: 999, iss: 'foreign' })), 401, 'SESSION_INVALID', true);
        assert.ok(!rows.has(rowKey('account', '999'))); assert.equal(admissions, 1);
    });
    await t.test('both limiter stages and account/configuration failures fail closed without leaking diagnostics', async () => {
        const token = await sign();
        for (const stage of [1, 2]) {
            reset(); failAdmission = stage; await rejected(await session(token), 503, 'AUTH_UNAVAILABLE', true);
            assert.ok(!events.includes('resolve')); if (stage === 1) assert.ok(!events.includes('verify'));
        }
        reset(); resolveFailure = true; await rejected(await session(token), 503, 'AUTH_UNAVAILABLE', true);
        reset(); delete process.env.THESISHS_AUTH_LIMIT_SECRET;
        await rejected(await session(token), 503, 'AUTH_UNAVAILABLE', true); assert.ok(!events.includes('verify'));
        reset(); process.env.THESISHS_SHARED_AUTH_LIMITS = 'disabled'; delete process.env.THESISHS_AUTH_LIMIT_SECRET;
        await rejected(await session(token), 503, 'AUTH_UNAVAILABLE', true);
        reset(); delete process.env.THESISHS_MOBILE_JWT_ISSUER;
        await rejected(await session(token), 503, 'AUTH_UNAVAILABLE', true); assert.equal(admissions, 1);
        reset(); process.env.THESISHS_MOBILE_JWT_SECRET = webKey;
        await rejected(await session(token), 503, 'AUTH_UNAVAILABLE', true);
    });
    await t.test('unexpected verifier errors are INTERNAL_ERROR, not an ordinary invalid session', async () => {
        reset(); verifierFailure = true;
        await rejected(await session(await sign()), 500, 'INTERNAL_ERROR', true);
        assert.deepEqual(events, ['admission', 'verify']); assert.equal(admissions, 1);
    });
    await t.test('session namespace leaves existing login/registration defaults unchanged', () => {
        reset();
        assert.deepEqual(limitConfig.getAuthLimitConfiguration('mobileSession').limits, { account: 60, source: 300, global: 1200 });
        assert.deepEqual(limitConfig.getAuthLimitConfiguration('login').limits, { account: 10, source: 300, global: 1200 });
        assert.deepEqual(limitConfig.getAuthLimitConfiguration('registration').limits, { account: 5, source: 60, global: 120 });
        assert.notEqual(digest('global', 'all'), digest('global', 'all', 'login'));
        process.env.THESISHS_AUTH_LIMITS_JSON = JSON.stringify({ login: { account: 1, source: 2, global: 3 } });
        assert.deepEqual(limitConfig.getAuthLimitConfiguration('mobileSession').limits, { account: 60, source: 300, global: 1200 });
    });
}).finally(() => {
    Module._load = original;
    names.forEach(name => previous[name] === undefined ? delete process.env[name] : process.env[name] = previous[name]);
});
