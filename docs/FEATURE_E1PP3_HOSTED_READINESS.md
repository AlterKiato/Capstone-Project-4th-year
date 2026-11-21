# E1P-P3: Hosted Preview evaluation migration readiness

> **Historical / superseded (archived in place, 2026-11-21):** The blocked status and command plans below describe the P3 checkpoint of 2026-11-19 and are not current execution instructions. See the [P4B completion handoff](FEATURE_E1PP4A_PREVIEW_EVALUATION_OPERATOR.md#current-handoff---e1p-p4b-complete-2026-11-19) and [E1E hosted acceptance](FEATURE_E1E_HOSTED_ACCEPTANCE.md); follow current canonical handoffs for future work.

2026-11-19, Asia/Manila. **BLOCKED — HOSTED IDENTITY/ACCESS NOT VERIFIED. DO NOT MIGRATE.** This checkpoint authorizes inspection and inert preparation only. No hosted connection, backup, migration, grants, fixture operation, push or deployment occurred. This document is the fallback design/command plan; no executable evaluation migration operator was added.

## 1. Git checkpoint and preservation

- Branch: `feature/development`; HEAD: `0ffb68fb44fa7a154a5854575629395a573f2e2e`.
- Commit: `feat(evaluation): complete research evaluation workflows`; its exact 86 paths match the approved E1P-P1 manifest.
- Index empty; local feature branch 1 ahead / 0 behind both its tracking ref and the freshly observed remote feature tip `a9d4fa5ce75e1a4fc29cf95ea913b4a3d5c176b2`.
- Fresh remote `main`: `a364f6fed1e37ded1a9ed3fcd0f811c3dea566de`; local `main`: `1bd0747a7f6837cdebd8c92045461c051528e5cd`. These are different existing refs, neither changed here.
- All 770 incoming file fingerprints, including `.env`, are preserved. The three protected documents remain modified and unstaged; the two protected developer scripts remain untracked. Their bytes still match the preceding checkpoint.
- Protected: `docs/MASTER_CONTEXT_UPDATED.md`, `docs/PHASE10_STUDENT_EMAIL_OTP.md`, `docs/SOURCE_OF_TRUTH_UPDATED.md`, `scripts/groq-developer-test.cjs`, `tests/ai-p212-developer-groq.unit.cjs`.

## 2. Configuration evidence and access boundary

| Subject | Current observation | Evidence limit |
| --- | --- | --- |
| Vercel identity | Browser inventory lists an existing deployment Dashboard under team `thesi-shs-ai`, project slug `thesishs-ai`, deployment `HFsV24AeVWGzfErGCPFfiXyJv8zQ` | Tab URL/title only; project ID, environment, status and deployed SHA were not inspected |
| Supabase identity | Browser inventory lists the schema Dashboard for project ref `cbkplqkkjuoglpimwmib` | Open tab alone does not bind effective Preview PostgreSQL credentials to that resource |
| Authenticated inspection | First Vercel tab read failed: `Cannot read properties of undefined (reading 'timeoutMs')` | TOOLING / EVIDENCE ACCESS; no retries or browser repair; Supabase page contents were not read |
| Local configuration | Only `.env` found; PostgreSQL target `localhost`, database `thesishs_ai`; no `THESISHS_DATABASE_ADMIN_URL` | Development only; no database connection was made |
| Other connection channels | No relevant database/Vercel/Supabase connector, Vercel CLI, or process database/Preview credentials available | No hosted SQL identity or catalog inspection possible through the available channels |
| Preview routing / protection | November baseline: `feature/development` uses Preview, `main` uses Production, Vercel Authentication enabled | Historical accepted evidence; no fresh settings verification in this checkpoint |
| Preview variables | Existing names documented in the baseline; evaluation adds none | Current names/scopes and values not inspected; do not reuse the historical count of 16 as current inventory |
| Data API / isolation | Existing policy requires disabled Data API and independent Production isolation | Current disabled setting, actual Production assignment or unprovisioned reservation, and physical isolation remain unverified |

No values, URLs containing credentials, tokens, cookies or personal record contents were exported. Local Supabase configuration is not proof of the deployed database assignment. No REST/PostgREST fallback was attempted. The prior E1P-P1 anonymous SSO redirect retains only its original protection evidence scope; no new anonymous probe was needed.

## 3. Hosted identity and actual ledger

**Current hosted database host, name, current/session roles, OID, cluster, ledger, evaluation objects, ownership and privileges: NOT VERIFIED.** No hosted SQL query ran. No Preview/Production isolation conclusion can be drawn from a database name, local profile, open Dashboard tab or historical project reference.

Historical operator pins, for later comparison only: Supabase project `cbkplqkkjuoglpimwmib`, database `postgres`, OID `5`, cluster `7678069749886157684`, operator `thesishs_preview_operator`, runtime `thesishs_preview_runtime`. The E1P-P1 preflight records historical OTP evidence of 21 matching entries through 0020. Neither assertion is refreshed here. Local 24-entry activation is a separate database and proves no hosted application.

The next authorized inspection must establish effective Preview runtime project/branch/environment metadata and the PostgreSQL project route independently. Use `databaseConfiguration(..., "operator")`, validated CA/hostname TLS, direct or session port 5432 routing, and `verifyDatabaseIdentity`. Confirm distinct non-elevated runtime/operator roles, `current_user = session_user`, observed OID, and cluster where permitted. Provider-route fallback requires independent authenticated control-plane project evidence. Compare Production's independent resource identifiers, or confirm the established unprovisioned Production reservation; do not provision or connect to Production for this checkpoint.

## 4. Reviewed source and exact conditional suffix

Offline checks passed for all nine bounded source accessors, 24 ordered journal entries and 24 linked snapshots. Existing migrations were not modified. Complete source digest: `f0140057433afdfb912e6da5d785086d16872eb2197de084b7e5e6ed49379f16`.

| Migration | SQL SHA-256 | Journal timestamp |
| --- | --- | --- |
| `0021_evaluation_templates.sql` | `c25f2a298a40031c1d3601b8c27199b7c0c4a02f45f0a33d93b451bba7acbe18` | `1794939715904` |
| `0022_submission_evaluation.sql` | `6eede979948ac7cb2476b479c8a756101073e92a0e8d382120e2677afdfb3c24` | `1794970053461` |
| `0023_co_adviser_evaluation.sql` | `86619dfff7d6caf9b7d862799d3450266e8f250c7a15f98f7c22cb7aed2f2889` | `1794977696276` |

Actual pending migrations are **UNKNOWN**, not confirmed as all three. After verifying every ordered hash/timestamp and positive increasing ledger ID, recognize only these exact source-compatible states:

| Verified ledger | Candidate pending suffix, subject to exact catalog checks |
| --- | --- |
| 21 entries through 0020 | 0021, 0022, 0023 |
| 22 entries through 0021 | 0022, 0023 |
| 23 entries through 0022 | 0023 |
| 24 entries through 0023 | None; inspect schema/grants, never replay |
| Any other or conflicting state | Stop; older prerequisite work, unknown hashes, partial objects or drift require separate review |

## 5. Structures, compatibility and grants

Source-only additive delta:

- 0021: `evaluation_templates`, `evaluation_template_criteria`, one serial sequence, owner/criterion FKs, CHECK/unique constraints and owner/archive index. No pre-existing table definition changes.
- 0022: `submission_evaluation_assignments`, `submission_evaluations`, `submission_evaluation_items`, two serial sequences, restrictive FKs to submissions/users/feedback and between evaluation tables, constraints, `public.prevent_submission_evaluation_mutation()` and six UPDATE/DELETE/TRUNCATE prevention triggers. No pre-existing table definition changes.
- 0023: nullable `evaluation_assignment_id` and `evaluation` on existing `co_adviser_review_assignments`; unique `(id, submission_id)` on evaluation assignments; exact-submission composite FK and paired-null/state/JSON CHECK. Removing these exact additions reproduces the preceding snapshots. Existing rows receive null/null, which satisfies the new CHECK; source has no academic data backfill or destructive data statement.

Hosted existence/conflicts, prerequisite PKs/FKs, function privileges, constraint validation, owners, RLS, event triggers, default ACLs and lock compatibility remain unknown. Absence of migration DML does not certify live compatibility or lock availability. Inspect all affected structures against the exact observed prefix, including PostgreSQL-truncated constraint names. Do not adopt pre-existing unrecorded objects or disable security to make the comparison pass.

Minimum runtime privilege proposal, based on current repository operations; these are requirements to inspect, not grants issued:

| New object | Required runtime rights |
| --- | --- |
| `evaluation_templates` | SELECT, INSERT, UPDATE |
| `evaluation_template_criteria` | SELECT, INSERT, DELETE for criterion replacement |
| `submission_evaluation_assignments` | SELECT, INSERT |
| `submission_evaluations` | SELECT, INSERT |
| `submission_evaluation_items` | SELECT, INSERT |
| Three new serial sequences | USAGE only |

Preserve existing current-Main/account/submission locking and feedback/audit/notification privileges. Existing table-level Co assignment rights may already cover new columns; inspect effective table and column rights before proposing additions. Check SELECT requirements for RETURNING. Verify the trigger function's exact signature/body/language/search path/security/ownership and execution requirements without blanket function grants. Deny runtime ownership, schema/database CREATE, grant options and extra destructive privileges; verify inherited/PUBLIC/anon/authenticated exposure as well. No broad all-table grants or grant-only repair is authorized.

## 6. Inert hosted operator design and command plan

**No hosted evaluation executor exists or was added.** `applyPreviewMigrations` and `inspectPreviewState` in `scripts/initialize-preview-database.ts` stop at 0020. `scripts/preview-schema.ts` and `preview-catalog-contract.ts` also lack evaluation contracts; current schema checks reject application routines/triggers. Source accessors for 0021–0023 are not executor support. Local evaluation helpers must retain their localhost-only guards and must never be used on Supabase.

Once identity and prerequisites are established, prepare the smallest extension of the existing Preview operator:

1. An explicit inspect mode with no mutation path: fail closed before connection without an approved Preview operator profile; preserve strict TLS, environment agreement and independent Production isolation. Use startup read-only plus explicit repeatable-read READ ONLY and bounded statement/lock/idle timeouts. Run SELECT-only catalog checks, never temporary canonicalization DDL. Recognize only exact 21–24-entry prefixes and their catalogs, including the function/triggers omitted by Drizzle snapshots. Reject local/Production targets.
2. Separate execution entry requiring a reviewed pending-list/source/target/pre-state fingerprint, current disabled-Data-API evidence, private fresh backup receipt and explicit owner approval. Pin each SQL hash, journal and snapshot identities. Reject already-applied or unexpected state; no auto repair, grants-only resume, retry or restore.
3. One outer transaction with the established advisory lock `(1296388937, 15)`, ledger writer-exclusion lock and deterministic SHARE locks over pre-existing application tables; take any reviewed stronger DDL locks through the migration itself. Recheck identity, ledger, catalog, sequence values, old-row aggregate fingerprints and backup binding under lock. Use bounded timeouts; abort rather than terminate other clients.
4. Pass only the verified missing suffix in order to the installed Drizzle `PgDialect.migrate` procedure using the existing transaction/savepoint adapter. Never use unrestricted folder migration, `drizzle-kit push`, manual schema SQL, seed/bootstrap, down migration or ledger edits. Catalog/grant checks and preservation must pass before commit.
5. Independently reconnect read-only after the attempt, including after uncertain commit, to verify durable target/ledger/catalog/runtime rights and preservation. Never interpret a failed client response as permission to replay. Keep original constraints, owners, ACLs, rows, sequence state and ledger prefix preserved except the explicitly approved additive delta.

Planned command sequence, deliberately without an executable migration filename or credentials: privately load the approved operator profile -> run the reviewed read-only identity/catalog/fixture inspector -> obtain the exact missing suffix and fingerprints -> separately authorize backup preparation -> verify fresh private artifact -> separately authorize the pinned operator/suffix/minimum grants -> execute once -> independently inspect durable state. No execution command can safely be filled in before those facts and reviewed operator support exist.

A minimal future read-only SQL packet inside the verified operator session starts with:

```sql
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = pg_catalog, public;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '3s';
SELECT current_database(), current_user, session_user,
       (SELECT oid::text FROM pg_database WHERE datname = current_database()) AS database_oid,
       current_setting('transaction_read_only') AS transaction_read_only,
       current_setting('server_version_num') AS server_version_num,
       has_function_privilege(current_user, 'pg_catalog.pg_control_system()', 'EXECUTE') AS can_read_cluster;
SELECT to_regclass('drizzle.__drizzle_migrations') AS ledger;
-- Only after ledger presence and target identity are verified:
SELECT id, hash, created_at::text FROM drizzle.__drizzle_migrations ORDER BY created_at, id;
COMMIT;
```

This packet was not run and does not replace full profile/identity/catalog guards. Read `pg_control_system().system_identifier` only if permitted. Add bounded SELECT catalog checks for tables, columns, constraints, indexes, sequences, routines/triggers, effective ACLs and aggregate preservation, and metadata-only fixture queries. Do not run the legacy 0020 inspector blindly against an unknown newer schema or infer catalog validity merely from ledger count.

## 7. Backup and recovery plan — not executed

Hosted backup/PITR availability, retention and current restorable points are unverified because provider settings were inaccessible. Do not assume a paid backup feature exists. No archive, credential file or backup directory was created or read here.

Reuse the established guarded custom-format PostgreSQL procedure only after adapting and verifying hosted compatibility: provider session/direct route with strict `verify-full` CA/hostname TLS; server/client major compatibility; role permissions and ownership/ACL recovery coverage; application/ledger allowlist derived from the accepted pre-state; safe handling of provider-managed schemas and extensions. The local helper hardcodes localhost, local database/superuser and PostgreSQL 18, so it cannot be executed unchanged against Supabase. The old 0017 backup validator is scoped to its old target/source/table set and cannot certify this transition.

Separately authorized preparation must create a fresh private archive outside every Git checkout, owner/SYSTEM/Administrators-only ACLs, no credentials in command arguments/output, a private temporary password mechanism and reliable cleanup. Include accepted application data/schema, ledger, sequences and required routine/trigger/ACL/ownership recovery information. Validate PGDMP header, nontrivial size, SHA-256 twice, complete expected inventory and full offline `pg_restore --file=NUL` decoding. Bind an evidence receipt to actual target, source, ledger/catalog/data/sequence fingerprints and a reviewed short freshness window; recheck before execution while writers are quiet. Decode/checksum evidence is not a restore test.

Recovery is manual and separately authorized: stop writes, independently inspect durable migration state, validate the matching artifact and ownership/ACL dependencies, and review restoration to a separately approved isolated recovery resource before any target restoration decision. Never automatically restore into Preview or contact Production. A database archive does not include Supabase Storage, provider-managed infrastructure or global roles/configuration unless explicitly documented; preserve those separate resources without changing them.

## 8. Hosted E1E fixtures — unavailable for current inspection

Historical inventory only: Admin user 1, Main Adviser 2, Student 3, Co-Adviser 4, group/paper 1, submission 4/v4 with Revision Required feedback, later v5 reported Under Review without a supplied ID. Current activity/role, Main designation, original submitter/membership, exact version/status and valid delegation are unknown. A non-submitter Student is not established. No private recommendations, student manuscripts, emails or password/token fields were queried.

After identity is verified, inspect only opaque IDs and eligibility booleans/statuses for these existing synthetic records, including current Main authority and Co assignment scope. Reuse an eligible version and original submitter; do not reset/finalize old submissions or infer an open delegation. If a second Student or safe eligible version/delegation is absent, request separate authorization for only that missing synthetic fixture or state transition, preserving all existing history. No fixture writes or E1E execution now. Future finalization/delegation can produce audit/in-app notification/Web Push side effects; obtain explicit scope then. Do not invoke AI/email providers or change their existing configuration.

## 9. Validation, files and smallest next action

- PASS: three existing offline 0020 operator guard tests in `tests/phase10-email-otp-migration.unit.cjs`; these verify existing approval/replay/preservation and bounded Drizzle-selection behavior using doubles, not evaluation support or hosted PostgreSQL semantics.
- PASS: source hashes, all nine source prefixes, 24 journal/snapshot links and bounded additive snapshot comparison for 0021–0023. No broad E1B–E1D suites or build repeated.
- No operator code changed, so new-operator syntax/lint is not applicable. Hosted identity/catalog/privileges/fixtures and new evaluation operator guards remain NOT TESTED.
- New reviewable file: `docs/FEATURE_E1PP3_HOSTED_READINESS.md` only. Ignored checkpoint evidence is under `test-results/e1p-p3/`; no existing source, migration, environment or protected file changed. No staging or commit.

Smallest owner-side action: make the existing authenticated Vercel/Supabase Dashboard inspection channel readable, or supply sanitized metadata from those Dashboards. Confirm Vercel project ID/repository, feature branch Preview mapping, main Production mapping, protection and effective variable names/scopes; show only non-secret database endpoint/role/project identity. Confirm current Supabase Data API disabled state and the separate Production resource identifiers or unprovisioned reservation. Do not paste passwords, full connection URLs, variable values, CA/private files, tokens or backup contents into chat.

Then make the existing approved Preview operator profile available through a private local operator process outside Git, including admin URL, target profiles, connection mode and trusted CA, or owner-run the reviewed read-only identity packet and provide sanitized output. Do not copy credentials into the application's `.env` or hosted runtime. Obtain actual ordered ledger/catalog/effective-grant/fixture evidence before selecting the pending suffix and implementing a bounded runnable operator. Backup preparation, hosted execution/grants, publication and E1E each remain separately authorized steps.

**Final verdict: BLOCKED — HOSTED IDENTITY/ACCESS NOT VERIFIED. DO NOT MIGRATE.** No confirmed source/migration integrity defect was found; missing current target/access and hosted evaluation operator support prevent readiness approval.
