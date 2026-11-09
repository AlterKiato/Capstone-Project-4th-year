/* eslint-disable @typescript-eslint/no-require-imports */
// Generated artifact and SQL-shape checks only: no database/environment/network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { getTableConfig, PgDialect } = require('drizzle-orm/pg-core');
const { mainAdviserDesignation, coAdviserReviewAssignments } = require('../db/schema/index.ts');
const source = require('../scripts/preview-migration-source.ts');
const parse = path => JSON.parse(readFileSync(path, 'utf8'));
const before = parse('db/migrations/meta/0016_snapshot.json'), after = parse('db/migrations/meta/0017_snapshot.json');
const sql = readFileSync('db/migrations/0017_research_supervision.sql', 'utf8');

test('0017 adds only two tables; old tables, constraints, journal prefix and source identities are preserved', () => {
    const { 'public.main_adviser_designation': main, 'public.co_adviser_review_assignments': assignments, ...old } = after.tables;
    assert.ok(main); assert.ok(assignments); assert.deepEqual(old, before.tables); assert.equal(after.prevId, before.id);
    for (const key of Object.keys(before).filter(k => !['id', 'prevId', 'tables'].includes(k))) assert.deepEqual(after[key], before[key]);
    assert.equal(source.previewMigrationSource().migrations.length, 16); assert.equal(source.workspaceMigrationSource().migrations.length, 17);
    assert.equal(source.supervisionMigrationSource().migrations.length, 18);
    assert.equal(source.previewMigrationSource().hash, source.PREVIEW_SOURCE_DIGEST); assert.equal(source.workspaceMigrationSource().hash, source.WORKSPACE_SOURCE_DIGEST);
    assert.equal(source.supervisionMigrationSource().hash, source.SUPERVISION_SOURCE_DIGEST);
    assert.doesNotMatch(sql, /\b(DROP|TRUNCATE|GRANT|CASCADE)\b|ALTER TABLE "(?:users|research_groups|submissions|feedbacks)"/i);
    assert.equal((sql.match(/CREATE TABLE /g) || []).length, 2);
    assert.equal((sql.match(/INSERT INTO /g) || []).length, 1);
    assert.match(sql, /INSERT INTO "main_adviser_designation" \("id"\) VALUES \(1\)/);
});

test('Drizzle columns, restrictive references, checks and indexes match the generated snapshot', () => {
    const dialect = new PgDialect();
    for (const table of [mainAdviserDesignation, coAdviserReviewAssignments]) {
        const config = getTableConfig(table), generated = after.tables[`public.${config.name}`];
        assert.equal(Object.keys(generated.columns).length, config.columns.length);
        for (const column of config.columns) {
            assert.equal(generated.columns[column.name].type, column.getSQLType()); assert.equal(generated.columns[column.name].notNull, column.notNull);
        }
        for (const check of config.checks) assert.equal(generated.checkConstraints[check.name].value, dialect.sqlToQuery(check.value).sql);
        assert.equal(Object.keys(generated.foreignKeys).length, config.foreignKeys.length);
        for (const fk of Object.values(generated.foreignKeys)) assert.equal(fk.onDelete, 'restrict');
    }
    const main = after.tables['public.main_adviser_designation'], assignments = after.tables['public.co_adviser_review_assignments'];
    assert.match(main.checkConstraints.main_adviser_singleton_check.value, /"id" = 1/);
    assert.equal(main.columns.main_adviser_id.notNull, false); assert.equal(main.columns.revision.default, 0);
    assert.equal(Object.keys(assignments.columns).length, 11); assert.equal(assignments.columns.paper_id, undefined); assert.equal(assignments.columns.version, undefined);
    assert.equal(assignments.indexes.co_adviser_open_assignment_unique.isUnique, true);
    assert.match(assignments.indexes.co_adviser_open_assignment_unique.where, /"state" = 'open'/);
    assert.deepEqual(assignments.indexes.co_adviser_open_assignment_unique.columns.map(c => c.expression), ['submission_id', 'co_adviser_id']);
    assert.match(assignments.checkConstraints.co_adviser_recommendation_check.value, /20000/);
    assert.match(assignments.checkConstraints.co_adviser_lifecycle_check.value, /'open'[\s\S]*'completed'[\s\S]*'closed'/);
});
