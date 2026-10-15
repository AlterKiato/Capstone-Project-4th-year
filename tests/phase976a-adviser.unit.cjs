/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const Module = require('node:module');
let session = { userId: 7, roleId: 2 }, account = { roleId: 2, email: 'synthetic@example.invalid' }, calls = [], fail = false;
const mocks = {
    'server-only': {},
    '@/lib/auth/authorization': { requireRole: async roles => { assert.deepEqual(roles, [2]); if (!session || session.roleId !== 2) throw new Error('redirect'); return session; } },
    './dashboard-account.service': { getDashboardAccount: async () => account },
    '@/lib/repositories/adviser-dashboard.repository': { readAdviserDashboard: async id => { calls.push(id); if (fail) throw new Error('PRIVATE_DB_ERROR'); return { totalGroups: 0, pending: 0, reviewed: 0, attention: [], groups: [] }; } },
};
const original = Module._load;
Module._load = function(id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args); };
const { getAdviserDashboard } = require('../lib/services/adviser-dashboard.service.ts');
async function main() {
    for (const denied of [null, { roleId: 3 }, { roleId: 1 }]) { account = denied; assert.equal(await getAdviserDashboard(), null); }
    account = { roleId: 2, email: 'synthetic@example.invalid' };
    for (const id of [0, -1, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1]) { session.userId = id; assert.equal(await getAdviserDashboard(), null); }
    assert.deepEqual(calls, []);
    for (const role of [1, 3, 4]) { session = { userId: 7, roleId: role }; await assert.rejects(getAdviserDashboard, /redirect/); }
    session = null; await assert.rejects(getAdviserDashboard, /redirect/);
    session = { userId: 7, roleId: 2 };
    assert.equal((await getAdviserDashboard(999)).totalGroups, 0); assert.deepEqual(calls, [7]);
    fail = true; assert.equal(await getAdviserDashboard(), null);
    console.log('PASS session-derived Adviser identity, denied roles/account/invalid IDs, verified empty data and safe query failure.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
