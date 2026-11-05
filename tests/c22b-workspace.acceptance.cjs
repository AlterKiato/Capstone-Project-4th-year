/* eslint-disable @typescript-eslint/no-require-imports */
// Explicit local-only C2.2B acceptance. All fixture writes roll back together.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID, randomBytes } = require('node:crypto');
const { lookup } = require('node:dns/promises');
const Module = require('node:module');

if (process.argv.slice(2).join(' ') !== '--execute') {
    console.error('C2.2B requires explicit --execute; no database connection opened.');
    process.exit(1);
}
// Only Next's request-cookie adapter/build marker are replaced, never JWT verification or C2 logic.
let cookieToken;
process.env.JWT_SECRET = randomBytes(48).toString('hex'); // Synthetic process-only signing key.
const originalLoad = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (id === 'next/headers') return { cookies: async () => ({ get: name => name === 'thesishs_session' && cookieToken ? { value: cookieToken } : undefined }) };
    if (id === '@/lib/db') throw new Error('Application database singleton forbidden in rollback harness.');
    return originalLoad.call(this, id, ...args);
};
const postgres = require('postgres');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const { drizzle } = require('drizzle-orm/postgres-js');
const { sql, eq, and, inArray } = require('drizzle-orm');
const schema = require('../db/schema/index.ts');
const { databaseConfiguration } = require('../lib/db/config.ts');
const { getSession } = require('../lib/auth/session.ts');
const { createToken } = require('../lib/auth/jwt.ts');
const { createCollaborativeWorkspaceService } = require('../lib/services/collaborative-workspace.service.ts');
const { createCollaborativeWorkspaceRepository } = require('../lib/repositories/collaborative-workspace.repository.ts');
const { inspectLocalWorkspace, verifyLocalIdentity } = require('../scripts/migrate-local-workspace.ts');
const { verifyWorkspaceLedger } = require('../scripts/preview-migration-source.ts');

const marker = `C22B_${randomUUID().replaceAll('-', '')}`;
const ids = { users: [], research_groups: [], group_members: [], research_papers: [], group_tasks: [], task_notes: [] };
const tests = [];
const rollback = new Error('C2.2B intentional fixture rollback');
const success = result => { assert.equal(result.kind, 'success'); assert.equal(result.success, true); return result.data; };
const denied = result => {
    assert.equal(result.success, false); assert.equal(result.kind, 'unavailable');
    assert.equal(Object.hasOwn(result, 'data'), false);
    assert.equal(result.message, 'This workspace resource is unavailable or you do not have permission.');
};
async function scenario(name, work) {
    try { await work(); tests.push({ name, result: 'PASS' }); console.log(`PASS ${tests.length}: ${name}`); }
    catch (error) { tests.push({ name, result: 'FAIL' }); console.log(`FAIL ${tests.length}: ${name}`); throw error; }
}

async function main() {
    let client, before, after, failure, rolledBack = false, cleanupVerified = false;
    let stage = 'configuration';
    try {
        const config = databaseConfiguration({ ...dotenv.parse(fs.readFileSync('.env')), ...process.env, NODE_ENV: 'test' });
        assert.equal(config.environment, 'development'); assert.equal(config.endpoint.database, 'thesishs_ai');
        assert.equal(config.endpoint.user, 'postgres'); assert.equal(config.endpoint.port, 5432);
        assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(config.endpoint.host));
        const ips = await lookup(config.endpoint.host.replace(/^\[|\]$/g, ''), { all: true });
        assert.ok(ips.length && ips.every(a => a.address === '::1' || /^127\./.test(a.address)));
        client = postgres(config.url, { ...config.options, max: 1, connect_timeout: 3, onnotice: () => {},
            connection: { application_name: 'thesishs_c22b_acceptance', statement_timeout: 10000, lock_timeout: 3000, idle_in_transaction_session_timeout: 30000 } });
        const read = () => client.begin('isolation level repeatable read read only', tx => inspectLocalWorkspace(tx, 17));
        stage = 'identity and ledger'; before = await read();
        const database = drizzle(client, { schema });
        const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
        stage = 'rollback-only fixtures';
        try {
            await database.transaction(async tx => {
                // Reconfirm the authoritative identity/ledger on the exact fixture transaction connection.
                const [identity] = await tx.execute(sql`select current_database() as database,current_user as username,session_user as login,
                    host(inet_server_addr()) as address,inet_server_port() as port,
                    (select oid::text from pg_database where datname=current_database()) as oid,
                    (select system_identifier::text from pg_control_system()) as cluster,
                    (select pg_get_userbyid(datdba) from pg_database where datname=current_database()) as owner,
                    (select rolsuper from pg_roles where rolname=current_user) as superuser`);
                verifyLocalIdentity(identity);
                const ledger = await tx.execute(sql`select id,hash,created_at::text from drizzle.__drizzle_migrations order by created_at,id`);
                verifyWorkspaceLedger(Array.from(ledger));
                await tx.execute(sql`set local search_path=public`);
                const roles = await tx.select().from(schema.role);
                for (const [id, name] of [[1, 'Admin'], [2, 'Adviser'], [3, 'Student'], [4, 'Panel']])
                    assert.ok(roles.some(r => r.id === id && r.name === name));
                const accounts = {};
                for (const [tag, roleId] of [['adviser', 2], ['a', 3], ['b', 3], ['outside', 3]]) {
                    const [user] = await tx.insert(schema.users).values({ firstName: marker, lastName: tag,
                        email: `${marker.toLowerCase()}.${tag}@example.invalid`, password: passwordHash, roleId, isActive: true }).returning();
                    ids.users.push(user.id); accounts[tag] = user;
                }
                const [group] = await tx.insert(schema.researchGroups).values({ groupName: marker, strand: 'TEST', section: 'C22B',
                    schoolYear: 'TEST', adviserId: accounts.adviser.id, status: 'active' }).returning();
                ids.research_groups.push(group.id);
                for (const account of [accounts.a, accounts.b]) {
                    const [member] = await tx.insert(schema.groupMembers).values({ groupId: group.id, userId: account.id }).returning();
                    ids.group_members.push(member.id);
                }
                for (const suffix of ['main', 'identifier-boundary']) {
                    const [paper] = await tx.insert(schema.researchPapers).values({ groupId: group.id, title: `${marker} ${suffix}`, abstract: marker }).returning();
                    ids.research_papers.push(paper.id);
                }
                const [paperId, otherPaperId] = ids.research_papers;
                const tokens = new Map();
                for (const account of [accounts.a, accounts.b, accounts.outside])
                    tokens.set(account.id, await createToken({ userId: account.id, roleId: account.roleId, email: account.email }));
                const actor = account => { cookieToken = tokens.get(account.id); };
                const service = createCollaborativeWorkspaceService({ session: getSession, repository: createCollaborativeWorkspaceRepository(tx) });
                const taskRow = async id => (await tx.select().from(schema.groupTasks).where(eq(schema.groupTasks.id, id)))[0];
                const noteRow = async id => (await tx.select().from(schema.taskNotes).where(eq(schema.taskNotes.id, id)))[0];
                let task, note;
                stage = 'seven service/database scenarios';
                await scenario('Task creation derives creator and default status', async () => {
                    actor(accounts.a); assert.equal((await getSession()).userId, accounts.a.id);
                    const forged = await service.createTask({ paperId, title: 'Forged creator', createdBy: accounts.outside.id });
                    assert.equal(forged.kind, 'validation');
                    task = success(await service.createTask({ paperId, title: `${marker} task` })); ids.group_tasks.push(task.id);
                    const stored = await taskRow(task.id);
                    assert.equal(stored.paperId, paperId); assert.equal(stored.createdBy, accounts.a.id); assert.equal(stored.status, 'To Do');
                    assert.ok(success(await service.listTasks({ paperId })).some(t => t.id === task.id));
                });
                await scenario('Assignment permits eligible group member and rejects external Student', async () => {
                    actor(accounts.a);
                    success(await service.assignTask({ paperId, taskId: task.id, assignedStudentId: accounts.b.id }));
                    denied(await service.assignTask({ paperId, taskId: task.id, assignedStudentId: accounts.outside.id }));
                    assert.equal((await taskRow(task.id)).assignedStudentId, accounts.b.id);
                });
                await scenario('Assigned Student updates In Progress then Done; outsider denied', async () => {
                    actor(accounts.b);
                    for (const status of ['In Progress', 'Done']) {
                        success(await service.updateTaskStatus({ paperId, taskId: task.id, status }));
                        assert.equal((await taskRow(task.id)).status, status);
                    }
                    actor(accounts.outside); denied(await service.updateTaskStatus({ paperId, taskId: task.id, status: 'To Do' }));
                    assert.equal((await taskRow(task.id)).status, 'Done');
                    const [paper] = await tx.select().from(schema.researchPapers).where(eq(schema.researchPapers.id, paperId));
                    assert.equal(paper.status, 'Draft');
                });
                await scenario('Unauthorized and cross-project identifiers reveal no task data or mutation', async () => {
                    actor(accounts.outside);
                    denied(await service.listTasks({ paperId }));
                    denied(await service.editTask({ paperId, taskId: task.id, title: 'Denied', description: null, dueDate: null }));
                    denied(await service.deleteTask({ paperId, taskId: task.id }));
                    actor(accounts.a);
                    assert.deepEqual(success(await service.listTasks({ paperId: otherPaperId })), []);
                    denied(await service.updateTaskStatus({ paperId: otherPaperId, taskId: task.id, status: 'To Do' }));
                    denied(await service.assignTask({ paperId: otherPaperId, taskId: task.id, assignedStudentId: accounts.b.id }));
                    denied(await service.deleteTask({ paperId: otherPaperId, taskId: task.id }));
                    // There is no getTask endpoint; edit/status/delete are the real direct-ID boundary.
                    cookieToken = undefined; denied(await service.listTasks({ paperId }));
                    cookieToken = tokens.get(accounts.a.id) + '.tampered'; denied(await service.listTasks({ paperId }));
                    assert.equal((await taskRow(task.id)).status, 'Done');
                });
                await scenario('Note creation/editing preserves attribution and increments version', async () => {
                    actor(accounts.a);
                    note = success(await service.createNote({ paperId, title: `${marker} note`, content: 'Original note' })); ids.task_notes.push(note.id);
                    const original = await noteRow(note.id);
                    assert.equal(original.paperId, paperId); assert.equal(original.createdBy, accounts.a.id); assert.equal(original.version, 1);
                    note = success(await service.editNote({ paperId, noteId: note.id, expectedVersion: 1, title: note.title, content: 'Edited note' }));
                    let stored = await noteRow(note.id); assert.equal(stored.content, 'Edited note'); assert.equal(stored.version, 2);
                    actor(accounts.b); denied(await service.editNote({ paperId, noteId: note.id, expectedVersion: 2, title: note.title, content: 'Denied member edit' }));
                    actor(accounts.outside); denied(await service.getNote({ paperId, noteId: note.id }));
                    denied(await service.editNote({ paperId, noteId: note.id, expectedVersion: 2, title: note.title, content: 'Denied outsider edit' }));
                    stored = await noteRow(note.id); assert.equal(stored.content, 'Edited note'); assert.equal(stored.version, 2);
                });
                await scenario('Task deletion preserves and unlinks active and soft-deleted notes', async () => {
                    actor(accounts.a);
                    const deletedTask = success(await service.createTask({ paperId, title: `${marker} delete target` })); ids.group_tasks.push(deletedTask.id);
                    const active = success(await service.createNote({ paperId, title: 'Active linked', content: 'Preserve active', taskId: deletedTask.id })); ids.task_notes.push(active.id);
                    actor(accounts.b);
                    const soft = success(await service.createNote({ paperId, title: 'Deleted linked', content: 'Preserve deleted', taskId: deletedTask.id })); ids.task_notes.push(soft.id);
                    success(await service.deleteNote({ paperId, noteId: soft.id, expectedVersion: soft.version }));
                    const prior = await tx.select().from(schema.taskNotes).where(inArray(schema.taskNotes.id, [active.id, soft.id]));
                    actor(accounts.a); success(await service.deleteTask({ paperId, taskId: deletedTask.id }));
                    assert.equal(await taskRow(deletedTask.id), undefined);
                    for (const old of prior) {
                        const stored = await noteRow(old.id); assert.ok(stored); assert.equal(stored.taskId, null);
                        for (const field of ['paperId', 'title', 'content', 'createdBy']) assert.equal(stored[field], old[field]);
                        assert.deepEqual(stored.createdAt, old.createdAt); assert.deepEqual(stored.deletedAt, old.deletedAt); assert.equal(stored.version, old.version + 1);
                    }
                    assert.equal((await noteRow(note.id)).version, 2); assert.equal((await taskRow(task.id)).status, 'Done');
                });
                await scenario('Sequential stale-version edit returns controlled conflict without lost update', async () => {
                    actor(accounts.a); const version = note.version;
                    success(await service.editNote({ paperId, noteId: note.id, expectedVersion: version, title: note.title, content: 'Current winning content' }));
                    const stale = await service.editNote({ paperId, noteId: note.id, expectedVersion: version, title: note.title, content: 'Stale losing content' });
                    assert.equal(stale.kind, 'conflict'); assert.equal(stale.success, false); assert.equal(Object.hasOwn(stale, 'data'), false);
                    const stored = await noteRow(note.id); assert.equal(stored.version, version + 1); assert.equal(stored.content, 'Current winning content');
                });
                assert.equal(tests.length, 7);
                // Fixture ownership is checked before intentional rollback, never a broad DELETE.
                const fixtureAccounts = await tx.select().from(schema.users).where(inArray(schema.users.id, ids.users));
                assert.equal(fixtureAccounts.length, 4); assert.ok(fixtureAccounts.every(u => u.firstName === marker && u.email.endsWith('@example.invalid')));
                assert.equal((await tx.select().from(schema.researchPapers).where(and(inArray(schema.researchPapers.id, ids.research_papers), eq(schema.researchPapers.abstract, marker)))).length, 2);
                throw rollback;
            });
            throw new Error('Fixture transaction unexpectedly committed.');
        } catch (error) {
            if (error === rollback) rolledBack = true;
            else { failure = error; rolledBack = true; } // Installed driver rolls back the rejected callback.
        }
        stage = 'independent cleanup and preservation verification';
        after = await read();
        await client.begin('read only', async tx => {
            for (const [table, owned] of Object.entries(ids)) {
                if (!owned.length) continue;
                const [remaining] = await tx`select count(*)::int as count from ${tx('public.' + table)} where id=any(${owned}::integer[])`;
                assert.equal(remaining.count, 0);
            }
            const [markerCount] = await tx`select count(*)::int as count from public.users where first_name=${marker}`;
            assert.equal(markerCount.count, 0);
        });
        assert.deepEqual(after.identity, before.identity); assert.deepEqual(after.ledger, before.ledger);
        assert.deepEqual(after.rows, before.rows); assert.deepEqual(after.catalog, before.catalog);
        assert.deepEqual(Object.keys(after.sequences), Object.keys(before.sequences));
        const changedSequences = [];
        const fixtureSequences = new Set(Object.keys(ids).map(n => `${n}_id_seq`));
        for (const name of Object.keys(before.sequences)) {
            assert.deepEqual(after.sequences[name].definition, before.sequences[name].definition);
            if (!fixtureSequences.has(name)) assert.deepEqual(after.sequences[name], before.sequences[name]);
            if (JSON.stringify(after.sequences[name].value) !== JSON.stringify(before.sequences[name].value)) changedSequences.push(name);
        }
        cleanupVerified = true;
        console.log(JSON.stringify({ status: failure ? 'FAIL' : 'PASS', tests, identity: after.identity, ledgerEntries: 17,
            fixtures: { accounts: ids.users.length, groups: 1, papers: 2, tasks: ids.group_tasks.length, notes: ids.task_notes.length },
            cleanup: { rolledBack, exactIdsAbsent: true, markerAbsent: true, originalRowsCatalogAndLedgerUnchanged: true, workspaceCountsUnchanged: true, sequencesNotReset: true, changedSequences },
            boundary: 'Real JWT/getSession/service/repository/PostgreSQL; synthetic cookie adapter/key; no HTTP/browser login or restricted-runtime proof' }));
        if (failure) process.exitCode = 1;
    } catch {
        if (Object.values(ids).some(a => a.length) && !cleanupVerified) {
            // Only on unverified cleanup: preserve exact IDs privately; never broaden deletion.
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'thesishs-c22b-'));
            fs.writeFileSync(path.join(dir, 'cleanup-manifest.json'), JSON.stringify({ marker, ids, stage }), { mode: 0o600 });
        }
        console.error(JSON.stringify({ status: tests.some(t => t.result === 'FAIL') ? 'FAIL' : 'BLOCKED', stage,
            completedTests: tests.length, cleanupVerified, fixturesTransactionRejected: rolledBack, secretsRedacted: true }));
        process.exitCode = 1;
    } finally { cookieToken = undefined; await client?.end({ timeout: 2 }); }
}
void main();
