/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const Module = require('node:module');
let session = { userId: 1, roleId: 3 };
const original = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (id === '@/lib/auth/authorization') return { requireAuth: async () => {
        if (!session) throw new Error('LOGIN_REDIRECT');
        return session;
    } };
    if (id === '@/lib/repositories/user.repository') throw new Error('Dashboard must reuse the authenticated account');
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
        assert.equal(links.filter(link => link.href === '/dashboard/settings').length, 1);
        assert.ok(links.filter(link => /\/dashboard\/(admin|adviser|student)(\/|$)/.test(link.href))
            .every(link => link.href.startsWith(`/dashboard/${path}`)));
    }
    assert.equal(dashboardDestination(4), null);
    assert.deepEqual(dashboardLinks(4).map(link => link.href), ['/dashboard', '/dashboard/repository', '/dashboard/settings']);
    assert.equal(dashboardDestination(99), null);
    assert.deepEqual(dashboardLinks(99), []);
    session = { ...session, email: 'synthetic@example.invalid', exp: 123 };
    assert.deepEqual(await getDashboardAccount(), { id: 1, roleId: 3, email: session.email, expiresAt: 123000 });
    session = { userId: -1, roleId: 3 };
    assert.equal(await getDashboardAccount(), null, 'Malformed identity denied');
    session = null;
    await assert.rejects(getDashboardAccount(), /LOGIN_REDIRECT/);
    console.log('PASS Phase 9.7.2 routing map and authenticated-account reuse; actual active-account checks covered by dashboard-performance/auth tests. No database writes.');
})().catch(error => { console.error(error); process.exitCode = 1; });
