/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const Module = require('node:module');
let session = { userId: 1, roleId: 3 };
let account = { isActive: true, roleId: 3, email: 'synthetic@example.invalid' };
let fail = false;
const original = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (id === '@/lib/auth/authorization') return { requireAuth: async () => {
        if (!session) throw new Error('LOGIN_REDIRECT');
        return session;
    } };
    if (id === '@/lib/repositories/user.repository') return { findUserById: async () => {
        if (fail) throw new Error('synthetic database failure');
        return account;
    } };
    return original.call(this, id, ...args);
};
const { getDashboardAccount } = require('../lib/services/dashboard-account.service.ts');
const { dashboardDestination, dashboardLinks } = require('../lib/constants/dashboard-navigation.ts');

(async () => {
    for (const [role, path] of [[1, 'admin'], [2, 'adviser'], [3, 'student']]) {
        assert.equal(dashboardDestination(role), `/dashboard/${path}`);
        const links = dashboardLinks(role);
        assert.equal(links[0].href, `/dashboard/${path}`);
        assert.equal(links[0].exact, true);
        assert.ok(links.every(link => !link.href.includes('settings')));
        assert.ok(links.filter(link => /\/dashboard\/(admin|adviser|student)(\/|$)/.test(link.href))
            .every(link => link.href.startsWith(`/dashboard/${path}`)));
    }
    assert.equal(dashboardDestination(4), null);
    assert.deepEqual(dashboardLinks(4).map(link => link.href), ['/dashboard', '/dashboard/repository']);
    assert.equal(dashboardDestination(99), null);
    assert.deepEqual(dashboardLinks(99), []);
    assert.deepEqual(await getDashboardAccount(), { roleId: 3, email: account.email });
    account = { ...account, isActive: false };
    assert.equal(await getDashboardAccount(), null, 'Inactive account denied');
    account = { ...account, isActive: true, roleId: 2 };
    assert.equal(await getDashboardAccount(), null, 'Stale role denied');
    account = null;
    assert.equal(await getDashboardAccount(), null, 'Missing account denied');
    fail = true;
    assert.equal(await getDashboardAccount(), null, 'Database failure denied safely');
    session = { userId: -1, roleId: 3 };
    assert.equal(await getDashboardAccount(), null, 'Malformed identity denied');
    session = null;
    await assert.rejects(getDashboardAccount(), /LOGIN_REDIRECT/);
    console.log('PASS Phase 9.7.2 routing map and active-account boundary; synthetic doubles only, zero database writes');
})().catch(error => { console.error(error); process.exitCode = 1; });
