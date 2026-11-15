/* eslint-disable @typescript-eslint/no-require-imports */
// Offline source/approval/SQL-selection checks. No database connection or migration execution.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const Module = require('node:module');
const source = require('../scripts/preview-migration-source.ts');
const policy = require('../scripts/preview-email-otp.ts');
const ledger = migrations => migrations.map((m, i) => ({ id: i + 1, hash: m.hash, created_at: String(m.folderMillis) }));
const before = () => ({ empty: false, target: 'approved-preview', catalog: 'before', preservedData: 'preserved', ledger: ledger(source.revisionMigrationSource().migrations) });
const after = () => ({ ...before(), catalog: 'after', ledger: ledger(source.emailOtpMigrationSource().migrations) });

test('0020 adds only two defaulted columns and the five-attempt constraint', () => {
    const old = source.revisionMigrationSource(), next = source.emailOtpMigrationSource();
    assert.equal(old.migrations.length, 20); assert.equal(next.migrations.length, 21);
    assert.deepEqual(next.migrations.slice(0, 20), old.migrations);
    const tables = structuredClone(next.snapshot.tables);
    delete tables['public.users'].columns.email_verification_required;
    delete tables['public.email_verification_requests'].columns.failed_attempts;
    delete tables['public.email_verification_requests'].checkConstraints.email_verification_attempts_check;
    assert.deepEqual(tables, old.snapshot.tables);
    assert.equal(next.snapshot.tables['public.users'].columns.email_verification_required.default, false);
    assert.equal(next.snapshot.tables['public.email_verification_requests'].columns.failed_attempts.default, 0);
    const sql = fs.readFileSync('db/migrations/0020_student_email_otp.sql', 'utf8');
    assert.doesNotMatch(sql, /\b(DROP|DELETE|TRUNCATE|UPDATE|INSERT|GRANT)\b/i);
    assert.equal(sql.split('--> statement-breakpoint').length, 3);
    assert.equal(source.previewMigrationSource().hash, source.PREVIEW_SOURCE_DIGEST);
    assert.equal(old.hash, source.REVISION_SOURCE_DIGEST);
});

test('0020 upgrade policy requires exact approval, baseline and durable preservation', async () => {
    const approval = { execute: true, target: 'approved-preview', source: source.EMAIL_OTP_SOURCE_DIGEST };
    for (const patch of [{ execute: false }, { target: 'production' }, { source: 'wrong' }]) {
        let writes = 0;
        await assert.rejects(policy.upgradePreview0020({ inspect: async () => before(), apply: async () => { writes++; } }, { ...approval, ...patch }, approval.source));
        assert.equal(writes, 0);
    }
    let installed = false;
    assert.equal(await policy.upgradePreview0020({ inspect: async () => installed ? after() : before(), apply: async () => { installed = true; return 'after'; } }, approval, approval.source), 'upgraded-0020-confirmed');
    await assert.rejects(policy.upgradePreview0020({ inspect: async () => after(), apply: async () => { throw Error('Must not reapply'); } }, approval, approval.source));
    let reads = 0, writes = 0;
    await assert.rejects(policy.upgradePreview0020({ inspect: async () => { reads++; return before(); }, apply: async () => { writes++; throw Error('uncertain'); } }, approval, approval.source), /unconfirmed/);
    assert.equal(writes, 1); assert.equal(reads, 2);
    installed = false;
    await assert.rejects(policy.upgradePreview0020({ inspect: async () => installed ? { ...after(), preservedData: 'changed' } : before(), apply: async () => { installed = true; return 'after'; } }, approval, approval.source), /preservation/);
});

test('guarded ORM selection submits only 0020 after validating all 20 predecessors', async () => {
    let submitted;
    const original = Module._load;
    Module._load = function(id, ...args) {
        if (id === 'server-only') return {};
        if (id === 'dotenv' || id === 'dotenv/config') throw Error('Environment loading forbidden');
        if (id === 'drizzle-orm/postgres-js') return { drizzle: () => ({ _: { session: {} } }) };
        if (id === 'drizzle-orm/pg-core') return { ...original.call(this, id, ...args), PgDialect: class { async migrate(migrations) { submitted = migrations; } } };
        return original.call(this, id, ...args);
    };
    try {
        const { applyPreviewMigrations } = require('../scripts/initialize-preview-database.ts');
        const tx = async () => before().ledger;
        tx.savepoint = async () => { throw Error('Database execution forbidden'); };
        await applyPreviewMigrations(tx, {}, '0020');
        assert.equal(submitted.length, 1);
        assert.equal(submitted[0].hash, source.emailOtpMigrationSource().migrations[20].hash);
    } finally { Module._load = original; }
});
