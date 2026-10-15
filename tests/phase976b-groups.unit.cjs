/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const Module = require('node:module');
let session = { userId: 7, roleId: 2 }, account = { roleId: 2, email: 'synthetic@example.invalid' };
let failure = false, creationFailure = false, created = [], reads = [], invalidations = [];
const groups = [{ id: 1, adviserId: 7, status: 'active' }, { id: 2, adviserId: 8, status: 'active' }, { id: 3, adviserId: 7, status: 'archived' }];
const members = [];
const mocks = {
    'server-only': {},
    'next/cache': { revalidatePath: path => invalidations.push(path) },
    '@/lib/auth/authorization': { requireRole: async roles => { assert.ok(roles.includes(session?.roleId)); return session; } },
    './dashboard-account.service': { getDashboardAccount: async () => account },
    '@/lib/repositories/adviser-groups.repository': {
        readAdviserGroups: async id => { reads.push(id); if (failure) throw Error('PRIVATE_DB'); return []; },
        readEligibleGroupStudents: async id => { reads.push(id); return [{ id: 9 }]; },
    },
    '@/lib/repositories/research-group.repository': { findResearchGroupById: async id => groups.find(group => group.id === id) },
    '@/lib/repositories/user.repository': { findUserById: async id => id === 9 ? { id, roleId: 3 } : id === 10 ? { id, roleId: 2 } : null },
    '@/lib/repositories/group-member.repository': {
        findGroupMember: async (groupId, userId) => members.find(member => member.groupId === groupId && member.userId === userId),
        findGroupsByUserId: async userId => members.filter(member => member.userId === userId).map(member => groups.find(group => group.id === member.groupId)),
        createGroupMember: async (groupId, userId) => { if (failure) throw Error('PRIVATE_DB'); const member = { groupId, userId }; members.push(member); return member; },
        deleteGroupMember: async (groupId, userId) => { const at = members.findIndex(member => member.groupId === groupId && member.userId === userId); members.splice(at, 1); },
    },
    '@/lib/services/research-group.services': {
        createResearchGroup: async (data, id) => { created.push({ data, id }); if (creationFailure) throw Error('PRIVATE_DB'); return { success: true, message: 'Created' }; },
    },
};
const original = Module._load;
Module._load = function(id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args); };
const service = require('../lib/services/adviser-groups.service.ts');
const actions = require('../lib/actions/group-member.action.ts');
const { createResearchGroupAction } = require('../lib/actions/research-group.action.ts');
async function main() {
    for (const denied of [null, { roleId: 3 }]) {
        account = denied; assert.equal(await service.getAdviserGroupsDirectory(), null);
        assert.equal((await actions.addGroupMemberAction(1, 9)).success, false);
    }
    assert.deepEqual(reads, []); account = { roleId: 2, email: 'synthetic@example.invalid' };
    for (const bad of [0, -1, 1.5, NaN, '1', Number.MAX_SAFE_INTEGER + 1]) {
        assert.equal((await actions.addGroupMemberAction(bad, 9)).success, false);
        assert.equal((await actions.removeGroupMemberAction(1, bad)).success, false);
        assert.equal(await service.getEligibleGroupStudents(bad), null);
    }
    for (const role of [1, 3, 4]) { session.roleId = role; assert.equal((await actions.addGroupMemberAction(1, 9)).success, false); }
    session.roleId = 2;
    assert.equal((await actions.addGroupMemberAction(2, 9)).success, false);
    assert.equal((await actions.removeGroupMemberAction(2, 9)).success, false);
    assert.equal(await service.getEligibleGroupStudents(2), null); assert.deepEqual(reads, []);
    assert.deepEqual((await service.getAdviserGroupsDirectory()).groups, []); assert.deepEqual(reads, [7]);
    assert.deepEqual(await service.getEligibleGroupStudents(3), []);
    assert.equal((await actions.addGroupMemberAction(3, 9)).success, false);
    for (const user of [10, 999]) assert.equal((await actions.addGroupMemberAction(1, user)).success, false);
    assert.equal((await actions.addGroupMemberAction(1, 9)).success, true);
    assert.equal((await actions.addGroupMemberAction(1, 9)).success, false);
    // A membership in another active group remains a server-side rejection.
    members[0].groupId = 2; assert.equal((await actions.addGroupMemberAction(1, 9)).success, false);
    members[0].groupId = 3; assert.equal((await actions.addGroupMemberAction(1, 9)).success, true);
    assert.equal((await actions.removeGroupMemberAction(1, 9)).success, true);
    assert.equal((await actions.removeGroupMemberAction(1, 9)).success, false);
    failure = true; assert.equal(await service.getAdviserGroupsDirectory(), null);
    let result = await actions.addGroupMemberAction(1, 9); assert.equal(result.success, false); assert.ok(!result.message.includes('PRIVATE'));
    const form = new FormData();
    result = await createResearchGroupAction(form); assert.equal(result.success, false); assert.equal(created.length, 0); assert.match(result.message, /string/);
    for (const [key, text] of Object.entries({ groupName: 'Synthetic Group', strand: 'STEM', section: 'A', schoolYear: '2026-2027', adviserId: '999' })) form.set(key, text);
    assert.equal((await createResearchGroupAction(form)).success, true); assert.equal(created[0].id, 7); assert.ok(!('adviserId' in created[0].data));
    creationFailure = true; result = await createResearchGroupAction(form); assert.equal(result.success, false); assert.ok(!result.message.includes('PRIVATE'));
    account = null; assert.equal((await createResearchGroupAction(form)).success, false); assert.equal(created.length, 2);
    assert.ok(invalidations.includes('/dashboard/adviser/groups'));
    console.log('PASS active/current Adviser, session identity, validated IDs, foreign ownership denial, real membership service eligibility/duplicates/archival/removal, explicit action failure and creation validation. No database writes.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
