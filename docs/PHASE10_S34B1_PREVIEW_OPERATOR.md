# S3.4B.1 — Preview migration 0017 operator preparation

**Current-status pointer (2026-11-10):** 0017 and the three minimum grants completed in the [execution receipt](#s34b2c---verified-preview-execution-2026-11-10). Publication and owner-accepted S3.4B.5 PARTIAL PASS supersede pending next actions below; see [current Master Context](MASTER_CONTEXT_UPDATED.md#current-handoff-2026-11-10). Dated preparation sections retain their original scope and evidence limits. The [prevention register](#preview-prevention-register) is the reusable incident reference. No operation is authorized by this handoff.

2026-11-09 (Asia/Manila). **LOCAL SOURCE / OFFLINE PASS. No database operation or hosted connection.**

## Baseline and scope

Verified `feature/development`, HEAD `ff95cd2f00a4ec0df80953c9c47132db2db59b1e`, 53 modified tracked files plus 35 untracked files, empty index. All incoming S3.1–S3.4 application work is preserved. This preparation supersedes only the missing-0017-runner finding in the S3.4B readiness audit; it does not claim hosted readiness, a backup, migration or deployment.

The existing runner supported empty-only initialization and bounded upgrades through 0016. Its legacy source/ledger guards, pinned Preview identity, Postgres.js savepoint adaptation, canonical catalog verifier and independent durable inspection are reused. No second runner, unrestricted Drizzle command, dependency, migration regeneration or academic-rule change is introduced.

## Exact delta

| File | Change |
|---|---|
| `scripts/initialize-preview-database.ts` | Separate 0017 inspect/upgrade arguments, exact baseline, private-backup gate, old-table writer locks, one-migration application, grants and durable verification. |
| `scripts/preview-migration-source.ts` | Recognize and validate exact 17/18-entry supervision ledgers without widening older allowlists or source digests. |
| `scripts/preview-initialization.ts` | Bounded 17→18 orchestration, refusal to replay, preservation/readback and uncertain-state handling. |
| `scripts/preview-schema.ts` | Reuse canonical verifier with 0016 baseline/0017 target; verify initial singleton, empty assignments and unused new sequence. |
| `scripts/preview-supervision.ts` | Private backup binding, read-only catalog-shape gate, minimum/effective privilege and exposure checks; no execution entry point. |
| `tests/s34b1-preview-supervision.unit.cjs` | Focused source, orchestration, CLI, backup, grant, catalog and failure doubles using existing patterns. |
| `docs/PHASE10_S34B1_PREVIEW_OPERATOR.md` | This preparation and future operator handoff. |
| `docs/MASTER_CONTEXT_UPDATED.md` | Append-only current checkpoint. |
| `docs/DATABASE (1).md` | Append-only operator boundary/reference. |

Migration `0017_research_supervision.sql`, snapshots, journal, schemas, application services/UI, existing test files and all configuration remain unchanged from entry.

## Prepared commands — not executed

These examples are a future procedure, **not execution approval**. Even inspect mode connects to hosted PostgreSQL and needs separate scope. Use the private operator process/configuration, never application runtime credentials or secrets pasted into chat/command arguments.

```text
node --import tsx scripts/initialize-preview-database.ts --inspect-upgrade-0017
```

The new inspection uses startup `default_transaction_read_only`, an explicit repeatable-read READ ONLY transaction and a 10-second statement bound. It verifies pinned Preview identity, exact 17/18 ledger, complete relation/column/constraint-name sets, validated constraints, existing operational permissions, catalog/row/sequence/ACL fingerprints and installed-new-object grants/exposure when present. It performs no temporary DDL or grants. A complete 18-entry installation is reported as `already-applied`; partial/mismatched states fail rather than being repaired.

**Superseded by S3.4B.2C.1 below:** 0017 inspection now verifies the catalog contract without temporary DDL and reports `canonicalSchemaVerified: true` and `verificationMethod: "catalog-only"` only after those checks pass. The same checks run on the baseline inside the guarded migration transaction, on the completed target before commit, and during independent durable inspection. Existing 0015/0016 modes retain their historical behavior. A mismatch refuses the operation; no alternate target or permissive repair is attempted.

Future execution, from a private interactive terminal, needs exactly these six option pairs:

```text
node --import tsx scripts/initialize-preview-database.ts --upgrade-0017
  --confirm-target <inspection-target-digest>
  --confirm-source 2e914ebc46baa807051618a2dc6542ec3f859b166bf4a759fca6f7a56a35ef40
  --confirm-data-api-disabled yes
  --confirm-recovery-verified yes
  --backup-evidence <absolute-private-evidence-file>
  --confirm-backup <verified-custom-archive-sha256>
```

The wrapping is illustrative; use the terminal's supported continuation syntax. Missing, duplicate, unexpected or incompatible flags are refused. The 0016 no-backup waiver and account-only recovery modes are not accepted for 0017. No automatic setup, seed, Main designation, backfill or subsequent migration runs.

## Target, source, preservation and transaction guards

- Existing approved Supabase Preview TEST pins: project `cbkplqkkjuoglpimwmib`, database `postgres`, OID `5`, cluster `7678069749886157684`, separate `thesishs_preview_operator` and `thesishs_preview_runtime`. Current live identity is NOT VERIFIED here. Existing explicit configuration profiles, valid CA/hostname verification, direct/session routing and same-transaction authenticated identity checks remain mandatory.
- Aggregate supervision source pin remains `2e914ebc46baa807051618a2dc6542ec3f859b166bf4a759fca6f7a56a35ef40`. Migration SQL SHA-256 remains `155d1cfacb773838133d4bce215c1dbbd4011d277c1f11f7cb7ca0299169a98a`. Every historical hash/timestamp and ordered valid ledger ID must match. Missing/extra/divergent history is refused.
- Execution requires exactly 17 entries through 0016. An existing 0017 ledger is inspectable but never rerun, even when the operator repeats valid confirmation flags. Conflicting/partially initialized objects fail closed; no repair or grant-only resume is implicit.
- The transaction retains the existing migration advisory lock, ledger lock, 3-second lock/10-second statement bounds and fixed public search path. It holds SHARE writer-exclusion locks on all 19 existing application tables before comparing the fresh catalog to the inspected/backup-bound state. All old records (including credentials, groups, memberships, papers, versions, feedback, workspace, notifications and Web Push) are compared through database-side aggregate fingerprints; old definitions/ACLs and sequence values are retained.
- Only source entry 0017 is passed to the installed Drizzle dialect/session migrator through its existing savepoint adapter. Canonical verification expects two added tables, six FK/six CHECK contracts, the partial unique/open-pair and inbox indexes, serial/default/ownership/security properties, exactly one unconfigured singleton at revision 0, zero assignments and unused assignment sequence.
- Only after the exact 18-entry ledger and expected schema exist are the three new grants applied. A postcheck verifies all required/denied privileges and old-data preservation before commit. A separate read-only transaction then verifies the same durable catalog, target, 18-entry ledger and preservation digest. The catalog/digests are not a record export.

## Private backup prerequisite

Use the existing private-file safeguards: evidence and archive must resolve outside every Git checkout and inside a private directory; paths, archive bytes and filesystem errors are never logged. Evidence is limited to 64 KiB and the custom archive to 64 MiB; oversized inputs fail rather than being truncated. These bounds suit the existing small synthetic Preview; an actual larger export requires separately reviewed handling.

The record must be version 1, scope `preview-0017-backup`, with:

| Field | Required value/source |
|---|---|
| `projectRef`, `database`, `databaseOid`, `cluster` | Exact Preview pins above. |
| `source` | Current reviewed supervision aggregate. |
| `target`, `catalog`, `preservedData` | Digests from the unchanged read-only inspection; must still match at execution. |
| `archivePath`, `archiveSha256` | Absolute private custom archive and its SHA-256; bytes must have a nonempty PGDMP envelope and match the separately confirmed hash. |
| `tables` | All 19 table names from `workspaceMigrationSource().snapshot.tables`, exactly once. |
| `verifiedAt` | Valid timestamp no more than 24 hours old and not in the future. |
| `inventoryVerified`, `fullArchiveDecoded`, `privateStorageVerified` | All explicitly true. |
| `ledgerIncluded`, `sequencesIncluded`, `privilegesRecorded` | All explicitly true. |

The operator must first produce a consistent backup, verify its inventory and full offline decoding, and retain the applicable ownership/ACL recovery information privately. The loader verifies path privacy, hash/header, freshness and exact target/source/pre-state binding. Inventory/full-decoding/private-storage claims remain **explicit operator attestations**, not a restore test or proof inferred from a checksum. No backup was created, read or restored in this task. Keep application writers quiet between the inspection, export/verification and execution; changed old rows/catalog/sequences require new evidence, not a bypass.

## Minimum grants and access checks

| New object | Runtime permissions |
|---|---|
| `public.main_adviser_designation` | SELECT, UPDATE |
| `public.co_adviser_review_assignments` | SELECT, INSERT, UPDATE |
| `public.co_adviser_review_assignments_id_seq` | USAGE |

Designation INSERT is operator/migration-only. No DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN, grant option, sequence SELECT/UPDATE, ownership or permanent DDL is added. Effective table and forbidden column-level rights are checked, including inherited/PUBLIC effects. PUBLIC table/column/sequence ACL entries and effective anon/authenticated table/column/sequence access are refused. Excess privileges cause rollback; they are not automatically revoked. RLS/event-trigger differences must pass the existing canonical security contract, not be disabled as an automatic fix. Disabled Data API remains an explicit future operator confirmation, not a setting this CLI changes or independently proves.

The source access review covers designation reads/replacement, assignment inserts/cancellation, immutable plain recommendation completion, exact-submission official closure, feedback/status writes and post-commit notifications. Existing `submissions`/`research_papers` SELECT/UPDATE, feedback SELECT/INSERT, activity/notification INSERT and their sequence USAGE are checked but never granted by the new helper. Existing workspace authorization/row-lock/effective privilege checks remain active. No unrelated role or grant is changed.

## Offline evidence and limits

- **41 PASS, 0 FAIL, 0 BLOCKED, 0 skipped**: 17 new 0017 tests, eight existing 0016 operator checks, eight existing workspace/source checks and eight selected older initialization/0015 CLI/migrator checks. Exact commands are in the ignored `test-results/s34b1-operator-20261109/` receipt.
- TypeScript, targeted ESLint (zero warnings), diff/whitespace and preservation checks PASS. No production build was repeated for these operator-only changes; S3.4B's prior isolated build evidence retains its own scope.
- New coverage includes exact prerequisite, wrong target, SQL checksum drift, incomplete/divergent/reordered ledger, installed/replay refusal, required CHECK/FK/PK names, canonical new-table branches, missing/excess/exposed grants, backup binding and age, one-entry Drizzle savepoint, CLI confirmations/writer locks and failure/uncertain commit without replay or destructive recovery.
- Synthetic session/configuration/identity, database transactions/catalog/parser results, grants and backup file loading are doubles. The real source guards, orchestration, CLI decisions, shared catalog verifier, backup-record validator and installed Drizzle/session code are exercised. **No real PostgreSQL semantics, backup integrity, live role/TLS/pooler compatibility, hosted migration/grants, Storage, browser, deployment or Preview acceptance is claimed.**
- Initial test-only corrections fixed a transcribed checksum and a cross-realm assertion fixture; no migration or application change was needed. These corrected attempts are not unresolved application defects.

## Failure, recovery and future approval boundary

Before any write transaction, missing/invalid backup evidence fails closed. In-transaction schema/grant/preservation errors roll back the single upgrade. An exception or uncertain commit triggers one independent read-only inspection, never automatic replay. An unavailable/mismatched durable result remains unconfirmed with `durableInspectionRequired`; errors retain only safe classifications/schema identifiers. Stop and reconcile exact durable state privately before another attempt. No down migration, ledger deletion, automatic restore, public-table DROP or destructive cleanup is implemented.

Future sequence: review the exact local operator delta/source checkpoint; separately authorize pinned Preview read-only preflight and private backup preparation; resolve actual identity/schema/permission/exposure or backup blockers; separately authorize the exact one-migration/three-grant execution; independently verify durable preservation; only then separately approve application publication/protected Preview deployment and synthetic authenticated/PDF acceptance. A Git push can auto-deploy, so do not publish the new application before schema readiness. Backup verification does not authorize restoration or subsequent synthetic writes.

**Current smallest next action:** owner-authorized read-only revalidation of the pinned Preview target using the new catalog path, alongside current Data API Dashboard evidence described below. Retain and recheck the existing private backup's freshness and target/source/pre-state binding before any separately approved execution. No automatic new export, migration or deployment follows.

References used for existing semantics: [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html), [archive inspection with pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html), the project's Preview playbook/baseline and installed Drizzle/Postgres.js migration implementation. No new migration framework or provider capability was introduced.

## S3.4B.2C.1 - catalog-only compatibility (2026-11-09)

**LOCAL SOURCE / OFFLINE PASS. No database connection, temporary cluster, private-backup access or hosted operation.** Entry baseline: `feature/development`, HEAD `ff95cd2f00a4ec0df80953c9c47132db2db59b1e`, 94 pending paths, empty index. The prior stopped attempt and accepted backup remain historical receipts; this checkpoint does not refresh hosted state.

The old expression verifier created one temporary LIKE table per application table, changed its defaults, added/dropped CHECK constraints, created/dropped temporary indexes, then dropped the table. These operations asked PostgreSQL's parser to canonicalize trusted snapshot SQL; they were incompatible with the no-temporary-DDL checkpoint. They remain reachable through the explicit local verifier and legacy modes. The 0017 operator uses `verifyPreviewCatalog` instead, whose emitted SQL is SELECT only.

The new finite `preview-catalog-contract.ts` compares exact deparsed CHECK/default/index forms against the source-pinned snapshots. It does not strip casts, parentheses, whitespace or literal content, or accept a broad SQL equivalence rule. Four complex CHECK forms reuse the existing reviewed recovery round-trip representations; the other forms are locally authored expectations. No live PostgreSQL deparser was invoked in this checkpoint.

| Contract | Catalog-only gate |
|---|---|
| Target/history | Existing authenticated native identity/TLS pins precede application inspection; all ordered source hash/timestamp/ID checks remain; exact 17 or 18 entries only. |
| Application namespace | Exact tables, columns, relation kinds/owners, RLS flags, collation, column types/nullability/defaults; no identity/generated substitutions, extra routines/types or rewrite rules. |
| Keys/checks/indexes | Exact PK/UNIQUE/FK columns, FK target/schema/actions/match, validation/enforcement/deferral, CHECK text; exact constraint and explicit index definitions plus valid/ready/live/immediate flags. |
| Sequences | Exact public sequence set/properties, serial defaults and ownership dependencies; unused new sequence only during migration postcheck. |
| Triggers/bindings | No noninternal application/ledger triggers; reject custom function/operator/type dependencies in application expressions. |
| Ledger structure | Exact drizzle relations/ownership, columns/defaults, PK/index health, serial ownership/properties; no ledger rewrite rules/triggers. |
| Grants | Existing effective required/forbidden runtime, grant-option and API-role exposure gates remain. TEMP is no longer a prerequisite for the 0017 catalog path. No grant is emitted by inspection. |
| Initial versus installed data | Migration postcheck requires the unconfigured singleton, empty assignments and unused sequence; later installed inspection allows legitimate designations/assignments. Existing preservation fingerprints remain unchanged in format. |

The CLI inspection still uses startup read-only plus repeatable-read READ ONLY, bounded statements and a fixed `pg_catalog,public` search path. Migration execution retains all existing locks, source/backup gates, atomic grants, rollback checks and independent inspection; it is not authorized by this source change.

**Semantic limits:** this is a finite representation contract, not a proof of arbitrary SQL equivalence. A harmless alternate deparser representation will fail closed and require source/catalog review; it must not be automatically normalized away. Full-catalog fixtures are synthetic and partly derived from the same pinned snapshot/contract, so their acceptance does not independently prove every authored form matches the live server. Catalog inspection does not execute CHECKs, rehearse migrations or provider event-trigger effects, or prove hosted transactional behavior. Post-migration schema/security/grant checks and rollback protections remain essential. An installed-state inspection also cannot attest that the original migration began with empty new tables. No historical PostgreSQL concurrency matrix was rerun.

### Current Data API evidence procedure - not executed

Standing owner security policy (2026-11-09): **ThesiSHS AI requires the Supabase Data API to remain disabled in Preview and Production. Database migrations and runtime access must not depend on enabling the Data API.** This applies to development/testing too; no REST/PostgREST fallback is permitted. If enabled is observed, stop and report a policy violation without automatically changing configuration. The separate Storage API retains its own safeguards. `--confirm-data-api-disabled yes` is an attestation, not evidence of the current service setting. SQL grants/RLS, an exposed-schema list, local `api.enabled`, or REST 401/503/PGRST002 responses do not establish that setting.

The supported administrative check is the **Enable Data API** switch on the project's **Integrations → Data API → Overview** page. Under separately authorized read-only Dashboard inspection, select `cbkplqkkjuoglpimwmib`, verify its visible project identity/reference, inspect the switch without changing it, reload the page, and record the disabled state and timestamp in a safe receipt. Capture no API keys, credentials or private records. Missing access or an ambiguous/enabled setting remains BLOCKED; do not toggle it under read-only approval. Owner-operated observation can be recorded as owner-reported, distinct from direct tool observation.

Supabase documents this administrative control in [Disable the Data API](https://supabase.com/docs/guides/api/securing-your-api#disable-the-data-api). The published [GET PostgREST config](https://supabase.com/docs/reference/api/v1-get-postgrest-service-config) response lists schemas/pool settings and potentially a JWT secret, but no enabled-state field. That endpoint alone cannot prove this prerequisite and must not be dumped into logs. No undocumented configuration field or privileged Management API workaround is added.

### Offline verification and preservation

63 tests PASS, 0 FAIL, 0 BLOCKED, 0 skipped: 30 focused catalog cases, 17 existing 0017 cases, eight 0016 operator cases and eight workspace/source cases. Tests cover accepted 19/21-table synthetic catalogs; missing/altered CHECK/FK/UNIQUE/default/index/sequence/ledger contracts; partial 0017, missing/excess/exposed grants and wrong target pins; SELECT-only success/failure paths; explicit local temporary canonicalization; migration/rollback/durable-readback orchestration. TypeScript, targeted ESLint (zero warnings) and whitespace checks PASS. Initial fixture-only failures were corrected; no unresolved executed failure remains.

Changed paths for this checkpoint: `scripts/preview-schema.ts`, `scripts/preview-catalog-contract.ts` (new), `scripts/initialize-preview-database.ts`, `tests/s34b1-preview-supervision.unit.cjs`, `tests/s34b2c1-preview-catalog.unit.cjs` (new), this handoff, `docs/DATABASE (1).md` and `docs/MASTER_CONTEXT_UPDATED.md`. Existing application/migration/schema/source-pin files and the private backup remain untouched. Evidence: ignored `test-results/s34b2c1-catalog-20261109/`. Hosted compatibility and current Data API state remain NOT TESTED here and block execution until separately verified. No commit, push or deployment.


## S3.4B.2C.2 - Resumed hosted read-only result and prevention (2026-11-10)

**Live catalog compatibility PASS; no hosted writes.** Verified pinned Preview project cbkplqkkjuoglpimwmib, postgres/OID 5, native cluster 7678069749886157684 and authenticated operator thesishs_preview_operator over strict CA/hostname TLS via the existing session connection. The catalog-only verifier accepted the complete 0016 baseline and ledger structure. Exact 17 source-matching entries through 0016; no 0017 or partial objects. Existing runtime-role prerequisite/denial checks passed. Target, catalog and preservation digests exactly match the retained private backup checkpoint; archive checksum, private safeguards, retained inventory/decode evidence and under-24-hour loader binding passed. Installed 0017 objects, new grants and provider DDL-trigger behavior remain unexecuted.

Data API: DISABLED according to the owner-provided November 9, 2026 Dashboard screenshot described in the supplied handoff, with OFF/no queryable schemas/project URL matching the pinned project. This is owner-provided evidence, not independently viewed image pixels or an API/database-derived configuration check. Browser inventory identified the correct project Dashboard tab; selecting it failed with a browser-tool timeoutMs error before setting inspection or refresh. Post-refresh saved-state confirmation is NOT CONFIRMED. The standing disabled-Data-API rule above remains mandatory; no toggle or REST/PostgREST request was made.

The server reported default_transaction_read_only=off, while the explicit repeatable-read READ ONLY transaction reported transaction_read_only=on. Two initial receipt-wrapper attempts stopped on an extra default-setting assertion before identity/application inspection; that assertion is not part of the established operator contract. The completed pass retained the verified explicit READ ONLY transaction and SELECT/SET LOCAL guard without changing server configuration or operator source. Its 233 guarded statements completed; no expression mismatch or rejected DDL occurred, and the connection closed. Evidence: ignored test-results/s34b2c2-resume-20261109/. No unrelated suites, backup/export, migration, grants, Storage, Vercel operation or Git write ran.

The consolidated [Preview prevention register](#preview-prevention-register) below retains these causes, proven resolutions and fresh-check triggers without duplicating the incident narratives.

Smallest next action: owner review of this read-only PASS receipt, then separate authorization for the existing guarded 0017 migration and exactly three minimum grants. Fresh source/identity/ledger and unchanged backup-bound pre-state/freshness must still pass immediately before execution. Data API must remain disabled; migration and deployment are not authorized here.

## S3.4B.2C - verified Preview execution (2026-11-10)

**PASS: one separately authorized guarded execution, commit and independent durable inspection.** This result supersedes the pending-execution instructions above. Retained local evidence: `test-results/s34b2c-execution-20261110/verification.json`, `REPORT.md`, `postcheck.json`, `new-object-acls.json` and `preservation.json` (ignored, not committed). The local Git checkpoint reads these receipts without opening a database connection or private credential file.

The authenticated target was project `cbkplqkkjuoglpimwmib`, database `postgres`, OID 5, native cluster `7678069749886157684`, operator `thesishs_preview_operator`. Strict TLS and private-file safeguards passed. The ledger advanced from the exact 17-entry 0016 state to 18 matching entries through 0017. SQL SHA-256: `155d1cfacb773838133d4bce215c1dbbd4011d277c1f11f7cb7ca0299169a98a`; supervision aggregate: `2e914ebc46baa807051618a2dc6542ec3f859b166bf4a759fca6f7a56a35ef40`. No source regeneration or historical migration change occurred.

Durable inspection found 21 application tables, 104 constraints and 46 indexes, including both new supervision tables. The singleton was unconfigured at revision 0; there were zero assignments and the new sequence was unused. Exactly three grant statements implemented the reviewed minimum runtime privileges. Runtime DDL, ownership, TRUNCATE and grant options remained denied; no unexpected PUBLIC/anon/authenticated exposure or new grantee was found. All 19 existing application tables' rows, catalog definitions, ACLs and existing sequence state matched the preserved baseline. There was no retry, temporary DDL, existing application-record write or Main Adviser selection.

The retained 90,056-byte private application/ledger archive was freshly rebound to the accepted pre-state and retained SHA-256 `6a00235e46891365b4abf97e20060fd20ebea508ea44f48a06db13526e4ab02b` before and after execution. Enumeration and full offline decode had passed. It excludes provider-managed schemas, global roles/configuration, extensions and Storage and is not a complete infrastructure recovery backup. No new backup or restore was performed during execution or this Git checkpoint.

Data API DISABLED uses the accepted owner-provided November 9 Dashboard evidence; independent saved-state refresh remains unconfirmed. The permanent disabled-Data-API rule is unchanged. No automatic migration replay, restore or grant adjustment follows this receipt. Authenticated Preview supervision, real private PDF delivery and owner-led Preview acceptance remain pending. Smallest next action: review the local source checkpoint, then separately authorize source publication/protected Preview deployment; a push may trigger deployment. No such operation is authorized by the local commit.


## Preview prevention register

**Consolidated 2026-11-10.** A-F derive from the local/UI and operator handoffs above and [UI formatting correction](PHASE10_S34_UI_HANDOFF.md#s34-ui-formatting-defect-correction-2026-11-09); the owner supplied the local absent-0017 incident and G-L publication/acceptance lessons for this documentation task. This is the existing prevention record expanded, not a new source of progress/configuration truth. Consult only affected rows before implementation/publication. Proposed future checks are distinguished from established resolutions; no unrecorded tool repair is claimed.

| Incident / root cause | Earliest preventive check | Established resolution / approved fallback | Fresh check trigger | Gate or advisory |
|---|---|---|---|---|
| **A. Local acceptance missing 0017:** source schema existed but the actual development database lacked it. | Before schema-dependent local acceptance, identify intended database and applicable applied ledger; source presence is insufficient. | Later UI handoff retains separately authorized local 0017 completion. Do not silently migrate another database or replay it. | New migration, target switch or missing-relation/schema evidence. | Applicable schema-readiness gate; not a reason to audit DB for CSS. |
| **B. FormData CRLF:** native multipart transport normalized the v1 LF marker; exact-LF decoder rejected structured feedback before persistence. | For changed codecs/forms, exercise actual multipart transport plus Action/service validation, not only mocked component success. | Existing codec accepts the known v1 LF/CRLF spellings and persists canonical LF with strict schema/size/rendering rules. No arbitrary HTML/newline normalization. | Feedback codec, form transport, validation or rich-text persistence change. | Application correctness/validation gate; not an infrastructure issue. |
| **C. Operator lacked 0017:** migration support lagged application/schema work. | Before coding a schema batch, check guarded inspect/upgrade compatibility and minimum grants for the exact transition. | S3.4B.1 extended the existing runner for bounded 0016→0017; later execution/durable readback passed. | New migration/operator/source/ledger or grant delta. | Schema/operator security gate; never substitute unrestricted migration commands. |
| **D. Temporary DDL in read-only verification:** parser-based canonicalization created temporary objects. | Inspect emitted SQL and mode against read-only authorization before connecting. | S3.4B.2C.1 added finite exact catalog-only verification; resumed live preflight passed. Explicit READ ONLY was verified; server default read-only=off was not itself a failure. | Verifier/mode/catalog contract or server representation changes. | Read-only authorization gate; no temporary-DDL exception inferred. |
| **E. Data API proof arrived late:** CLI/config/error-code observations did not establish the Dashboard enable switch. | Identify dated correct-project disabled-state evidence before a sensitive operation, and state its limits early. | Accepted owner November 9 disabled-state evidence; independent reload confirmation remains unconfirmed. Use the existing Dashboard procedure when fresh proof is required; never enable API. | Relevant project/service/security setting change, contradiction or operation-specific fresh-proof requirement. | ALWAYS DISABLED security gate; missing independent refresh must be labeled, not fabricated. |
| **F. Windows inherited ACLs:** private connection-directory inheritance failed existing credential-loader privacy checks. | Before an authorized credential-dependent checkpoint, validate intended private directory/files without printing contents. | Separately authorized local ACL correction protected Connections while retaining authorized-account/SYSTEM/Administrators access; existing checks passed all seven files. | Profile location, ACL/inheritance/account changes or loader denial. | Credential privacy gate. Never weaken the check or auto-rewrite ACLs. |
| **G. Vercel/browser bridge unavailable:** authenticated inspection tooling failed before evidence could be read. | One approved channel attempt; classify access failure before debugging application behavior. | Accepted fallback: retained configuration evidence and owner Dashboard screenshots/owner-led acceptance. No successful bridge repair is established here. | Changed required fact or new viable authorized channel; no repeated retries for the same unchanged check. | TOOLING/EVIDENCE ACCESS; only a material unmet requirement blocks its dependent action. |
| **H. Branch mapping rediscovered:** accepted environment mapping was not reused at publication. | Read baseline before publication: repository, feature branch, Production main and unassigned-branch Preview tracking. | Reuse accepted November mapping with change-sensitive confirmation; no per-release rediscovery. | Git integration, branch/custom-environment/routing changes or contrary evidence. | Correct deployment destination is a gate; repeated unchanged screenshots are not. |
| **I. Variable scopes rediscovered:** reusable names/scopes were not consulted. | Compare feature dependency delta against baseline's 16-entry Preview inventory. | Reuse accepted count/scope evidence and code-backed identifier list; inspect only new/changed names/scopes. Masked correctness remains unproven. | Added/renamed variables, scope/value/target/origin changes or runtime contradiction. | Affected configuration/secret scope is a gate; complete inventory repetition is not. |
| **J. Public CA advisory:** certificate visibility warning was initially treated as possible deployment failure. | Determine whether the advisory concerns the intended public CA certificate; separate it from actual TLS diagnostics. | Accepted classification: public-CA visibility alone is nonblocking; retain strict trust/hostname checks. No certificate replacement is established or prescribed. | Different material, wrong CA/target, credential/private-key exposure or real TLS error. | Nonblocking advisory alone; actual trust/secret failure is a security gate. |
| **K. Fixtures rediscovered:** account/version inventory was not carried forward across checkpoints. | Look up baseline fixtures and necessary current role/status before proposing creation. | Reuse owner-confirmed users 1-4, group/paper 1 and historical versions with explicit mutation authorization. v5 Under Review is not completion proof. | Account/authority/status changes or missing/unsuitable fixture; then request only needed facts. | Data preservation/authorized mutation gate; no casual reset or recreation. |
| **L. Comprehensive preparation repeated:** prior scoped PASS was treated as absent despite unchanged dependencies. | Name changed risk and compare prior evidence before selecting checks. | Owner-approved release policy/playbook: focused delta tests, retained evidence and owner-led hosted acceptance. | Affected shared dependency, new failure, contradiction or separately scoped Production readiness. | Process correction; unchanged noncritical evidence is not a new security gate. |

The [playbook](THESISHS_PREVIEW_DEPLOYMENT_PLAYBOOK.md) owns future actions and approval boundaries; the [baseline](VERCEL_PREVIEW_BASELINE.md) owns configuration/fixture facts. Pending-action wording in earlier dated operator sections is historical: 0017/three grants completed per the execution receipt, and publication/accepted-scope closure is recorded in [current Master Context](MASTER_CONTEXT_UPDATED.md#current-handoff-2026-11-10). No future migration, grant, profile change or hosted test is authorized by this register.
