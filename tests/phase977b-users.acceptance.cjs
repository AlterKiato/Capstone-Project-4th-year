/* eslint-disable @typescript-eslint/no-require-imports */
// Real PostgreSQL service/action acceptance. Only uniquely marked synthetic users
// and their own logs are created/deleted; no migrations, storage or certification.
const assert = require('node:assert/strict');
const Module = require('node:module');
require('dotenv/config');
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname, 'localhost'); assert.equal(target.port, '5432'); assert.equal(target.pathname, '/thesishs_ai');
let session;
const original = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (id === '@/lib/auth/session') return { getSession: async () => session };
    return original.call(this, id, ...args);
};
const { db } = require('../lib/db.ts');
const { sql } = require('drizzle-orm');
const service = require('../lib/services/user.service.ts');
const actions = require('../lib/actions/user.action.ts');
const { getEligibilityUI } = require('../lib/services/ai-governance-ui.service.ts');
const { recordAIEligibility } = require('../lib/services/ai-governance.service.ts');
const { updateManagedUserForAdmin } = require('../lib/repositories/user.repository.ts');
const marker = 'PHASE977B_SECURITY_' + Date.now();
const ids = [];
const row = async query => (await db.execute(query))[0];
const list = values => values.length ? sql.join(values.map(value => sql`${value}`), sql`, `) : sql`NULL`;
async function snapshot() { return JSON.stringify(await db.execute(sql`SELECT id,role_id,is_active,updated_at FROM users WHERE id IN (${list(ids)}) ORDER BY id`)); }
async function main() {
    // Connection identity verified before the first write; these records have no real memberships.
    assert.equal((await row(sql`SELECT current_database() name`)).name, 'thesishs_ai');
    const actors = [];
    for (const [role, active] of [[1, true], [1, false], [2, true], [3, true], [4, true], [2, true]]) {
        const user = await row(sql`INSERT INTO users(first_name,last_name,email,password,role_id,is_active) VALUES ('Synthetic',${marker},${marker + ids.length + '@example.invalid'},'!unusable',${role},${active}) RETURNING id,role_id`);
        actors.push(user); ids.push(user.id);
    }
    const [admin, inactive, adviser, student, panel, subject] = actors;
    const as = (actor, claim = actor.role_id) => { session = { userId: actor.id, roleId: claim }; };
    as(admin);
    const users = await service.getUsers(); assert.equal(users.success, true); assert.ok(users.data.some(user => user.id === subject.id)); assert.ok(!JSON.stringify(users.data).includes('password'));
    for (const [actor, claim] of [[inactive, 1], [adviser, 1], [adviser, 2], [student, 3], [panel, 4], [{ id: 2147483647 }, 1], [null, null]]) {
        if (actor) as(actor, claim); else session = null;
        const before = await snapshot();
        assert.equal((await service.getUsers()).success, false);
        for (const change of [service.changeUserRole, actions.changeUserRoleAction]) assert.equal((await change(subject.id, 1)).success, false);
        for (const change of [service.setUserStatus, actions.changeUserStatusAction]) assert.equal((await change(subject.id, false)).success, false);
        assert.equal(await snapshot(), before, 'denied invocation must not mutate synthetic accounts');
    }
    as(admin); const beforeSelf = await snapshot();
    assert.equal((await actions.changeUserRoleAction(admin.id, 2)).success, false);
    assert.equal((await actions.changeUserStatusAction(admin.id, false)).success, false); assert.equal(await snapshot(), beforeSelf);
    for (const role of [1, 3, 4, 2]) { assert.equal((await actions.changeUserRoleAction(subject.id, role)).success, true); assert.equal((await row(sql`SELECT role_id FROM users WHERE id=${subject.id}`)).role_id, role); }
    for (const active of [false, true]) { assert.equal((await actions.changeUserStatusAction(subject.id, active)).success, true); assert.equal((await row(sql`SELECT is_active FROM users WHERE id=${subject.id}`)).is_active, active); }
    const beforeDeniedWrite = await snapshot();
    assert.equal((await updateManagedUserForAdmin(inactive.id, subject.id, { roleId: 1 })).kind, 'denied');
    assert.equal((await updateManagedUserForAdmin(adviser.id, subject.id, { isActive: false })).kind, 'denied');
    assert.equal(await snapshot(), beforeDeniedWrite);
    const account = { firstName: 'Synthetic', lastName: marker, email: marker + 'created@example.invalid', password: 'synthetic-test-password', confirmPassword: 'synthetic-test-password', roleId: 2 };
    for (const roleId of [3, 4]) assert.equal((await actions.createManagedAccountAction({ ...account, roleId })).success, false);
    assert.equal((await actions.createManagedAccountAction({ ...account, confirmPassword: 'mismatch' })).success, false);
    const created = await actions.createManagedAccountAction(account); assert.equal(created.success, true); ids.push(created.data.id);
    const eligibility = await getEligibilityUI({ userId: created.data.id }); assert.equal(eligibility.decision, 'Pending Verification'); assert.equal(eligibility.revision, 0); assert.equal(eligibility.canDecide, false);
    assert.equal((await recordAIEligibility({ userId: created.data.id, decision: 'Eligible', revoke: false, confirmation: true, expectedRevision: 0 })).success, false);
    assert.equal(Number((await row(sql`SELECT count(*) n FROM ai_eligibility_events WHERE user_id IN (${list(ids)})`)).n), 0);
    console.log('PASS real PostgreSQL: direct active/inactive/stale/anonymous/missing/non-Admin boundaries, no denied writes, four existing role choices, activation/deactivation, self denial, transactional actor recheck, creation restrictions, Pending Verification and unauthorized certification denial. No provider calls.');
}
main().catch(error => { console.error(error.name, error.message?.replace(/postgres(?:ql)?:\/\/\S+/g, '[redacted]')); process.exitCode = 1; }).finally(async () => {
    // Recover even a created account whose response was lost, within the exact unique marker.
    const owned = await db.execute(sql`SELECT id FROM users WHERE last_name=${marker} AND email ILIKE ${marker + '%@example.invalid'}`);
    const ownedIds = owned.map(user => user.id);
    if (ownedIds.length) {
        assert.ok(ownedIds.length <= 7);
        await db.execute(sql`DELETE FROM activity_logs WHERE user_id IN (${list(ownedIds)})`);
        await db.execute(sql`DELETE FROM users WHERE id IN (${list(ownedIds)}) AND last_name=${marker}`);
    }
    assert.equal(Number((await row(sql`SELECT count(*) n FROM users WHERE last_name=${marker}`)).n), 0);
    assert.equal(Number((await row(sql`SELECT count(*) n FROM activity_logs WHERE user_id IN (${list(ownedIds)})`)).n), 0);
    console.log('PASS independent fixture cleanup: zero owned synthetic users/logs; no unrelated records or storage touched. Sequences may advance normally.');
    process.exit(process.exitCode || 0);
});
