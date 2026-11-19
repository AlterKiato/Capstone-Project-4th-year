# E1C-L: guarded LOCAL 0022–0023 migration preflight

2026-11-18, Asia/Manila. **READY FOR OWNER MIGRATION APPROVAL.** This checkpoint prepared and inspected an operator; it did not execute either migration, create a backup, restore a database or mutate application records. Execution still requires a separate owner instruction.

## 1. Current Git state

Verified branch `feature/development`, HEAD `a9d4fa5ce75e1a4fc29cf95ea913b4a3d5c176b2`, empty index. Incoming E1B/E1C-A/E1C-B work remains uncommitted. No stash/reset/stage/commit/push/merge/deployment. All incoming modified/untracked implementation and handoff files remain intact.

## 2. Preservation

Before-edit SHA-256 inventory covers **754 existing tracked/nonignored files** plus the local `.env` checksum (never printed). Ending checks confirm identical hashes for every incoming path, identical incoming Git entries, unchanged `.env`, same branch/HEAD and empty index. Only the three new files in section 14 are added. Ignored preflight evidence contains schema/permission metadata and aggregate content digests, never academic row contents. Independent ending read-only capture also matches all 26-table row fingerprints, 19 sequence states, catalog, permissions and the unchanged 22-entry ledger.

The five explicitly protected paths retain these before/after hashes:

| Path | SHA-256, before = after |
| --- | --- |
| `docs/MASTER_CONTEXT_UPDATED.md` | `bb72b97e82a7c1dcd1df468218b2f58e9f974953291885e4c5ffc70773f736fe` |
| `docs/PHASE10_STUDENT_EMAIL_OTP.md` | `de6385df2cb27b491af0de4366e72ec7abcc9f2d57baf6d77118780d2e49a44d` |
| `docs/SOURCE_OF_TRUTH_UPDATED.md` | `827f92703f2b6bbc72ed2e6b577aa353890813f4e855edbae8f007d7f3ea135a` |
| `scripts/groq-developer-test.cjs` | `59f684334a9782b812351b41ad6c98f573e30acf6a366ba3e424f64bdb5f017c` |
| `tests/ai-p212-developer-groq.unit.cjs` | `cb9b4e2bd582dadbcab1049540b09e6d3a61fadd81ccf6de16324b0e59f63a35` |

All existing migration SQL, journal and snapshots, including 0000–0023, remain byte-identical. Unlike feature implementation, this preflight appends no journal entry and changes no schema source.

## 3. Exact local target

Read-only SQL independently matched the existing `verifyLocalIdentity` pins:

| Identity field | Verified value |
| --- | --- |
| Environment / mode | Development / direct |
| Configured endpoint | `localhost:5432`, database `thesishs_ai` |
| Observed address / port | `::1:5432` |
| Database OID | `16387` |
| Cluster system identifier | `7652422818440234372` |
| Current/session role and database owner | `postgres` |
| Existing local role | Superuser; unchanged |

DNS results are restricted to loopback; remote hosts, alternate ports/databases/users, hosted classifications and shared Preview/Production profiles fail closed. Target fingerprint remains `8be02ccf26465e24fe4daa24fb5adbf11ca3283956a0d242e6a4b43b4ebd6079`. The selected exact endpoint/observed identity must reproduce that pin; an alias/address change is not silently accepted. No hosted target was contacted.

## 4. Application consistency

The current port-3000 listener PID **15872** matches this checkout's `.next/dev/lock` and a Next process whose command references this checkout. Sanitized process inspection found no inline database-URL assignment. The project configuration resolves `.env` to the same local Development endpoint; `.env.local`, `.env.development` and `.env.development.local` are absent. No secrets or raw command lines were printed.

This is process/configuration consistency evidence. The idle runtime pool did not supply a simultaneous process-socket-to-database match, and another process's complete in-memory environment was not dumped. The prior diagnosis also observed the application's exact assignment SELECT failing in this local server's log. No contrary routing evidence was found. No application action, refresh that could discard a draft, login/session modification or new record was performed here.

## 5. Existing ledger and local structures

Exactly **22** entries through **0021**, with every hash/timestamp matching the reviewed source and positive, increasing ledger IDs. Both 0022/0023 are pending; partial/already-applied states are refused by execution mode.

Current catalog matches the installed 0021 snapshot: **26 public tables and 19 public sequences**, expected columns/defaults, PK/unique/FK/index structure and healthy indexes. The finite existing CHECK contract was reused; E1B's six CHECK definitions were inspected against 0021, including its JSON scale constraints. Existing legacy ownership split is preserved: `submission_upload_intents` remains owned by `thesishs_local_operator`; other application tables remain owned by `postgres`.

No evaluation assignment/result/item tables, their indexes/sequences/triggers/function, Co evaluation columns or conflicting target objects exist. Required database/schema/ledger permissions, REFERENCES on dependency tables, Co-table authority and PL/pgSQL usage are available. No extra database connection was present in the initial identity check; future execution independently requires quiescence under lock.

Reviewed catalog/ACL/sequence-definition pin: `fb9c71ebaab211ff9a05f51519d1e97ca98967a8e2969653bda64d6af29f4017`. It excludes changing row content and sequence values; these are captured afresh and preserved during execution. Initial aggregate row fingerprint: `043cf2f4546a5d66b272ea314b5616d5ee12ff897758617bed2ef5993617942e`.

## 6. Migration 0022

File: `db/migrations/0022_submission_evaluation.sql`.

SHA-256: `6eede979948ac7cb2476b479c8a756101073e92a0e8d382120e2677afdfb3c24`.

Journal index 22, timestamp `1794970053461`, tag `0022_submission_evaluation`. Its snapshot/source identity is preserved: 23-entry digest `43ee2f88850c7b5f360bd9f49565f5107da5fd1ab55734abd92e4718f9706c52`.

Creates the three Main evaluation tables, two serial sequences, three primary keys, three unique constraints, five foreign keys, four CHECKs, six indexes, one immutability trigger function and six enabled triggers. References existing `submissions`, `users` and `feedbacks`; their required keys exist. The trigger function rejects future UPDATE/DELETE/TRUNCATE of the new historical tables; it does not execute those operations during migration. No existing academic table is altered by 0022.

## 7. Migration 0023

File: `db/migrations/0023_co_adviser_evaluation.sql`.

SHA-256: `86619dfff7d6caf9b7d862799d3450266e8f250c7a15f98f7c22cb7aed2f2889`.

Journal index 23, timestamp `1794977696276`, tag `0023_co_adviser_evaluation`. Snapshot 0023 links to snapshot 0022. Complete 24-entry digest: `f0140057433afdfb912e6da5d785086d16872eb2197de084b7e5e6ed49379f16`.

Adds nullable `evaluation_assignment_id` and `evaluation` to `co_adviser_review_assignments`; existing recommendations receive logical NULL additions, without a data backfill. Adds the composite unique key on the new assignment table **before** the composite exact-submission foreign key, then the bounded Co result CHECK. Existing rows satisfy the paired-NULL branch. No new Co table, duplicated academic relationship or change to existing narrative/attribution/timestamps. It requires 0022 first.

## 8. Destructive SQL and drift assessment

No DROP, reset, DML backfill, destructive ALTER, grant/revoke or rewrite of existing academic values is present. No concurrent-index/VACUUM/transaction-control statement prevents transactional execution. New nullable Co columns have no DEFAULT or NOT NULL requirement; constraint validation scans do not change recommendation contents. The assignment table is newly created and empty when its composite unique key is installed.

Source hashes, pinned journal/snapshot identities and current database shapes agree. No blocking schema conflict/drift was found. Generic E1B utilities assume the new E1B tables are empty during first installation; the new wrapper instead preserves existing accepted E1B content and does not rerun the 0021 executor.

## 9. Guarded operator and exact commands

New operator: `scripts/migrate-local-submission-evaluations.cjs`. It reuses the existing local target guard, identity validator, object contract, CHECK/default/index helpers, private-file verifier and backup/savepoint conventions. Importing it performs no environment-file read, connection, backup or write.

Reviewed operator SHA-256: `d46b4280138e4274ecbc36cb8be32a7e7d1ccff02b71e09186642499f812ffc8`.

Read-only command executed in this preflight:

```powershell
node --import tsx scripts/migrate-local-submission-evaluations.cjs --inspect
```

Future execution command — **reviewed only; not authorized or run by this checkpoint**:

```powershell
node --import tsx scripts/migrate-local-submission-evaluations.cjs --execute --confirm-target 8be02ccf26465e24fe4daa24fb5adbf11ca3283956a0d242e6a4b43b4ebd6079 --confirm-source f0140057433afdfb912e6da5d785086d16872eb2197de084b7e5e6ed49379f16
```

Fresh read-only verification after a future execution or uncertain acknowledgment, before application use:

```powershell
node --import tsx scripts/migrate-local-submission-evaluations.cjs --verify-installed --evidence "C:\Users\admin\.thesishs-private-backups\<actual-new-run-id>\evidence.json"
```

The evidence path is a placeholder until the separately authorized execution creates its fresh private backup. Installed verification checks the exact 24-entry state, archived checksum and saved pre-migration preservation fingerprints; it cannot execute migrations or create a backup. Do not pass an old E1B backup as E1C evidence. `--inspect` intentionally requires the 22-entry predecessor; it is not an idempotent migration command.

## 10. Backup and recovery plan

No backup or restoration was performed here. PostgreSQL `pg_dump` and `pg_restore` **18.4** binaries are available. The future execution will:

1. Acquire/reverify migration and table locks, then capture current schema/data/sequence/ACL/role/ledger fingerprints.
2. Create a **fresh** `%USERPROFILE%\.thesishs-private-backups\e1cl-0022-0023-<random-id>\database.custom`, outside tracked source. A private ACL permits only the owner, SYSTEM and Administrators. No previous archive is reused.
3. Use a private temporary pgpass file and explicit verified loopback/database/user arguments. Password is never placed in command arguments or output. The dump connection uses `default_transaction_read_only=on`; temporary credentials are removed in `finally`.
4. Verify the custom-format `PGDMP` header, nontrivial size, SHA-256, table/ledger inventory, full `pg_restore --file=NUL` decoding without a database connection, private ACL and a second checksum read.
5. Save private `evidence.json` containing the receipt and pre-migration aggregate fingerprints, then recheck preservation and backup freshness before any migration statement.

Archive readability/full decoding is **not a restore test**. The exact new `database.custom` plus checksum/evidence is the identified recovery artifact. No automatic restore, DROP or `--clean` command is included. If recovery becomes necessary, stop and obtain a separate scope: first reconcile durable ledger/catalog, then validate this archive into a separately authorized disposable recovery target. Never restore over newer academic work without an explicit owner decision and preservation plan.

## 11. Transaction and rollback strategy

Installed Drizzle ORM **0.45.2** and Postgres.js **3.4.9** were inspected locally. `PgDialect.migrate()` runs its supplied migrations in one session transaction; the existing adapter maps that session's `.begin()` to `savepoint()` on the already-open outer PostgreSQL transaction. Narrow tests exercised the installed Drizzle code with an inert session double, including a second-migration failure.

Future execution order:

1. Read-only predecessor inspection; exact CLI/source/identity/environment pins must pass.
2. Outer `sql.begin()`; local search path, bounded lock/statement timeouts, established advisory lock `(1296388937,16)`, EXCLUSIVE ledger lock and sorted SHARE locks on all 26 existing tables.
3. Require no other target-database connection; never terminate clients automatically. Reverify source, identity, exact ledger, catalog and preservation. A live client can cause safe refusal; arrange a quiet application window in the execution checkpoint.
4. Create/verify the fresh backup while SHARE locks prevent academic writes but allow the dump's reads. Reverify state and receipt freshness.
5. Pass **only** `coEvaluationMigrationSource().migrations.slice(22)` to Drizzle: 0022 then 0023. Historical 0000–0021 are not supplied for replay. Drizzle's bookkeeping checks, both DDL migrations, both ledger INSERTs and precommit verification remain on the same outer connection/transaction.
6. Compare all legacy row projections/catalog/sequence values/ACLs and validate the complete additive state **before outer commit**.
7. Close the connection and independently reconnect read-only for durable verification and private result evidence.

Any precommit failure rolls back both schema migrations and ledger rows together. PostgreSQL serial sequence increments are not transactional: failed ledger inserts may leave ID gaps; the verifier requires increasing positive IDs, not consecutiveness. Never repair/resequence the ledger manually.

A lost connection/acknowledgment or postcommit verification failure is **UNCONFIRMED**, never an automatic retry. The wrapper reconnects only to read the pinned identity/ledger and reports a recognized 22-prefix, 24-recorded or unexpected state. A 23-entry state is not an approved retry boundary. Full independent catalog/data verification and owner review precede further action; the fresh archive is retained. A committed 24-entry state is never automatically rolled back or reapplied.

## 12. Future verification

Before permitting application mutations, independently verify:

- Same host/database/OID/cluster/current+session user/owner and target pin.
- Exactly **24** source-matching entries, one each for 0022/0023; original 22 ledger rows preserved.
- **29** public tables and **21** public sequences. All three new tables have exact expected columns/defaults/keys/indexes; both new Co columns are present and NULL on existing recommendations.
- Across the delta: three PKs, four unique constraints, six FKs, five CHECKs and seven indexes; globally FKs 44 → 50 and CHECKs 50 → 55. Validated/enforced constraints, healthy indexes, exact trigger function body/search path/owner and six enabled immutability triggers.
- New tables empty and two new serial sequences unused. Original 26-table contents match fingerprints, projecting the original Co columns explicitly so added NULL fields do not manufacture a content difference.
- Existing catalog, ownership split, 19 sequence states, schema/database/default ACLs, roles and memberships unchanged. New table/sequence grants remain owner-only; the new trigger function retains its reviewed default function privileges. No new grants are issued.
- Fresh archive checksum and independent durable-state comparison against saved private evidence.

Then owner-led authenticated read acceptance: preserve/copy any unsaved draft, reload the Main Review tab and verify assignment state loads/template selection becomes available without 42P01. This runtime action is deferred; it is not performed in preflight. Broader Main/Co writes and academic finalization need the subsequent acceptance scope. No E1D starts.

## 13. Evidence and blockers

**8/8 narrow operator guard checks PASS**, plus targeted ESLint, Node syntax checks and real LOCAL read-only `--inspect`. Guard coverage: inert import/strict arguments, exact source slice/order, local/hosted rejection, complete-ledger recognition, preservation failures, fresh backup receipt requirements, installed Drizzle savepoint path and second-migration error propagation. One initial assertion was corrected to inspect Drizzle's wrapped error cause; the final checks pass.

No full E1B/E1C suite or build was rerun. Reused evidence remains separate: E1C-A 13 PostgreSQL + 6 authenticated groups; E1C-B 16 PostgreSQL + 9 synthetic browser groups. Their recorded limitations remain unchanged. No new disposable cluster, fixtures, hosted operation, provider/Storage action, UI workaround or academic authorization change.

Read-only aggregate evidence is under ignored `test-results/e1cl/`; the initial capture is `preflight-3a2c41bc-421d-4dea-b5a1-09f62c32fb98.json`. Actual backup creation, private ACL setup, new-operator real DDL execution and authenticated postactivation acceptance are deliberately **NOT EXECUTED**. No technical preflight blocker was found. Separate owner authorization and a quiet execution window remain mandatory execution gates.

## 14. Exact files added

- `scripts/migrate-local-submission-evaluations.cjs`
- `tests/e1cl-local-migration.unit.cjs`
- `docs/FEATURE_E1CL_MIGRATION_PREFLIGHT.md`

No existing source, schema, migration, environment or protected file was modified. Ignored evidence records contain aggregate hashes/catalogs only; no database backup exists from this checkpoint.

## 15. Readiness verdict

**READY FOR OWNER MIGRATION APPROVAL.** The exact local target, source order/dependencies, privileges, additive schema delta, backup plan, transaction mechanism, operator guards and preservation plan are reviewable. This verdict is not execution approval or local runtime activation. Stop here for a separately scoped owner decision; do not run the execution command automatically.
