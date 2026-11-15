/* eslint-disable @typescript-eslint/no-require-imports */
// Offline action/SMTP boundary checks. Nodemailer is replaced before import; no network or credentials.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const names = ['NODE_ENV','VERCEL','VERCEL_ENV','THESISHS_EMAIL_OTP_ENABLED','THESISHS_GMAIL_USER','THESISHS_GMAIL_APP_PASSWORD','THESISHS_LOCAL_MAILPIT','THESISHS_VERIFICATION_ORIGIN'];
const before = Object.fromEntries(names.map(name => [name, process.env[name]]));
let issued, confirmed, smtpOptions, sent, fail, closed;
const original = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (id === 'nodemailer') return { createTransport(options) {
        smtpOptions = options; return { close() { closed++; }, async sendMail(message) {
            sent.push(message); if (fail) throw Error('PRIVATE_SMTP_SECRET_AND_OTP');
            return { accepted: [message.to] };
        } };
    } };
    if (id === '@/lib/services/email-verification.service') return {
        requestStudentEmailVerification: async adapter => { adapter.assertAvailable(); issued++; return { success: true }; },
        confirmStudentEmailVerification: async code => { confirmed.push(code); return { success: false }; },
    };
    if (id === 'dotenv/config' || id === 'postgres' || id === '@/lib/db') throw Error('Live adapter forbidden');
    return original.call(this, id, ...args);
};
const actions = require('../lib/actions/email-verification.action.ts');
const { createGmailVerificationDelivery } = require('../lib/email/gmail-delivery.ts');
const { createMailpitVerificationDelivery } = require('../lib/email/mailpit-delivery.ts');
function reset() {
    for (const name of names) delete process.env[name];
    Object.assign(process.env, { NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'preview',
        THESISHS_EMAIL_OTP_ENABLED: 'enabled', THESISHS_GMAIL_USER: 'sender@example.invalid',
        THESISHS_GMAIL_APP_PASSWORD: 'abcdefghijklmnop' });
    issued = closed = 0; confirmed = []; sent = []; fail = false; smtpOptions = null;
}
test('OTP action and email transport boundaries (offline)', async t => {
    await t.test('Gmail is Preview-only, opt-in, fixed TLS SMTP with no logs or retries', async () => {
        reset(); const adapter = createGmailVerificationDelivery();
        await adapter.sendVerificationCode('student@example.invalid', '000007');
        assert.equal(sent.length, 1); assert.match(sent[0].text, /000007.*five minutes/);
        assert.equal(smtpOptions.host, 'smtp.gmail.com'); assert.equal(smtpOptions.port, 465); assert.equal(smtpOptions.secure, true);
        assert.equal(smtpOptions.logger, false); assert.equal(smtpOptions.debug, false);
        assert.equal(smtpOptions.disableFileAccess, true); assert.equal(smtpOptions.disableUrlAccess, true);
        assert.equal(smtpOptions.connectionTimeout, 5000); assert.equal(smtpOptions.greetingTimeout, 5000); assert.equal(smtpOptions.socketTimeout, 10000);
        assert.equal(closed, 1);
        for (const patch of [{ VERCEL_ENV: 'production' }, { VERCEL_ENV: 'development' }, { VERCEL: '' },
            { THESISHS_EMAIL_OTP_ENABLED: '' }, { NODE_ENV: 'development' }, { THESISHS_GMAIL_APP_PASSWORD: 'bad' }]) {
            reset(); Object.assign(process.env, patch);
            assert.throws(() => adapter.assertAvailable());
            await assert.rejects(adapter.sendVerificationCode('student@example.invalid','000007'));
            assert.equal(sent.length, 0);
        }
    });
    await t.test('failed delivery is sanitized, awaited once and closed without automatic retry', async () => {
        reset(); fail = true;
        await assert.rejects(createGmailVerificationDelivery().sendVerificationCode('student@example.invalid','000007'),
            error => !/PRIVATE|000007|abcdefghijklmnop/.test(error.message));
        assert.equal(sent.length, 1); assert.equal(closed, 1);
    });
    await t.test('Mailpit remains loopback-only, synthetic-only and refuses hosted execution', async () => {
        reset(); delete process.env.VERCEL; process.env.NODE_ENV='development'; process.env.THESISHS_LOCAL_MAILPIT='enabled';
        process.env.THESISHS_VERIFICATION_ORIGIN='http://127.0.0.1:3031';
        const adapter=createMailpitVerificationDelivery();
        await adapter.sendVerificationCode('student@example.invalid','000007');
        assert.equal(smtpOptions.host,'127.0.0.1'); assert.equal(smtpOptions.port,1025);
        assert.match(sent[0].text,/000007/); assert.doesNotMatch(sent[0].text,/#token|http/);
        await assert.rejects(adapter.sendVerificationCode('student@gmail.com','000007'));
        process.env.NODE_ENV='production'; assert.throws(createMailpitVerificationDelivery);
    });
    await t.test('request ignores arbitrary form identity; confirmation delegates only the six-digit field', async () => {
        reset(); const form=new FormData(); form.set('userId','999'); form.set('email','attacker@example.invalid'); form.set('code','000007');
        assert.equal((await actions.requestVerificationAction({},form)).success,true); assert.equal(issued,1);
        await actions.confirmVerificationAction({},form); assert.deepEqual(confirmed,['000007']);
        process.env.VERCEL_ENV='production';
        assert.equal((await actions.requestVerificationAction({},form)).success,false); assert.equal(issued,1);
    });
}).finally(() => {
    Module._load=original;
    for(const [name,value] of Object.entries(before)) if(value===undefined) delete process.env[name]; else process.env[name]=value;
});
