/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const Module = require('node:module');
const React = require('react');
global.React = React;
const { renderToStaticMarkup } = require('react-dom/server');
let session = { userId: 1, roleId: 3 };
let account = { isActive: true, roleId: 3, email: 'settings@example.invalid', passwordHash: 'MUST_NOT_RENDER' };
let fail = false;
const original = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only' || id.endsWith('.css')) return {};
    // Test the page with an injected, validated account; actual auth guards have separate coverage.
    if (id === '@/lib/services/dashboard-account.service') return { getDashboardAccount: async () => {
        if (!session) throw new Error('LOGIN_REDIRECT');
        if (fail || !account?.isActive || account.roleId !== session.roleId || session.userId <= 0) return null;
        return { id: session.userId, roleId: account.roleId, email: account.email };
    } };
    if (id === '@/components/dashboard/app-installation') return () => React.createElement('h2', null, 'App Installation');
    if (id === '@/components/dashboard/research-push-enrollment') return () => React.createElement('h2', null, 'Research Notifications');
    if (id === '@/components/dashboard/dashboard-header') return ({ title }) => React.createElement('h1', null, title);
    if (id === '@/components/auth/logout-button') return () => React.createElement('button', null, 'Logout');
    if (id === '@/components/theme-preferences') return () => React.createElement('fieldset');
    if (id === '@/components/dashboard/sidebar-preferences') return () => React.createElement('h2', null, 'Navigation');
    return original.call(this, id, ...args);
};
const Page = require('../app/dashboard/settings/page.tsx').default;
async function markup() { return renderToStaticMarkup(await Page()); }
(async () => {
    for (const [roleId, label] of [[1, 'Admin'], [2, 'Adviser'], [3, 'Student'], [4, 'Panel']]) {
        session = { userId: 1, roleId }; account = { ...account, roleId };
        const html = await markup();
        assert.match(html, /<h1>Settings<\/h1>/);
        assert.ok(html.includes(`<dd>${label}</dd>`));
        assert.match(html, /<dd>settings@example.invalid<\/dd>/);
        assert.match(html, /<dd>Not provided<\/dd>/);
        assert.match(html, /App Installation/);
        assert.match(html, /Navigation/);
        assert.equal(html.includes('Research Notifications'), roleId === 2 || roleId === 3);
        assert.ok(!/MUST_NOT_RENDER|password|<input/.test(html));
    }
    account = { ...account, roleId: 99 }; session = { userId: 1, roleId: 99 };
    assert.match(await markup(), /Settings unavailable/);
    assert.ok(!(await markup()).includes(account.email));
    session = { userId: 1, roleId: 3 }; account = { ...account, roleId: 3, isActive: false };
    assert.equal(await Page(), null);
    account = { ...account, isActive: true, roleId: 2 };
    assert.equal(await Page(), null, 'Stale role');
    account = null;
    assert.equal(await Page(), null, 'Missing account');
    fail = true;
    assert.equal(await Page(), null, 'Safe database failure');
    session = { userId: -1, roleId: 3 };
    assert.equal(await Page(), null);
    session = null;
    await assert.rejects(Page(), /LOGIN_REDIRECT/);
    // Exercise the reused logout component without changing its existing error behavior.
    let pending = false, task, calls = 0, rejectLogout = false;
    const routes = [];
    const previous = Module._load;
    Module._load = function(id, ...args) {
        if (id === 'react') return { ...React, useTransition: () => [pending, callback => { task = callback(); }] };
        if (id === 'next/navigation') return { useRouter: () => ({ push: path => routes.push(path), refresh: () => routes.push('refresh') }) };
        if (id === '@/lib/actions/auth.action') return { logoutAction: async () => { calls++; if (rejectLogout) throw new Error('synthetic logout failure'); } };
        return previous.call(this, id, ...args);
    };
    const Logout = require('../components/auth/logout-button.tsx').default;
    Logout({}).props.onClick(); await task;
    assert.equal(calls, 1);
    assert.deepEqual(routes, ['/login', 'refresh']);
    pending = true;
    const button = Logout({});
    assert.equal(button.props.disabled, true);
    assert.equal(button.props['aria-label'], 'Logging out...');
    pending = false; rejectLogout = true; routes.length = 0;
    Logout({}).props.onClick();
    await assert.rejects(task, /synthetic logout failure/);
    assert.deepEqual(routes, [], 'Existing action failure propagates without success navigation');
    console.log('PASS Settings four-role rendering, read-only fields, fail-closed boundaries and reused logout pending/success/error behavior; synthetic doubles only');
})().catch(error => { console.error(error); process.exitCode = 1; });
