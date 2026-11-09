/* eslint-disable @typescript-eslint/no-require-imports */
// Actual actions/services/repositories with deterministic row-lock/rollback doubles.
// These transaction-contract checks do not establish real PostgreSQL scheduling.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { getTableName, SQL } = require('drizzle-orm');
const { PgDialect } = require('drizzle-orm/pg-core');
const dialect = new PgDialect();
let state, session, failLog, failRefresh, refreshes, transactions, trace;
const queues = new Map();
const locks = new Map();
const account = (id, roleId = 2, isActive = true) => ({ id, roleId, isActive, firstName: 'Synthetic', lastName: String(id), email: `${id}@example.invalid` });
function reset() {
    assert.equal(locks.size, 0);
    state = { users: [account(10, 1), account(11, 1), account(20), account(30), account(40, 2, false), account(50, 3)],
        main_adviser_designation: [{ id: 1, mainAdviserId: null, revision: 0, updatedBy: null, updatedAt: new Date() }],
        activity_logs: [], research_groups: [{ id: 1, adviserId: 20 }, { id: 2, adviserId: 40 }] };
    session = { userId: 10, roleId: 1 }; failLog = failRefresh = false; refreshes = transactions = 0; trace = [];
}
function matches(row, predicate) {
    if (!predicate) return true;
    const query = dialect.sqlToQuery(predicate);
    const key = name => name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const equal = [...query.sql.matchAll(/"\w+"\."(\w+)" = \$(\d+)/g)];
    const inside = query.sql.match(/"\w+"\."(\w+)" in \(([^)]+)\)/);
    assert.ok(equal.length || inside, 'unhandled test predicate');
    return equal.every(([, name, index]) => row[key(name)] === query.params[Number(index) - 1]) &&
        (!inside || [...inside[2].matchAll(/\$(\d+)/g)].some(([, index]) => row[key(inside[1])] === query.params[Number(index) - 1]));
}
async function acquire(key, context) {
    if (context.held.has(key)) return;
    while (locks.has(key)) await new Promise(resolve => { const waiters = queues.get(key) || []; waiters.push(resolve); queues.set(key, waiters); });
    locks.set(key, context); context.held.add(key); trace.push([context.id, key]);
}
function executor(context) {
    const rows = table => {
        const name = getTableName(table);
        return state[name].map(row => context?.changes.get(`${name}:${row.id}`) || row);
    };
    const projected = (row, fields) => fields ? Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, row[column.name.replace(/_([a-z])/g, (_, c) => c.toUpperCase())]])) : structuredClone(row);
    const assertWrite = table => {
        assert.ok(context?.held.has('designation'), 'singleton lock required before protected writes');
        assert.ok([...context.held].some(key => key.startsWith('user:')), 'account lock required');
        assert.ok(['users', 'main_adviser_designation', 'activity_logs'].includes(getTableName(table)), 'historical research writes forbidden');
    };
    return {
        query: { users: { findFirst: async ({ where }) => structuredClone(state.users.find(row => matches(row, where))) } },
        select(fields) {
            let table, predicate, ordered = false;
            const result = () => rows(table).filter(row => matches(row, predicate)).sort((a, b) => a.id - b.id).map(row => projected(row, fields));
            const chain = {
                from(value) { table = value; return chain; }, where(value) { predicate = value; return chain; },
                orderBy(...order) { ordered = order.some(value => dialect.sqlToQuery(value).sql === '"users"."id" asc'); return chain; },
                async for(mode) {
                    assert.ok(context); assert.ok(['update', 'share'].includes(mode));
                    if (getTableName(table) === 'users') {
                        assert.ok(!context.held.has('designation'), 'accounts must be locked before singleton');
                        const ids = rows(table).filter(row => matches(row, predicate)).map(row => row.id).sort((a, b) => a - b);
                        if (ids.length > 1) assert.ok(ordered, 'multiple accounts require explicit ascending lock order');
                        for (const id of ids) await acquire(`user:${id}`, context);
                    } else { assert.equal(getTableName(table), 'main_adviser_designation'); await acquire('designation', context); }
                    return result();
                },
                then(resolve, reject) { return Promise.resolve().then(result).then(resolve, reject); },
            };
            return chain;
        },
        update(table) { return { set(data) { return { where(predicate) { return { returning: async fields => {
            assertWrite(table); const name = getTableName(table);
            return rows(table).filter(row => matches(row, predicate)).map(row => {
                const patch = Object.fromEntries(Object.entries(data).map(([key, value]) => {
                    if (value instanceof SQL) { assert.match(dialect.sqlToQuery(value).sql, /"revision" \+ 1$/); return [key, row.revision + 1]; }
                    return [key, value];
                }));
                const updated = { ...row, ...patch }; context.changes.set(`${name}:${row.id}`, updated); return projected(updated, fields);
            });
        } }; } }; } }; },
        insert(table) { return { values: async data => { assertWrite(table); assert.equal(getTableName(table), 'activity_logs'); if (failLog) throw Error('PRIVATE_LOG_FAILURE'); context.logs.push(data); } }; },
    };
}
const db = {
    ...executor(),
    async transaction(operation) {
        const context = { id: ++transactions, held: new Set(), changes: new Map(), logs: [] };
        try {
            const result = await operation(executor(context));
            for (const [key, row] of context.changes) { const name = key.split(':')[0]; state[name] = state[name].map(existing => existing.id === row.id ? row : existing); }
            state.activity_logs.push(...context.logs); return result;
        } finally {
            for (const key of context.held) { locks.delete(key); const waiting = queues.get(key); queues.delete(key); waiting?.forEach(resolve => resolve()); }
        }
    },
};
const original = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (id === '@/lib/db') return { db };
    if (id === '@/lib/auth/session') return { getSession: async () => session };
    if (id === 'next/cache') return { revalidatePath: path => { assert.equal(path, '/dashboard/admin/users'); refreshes++; if (failRefresh) throw Error('PRIVATE_REFRESH'); } };
    if (id === '@/lib/services/activity-log.service') return { logActivity: async () => {} };
    return original.call(this, id, ...args);
};
const service = require('../lib/services/research-supervision.service.ts');
const actions = require('../lib/actions/research-supervision.action.ts');
const accounts = require('../lib/services/user.service.ts');
const repository = require('../lib/repositories/research-supervision.repository.ts');
const userRepository = require('../lib/repositories/user.repository.ts');
const input = (mainAdviserId = 20, expectedRevision = 0) => ({ mainAdviserId, expectedRevision, confirmed: true });
const designated = () => state.main_adviser_designation[0];

test('initial designation and replacement preserve group ownership and audit old/new identity atomically', async () => {
    reset(); const groups = structuredClone(state.research_groups);
    const before = await service.getMainAdviserConfiguration();
    assert.equal(before.data.current, null); assert.equal(before.data.revision, 0);
    assert.deepEqual(before.data.eligibleAdvisers.map(user => user.id), [20, 30]);
    assert.equal((await actions.designateMainAdviserAction(input())).success, true);
    assert.equal(designated().mainAdviserId, 20); assert.equal(designated().updatedBy, 10); assert.equal(designated().revision, 1);
    assert.equal((await service.designateMainAdviser(input(30, 1))).success, true);
    assert.equal(designated().mainAdviserId, 30); assert.equal(designated().revision, 2);
    assert.equal(state.activity_logs.length, 2); assert.match(state.activity_logs[1].description, /from user 20 to user 30; designation revision 1 -> 2/);
    assert.deepEqual(state.research_groups, groups); assert.equal(refreshes, 1);
    assert.equal((await service.getMainAdviserConfiguration()).data.current.id, 30);
});

test('anonymous, non-Admin, inactive, forged-role and revoked actors are denied at service and repository boundaries', async () => {
    reset();
    for (const claims of [null, { userId: 20, roleId: 2 }, { userId: 50, roleId: 3 }, { userId: 20, roleId: 1 }, { userId: 999, roleId: 1 }]) {
        session = claims;
        assert.equal((await actions.designateMainAdviserAction(input())).success, false);
        assert.equal((await service.getMainAdviserConfiguration()).success, false);
    }
    session = { userId: 10, roleId: 1 }; state.users[0].isActive = false;
    assert.equal((await service.designateMainAdviser(input())).success, false);
    assert.equal((await repository.replaceMainAdviserDesignation(10, 20, 0)).kind, 'denied');
    assert.equal((await repository.replaceMainAdviserDesignation(20, 30, 0)).kind, 'denied');
    assert.equal(await repository.readMainAdviserConfiguration(20), null);
    assert.equal(designated().revision, 0); assert.equal(state.activity_logs.length, 0);
});

test('inactive/non-Adviser/missing targets, malformed requests, unconfirmed and client actor identities cannot designate', async () => {
    reset();
    for (const id of [10, 40, 50, 999]) assert.equal((await service.designateMainAdviser(input(id))).kind, 'ineligible');
    const before = transactions;
    for (const patch of [{ mainAdviserId: '20' }, { mainAdviserId: 0 }, { mainAdviserId: 1.2 }, { mainAdviserId: 2147483648 }, { expectedRevision: -1 }, { expectedRevision: 2147483647 }, { confirmed: false }, { actorId: 11 }])
        assert.equal((await service.designateMainAdviser({ ...input(), ...patch })).kind, 'validation');
    assert.equal(transactions, before); assert.equal(state.activity_logs.length, 0);
});

test('concurrent initial and replacement requests have one winner and stale revisions never overwrite', async () => {
    reset();
    const initial = await Promise.all([repository.replaceMainAdviserDesignation(10, 20, 0), repository.replaceMainAdviserDesignation(11, 30, 0)]);
    assert.deepEqual(initial.map(r => r.kind).sort(), ['stale', 'updated']); assert.equal(designated().revision, 1);
    const next = designated().mainAdviserId === 20 ? 30 : 20;
    const replacement = await Promise.all([repository.replaceMainAdviserDesignation(10, next, 1), repository.replaceMainAdviserDesignation(11, next, 1)]);
    assert.deepEqual(replacement.map(r => r.kind).sort(), ['stale', 'updated']); assert.equal(designated().revision, 2);
    assert.equal((await service.designateMainAdviser(input(20, 0))).kind, 'stale');
    assert.equal((await service.designateMainAdviser(input(next, 2))).kind, 'unchanged');
    assert.equal(state.activity_logs.length, 2);
});

test('current Main cannot be deactivated or demoted; replacing first permits historical Adviser account changes', async () => {
    reset(); await service.designateMainAdviser(input());
    for (const result of [await accounts.setUserStatus(20, false), await accounts.changeUserRole(20, 3)]) { assert.equal(result.success, false); assert.match(result.message, /replacement Main Research Adviser/); }
    assert.equal(state.users.find(u => u.id === 20).isActive, true); assert.equal(state.users.find(u => u.id === 20).roleId, 2);
    assert.equal((await accounts.changeUserRole(20, 2)).success, true);
    await service.designateMainAdviser(input(30, 1));
    assert.equal((await accounts.setUserStatus(20, false)).success, true); assert.equal((await accounts.changeUserRole(20, 3)).success, true);
    assert.equal(designated().mainAdviserId, 30); assert.equal(state.research_groups[0].adviserId, 20);
});

test('designation/account lifecycle interleavings preserve eligible current Main with shared lock ordering', async () => {
    for (const change of [{ isActive: false }, { roleId: 3 }]) for (const lifecycleFirst of [false, true]) {
        reset();
        const designate = () => repository.replaceMainAdviserDesignation(10, 20, 0);
        const lifecycle = () => userRepository.updateManagedUserForAdmin(11, 20, change);
        const result = await Promise.all(lifecycleFirst ? [lifecycle(), designate()] : [designate(), lifecycle()]);
        const current = designated().mainAdviserId;
        if (current !== null) { const user = state.users.find(u => u.id === current); assert.equal(user.isActive, true); assert.equal(user.roleId, 2); assert.ok(result.some(r => r.kind === 'main-adviser-protected')); }
        else assert.ok(result.some(r => r.kind === 'ineligible'));
    }
    reset(); await repository.replaceMainAdviserDesignation(10, 20, 0);
    await Promise.all([repository.replaceMainAdviserDesignation(10, 30, 1), userRepository.updateManagedUserForAdmin(11, 20, { isActive: false })]);
    assert.equal(designated().mainAdviserId, 30); assert.equal(state.users.find(u => u.id === 30).isActive, true);
    assert.ok(trace.some(([, key]) => key === 'designation'));
});

test('audit failure rolls back designation; missing singleton fails closed; refresh failure retains committed success', async () => {
    reset(); failLog = true;
    const result = await actions.designateMainAdviserAction(input()); assert.equal(result.uncertain, true); assert.ok(!JSON.stringify(result).includes('PRIVATE'));
    assert.equal(designated().revision, 0); assert.equal(state.activity_logs.length, 0);
    failLog = false; failRefresh = true;
    const saved = await actions.designateMainAdviserAction(input()); assert.equal(saved.success, true); assert.match(saved.message, /saved.*Reload/); assert.equal(designated().revision, 1);
    state.main_adviser_designation = [];
    assert.equal((await service.getMainAdviserConfiguration()).success, false);
    assert.equal((await service.designateMainAdviser(input(30, 1))).uncertain, true);
    assert.equal((await accounts.setUserStatus(30, false)).uncertain, true);
    assert.equal(state.users.find(u => u.id === 30).isActive, true);
});
