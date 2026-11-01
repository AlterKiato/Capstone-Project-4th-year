/* eslint-disable @typescript-eslint/no-require-imports */
// Worker VM, native/API doubles and actual component SSR only. No browser/provider/database access.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash, webcrypto } = require('node:crypto');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToString } = require('react-dom/server');
const { ResearchPushClient, ownResearchPushClient, logoutWithResearchPushCleanup } = require('../lib/pwa/research-push-client.ts');
const { acceptPushNavigation, PUSH_NAVIGATION_EVENT } = require('../lib/pwa/research-push-navigation.ts');
const publicKey = Buffer.from('046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5', 'hex').toString('base64url');
const fingerprint = sub => createHash('sha256').update(sub.endpoint).digest('hex');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
function loadTs(path, mocks = {}, globals = {}) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText, { exports, require: id => Object.hasOwn(mocks, id) ? mocks[id] : require(id), ...globals });
    return exports;
}
function fixture(context = {}, changes = {}) {
    let now = 1800000000000, local = null, permission = 'default', serial = 0, row = null;
    let keyId = 'synthetic-key', currentPublicKey = publicKey;
    const timers = new Map(), calls = { registration: [], subscribe: 0, unsubscribe: 0, api: [] };
    const status = () => ({ available: true, publicKey: currentPublicKey, keyId, enrollment: row });
    const native = (suffix = 'local', key = currentPublicKey) => ({ endpoint: 'https://fcm.googleapis.com/synthetic/' + suffix, expirationTime: null,
        options: { applicationServerKey: Uint8Array.from(Buffer.from(key, 'base64url')).buffer },
        toJSON: () => ({ keys: { p256dh: publicKey, auth: Buffer.alloc(16, 1).toString('base64url') } }),
        async unsubscribe() { calls.unsubscribe++; local = null; return true; },
    });
    const registration = { active: { scriptURL: 'https://app.example.invalid/sw.js' }, pushManager: { getSubscription: async () => local } };
    const environment = {
        supported: () => true, permission: () => permission,
        registration: async create => { calls.registration.push(create); return create || local ? registration : null; },
        fingerprint: async sub => fingerprint(sub),
        sameKey: (sub, key) => Buffer.from(sub.options.applicationServerKey).equals(Buffer.from(key, 'base64url')),
        subscribe: () => { calls.subscribe++; permission = 'granted'; local = native(); return Promise.resolve(local); },
        api: async (method, body, signal) => {
            calls.api.push({ method, body, signal });
            if (method === 'GET') return status();
            if (method === 'POST') row = { generation: body.registrationId, enabled: true, endpointFingerprint: fingerprint(local),
                authorizedUntil: new Date(now + 50000).toISOString(), vapidKeyId: keyId };
            if (method === 'DELETE' && (!row || body.generations.includes(row.generation))) row = { generation: 'disabled-marker', enabled: false, endpointFingerprint: null, authorizedUntil: null, vapidKeyId: null };
            return { enrollment: row };
        },
        uuid: () => '00000000-0000-4000-8000-' + String(++serial).padStart(12, '0'), now: () => now,
        schedule: (fn, delay) => { const id = ++serial; timers.set(id, { fn, deadline: now + delay }); return id; },
        cancel: id => timers.delete(id), ...changes,
    };
    const client = new ResearchPushClient({ roleId: 3, installed: true, configured: true, expiresAt: now + 50000, ...context }, environment);
    return { client, environment, calls, timers, native, status, registration,
        set local(value) { local = value; }, get local() { return local; },
        set row(value) { row = value; }, get row() { return row; },
        set permission(value) { permission = value; },
        set keyId(value) { keyId = value; }, set publicKey(value) { currentPublicKey = value; },
        advance(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.deadline <= now) { timers.delete(id); timer.fn(); } },
    };
}
function worker() {
    const events = {}, notices = [], opened = [], windows = [];
    const self = { location: { origin: 'https://app.example.invalid' }, addEventListener: (name, callback) => { events[name] = callback; },
        registration: { showNotification: async (...args) => { notices.push(args); } },
        clients: { matchAll: async () => windows, openWindow: async url => { opened.push(url); } } };
    vm.runInNewContext(readFileSync('public/sw.js', 'utf8'), { self, URL });
    async function dispatch(name, values) { let promise; events[name]({ ...values, waitUntil: p => { promise = p; } }); assert.ok(promise); await promise; }
    return { events, notices, windows, opened, dispatch };
}

test('worker has only push/click listeners, fixed generic notifications and malformed fallback', async () => {
    const w = worker(); assert.deepEqual(Object.keys(w.events).sort(), ['notificationclick', 'push']);
    for (const payload of [undefined, '{', 'x'.repeat(257), JSON.stringify({ v: 1, destination: 'https://evil.invalid' }),
        JSON.stringify({ v: 1, destination: 'student-notifications', title: 'PRIVATE-RESEARCH' })]) {
        await w.dispatch('push', { data: payload === undefined ? null : { text: () => payload } });
        const [title, options] = w.notices.at(-1);
        assert.equal(title, 'ThesiSHS AI'); assert.equal(options.body, 'A research update is available. Open ThesiSHS AI to view it.');
        assert.deepEqual(Object.keys(options.data), []); assert.ok(!JSON.stringify(options).includes('PRIVATE'));
    }
    for (const destination of ['student-notifications', 'adviser-notifications']) {
        await w.dispatch('push', { data: { text: () => JSON.stringify({ v: 1, destination }) } });
        assert.equal(w.notices.at(-1)[1].data.destination, destination);
    }
    const source = readFileSync('public/sw.js', 'utf8');
    assert.doesNotMatch(source, /addEventListener\(["'](?:fetch|sync|pushsubscriptionchange)|caches\.|skipWaiting\(|clients\.claim\(|\.navigate\(/);
});

test('worker closes and focuses an existing review without navigating; only allowlisted new windows', async () => {
    const w = worker(); let focused = 0, closed = 0; const intents = [];
    w.windows.push({ url: 'https://app.example.invalid/dashboard/adviser/submissions/16', focus: async () => { focused++; }, postMessage: value => intents.push(value) });
    await w.dispatch('notificationclick', { notification: { close: () => { closed++; }, data: { destination: 'adviser-notifications' } } });
    assert.equal(focused, 1); assert.equal(closed, 1); assert.equal(w.opened.length, 0);
    assert.equal(intents[0].type, 'thesishs-research-push'); assert.equal(intents[0].destination, 'adviser-notifications');
    w.windows.length = 0;
    for (const [destination, path] of [['student-notifications', '/dashboard/student/notifications'], ['adviser-notifications', '/dashboard/adviser/notifications'], ['constructor', '/dashboard'], ['https://evil.invalid', '/dashboard']]) {
        await w.dispatch('notificationclick', { notification: { close() {}, data: { destination } } });
        assert.equal(w.opened.at(-1), 'https://app.example.invalid' + path);
    }
});

test('registration ownership, installed guidance, unsupported and disabled states never prompt or POST', async () => {
    for (const roleId of [1, 4]) { const f = fixture({ roleId }); await f.client.start(); assert.equal(f.calls.registration.length, 0); }
    const browser = fixture({ installed: false }); await browser.client.start(); assert.equal(browser.client.snapshot().phase, 'install'); assert.equal(browser.calls.registration.length, 0);
    const unsupported = fixture({}, { supported: () => false }); await unsupported.client.start(); assert.equal(unsupported.client.snapshot().phase, 'unsupported');
    const disabled = fixture({ configured: false }); await disabled.client.start(); await disabled.client.enable();
    assert.equal(disabled.client.snapshot().phase, 'unavailable'); assert.deepEqual(disabled.calls.registration, [false]); assert.equal(disabled.calls.api.length, 0);
    const denied = fixture(); denied.permission = 'denied'; await denied.client.start(); await denied.client.enable(); assert.equal(denied.client.snapshot().phase, 'denied');
    for (const f of [browser, unsupported, disabled, denied]) { assert.equal(f.calls.subscribe, 0); f.client.dispose(); }
});

test('preloading does not prompt; explicit Enable subscribes synchronously and uses exact API fields', async () => {
    const f = fixture(); await f.client.start(); assert.equal(f.calls.subscribe, 0); assert.equal(f.client.snapshot().canEnable, true);
    const enabling = f.client.enable(); assert.equal(f.calls.subscribe, 1, 'Native subscription begins inside the click before asynchronous work');
    await enabling;
    assert.equal(f.client.snapshot().phase, 'enabled'); assert.deepEqual(f.calls.api.map(c => c.method), ['GET', 'POST']);
    const body = f.calls.api[1].body; assert.deepEqual(Object.keys(body).sort(), ['expectedGeneration', 'registrationId', 'subscription']);
    assert.deepEqual(Object.keys(body.subscription).sort(), ['endpoint', 'expirationTime', 'keys']);
    assert.ok(!JSON.stringify(f.client.snapshot()).includes(f.local.endpoint)); f.client.dispose();
});

test('matching key IDs remain enabled; key ID changes require explicit generation-safe re-enrollment', async () => {
    const f = fixture(); f.keyId = 'key-v1';
    await f.client.start(); await f.client.enable(); await f.client.start();
    assert.equal(f.client.snapshot().phase, 'enabled'); assert.equal(f.client.snapshot().canEnable, false);
    const previous = f.row, local = f.local, before = f.calls.api.length;
    f.keyId = 'key-v2'; await f.client.start();
    assert.equal(f.client.snapshot().phase, 'ready'); assert.equal(f.client.snapshot().canEnable, true);
    assert.equal(f.row, previous); assert.equal(f.local, local);
    assert.deepEqual(f.calls.api.slice(before).map(call => call.method), ['GET']);
    assert.equal(f.calls.subscribe, 1); assert.equal(f.calls.unsubscribe, 0);
    await f.client.enable();
    const post = f.calls.api.filter(call => call.method === 'POST').at(-1).body;
    assert.equal(post.expectedGeneration, previous.generation); assert.notEqual(post.registrationId, previous.generation);
    assert.equal(f.row.vapidKeyId, 'key-v2'); assert.equal(f.client.snapshot().phase, 'enabled');
    assert.equal(f.local, local); assert.equal(f.calls.subscribe, 1); assert.equal(f.calls.unsubscribe, 0);
    f.client.dispose();
});

for (const state of ['unavailable', 'denied']) test(`key ID mismatch preserves ${state} safeguards without automatic enrollment`, async () => {
    const f = fixture(); f.keyId = 'key-v1'; await f.client.start(); await f.client.enable();
    const previous = f.row, before = f.calls.api.length; f.keyId = 'key-v2';
    if (state === 'denied') f.permission = 'denied';
    else f.environment.api = async method => {
        f.calls.api.push({ method }); assert.equal(method, 'GET');
        return { ...f.status(), available: false, publicKey: null, keyId: null };
    };
    await f.client.start(); await f.client.enable();
    assert.equal(f.client.snapshot().phase, state); assert.equal(f.client.snapshot().canEnable, false);
    assert.equal(f.row, previous); assert.deepEqual(f.calls.api.slice(before).map(call => call.method), ['GET']);
    assert.equal(f.calls.subscribe, 1); assert.equal(f.calls.unsubscribe, 0); f.client.dispose();
});

test('explicit re-enrollment clears an incompatible browser key before a second user-controlled subscription', async () => {
    const f = fixture(); f.keyId = 'key-v1'; await f.client.start(); await f.client.enable();
    const previous = f.row, oldLocal = f.local;
    // Public P-256 test point 2G; no real credentials or provider operations.
    const replacementKey = Buffer.from('047cf27b188d034f7e8a52380304b51ac3c08969e277f21b35a60b48fc4766997807775510db8ed040293d9ac69f7430dbba7dade63ce982299e04b79d227873d1', 'hex').toString('base64url');
    f.keyId = 'key-v2'; f.publicKey = replacementKey; await f.client.start();
    assert.equal(f.client.snapshot().phase, 'ready'); assert.equal(f.client.snapshot().canEnable, true);
    assert.equal(f.calls.unsubscribe, 0); assert.equal(f.calls.subscribe, 1); assert.equal(f.row, previous);
    await f.client.enable();
    assert.equal(f.local, null); assert.equal(f.calls.unsubscribe, 1); assert.equal(f.calls.subscribe, 1);
    assert.equal(f.calls.api.filter(call => call.method === 'POST').length, 1); assert.equal(f.row, previous);
    assert.match(f.client.snapshot().message, /again/);
    const enabling = f.client.enable(); assert.equal(f.calls.subscribe, 2); await enabling;
    assert.notEqual(f.local, oldLocal); assert.equal(f.environment.sameKey(f.local, replacementKey), true);
    const post = f.calls.api.filter(call => call.method === 'POST').at(-1).body;
    assert.equal(post.expectedGeneration, previous.generation); assert.notEqual(post.registrationId, previous.generation);
    assert.equal(f.row.vapidKeyId, 'key-v2'); assert.equal(f.client.snapshot().phase, 'enabled'); f.client.dispose();
});

test('permission granted alone is not enrollment; failed signing-free POST is recoverable', async () => {
    const f = fixture(); f.permission = 'granted';
    const api = f.environment.api; f.environment.api = async (...args) => { if (args[0] === 'POST') throw new Error('private-endpoint'); return api(...args); };
    await f.client.start(); assert.equal(f.client.snapshot().phase, 'ready'); await f.client.enable();
    assert.equal(f.client.snapshot().phase, 'error'); assert.equal(f.client.snapshot().canDisable, true);
    assert.ok(!JSON.stringify(f.client.snapshot()).includes('private-endpoint'));
    f.environment.api = api; await f.client.disable(); assert.equal(f.local, null);
    assert.ok(f.calls.api.find(call => call.method === 'DELETE').body.generations.length > 0); f.client.dispose();
});

test('unconfirmed POST cannot be mistaken for enrollment or create another pending attempt', async () => {
    const f = fixture(); const api = f.environment.api;
    f.environment.api = async (...args) => { if (args[0] === 'POST') throw new Error('Unavailable'); return api(...args); };
    await f.client.start(); await f.client.enable(); await f.client.start();
    assert.equal(f.client.snapshot().phase, 'error'); assert.equal(f.client.snapshot().canEnable, false);
    await f.client.enable(); assert.equal(f.calls.subscribe, 1); f.client.dispose();
});

test('unrecognized old-account subscription is cleared first; another explicit click is required', async () => {
    const f = fixture(); f.local = f.native('old-account'); await f.client.start();
    await f.client.enable(); assert.equal(f.calls.unsubscribe, 1); assert.equal(f.calls.subscribe, 0);
    assert.equal(f.calls.api.filter(c => c.method === 'POST').length, 0); assert.match(f.client.snapshot().message, /again/);
    await f.client.enable(); assert.equal(f.calls.subscribe, 1); assert.equal(f.client.snapshot().phase, 'enabled'); f.client.dispose();
});

test('disable captures matching generation and never deletes a replacement discovered during removal', async () => {
    const f = fixture(); await f.client.start(); await f.client.enable(); const old = f.row.generation;
    f.row = { ...f.row, generation: 'newer-generation', endpointFingerprint: 'a'.repeat(64) };
    await f.client.disable();
    assert.deepEqual(f.calls.api.find(c => c.method === 'DELETE').body.generations, [old]);
    assert.equal(f.row.generation, 'newer-generation'); assert.equal(f.local, null); f.client.dispose();
    const orphan = fixture({ configured: false }); orphan.local = orphan.native();
    orphan.row = { generation: 'another-device', enabled: true, endpointFingerprint: 'b'.repeat(64), authorizedUntil: new Date(1800000050000).toISOString() };
    await orphan.client.start(); await orphan.client.disable();
    assert.equal(orphan.calls.api.filter(c => c.method === 'DELETE').length, 0); assert.equal(orphan.calls.unsubscribe, 1); orphan.client.dispose();
});

test('late cleanup cannot unsubscribe a newer native subscription even when its endpoint is reused', async () => {
    const f = fixture(); await f.client.start(); await f.client.enable();
    const newer = f.native(); newer.toJSON = () => ({ keys: { p256dh: publicKey, auth: Buffer.alloc(16, 2).toString('base64url') } });
    f.local = newer; f.row = { ...f.row, generation: 'newer-server-generation' };
    await f.client.disable(); assert.equal(f.calls.unsubscribe, 0); assert.equal(f.row.generation, 'newer-server-generation');
    assert.equal(f.client.snapshot().phase, 'error'); f.client.dispose();
});

test('disposed/account-switched callbacks cannot POST; expiry aborts requests and no late state update occurs', async () => {
    const native = deferred(), f = fixture({}, { subscribe: () => native.promise });
    const release = ownResearchPushClient(f.client); await f.client.start(); const pending = f.client.enable();
    const next = fixture(); const releaseNext = ownResearchPushClient(next.client); await next.client.start();
    native.resolve(f.native()); await pending;
    assert.equal(f.calls.api.filter(c => c.method === 'POST').length, 0); release(); releaseNext();
    const expired = fixture(); await expired.client.start(); expired.advance(50000); await expired.client.enable();
    assert.equal(expired.client.snapshot().phase, 'expired'); assert.equal(expired.calls.subscribe, 0); expired.client.dispose();
});

test('logout aborts pending enrollment, uses captured pending ID and never blocks session termination', async () => {
    const f = fixture(), posted = deferred(); const api = f.environment.api;
    f.environment.api = async (...args) => args[0] === 'POST' ? posted.promise : api(...args);
    const release = ownResearchPushClient(f.client); await f.client.start(); const enabling = f.client.enable(); await tick();
    let loggedOut = 0; await logoutWithResearchPushCleanup(async () => { loggedOut++; });
    assert.equal(loggedOut, 1); assert.equal(f.calls.api.find(c => c.method === 'DELETE').body.generations.length, 1);
    const view = f.client.snapshot(); posted.resolve({ enrollment: { generation: 'late-generation' } }); await enabling;
    assert.equal(f.client.snapshot(), view); release();
    const hanging = fixture(); await hanging.client.start(); await hanging.client.enable();
    hanging.environment.api = () => new Promise(() => {});
    const stop = ownResearchPushClient(hanging.client); const logout = logoutWithResearchPushCleanup(async () => { loggedOut++; });
    hanging.advance(1000); await logout; assert.equal(loggedOut, 2); stop();
    const failed = fixture(); await failed.client.start(); await failed.client.enable();
    failed.environment.api = async () => { throw Object.assign(new Error('Unavailable'), { status: 503 }); };
    const releaseFailed = ownResearchPushClient(failed.client);
    await logoutWithResearchPushCleanup(async () => { loggedOut++; });
    assert.equal(loggedOut, 3); assert.equal(failed.calls.unsubscribe, 1); releaseFailed();
});

function guardedPage(confirm) {
    const windowListeners = new Map(), documentListeners = new Map(); let controls;
    const window = { confirm, alert() {}, location: { href: 'https://app.example.invalid/dashboard/adviser/submissions/16' },
        addEventListener: (name, handler) => windowListeners.set(name, handler), removeEventListener: name => windowListeners.delete(name) };
    const document = { addEventListener: (name, handler) => documentListeners.set(name, handler), removeEventListener: name => documentListeners.delete(name) };
    class Element { closest(selector) { return selector.startsWith('button') ? {} : null; } }
    const hooks = { ...React, useState: () => [{ dirty: true, session: 1 }, () => {}], useRef: current => ({ current }),
        useMemo: callback => { controls = callback(); return controls; }, useEffect: callback => callback() };
    const Boundary = loadTs('app/dashboard/adviser/submissions/ReviewDraftBoundary.tsx', { react: hooks,
        '@/lib/pwa/research-push-navigation': { PUSH_NAVIGATION_EVENT } }, { window, document, Element, Date }).default;
    Boundary({ children: null }); controls.setDirty(true);
    return { windowListeners, documentListeners, Element };
}
test('actual draft boundary cancels logout before cleanup and guards worker navigation intents', async () => {
    let cleanup = 0, logout = 0;
    const Button = loadTs('components/auth/logout-button.tsx', {
        react: { ...React, useTransition: () => [false, fn => fn()] }, 'next/navigation': { useRouter: () => ({ push() {}, refresh() {} }) },
        '@/lib/actions/auth.action': { logoutAction: async () => { logout++; } },
        '@/lib/pwa/research-push-client': { logoutWithResearchPushCleanup: async action => { cleanup++; await action(); } },
    }).default;
    const button = Button({});
    for (const accepted of [false, true]) {
        const page = guardedPage(() => accepted);
        const click = { defaultPrevented: false, button: 0, target: new page.Element(), preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() {} };
        page.documentListeners.get('click')(click);
        if (!click.defaultPrevented) await button.props.onClick();
        assert.equal(cleanup, accepted ? 1 : 0); assert.equal(logout, accepted ? 1 : 0);
        let navigated = 0;
        const allowed = () => { const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }; page.windowListeners.get(PUSH_NAVIGATION_EVENT)(event); return !event.defaultPrevented; };
        assert.equal(acceptPushNavigation({ type: 'thesishs-research-push', destination: 'adviser-notifications' }, 'https://app.example.invalid/sw.js', 'https://app.example.invalid', () => navigated++, allowed), accepted);
        assert.equal(navigated, accepted ? 1 : 0);
    }
    assert.equal(acceptPushNavigation({ type: 'thesishs-research-push', destination: 'https://evil.invalid' }, 'https://app.example.invalid/sw.js', 'https://app.example.invalid', () => assert.fail(), () => true), false);
});

test('actual enrollment component SSR is browser-free, accessible, and exposes no Admin/Panel UI', () => {
    const Component = loadTs('components/dashboard/research-push-enrollment.tsx', {
        'next/navigation': { useRouter: () => ({ push() {} }) }, '@/lib/pwa/use-display-mode': { useDisplayMode: () => 'unknown' },
        '@/lib/pwa/research-push-client': require('../lib/pwa/research-push-client.ts'),
        '@/lib/pwa/research-push-browser': require('../lib/pwa/research-push-browser.ts'),
        '@/lib/pwa/research-push-navigation': require('../lib/pwa/research-push-navigation.ts'),
        './research-push-enrollment.module.css': { default: { section: 'section', actions: 'actions' } },
    }).default;
    const props = { userId: 1, roleId: 3, expiresAt: 1800000050000, configured: false };
    const html = renderToString(React.createElement(Component, props));
    assert.match(html, /Research Notifications/); assert.match(html, /role="status"/); assert.match(html, /Only one device/);
    assert.doesNotMatch(html, /Enable Notifications<|Disable Notifications</);
    for (const roleId of [1, 4]) assert.equal(renderToString(React.createElement(Component, { ...props, roleId })), '');
});

test('actual enrollment UI renders ready, enabled, disabled, denied, pending and retry states accessibly', () => {
    for (const [phase, canEnable, canDisable] of [['ready', true, false], ['enabled', false, true], ['unavailable', false, false],
        ['denied', false, true], ['busy', false, false], ['error', false, true]]) {
        const view = { phase, canEnable, canDisable, message: 'State: ' + phase };
        class Client { subscribe = () => () => {}; snapshot = () => view; serverSnapshot = () => view; }
        const Component = loadTs('components/dashboard/research-push-enrollment.tsx', {
            'next/navigation': { useRouter: () => ({ push() {} }) }, '@/lib/pwa/use-display-mode': { useDisplayMode: () => 'standalone' },
            '@/lib/pwa/research-push-client': { ResearchPushClient: Client }, '@/lib/pwa/research-push-browser': { browserPushEnvironment: () => ({}) },
            '@/lib/pwa/research-push-navigation': {}, './research-push-enrollment.module.css': { default: {} },
        }).default;
        const html = renderToString(React.createElement(Component, { userId: 1, roleId: 3, configured: true, expiresAt: 1800000050000 }));
        assert.equal(html.includes('>Enable Notifications<'), canEnable); assert.equal(html.includes('>Disable Notifications<'), canDisable);
        assert.match(html, /aria-live="polite"/); assert.ok(html.includes('State: ' + phase));
        if (phase === 'busy') assert.match(html, /aria-busy="true"/);
    }
});

test('browser adapter owns one root registration and preserves exact API/account contract', async () => {
    const registrations = [], fetches = [];
    const registration = { scope: 'https://app.example.invalid/', active: { scriptURL: 'https://app.example.invalid/sw.js' } };
    const navigator = { serviceWorker: { getRegistration: async () => undefined, register: async (...args) => { registrations.push(args); return registration; } } };
    const window = { location: { origin: 'https://app.example.invalid' }, setTimeout, clearTimeout, isSecureContext: true, PushManager: {}, Notification: {}, crypto: webcrypto };
    const browser = loadTs('lib/pwa/research-push-browser.ts', {}, { navigator, window, Notification: { permission: 'default' },
        crypto: webcrypto, TextEncoder, Uint8Array, atob, AbortController, setTimeout, clearTimeout,
        fetch: async (url, options) => { fetches.push({ url, options }); return { ok: true, json: async () => ({ ok: true, available: false, publicKey: null, keyId: null, enrollment: null }) }; } });
    const environment = browser.browserPushEnvironment(17);
    assert.equal(environment.supported(), true);
    await Promise.all([environment.registration(true), environment.registration(true)]);
    assert.equal(registrations.length, 1); assert.equal(registrations[0][0], '/sw.js'); assert.equal(registrations[0][1].scope, '/'); assert.equal(registrations[0][1].updateViaCache, 'none');
    const result = await environment.api('GET', undefined, new AbortController().signal); assert.equal(result.available, false);
    assert.equal(fetches[0].options.headers['X-ThesiSHS-Push-Account'], '17'); assert.equal(fetches[0].options.credentials, 'same-origin'); assert.equal(fetches[0].options.cache, 'no-store');
    assert.equal(fetches[0].options.redirect, 'error');
    assert.equal(browser.applicationServerKey(publicKey).byteLength, 65);
    navigator.serviceWorker.getRegistration = async () => ({ ...registration, active: { scriptURL: 'https://app.example.invalid/foreign.js' } });
    await assert.rejects(environment.registration(true));
});

test('worker headers and P.1 enabled allowance retain no private caching and no default registration', async () => {
    const config = loadTs('next.config.ts', {}, { process: { env: {} } }).default;
    const routes = await config.headers(); const headers = routes.find(route => route.source === '/sw.js').headers;
    assert.ok(headers.some(header => header.key === 'Cache-Control' && header.value.startsWith('no-cache')));
    assert.ok(headers.some(header => header.key === 'X-Content-Type-Options' && header.value === 'nosniff'));
    const source = readFileSync('tests/phase9-pwa.browser.cjs', 'utf8');
    assert.match(source, /else assert\.deepEqual\(storage\.workers, \[\]\)/);
    assert.match(source, /caches: \[\].*local: \['thesishs-theme'\]/);
});
