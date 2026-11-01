/* eslint-disable @typescript-eslint/no-require-imports */
// Real signing/encryption and source execution; all database/DNS/HTTPS operations are doubles.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const { createECDH, createPublicKey, verify } = require('node:crypto');
const { EventEmitter } = require('node:events');
const vm = require('node:vm');
const ts = require('typescript');
const { PgDialect } = require('drizzle-orm/pg-core');
function load(path, mocks = {}, globals = {}) {
    const exports = {}, localRequire = createRequire(resolve(path));
    vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, { exports, require: id => id === 'server-only' ? {} : Object.hasOwn(mocks, id) ? mocks[id] : localRequire(id),
        URL, Buffer, AbortController, setTimeout, clearTimeout, performance, process, console, ...globals });
    return exports;
}
const configModule = load('lib/push/config.ts');
const delivery = load('lib/push/delivery.ts');
const transportModule = load('lib/push/transport.ts', { './delivery': delivery });
const scheduleModule = load('lib/push/schedule.ts', { './delivery': delivery });
// Publicly known test scalars 1 and 2, never real enrollment/application credentials.
const scalar = n => Buffer.from(n.toString(16).padStart(64, '0'), 'hex');
const testPair = n => { const pair = createECDH('prime256v1'); pair.setPrivateKey(scalar(n)); return pair; };
const publicKey = testPair(1).getPublicKey().toString('base64url');
const env = { NODE_ENV: 'production', THESISHS_WEB_PUSH_ENABLED: 'true', THESISHS_PUSH_ORIGIN: 'https://app.example.invalid',
    THESISHS_WEB_PUSH_PUBLIC_KEY: publicKey, THESISHS_WEB_PUSH_KEY_ID: 'synthetic-key',
    THESISHS_WEB_PUSH_PRIVATE_KEY: scalar(1).toString('base64url'), THESISHS_WEB_PUSH_SUBJECT: 'mailto:synthetic@example.invalid' };
const config = configModule.pushDeliveryConfiguration(env);
const wallTime = 1800000000000;
const row = (changes = {}) => ({ generation: '00000000-0000-4000-8000-000000000001', userId: 11, roleId: 3,
    endpoint: 'https://fcm.googleapis.com/fcm/send/synthetic', p256dh: testPair(2).getPublicKey().toString('base64url'),
    auth: Buffer.alloc(16, 1).toString('base64url'), vapidKeyId: 'synthetic-key', authorizedUntil: new Date(wallTime + 3600000),
    browserExpiresAt: null, ...changes });
function budget() {
    const controller = new AbortController(); let remaining = 3000;
    return { controller, expire: () => { remaining = 0; controller.abort(); }, signal: controller.signal,
        remaining: () => remaining, check: () => { if (controller.signal.aborted || remaining <= 0) throw Error('deadline'); } };
}
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('configuration defaults off and requires one matching VAPID identity; only public DTO fields escape', () => {
    assert.equal(configModule.pushDeliveryConfiguration({}), null); assert.ok(config);
    for (const change of [{ THESISHS_WEB_PUSH_ENABLED: 'TRUE' }, { THESISHS_WEB_PUSH_PRIVATE_KEY: undefined },
        { THESISHS_WEB_PUSH_PRIVATE_KEY: scalar(2).toString('base64url') }, { THESISHS_WEB_PUSH_PRIVATE_KEY: 'a'.repeat(43) },
        { THESISHS_WEB_PUSH_PUBLIC_KEY: 'invalid' }, { THESISHS_WEB_PUSH_KEY_ID: '' }, { THESISHS_WEB_PUSH_SUBJECT: undefined },
        { THESISHS_WEB_PUSH_SUBJECT: 'https://localhost/' }, { THESISHS_WEB_PUSH_SUBJECT: 'mailto:not-an-email' },
        { THESISHS_WEB_PUSH_SUBJECT: 'https://user:secret@contact.example.invalid/' }, { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
        { THESISHS_PUSH_ORIGIN: 'https://app.example.invalid/path' }]) {
        assert.equal(configModule.pushDeliveryConfiguration({ ...env, ...change }), null);
        assert.equal(configModule.pushConfiguration({ ...env, ...change }).available, false);
    }
    const safe = configModule.pushConfiguration(env);
    assert.deepEqual(Object.keys(safe).sort(), ['available', 'keyId', 'origin', 'publicKey']);
    assert.equal(safe.publicKey, publicKey); assert.equal(safe.keyId, config.keyId);
    assert.ok(!JSON.stringify(safe).includes(config.privateKey)); assert.ok(!JSON.stringify(safe).includes(config.subject));
});

test('four events select exactly the worker contract; unknown destinations and private additions are rejected', () => {
    for (const [event, destination, roleId] of [['initial-submission', 'adviser-notifications', 2], ['revised-submission', 'adviser-notifications', 2],
        ['revision-required', 'student-notifications', 3], ['approved', 'student-notifications', 3]]) {
        assert.deepEqual(plain(delivery.researchPushTarget({ event, recipientId: 11 })), { roleId, payload: { v: 1, destination } });
    }
    for (const value of ['https://foreign.example.invalid', '__proto__', 'admin-notifications', null]) assert.equal(delivery.pushPayload(value), null);
    for (const recipientId of [-1, 0, 1.5, 2147483648]) assert.equal(delivery.researchPushTarget({ event: 'approved', recipientId }), null);
    assert.equal(delivery.researchPushTarget({ event: 'group-archived', recipientId: 11 }), null);
    for (const payload of [{ v: 1, destination: 'student-notifications', title: 'PRIVATE' }, { v: 2, destination: 'student-notifications' },
        { v: 1, destination: 'https://foreign.example.invalid' }]) assert.throws(() => transportModule.buildPushRequest(row(), payload, config));
    const notifications = [], listeners = {};
    vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), { URL, self: { addEventListener: (name, listener) => { listeners[name] = listener; },
        registration: { showNotification: async (title, options) => notifications.push({ title, options }) } } });
    for (const destination of ['student-notifications', 'adviser-notifications']) {
        let pending; listeners.push({ data: { text: () => JSON.stringify(delivery.pushPayload(destination)) }, waitUntil: work => { pending = work; } });
        assert.equal(notifications.at(-1).options.data.destination, destination); assert.ok(pending instanceof Object);
        assert.equal(notifications.at(-1).options.body, 'A research update is available. Open ThesiSHS AI to view it.');
    }
});

test('installed web-push signs ES256/VAPID and encrypts only generic JSON; Node 24 decryption verifies bytes', () => {
    const payload = delivery.pushPayload('student-notifications');
    const details = transportModule.buildPushRequest(row(), payload, config);
    assert.equal(details.method, 'POST'); assert.equal(details.endpoint, row().endpoint);
    assert.equal(details.headers['Content-Encoding'], 'aes128gcm'); assert.equal(details.headers.TTL, 300);
    assert.equal(details.headers['Content-Length'], details.body.length); assert.ok(details.body.length < 4096);
    const match = /^vapid t=([^,]+), k=(.+)$/.exec(details.headers.Authorization); assert.ok(match); assert.equal(match[2], publicKey);
    const [header, claims, signature] = match[1].split('.');
    assert.equal(JSON.parse(Buffer.from(header, 'base64url')).alg, 'ES256');
    const parsed = JSON.parse(Buffer.from(claims, 'base64url'));
    assert.equal(parsed.aud, 'https://fcm.googleapis.com'); assert.equal(parsed.sub, config.subject);
    assert.ok(parsed.exp > Date.now() / 1000 && parsed.exp <= Date.now() / 1000 + 86400);
    const bytes = Buffer.from(publicKey, 'base64url');
    const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: bytes.subarray(1, 33).toString('base64url'), y: bytes.subarray(33).toString('base64url') }, format: 'jwk' });
    assert.equal(verify('sha256', Buffer.from(header + '.' + claims), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')), true);
    const decoded = require('http_ece').decrypt(details.body, { version: 'aes128gcm', privateKey: testPair(2), authSecret: row().auth });
    assert.deepEqual(JSON.parse(decoded.toString('utf8')), { v: 1, destination: 'student-notifications' });
    assert.equal(decoded.toString('utf8'), JSON.stringify(payload));
});

function transportDouble({ status = 201, addresses = [{ address: '8.8.8.8', family: 4 }], bytes = 0, hang = false, lookupError = null, slowDns = false } = {}) {
    const calls = { lookup: 0, request: 0, connected: 0, destroyed: 0 }, requests = [], lookups = [];
    const lookup = (_host, _options, callback) => { calls.lookup++; if (slowDns) lookups.push(callback); else callback(lookupError, addresses); };
    const request = (url, options, receive) => {
        calls.request++; const req = new EventEmitter(); requests.push({ url, options, req });
        req.destroy = () => { calls.destroyed++; req.emit('error', Error('PRIVATE provider error')); return req; };
        req.setTimeout = (_ms, callback) => { req.timeout = callback; return req; };
        req.end = () => queueMicrotask(() => options.lookup(url.hostname, { all: false }, (error, address) => {
            if (error) { req.emit('error', error); return; }
            calls.connected++; calls.address = address;
            if (hang) return;
            const response = new EventEmitter(); response.statusCode = status; response.destroy = () => {};
            receive(response); if (bytes) response.emit('data', Buffer.alloc(bytes)); response.emit('end');
        }));
        return req;
    };
    return { send: transportModule.createPushTransport({ request, lookup }), calls, requests, lookups };
}
test('sender independently rejects unsafe endpoints before DNS; conservative public-address policy rejects internal and mixed DNS', async () => {
    for (const endpoint of ['https://127.0.0.1/x', 'https://[::1]/x', 'http://fcm.googleapis.com/x', 'https://user@fcm.googleapis.com/x',
        'https://fcm.googleapis.com:444/x', 'https://fcm.googleapis.com.evil.invalid/x', 'https://evilpush.apple.com/x',
        'https://fcm.googleapis.com/x#secret', 'https://fcm.googleapis.com./x']) {
        const f = transportDouble(); await assert.rejects(f.send(row({ endpoint }), delivery.pushPayload('student-notifications'), config, budget()));
        assert.equal(f.calls.request, 0); assert.equal(f.calls.lookup, 0);
    }
    for (const address of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '100.64.0.1', '172.16.0.1', '192.168.1.1',
        '192.0.2.1', '198.18.0.1', '224.0.0.1', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1', '2002:7f00:1::'])
        assert.equal(transportModule.publicPushAddress(address), false);
    for (const address of ['8.8.8.8', '17.0.0.1', '2001:4860:4860::8888', '2620:149::1']) assert.equal(transportModule.publicPushAddress(address), true);
    const f = transportDouble({ addresses: [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }] });
    await assert.rejects(f.send(row(), delivery.pushPayload('student-notifications'), config, budget())); assert.equal(f.calls.connected, 0);
});

test('HTTPS pins validated DNS, verifies TLS hostname, bounds headers/body and rejects redirects without following', async () => {
    const f = transportDouble(), b = budget();
    assert.equal(await f.send(row(), delivery.pushPayload('student-notifications'), config, b), 201);
    const options = f.requests[0].options;
    assert.equal(options.rejectUnauthorized, true); assert.equal(options.servername, 'fcm.googleapis.com');
    assert.equal(options.agent, false); assert.equal(options.autoSelectFamily, false); assert.equal(options.signal, b.signal);
    assert.equal(options.maxHeaderSize, 8192); assert.equal(f.calls.address, '8.8.8.8');
    for (const status of [301, 302, 307, 308]) {
        const redirect = transportDouble({ status }); await assert.rejects(redirect.send(row(), delivery.pushPayload('student-notifications'), config, budget()));
        assert.equal(redirect.calls.request, 1); assert.equal(redirect.calls.destroyed, 1);
    }
    const oversized = transportDouble({ bytes: 1025 });
    await assert.rejects(oversized.send(row(), delivery.pushPayload('student-notifications'), config, budget())); assert.equal(oversized.calls.destroyed, 1);
});

test('deadline abort destroys the HTTP request even during DNS; late DNS cannot connect; socket timeout also destroys', async () => {
    for (const slowDns of [false, true]) {
        const f = transportDouble({ hang: true, slowDns }), b = budget();
        const pending = f.send(row(), delivery.pushPayload('student-notifications'), config, b);
        await new Promise(resolve => setImmediate(resolve)); b.expire();
        await assert.rejects(pending, error => error.message === 'Push transport unavailable.');
        assert.equal(f.calls.destroyed, 1);
        if (slowDns) { f.lookups[0](null, [{ address: '8.8.8.8', family: 4 }]); assert.equal(f.calls.connected, 0); }
    }
    const f = transportDouble({ hang: true }), pending = f.send(row(), delivery.pushPayload('student-notifications'), config, budget());
    await new Promise(resolve => setImmediate(resolve)); f.requests[0].req.timeout(); await assert.rejects(pending); assert.equal(f.calls.destroyed, 1);
});

function serviceFixture(changes = {}) {
    const calls = { reads: 0, sends: [], cleanup: [] };
    const deps = { configuration: () => config, now: () => wallTime,
        repository: { find: async (...args) => { calls.reads++; calls.lookup = args.slice(0, 3); return row(); },
            disable: async captured => { calls.cleanup.push(captured); return true; } },
        transport: async (_row, payload) => { calls.sends.push(payload); return 201; }, ...changes };
    return { deliver: delivery.createResearchPushDelivery(deps), calls, deps };
}
test('disabled/invalid/expired/foreign-role/key-mismatched recipients cause zero delivery or cleanup', async () => {
    const off = serviceFixture({ configuration: () => null }); assert.equal(await off.deliver({ event: 'approved', recipientId: 11 }, budget()), 'disabled'); assert.equal(off.calls.reads, 0);
    for (const patch of [{ userId: 12 }, { roleId: 2 }, { roleId: 1 }, { roleId: 4 }, { vapidKeyId: 'old' },
        { authorizedUntil: new Date(wallTime) }, { browserExpiresAt: new Date(wallTime) }]) {
        const f = serviceFixture(); f.deps.repository.find = async () => row(patch);
        assert.equal(await f.deliver({ event: 'approved', recipientId: 11 }, budget()), 'no_subscription'); assert.equal(f.calls.sends.length, 0);
    }
    const f = serviceFixture(); f.deps.repository.find = async () => row({ endpoint: 'https://private.example.invalid' });
    assert.equal(await f.deliver({ event: 'approved', recipientId: 11 }, budget()), 'invalid'); assert.equal(f.calls.sends.length, 0);
});

test('provider permanent errors conditionally clean captured material; transient and configuration errors retain it', async () => {
    for (const status of [404, 410, 400, 401, 403, 429, 500, 503]) {
        const f = serviceFixture({ transport: async () => status });
        const outcome = await f.deliver({ event: 'approved', recipientId: 11 }, budget());
        assert.equal(f.calls.cleanup.length, status === 404 || status === 410 ? 1 : 0);
        assert.equal(outcome, status === 404 || status === 410 ? 'endpoint_disabled' : status < 429 ? 'configuration_error' : 'transient');
    }
    const f = serviceFixture({ transport: async () => { throw Error('PRIVATE endpoint/body'); } });
    assert.equal(await f.deliver({ event: 'approved', recipientId: 11 }, budget()), 'unavailable'); assert.equal(f.calls.cleanup.length, 0);
});

test('database awaits are never abandoned: late lookup/response cannot start transport or cleanup after abort', async () => {
    const waiting = deferred(), f = serviceFixture(), b = budget(); let settled = false;
    f.deps.repository.find = () => waiting.promise;
    const pending = f.deliver({ event: 'approved', recipientId: 11 }, b).then(result => { settled = true; return result; });
    b.expire(); await new Promise(resolve => setImmediate(resolve)); assert.equal(settled, false);
    waiting.resolve(row()); assert.equal(await pending, 'timeout'); assert.equal(f.calls.sends.length, 0);
    const late = serviceFixture(), limit = budget(); late.deps.transport = async () => { limit.expire(); return 410; };
    assert.equal(await late.deliver({ event: 'approved', recipientId: 11 }, limit), 'timeout'); assert.equal(late.calls.cleanup.length, 0);
});

function schedulerFixture(changes = {}) {
    let clock = 0; const jobs = [], logs = [], calls = [];
    const deps = { now: () => clock, enabled: () => true, after: job => jobs.push(job),
        deliver: async (target, budget) => { budget.check(); calls.push(target); return 'accepted'; }, log: outcome => logs.push(outcome), ...changes };
    return { schedule: scheduleModule.createResearchPushScheduler(deps), deps, jobs, logs, calls, time: value => { clock = value; } };
}
test('after adapter schedules once, captures only the event/recipient and skips insufficient response-time budgets', async () => {
    const f = schedulerFixture(), target = { event: 'approved', recipientId: 11, researchTitle: 'PRIVATE' };
    f.schedule(target); target.recipientId = 99; f.schedule(target); assert.equal(f.jobs.length, 1);
    await f.jobs[0](); assert.deepEqual(plain(f.calls), [{ event: 'approved', recipientId: 11 }]); assert.deepEqual(f.logs, ['accepted']);
    const late = schedulerFixture(); late.time(51001); late.schedule({ event: 'approved', recipientId: 11 });
    assert.equal(late.jobs.length, 0); assert.deepEqual(late.logs, ['budget_skip']);
    const delayed = schedulerFixture(); delayed.schedule({ event: 'approved', recipientId: 11 }); delayed.time(51001);
    await delayed.jobs[0](); assert.equal(delayed.calls.length, 0); assert.deepEqual(delayed.logs, ['budget_skip']);
    const off = schedulerFixture({ enabled: () => false }); off.schedule({ event: 'approved', recipientId: 11 }); assert.equal(off.jobs.length, 0);
});
test('scheduling/delivery/logging failures are isolated; the timer aborts owned transport work', async () => {
    const failed = schedulerFixture({ after: () => { throw Error('no request context'); } });
    assert.doesNotThrow(() => failed.schedule({ event: 'approved', recipientId: 11 })); assert.deepEqual(failed.logs, ['schedule_failed']);
    let fire, cleared = 0;
    const timedModule = load('lib/push/schedule.ts', { './delivery': delivery }, { setTimeout: callback => { fire = callback; return 1; }, clearTimeout: () => { cleared++; } });
    const jobs = [], logs = []; let wasAborted = false;
    const schedule = timedModule.createResearchPushScheduler({ now: () => 0, enabled: () => true, after: job => jobs.push(job), log: value => logs.push(value),
        deliver: (_target, b) => new Promise(resolve => b.signal.addEventListener('abort', () => { wasAborted = true; resolve('timeout'); }, { once: true })) });
    schedule({ event: 'approved', recipientId: 11 }); const pending = jobs[0](); fire(); await pending;
    assert.equal(wasAborted, true); assert.equal(cleared, 1); assert.deepEqual(logs, ['timeout']);
    const logging = schedulerFixture({ log: () => { throw Error('logger'); }, deliver: async () => { throw Error('PRIVATE'); } });
    logging.schedule({ event: 'approved', recipientId: 11 }); await assert.doesNotReject(logging.jobs[0]());
});

test('real delivery repository enforces current role/active/lease/key SQL and cleanup CAS erases only captured generation/endpoint', async () => {
    const schema = require('../db/schema/index.ts'), dialect = new PgDialect(), trace = [];
    let stored = row(), account = { roleId: 3, isActive: true };
    const params = where => dialect.sqlToQuery(where).params;
    const tx = { execute: async query => { trace.push(dialect.sqlToQuery(query).sql); return []; },
        select: () => ({ from: () => ({ innerJoin: () => ({ where: condition => ({ limit: async () => {
            const query = dialect.sqlToQuery(condition); trace.push(query.sql);
            const [userId, roleId, active, enabled, keyId] = query.params;
            return stored && stored.userId === userId && account.roleId === roleId && account.isActive === active && enabled && stored.vapidKeyId === keyId && stored.authorizedUntil > wallTime ? [{ ...stored, roleId: account.roleId }] : [];
        } }) }) }) }),
        update: () => ({ set: values => ({ where: condition => ({ returning: async () => {
            const [userId, id, endpoint, enabled] = params(condition);
            if (!stored || stored.userId !== userId || stored.generation !== id || stored.endpoint !== endpoint || !enabled) return [];
            stored = { ...stored, ...values, generation: values.id }; return [{ id: values.id }];
        } }) }) }),
    };
    const repository = load('lib/repositories/push-delivery.repository.ts', { '@/db/schema': schema }).createPushDeliveryRepository({ transaction: async operation => operation(tx) });
    const captured = await repository.find(11, 3, config.keyId, budget()); assert.ok(captured);
    assert.equal(await repository.find(12, 3, config.keyId, budget()), null);
    for (const state of [{ roleId: 1, isActive: true }, { roleId: 2, isActive: true }, { roleId: 3, isActive: false }]) {
        account = state; assert.equal(await repository.find(11, 3, config.keyId, budget()), null);
    }
    account = { roleId: 3, isActive: true };
    assert.equal(await repository.find(11, 3, 'old-key', budget()), null);
    assert.ok(trace.some(text => text.includes('authorized_until') && text.includes('clock_timestamp()') && text.includes('browser_expires_at')));
    assert.ok(trace.includes("set local lock_timeout = '250ms'")); assert.ok(trace.includes("set local statement_timeout = '750ms'"));
    stored.generation = '00000000-0000-4000-8000-000000000002';
    assert.equal(await repository.disable(captured, budget()), false); assert.equal(stored.endpoint, captured.endpoint);
    stored = row(); assert.equal(await repository.disable(captured, budget()), true); assert.equal(stored.enabled, false);
    assert.notEqual(stored.generation, captured.generation);
    for (const field of ['endpoint', 'p256dh', 'auth', 'vapidKeyId', 'authorizedUntil', 'browserExpiresAt']) assert.equal(stored[field], null);
});
