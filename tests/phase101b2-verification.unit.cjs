/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
let session, account, requestHeaders, issued, confirmed, lastAccount, smtpOptions, sent;
const previousEnvironment = { node: process.env.NODE_ENV, enabled: process.env.THESISHS_LOCAL_MAILPIT, origin: process.env.THESISHS_VERIFICATION_ORIGIN };
const originalLoad = Module._load;
const mocks = {
    'server-only': {},
    '@/lib/db': { db: {} }, // Repository boundary stays isolated from runtime connection policy.
    'next/headers': { headers: async () => requestHeaders },
    '@/lib/auth/session': { getSession: async () => session },
    '@/lib/repositories/email-verification.repository': { readVerificationAccount: async id => { lastAccount = id; return account; } },
    '@/lib/services/email-verification.service': {
        requestStudentEmailVerification: async () => { issued++; return { success: true, message: 'Submitted.' }; },
        confirmStudentEmailVerification: async value => { confirmed.push(value); return { success: true, message: 'Confirmed.' }; },
    },
    nodemailer: { createTransport: options => { smtpOptions = options; return { sendMail: async message => { sent.push(message); } }; } },
};
Module._load = function(id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : originalLoad.call(this, id, ...args); };
const { requestVerificationAction: requestAction, confirmVerificationAction: confirmAction } = require('../lib/actions/email-verification.action.ts');
const { createMailpitVerificationDelivery } = require('../lib/email/mailpit-delivery.ts');
const { allowVerificationEndpoint } = require('../lib/auth/verification-endpoint-limit.ts');
const { getCurrentStudentVerificationStatus } = require('../lib/services/email-verification-status.service.ts');
function reset() {
    process.env.NODE_ENV = 'development'; process.env.THESISHS_LOCAL_MAILPIT = 'enabled'; process.env.THESISHS_VERIFICATION_ORIGIN = 'http://127.0.0.1:3031';
    globalThis.verificationEndpointBuckets.clear();
    session = { userId: 21, roleId: 3 }; account = { email: 'synthetic@example.invalid', isActive: true, roleId: 3, emailVerifiedAt: null };
    requestHeaders = new Headers({ host: '127.0.0.1:3031', origin: 'http://127.0.0.1:3031' });
    issued = 0; confirmed = []; lastAccount = undefined; sent = [];
}
test('Verification endpoint/transport boundaries', async t => {
    await t.test('self-only status/action ignore client identifiers and email; verified is controlled', async () => {
        reset(); const form = new FormData(); form.set('userId', '999'); form.set('email', 'other@example.invalid');
        assert.equal((await requestAction({}, form)).success, true); assert.equal(lastAccount, 21); assert.equal(issued, 1);
        assert.deepEqual(await getCurrentStudentVerificationStatus(), { email: account.email, verified: false });
        account.emailVerifiedAt = new Date(); assert.equal((await requestAction({}, form)).message, 'Your email is already verified.'); assert.equal(issued, 1);
    });
    await t.test('anonymous, cross-role, inactive, stale role, missing and malformed session deny before issuance', async () => {
        for (const value of [null, { userId: 21, roleId: 1 }, { userId: 21, roleId: 2 }, { userId: 21, roleId: 4 }, { userId: '21', roleId: 3 }]) {
            reset(); session = value; assert.equal((await requestAction({}, new FormData())).success, false); assert.equal(issued, 0);
        }
        for (const patch of [null, { ...account, isActive: false }, { ...account, roleId: 2 }]) {
            reset(); account = patch; assert.equal((await requestAction({}, new FormData())).success, false); assert.equal(issued, 0);
        }
    });
    await t.test('origin and host are exact; forwarding/IP headers cannot select caller or bypass budgets', async () => {
        for (const patch of [{ origin: 'http://evil.invalid' }, { host: 'evil.invalid' }, { origin: '' }]) {
            reset(); for (const [key, value] of Object.entries(patch)) requestHeaders.set(key, value);
            assert.equal((await requestAction({}, new FormData())).success, false); assert.equal(issued, 0);
        }
        reset(); for (let i = 0; i < 10; i++) {
            requestHeaders.set('x-forwarded-for', `192.0.2.${i}`); assert.equal((await requestAction({}, new FormData())).success, true);
        }
        requestHeaders.set('x-forwarded-for', '198.51.100.1'); assert.equal((await requestAction({}, new FormData())).success, false); assert.equal(issued, 10);
    });
    await t.test('explicit confirmation delegates only the token; requests never create a session', async () => {
        reset(); session = null; const form = new FormData(); form.set('token', 'a'.repeat(64)); form.set('userId', '999');
        assert.equal((await confirmAction({}, form)).success, true); assert.deepEqual(confirmed, ['a'.repeat(64)]);
    });
    await t.test('confirmation budget includes malformed submissions; expiry and map bound are deterministic', async () => {
        reset(); for (let i = 0; i < 30; i++) assert.equal(allowVerificationEndpoint('confirm', undefined, 1000), true);
        assert.equal(allowVerificationEndpoint('confirm', undefined, 1001), false);
        assert.equal(allowVerificationEndpoint('confirm', undefined, 61000), true);
        for (let i = 0; i < 600; i++) allowVerificationEndpoint('request', i + 1, 61001);
        assert.ok(globalThis.verificationEndpointBuckets.size <= 512);
    });
    await t.test('production and disabled execution reject both actions before core processing', async () => {
        for (const mode of ['production', 'test']) {
            reset(); process.env.NODE_ENV = mode;
            assert.equal((await requestAction({}, new FormData())).success, false);
            assert.equal((await confirmAction({}, new FormData())).success, false); assert.equal(issued, 0); assert.equal(confirmed.length, 0);
        }
        reset(); delete process.env.THESISHS_LOCAL_MAILPIT; assert.equal((await requestAction({}, new FormData())).success, false);
    });
    await t.test('SMTP is fixed loopback, synthetic-only, no logging/auth/fallback, fragment links', async () => {
        reset(); const adapter = createMailpitVerificationDelivery(); const token = 'a'.repeat(64);
        await adapter.sendVerificationLink('synthetic@example.invalid', token); assert.equal(sent.length, 1);
        const link = new URL(sent[0].text.split('\n').at(-1)); assert.equal(link.search, '');
        assert.equal(new URLSearchParams(link.hash.slice(1)).get('token'), token);
        assert.equal(smtpOptions.host, '127.0.0.1'); assert.equal(smtpOptions.port, 1025); assert.equal(smtpOptions.auth, undefined);
        assert.equal(smtpOptions.debug, false); assert.equal(smtpOptions.logger, false);
        await assert.rejects(adapter.sendVerificationLink('real@example.com', token)); assert.equal(sent.length, 1);
        process.env.NODE_ENV = 'production'; await assert.rejects(adapter.sendVerificationLink('synthetic@example.invalid', token)); assert.throws(createMailpitVerificationDelivery);
        reset(); process.env.THESISHS_VERIFICATION_ORIGIN = 'https://external.invalid'; assert.throws(createMailpitVerificationDelivery);
    });
}).finally(() => {
    Module._load = originalLoad;
    for (const [key, value] of Object.entries({ NODE_ENV: previousEnvironment.node, THESISHS_LOCAL_MAILPIT: previousEnvironment.enabled, THESISHS_VERIFICATION_ORIGIN: previousEnvironment.origin }))
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
});
