/* eslint-disable @typescript-eslint/no-require-imports */
// Synthetic HTTP only. The ambient network function is a tripwire, never a fallback.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const originalLoad = Module._load;
const originalFetch = global.fetch;
let ambientCalls = 0;
global.fetch = async () => { ambientCalls++; throw Error('UNEXPECTED_LIVE_FETCH'); };
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (['@/lib/db', 'postgres', 'dotenv/config', 'nodemailer'].includes(id)) throw Error('UNEXPECTED_RUNTIME_IMPORT');
    return originalLoad.call(this, id, ...args);
};
const { createResendVerificationDelivery, createResendVerificationTransport, ResendVerificationDeliveryError } = require('../lib/email/resend-delivery.ts');
const config = { apiKey: 're_synthetic_mock_key', senderEmail: 'verification@example.invalid', verificationOrigin: 'https://preview.example.invalid' };
const recipient = 'synthetic-student@example.invalid';
const token = 'a'.repeat(64);
const accepted = () => Response.json({ id: '00000000-0000-4000-8000-000000000001' });
function harness(respond = accepted) {
    const requests = [];
    let expire, delay, cancelled = false;
    const send = createResendVerificationTransport(async (url, init) => {
        requests.push({ url, init });
        return respond(init);
    }, (milliseconds, callback) => { delay = milliseconds; expire = callback; return () => { cancelled = true; }; });
    return { send: (configuration = config, email = recipient, value = token) => send(configuration, email, value),
        requests, expire: () => expire(), get delay() { return delay; }, get cancelled() { return cancelled; } };
}
function safe(result) {
    const output = JSON.stringify(result);
    for (const privateValue of [config.apiKey, recipient, token, config.verificationOrigin, 'PRIVATE_PROVIDER_RESPONSE'])
        assert.equal(output.includes(privateValue), false);
}

test('Disabled Resend preparation with injected HTTP mocks', async t => {
    await t.test('factory remains disabled with complete configuration in every environment and sends nothing', async () => {
        const previous = { NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV };
        let calls = 0;
        try {
            for (const [mode, vercel] of [['development', 'development'], ['test', 'preview'], ['production', 'preview'], ['production', 'production']]) {
                process.env.NODE_ENV = mode; process.env.VERCEL_ENV = vercel;
                const adapter = createResendVerificationDelivery(config, async () => { calls++; return accepted(); });
                const rejected = error => {
                    assert.ok(error instanceof ResendVerificationDeliveryError);
                    assert.equal(error.outcome, 'disabled'); assert.equal(error.reason, 'disabled');
                    assert.equal(error.cause, undefined); safe(error);
                    return true;
                };
                assert.throws(() => adapter.assertAvailable(), rejected);
                await assert.rejects(adapter.sendVerificationLink(recipient, token), rejected);
            }
        } finally {
            for (const [key, value] of Object.entries(previous))
                if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
        assert.equal(calls, 0); assert.equal(ambientCalls, 0);
    });
    await t.test('one fixed HTTPS request accepts a valid provider acknowledgement without claiming receipt', async () => {
        const h = harness(); const result = await h.send();
        assert.deepEqual(result, { status: 'accepted' }); safe(result);
        assert.equal(h.requests.length, 1); assert.equal(h.delay, 5000); assert.equal(h.cancelled, true);
        const { url, init } = h.requests[0];
        assert.equal(url, 'https://api.resend.com/emails'); assert.equal(init.method, 'POST');
        assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store'); assert.equal(init.credentials, 'omit');
        assert.equal(init.headers.Authorization, `Bearer ${config.apiKey}`);
        const body = JSON.parse(init.body);
        assert.deepEqual(Object.keys(body).sort(), ['from', 'subject', 'text', 'to']);
        assert.deepEqual(body.to, [recipient]); assert.equal(body.from, `ThesiSHS AI <${config.senderEmail}>`);
        const link = new URL(body.text.split('\n').at(-1));
        assert.equal(link.origin, config.verificationOrigin); assert.equal(link.pathname, '/verify-email');
        assert.equal(link.search, ''); assert.equal(new URLSearchParams(link.hash.slice(1)).get('token'), token);
        assert.match(body.text, /explicitly submitting the confirmation/); assert.match(body.text, /60 minutes/);
        assert.equal(init.signal.aborted, true);
    });
    await t.test('invalid or missing server configuration rejects before HTTP, without echoing values', async () => {
        for (const input of [null, {}, { ...config, apiKey: '' }, { ...config, apiKey: 're_value\r\nX-Injected: yes' },
            { ...config, senderEmail: 'Name <someone@example.invalid>' }, { ...config, senderEmail: 'a@example.invalid\n' },
            { ...config, enabled: true }, ...['http://example.invalid', 'https://user:pass@example.invalid', 'https://example.invalid/path',
                'https://example.invalid?recipient=x', 'https://example.invalid/#fragment', 'https://example.invalid:8443',
                ' https://example.invalid', 'https://example.invalid\n', 'not-a-url'].map(verificationOrigin => ({ ...config, verificationOrigin }))]) {
            const h = harness(); const result = await h.send(input);
            assert.deepEqual(result, { status: 'failed', reason: 'configuration' });
            assert.equal(h.requests.length, 0); assert.equal(h.delay, undefined); safe(result);
        }
        const raw = createResendVerificationTransport(async () => { throw Error('MUST_NOT_CALL'); });
        assert.deepEqual(await raw(undefined, recipient, token), { status: 'failed', reason: 'configuration' });
        const withoutTransport = createResendVerificationTransport();
        assert.deepEqual(await withoutTransport(config, recipient, token), { status: 'failed', reason: 'configuration' });
        assert.equal(ambientCalls, 0);
    });
    await t.test('invalid recipient or token never reaches the HTTP mock', async () => {
        for (const [email, value] of [['bad-address', token], [recipient + '\r\nBcc: other@example.invalid', token],
            [recipient, 'a'.repeat(63)], [recipient, token + '\n'], [recipient, 'g'.repeat(64)]]) {
            const h = harness(); const result = await h.send(config, email, value);
            assert.deepEqual(result, { status: 'failed', reason: 'input' }); assert.equal(h.requests.length, 0); safe(result);
        }
    });
    await t.test('explicit provider rejection is distinct from uncertain server outcomes; response bodies are discarded', async () => {
        for (const status of [400, 401, 403, 422, 429, 408, 500, 503, 302]) {
            const h = harness(() => new Response('PRIVATE_PROVIDER_RESPONSE', { status }));
            const result = await h.send();
            assert.deepEqual(result, status >= 400 && status < 500 && status !== 408
                ? { status: 'failed', reason: 'provider-rejected' } : { status: 'uncertain', reason: 'provider' });
            assert.equal(h.requests.length, 1); assert.equal(h.cancelled, true); safe(result);
        }
    });
    await t.test('network or redirect errors are sanitized uncertain outcomes with no retry', async () => {
        const h = harness(() => { throw Error(`PRIVATE_PROVIDER_RESPONSE ${config.apiKey} ${recipient} ${token}`); });
        const result = await h.send();
        assert.deepEqual(result, { status: 'uncertain', reason: 'network' }); safe(result);
        assert.equal(h.requests.length, 1); assert.equal(h.cancelled, true);
    });
    await t.test('deadline bounds a pending request even if the injected transport ignores abort', async () => {
        const h = harness(() => new Promise(() => {})); const pending = h.send();
        assert.equal(h.requests.length, 1); assert.equal(h.delay, 5000);
        h.expire(); const result = await pending;
        assert.deepEqual(result, { status: 'uncertain', reason: 'timeout' }); safe(result);
        assert.equal(h.requests[0].init.signal.aborted, true); assert.equal(h.cancelled, true); assert.equal(h.requests.length, 1);
    });
    await t.test('deadline also bounds a stalled acknowledgement body after headers arrive', async () => {
        let bodyCancelled = false;
        const h = harness(() => new Response(new ReadableStream({ cancel() { bodyCancelled = true; } }), { headers: { 'Content-Type': 'application/json' } }));
        const pending = h.send(); await Promise.resolve(); await Promise.resolve();
        h.expire(); assert.deepEqual(await pending, { status: 'uncertain', reason: 'timeout' });
        assert.equal(bodyCancelled, true); assert.equal(h.requests.length, 1);
    });
    await t.test('malformed, oversized, redirected or foreign acknowledgements never count as acceptance', async () => {
        const responses = [
            () => Response.json({}), () => Response.json({ id: 'not-an-id' }),
            () => new Response('{bad-json', { headers: { 'Content-Type': 'application/json' } }),
            () => new Response('x'.repeat(4097), { headers: { 'Content-Type': 'application/json' } }),
            () => new Response('PRIVATE_PROVIDER_RESPONSE', { headers: { 'Content-Type': 'text/html' } }),
            () => { const response = accepted(); Object.defineProperty(response, 'redirected', { value: true }); return response; },
            () => { const response = accepted(); Object.defineProperty(response, 'url', { value: 'https://foreign.example.invalid/emails' }); return response; },
        ];
        for (const response of responses) {
            const h = harness(response); const result = await h.send();
            assert.deepEqual(result, { status: 'uncertain', reason: 'response' }); safe(result); assert.equal(h.requests.length, 1);
        }
        assert.equal(ambientCalls, 0);
    });
}).finally(() => { Module._load = originalLoad; global.fetch = originalFetch; });
