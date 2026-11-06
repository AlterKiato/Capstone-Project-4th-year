/* eslint-disable @typescript-eslint/no-require-imports */
// Deterministic operator/driver doubles only. No configuration files, credentials or network connections.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const ts = require('typescript');
const source = require('../scripts/preview-migration-source.ts');
const { upgradePreview0016 } = require('../scripts/preview-initialization.ts');
const operator = require('../scripts/initialize-preview-database.ts');
const fullLedger = () => source.workspaceMigrationSource().migrations.map((m, i) => ({ id: i + 1, hash: m.hash, created_at: String(m.folderMillis) }));
const config = { environment: 'preview', purpose: 'operator', identity: 'synthetic-preview', endpoint: { database: 'postgres' },
    observed: { provider: 'supabase', projectRef: 'cbkplqkkjuoglpimwmib', databaseOid: '5', cluster: '7678069749886157684',
        runtimeRole: 'thesishs_preview_runtime', operatorRole: 'thesishs_preview_operator' } };

function relations(entries) {
    const snapshot = entries === 17 ? source.workspaceMigrationSource().snapshot : source.previewMigrationSource().snapshot;
    return Object.values(snapshot.tables).flatMap(t => [
        { relname: t.name, relkind: 'r' },
        ...Object.values(t.columns).filter(c => c.type === 'serial').map(c => ({ relname: `${t.name}_${c.name}_seq`, relkind: 'S' })),
        ...[...Object.keys(t.indexes), ...Object.keys(t.uniqueConstraints), ...Object.keys(t.compositePrimaryKeys),
            ...(Object.values(t.columns).some(c => c.primaryKey) ? [`${t.name}_pkey`] : [])].map(n => ({ relname: n.slice(0, 63), relkind: 'i' })),
    ]).map(r => ({ ...r, relowner: '42', relacl: null })).sort((a, b) => a.relname.localeCompare(b.relname));
}

function databaseDouble(entries = 16) {
    const state = { entries, queries: [], grants: entries === 17 ? 3 : 0, writes: false, savepoints: 0, begins: [],
        pushHash: 'push-records', oldSequence: '9', oldAcl: null, fail: undefined };
    const query = (text, params = []) => {
        state.queries.push({ text, params });
        if (/^\s*(create|alter|drop|insert|grant|lock)/i.test(text)) {
            assert.equal(state.writes, true, 'read-only inspection attempted mutation');
            if (state.fail && text.toLowerCase().includes(state.fail)) throw Error('private SQL failure');
        }
        if (text.includes('insert into "drizzle"."__drizzle_migrations"')) state.entries = 17;
        if (/^grant /i.test(text)) state.grants++;
        if (text.includes('from drizzle.__drizzle_migrations')) return fullLedger().slice(0, state.entries);
        if (text.includes('order by created_at desc')) return [fullLedger()[state.entries - 1]];
        if (text.includes('as database_create')) return [{ schema_usage: true, database_create: false, schema_ddl: false, owns_objects: false,
            owns_database: false, truncate: false, ...(state.boundary ?? {}) }];
        if (text.includes('as readable')) return [{ readable: true, lockable: true, ...(state.authorization ?? {}) }];
        if (text.includes('as widened')) return [{ widened: false }];
        if (text.includes('as grantable')) {
            const name = params[1], privilege = params[2];
            const allowed = name.endsWith('_seq') ? privilege === 'USAGE' : ['SELECT', 'INSERT', 'UPDATE'].includes(privilege) || name === 'public.group_tasks' && privilege === 'DELETE';
            return [{ allowed: state.grants === 3 && allowed || false, grantable: false, ...(state.access ?? {}) }];
        }
        if (text.includes('has_schema_privilege')) return [{ create_public: true, temporary: true, create_ledger: true }];
        if (text.includes('select c.relname,c.relkind')) return (state.relations ?? relations(state.entries)).map(r => r.relname === 'users' ? { ...r, relacl: state.oldAcl } : r);
        if (text.includes('select to_regclass')) return [{ ledger: true }];
        if (text.includes('from pg_sequences')) return relations(state.entries).filter(r => r.relkind === 'S').map(r => ({ sequencename: r.relname, start_value: '1', increment_by: '1' }));
        if (text.includes('last_value::text')) return [{ value: params[0].identifier.includes('group_tasks') || params[0].identifier.includes('task_notes') ? '1' : state.oldSequence, is_called: true }];
        if (text.includes('string_agg')) return [{ hash: params[0].identifier === 'public.push_subscriptions' ? state.pushHash : 'old-records' }];
        if (text.includes('count(*)')) return [{ count: 0 }];
        if (/from pg_proc|from pg_type|information_schema.columns|from pg_constraint|from pg_indexes/.test(text)) return [];
        return [];
    };
    function client() {
        const sql = (parts, ...params) => typeof parts === 'string' ? { identifier: parts } : sql.unsafe(parts.join('?'), params);
        sql.unsafe = (text, params) => {
            const result = Promise.resolve().then(() => query(text, params));
            result.values = () => result;
            return result;
        };
        sql.savepoint = async callback => { state.savepoints++; return callback(sql); };
        return sql;
    }
    const tx = client(), root = client();
    root.options = { parsers: {}, serializers: {} };
    root.begin = async (mode, callback) => {
        if (typeof mode === 'function') { callback = mode; mode = 'write'; }
        state.begins.push(mode);
        const saved = { entries: state.entries, grants: state.grants }, previous = state.writes;
        state.writes = mode === 'write';
        try { return await callback(tx); }
        catch (error) { Object.assign(state, saved); throw error; }
        finally { state.writes = previous; }
    };
    root.end = async () => {};
    return { state, root, tx };
}

// Only identity observation is doubled; target pins and all SQL/operator decisions stay real.
function cliDouble(db, schemaFailure) {
    const output = [], schemaModes = [], connections = [];
    const fakeProcess = { argv: ['node', 'unit'], env: {}, stdin: { isTTY: true }, stdout: { isTTY: true }, exitCode: 0 };
    const exports = {};
    const code = ts.transpileModule(readFileSync('scripts/initialize-preview-database.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, { exports, process: fakeProcess, console: { log: v => output.push(v), error: v => output.push(v) }, require(name) {
        if (name === 'postgres') return (_url, options) => { connections.push(options); return db.root; };
        if (name === '@/lib/db/config') return { databaseConfiguration: () => ({ ...config, url: 'never-connected', options: {} }) };
        if (name === '@/lib/db/identity') return { verifyDatabaseIdentity: async () => ({ database: 'postgres', oid: '5', username: config.observed.operatorRole }) };
        if (name === './preview-schema') return { verifyPreviewSchema: async (_sql, mode) => {
            assert.equal(db.state.writes, true, 'canonical verifier must never run in inspection');
            schemaModes.push(mode);
            if (schemaFailure === mode) throw Error('synthetic schema mismatch');
        } };
        if (name.startsWith('./')) return require(`../scripts/${name.slice(2)}.ts`);
        if (name === 'dotenv') return { config: () => {} };
        return require(name);
    } });
    return { api: exports, output, schemaModes, connections };
}

test('exact source hash, journal identities and bounded legacy/0016 sources remain supported', () => {
    assert.equal(createHash('sha256').update(readFileSync('db/migrations/0016_collaborative_research_workspace.sql')).digest('hex'),
        '5723a915ab263564713874da26365b58e45d3001b491dec26bcff0170da5fb63');
    assert.equal(source.previewMigrationSource().migrations.length, 16);
    assert.equal(source.workspaceMigrationSource().migrations.length, 17);
    source.verifyPreviewLedger(fullLedger().slice(0, 15), 15);
    source.verifyPreviewLedger(fullLedger().slice(0, 16));
    source.verifyWorkspaceLedger(fullLedger());
    assert.throws(() => source.verifyPreviewLedger(fullLedger()));
});

test('0016 orchestration rejects divergent baselines, approvals and replay; preserves durable state without retry', async () => {
    const before = { target: 'target', empty: false, ledger: fullLedger().slice(0, 16), catalog: 'old', preservedData: 'old-data' };
    const after = { ...before, ledger: fullLedger(), catalog: 'new' }, hash = source.WORKSPACE_SOURCE_DIGEST;
    const approval = { execute: true, source: hash, target: before.target };
    let current = before, writes = 0, reads = 0;
    const io = { inspect: async () => { reads++; return current; }, apply: async () => { writes++; current = after; return after.catalog; } };
    for (const bad of [{ ...before, ledger: before.ledger.slice(1) }, after, { ...before, empty: true }, { ...before, preservedData: undefined },
        { ...before, ledger: before.ledger.map((r, i) => i ? r : { ...r, hash: 'changed' }) }]) {
        current = bad; await assert.rejects(upgradePreview0016(io, approval, hash)); assert.equal(writes, 0);
    }
    current = before;
    for (const patch of [{ execute: false }, { source: 'wrong' }, { target: 'wrong' }]) await assert.rejects(upgradePreview0016(io, { ...approval, ...patch }, hash));
    assert.equal(writes, 0);
    assert.equal(await upgradePreview0016(io, approval, hash), 'upgraded-0016-confirmed');
    for (const failure of ['uncertain', 'preservation', 'catalog']) {
        current = before; reads = writes = 0;
        io.apply = async () => { writes++; current = { ...after, ...(failure === 'preservation' ? { preservedData: 'changed' } : failure === 'catalog' ? { catalog: 'changed' } : {}) };
            if (failure === 'uncertain') throw Error('uncertain commit'); return after.catalog; };
        await assert.rejects(upgradePreview0016(io, approval, hash)); assert.equal(writes, 1); assert.equal(reads, 2);
    }
});

test('read-only 16/17 inspections preserve old Web Push, ACL and sequence fingerprints; new sequences excluded', async () => {
    const db = databaseDouble(), cli = cliDouble(db);
    const before = await cli.api.inspectPreviewState(db.tx, config, '0016');
    db.state.entries = 17; db.state.grants = 3;
    const after = await cli.api.inspectPreviewState(db.tx, config, '0016');
    assert.equal(before.preservedData, after.preservedData); assert.notEqual(before.catalog, after.catalog);
    for (const [key, value] of [['pushHash', 'changed'], ['oldSequence', '12'], ['oldAcl', 'widened']]) {
        const old = db.state[key]; db.state[key] = value;
        assert.notEqual((await cli.api.inspectPreviewState(db.tx, config, '0016')).preservedData, before.preservedData);
        db.state[key] = old;
    }
    assert.ok(db.state.queries.every(q => /^select /i.test(q.text)));
});

test('inspection rejects partial object sets, bad ledger, unsafe runtime and missing authorization/grants', async () => {
    for (const mutation of [s => { s.entries = 15; }, s => { s.relations = relations(17); }, s => { s.relations = relations(16).slice(1); },
        s => { s.boundary = { truncate: true }; }, s => { s.boundary = { schema_ddl: true }; }, s => { s.authorization = { lockable: false }; },
        s => { s.entries = 17; s.grants = 0; }]) {
        const db = databaseDouble(), cli = cliDouble(db); mutation(db.state);
        await assert.rejects(cli.api.inspectPreviewState(db.tx, config, '0016'));
        assert.ok(!db.state.queries.some(q => /^grant /i.test(q.text)));
    }
});

test('installed Drizzle/session applies only 0016 in a savepoint; runtime grants follow exact 17 ledger', async () => {
    const db = databaseDouble(); db.state.writes = true;
    assert.equal(db.tx.options, undefined); assert.equal(db.tx.begin, undefined);
    await operator.applyPreviewMigrations(db.tx, db.root.options, true);
    assert.equal(db.state.entries, 17); assert.equal(db.state.savepoints, 1);
    assert.equal(db.state.queries.filter(q => q.text.includes('insert into "drizzle"."__drizzle_migrations"')).length, 1);
    assert.ok(!db.state.queries.some(q => /CREATE TABLE "(?:users|push_subscriptions|role)"/.test(q.text)));
    await operator.grantWorkspaceRuntime(db.tx);
    assert.deepEqual(db.state.queries.filter(q => /^grant /i.test(q.text)).map(q => q.text), [
        'grant select,insert,update,delete on table public.group_tasks to thesishs_preview_runtime',
        'grant select,insert,update on table public.task_notes to thesishs_preview_runtime',
        'grant usage on sequence public.group_tasks_id_seq,public.task_notes_id_seq to thesishs_preview_runtime',
    ]);
    const partial = databaseDouble(); partial.state.writes = true;
    await assert.rejects(operator.grantWorkspaceRuntime(partial.tx));
    assert.ok(!partial.state.queries.some(q => /^grant /i.test(q.text)));
    await assert.rejects(operator.applyPreviewMigrations(db.tx, db.root.options, true)); // no replay
});

test('CLI read-only mode and confirmations fail closed; future execute validates catalog, grants and independent durable state', async () => {
    const db = databaseDouble(), cli = cliDouble(db);
    assert.equal((await cli.api.main(['--inspect-upgrade-0016'])).exitStatus, 0);
    assert.equal(cli.connections[0].connection.default_transaction_read_only, true);
    assert.equal(cli.schemaModes.length, 0); assert.equal(db.state.entries, 16);
    const inspected = JSON.parse(cli.output[0]);
    const confirmations = ['--confirm-target', inspected.target, '--confirm-source', inspected.source,
        '--confirm-data-api-disabled', 'yes', '--confirm-recovery-verified', 'yes'];
    const result = await cli.api.main(['--upgrade-0016', ...confirmations]);
    assert.equal(result.exitStatus, 0); assert.equal(result.commitConfirmed, true);
    assert.deepEqual(cli.schemaModes, ['workspace-baseline', 'upgrade-0016']);
    assert.equal(db.state.entries, 17); assert.equal(db.state.grants, 3);
    assert.equal(db.state.begins.filter(m => m === 'write').length, 1);
    assert.ok(db.state.begins.at(-1).includes('read only'));
    for (const args of [['--upgrade-0016'], ['--inspect-upgrade-0016', ...confirmations],
        ['--upgrade-0016', ...confirmations, '--recovery-mode', 'synthetic-accounts']]) {
        const connections = cli.connections.length;
        const failed = await cli.api.main(args); assert.equal(failed.stage, 'arguments'); assert.equal(failed.exitStatus, 1);
        assert.equal(cli.connections.length, connections);
    }
});

test('schema or grant failure rolls back migration and grants; no replay, private errors suppressed', async () => {
    for (const failure of ['workspace-baseline', 'upgrade-0016', 'grant select,insert,update on table public.task_notes']) {
        const db = databaseDouble(), cli = cliDouble(db, failure);
        await cli.api.main(['--inspect-upgrade-0016']); const inspected = JSON.parse(cli.output[0]);
        db.state.fail = failure.startsWith('grant') ? failure : undefined;
        const result = await cli.api.main(['--upgrade-0016', '--confirm-target', inspected.target, '--confirm-source', inspected.source,
            '--confirm-data-api-disabled', 'yes', '--confirm-recovery-verified', 'yes']);
        assert.equal(result.exitStatus, 1); assert.equal(result.commitConfirmed, false); assert.equal(result.durableInspectionRequired, true);
        assert.equal(db.state.entries, 16); assert.equal(db.state.grants, 0);
        assert.equal(db.state.begins.filter(m => m === 'write').length, 1);
        assert.doesNotMatch(cli.output.join('\n'), /private SQL failure|never-connected/);
    }
});

test('owner no-backup acceptance is explicit, Preview 0016 only, and mutually exclusive with recovery confirmation', async () => {
    const db = databaseDouble(), cli = cliDouble(db);
    await cli.api.main(['--inspect-upgrade-0016']); const inspected = JSON.parse(cli.output[0]);
    const common = ['--confirm-target', inspected.target, '--confirm-source', inspected.source, '--confirm-data-api-disabled', 'yes'];
    for (const args of [
        ['--upgrade-0016', ...common, '--accept-preview-no-backup-risk', 'no'],
        ['--upgrade-0016', ...common, '--accept-preview-no-backup-risk', 'yes', '--confirm-recovery-verified', 'yes'],
        ['--upgrade-0015', ...common, '--accept-preview-no-backup-risk', 'yes'],
        ['--execute', ...common, '--accept-preview-no-backup-risk', 'yes'],
    ]) {
        const connections = cli.connections.length;
        const result = await cli.api.main(args);
        assert.equal(result.exitStatus, 1); assert.equal(result.stage, 'arguments'); assert.equal(cli.connections.length, connections);
    }
    const result = await cli.api.main(['--upgrade-0016', ...common, '--accept-preview-no-backup-risk', 'yes']);
    assert.equal(result.exitStatus, 0); assert.equal(result.commitConfirmed, true);
    assert.ok(cli.output.some(line => line.includes('"verifiedBackup":false') && line.includes('"ownerAcceptedNoBackupRisk":true')));
});
