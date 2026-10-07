/* eslint-disable @typescript-eslint/no-require-imports */
// node --import tsx tests/phase7-reporting.acceptance.cjs
// Read-only verification against the designated local development database; no fixtures or storage operations.
const assert = require('node:assert/strict');
const Module = require('node:module');
require('dotenv/config');
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, 'localhost');
assert.equal(target.pathname, '/thesishs_ai');
let session = null;
const originalLoad = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (id === '@/lib/auth/session') return { getSession: async () => session };
    return originalLoad.call(this, id, ...args);
};
const { db } = require('../lib/db.ts');
const { sql } = require('drizzle-orm');
const { getAdminDashboardStats, getAdminRecentActivities } = require('../lib/services/dashboard.service.ts');
async function main() {
    const actors = await db.execute(sql`SELECT id, role_id FROM users WHERE is_active = true ORDER BY id`);
    const admin = actors.find(row => row.role_id === 1);
    assert.ok(admin, 'An active local Admin is required');
    session = { userId: admin.id, roleId: 1 };
    const result = await getAdminDashboardStats();
    assert.equal(result.success, true);
    const actual = result.data;
    const [expected] = await db.execute(sql`
        SELECT (SELECT count(*)::int FROM users) AS users,
            (SELECT count(*)::int FROM research_groups) AS groups,
            (SELECT count(*)::int FROM research_papers) AS papers,
            (SELECT count(DISTINCT p.id)::int FROM research_papers p
                JOIN repositories r ON r.paper_id = p.id JOIN research_groups g ON g.id = p.group_id
                WHERE r.is_published = true AND p.status = 'Approved'
                AND EXISTS (SELECT 1 FROM submissions s WHERE s.paper_id = p.id AND s.status = 'Approved')) AS published
    `);
    assert.equal(actual.totalUsers, expected.users);
    assert.equal(actual.totalGroups, expected.groups);
    assert.equal(actual.totalResearchPapers, expected.papers);
    assert.equal(actual.totalPublishedPapers, expected.published);
    const roles = await db.execute(sql`SELECT role_id, count(*)::int AS total FROM users GROUP BY role_id`);
    for (const [id, name] of [[1, 'Admin'], [2, 'Adviser'], [3, 'Student'], [4, 'Panel']]) {
        assert.equal(actual.usersByRole.find(row => row.role === name).count, roles.find(row => row.role_id === id)?.total ?? 0);
    }
    const statuses = await db.execute(sql`SELECT status, count(*)::int AS total FROM research_papers GROUP BY status`);
    for (const name of ['Draft', 'In Review', 'Revision Required', 'Approved']) {
        assert.equal(actual.papersByStatus.find(row => row.status === name).count, statuses.find(row => row.status === name)?.total ?? 0);
    }
    assert.equal(actual.usersByRole.reduce((sum, row) => sum + row.count, 0), expected.users);
    assert.equal(actual.papersByStatus.reduce((sum, row) => sum + row.count, 0), expected.papers);
    console.log('PASS live Admin aggregates match independent SQL counts, roles, statuses and distinct eligible published papers');
    const activities = await getAdminRecentActivities();
    assert.equal(activities.success, true);
    const expectedActivity = await db.execute(sql`SELECT id, action, to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS') AS created_at FROM activity_logs ORDER BY created_at DESC, id DESC LIMIT 5`);
    assert.deepEqual(activities.data.map(row => row.id), expectedActivity.map(row => row.id));
    for (const [index, row] of activities.data.entries()) {
        assert.deepEqual(Object.keys(row).sort(), ['action', 'createdAt', 'id']);
        assert.equal(row.action, expectedActivity[index].action);
        assert.equal(row.createdAt.getTime(), new Date(expectedActivity[index].created_at + 'Z').getTime());
    }
    console.log('PASS bounded deterministic recent activity contains no user details, descriptions or IP addresses');
    for (const roleId of [2, 3, 4]) {
        const actor = actors.find(row => row.role_id === roleId);
        assert.ok(actor, 'An active local account is required for role ' + roleId);
        // Claiming Admin in a stale session still fails the database-role check.
        for (const claimedRole of [roleId, 1]) {
            session = { userId: actor.id, roleId: claimedRole };
            assert.equal((await getAdminDashboardStats()).success, false);
            assert.equal((await getAdminRecentActivities()).success, false);
        }
    }
    session = null;
    assert.equal((await getAdminDashboardStats()).success, false);
    console.log('PASS actual Adviser/Student/Panel accounts denied, including stale Admin claims, and anonymous denied');
    if (process.env.PHASE7_BASE_URL) {
        const base = new URL(process.env.PHASE7_BASE_URL);
        assert.ok(['localhost', '127.0.0.1'].includes(base.hostname), 'HTTP acceptance must remain local');
        const { createToken } = require('../lib/auth/jwt.ts');
        const request = async (actor, roleId = actor?.role_id) => {
            const token = actor ? await createToken({ userId: actor.id, roleId, email: 'phase7-test@example.invalid' }) : null;
            return fetch(new URL('/dashboard/admin/reports', base), {
                redirect: 'manual', headers: token ? { Cookie: 'thesishs_session=' + token } : {},
            });
        };
        const response = await request(admin);
        assert.equal(response.status, 200);
        const html = await response.text();
        const text = html.replace(/<[^>]*>/g, '');
        assert.ok(text.includes('Total Users: ' + expected.users));
        assert.ok(text.includes('Total Published Repository Papers: ' + expected.published));
        assert.ok(text.includes('Research Papers by Status'));
        assert.ok(!html.includes('research-submissions'));
        for (const roleId of [2, 3, 4]) {
            const actor = actors.find(row => row.role_id === roleId);
            const denied = await request(actor);
            assert.equal(denied.status, 307);
            assert.equal(new URL(denied.headers.get('location'), base).pathname, '/dashboard');
            const stale = await request(actor, 1);
            assert.equal(stale.status, 200);
            const body = await stale.text();
            assert.ok(body.includes('Admin reporting is unavailable.'));
            assert.ok(!body.includes('Total Published Repository Papers:'));
        }
        const anonymous = await request(null);
        assert.equal(anonymous.status, 307);
        assert.equal(new URL(anonymous.headers.get('location'), base).pathname, '/login');
        console.log('PASS actual HTTP Admin reports render correct totals; other roles/anonymous redirect and stale Admin claims disclose no reporting data');
    }
}
main().then(() => process.exit(0)).catch(error => {
    console.error('FAIL Phase 7 acceptance: ' + error.name);
    console.error(error.stack.split('\n').filter(line => line.trim().startsWith('at ')).join('\n'));
    process.exit(1);
});
