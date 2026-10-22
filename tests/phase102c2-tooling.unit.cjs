/* eslint-disable @typescript-eslint/no-require-imports */
// Offline schema/tooling contracts only. Never connect to PostgreSQL or Storage.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const read = path => readFileSync(path, 'utf8');
test('0014 snapshot preserves every previous table and adds only intent persistence', () => {
    const before = JSON.parse(read('db/migrations/meta/0013_snapshot.json'));
    const after = JSON.parse(read('db/migrations/meta/0014_snapshot.json'));
    const table = after.tables['public.submission_upload_intents'];
    assert.ok(table); delete after.tables['public.submission_upload_intents'];
    assert.deepEqual(after.tables, before.tables);
    assert.equal(Object.keys(table.foreignKeys).length, 3);
    for (const key of Object.values(table.foreignKeys)) assert.equal(key.onDelete, 'restrict');
    assert.equal(Object.keys(table.uniqueConstraints).length, 4);
    assert.equal(Object.keys(table.checkConstraints).length, 8);
    assert.equal(Object.keys(table.indexes).length, 2);
    assert.match(table.checkConstraints.upload_intent_plan_check.value, /"content_sha256" is not null/);
    const sql = read('db/migrations/0014_submission_upload_intents.sql');
    assert.doesNotMatch(sql, /\b(DROP TABLE|DELETE FROM|TRUNCATE|RENAME TO)\b/i);
    assert.equal([...sql.matchAll(/CREATE TABLE /g)].length, 1);
    assert.equal([...sql.matchAll(/ALTER TABLE "submission_upload_intents"/g)].length, 3);
});
test('operator/replay recognition includes 0014 without weakening full ledger verification', () => {
    const journal = JSON.parse(read('db/migrations/meta/_journal.json'));
    assert.equal(journal.entries.length, 15);
    assert.equal(journal.entries.at(-1).tag, '0014_submission_upload_intents');
    assert.match(read('scripts/database-operator.ts'), /length !== 15/);
    assert.match(read('tests/phase102b-database.acceptance.ts'), /0014_snapshot/);
});
test('cleanup refuses destructive arguments before reading configuration or connecting', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/submission-upload-cleanup.ts', '--execute'], {
        encoding: 'utf8', timeout: 45000,
        env: { ...process.env, THESISHS_DATABASE_ADMIN_URL: '', DATABASE_URL: '', THESISHS_DATABASE_TARGETS_JSON: '' },
    });
    assert.ifError(result.error); assert.equal(result.status, 1);
    assert.match(result.stderr, /no cleanup mutations were performed/);
    assert.equal(result.stdout, '');
    const source = read('scripts/submission-upload-cleanup.ts');
    assert.match(source, /begin\("read only"/);
    assert.match(source, /limit 26/);
    assert.doesNotMatch(source, /\.remove\(|delete from|update submission_upload_intents/i);
});
