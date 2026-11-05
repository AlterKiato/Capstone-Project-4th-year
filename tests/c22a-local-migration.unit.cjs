/* eslint-disable @typescript-eslint/no-require-imports */
// Pure guards/catalog doubles only. Never connects, backs up, or applies SQL.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { verifyLocalIdentity, verifyLocalLedger, localPendingSource, verifyLocalPreservation, verifyLocalBackup } = require('../scripts/migrate-local-workspace.ts');
const { verifyLocalWorkspaceSchema, verifyPreviewSchema } = require('../scripts/preview-schema.ts');
const { workspaceMigrationSource, previewMigrationSource } = require('../scripts/preview-migration-source.ts');
const identity = () => ({ database: 'thesishs_ai', oid: '16387', cluster: '7652422818440234372', port: 5432, address: '::1', username: 'postgres', login: 'postgres', owner: 'postgres', superuser: true });
const ledger = () => workspaceMigrationSource().migrations.map((m, i) => ({ id: i + 1, hash: m.hash, created_at: String(m.folderMillis) }));
const state = () => ({ target: 'target', source: 'source', ledger: ledger().slice(0, 15), rows: { users: { count: 10, hash: 'rows' } }, catalog: { users: 'catalog' }, sequences: { users_id_seq: { value: '11', called: true } } });

test('local identity refuses other databases, remote servers, clusters, ports and SET ROLE/admin substitutions', () => {
    verifyLocalIdentity(identity()); verifyLocalIdentity({ ...identity(), address: '127.0.0.1' });
    for (const change of [{ database: 'postgres' }, { oid: '5' }, { cluster: 'other' }, { address: '192.0.2.1' }, { port: 5433 },
        { username: 'thesishs_local_operator' }, { login: 'other' }, { owner: 'other' }, { superuser: false }])
        assert.throws(() => verifyLocalIdentity({ ...identity(), ...change }));
});
test('exact local ledger gates each migration step and permits rollback ID gaps without repair', () => {
    for (const count of [15, 16, 17]) {
        verifyLocalLedger(ledger().slice(0, count), count);
        verifyLocalLedger(ledger().slice(0, count).map((r, i) => ({ ...r, id: i * 2 + 1 })), count);
        assert.throws(() => verifyLocalLedger(ledger().slice(0, count - 1), count));
        const changed = ledger().slice(0, count); changed[2].hash = 'changed'; assert.throws(() => verifyLocalLedger(changed, count));
    }
});
test('one-step installed-ORM sources cannot include the following or unrelated future migration', () => {
    assert.equal(localPendingSource(15).length, 16); assert.equal(localPendingSource(15).at(-1).hash, ledger()[15].hash);
    assert.equal(localPendingSource(16).length, 17); assert.equal(localPendingSource(16).at(-1).hash, ledger()[16].hash);
    for (const bad of [14, 17, undefined]) assert.throws(() => localPendingSource(bad));
});
test('preservation rejects record, count, catalog, sequence and target changes while allowing only new objects', () => {
    const before = state(), after = structuredClone(before); after.rows.push_subscriptions = { count: 0, hash: 'empty' }; after.catalog.push_subscriptions = 'new';
    verifyLocalPreservation(before, after);
    for (const change of [s => s.rows.users.hash = 'changed', s => s.rows.users.count++, s => s.catalog.users = 'changed',
        s => s.sequences.users_id_seq.value = '12', s => s.target = 'other', s => s.source = 'other', s => delete s.rows.users]) {
        const changed = state(); change(changed); assert.throws(() => verifyLocalPreservation(before, changed));
    }
});
test('backup evidence must bind the verified archive and exact unchanged starting data/history', () => {
    const before = state(), evidence = { sha256: 'archive', inventoryVerified: true, fullArchiveDecoded: true, before: structuredClone(before) };
    verifyLocalBackup(evidence, 'archive', before);
    for (const change of [e => e.sha256 = 'other', e => e.inventoryVerified = false, e => e.fullArchiveDecoded = false,
        e => e.before.rows.users.hash = 'changed', e => e.before.ledger.pop()]) {
        const e = structuredClone(evidence); change(e); assert.throws(() => verifyLocalBackup(e, 'archive', before));
    }
});
test('local catalog versions are explicit and hosted entry point cannot select the local exception', async () => {
    const stop = new Error('Stop before temporary SQL.');
    for (const entries of [15, 16, 17]) {
        const snapshot = entries === 17 ? workspaceMigrationSource().snapshot : previewMigrationSource().snapshot;
        const names = Object.values(snapshot.tables).map(t => t.name).filter(n => entries !== 15 || n !== 'push_subscriptions').sort();
        const sql = async strings => { if (strings.join('').includes('select tablename')) return names.map(tablename => ({ tablename })); throw stop; };
        await assert.rejects(verifyLocalWorkspaceSchema(sql, entries), e => e === stop);
    }
    await assert.rejects(verifyLocalWorkspaceSchema(() => { throw stop; }, 14), /version refused/);
    await assert.rejects(verifyPreviewSchema(() => { throw stop; }, 'local-0014'), /mode refused/);
});
