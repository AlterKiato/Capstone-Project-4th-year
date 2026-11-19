# E1P-P4A: Guarded Preview evaluation operator preparation

2026-11-19, Asia/Manila. **Current: E1P-P4B COMPLETE — guarded Preview migrations PASS; application push/deployment and E1E PENDING.** The original P4A preparation record below remains historical; its pending-execution language is superseded only by the completion handoff here.

## Current handoff - E1P-P4B complete (2026-11-19)

The separately authorized P4B-R1 continuation executed **0021 → 0022 → 0023 once** using the unchanged reviewed P4A operator, verified existing private backup, fresh receipt and exact minimum grants. The transaction committed successfully; no retry, restore or historical replay occurred. CLI durable verification and an additional fresh read-only connection confirmed **24 source-matching ledger entries through 0023**, with the original 21 entries preserved.

Exact hosted target: Supabase Preview `cbkplqkkjuoglpimwmib`, database `postgres`, OID `5`, native cluster `7678069749886157684`, PostgreSQL `17.6`, operator `thesishs_preview_operator`. Additional readback completed `2026-11-19T13:33:41.745Z`: 29 application tables, exact constraints/indexes/relationships, one immutable evaluation function, six triggers and minimum effective privileges passed. Five new evaluation tables were empty, three new sequences unused, and old Co evaluation fields null/null. Existing academic records/relationships/ACLs/public sequences/ledger-prefix digest remained `ffb9ba189c5aa400ae8ade2afa9afa140f6a7d0e1c0754ccbeeb1836037be181`. Installed catalog digest: `1f655d2040cd2b325d23a973cdd651d19b14efa5f114b364fa885cf8d68f0472`; source digest and individual SQL pins remain those in section 2.

The ownership failure was confined to an ignored task-local assertion requiring literal quotes. The existing archive was revalidated with exact object/owner semantics, not replaced; its receipt was 59.327 seconds old at invocation and checked again under lock. A task-wrapper `Result`-versus-JSON-array comparison was also corrected after all persisted values matched. No maintained migration code or successful migration was changed. The durable ownership validation contract is recorded in section 6 below; do not make maintained tests depend on ignored task helpers.

Sanitized local evidence retained under `test-results/e1p-p4b-r1/`: `REPORT.md`, `migration-execution.json`, `backup-verified.json`, `durable-summary.json`, `durable-after.json`, `preservation-after.json` and `focused-tests.json`. The earlier `test-results/e1p-p4b/REPORT.md` records the stopped pre-migration attempt and is superseded for current status by this successful continuation. This documentation update reuses those receipts and the owner's confirmed outcome; it performs no new hosted inspection.

**No evaluation Git push or Vercel deployment has occurred; authenticated hosted application acceptance/E1E remain pending.** Operator changes were uncommitted at migration completion. The separately authorized E1P-P5A local publication checkpoint captures the reviewed operator, tests, playbook and this handoff; resolve its exact SHA from Git and the local P5A report rather than inventing a self-reference. Protected unrelated work remains excluded. The database prerequisite is complete; publication still needs explicit push/automatic protected Preview authorization. No new migration, backup or fixture work follows from this handoff. Data API disabled evidence retains its accepted owner-reported scope; independent saved-state reload remains unconfirmed.

### E1P-P5A publication procedure - future separate authorization

Read the playbook first. Verify the approved full publication SHA on `feature/development`, the expected two-commit range from the freshly observed remote feature tip, unchanged `main`, the GitHub destination and fast-forward ancestry. Use a clean detached temporary worktree or reviewed equivalent commit-tree verification without resetting/stashing the primary checkout's protected pending work. Check effective Git push hooks; never invoke a local migration/fixture script as publication setup. Pin the explicit source SHA and destination `refs/heads/feature/development` in the future push command. No force push, merge, Production update or extra CLI deployment.

After separately authorized push, observe the single Git-triggered Vercel Preview build; confirm its actual source SHA, Preview environment, Ready result and effective Vercel Authentication. Reuse unchanged baseline configuration and the completed 24-entry migration receipt; do not repeat migrations/backups or rediscover Dashboard settings. Follow the existing one-attempt evidence-access fallback and label inaccessible metadata. Before any E1E, perform one lean owner-led authenticated read-only smoke check with an existing approved session (for example, open Student Research Submissions and check ordinary navigation). No fixture creation, manuscript/evaluation mutation, notification/AI activation or E1E is authorized by publication. Stop on a concrete defect and report it narrowly.

## Historical P4A preparation result

**READY FOR GUARDED PREVIEW MIGRATION APPROVAL** was the P4A outcome. Operator preparation and focused testing only: no hosted backup, migration, grants, fixture writes, publication, staging or commit occurred in P4A. The new hosted `--inspect` command completed inside an explicit repeatable-read READ ONLY transaction. The following record supplements preserved E1P-P3/P3R evidence without changing its historical classification.

## 1. Scope and target

The playbook, baseline, AGENTS.md and E1P-P3 report were read in the required order. This is Tier C preparation. Existing Vercel routing, variable scopes, protection and build evidence are reused; no Dashboard retry or configuration audit.

Exact approved Preview resource: Supabase project `cbkplqkkjuoglpimwmib`, database `postgres`, OID `5`, native cluster `7678069749886157684`, operator `thesishs_preview_operator`, runtime `thesishs_preview_runtime`. Existing private profile: `C:\ThesiSHS-Private\Connections\preview-operator.env`; credentials remain outside Git and reports. The established profile reserves Production as unprovisioned and identifies a separate Development cluster. No Production connection or resource change occurred.

The operator requires that profile explicitly, validates it through the existing private-file and database-configuration guards, requires verified CA/hostname TLS, the correct direct/session route on port 5432, and the native cluster observation. Local, Production, wrong-project/cluster/role, transaction-pooler and weakened-TLS paths are rejected. No fallback to application `.env`, runtime credentials or Data API.

## 2. Bounded transition and source pins

Execution accepts **only the exact 21-entry 0000–0020 predecessor**. It applies **0021 → 0022 → 0023 together in one outer transaction**, using the existing Drizzle dialect/session/savepoint adapter. Inspection accepts that predecessor or the complete 24-entry 0023 installation. Partial 22/23-entry, divergent, reordered, duplicate or unknown histories are refused; already-installed execution cannot replay migrations. Ledger sequence gaps are valid, and old ledger IDs/hash/timestamps remain part of preservation.

Complete source digest: `f0140057433afdfb912e6da5d785086d16872eb2197de084b7e5e6ed49379f16`.

| Migration | SQL SHA-256 |
| --- | --- |
| `0021_evaluation_templates.sql` | `c25f2a298a40031c1d3601b8c27199b7c0c4a02f45f0a33d93b451bba7acbe18` |
| `0022_submission_evaluation.sql` | `6eede979948ac7cb2476b479c8a756101073e92a0e8d382120e2677afdfb3c24` |
| `0023_co_adviser_evaluation.sql` | `86619dfff7d6caf9b7d862799d3450266e8f250c7a15f98f7c22cb7aed2f2889` |

All nine existing source digests, 24 journal entries/snapshot links and every migration artifact remain intact. No migration, journal or snapshot was modified. The new operator source fingerprints are recorded in ignored `test-results/e1p-p4a/operator-manifest.json`; a later execution approval must review the actual current operator files as well as SQL pins.

## 3. Existing architecture extended

| Path | Change |
| --- | --- |
| `scripts/initialize-preview-database.ts` | Existing migrator/inspector gains one evaluation mode, stronger evaluation target guard and exact old-data/catalog/ACL/sequence/ledger-prefix preservation |
| `scripts/preview-migration-source.ts` | Exact predecessor/installed ledger recognition; source hashes remain unchanged |
| `scripts/preview-schema.ts` | Existing SELECT-only catalog engine gains evaluation snapshots and explicit routine/trigger verification |
| `scripts/preview-catalog-contract.ts` | Eleven finite CHECK representations captured from isolated PostgreSQL, retaining literal content and fail-closed behavior |
| `scripts/preview-evaluations.ts` | Import-safe routine/trigger contract, minimum grants/exposure checks, private fresh-backup validator and single-attempt orchestration |
| `scripts/migrate-preview-evaluations.ts` | Explicit private-profile inspect/execute entry using the existing migrator; no install/build/start integration |
| `tests/preview-evaluations.unit.cjs` | Eleven new offline guard/orchestration/CLI groups |
| `tests/preview-evaluations.postgres.cjs` | Bounded rehearsal on the existing independently verified disposable-cluster fixture |
| `tests/s34b1-preview-supervision.unit.cjs` | One stale query-double parameter lookup corrected so the legacy Web Push fingerprint assertion detects changes with the existing OTP projection |
| `docs/FEATURE_E1PP4A_PREVIEW_EVALUATION_OPERATOR.md` | This preparation and future execution handoff |

No second migration framework or application/UI change. All five protected pending files and the prior untracked E1P-P3 report remain byte-identical.

## 4. Privileges and exact post-state

The read-only hosted preflight passed current role separation, existing runtime prerequisites and the full exact 0020 catalog. E1P-P3R also verified operator schema/ledger/sequence/PLpgSQL/advisory-lock rights, required parent REFERENCES privileges and ownership of the existing Co assignment table. Execution rechecks identity, ownership, catalog and runtime boundaries; unexpected privileges/default ACLs or provider event-trigger effects cause refusal/rollback, never automatic repair.

Only these new runtime rights are granted inside the approved transaction:

- `evaluation_templates`: SELECT, INSERT, UPDATE.
- `evaluation_template_criteria`: SELECT, INSERT, DELETE, matching criterion replacement.
- `submission_evaluation_assignments`, `submission_evaluations`, `submission_evaluation_items`: SELECT, INSERT.
- Three new serial sequences: USAGE only.

Existing Co table rights already cover the two new nullable columns; no Co or old-table grant is added. The new trigger function's default PUBLIC EXECUTE is revoked; runtime trigger firing requires no separate function EXECUTE grant. No other function ACL, blanket table grant, role membership, ownership, schema/database CREATE, runtime history UPDATE/DELETE/TRUNCATE or grant option is added. Effective table/column/sequence privileges and PUBLIC/anon/authenticated exposure are checked, including inherited effects.

Expected post-state: 24 source-matching ledger entries, 29 application tables (24 old plus five evaluation tables), three new unused serial sequences, the two nullable Co fields and exact-version FK/CHECK/assignment composite uniqueness. Newly created evaluation tables must be empty and old Co rows must have null/null evaluation fields at execution completion.

The catalog verifies exact columns/defaults/PKs/FKs/CHECKs/index definitions and health, ownership, RLS, sequences, expression bindings and absence of unexpected objects. For `prevent_submission_evaluation_mutation()`, it checks the pinned body, zero arguments, trigger return type, PLpgSQL, owner, invoker security, strictness/volatility/parallel flags and fixed `pg_catalog` search path. All six trigger names, owning tables, event/timing bits, enabled state, function OID, absence of arguments/WHEN/transition tables and deferral properties must match. Snapshot verification alone is not sufficient for these non-snapshot objects.

## 5. Transaction and preservation

The write transaction uses the established advisory lock `(1296388937, 15)`, ledger SHARE ROW EXCLUSIVE lock and sorted SHARE locks across the 24 pre-existing application tables. Statement, lock and idle-transaction timeouts remain bounded. Identity, source, ledger, catalog, aggregate old-row fingerprints, old ACLs/owners, old sequence values and fresh backup binding are rechecked under lock before any migration statement.

DDL retains the established `search_path=public` because source CREATE statements are unqualified; read-only inspections use `pg_catalog,public`. An initial isolated rehearsal caught and corrected the wrong DDL search path before any hosted execution.

Only the approved Co fields/constraints and new evaluation objects are omitted from old-state comparison. Existing academic/history/credential/notification/Web Push records are fingerprinted inside PostgreSQL without returning their contents. The old ledger prefix, public sequence values and definitions/ACLs are preserved. The entire approved suffix and grants roll back on a failed guard. Every preflight/durable inspection uses an independently created and closed authenticated read-only connection. An uncertain write result causes one durable inspection and stops; it never retries or restores automatically.

## 6. Private hosted backup procedure — future separate authorization

No backup was created, copied or read here. The established custom-format PostgreSQL procedure must be used through the approved Preview session/direct route with strict `verify-full` CA/hostname TLS and a client verified compatible with the observed PostgreSQL 17.6 server. Do not run the local localhost/superuser backup helper against Supabase.

**Maintained ownership validation contract (E1P lesson):** the completed correction lived only in ignored task tooling, not the maintained migration executor. Future authorized backup verification must compare each expected table/sequence's exact schema, name and intended owner, accepting valid quoted/unquoted representations for the supported simple identifiers. Unquoted identifiers fold to lowercase; quoted identifiers retain case. For this predecessor, require exactly 25 table and 19 sequence ownership bindings, not merely those line counts. Reject missing, duplicate, extra, wrong-schema/object/owner or unsupported statements. Do not strip quotes/case indiscriminately or add an unrestricted SQL parser. Any future maintained implementation must bring synthetic positive/denial tests before use; do not import or rerun the ignored one-off migration wrappers.

Minimum offline contract examples: `ALTER TABLE public.users OWNER TO thesishs_preview_operator;` and `ALTER TABLE "public"."users" OWNER TO "thesishs_preview_operator";` identify the same expected binding. Unquoted `PUBLIC.USERS` also folds to that binding; quoted `"PUBLIC"` or `"USERS"` does not. Missing/duplicate bindings, an extra object, a different owner, quoted owner case changes, malformed/unsupported ownership statements and appended SQL must fail. Apply the same exact-identity rule to owned sequences. Preserve archive SHA/header/size, full table/data/sequence inventory, decode, private ACL, recovery and fresh target/source/catalog/data binding checks; ownership attestation alone proves none of them. Existing offline receipt tests already reject stale/future receipts, changed bindings and missing verification flags.

Before later execution:

1. Review the actual operator file fingerprints, approve only this target/suffix/minimum-grant scope, and coordinate a quiet window without terminating other sessions automatically.
2. Obtain a fresh successful `--inspect` result. Create a new private directory outside every Git checkout, with only owner/SYSTEM/Administrators access and no symlinks/reparse redirection. Keep credentials in the existing private profile/password-file mechanism, never command arguments, logs, source or chat. A private public-CA file and child-process `PGSSLMODE=verify-full`/`PGSSLROOTCERT` preserve hostname verification. Use read-only dump sessions and compatible pinned `pg_dump`/`pg_restore` binaries.
3. Export the exact 24 application tables, Drizzle ledger and owned sequences from one consistent snapshot. Record schema/role/owner/ACL restoration prerequisites privately; inventory must exclude unrelated provider-managed schemas/objects and account for extension dependencies. An allowlisted table dump is not a complete Supabase infrastructure/Storage/global-role backup.
4. Verify nontrivial custom-format PGDMP contents, SHA-256 twice, full table/ledger/sequence inventory, full offline `pg_restore --file=NUL` decoding and private ACLs. Offline decoding/checksum checks are not a restore test. Retain the applicable recovery metadata and clean temporary password material reliably.
5. Save a private JSON receipt with `version:1`, scope `preview-evaluation-0021-0023-backup`, `projectRef`, `database`, `databaseOid`, `cluster`, complete `source`, `target`, `catalog`, `preservedData`, `archivePath`, `archiveSha256`, exact sorted baseline `tables`, and ISO `verifiedAt`. Require `inventoryVerified`, `fullArchiveDecoded`, `privateStorageVerified`, `ledgerIncluded`, `sequencesIncluded`, `privilegesRecorded` all true. These verification flags are explicit operator attestations; the loader independently checks private paths, size, header, checksum, pins and binding.
6. The receipt must be at most 15 minutes old and match fresh locked pre-state. Evidence is limited to 64 KiB and archive to 64 MiB. A changed pre-state, expired receipt or larger artifact requires renewed/reviewed preparation, never a bypass or reused 0017/local receipt.

## 7. Proposed execution sequence — NOT executed or authorized here

First obtain explicit owner approval covering the exact target, reviewed current operator source, 0021–0023, listed minimum grants, fresh backup and current disabled-Data-API evidence. Preserve Vercel protection and all existing provider configuration. The disabled-state confirmation is an attestation, not a Data API setting change or independent Dashboard proof.

Read-only inspection, after loading no other credentials:

```powershell
node --import tsx scripts/migrate-preview-evaluations.ts --inspect --profile "C:\ThesiSHS-Private\Connections\preview-operator.env"
```

The actual P4A inspection passed with 21 entries and target fingerprint `cc928dc83012e434a0c6a463fae13708984256aee0375b287d73bf80dac7205f`. Catalog/data fingerprints in `test-results/e1p-p4a/hosted-inspect.json` are time-specific observations, not standing execution approval or a backup receipt.

After the separately authorized backup is verified, execute once from a private interactive terminal. Replace placeholders with the reviewed current inspection fingerprint, private evidence path and verified archive SHA:

```powershell
node --import tsx scripts/migrate-preview-evaluations.ts --execute --profile "C:\ThesiSHS-Private\Connections\preview-operator.env" --confirm-target <reviewed-target-fingerprint> --confirm-source f0140057433afdfb912e6da5d785086d16872eb2197de084b7e5e6ed49379f16 --confirm-data-api-disabled yes --backup-evidence <absolute-private-receipt-path> --confirm-backup <verified-archive-sha256>
```

The operator independently verifies the durable 24-entry installed state, exact catalog/effective grants and preservation after commit. A subsequent `--inspect` can report `already-applied`; `--execute` always refuses replay. Stop after the separately approved migration/readback; no push, deployment, hosted fixture creation or E1E follows automatically.

If a write fails or its commit is uncertain, stop writers and inspect durable state through the read-only path. Retain the private archive/receipt and sanitized failure classification. Never delete ledger entries, replay automatically, downgrade, schema-push, restore or clean academic data. Any recovery/restore decision needs separate authorization after target/artifact validation; prefer a separately approved isolated recovery rehearsal before considering restoration of the target. Unexpected intermediate/partial state requires investigation rather than migration adoption or repair.

## 8. Validation and limitations

- **63/63 offline guards PASS:** 11 new evaluation groups plus relevant existing 0020, 0017 and catalog guards. Covers strict CLI/profile confirmations, target/local/Production/TLS rejection, source/ledger/replay, exact routines/triggers, least privileges/exposure, backup age/binding, locked checks, one attempt, independent durable read and sanitized failures. Source/checksum drift guards do not modify migration files.
- **Isolated PostgreSQL 18.4 rehearsal PASS:** fresh owned cluster `7709837382483054460`, loopback 55451, unique task database; control-file, directory, actor, port, database OID and SQL identity independently matched. Neither approved Preview nor academic Development cluster was used. Existing safe E1CB setup/cleanup fixture was reused without running its feature suites.
- Real mid-0022 duplicate-function failure and deliberate full-suffix rollback preserved the predecessor. Successful same-Drizzle/savepoint/lock/minimum-grant execution produced 24 entries and passed independent catalog/data/ACL/sequence readback and replay refusal. Disabled triggers, missing exact-version FK, excessive runtime UPDATE and PUBLIC function exposure were rejected inside rolled-back test transactions.
- Six direct historical-table UPDATE/DELETE checks and one TRUNCATE check returned SQLSTATE 23514; temporary synthetic rows rolled back and new sequences remained unused. All six trigger bindings were also checked structurally.
- The disposable database was dropped, server stopped, data directory removed and ports freed; generated synthetic passwords were erased from its manifest. Windows denied Node's final directory removal, so native PowerShell removed only the already-stopped, marker/path-verified owned data directory before the existing cleanup completed.
- **Hosted new `--inspect` PASS**, READ ONLY, exact 0020 catalog and existing runtime prerequisites. No hosted evaluation DDL/grants or new installed-catalog acceptance occurred. DDL/canonical evaluation checks were rehearsed on PostgreSQL 18.4; the actual hosted server is 17.6. The hosted write transaction's strict post-state checks remain mandatory and fail closed on any representation/provider difference.
- **TypeScript: 428 roots, zero diagnostics. Focused ESLint: zero warnings.** Node syntax and whitespace/source-integrity checks pass. No production build or broad E1B–E1D suites repeated.

No operator safety blocker remains. Fresh private backup, reviewed current state/source, disabled-Data-API evidence and explicit execution approval are required future execution prerequisites. The same-group non-submitter fixture and actual hosted E1E remain separately pending. No E1E or publication work starts in this checkpoint.
