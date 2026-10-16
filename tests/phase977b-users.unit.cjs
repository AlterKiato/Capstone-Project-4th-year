/* eslint-disable @typescript-eslint/no-require-imports */
// Actual actions/services with synthetic persistence failures. No database/network.
const assert = require('node:assert/strict');
const Module = require('node:module');
let session = { userId: 10, roleId: 1 }, account = { id: 10, isActive: true, roleId: 1 };
let reads = 0, writes = 0, failRead = false, failWrite = false, failLog = false, revokedAtWrite = false;
const mocks = {
    'server-only': {},
    '@/lib/auth/session': { getSession: async () => session },
    '@/lib/auth/hash': { hashPassword: async () => 'synthetic-hash' },
    '@/lib/services/activity-log.service': { logActivity: async () => { if (failLog) throw Error('PRIVATE_LOG'); } },
    '@/lib/repositories/user.repository': {
        findUserById: async () => { if (failRead) throw Error('PRIVATE_DB'); return account; },
        findAllUsers: async () => { reads++; return [{ id: 20 }]; },
        findUserByEmail: async () => null,
        createManagedUserForAdmin: async () => { writes++; if (failWrite) throw Error('PRIVATE_WRITE'); return { id: 21 }; },
        updateManagedUserForAdmin: async (actor, id, change) => { assert.equal(actor, 10); writes++; if (failWrite) throw Error('PRIVATE_WRITE'); return revokedAtWrite ? { kind: 'denied' } : { kind: 'updated', user: { id, firstName: 'Synthetic', lastName: 'Target' }, change }; },
    },
};
const original = Module._load;
Module._load = function(id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args); };
const service = require('../lib/services/user.service.ts');
const actions = require('../lib/actions/user.action.ts');
const creation = { firstName: 'Synthetic', lastName: 'Account', email: 'synthetic@example.invalid', password: 'test-only-password', confirmPassword: 'test-only-password', roleId: 2 };
async function main() {
    for (const state of [null, { id: 10, isActive: false, roleId: 1 }, { id: 10, isActive: true, roleId: 2 }, { id: 10, isActive: true, roleId: 3 }]) {
        account = state;
        assert.equal((await service.getUsers()).success, false);
        for (const fn of [service.setUserStatus, actions.changeUserStatusAction]) assert.equal((await fn(20, false)).success, false);
        for (const fn of [service.changeUserRole, actions.changeUserRoleAction]) assert.equal((await fn(20, 2)).success, false);
        assert.equal((await actions.createManagedAccountAction(creation)).success, false);
    }
    account = { id: 10, isActive: true, roleId: 1 };
    for (const state of [null, { userId: 10, roleId: 2 }, { userId: 10, roleId: 3 }, { userId: 0, roleId: 1 }]) {
        session = state; assert.equal((await service.getUsers()).success, false);
        assert.equal((await actions.changeUserRoleAction(20, 2)).success, false);
        assert.equal((await actions.changeUserStatusAction(20, false)).success, false);
    }
    assert.equal(reads, 0); assert.equal(writes, 0);
    session = { userId: 10, roleId: 1 };
    for (const value of [0, -1, 1.5, NaN, '20', 2147483648]) {
        assert.equal((await service.setUserStatus(value, false)).success, false);
        assert.equal((await service.changeUserRole(value, 2)).success, false);
    }
    assert.equal((await service.setUserStatus(20, 'false')).success, false);
    assert.equal((await service.changeUserRole(20, 9)).success, false);
    assert.match((await service.changeUserRole(10, 2)).message, /own role/);
    assert.match((await service.setUserStatus(10, false)).message, /own account status/);
    assert.equal(writes, 0);
    assert.equal((await service.getUsers()).success, true);
    assert.equal((await actions.changeUserRoleAction(20, 4)).success, true);
    assert.equal((await actions.changeUserStatusAction(20, false)).success, true);
    revokedAtWrite = true; assert.equal((await service.changeUserRole(20, 2)).success, false); revokedAtWrite = false;
    failLog = true;
    const committed = await actions.changeUserStatusAction(20, true); assert.equal(committed.success, true); assert.match(committed.message, /Activity recording/);
    failLog = false; failWrite = true;
    for (const result of [await service.changeUserRole(20, 2), await service.setUserStatus(20, true), await service.createManagedAccount(creation)]) {
        assert.equal(result.success, false); assert.equal(result.uncertain, true); assert.match(result.message, /Refresh/); assert.ok(!JSON.stringify(result).includes('PRIVATE'));
    }
    failWrite = false;
    for (const patch of [{ roleId: 3 }, { roleId: 4 }, { confirmPassword: 'mismatch' }, { password: 'short' }, { actorId: 10 }]) assert.equal((await service.createManagedAccount({ ...creation, ...patch })).success, false);
    assert.equal((await service.createManagedAccount(creation)).data.id, 21);
    failRead = true; const failure = await service.getUsers(); assert.equal(failure.success, false); assert.equal(failure.data, undefined); assert.ok(!failure.message.includes('PRIVATE'));
    console.log('PASS direct services/actions: active/current Admin, inactive/stale/missing/anonymous/non-Admin denial before reads/writes, self restrictions, strict validation, valid writes, locked denial, log failure, uncertain writes, creation policy and safe retrieval failure. No database writes.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
