/* eslint-disable @typescript-eslint/no-require-imports */
// Actual pages, directory projection and authorization; synthetic DB/UI boundaries only.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const previousReact = global.React;
global.React = React;
const originalLoad = Module._load;
const previousEnvironment = { NODE_ENV: process.env.NODE_ENV, THESISHS_LOCAL_MAILPIT: process.env.THESISHS_LOCAL_MAILPIT };
let session, account, verificationAccount, statusFailure, directoryFailure, directoryReads, projection, actionState;
const date = new Date('2026-10-30T00:00:00Z');
const directory = [
    { id: 21, roleId: 3, isActive: true, emailVerifiedAt: date },
    { id: 22, roleId: 3, isActive: false, emailVerifiedAt: null },
    ...[1, 2, 4].map(roleId => ({ id: 30 + roleId, roleId, isActive: true, emailVerifiedAt: date })),
].map(row => ({ firstName: 'Synthetic', lastName: `Account${row.id}`, email: `fixture${row.id}@example.invalid`,
    profileImage: null, lastLogin: null, createdAt: date, updatedAt: date, password: 'MUST_NOT_PROJECT', tokenDigest: 'MUST_NOT_PROJECT', ...row }));
const db = {
    query: { users: { findFirst: async options => {
        assert.equal(options.columns.emailVerifiedAt, false, 'Shared account resolution retains its legacy projection');
        return account;
    } } },
    select: columns => {
        projection = columns;
        return { from: () => ({ orderBy: async () => {
            directoryReads++;
            if (directoryFailure) throw Error('PRIVATE_DATABASE_FAILURE');
            return directory.map(row => Object.fromEntries(Object.keys(columns).map(key => [key, row[key]])));
        } }) };
    },
};
const forbidden = () => { throw Error('Unexpected mutation or delivery in isolated UI test'); };
const mocks = {
    'server-only': {},
    react: { ...React, useActionState: action => [actionState, action, false] },
    '@/lib/db': { db },
    '@/lib/auth/session': { getSession: async () => session },
    'next/navigation': { redirect: path => { throw Error(`REDIRECT ${path}`); }, useRouter: () => ({ refresh: forbidden }) },
    '@/lib/repositories/email-verification.repository': { readVerificationAccount: async id => {
        assert.equal(id, session.userId);
        if (statusFailure) throw Error('PRIVATE_STATUS_FAILURE');
        return verificationAccount;
    } },
    '@/lib/services/student-workspace.service': { getStudentWorkspace: async () => ({ email: 'fixture@example.invalid', groups: [], projects: [], submissions: [] }) },
    '@/components/dashboard/dashboard-header': ({ title }) => React.createElement('h1', null, title),
    '@/lib/actions/user.action': { changeUserRoleAction: forbidden, changeUserStatusAction: forbidden },
    '@/lib/actions/email-verification.action': { requestVerificationAction: forbidden, confirmVerificationAction: forbidden },
    '@/lib/services/activity-log.service': { logActivity: forbidden },
    '@/lib/auth/hash': { hashPassword: forbidden },
    './research-dialog': () => null,
    './admin-account-creation': () => null,
    './ai-governance-dialogs': { EligibilityDialog: () => null },
};
Module._load = function(id, ...args) {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.endsWith('.css')) return {};
    if (id === 'postgres' || id === 'dotenv/config') throw Error('Unexpected runtime connection/configuration import');
    return originalLoad.call(this, id, ...args);
};
const StudentPage = require('../app/dashboard/student/page.tsx').default;
const StatusPage = require('../app/dashboard/student/verify-email/page.tsx').default;
const ConfirmPage = require('../app/(auth)/verify-email/page.tsx').default;
const AdminPage = require('../app/dashboard/admin/users/page.tsx').default;
const AdminUsers = require('../components/dashboard/admin-users.tsx').default;
const RequestForm = require('../components/auth/verification-request-form.tsx').default;
const { getUsers } = require('../lib/services/user.service.ts');
const markup = async Page => renderToStaticMarkup(await Page());
function reset(roleId = 3) {
    process.env.NODE_ENV = 'test'; delete process.env.THESISHS_LOCAL_MAILPIT;
    session = { userId: 21, roleId, email: 'stale@example.invalid' };
    account = { id: 21, roleId, isActive: true, email: 'fixture@example.invalid', firstName: 'Synthetic', lastName: 'Account' };
    verificationAccount = { ...account, emailVerifiedAt: null };
    statusFailure = directoryFailure = false; directoryReads = 0; projection = null;
    actionState = { success: false, message: '' };
}
function findComponent(element, component) {
    if (!React.isValidElement(element)) return undefined;
    if (element.type === component) return element;
    return React.Children.toArray(element.props.children).map(child => findComponent(child, component)).find(Boolean);
}

test('Optional verification guidance and read-only Admin directory', async t => {
    await t.test('unverified Student receives nonblocking post-registration guidance and the existing status link', async () => {
        reset(); const html = await markup(StudentPage);
        assert.match(html, /Email verification is optional/);
        assert.match(html, /research workspace remains available/);
        assert.match(html, /href="\/dashboard\/student\/verify-email"/);
        assert.match(html, /when delivery is available/);
        assert.match(html, /Registration does not send one automatically/);
        assert.match(html, /No Research Group Assigned/);
        assert.doesNotMatch(html, /<form|disabled|verify.*before.*research/i);
    });
    await t.test('verified Student has no reminder; status failure is not reported as unverified or a blocked workspace', async () => {
        reset(); verificationAccount.emailVerifiedAt = date;
        assert.doesNotMatch(await markup(StudentPage), /Optional email verification|Check email verification/);
        statusFailure = true; const html = await markup(StudentPage);
        assert.match(html, /verification status is temporarily unavailable/);
        assert.match(html, /No Research Group Assigned/);
        assert.doesNotMatch(html, /Email not verified|PRIVATE_STATUS_FAILURE/);
    });
    await t.test('status page distinguishes unavailable hosted delivery, local capture, and verified state without resend', async () => {
        reset(); let html = await markup(StatusPage);
        assert.match(html, /Email not verified/);
        assert.match(html, /hosted email delivery is not enabled/);
        assert.match(html, /accepted for delivery, not confirmed receipt/);
        assert.match(html, /60 seconds/); assert.match(html, /five emails per rolling hour/);
        assert.match(html, /<button[^>]*disabled=""[^>]*>Request verification email/);
        process.env.NODE_ENV = 'development'; process.env.THESISHS_LOCAL_MAILPIT = 'enabled';
        html = await markup(StatusPage);
        assert.match(html, /captures verification emails in Mailpit/);
        assert.match(html, /No real email is sent/);
        assert.doesNotMatch(html, /disabled=""/);
        verificationAccount.emailVerifiedAt = date;
        html = await markup(StatusPage);
        assert.match(html, /Email verified/); assert.match(html, /ownership has been confirmed/);
        assert.doesNotMatch(html, /<form|Request verification email|Resend verification email/);
    });
    await t.test('request feedback preserves accepted-for-delivery wording and safely renders cooldown failures', () => {
        reset(); actionState = { success: true, message: 'Verification instructions were submitted for delivery. Check your email.' };
        let html = renderToStaticMarkup(React.createElement(RequestForm, { enabled: true }));
        assert.match(html, /submitted for delivery/); assert.match(html, /Resend verification email/);
        assert.doesNotMatch(html, /delivered successfully|email has been sent|inbox delivery confirmed/i);
        actionState = { success: false, message: 'Email verification is unavailable. Wait a minute and try again, or return later.' };
        html = renderToStaticMarkup(React.createElement(RequestForm, { enabled: true }));
        assert.match(html, /Wait a minute/); assert.match(html, /role="status" aria-live="polite"/);
    });
    await t.test('public confirmation retains explicit submission and generic recovery routes without enabling production', async () => {
        reset(); process.env.NODE_ENV = 'production'; process.env.THESISHS_LOCAL_MAILPIT = 'enabled';
        const html = await markup(ConfirmPage);
        assert.match(html, /Opening this page does not verify it/);
        assert.match(html, /confirmation is currently unavailable/);
        assert.match(html, /invalid, expired or already used/);
        assert.match(html, /href="\/login"/); assert.match(html, /href="\/dashboard\/student\/verify-email"/);
        assert.match(html, /<button[^>]*disabled=""[^>]*>Confirm my email/);
    });
    await t.test('actual repository and Admin page project only safe verification labels, separate from activation', async () => {
        reset(1); const tree = await AdminPage();
        assert.equal(directoryReads, 1);
        assert.equal(projection.emailVerifiedAt.name, 'email_verified_at');
        assert.equal(Object.hasOwn(projection, 'password'), false);
        assert.equal(Object.hasOwn(projection, 'tokenDigest'), false);
        const props = findComponent(tree, AdminUsers).props;
        assert.deepEqual(props.users.map(user => user.emailVerification), ['Verified', 'Unverified', 'Not applicable', 'Not applicable', 'Not applicable']);
        assert.equal(props.users[1].isActive, false);
        assert.ok(props.users.every(user => !Object.hasOwn(user, 'emailVerifiedAt')));
        assert.doesNotMatch(JSON.stringify(props), /MUST_NOT_PROJECT|tokenDigest|password/);
        const html = renderToStaticMarkup(tree);
        assert.match(html, /Email verification: Verified/); assert.match(html, /Email verification: Unverified/);
        assert.match(html, /Email verification: Not applicable/); assert.match(html, /Inactive/);
        assert.match(html, /Role filter/); assert.match(html, /Status filter/); assert.match(html, /Manage/);
        assert.doesNotMatch(html, /Resend verification|Reset verification|Mark as verified/);
    });
    await t.test('non-Admin, stale, missing and inactive accounts cannot read directory verification status', async () => {
        for (const roleId of [2, 3, 4]) {
            reset(roleId); const result = await getUsers();
            assert.equal(result.success, false); assert.equal(result.data, undefined);
            await assert.rejects(AdminPage(), /REDIRECT \/dashboard/);
            assert.equal(directoryReads, 0);
        }
        for (const patch of [null, { roleId: 2, isActive: true }, { roleId: 1, isActive: false }]) {
            reset(1); account = patch;
            assert.equal((await getUsers()).data, undefined); assert.equal(directoryReads, 0);
        }
        reset(1); session = null;
        assert.equal((await getUsers()).success, false); assert.equal(directoryReads, 0);
        await assert.rejects(AdminPage(), /REDIRECT \/login/);
    });
    await t.test('directory read failure produces an error, never fabricated Unverified rows', async () => {
        reset(1); directoryFailure = true;
        const html = await markup(AdminPage);
        assert.match(html, /Registered users could not be retrieved/);
        assert.doesNotMatch(html, /Email verification:|PRIVATE_DATABASE_FAILURE/);
    });
}).finally(() => {
    Module._load = originalLoad;
    if (previousReact === undefined) delete global.React; else global.React = previousReact;
    for (const [key, value] of Object.entries(previousEnvironment))
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
});
