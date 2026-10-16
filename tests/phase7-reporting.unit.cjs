/* eslint-disable @typescript-eslint/no-require-imports */
// node --import tsx tests/phase7-reporting.unit.cjs
const assert = require('node:assert/strict');
const Module = require('node:module');
const React = require('react');
require.extensions['.css'] = module => { module.exports = {}; };
global.React = React;
const { renderToStaticMarkup } = require('react-dom/server');
let session = { userId: 1, roleId: 1 };
let user = { id: 1, roleId: 1, isActive: true };
let queries = 0;
let failure = false;
const query = value => async () => { queries++; if (failure) throw new Error('Private database details'); return value; };
const mocks = {
    '@/components/dashboard/dashboard-header': ({ title }) => React.createElement('h1', null, title),
    'server-only': {},
    '@/lib/auth/session': { getSession: async () => session },
    '@/lib/repositories/user.repository': { findUserById: async () => user },
    'next/navigation': { redirect: path => { throw new Error('REDIRECT ' + path); } },
    '@/lib/repositories/dashboard.repository': {
        countUsers: query(7), countResearchGroups: query(2), countResearchPapers: query(3),
        groupUsersByRole: query([{ roleId: 1, count: 1 }, { roleId: 3, count: 5 }, { roleId: 99, count: 1 }]),
        groupPapersByStatus: query([{ status: 'Draft', count: 2 }, { status: 'Legacy', count: 1 }]),
        getRecentActivities: query([{ id: 1, action: 'Research Submission Approved', createdAt: new Date('2026-10-08T00:00:00Z') }]),
    },
    '@/lib/repositories/repository.repository': { countPublishedResearch: query(0) },
};
const originalLoad = Module._load;
Module._load = function(id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : originalLoad.call(this, id, ...args); };
const { getAdminDashboardStats, getAdminRecentActivities } = require('../lib/services/dashboard.service.ts');
const ReportsPage = require('../app/dashboard/admin/reports/page.tsx').default;
const DashboardPage = require('../app/dashboard/admin/page.tsx').default;
const { AdminActivity, AdminMetrics } = require('../components/dashboard/admin-overview.tsx');
async function denied() {
    const before = queries;
    for (const service of [getAdminDashboardStats, getAdminRecentActivities]) {
        const result = await service();
        assert.equal(result.success, false);
        assert.equal(result.data, undefined);
    }
    assert.equal(queries, before, 'Denied requests must not query metrics or activity');
}
async function main() {
    const stats = (await getAdminDashboardStats()).data;
    assert.equal(stats.usersByRole.reduce((sum, row) => sum + row.count, 0), 7);
    assert.equal(stats.papersByStatus.reduce((sum, row) => sum + row.count, 0), 3);
    assert.equal(stats.totalAdvisers, 0);
    assert.equal(stats.papersByStatus.find(row => row.status === 'Approved').count, 0);
    let html = renderToStaticMarkup(await ReportsPage());
    assert.ok(html.includes('<dt>Total Users</dt><dd>7</dd>'));
    assert.ok(html.includes('<dt>Total Published Repository Papers</dt><dd>0</dd>'));
    assert.ok(html.includes('Research Submission Approved'));
    assert.ok(html.includes('2026-10-08T00:00:00.000Z'));
    console.log('PASS Admin page renders overview, role/status totals and recent activity');
    const dashboard = renderToStaticMarkup(await DashboardPage());
    for (const label of ['Total Users', 'Research Groups', 'Research Papers', 'Published Repository Papers', 'Total Students', 'Total Advisers']) assert.ok(dashboard.includes('<dt>' + label + '</dt>'));
    const empty = renderToStaticMarkup(React.createElement(AdminActivity, { title: 'Recent Activity', result: { success: true, data: [] } }));
    const failed = renderToStaticMarkup(React.createElement(AdminActivity, { title: 'Recent Activity', result: { success: false, message: 'Admin reporting is unavailable.' } }));
    assert.ok(empty.includes('No system activity has been recorded yet.'));
    assert.ok(!failed.includes('No system activity')); assert.ok(failed.includes('role="alert"'));
    const zeros = renderToStaticMarkup(React.createElement(AdminMetrics, { stats: { totalUsers: 0, totalGroups: 0, totalResearchPapers: 0, totalPublishedPapers: 0 } }));
    assert.equal((zeros.match(/<dd>0<\/dd>/g) || []).length, 4);
    assert.ok(html.includes('Oct 8, 2026, 8:00 AM'));
    console.log('PASS Dashboard metrics/secondary totals, valid zeros, independent activity failure/empty states and Philippine timestamps');
    for (const roleId of [2, 3, 4, 999]) {
        session = { userId: 1, roleId }; user = { id: 1, roleId, isActive: true };
        await denied();
        await assert.rejects(ReportsPage(), /REDIRECT \/dashboard/);
    }
    session = null; await denied(); await assert.rejects(ReportsPage(), /REDIRECT \/login/);
    session = { userId: 1, roleId: 1 };
    user = { id: 1, roleId: 3, isActive: true }; await denied();
    user = { id: 1, roleId: 1, isActive: false }; await denied();
    user = undefined; await denied();
    console.log('PASS anonymous/non-Admin page and service denial; stale-role, inactive and missing accounts denied before reporting queries');
    user = { id: 1, roleId: 1, isActive: true }; failure = true;
    html = renderToStaticMarkup(await ReportsPage());
    assert.ok(html.includes('Admin reporting is unavailable.'));
    assert.ok(!html.includes('Private database details'));
    console.log('PASS zero/unknown buckets retained and database failures use safe unavailable state');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
