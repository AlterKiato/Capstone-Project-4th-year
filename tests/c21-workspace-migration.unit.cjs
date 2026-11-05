/* eslint-disable @typescript-eslint/no-require-imports */
// Local generated-artifact, source-pin and catalog-contract tests only. No database client/connection.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const ts = require('typescript');
const { readMigrationFiles } = require('drizzle-orm/migrator');
const { getTableConfig, PgDialect } = require('drizzle-orm/pg-core');
const { groupTasks, taskNotes } = require('../db/schema/index.ts');
const { previewMigrationSource, workspaceMigrationSource, verifyPreviewLedger, verifyWorkspaceLedger,
    recognizeWorkspaceLedger, PREVIEW_SOURCE_DIGEST, WORKSPACE_SOURCE_DIGEST } = require('../scripts/preview-migration-source.ts');
const { verifyPreviewSchema, PreviewSchemaAssertion } = require('../scripts/preview-schema.ts');
const parse = path => JSON.parse(readFileSync(path, 'utf8'));
const snapshot = parse('db/migrations/meta/0016_snapshot.json');
const before = parse('db/migrations/meta/0015_snapshot.json');
const journal = parse('db/migrations/meta/_journal.json');
const sqlPath = 'db/migrations/0016_collaborative_research_workspace.sql';
const sql = readFileSync(sqlPath, 'utf8');
const fullLedger = () => workspaceMigrationSource().migrations.map((m, i) => ({ id: i + 1, hash: m.hash, created_at: String(m.folderMillis) }));

test('generated 0016 snapshot adds exactly two tables and preserves every old schema object and snapshot lineage', () => {
    assert.equal(snapshot.prevId, before.id); assert.notEqual(snapshot.id, before.id);
    const { 'public.group_tasks': tasks, 'public.task_notes': notes, ...historicalTables } = snapshot.tables;
    assert.ok(tasks); assert.ok(notes); assert.deepEqual(historicalTables, before.tables);
    for (const key of Object.keys(before).filter(k => !['id', 'prevId', 'tables'].includes(k))) assert.deepEqual(snapshot[key], before[key]);
    assert.equal(Object.keys(snapshot.tables).length, 19);
    assert.equal(journal.entries.length, 17);
    assert.deepEqual(journal.entries.at(-1), { idx: 16, version: '7', when: 1793874420209, tag: '0016_collaborative_research_workspace', breakpoints: true });
    assert.equal(journal.entries.every((e, i) => e.idx === i && (!i || e.when > journal.entries[i - 1].when)), true);
    assert.equal(readdirSync('db/migrations').filter(name => name.endsWith('.sql')).length, 17);
    for (const entry of journal.entries) assert.ok(readFileSync(`db/migrations/${entry.tag}.sql`).length);
});

test('generated SQL is additive-only: two table definitions, six restrictive FKs and three indexes on new tables', () => {
    const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
    assert.equal(statements.length, 11);
    assert.equal(statements.filter(s => /^CREATE TABLE "(?:group_tasks|task_notes)" \(/.test(s)).length, 2);
    assert.equal(statements.filter(s => /^ALTER TABLE "(?:group_tasks|task_notes)" ADD CONSTRAINT /.test(s)).length, 6);
    assert.equal(statements.filter(s => /^CREATE INDEX "[a-z_]+" ON "(?:group_tasks|task_notes)" USING btree /.test(s)).length, 3);
    assert.doesNotMatch(sql, /\b(DROP|TRUNCATE|INSERT|UPDATE(?! no action)|DELETE(?! restrict)|GRANT|CASCADE)\b/i);
    assert.match(sql, /CONSTRAINT "group_tasks_id_paper_unique" UNIQUE\("id","paper_id"\)/);
    assert.match(sql, /FOREIGN KEY \("task_id","paper_id"\) REFERENCES "public"\."group_tasks"\("id","paper_id"\) ON DELETE restrict/);
    assert.equal((sql.match(/ON DELETE restrict ON UPDATE no action/g) ?? []).length, 6);
    assert.equal((sql.match(/CHECK \(/g) ?? []).length, 6);
    assert.equal(createHash('sha256').update(readFileSync(sqlPath)).digest('hex'), '5723a915ab263564713874da26365b58e45d3001b491dec26bcff0170da5fb63');
});

test('generated nullability, defaults, indexes and checks match C2 schema; nullable composite link never nulls the paper', () => {
    const dialect = new PgDialect();
    for (const table of [groupTasks, taskNotes]) {
        const definition = getTableConfig(table), generated = snapshot.tables[`public.${definition.name}`];
        assert.equal(Object.keys(generated.columns).length, definition.columns.length);
        for (const column of definition.columns) {
            const actual = generated.columns[column.name];
            assert.equal(actual.type, column.getSQLType()); assert.equal(actual.notNull, column.notNull); assert.equal(actual.primaryKey, column.primary);
        }
        for (const check of definition.checks) assert.equal(generated.checkConstraints[check.name].value, dialect.sqlToQuery(check.value).sql);
        assert.equal(Object.keys(generated.foreignKeys).length, definition.foreignKeys.length);
        for (const fk of Object.values(generated.foreignKeys)) { assert.equal(fk.onDelete, 'restrict'); assert.equal(fk.onUpdate, 'no action'); }
        assert.deepEqual(Object.values(generated.indexes).map(index => index.columns.map(c => c.expression)),
            definition.indexes.map(index => index.config.columns.map(c => c.name)));
    }
    const tasks = snapshot.tables['public.group_tasks'], notes = snapshot.tables['public.task_notes'];
    assert.equal(tasks.columns.status.default, "'To Do'"); assert.equal(notes.columns.version.default, 1);
    assert.equal(tasks.columns.due_date.type, 'date');
    assert.equal(notes.columns.task_id.notNull, false); assert.equal(notes.columns.paper_id.notNull, true); assert.equal(notes.columns.deleted_at.notNull, false);
    assert.deepEqual(tasks.uniqueConstraints.group_tasks_id_paper_unique.columns, ['id', 'paper_id']);
    assert.deepEqual(notes.foreignKeys.task_notes_task_paper_fk.columnsFrom, ['task_id', 'paper_id']);
    assert.deepEqual(notes.foreignKeys.task_notes_task_paper_fk.columnsTo, ['id', 'paper_id']);
    assert.match(tasks.checkConstraints.group_tasks_description_check.value, /5000/);
    assert.match(notes.checkConstraints.task_notes_content_check.value, /20000/);
    assert.match(notes.checkConstraints.task_notes_version_check.value, /> 0/);
});

test('both exact source identities are verified; old journal prefix serialization preserves the original digest', () => {
    const legacy = previewMigrationSource(), current = workspaceMigrationSource();
    assert.equal(legacy.migrations.length, 16); assert.equal(current.migrations.length, 17);
    assert.equal(legacy.hash, PREVIEW_SOURCE_DIGEST); assert.equal(current.hash, WORKSPACE_SOURCE_DIGEST);
    assert.deepEqual(current.migrations.slice(0, 16), legacy.migrations);
    assert.deepEqual(legacy.snapshot, before); assert.deepEqual(current.snapshot, snapshot);
    const prefixJournal = Buffer.from(JSON.stringify({ ...journal, entries: journal.entries.slice(0, 16) }, null, 2));
    const original = createHash('sha256').update(JSON.stringify(legacy.migrations.map(m => ({ hash: m.hash, when: m.folderMillis }))))
        .update(readFileSync('db/migrations/meta/0015_snapshot.json')).update(prefixJournal).digest('hex');
    assert.equal(original, '37824a5d2df42e54df9e50ee115c6eb7d6c42a94864c99aedfb1d63b4dbf51e0');
});

test('older 16-entry Preview is recognized without accepting an incomplete workspace ledger or widening legacy 0015 approval', () => {
    const ledger = fullLedger(), old = ledger.slice(0, 16);
    assert.deepEqual(recognizeWorkspaceLedger(old), { state: 'pre-workspace', entries: 16 });
    assert.deepEqual(recognizeWorkspaceLedger(ledger), { state: 'workspace-recorded', entries: 17 });
    verifyPreviewLedger(old); verifyPreviewLedger(old.slice(0, 15), 15); verifyWorkspaceLedger(old, 16); verifyWorkspaceLedger(ledger);
    assert.throws(() => verifyWorkspaceLedger(old)); assert.throws(() => verifyPreviewLedger(ledger));
    assert.throws(() => verifyWorkspaceLedger(ledger.slice(0, 15), 15));
    assert.throws(() => verifyPreviewLedger(ledger, 17));
    for (const invalid of [ledger.slice(0, 15), [...ledger, ledger.at(-1)],
        ledger.map((r, i) => i === 16 ? { ...r, hash: 'tampered' } : r), ledger.map((r, i) => i === 3 ? { ...r, created_at: '0' } : r),
        ledger.map((r, i) => i === 5 ? { ...r, id: 5 } : r), ledger.map((r, i) => i === 5 ? { ...r, id: undefined } : r)])
        assert.throws(() => recognizeWorkspaceLedger(invalid));
    const gaps = ledger.map((r, i) => ({ ...r, id: i < 15 ? i + 1 : i + 3 }));
    assert.doesNotThrow(() => verifyWorkspaceLedger(gaps));
});

// Change source artifacts only in memory; even a re-pinned new aggregate cannot hide drift in the legacy prefix.
function sourceDouble({ mutateMigrations = m => m, overrides = {}, repinWorkspace = false } = {}) {
    const migrations = mutateMigrations(structuredClone(readMigrationFiles({ migrationsFolder: 'db/migrations' })));
    const read = path => Object.hasOwn(overrides, path) ? Buffer.from(overrides[path]) : readFileSync(path);
    let code = readFileSync('scripts/preview-migration-source.ts', 'utf8');
    if (repinWorkspace) {
        const hash = createHash('sha256').update(JSON.stringify(migrations.map(m => ({ hash: m.hash, when: m.folderMillis }))))
            .update(read('db/migrations/meta/0016_snapshot.json')).update(read('db/migrations/meta/_journal.json')).digest('hex');
        code = code.replace(WORKSPACE_SOURCE_DIGEST, hash);
    }
    const exported = {};
    vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
        { exports: exported, Buffer, require(name) {
            if (name === 'node:crypto') return { createHash };
            if (name === 'node:fs') return { readFileSync: read };
            if (name === 'drizzle-orm/migrator') return { readMigrationFiles: () => migrations };
            throw new Error('Unexpected source dependency');
        } });
    return exported;
}

test('changed SQL identity, journal, snapshot, missing or extra migrations fail both source readers', () => {
    for (const options of [
        { mutateMigrations: m => { m[16].hash = 'changed'; return m; } },
        { mutateMigrations: m => m.slice(0, 16) }, { mutateMigrations: m => [...m, m.at(-1)] },
        { overrides: { 'db/migrations/meta/0016_snapshot.json': JSON.stringify({ ...snapshot, id: 'changed' }) } },
        { overrides: { 'db/migrations/meta/_journal.json': JSON.stringify({ ...journal, entries: journal.entries.map((e, i) => i === 16 ? { ...e, when: e.when + 1 } : e) }) } },
    ]) {
        const source = sourceDouble(options); assert.throws(() => source.workspaceMigrationSource()); assert.throws(() => source.previewMigrationSource());
    }
});

test('original source pin independently rejects prefix/snapshot/journal tampering even with a matching new source pin', () => {
    const alteredJournal = { ...journal, entries: journal.entries.map((e, i) => i === 2 ? { ...e, when: e.when + 1 } : e) };
    for (const options of [
        { mutateMigrations: m => { m[2].hash = 'changed'; return m; } },
        { overrides: { 'db/migrations/meta/0015_snapshot.json': JSON.stringify({ ...before, id: 'changed' }) } },
        { overrides: { 'db/migrations/meta/_journal.json': JSON.stringify(alteredJournal) } },
    ]) {
        const source = sourceDouble({ ...options, repinWorkspace: true });
        assert.throws(() => source.previewMigrationSource()); assert.throws(() => source.workspaceMigrationSource());
    }
});

test('schema verification selects the historical/current table sets explicitly and denies unexpected tables', async () => {
    const sentinel = new Error('Stop before catalog details/temporary SQL; no database is involved.');
    for (const mode of ['initialize', 'upgrade-0015', 'workspace-baseline', 'upgrade-0016']) {
        const expected = mode === 'upgrade-0016' ? snapshot : before;
        let queries = 0;
        const client = async strings => {
            const text = strings.join(''); queries++;
            if (text.includes('select tablename')) return Object.values(expected.tables).map(t => ({ tablename: t.name })).sort((a, b) => a.tablename.localeCompare(b.tablename));
            throw sentinel;
        };
        await assert.rejects(verifyPreviewSchema(client, mode), error => error === sentinel);
        assert.equal(queries, 2);
    }
    await assert.rejects(verifyPreviewSchema(async () => [{ tablename: 'unexpected' }], 'upgrade-0016'), error => error instanceof PreviewSchemaAssertion);
    let calls = 0;
    await assert.rejects(verifyPreviewSchema(async () => { calls++; return []; }, 'unknown'), /mode refused/);
    assert.equal(calls, 0);
});
