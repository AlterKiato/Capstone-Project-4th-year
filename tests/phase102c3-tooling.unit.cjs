/* eslint-disable @typescript-eslint/no-require-imports */
// No database, provider, browser, backup creation or restoration. Real guards with transactional doubles.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID, randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const Module = require('node:module');
const safety = require('../scripts/upload-acceptance-safety.ts');
const { source, oldTables } = safety.migrationSource();
function state(applied = false) {
    const identity = { database: 'thesishs_ai', oid: safety.DATABASE_OID, cluster: safety.CLUSTER, address: '::1/128', port: 5432 };
    return { identity, target: safety.digest(identity), ledger: source.slice(0, applied ? 15 : 14).map(m => ({ hash: m.hash, created_at: String(m.folderMillis) })),
        tables: [...oldTables, ...(applied ? ['submission_upload_intents'] : [])].sort(), oldSchema: '97003bb0fa522defc68538ec467d988443cb442e1d5cb7904ceb7a486f0c80aa',
        records: 'original-record-digest', sequences: 'original-sequence-digest', newTableValid: applied, intentCount: applied ? 0 : -1 };
}
function recovery(s = state()) {
    return { kind: 'upload-0014-recovery', target: s.target, records: s.records, sequences: s.sequences, schema: s.oldSchema,
        backupHash: 'a'.repeat(64), restoredDatabase: 'thesishs_upload_restore_' + randomUUID().replaceAll('-', ''), restoredOid: '99999', verifiedAt: new Date().toISOString() };
}
function approval(s = state()) { return { execute: true, confirmTarget: s.target, cluster: safety.CLUSTER, oid: safety.DATABASE_OID, backupHash: 'a'.repeat(64) }; }
// Exercise the actual CLI body with in-memory boundaries, never live configuration or credentials.
async function recoveryCli(options = {}) {
    const archive = Buffer.from('PGDMP-isolated-archive-double'), backupHash = safety.bytesDigest(archive), restored = recovery();
    const mode = options.mode ?? '--verify-recovery';
    const args = ['--expected-cluster', safety.CLUSTER, '--expected-oid', safety.DATABASE_OID];
    if (mode !== '--inspect') args.push('--confirm-target', options.badTarget ? 'wrong' : state().target,
        '--backup-file', 'private-archive', '--confirm-backup', options.badHash ? 'wrong' : backupHash,
        '--recovery-evidence', 'private-evidence');
    if (mode === '--verify-recovery') args.push('--restore-database', restored.restoredDatabase, '--restore-oid', restored.restoredOid);
    const password = randomBytes(24).toString('hex');
    const fakeProcess = { argv: ['node', 'isolated-cli', mode, ...args], exitCode: 0,
        env: { DATABASE_URL: `postgres://runtime:${password}@localhost:5432/thesishs_ai`,
            THESISHS_UPLOAD_RESTORE_URL: `postgres://operator:${password}@localhost:5432/${restored.restoredDatabase}` } };
    const result = { active: 0, maximum: 0, opened: 0, closed: 0, reads: 0, writes: 0,
        fileReads: 0, evidence: undefined, out: [], errors: [], transactions: [] };
    let applied = false;
    const postgres = () => {
        assert.equal(result.active, 0, 'close the previous operator client before opening another');
        result.active++; result.opened++; result.maximum = Math.max(result.maximum, result.active);
        const tx = parts => {
            if (!Array.isArray(parts) || !Object.hasOwn(parts, 'raw')) return parts;
            if (/insert into drizzle\.__drizzle_migrations/.test(parts.join(''))) { result.writes++; applied = true; }
            return Promise.resolve([]);
        };
        tx.unsafe = async () => { result.writes++; };
        return {
            begin: async (modeOrRun, run) => {
                result.transactions.push(typeof modeOrRun === 'string' ? modeOrRun : 'migration-double');
                return (run ?? modeOrRun)(tx);
            },
            end: async () => {
                await Promise.resolve(); // Ensure the CLI awaits closure.
                result.active--; result.closed++;
                if (options.closeFailure) throw new Error('private close failure');
            },
        };
    };
    const inspectState = async (_tx, restore) => {
        result.reads++;
        if (result.reads === options.failRead) throw Object.assign(new Error('private permission details'), { code: '42501' });
        const s = state(applied);
        if (options.wrongIdentity && !restore) s.identity.oid = 'unexpected';
        if (restore) {
            s.identity = { ...s.identity, database: restore.database, oid: restore.oid };
            if (options.changedRestore) s.records = 'changed-restored-records';
        }
        return s;
    };
    const mocks = {
        'dotenv/config': {}, postgres,
        'node:fs': {
            readFileSync: file => {
                result.fileReads++;
                if (file === 'private-archive') return options.badHeader ? Buffer.from('wrong-archive') : archive;
                assert.equal(file, 'private-evidence');
                if (mode === '--verify-recovery') return Buffer.from(options.nonemptyEvidence ? 'existing evidence' : '');
                return JSON.stringify({ ...restored, backupHash, ...(options.staleEvidence ? { verifiedAt: '2000-01-01' } : {}) });
            },
            writeFileSync: (file, value) => { assert.equal(file, 'private-evidence'); result.evidence = JSON.parse(value); },
        },
        '@/lib/db/config': { databaseConfiguration: () => ({ url: `postgres://operator:${password}@localhost:5432/thesishs_ai`,
            options: { max: 1 }, environment: 'development', endpoint: { host: 'localhost', database: 'thesishs_ai', port: 5432, user: 'operator' } }) },
        './database-operator': { requirePrivateTerminal: () => {} },
        './upload-acceptance-safety': { ...safety, inspectState, privateFile: file => file },
    };
    const ts = require('typescript');
    const compiled = ts.transpileModule(readFileSync('scripts/migrate-upload-intents.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    assert.match(compiled, /void main\(\);/);
    const cliModule = { exports: {} };
    const run = new Function('require', 'module', 'exports', 'process', 'console',
        compiled.replace('void main();', 'module.exports = main;'));
    run(id => { assert.ok(Object.hasOwn(mocks, id), 'unexpected CLI dependency'); return mocks[id]; }, cliModule, cliModule.exports,
        fakeProcess, { log: value => result.out.push(value), error: value => result.errors.push(value) });
    await cliModule.exports();
    assert.equal(result.active, 0); assert.equal(result.closed, result.opened);
    return { ...result, exitCode: fakeProcess.exitCode, backupHash };
}
test('recovery CLI closes source, restore and source-recheck connections sequentially before evidence', async () => {
    const r = await recoveryCli();
    assert.equal(r.exitCode, 0); assert.equal(r.opened, 3); assert.equal(r.maximum, 1); assert.equal(r.writes, 0);
    assert.ok(r.transactions.every(mode => mode.endsWith('read only')));
    safety.validateRecovery(r.evidence, r.backupHash, state());
});
test('permission failures close source/restore/recheck clients and emit controlled errors', async () => {
    for (const failRead of [1, 2, 3]) {
        const r = await recoveryCli({ failRead });
        assert.equal(r.exitCode, 1); assert.equal(r.opened, failRead); assert.equal(r.evidence, undefined); assert.equal(r.writes, 0);
        assert.equal(r.errors.length, 1); assert.doesNotMatch(r.errors[0], /private permission|42501|postgres:\/\//);
    }
});
test('failed client closure prevents opening another operator connection', async () => {
    const r = await recoveryCli({ closeFailure: true });
    assert.equal(r.exitCode, 1); assert.equal(r.opened, 1); assert.equal(r.evidence, undefined);
});
test('recovery CLI preserves identity, target, archive and evidence-output guards', async () => {
    for (const change of [{ wrongIdentity: true }, { badTarget: true }, { badHash: true }, { badHeader: true },
        { nonemptyEvidence: true }, { changedRestore: true }]) {
        const r = await recoveryCli(change);
        assert.equal(r.exitCode, 1); assert.equal(r.evidence, undefined); assert.equal(r.writes, 0);
    }
});
test('inspection opens one read-only connection without archive, evidence or migration operations', async () => {
    const r = await recoveryCli({ mode: '--inspect' });
    assert.equal(r.exitCode, 0); assert.equal(r.opened, 1); assert.equal(r.fileReads, 0); assert.equal(r.writes, 0);
    assert.equal(r.evidence, undefined); assert.equal(JSON.parse(r.out[0]).mode, 'read-only');
});
test('migration callbacks also close sequentially under doubles and stale evidence never reaches SQL', async () => {
    const rejected = await recoveryCli({ mode: '--execute', staleEvidence: true });
    assert.equal(rejected.exitCode, 1); assert.equal(rejected.writes, 0);
    const accepted = await recoveryCli({ mode: '--execute' });
    assert.equal(accepted.exitCode, 0); assert.equal(accepted.maximum, 1); assert.ok(accepted.writes > 0);
    const failed = await recoveryCli({ mode: '--execute', failRead: 3 });
    assert.equal(failed.exitCode, 1); assert.equal(failed.maximum, 1); assert.equal(failed.writes, 0);
});

const reviewedCheckPairs = [
    {
        "table": "ai_consent_events",
        "name": "ai_consent_event_check",
        "source": "CHECK ((((event_kind)::text = ANY ((ARRAY['accepted'::character varying, 'declined'::character varying, 'withdrawn'::character varying])::text[])) AND (((event_kind)::text <> 'accepted'::text) OR (eligibility_event_id IS NOT NULL))))",
        "restored": "CHECK ((((event_kind)::text = ANY (ARRAY[('accepted'::character varying)::text, ('declined'::character varying)::text, ('withdrawn'::character varying)::text])) AND (((event_kind)::text <> 'accepted'::text) OR (eligibility_event_id IS NOT NULL))))",
        "meta": {
            "relname": "ai_consent_events",
            "conname": "ai_consent_event_check",
            "contype": "c",
            "convalidated": true,
            "conenforced": true,
            "condeferrable": false,
            "condeferred": false,
            "connoinherit": false,
            "conislocal": true,
            "coninhcount": 0,
            "referenced_columns": [
                {
                    "name": "eligibility_event_id",
                    "type": "integer",
                    "notNull": false,
                    "collation": null
                },
                {
                    "name": "event_kind",
                    "type": "character varying(16)",
                    "notNull": true,
                    "collation": "\"default\""
                }
            ],
            "dependencies": [
                {
                    "kind": "a",
                    "class": "pg_class",
                    "identity": "column eligibility_event_id of table ai_consent_events"
                },
                {
                    "kind": "n",
                    "class": "pg_class",
                    "identity": "column eligibility_event_id of table ai_consent_events"
                },
                {
                    "kind": "a",
                    "class": "pg_class",
                    "identity": "column event_kind of table ai_consent_events"
                },
                {
                    "kind": "n",
                    "class": "pg_class",
                    "identity": "column event_kind of table ai_consent_events"
                }
            ]
        }
    },
    {
        "table": "ai_eligibility_events",
        "name": "ai_eligibility_decision_check",
        "source": "CHECK (((decision)::text = ANY ((ARRAY['Eligible'::character varying, 'Not Eligible'::character varying, 'Pending Verification'::character varying])::text[])))",
        "restored": "CHECK (((decision)::text = ANY (ARRAY[('Eligible'::character varying)::text, ('Not Eligible'::character varying)::text, ('Pending Verification'::character varying)::text])))",
        "meta": {
            "relname": "ai_eligibility_events",
            "conname": "ai_eligibility_decision_check",
            "contype": "c",
            "convalidated": true,
            "conenforced": true,
            "condeferrable": false,
            "condeferred": false,
            "connoinherit": false,
            "conislocal": true,
            "coninhcount": 0,
            "referenced_columns": [
                {
                    "name": "decision",
                    "type": "character varying(24)",
                    "notNull": true,
                    "collation": "\"default\""
                }
            ],
            "dependencies": [
                {
                    "kind": "a",
                    "class": "pg_class",
                    "identity": "column decision of table ai_eligibility_events"
                },
                {
                    "kind": "n",
                    "class": "pg_class",
                    "identity": "column decision of table ai_eligibility_events"
                }
            ]
        }
    },
    {
        "table": "ai_eligibility_events",
        "name": "ai_eligibility_event_check",
        "source": "CHECK (COALESCE(((((event_kind)::text = 'bootstrap'::text) AND ((decision)::text = 'Eligible'::text) AND (decision_role_id = 1) AND (account_updated_at IS NOT NULL) AND (verifier_user_id IS NULL) AND (verifier_authorization_ref IS NULL) AND (length((external_authority_ref)::text) > 0) AND (NOT revoked)) OR (((event_kind)::text = ANY ((ARRAY['certification'::character varying, 'reset'::character varying, 'revocation'::character varying])::text[])) AND (verifier_user_id IS NOT NULL) AND (verifier_user_id <> user_id) AND (length((verifier_authorization_ref)::text) > 0) AND (external_authority_ref IS NULL) AND ((((event_kind)::text = 'certification'::text) AND ((decision)::text = ANY ((ARRAY['Eligible'::character varying, 'Not Eligible'::character varying])::text[])) AND (decision_role_id = ANY (ARRAY[1, 2])) AND (account_updated_at IS NOT NULL) AND (NOT revoked)) OR (((event_kind)::text = 'reset'::text) AND ((decision)::text = 'Pending Verification'::text) AND (NOT revoked)) OR (((event_kind)::text = 'revocation'::text) AND ((decision)::text = 'Not Eligible'::text) AND revoked)))), false))",
        "restored": "CHECK (COALESCE(((((event_kind)::text = 'bootstrap'::text) AND ((decision)::text = 'Eligible'::text) AND (decision_role_id = 1) AND (account_updated_at IS NOT NULL) AND (verifier_user_id IS NULL) AND (verifier_authorization_ref IS NULL) AND (length((external_authority_ref)::text) > 0) AND (NOT revoked)) OR (((event_kind)::text = ANY (ARRAY[('certification'::character varying)::text, ('reset'::character varying)::text, ('revocation'::character varying)::text])) AND (verifier_user_id IS NOT NULL) AND (verifier_user_id <> user_id) AND (length((verifier_authorization_ref)::text) > 0) AND (external_authority_ref IS NULL) AND ((((event_kind)::text = 'certification'::text) AND ((decision)::text = ANY (ARRAY[('Eligible'::character varying)::text, ('Not Eligible'::character varying)::text])) AND (decision_role_id = ANY (ARRAY[1, 2])) AND (account_updated_at IS NOT NULL) AND (NOT revoked)) OR (((event_kind)::text = 'reset'::text) AND ((decision)::text = 'Pending Verification'::text) AND (NOT revoked)) OR (((event_kind)::text = 'revocation'::text) AND ((decision)::text = 'Not Eligible'::text) AND revoked)))), false))",
        "meta": {
            "relname": "ai_eligibility_events",
            "conname": "ai_eligibility_event_check",
            "contype": "c",
            "convalidated": true,
            "conenforced": true,
            "condeferrable": false,
            "condeferred": false,
            "connoinherit": false,
            "conislocal": true,
            "coninhcount": 0,
            "referenced_columns": [
                {
                    "name": "account_updated_at",
                    "type": "timestamp without time zone",
                    "notNull": false,
                    "collation": null
                },
                {
                    "name": "decision",
                    "type": "character varying(24)",
                    "notNull": true,
                    "collation": "\"default\""
                },
                {
                    "name": "decision_role_id",
                    "type": "integer",
                    "notNull": false,
                    "collation": null
                },
                {
                    "name": "event_kind",
                    "type": "character varying(16)",
                    "notNull": true,
                    "collation": "\"default\""
                },
                {
                    "name": "external_authority_ref",
                    "type": "character varying(80)",
                    "notNull": false,
                    "collation": "\"default\""
                },
                {
                    "name": "revoked",
                    "type": "boolean",
                    "notNull": true,
                    "collation": null
                },
                {
                    "name": "user_id",
                    "type": "integer",
                    "notNull": true,
                    "collation": null
                },
                {
                    "name": "verifier_authorization_ref",
                    "type": "character varying(80)",
                    "notNull": false,
                    "collation": "\"default\""
                },
                {
                    "name": "verifier_user_id",
                    "type": "integer",
                    "notNull": false,
                    "collation": null
                }
            ],
            "dependencies": [
                {
                    "kind": "a",
                    "class": "pg_class",
                    "identity": "column account_updated_at of table ai_eligibility_events"
                },
                {
                    "kind": "n",
                    "class": "pg_class",
                    "identity": "column account_updated_at of table ai_eligibility_events"
                },
                {
                    "kind": "a",
                    "class": "pg_class",
                    "identity": "column decision of table ai_eligibility_events"
                },
                {
                    "kind": "n",
                    "class": "pg_class",
                    "identity": "column decision of table ai_eligibility_events"
                },
                {
                    "kind": "a",
                    "class": "pg_class",
                    "identity": "column decision_role_id of table ai_eligibility_events"
                },
                {
                    "kind": "n",
                    "class": "pg_class",
                    "identity": "column decision_role_id of table ai_eligibility_events"
                },
                {
                    "kind": "a",
                    "class": "pg_class",
                    "identity": "column event_kind of table ai_eligibility_events"
                },
                {
                    "kind": "n",
                    "class": "pg_class",
                    "identity": "column event_kind of table ai_eligibility_events"
                },
                {
                    "kind": "a",
                    "class": "pg_class",
                    "identity": "column external_authority_ref of table ai_eligibility_events"
                },
                {
                    "kind": "n",
                    "class": "pg_class",
                    "identity": "column external_authority_ref of table ai_eligibility_events"
                },
                {
                    "kind": "a",
                    "class": "pg_class",
                    "identity": "column revoked of table ai_eligibility_events"
                },
                {
                    "kind": "n",
                    "class": "pg_class",
                    "identity": "column revoked of table ai_eligibility_events"
                },
                {
                    "kind": "a",
                    "class": "pg_class",
                    "identity": "column user_id of table ai_eligibility_events"
                },
                {
                    "kind": "n",
                    "class": "pg_class",
                    "identity": "column user_id of table ai_eligibility_events"
                },
                {
                    "kind": "a",
                    "class": "pg_class",
                    "identity": "column verifier_authorization_ref of table ai_eligibility_events"
                },
                {
                    "kind": "n",
                    "class": "pg_class",
                    "identity": "column verifier_authorization_ref of table ai_eligibility_events"
                },
                {
                    "kind": "a",
                    "class": "pg_class",
                    "identity": "column verifier_user_id of table ai_eligibility_events"
                },
                {
                    "kind": "n",
                    "class": "pg_class",
                    "identity": "column verifier_user_id of table ai_eligibility_events"
                }
            ]
        }
    },
    {
        "table": "email_verification_requests",
        "name": "email_verification_times_check",
        "source": "CHECK ((((cardinality(request_times) >= 1) AND (cardinality(request_times) <= 5)) AND (array_position(request_times, NULL::timestamp with time zone) IS NULL)))",
        "restored": "CHECK (((cardinality(request_times) >= 1) AND (cardinality(request_times) <= 5) AND (array_position(request_times, NULL::timestamp with time zone) IS NULL)))",
        "meta": {
            "relname": "email_verification_requests",
            "conname": "email_verification_times_check",
            "contype": "c",
            "convalidated": true,
            "conenforced": true,
            "condeferrable": false,
            "condeferred": false,
            "connoinherit": false,
            "conislocal": true,
            "coninhcount": 0,
            "referenced_columns": [
                {
                    "name": "request_times",
                    "type": "timestamp with time zone[]",
                    "notNull": true,
                    "collation": null
                }
            ],
            "dependencies": [
                {
                    "kind": "a",
                    "class": "pg_class",
                    "identity": "column request_times of table email_verification_requests"
                },
                {
                    "kind": "n",
                    "class": "pg_class",
                    "identity": "column request_times of table email_verification_requests"
                }
            ]
        }
    }
];
const checkRow = (p, restored = false) => ({ relname: p.table, conname: p.name, contype: 'c', convalidated: true, definition: restored ? p.restored : p.source });
const reviewedDigest = rows => safety.digest(rows);
test('only the four reviewed CHECK forms map to the original complete definitions', () => {
    for (const p of reviewedCheckPairs) {
        assert.deepEqual(safety.reviewedRecoveryConstraint(checkRow(p, true), p.meta), checkRow(p));
        assert.deepEqual(safety.reviewedRecoveryConstraint(checkRow(p), p.meta), checkRow(p));
    }
});
test('CHECK operator changes remain fingerprint differences', () => {
    for (const p of reviewedCheckPairs) {
        const c = checkRow(p, true);
        c.definition = c.definition.includes(' = ANY ') ? c.definition.replace(' = ANY ', ' <> ANY ') : c.definition.replace('>= 1', '> 1');
        assert.notEqual(reviewedDigest(safety.reviewedRecoveryConstraint(c, p.meta)), reviewedDigest(checkRow(p)));
    }
});
test('CHECK boundaries, literal sets and cast typmods cannot use a reviewed exception', () => {
    for (const [i, from, to] of [[3, '<= 5', '<= 6'], [3, '>= 1', '>= 0'],
        [0, "'accepted'", "'Accepted'"], [1, "'Eligible'", "'Other'"], [2, ', false))', ', true))'],
        [0, '::character varying', '::character varying(1)']]) {
        const p = reviewedCheckPairs[i], c = checkRow(p, true);
        c.definition = c.definition.replace(from, to);
        assert.notEqual(c.definition, p.restored);
        assert.notEqual(reviewedDigest(safety.reviewedRecoveryConstraint(c, p.meta)), reviewedDigest(checkRow(p)));
    }
});
test('CHECK column, type, collation and dependency substitutions are rejected', () => {
    const p = reviewedCheckPairs[0], c = checkRow(p, true);
    const changed = { ...c, definition: c.definition.replaceAll('event_kind', 'decision') };
    assert.notEqual(reviewedDigest(safety.reviewedRecoveryConstraint(changed, p.meta)), reviewedDigest(checkRow(p)));
    for (const change of [
        m => { m.referenced_columns[0].name = 'other_column'; },
        m => { m.referenced_columns[0].type = 'bigint'; },
        m => { m.referenced_columns[1].collation = 'other_collation'; },
        m => { m.dependencies.push({ class: 'pg_proc', identity: 'function public.unreviewed()', kind: 'n' }); },
    ]) {
        const metadata = structuredClone(p.meta); change(metadata);
        assert.throws(() => safety.reviewedRecoveryConstraint(c, metadata));
    }
});
test('missing or renamed CHECK constraints cannot match the reviewed constraint fingerprint', () => {
    const expected = reviewedCheckPairs.map(p => checkRow(p));
    const rows = reviewedCheckPairs.map(p => safety.reviewedRecoveryConstraint(checkRow(p, true), p.meta));
    assert.deepEqual(rows, expected);
    assert.notEqual(reviewedDigest(rows.slice(1)), reviewedDigest(expected));
    for (const field of ['relname', 'conname']) {
        const c = { ...checkRow(reviewedCheckPairs[0], true), [field]: 'different' };
        assert.notEqual(reviewedDigest(safety.reviewedRecoveryConstraint(c, reviewedCheckPairs[0].meta)), reviewedDigest(expected[0]));
    }
});
test('CHECK type, validation and enforcement state remain required', () => {
    const p = reviewedCheckPairs[0], c = checkRow(p, true);
    assert.throws(() => safety.reviewedRecoveryConstraint({ ...c, contype: 'f' }, p.meta));
    assert.throws(() => safety.reviewedRecoveryConstraint({ ...c, convalidated: false }, p.meta));
    for (const key of ['convalidated', 'conenforced', 'condeferrable', 'condeferred', 'connoinherit', 'conislocal']) {
        const metadata = structuredClone(p.meta); metadata[key] = !metadata[key];
        assert.throws(() => safety.reviewedRecoveryConstraint(c, metadata));
    }
    assert.throws(() => safety.reviewedRecoveryConstraint(c, undefined));
});
test('unreviewed CHECK rewrites and unknown expressions are never normalized', () => {
    const p = reviewedCheckPairs[3];
    for (const definition of ['CHECK (true)', p.restored.replace(' AND ', ' OR '), p.restored + ' ']) {
        const c = { ...checkRow(p, true), definition };
        assert.deepEqual(safety.reviewedRecoveryConstraint(c, p.meta), c);
        assert.notEqual(reviewedDigest(c), reviewedDigest(checkRow(p)));
    }
});

test('approved migration bytes, exact snapshot delta and original ledger ordering are required', () => {
    assert.equal(source[14].hash, safety.MIGRATION_HASH); assert.equal(source.length, 15);
    assert.throws(() => safety.validateMigrationHash('0'.repeat(64)));
    assert.equal(Object.keys(safety.migrationSource().intent.checkConstraints).length, 8);
    const bad = state(); bad.ledger[13].hash = 'wrong'; assert.throws(() => safety.validateState(bad, false));
    for (const edit of [s => s.ledger.pop(), s => s.ledger.push(s.ledger[0]), s => s.tables.push('unexpected'), s => { s.oldSchema = 'drift'; }]) {
        const s = state(); edit(s); assert.throws(() => safety.validateState(s, false));
    }
});
test('wrong cluster, database OID, port, address and requested identity are refused', () => {
    for (const change of [{ cluster: 'wrong' }, { oid: '2' }, { port: 6543 }, { address: '203.0.113.1' }, { database: 'production' }])
        assert.throws(() => safety.validateIdentity({ ...state().identity, ...change }, approval()));
    assert.throws(() => safety.validateIdentity(state().identity, { cluster: 'wrong', oid: safety.DATABASE_OID }));
});
test('live inspector refuses an unexpected identity before reading ledger or records', async () => {
    let queries = 0;
    const sql = async () => { queries++; return [{ ...state().identity, oid: '99999' }]; };
    await assert.rejects(safety.inspectState(sql)); assert.equal(queries, 1);
});
test('missing/stale/mismatched backup and restore evidence cannot authorize migration', () => {
    const s = state(), good = recovery(s); safety.validateRecovery(good, good.backupHash, s);
    for (const e of [undefined, { ...good, backupHash: 'b'.repeat(64) }, { ...good, records: 'changed' },
        { ...good, target: 'wrong' }, { ...good, restoredOid: safety.DATABASE_OID }, { ...good, restoredDatabase: 'thesishs_ai' },
        { ...good, verifiedAt: new Date(Date.now() - 90000000).toISOString() }, { ...good, verifiedAt: new Date(Date.now() + 60000).toISOString() }])
        assert.throws(() => safety.validateRecovery(e, good.backupHash, s));
});
test('explicit execution/target/backup gates stop before applying any SQL', async () => {
    let writes = 0; const io = { inspect: async () => state(), apply: async () => { writes++; } };
    for (const a of [{ ...approval(), execute: false }, { ...approval(), confirmTarget: 'wrong' }, { ...approval(), backupHash: '' }])
        await assert.rejects(safety.migrate0014(io, a, recovery()));
    await assert.rejects(safety.migrate0014(io, approval(), undefined)); assert.equal(writes, 0);
});
test('one acknowledged migration verifies completion and old record/sequence preservation', async () => {
    let current = state(), writes = 0;
    const result = await safety.migrate0014({ inspect: async () => current, apply: async () => { writes++; current = state(true); } }, approval(), recovery());
    assert.equal(result, 'applied-confirmed'); assert.equal(writes, 1);
});
test('already-applied migrations never execute again, including populated intent tables', async () => {
    const s = state(true); s.intentCount = 7; let writes = 0;
    assert.equal(await safety.migrate0014({ inspect: async () => s, apply: async () => { writes++; } }, approval(s), undefined), 'already-applied');
    assert.equal(writes, 0);
});
test('lost commit acknowledgement reconciles by fresh read without replaying', async () => {
    let current = state(), writes = 0;
    const result = await safety.migrate0014({ inspect: async () => current, apply: async () => { writes++; current = state(true); throw Error('synthetic lost ack'); } }, approval(), recovery());
    assert.equal(result, 'applied-reconciled'); assert.equal(writes, 1);
});
test('rollback, unavailable reconciliation, partial state and old-record drift never trigger a retry', async () => {
    let writes = 0;
    assert.equal(await safety.migrate0014({ inspect: async () => state(), apply: async () => { writes++; throw Error(); } }, approval(), recovery()), 'not-applied-review-before-retry');
    assert.equal(writes, 1);
    for (const drift of ['records', 'sequences', 'oldSchema', 'newTableValid']) {
        let current = state();
        await assert.rejects(safety.migrate0014({ inspect: async () => current, apply: async () => { current = state(true); current[drift] = drift === 'newTableValid' ? false : 'changed'; } }, approval(), recovery()));
    }
    let reads = 0;
    await assert.rejects(safety.migrate0014({ inspect: async () => { if (++reads > 1) throw Error(); return state(); }, apply: async () => { throw Error(); } }, approval(), recovery()));
});
test('browser targets require explicit matching loopback origin and reject credentials, production, paths and fragments', () => {
    assert.equal(safety.browserTarget('http://127.0.0.1:4318/', 'http://127.0.0.1:4318'), 'http://127.0.0.1:4318');
    for (const url of ['https://production.example.invalid', 'http://localhost', 'http://x:secret@localhost:4318/',
        'http://localhost:4318/path', 'http://localhost:4318/?token=synthetic', 'http://localhost:4318/#token'])
        assert.throws(() => safety.browserTarget(url, new URL(url).origin));
    assert.throws(() => safety.browserTarget('http://localhost:4318', 'http://localhost:4319'));
});
test('private files inside the repository are refused, and entry commands refuse absent execution/identity flags without I/O', () => {
    assert.throws(() => safety.privateFile(require('node:path').resolve('package.json')));
    for (const file of ['scripts/migrate-upload-intents.ts', 'tests/phase102c3-browser.acceptance.cjs']) {
        const result = spawnSync(process.execPath, ['--import', 'tsx', file], { encoding: 'utf8', timeout: 20000,
            env: { ...process.env, DATABASE_URL: 'do-not-connect', THESISHS_DATABASE_ADMIN_URL: 'do-not-connect', SUPABASE_SECRET_KEY: 'synthetic-never-log' } });
        assert.ifError(result.error); assert.equal(result.status, 1); assert.equal(result.stdout, '');
        assert.doesNotMatch(result.stderr, /do-not-connect|synthetic-never-log|postgres:\/\/|token=/);
    }
});

// Tag driver only; query strings, not parameter values, are captured. Scope metadata is a fixed isolated double.
let data;
function driver() {
    data = { users: [], groups: [], members: [], papers: [], references: false, deletes: 0, next: 100, queries: [] };
    const ids = value => value?.ids ?? [];
    const tx = (parts, ...v) => {
        if (!Array.isArray(parts) || !Object.hasOwn(parts, 'raw')) return { ids: parts };
        const q = parts.join('?'); data.queries.push(q);
        if (/select id,name from role/.test(q)) return Promise.resolve([{ id: 1, name: 'Admin' }, { id: 2, name: 'Adviser' }, { id: 3, name: 'Student' }, { id: 4, name: 'Panel' }]);
        if (/select .*from users/.test(q)) return Promise.resolve(data.users.filter(u => /lower\(email\)/.test(q) ? u.email === v[0] : ids(v[0]).includes(u.id)));
        if (/insert into users/.test(q)) { const row = { id: data.next++, first_name: v[0], last_name: v[1], email: v[2], password: v[3], role_id: v[4], is_active: true }; data.users.push(row); return Promise.resolve([row]); }
        if (/select .*from research_groups/.test(q)) return Promise.resolve(data.groups.filter(g => /group_name=/.test(q) ? g.group_name === v[0] : ids(v[0]).includes(g.id)));
        if (/insert into research_groups/.test(q)) { const row = { id: data.next++, group_name: v[0], adviser_id: v[1], status: 'active', strand: 'TEST', section: 'C3B', school_year: 'TEST' }; data.groups.push(row); return Promise.resolve([row]); }
        if (/select .*from group_members/.test(q)) return Promise.resolve(data.members.filter(m => typeof v[0] === 'number' ? m.user_id === v[0] : ids(v[0]).includes(m.user_id) || ids(v[1]).includes(m.group_id)));
        if (/insert into group_members/.test(q)) { data.members.push({ group_id: v[0], user_id: v[1] }); return Promise.resolve([]); }
        if (/select .*from research_papers/.test(q)) return Promise.resolve(data.papers.filter(p => /where title=/.test(q) ? p.title === v[0] : ids(v[0]).includes(p.group_id) || ids(v[1]).includes(p.id)));
        if (/insert into research_papers/.test(q)) { const row = { id: data.next++, group_id: v[0], title: v[1], abstract: v[2], status: 'Draft' }; data.papers.push(row); return Promise.resolve([row]); }
        if (/select exists/.test(q)) return Promise.resolve([{ present: data.references }]);
        if (/delete from/.test(q)) { data.deletes++; if (/group_members/.test(q)) data.members = []; else if (/research_papers/.test(q)) data.papers = []; else if (/research_groups/.test(q)) data.groups = []; else data.users = []; }
        return Promise.resolve([]);
    };
    tx.begin = async callback => { const copy = structuredClone(data); try { return await callback(tx); } catch (e) { data = copy; throw e; } };
    return tx;
}
const originalLoad = Module._load;
Module._load = function(id, ...args) { return id === './upload-acceptance-safety' ? { ...safety, inspectState: async () => state(true) } : originalLoad.call(this, id, ...args); };
const fixtures = require('../scripts/upload-acceptance-fixtures.ts');
Module._load = originalLoad;
test('fixtures require explicit run/operation/target and never silently reuse an existing account', async () => {
    const db = driver(), run = randomUUID(), target = state().target, credentials = {};
    for (const permit of [{ execute: false }, { execute: true, operation: 'remove-pristine' }, { execute: true, operation: 'create', confirmRun: run, confirmTarget: 'wrong' }])
        await assert.rejects(fixtures.createUploadFixtures(db, run, target, credentials, permit));
    assert.equal(data.queries.length, 0);
    assert.throws(() => fixtures.fixturePlan('production'));
});
test('fixture creation retries preserve IDs/memberships, and teardown refuses foreign or research-bearing records', async () => {
    const db = driver(), run = randomUUID(), target = state().target;
    const credentials = Object.fromEntries(['student-a', 'student-b', 'student-c', 'adviser', 'admin'].map(tag => [tag, randomBytes(24).toString('hex')]));
    const create = { execute: true, operation: 'create', confirmRun: run, confirmTarget: target };
    const manifest = await fixtures.createUploadFixtures(db, run, target, credentials, create);
    const again = await fixtures.createUploadFixtures(db, run, target, credentials, create);
    assert.deepEqual(again, manifest); assert.equal(data.users.length, 5); assert.equal(data.groups.length, 2); assert.equal(data.members.length, 3); assert.equal(data.papers.length, 3);
    const originalRows = safety.digest(data.users);
    await assert.rejects(fixtures.createUploadFixtures(db, run, target, { ...credentials, 'student-a': randomBytes(24).toString('hex') }, create));
    assert.equal(safety.digest(data.users), originalRows);
    const remove = { ...create, operation: 'remove-pristine' };
    data.references = true; await assert.rejects(fixtures.removePristineUploadFixtures(db, manifest, remove)); assert.equal(data.deletes, 0);
    data.references = false; const originalName = data.groups[0].group_name; data.groups[0].group_name = 'unrelated';
    await assert.rejects(fixtures.removePristineUploadFixtures(db, manifest, remove)); assert.equal(data.deletes, 0); data.groups[0].group_name = originalName;
    data.members.push({ user_id: 999, group_id: manifest.groups[0] });
    await assert.rejects(fixtures.removePristineUploadFixtures(db, manifest, remove)); assert.equal(data.deletes, 0); data.members.pop();
    data.papers.push({ id: 999, group_id: manifest.groups[0], title: 'unrelated' });
    await assert.rejects(fixtures.removePristineUploadFixtures(db, manifest, remove)); assert.equal(data.deletes, 0); data.papers.pop();
    const changed = structuredClone(manifest); changed.users['student-a'] = 999;
    await assert.rejects(fixtures.removePristineUploadFixtures(db, changed, remove)); assert.equal(data.deletes, 0);
    assert.equal(await fixtures.removePristineUploadFixtures(db, manifest, remove), 'removed-pristine');
    assert.equal(await fixtures.removePristineUploadFixtures(db, manifest, remove), 'already-removed');
    assert.equal(data.users.length + data.groups.length + data.members.length + data.papers.length, 0);
});
test('browser harness has no capture/logging hooks and produces a self-contained synthetic PDF', () => {
    const { pdf } = require('./phase102c3-browser.acceptance.cjs');
    const bytes = pdf(); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-'); assert.match(bytes.toString(), /startxref\n\d+\n%%EOF/);
    const source = readFileSync('tests/phase102c3-browser.acceptance.cjs', 'utf8');
    assert.doesNotMatch(source, /\.screenshot\(|\.tracing\.|recordHar:|recordVideo:|\.storageState\(|\.postData\(|\.body\(/);
    assert.match(source, /server\.stdout\.on\('data'/); assert.match(source, /mode|--execute/);
    assert.match(source, /serviceWorkers: 'block'/);
});
