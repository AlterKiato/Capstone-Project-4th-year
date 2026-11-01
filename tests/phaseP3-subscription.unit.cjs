/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated source/Drizzle transaction doubles only. No sockets, database, Storage or VAPID keys.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { PgDialect, getTableConfig } = require('drizzle-orm/pg-core');
const { getTableName } = require('drizzle-orm');
const schema = require('../db/schema/index.ts');
const { createPushSubscriptionRepository } = require('../lib/repositories/push-subscription.repository.ts');
const { createPushSubscriptionService } = require('../lib/push/subscription.ts');
const { createPushHttpHandler } = require('../lib/push/http.ts');
const { registrationSchema, safePushEndpoint, validPublicKey } = require('../lib/push/contract.ts');
const { pushConfiguration } = loadTs('lib/push/config.ts', { 'server-only': {}, './contract': { validPublicKey } }, { URL, Buffer });
// Public SEC2 P-256 generator point, not a generated VAPID key pair.
const publicKey = Buffer.from('046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5', 'hex').toString('base64url');
const auth = Buffer.alloc(16, 1).toString('base64url');
const now = 1800000000000;
const config = { available: true, origin: 'https://app.example.invalid', publicKey, keyId: 'test-key' };
const registration = (expectedGeneration = null, endpoint = 'https://fcm.googleapis.com/fcm/send/synthetic') => ({
    registrationId: randomUUID(), expectedGeneration, subscription: { endpoint, expirationTime: null, keys: { p256dh: publicKey, auth } },
});
const actor = (userId = 1, roleId = 3) => ({ userId, roleId, expiresAt: new Date(now + 3600000) });
const dialect = new PgDialect();

// Exercises the real repository's SQL/Drizzle control flow with serializable transaction doubles.
// PostgreSQL execution and real concurrent transactions remain separately gated acceptance.
function databaseDouble() {
    const rows = new Map(), accounts = new Map([[1, { roleId: 3, isActive: true }], [2, { roleId: 2, isActive: true }]]);
    const trace = []; let queue = Promise.resolve();
    const params = where => dialect.sqlToQuery(where).params;
    const tx = {
        async execute(query) { const text = dialect.sqlToQuery(query).sql; trace.push(text); return text.includes('clock_timestamp') ? [{ now: new Date(now) }] : []; },
        select() { return { from(table) { return { where(condition) { return { for(lock) {
            const name = getTableName(table), [id] = params(condition); trace.push(`lock:${name}:${lock}`);
            return Promise.resolve(name === 'users' ? accounts.has(id) ? [accounts.get(id)] : [] : rows.has(id) ? [{ ...rows.get(id) }] : []);
        } }; } }; } }; },
        insert() { return { values(value) { return { returning() { return write(value, false); } }; } }; },
        update() { return { set(value) { return { where(condition) { return { returning() {
            const [userId, id] = params(condition);
            return rows.get(userId)?.id === id ? write(value, true) : [];
        } }; } }; } }; },
    };
    function write(value, update) {
        if ((!update && rows.has(value.userId)) || [...rows.values()].some(r => r.userId !== value.userId &&
            (r.id === value.id || value.endpoint !== null && r.endpoint === value.endpoint))) throw Object.assign(new Error('synthetic constraint'), { code: '23505' });
        rows.set(value.userId, { ...value }); return [{ ...value }];
    }
    const database = { transaction(callback) {
        const result = queue.then(async () => {
            const before = new Map(rows);
            try { return await callback(tx); } catch (error) { rows.clear(); for (const item of before) rows.set(...item); throw error; }
        });
        queue = result.catch(() => {}); return result;
    } };
    return { repository: createPushSubscriptionRepository(database), rows, accounts, trace };
}
function fixture(overrides = {}) {
    const memory = databaseDouble(), calls = { ingress: 0, account: 0, identities: [] };
    const dependencies = {
        session: async () => ({ userId: 1, roleId: 3, email: 'synthetic@example.invalid', exp: (now + 3600000) / 1000 }),
        account: async () => 'active',
        ingress: async () => { calls.ingress++; return 'allowed'; },
        accountLimit: async (_operation, userId) => { calls.account++; calls.identities.push(userId); return 'allowed'; },
        configuration: () => config, repository: memory.repository, now: () => now, ...overrides,
    };
    const service = createPushSubscriptionService(dependencies);
    return { ...memory, dependencies, calls, service, http: createPushHttpHandler(service, dependencies.configuration) };
}
const headers = new Headers();
const rejectCode = code => error => error.code === code;
function request(method, body, changes = {}) {
    return new Request('https://app.example.invalid/api/push/subscription', { method, headers: { origin: config.origin, 'content-type': 'application/json', ...changes },
        ...(method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
}

test('0015 adds only push persistence and retains strict full-source verification', () => {
    const before = JSON.parse(readFileSync('db/migrations/meta/0014_snapshot.json'));
    const after = JSON.parse(readFileSync('db/migrations/meta/0015_snapshot.json'));
    const table = after.tables['public.push_subscriptions']; delete after.tables['public.push_subscriptions'];
    assert.deepEqual(after.tables, before.tables); assert.equal(after.prevId, before.id);
    assert.equal(Object.keys(table.columns).length, 11); assert.equal(Object.keys(table.uniqueConstraints).length, 2);
    assert.equal(Object.keys(table.checkConstraints).length, 4); assert.equal(Object.values(table.foreignKeys)[0].onDelete, 'cascade');
    const definition = getTableConfig(schema.pushSubscriptions);
    assert.equal(definition.checks.length, 4); assert.equal(definition.columns.filter(column => column.isUnique).length, 2);
    const sql = readFileSync('db/migrations/0015_push_subscriptions.sql', 'utf8');
    assert.equal((sql.match(/CREATE TABLE /g) ?? []).length, 1);
    assert.doesNotMatch(sql, /\b(DROP|TRUNCATE|INSERT|UPDATE|DELETE|GRANT)\b(?! cascade| no action)/i);
    assert.match(sql, /octet_length/); assert.match(sql, /not "push_subscriptions"\."enabled"/);
    const { previewMigrationSource, verifyPreviewLedger } = require('../scripts/preview-migration-source.ts');
    const source = previewMigrationSource(); assert.equal(source.migrations.length, 16);
    const ledger = source.migrations.map(m => ({ hash: m.hash, created_at: String(m.folderMillis) }));
    assert.doesNotThrow(() => verifyPreviewLedger(ledger));
    assert.throws(() => verifyPreviewLedger(ledger.slice(0, 15)));
    ledger[0].hash = 'tampered'; assert.throws(() => verifyPreviewLedger(ledger));
});

test('Student and Adviser enroll; only safe metadata leaves the repository/service', async () => {
    for (const [userId, roleId] of [[1, 3], [2, 2]]) {
        const f = fixture({ session: async () => ({ userId, roleId, exp: (now + 3600000) / 1000 }) });
        const input = registration(); const result = await f.service('POST', input, headers);
        assert.equal(result.enrollment.generation, input.registrationId); assert.equal(result.enrollment.enabled, true);
        assert.match(result.enrollment.endpointFingerprint, /^[a-f0-9]{64}$/);
        assert.equal(result.enrollment.authorizedUntil, new Date(now + 3600000).toISOString());
        assert.deepEqual(f.calls.identities, [userId]);
        const text = JSON.stringify(await f.service('GET', undefined, headers));
        assert.ok(!text.includes(input.subscription.endpoint)); assert.ok(!text.includes('"p256dh"')); assert.ok(!text.includes('"auth"'));
        assert.ok(f.trace.includes('lock:users:update'));
    }
});

test('Admin/Panel, missing, expired, inactive/deleted/stale-role and unavailable authentication fail closed', async () => {
    for (const roleId of [1, 4]) await assert.rejects(fixture({ session: async () => ({ userId: 1, roleId, exp: (now + 10000) / 1000 }) }).service('POST', registration(), headers), rejectCode('forbidden'));
    for (const claims of [null, { userId: 1, roleId: 3 }, { userId: 1, roleId: 3, exp: now / 1000 }]) {
        const f = fixture({ session: async () => claims });
        await assert.rejects(f.service('POST', registration(), headers), rejectCode('unauthenticated')); assert.equal(f.calls.account, 0);
    }
    for (const status of ['invalid', 'unavailable']) await assert.rejects(fixture({ account: async () => status }).service('GET', undefined, headers), rejectCode(status === 'invalid' ? 'unauthenticated' : 'unavailable'));
    for (const account of [null, { roleId: 3, isActive: false }, { roleId: 2, isActive: true }]) {
        const f = fixture(); if (account) f.accounts.set(1, account); else f.accounts.delete(1);
        await assert.rejects(f.service('POST', registration(), headers), rejectCode('unauthenticated'));
        assert.equal(f.rows.size, 0);
    }
});

test('strict endpoint, key structure, expiration, extra fields and generation validation', async () => {
    assert.equal(validPublicKey(publicKey), true);
    assert.equal(validPublicKey(Buffer.alloc(65, 4).toString('base64url')), false);
    for (const endpoint of ['http://fcm.googleapis.com/x', 'https://localhost/x', 'https://127.0.0.1/x',
        'https://fcm.googleapis.com.evil.invalid/x', 'https://evilpush.apple.com/x', 'https://push.apple.com.evil.invalid/x',
        'https://user:pass@fcm.googleapis.com/x', 'https://fcm.googleapis.com:444/x', 'https://fcm.googleapis.com/x#fragment', 'https://fcm.googleapis.com/x#',
        'https://fcm.googleapis.com\\@evil.invalid/x', 'https://fcm.googleapis.com/' + 'x'.repeat(2048)]) assert.equal(safePushEndpoint(endpoint), false);
    assert.equal(safePushEndpoint('https://web.push.apple.com/synthetic'), true);
    for (const mutate of [v => { v.userId = 2; }, v => { v.subscription.keys.auth += '='; },
        v => { v.subscription.keys.p256dh = Buffer.alloc(65, 4).toString('base64url'); },
        v => { v.expectedGeneration = 'bad'; }, v => { v.subscription.expirationTime = now - 1; },
        v => { v.subscription.extra = true; }]) {
        const input = registration(); mutate(input);
        await assert.rejects(fixture().service('POST', input, headers), rejectCode('invalid'));
    }
    const input = registration(); input.subscription.expirationTime = now + 5000;
    const f = fixture(); assert.equal((await f.service('POST', input, headers)).enrollment.authorizedUntil, new Date(now + 5000).toISOString());
    assert.equal(registrationSchema.safeParse(registration()).success, true);
});

test('duplicate POST is idempotent without extending expiry; changed same ID conflicts', async () => {
    const f = fixture(), input = registration();
    const first = await f.repository.register(actor(), input, 'test-key');
    assert.deepEqual(await f.repository.register({ ...actor(), expiresAt: new Date(now + 7200000) }, input, 'test-key'), first);
    assert.equal(f.rows.size, 1);
    await assert.rejects(f.repository.register(actor(), { ...input, subscription: { ...input.subscription, endpoint: 'https://fcm.googleapis.com/different' } }, 'test-key'), rejectCode('conflict'));
});

test('endpoint and registration ID collisions cannot cross account ownership', async () => {
    const f = fixture(), input = registration();
    await f.repository.register(actor(), input, 'test-key');
    await assert.rejects(f.repository.register(actor(2, 2), registration(null, input.subscription.endpoint), 'test-key'), rejectCode('conflict'));
    await assert.rejects(f.repository.register(actor(2, 2), { ...registration(null, 'https://fcm.googleapis.com/other'), registrationId: input.registrationId }, 'test-key'), rejectCode('conflict'));
    assert.equal(f.rows.size, 1); assert.equal((await f.repository.read(actor(2, 2))), null);
});

test('simultaneous first registration/replacement has one winner and stale deletes preserve it', async () => {
    const f = fixture();
    let results = await Promise.allSettled([f.repository.register(actor(), registration(), 'test-key'), f.repository.register(actor(), registration(), 'test-key')]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    const old = (await f.repository.read(actor())).generation;
    const requests = [registration(old), registration(old)];
    results = await Promise.allSettled(requests.map(input => f.repository.register(actor(), input, 'test-key')));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    const current = await f.repository.read(actor());
    assert.deepEqual(await f.repository.disable(actor(), { generations: [old] }), current);
    await assert.rejects(f.repository.register(actor(), registration(old), 'test-key'), rejectCode('conflict'));
    assert.equal(f.rows.size, 1);
});

test('disable clears all capability material and blocks late pending registration in either ordering', async () => {
    for (const registerFirst of [false, true]) {
        const f = fixture(), input = registration();
        if (registerFirst) await f.repository.register(actor(), input, 'test-key');
        const disabled = await f.repository.disable(actor(), { generations: [input.registrationId] });
        assert.equal(disabled.enabled, false); assert.notEqual(disabled.generation, input.registrationId);
        for (const key of ['endpoint', 'p256dh', 'auth', 'vapidKeyId', 'authorizedUntil', 'browserExpiresAt']) assert.equal(f.rows.get(1)[key], null);
        await assert.rejects(f.repository.register(actor(), input, 'test-key'), rejectCode('conflict'));
        assert.deepEqual(await f.repository.disable(actor(), { generations: [input.registrationId] }), disabled);
        const replacement = registration(disabled.generation);
        await f.repository.register(actor(), replacement, 'test-key');
        assert.equal((await f.repository.disable(actor(), { generations: [input.registrationId, disabled.generation] })).generation, replacement.registrationId);
    }
});

test('captured current/pending generations cancel an in-flight replacement without deleting a newer one', async () => {
    for (const pendingFirst of [false, true]) {
        const f = fixture(), initial = registration();
        await f.repository.register(actor(), initial, 'test-key');
        const pending = registration(initial.registrationId);
        if (pendingFirst) await f.repository.register(actor(), pending, 'test-key');
        const disabled = await f.repository.disable(actor(), { generations: [initial.registrationId, pending.registrationId] });
        assert.equal(disabled.enabled, false);
        await assert.rejects(f.repository.register(actor(), pending, 'test-key'), rejectCode('conflict'));
        const newer = registration(disabled.generation);
        await f.repository.register(actor(), newer, 'test-key');
        assert.equal((await f.repository.disable(actor(), { generations: [initial.registrationId, pending.registrationId] })).generation, newer.registrationId);
    }
});

test('repository rejects session/browser expiry at the database clock and sanitizes driver failures', async () => {
    const f = fixture();
    await assert.rejects(f.repository.read({ ...actor(), expiresAt: new Date(now) }), rejectCode('unauthenticated'));
    const input = registration(); input.subscription.expirationTime = now;
    await assert.rejects(f.repository.register(actor(), input, 'test-key'), rejectCode('invalid'));
    const repository = createPushSubscriptionRepository({ transaction: async () => { throw new Error('private SQL endpoint credential'); } });
    await assert.rejects(repository.read(actor()), error => error.code === 'unavailable' && !error.message.includes('private'));
});

test('feature configuration defaults off, validates approved public material/origin, and disabled cleanup works', async () => {
    assert.equal(pushConfiguration({}).available, false);
    const env = { NODE_ENV: 'production', THESISHS_WEB_PUSH_ENABLED: 'true', THESISHS_PUSH_ORIGIN: config.origin,
        THESISHS_WEB_PUSH_PUBLIC_KEY: publicKey, THESISHS_WEB_PUSH_KEY_ID: 'test-key',
        THESISHS_WEB_PUSH_PRIVATE_KEY: Buffer.from('1'.padStart(64, '0'), 'hex').toString('base64url'),
        THESISHS_WEB_PUSH_SUBJECT: 'mailto:synthetic@example.invalid' };
    assert.equal(pushConfiguration(env).available, true);
    for (const edit of [{ THESISHS_WEB_PUSH_ENABLED: 'TRUE' }, { THESISHS_WEB_PUSH_PUBLIC_KEY: 'invalid' },
        { THESISHS_PUSH_ORIGIN: 'http://app.example.invalid' }, { THESISHS_PUSH_ORIGIN: config.origin + '/path' }, { THESISHS_WEB_PUSH_KEY_ID: '' }]) assert.equal(pushConfiguration({ ...env, ...edit }).available, false);
    assert.equal(pushConfiguration({ ...env, NODE_ENV: 'development', THESISHS_PUSH_ORIGIN: 'http://localhost:3000' }).available, true);
    const f = fixture({ configuration: () => ({ ...config, available: false, publicKey: null, keyId: null }) });
    await assert.rejects(f.service('POST', registration(), headers), rejectCode('unavailable'));
    assert.equal((await f.service('DELETE', { generations: [randomUUID()] }, headers)).enrollment.enabled, false);
});

test('HTTP enforces exact Origin, JSON and streamed 4 KiB; all failures are safe and no-store', async () => {
    const f = fixture();
    for (const origin of ['', 'null', 'https://foreign.example.invalid', config.origin + '/']) {
        const response = await f.http(request('POST', registration(), { origin })); assert.equal(response.status, 403);
    }
    const absentOrigin = request('POST', registration()); absentOrigin.headers.delete('origin');
    assert.equal((await f.http(absentOrigin)).status, 403);
    assert.equal((await f.http(request('DELETE', { generations: [randomUUID()] }, { 'sec-fetch-site': 'cross-site' }))).status, 403);
    assert.equal((await f.http(request('POST', '{}', { 'content-type': 'text/plain' }))).status, 415);
    assert.equal((await f.http(request('POST', '{'))).status, 400);
    let calls = 0;
    const handler = createPushHttpHandler(async () => { calls++; return { ok: true }; }, () => config);
    assert.equal((await handler(request('POST', '{}' + ' '.repeat(4094)))).status, 200);
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(2048)); controller.enqueue(new Uint8Array(2049)); controller.close(); } });
    const streamed = new Request('https://app.example.invalid/api/push/subscription', { method: 'POST', headers: { origin: config.origin, 'content-type': 'application/json', 'content-length': '1' }, body: stream, duplex: 'half' });
    assert.equal((await handler(streamed)).status, 413); assert.equal(calls, 1);
    const leaking = createPushHttpHandler(async () => { throw new Error('PRIVATE-ENDPOINT-KEY-STACK'); }, () => config);
    const response = await leaking(request('GET')); assert.equal(response.status, 503);
    assert.match(response.headers.get('cache-control'), /no-store/); assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.ok(!(await response.text()).includes('PRIVATE'));
});

test('API registration/read/removal integration returns only safe metadata; invalid and unavailable paths do not leak', async () => {
    const f = fixture(), input = registration();
    assert.equal((await f.http(request('POST', input))).status, 200);
    const status = await (await f.http(request('GET'))).json(); assert.equal(status.enrollment.generation, input.registrationId);
    assert.equal(status.publicKey, publicKey); assert.ok(!JSON.stringify(status).includes(input.subscription.endpoint));
    assert.equal((await f.http(request('DELETE', { generations: [input.registrationId] }))).status, 200);
    assert.equal((await f.http(request('DELETE', { generations: [] }))).status, 400);
    const offline = fixture({ repository: { read: async () => { throw new Error('secret driver error'); } } });
    const response = await offline.http(request('GET')); assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('secret'));
});

test('rate and authentication failures are recoverable and never allocate client-controlled account buckets', async () => {
    for (const status of ['limited', 'unavailable']) {
        const f = fixture({ ingress: async () => status });
        const response = await f.http(request('GET')); assert.equal(response.status, status === 'limited' ? 429 : 503);
        if (status === 'limited') assert.equal(response.headers.get('retry-after'), '900');
        assert.equal(f.calls.account, 0); assert.equal(f.rows.size, 0);
        const account = fixture({ accountLimit: async () => status });
        assert.equal((await account.http(request('GET'))).status, status === 'limited' ? 429 : 503);
    }
    const broken = fixture({ session: async () => { throw new Error('secret session'); } });
    await assert.rejects(broken.service('GET', undefined, headers), error => error.code === 'unavailable' && !error.message.includes('secret'));
    assert.equal((await broken.http(request('GET'))).status, 503);
});

test('expected-account header is only a concurrency precondition and rejects switched sessions', async () => {
    const f = fixture();
    await assert.rejects(f.service('POST', registration(), new Headers({ 'x-thesishs-push-account': '2' })), rejectCode('unauthenticated'));
    assert.equal(f.calls.account, 0); assert.equal(f.rows.size, 0);
    assert.equal((await f.service('POST', registration(), new Headers({ 'x-thesishs-push-account': '1' }))).ok, true);
    const switched = fixture({ session: async () => ({ userId: 2, roleId: 2, exp: (now + 10000) / 1000 }) });
    await assert.rejects(switched.service('POST', registration(), new Headers({ 'x-thesishs-push-account': '1' })), rejectCode('unauthenticated'));
    assert.equal(switched.rows.size, 0);
});

function loadTs(path, mocks, extra = {}) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
        { exports, require: id => Object.hasOwn(mocks, id) ? mocks[id] : require(id), TextEncoder, process, ...extra });
    return exports;
}
test('actual shared limiter uses fixed push thresholds, trusted ingress once and verified account once', async () => {
    const env = { NODE_ENV: 'production', THESISHS_AUTH_LIMIT_SECRET: 'synthetic-test-only-limit-secret-32bytes' };
    const limits = loadTs('lib/auth/auth-rate-limit-config.ts', { 'server-only': {} }, { process: { env } });
    assert.equal(limits.getAuthLimitConfiguration('pushMutation').limits.account, 20);
    assert.equal(limits.getAuthLimitConfiguration('pushMutation').limits.source, 120);
    assert.equal(limits.getAuthLimitConfiguration('pushMutation').limits.global, 600);
    assert.equal(limits.getAuthLimitConfiguration('pushStatus').limits.account, 60);
    assert.equal(limits.getAuthLimitConfiguration('pushStatus').limits.source, 300);
    assert.equal(limits.getAuthLimitConfiguration('pushStatus').limits.global, 1200);
    const calls = [];
    const limiter = loadTs('lib/services/auth-rate-limit.service.ts', {
        'server-only': {}, 'next/headers': {}, '@/lib/auth/auth-rate-limit-config': limits,
        '@/lib/auth/request-source': { trustedAuthSource: () => 'trusted-fixture-source' },
        '@/lib/repositories/auth-rate-limit.repository': { consumeAuthBuckets: async (global, identities) => { calls.push([global, ...identities]); return true; } },
    });
    assert.equal((await limiter.checkPushIngress('pushMutation', headers)).status, 'allowed');
    assert.equal((await limiter.checkPushAccount('pushMutation', 1)).status, 'allowed');
    assert.deepEqual(calls.map(call => call.map(bucket => bucket.limit)), [[600, 120], [20]]);
    assert.equal((await limiter.checkPushAccount('pushMutation', -1)).status, 'unavailable'); assert.equal(calls.length, 2);
    delete env.THESISHS_AUTH_LIMIT_SECRET;
    assert.equal((await limiter.checkPushIngress('pushStatus', headers)).status, 'unavailable');
});
