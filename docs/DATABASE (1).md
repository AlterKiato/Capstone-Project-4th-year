# ThesiSHS AI --- Database Reference

**Purpose:** Database/schema reference for AI agents and developers.

**P.3E.2 / P.3F.0 status (2026-11-01):** migration 0015 is **verified only in a fresh disposable PostgreSQL 18.4 cluster**, not applied to any existing local/hosted project database. Twenty real checks passed: exact 16-entry ledger, additive table/constraints, prior 16-table catalog preservation, non-owner runtime permissions, DB-clock/session/browser expiry, independent-connection races and generation-safe erasure. Complete owned-resource cleanup is recorded in ignored evidence; no capability/credential/cluster artifact is committed. F.0 reran only offline smoke/integrity checks, not SQL. Historical 0000-0014 SQL/snapshots and journal prefix are unchanged.

The [owner checklist](PHASE10_P3_ACTIVATION_CHECKLIST.md#migration-0015--proposed-execution-gate-not-executed) distinguishes empty initialization from existing 15-to-16 upgrade, with exact historical identity pins, fresh owner revalidation, backup/recovery, minimum grants and durable failure handling. No supported reviewed existing-Preview upgrade command exists yet; preparation requires separate scope, and execution needs explicit approval. Runtime push needs SELECT/INSERT/UPDATE on the new table plus the established users row-lock prerequisite (SELECT and UPDATE on at least one column; isolated tests used updated_at). Hosted default grants/Data API/RLS/provider trigger effects remain unverified. Do not weaken latest full-ledger checks or replay the historical 0014 runner. Older no-PostgreSQL-verification statements below describe their earlier checkpoints.

**P.3D local delivery integration (2026-11-01):** no schema, migration, snapshot, journal, source-pin or grant changes, and no database connection/execution occurred. 0015 remains prepared **NOT APPLIED**. The new `push-delivery.repository.ts` uses existing runtime SELECT/UPDATE permissions only: a current active-role/enabled/key-ID/lease-filtered joined lookup, then optional conditional 404/410 cleanup by exact captured user/generation/endpoint. Cleanup rotates the disabled generation and nulls endpoint, p256dh, auth, key ID and both expiration fields; it cannot erase a newer enrollment. No provider I/O occurs inside a database transaction and no academic data is mutated by delivery.

Delivery transactions request local 250ms lock and 750ms statement timeouts, with deadline checks between phases. These do not cap pool acquisition, connection/guarded identity checks before timeout setup or commit acknowledgement. The current guarded adapter has no exposed query-cancellation handle; promises are awaited rather than abandoned. A three-second attempt is a target, not an absolute DB cancellation guarantee. PostgreSQL execution, actual grants/constraints/concurrency and hosted timing remain unverified. Default-disabled/unconfigured delivery avoids importing/using the runtime delivery service. Existing migration execution/security gates and the P.3C.1/C.2 persistence contract remain authoritative.

**P.3C.2 client handoff (2026-11-01):** no schema/migration/source-pin changes or database access occurred. 0015 remains prepared, unapplied and byte-identical to P.3C.1. The client uses the existing GET/POST/DELETE JSON contract and captured generations. An optional `X-ThesiSHS-Push-Account` precondition must match the verified session user; it grants no identity/role authority and prevents stale account-context requests. Default-disabled pages avoid automatic subscription API reads; before separately approved application of 0015, explicit persistence operations can safely return 503. Live constraint/concurrency/grant verification remains unperformed.

**Prepared source checkpoint (P.3C.1, 2026-11-01):** additive `0015_push_subscriptions.sql` and its Drizzle snapshot/journal entry are generated and reviewed locally, **NOT APPLIED**. The current source contains 16 migrations; existing database evidence through 0014/15 ledger entries below is historical applied-state evidence and is not upgraded by this source change. No local/hosted database connection occurred in P.3C.1.

`push_subscriptions` has UUID `id` as generation, unique non-null `user_id` (users FK, delete cascade), non-null `enabled`, unique nullable bounded `endpoint`, nullable `p256dh`, `auth`, `vapid_key_id`, `authorized_until`, `browser_expires_at`, and non-null created/updated timestamps. Four CHECKs require complete enabled material, capability-free disabled rows, bounded HTTPS/key syntax and coherent expiration. PK/user/endpoint constraint indexes are sufficient; no device, IP, research or analytics fields/indexes. API/service validation additionally checks the P-256 point and narrow provider policy. Disabled rows retain only a generation barrier; expiry comes from the verified session `exp`, capped by optional browser expiry.

Migration-source pins and latest-ledger verification now require exactly 16 matching hashes/timestamps. A database still at 15 entries is intentionally refused by latest operator recognition. `preview-schema.ts` already derives its exact contract from the pinned snapshot and needs no code change. Empty-only Preview initialization remains empty-only and is not an upgrade tool. Its existing advisory-lock namespace is preserved. The historical 0014 safety/runner remains unchanged and fails closed against newer source; never replay it for 0015.

**Minimum future execution procedure (not authorized or executed):** review/hash the complete 0015 diff and immutable 0000-0014 prefix; confirm the exact target and distinct operator, verified TLS/identity and private backup/recovery prerequisites; inspect a ledger matching precisely the first 15 reviewed entries and the existing catalog; take an operator transaction/advisory lock, recheck the target/ledger, apply only 0015 through the supported migrator and verify the new table/constraints and exact 16-entry ledger before commit, followed by independent durable verification. An uncertain acknowledgement requires inspection, not retry. Review runtime SELECT/INSERT/UPDATE grants and any hosted default grants/Data API/RLS exposure before activation; grant neither browser/anonymous access nor runtime DDL. This procedure needs a separately reviewed bounded execution command/harness and owner authorization. No new migration framework was added.

**Latest schema checkpoint (2026-10-23):** Local migration 0014 is APPLIED and verified on the approved development/test database; all 15 ledger entries 0000-0014 match source hashes/timestamps. The initially empty `submission_upload_intents` table has three restrictive FKs, four unique constraints, eight validated/enforced CHECKs, its primary key and two explicit indexes (seven indexes including constraint backing). Existing migration SQL/snapshots 0000-0013, academic records/schema and public sequences were preserved. Earlier unapplied/preparation reports below are historical.

**Current operations checkpoint (2026-10-23):** Phase 10.2C closure on `feature/development`, parent `556dde189d5881fc32258ef8c68ad4842b7d93c3`; resolve its commit using `git log -1 --oneline`. The distinct local operator and genuine private backup/disposable recovery verification passed; the verified run-owned restore was removed and backup/evidence retained outside Git. Checkpoint H applied only 0014 once with `applied-confirmed` and independent durable read-back; the ledger sequence advanced 14 to 15 as expected. No production/Preview database is established. Closure reuses that evidence and does not reconnect or execute migrations. See the [approved Preview-first roadmap](MASTER_CONTEXT_UPDATED.md#approved-phase-10-roadmap-2026-10-22).

**Development Storage status (checkpoint I, 2026-10-23):** The previously owner-approved project fingerprint `2df59fc572539320` and existing private `research-submissions` bucket were verified. Exactly two metadata fields changed: `allowed_mime_types` from NULL to `["application/pdf"]`, and `file_size_limit` from NULL to `10485760`; independent read-back confirmed all other returned bucket metadata unchanged. No policy/object operations occurred. Storage policy catalog visibility is **NOT VERIFIED** by explicit owner deferral; metadata is not proof policies are unchanged. Live signed uploads, anonymous private-document denial, unrelated-path capability isolation and CORS remain **NOT VERIFIED**. Verify anonymous denial/path isolation before Preview testing and the policy catalog before production approval. Preview and production are **NOT DEPLOYED**.

**Historical Git checkpoint (2026-10-07):** `feature/development`, HEAD `70b8fb4` — `docs(phase5): close Phase 5.4 acceptance`. Phase 5.1/5.2 are committed. Phase 5.3 is complete and runtime-accepted; Phase 5.4 is committed locally; Phase 5.5 source/tests and documentation remain uncommitted.

No Phase 5.3 or Phase 5.5 schema/migration changes were required, generated, or applied. `0009_repository_paper_unique.sql` was applied in Phase 5.4 to the designated development database after safety checks. Phase 5.4 — Repository Publication is complete and runtime-accepted (PASS; completion/documentation audit complete). Phase 5.5 — Repository Document Access is complete and runtime-accepted (PASS). Phase 5.6 — End-to-End Verification & Security Audit and Phase 5.7 — Documentation & Completion Audit are complete. **Phase 5 overall is complete.** Phase 6 — Search, Filtering & Discovery is next and requires explicit owner direction; it was not started in this pass. CI remains deferred. Do not commit or push.

Phase 5.5 repository PDF access uses the existing published repository -> approved paper -> approved submission relationships; no schema changes. Active database-backed Student, Adviser, Admin and Panel accounts may access this published research independently of group ownership. Unpublished research is denied; persisted private paths must match the approved submission paper/version before server-side 300-second signing. This does not grant access to the separate Phase 5.3 ownership-scoped submitted documents. Migration 0009 remains development/test-only; production state is unverified.

**Important:** The database document is a reference to the application's
intended relational model. Always inspect the actual `db/schema/`,
`db/migrations/`, and target database before changing or applying
anything.

------------------------------------------------------------------------

## 1. Database Stack

-   Database: PostgreSQL
-   ORM/query layer: Drizzle ORM
-   Migration tooling: Drizzle Kit
-   Driver: `postgres`
-   Schema source: `db/schema/`
-   Migration source: `db/migrations/`

Offline integrity check:

```sh
npx drizzle-kit check
```

This checks migration history without connecting to a database. Schema generation is a separate authorized change, not a setup or inspection step. Current `drizzle.config.ts` permits only offline check/generate/export and refuses direct database commands, including `drizzle-kit migrate` and `push`. Do not bypass it. Reuse the guarded phase-specific 0014 runner only with separately approved execution, a distinct operator, verified target identity and private backup/recovery evidence. Do not replay historical example commands without current authorization.

------------------------------------------------------------------------

## 2. Core Tables

The current documented relational model contains 11 core tables:

  Table               Purpose
  ------------------- ---------------------------------------------
  `role`              Role definitions
  `users`             User accounts and authentication data
  `research_groups`   Research groups created/managed by Advisers
  `group_members`     Student membership in research groups
  `research_papers`   Research projects
  `submissions`       Versioned research-document submissions
  `feedbacks`         Adviser feedback and review decisions
  `repositories`      Publication metadata for approved research
  `notifications`     In-app user notifications
  `activity_logs`     Audit/activity records

The documentation also refers to 11 core tables while the primary entity
list contains the domain tables above; verify the actual schema files
before assuming an omitted auxiliary table exists.

------------------------------------------------------------------------

## 3. Core Relationships

Conceptual relationship:

``` text
role
  │
  └── users
       │
       ├── research_groups (adviser_id)
       │       │
       │       └── group_members
       │                │
       │                └── users (student)
       │
       ├── research_papers / ownership context
       │
       ├── submissions (submitted_by)
       │       │
       │       ├── feedbacks
       │       └── repositories (through research paper)
       │
       ├── notifications
       └── activity_logs
```

Research flow:

``` text
research_groups
      ↓
research_papers
      ↓
submissions
      ↓
feedbacks
```

Publication flow:

``` text
research_papers
      ↓
repositories
```

------------------------------------------------------------------------

## 4. Roles

Role IDs are fixed by the current application:

    ID Role
  ---- ---------
     1 Admin
     2 Adviser
     3 Student
     4 Panel

Panel is defined in the role model but is not actively implemented.

Do not add, remove, or renumber roles without an explicit project
decision.

------------------------------------------------------------------------

## 5. Submission Versioning

Submissions are versioned per research paper:

``` text
Paper
 ├── v1
 ├── v2
 ├── v3
 └── ...
```

Important integrity rule:

``` text
UNIQUE (paper_id, version)
```

A new submission must create a new version rather than overwrite an
existing submission.

This constraint was part of the Phase 4 implementation and audit.

Phase 5.2 uses a transaction-scoped PostgreSQL advisory lock per paper
to serialize submission eligibility and version allocation through the
storage upload and row insert. The unique constraint remains the
database backstop. Adviser feedback, conditional submission/research
status updates, and activity-log insertion are committed together in a
database transaction. Phase 5.2 required no schema or migration change.

------------------------------------------------------------------------

## 6. Research and Review Statuses

### Feedback content encoding (P.2C.3b, 2026-10-31)

P.2D reconciliation: the owner now accepts rich-text feedback and the later presentation/access refinements. This does not add independent hosted persistence/security evidence. Existing P.2 code stores the versioned string in the same column; no schema, migration or database operation is needed for local closure. See the current P.2D Master Context handoff for distinct owner and automated evidence.

`feedbacks.comments` remains non-null PostgreSQL `text`; no column, constraint, index or migration change. Unformatted new comments and historical records remain literal text. Formatted comments use an explicit `\u001eTHESISHS_FEEDBACK:1\n` prefix followed by a version-1 JSON document. The schema permits only flat paragraph/bullet-list/number-list blocks, lists of inline text runs, and boolean bold/italic/underline marks. This is structured text, not stored HTML. No existing records are rewritten.

`lib/utils/feedback-content.ts` validates the envelope on the Server Action and service paths: nonblank extracted text, maximum 5,000 trimmed UTF-16 code units including block/item newlines, and separately at most 524,288 encoded code units, 256 blocks, 256 items per list and 10,000 total runs. Unknown keys/versions, nested blocks or unsupported nodes fail closed on writes. Future text-only consumers must use `feedbackPlainText`; visible feedback uses the safe shared React renderer. Authenticated identity, ownership, conditional review transitions, atomic persistence/activity logging and notification semantics are unchanged. This checkpoint performs no live database/Storage operation and does not establish actual persistence acceptance.

### Submission status

The application uses the following workflow states:

``` text
Submitted
Under Review
Revision Required
Approved
```

### Research status

The documented research workflow includes:

``` text
Draft
In Review
Revision Required
Approved
```

Status transitions are application-level business rules and should be
enforced by services, not by arbitrary client input.

------------------------------------------------------------------------

## 7. Feedback and Review Records

Feedback belongs to the relevant submission/version.

This preserves the relationship:

``` text
Research Paper
   ↓
Submission Version
   ↓
Adviser Feedback / Decision
```

Feedback history must remain attached to its original version when a
student submits a later revision.

------------------------------------------------------------------------

## 8. Repository Records

The repository model associates published research with a research
paper.

Important documented constraint:

``` text
UNIQUE (paper_id)
```

Do not apply or recreate this constraint blindly. Before applying a
migration that introduces it, check the target database for duplicate
repository records for the same paper.

Repository publication is an Admin-controlled operation and is tied to
approved research.

------------------------------------------------------------------------

## 9. Notifications

Notifications are stored in the database and are currently **in-app
only**.

Current workflow notifications include:

-   Adviser notified when a student submits a research document/new
    version.
-   Student notified when an Adviser makes a review decision.

Notification failure handling is intentionally tolerant:

``` text
Primary database operation
        ↓
Notification attempt
        ↓
Failure → log failure
        ↓
Primary operation remains successful
```

------------------------------------------------------------------------

## 10. Activity Logs

Activity logs provide an audit trail for important workflow actions.

Phase 4 uses activity logging for Adviser review decisions, including
approval and revision-required decisions.

Do not remove historical activity records merely because a later
submission version exists.

------------------------------------------------------------------------

## 11. Document Storage Relationship

PDF files are not stored directly in PostgreSQL.

The database stores the relevant storage metadata/path while the
document itself is stored in private Supabase Storage.

Bucket:

``` text
research-submissions
```

Path pattern:

``` text
research/{paperId}/{version}/{sanitizedFileName}
```

Rules:

-   PDF only
-   Maximum 10 MB
-   Private bucket
-   Server-generated signed URLs
-   Signed URL lifetime: 300 seconds / five minutes

The database record and storage object must remain consistent.

`submissions.fileUrl` maps to DB column `file_url` and stores the private storage path, not a public or signed URL. Phase 5.3 reads the existing submission ID, `paperId`, version, and path; resolves the paper/group; rechecks the active user/database role; and enforces Student membership or Adviser ownership before signing. Admin/Panel are denied for submitted documents. The path must match the persisted paper/version and safe PDF naming convention. No new columns/tables/constraints are needed.

Already issued signed URLs may remain usable until their 300-second expiry after authorization is revoked. Legacy/nonconforming paths outside the established naming convention are intentionally rejected; do not weaken validation. Full submission/review regression evidence is service-level; browser acceptance specifically covered document access. These are known limitations, not blockers.

Live acceptance synthetic users/groups/papers/submissions/memberships/feedback/activity/notifications and PDF objects were removed; cleanup was independently checked. No real student data or schema was changed.

------------------------------------------------------------------------

## 12. Foreign-Key / Integrity Rules

The relational model uses foreign keys to preserve referential integrity
between:

-   users and roles;
-   research groups and advisers;
-   group members and users/groups;
-   research papers and groups;
-   submissions and research papers/users;
-   feedback and submissions;
-   repositories and research papers;
-   notifications and users;
-   activity logs and users.

Use the actual Drizzle schema as the final authority for `ON DELETE`,
nullability, exact column types, and indexes.

------------------------------------------------------------------------

## 13. Migration Rules

Migration files are generated under:

``` text
db/migrations/
```

The project documentation records migrations through:

``` text
0000_ ... 0009_ ...
```

A generated migration is not automatically an instruction to modify
every environment.

Before applying a migration:

1.  Read the migration SQL.
2.  Inspect the target database.
3.  Check for duplicate/conflicting data.
4.  Confirm the migration matches the current schema.
5.  Back up production data when appropriate.
6.  Apply deliberately.
7.  Re-run schema/migration validation.

### Repository uniqueness migration

Phase 5.4 requires database-enforced one-row-per-paper uniqueness as the publication invariant and concurrent-insert backstop. The existing Drizzle schema already declares this constraint, but the test database lacked it; the old conflict-target insert would fail without it. Before application, the exact SQL and schema matched, duplicates were absent, and migration hashes/timestamps through 0008 matched the ledger. Only 0009 was pending. Its non-destructive UNIQUE constraint and the tenth ledger entry were verified after migration; no records were deleted.

`0009_repository_paper_unique.sql` exists in the current repository
migration history. It was not applied during Phase 5.1/5.2/5.3 or the Phase 5.3 documentation audit. It is now applied only to the confirmed development database for Phase 5.4.

Its existence does not establish its state in any target database.
Inspect the migration and verify the intended database before any
future application in other environments. Phase 5.4 verified the existing ledger through 0008 and applied only 0009 using the Drizzle migrator. UNIQUE(paper_id) and the added ledger entry were verified; no existing rows were deleted.

------------------------------------------------------------------------

## 14. Test vs Production Database

The project uses database-backed testing during development.

Rules:

-   Do not use real production student data for acceptance tests.
-   Keep test data identifiable and isolated.
-   Do not assume a local/test database and production database have
    identical migration state.
-   Verify the target database before destructive or constraint-adding
    migrations.
-   When production is introduced, use a clean production database and
    production-specific configuration rather than converting the
    development test database into production.

------------------------------------------------------------------------

## 15. Database Safety for Browser Acceptance

Browser acceptance can mutate persistent data.

Examples include:

-   creating submissions;
-   creating new versions;
-   creating feedback;
-   changing statuses;
-   generating repository access metrics.

Therefore:

``` text
Browser test
     ↓
May mutate DB / storage
     ↓
Use isolated test records/environment
```

Do not run state-changing acceptance scenarios against production
records simply to obtain test evidence.

------------------------------------------------------------------------

## 16. Schema Change Procedure

When a feature requires a schema change:

``` text
Requirement
   ↓
Inspect current schema
   ↓
Determine whether existing columns/tables are sufficient
   ↓
Modify db/schema/*
   ↓
Generate migration
   ↓
Review SQL
   ↓
Check target data for conflicts
   ↓
Apply migration deliberately
   ↓
Run drizzle-kit check
   ↓
Run application validation/tests
   ↓
Update DATABASE.md
```

Do not create a migration merely because it is convenient if the feature
can be implemented safely without a schema change.

------------------------------------------------------------------------

## 17. Agent Rules for Database Work

Before changing the database:

1.  Read `docs/SOURCE_OF_TRUTH_UPDATED.md`.
2.  Read `docs/MASTER_CONTEXT_UPDATED.md`.
3.  Read this file.
4.  Inspect `db/schema/`.
5.  Inspect relevant migrations.
6.  Check Git status.
7.  Determine whether the requested work is based on the current
    checkout or historical implementation notes.
8.  Inspect target database state before applying constraints.
9.  Never commit credentials or connection strings.
10. Never claim a migration was applied without evidence.

------------------------------------------------------------------------

**End of Database Reference**

## 2026-10-21 — Phase 10.1B.1 additive verification schema (UNAPPLIED)

Schema source now declares nullable `users.email_verified_at` as a timezone-aware timestamp, with no default/backfill and no change to `is_active`, passwords, IDs or existing relationships. New `email_verification_requests` uses `user_id` as its primary key and a restrictive foreign key to `users.id`; it stores the requested email, unique 64-character SHA-256 digest, timezone-aware expiry/consumption/last-request timestamps and a timezone-aware timestamp array of up to five request instants. The bounded array supplies the exact rolling-hour window/count without an inaccurate fixed-window counter. Resends replace the single row's token while retaining in-window request times, including failed-delivery attempts.

Generated `db/migrations/0012_student_email_verification.sql` creates only this table/constraints and adds the nullable user column; metadata is `meta/0012_snapshot.json` and the appended journal entry. Necessary checks constrain the digest, array size/null elements, expiry order and consumption time. The primary key and digest uniqueness provide the lookup indexes; no additional indexes are required for the scoped operations. **Generated and reviewed only: no migrate, push, migration SQL, seeds or database mutations were executed.** Neither target schema nor ledger was queried in this checkpoint. Actual PostgreSQL constraints/locking/rollback acceptance awaits separate authorization for an isolated migrated test database.

Verification operations serialize on the existing user row with `FOR UPDATE`, then obtain database wall-clock time after the lock wait. Confirmation rechecks the locked account and current request and conditionally updates consumption and verification in one transaction. Legacy user reads/inserts and publication account reads use explicit pre-verification columns, so the pending migration does not become a requirement for existing Stage 1 operations. Request/confirmation services themselves require the new schema; they are not wired to application routes or auth actions. See the latest Master Context for validation and integration boundaries.

Phase 5.6 practical final verification and Phase 5.7 documentation closure passed: upload -> revision -> v2 -> approval -> Admin publication -> authenticated repository listing/detail/view/download, basic security, preserved history and independent synthetic cleanup. Phase 5.1 through 5.7 and Phase 5 overall are complete. No schema/migration changes in this final pass; existing 0009 remains development/test-only. Known limitations remain: issued URLs last until expiry; objects may be removed after publication; strict nonconforming paths are rejected; approved-document resolution is dynamic. This is capstone-level validation, not enterprise production hardening. Phase 6 is next; CI remains deferred.


## 2026-10-21 ? Migration 0012 applied to verified development/test only

This supersedes the earlier UNAPPLIED label only for the verified loopback `thesishs_ai` database. The owner confirmed that all local data is development/test and contains no real Student data. Preflight matched the known local database/cluster identity and all 12 ledger hashes/timestamps through 0011; neither the new table nor user column existed. The installed Drizzle migrator applied only `0012_student_email_verification.sql`; the resulting 13-entry ledger matches source exactly.

Post-migration verification confirms nullable timezone-aware `users.email_verified_at` without a default/backfill, seven request fields, primary key, unique digest, restrictive user FK and four validity checks. Existing public columns/constraints/indexes are unchanged apart from the authorized additions. Actual FK/uniqueness/check violations, persisted timestamps, concurrent requests/confirmation, account-lock waits and rollback after both verification writes passed against PostgreSQL. Synthetic cooldown/history timestamps were aged only on owned records; lock-wait expiry used real elapsed time.

Four synthetic accounts created before application verified old-schema registration/login compatibility and post-migration unverified Student/Admin/Adviser password login. They and their request rows were removed. An independent connection confirmed cleanup and unchanged complete pre-existing row fingerprints for all 13 original public tables; no existing account, membership, paper, submission, feedback, repository, notification, activity or AI-governance record was altered. Serial-sequence gaps are intentionally retained. No production/staging migration state is established. See the latest Master Context and `tests/phase101b1-email-verification.acceptance.cjs` for exact acceptance boundaries.


## 2026-10-22 - Phase 10.1B.2 UI/HTTP acceptance, no schema changes

Migration 0012 remains applied only to the previously verified local development/test database. This checkpoint rechecked the exact 13-entry ledger and known local database/cluster identity; it did not generate, execute or reapply any migration. The only repository addition is a narrow current-account verification-status projection, called through session-derived active-Student authorization. Existing token request/confirmation transaction semantics and all schema/migration source remain intact.

Real HTTP/browser acceptance used four run-owned synthetic accounts per attempt. It exercised actual password cookies, current-account checks, token requests/confirmation, cooldown/quota, SMTP capture/failure/recovery and unauthorized direct action calls. Only owned request times were aged for time-based scenarios. Each fixture-bearing attempt cleaned its own accounts/requests, and an independent connection compared complete pre-existing row fingerprints across all 14 public tables. No pre-existing account/password/role, membership, research/version/feedback/repository, notification/activity/governance record or Storage object changed. Serial-sequence gaps were not reset. See the latest Master Context and local verification setup for actual results and remaining production boundaries.

## 2026-10-22 - Phase 10.1D.2 migration 0013 (UNAPPLIED)

New schema source `auth_rate_limit_buckets` contains only a 64-character HMAC key digest, timezone-aware window start/expiry and positive integer hit count. Composite primary key `(key_digest, window_start)`, expiry index and digest/count/expiry checks support atomic conditional upserts and bounded lazy cleanup. No user FK or raw account/IP/password/token data; no existing research/user relationship changes.

Generated `db/migrations/0013_auth_rate_limit_buckets.sql`, `meta/0013_snapshot.json` and one appended journal entry. SQL is CREATE TABLE/CREATE INDEX only; comparison with snapshot 0012 confirms all existing schema objects unchanged. Earlier migration files are byte-preserved. Drizzle's non-mutating history check passes. **No migration SQL/migrate/push, database connection or database mutation was executed in D.2.** Migration 0012's prior local acceptance is unchanged historical evidence, not a fresh live check.

Driver-double tests cover parameterization, shared counters, simulated concurrent serialization, conditional admission, fixed-window expiry and at-most-64-row cleanup; real PostgreSQL conflict locks/rollback/constraints remain pending. Local development/test defaults to shared-limiter off until explicitly enabled, allowing old-schema auth to continue. Production always requires the new table and server-only secret and fails closed if unavailable. See [the D.2 report](PHASE10_1D2_AUTH_HARDENING.md) for exact budgets/configuration and the separately authorized isolated-database acceptance gate required before production activation.

## 2026-10-22 - Migration 0013 APPLIED to verified isolated development/test; admission blocked

The owner-authorized acceptance reverified loopback database `thesishs_ai`, port 5432, OID 16387 and known cluster `7652422818440234372`, prior all-development/test confirmation, exact 13-entry ledger through 0012 and 0013 as the sole pending migration. Drizzle applied only 0013 once. Source/live ledger now matches all 14 entries including hashes/timestamps. Four non-null columns/types, composite PK, three checks, expiry and PK indexes verified; PostgreSQL 18 additionally records four NOT NULL constraints. All original columns/constraints/indexes and full-row fingerprints across the 14 pre-existing public tables remained unchanged. Migration 0012 was not modified or reapplied.

Actual malformed-digest/count/expiry violations (`23514`) and duplicate-key rejection (`23505`) passed; invalid inserts rolled back and owned test rows were deleted. The first normal application limiter upsert fails in postgres-js with `ERR_INVALID_ARG_TYPE` for untyped Date parameters. Admission fails closed. This application defect requires owner review for a narrow serialization correction; no schema change is indicated. Real limiter contention/window/retention/authentication regressions were not reached and remain blocked, despite prior SQL-double PASS.

Independent cleanup after every attempt confirmed zero limiter rows, no owned account/notification/verification fixtures and unchanged pre-existing fingerprints/structure. No synthetic account creation stage was reached. The new table and ledger entry intentionally remain applied; no migration rollback/reset/reapplication or existing-data change. Exact findings, proposed fix and rerun mode `--accept-applied` are in [the D.2 report](PHASE10_1D2_AUTH_HARDENING.md). No production/staging migration or deployment is established.

## 2026-10-22 - Phase 10.1D.2F PostgreSQL acceptance PASS; no schema/migration changes

Same isolated loopback identity/cluster/OID and 14 exact source/ledger hashes/timestamps through 0013 reverified before writes. No migration generation, migrate/push or reapplication. The runtime-only correction encodes the two existing timezone-aware limiter timestamp parameters through their Drizzle column encoders; table/constraints/indexes are byte-preserved.

Real first admission now persists correct HMAC counters, aligned 15-minute starts and 75-minute expiry. Final applied-mode acceptance passes **18 groups plus independent cleanup**, including actual constraints/thresholds/two-pool concurrency (20 attempts, exactly five winners), transactional rollback, previous-window admission, at-most-64 cleanup and concurrent cleanup preserving active counters. Expiry tests age only owned synthetic timestamps; no elapsed 75-minute claim. Isolated limiter-driver failure denies auth while healthy read-only research access continues. Synthetic account/notification/verification regression also passes; only Next request/cookie/navigation and delivery boundaries are doubles.

Independent cleanup verifies no owned user/notification/verification records, zero limiter buckets, all 14 original table fingerprints/structure unchanged and ledger preserved. Existing passwords/roles/groups/research/version/feedback/history are intact; no Storage/real email, production configuration or sequence reset. Earlier serialization blocker is resolved without migration edits. See latest [D.2F report](PHASE10_1D2_AUTH_HARDENING.md) for scope, runner assertion correction and remaining production gates. No deployment or production/staging migration claim.

## 2026-10-22 - Phase 10.2B initialization rules and operator usage

**Confirmed local foundation only; no production database provisioned.** Canonical role IDs are 1 Admin, 2 Adviser, 3 Student, 4 Panel. Initialize only a separately approved target with complete migrations 0000-0013. Missing compatible roles may be inserted; either-direction ID/name conflicts abort and require a separately authorized recovery. Extra unrelated roles and existing role metadata/references are preserved. A role-table lock and transaction serialize operations. Sequence repair uses transactional ALTER SEQUENCE RESTART only when lagging; no existing sequence is rewound. Panel remains outside active feature scope.

### Server-only configuration

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | Runtime credentials only; normal local development/test URL remains supported. |
| `THESISHS_DATABASE_ADMIN_URL` | Operator credentials only; no runtime fallback. Must be absent from hosted runtime configuration. |
| `THESISHS_DATABASE_ENV` | Explicit `development`, `preview` or `production`; optional only for ordinary local runtime. Must match VERCEL_ENV when present. |
| `THESISHS_DATABASE_CONNECTION_MODE` | `direct` or `session`; required for Preview/Production. Transaction pooling refused pending separate review. |
| `THESISHS_DATABASE_TARGETS_JSON` | Strict approved-target map described below; always required for operator commands and hosted runtime. Never public/client configuration. |

The target map has optional keys `development`, `preview`, `production`. Each supplied value is exactly `{ identity, runtime, operator }`; identity is a nonempty operator-verified environment data-identity label. Both endpoint objects are exactly `{ host, port, database, user }`, with lowercase host, numeric port and explicit database/user. No passwords/URLs belong in this map. All three profiles are required for hosted Preview/Production: distinct identity labels and no cross-environment host/port/database overlap, including operator/runtime endpoints and regardless of username. Preview/Production operator and runtime usernames must differ. Verify aliases, provider project/branch identity and grants separately; arbitrary labels are not evidence of physical isolation. Profiles may specify differing runtime and operator endpoints only after the operator confirms they route to the same intended environment data.

Only postgres/postgresql URLs with explicit username/password/database are supported. URL options are limited to sslmode=require/verify-full (disable permitted only for development); no implicit multi-host routing or other options. Remote TLS always validates certificates, even with sslmode=require. There is no insecure certificate fallback/custom-provider assumption. Pools: hosted runtime 2, local runtime 10, operator 1; connect timeout 5s, idle timeout 20s, maximum lifetime 300s; prepare=true. Provider session/direct compatibility, CA trust, real least-privilege roles and aggregate serverless connection capacity still require hosted verification.

### Controlled initialization commands

Run from the repository root after privately provisioning operator configuration outside source control. Commands load normal operator process environment (dotenv does not override it); this checkpoint created/edited no environment file. Keep privileged configuration off Vercel runtime. Verify the target in the provider/control plane before accepting a fingerprint; a fingerprint is an identity binding, not authorization to initialize an arbitrary database.

1. Read-only inspection: `npm.cmd run db:seed:roles -- --inspect`.
2. Review/confirm the approved database identity and reported fingerprint, then `npm.cmd run db:seed:roles -- --confirm-target <fingerprint>`.
3. Read-only inspection: `npm.cmd run db:bootstrap:admin -- --inspect`.
4. `npm.cmd run db:bootstrap:admin -- --confirm-target <fingerprint>`, entering names/email/password/confirmation privately in an interactive terminal. No input is echoed.

Inspection requires the selected database/user, database OID, server address, cluster system identifier and exact complete 14-entry source ledger. Fingerprints exclude passwords/connection URLs; output contains only environment/count/fingerprint. The operator must have pg_control_system() access; absence fails closed. Each command rechecks the live fingerprint. No argument/default confirmation, redirected input/output or mismatched fingerprint permits writes. Do not automatically retry uncertain results: inspect the approved database first.

Admin requires successful canonical role validation and rejects **any existing role-1 account, including inactive Admins**. The locked transaction checks case-insensitive duplicate email, creates an active Admin only, stores bcrypt cost12 hash and never emits credentials/hash. Names/account/password use current validation, email is trimmed/lowercased, and new passwords must fit 72 UTF-8 bytes. No public endpoint, default account, auto-login, startup/build hook or automatic migration seed exists. Recovery/replacement is outside scope.

Direct Drizzle Kit database commands are blocked; offline check/generate/export retain schema/history tooling, subject to owner authorization for generation. Do not substitute DATABASE_URL for operator credentials. The future production migration executor/confirmation and backup/restore procedure still need owner review; no production command was run.

### Replay evidence and preservation

New `tests/phase102b-database.acceptance.ts` requires independently verified expected cluster/OID arguments, loopback-only identity, CREATE DATABASE capability, full read-only baseline fingerprints and a new randomly named owned template0 database. It verifies emptiness before Drizzle migrate. Source/ledger **14/14**, **15 empty tables**, **51 application constraints**, **26 indexes** pass; types/nullability/serial defaults, PK/unique/FK columns/actions, CHECK expressions and explicit index definitions/predicates match snapshot 0013. Real roles/idempotence/conflict/concurrency/sequence and secure Admin/bcrypt/duplicate/concurrent-first-Admin cases pass there.

Every fixture-bearing attempt removed its own database after OID/owner/marker/cluster/no-session checks; no FORCE/drop of existing databases or session termination. Independent comparison confirms all pre-existing rows, columns, constraints, indexes, sequence values and ledger unchanged across the 15-table development database. Migrations 0000-0013, schema source and existing role/account/research/history records remain unchanged. No new migration, production/Preview/staging operation, Storage or email activity. See latest Master Context for exact files, tests and remaining gates.


## 2026-10-22 - Phase 10.2C.2 upload-intent persistence (unapplied)

New schema: db/schema/submission-upload-intent.ts, exported by db/schema/index.ts. Generated migration: db/migrations/0014_submission_upload_intents.sql; matching 0014 snapshot and one appended journal entry. No migration was applied and no PostgreSQL connection/acceptance was run. SQL creates only submission_upload_intents, its constraints and two indexes. Snapshot comparison confirms all 15 previous table definitions unchanged; migrations/snapshots 0000-0013 remain byte-identical.

Columns: UUID primary ID; Student/paper IDs; UUID request key; exact staging path; sanitized filename (144 ASCII characters maximum); declared byte size; optional remarks; timezone-aware created/intent-expiry/capability-expiry timestamps; pending/completed/cancelled/rejected state; nullable completed submission ID; nullable prepared final path and SHA-256 digest. Expiration remains a timestamp rule, not another state.

Three restrictive FKs reference users, research_papers and submissions. Four unique constraints protect staging path, final path, completed submission reference and (student_id, request_key). Eight CHECKs enforce 1..10,485,760 bytes, time ordering, allowed state, completed iff submission reference exists, paired nonnull final-path/digest with 64 lowercase hexadecimal characters and required completed plan, exact staging path/id, safe PDF filename and final path bound to paper/id. The digest CHECK explicitly rejects NULL when a final path exists; PostgreSQL CHECK's unknown result must not admit a half-plan. Indexes cover (student_id,created_at) and (expires_at,id). No existing academic/account table definition changes.

Repository uses parameterized Drizzle Date encoders and database clock_timestamp after locks. The existing advisory namespace is now a shared constant without changing its value. Short transactions acquire current account/group/member/submission/paper/intent locks; they never perform Storage calls. Account locking serializes cross-paper issuance limits: 15-minute intent, two live per Student, one per Student/paper, ten new per rolling hour across all states. SQL uniqueness and scoped predicates backstop idempotency/ownership. Completion inserts the existing submissions row and links the intent atomically; no research, feedback or membership deletion/rewriting.

The operator/replay source guards now require all 15 migration hashes/timestamps, and the future disposable replay harness reads snapshot 0014. It was NOT executed in this checkpoint. Existing targets with only 0000-0013 therefore fail the updated full-ledger operator guard, and new uploads fail closed without the intent table. Do not apply 0014 or weaken the guard automatically; use a separately reviewed owner-authorized acceptance/migration procedure.

npm run db:uploads:cleanup is operator-only and read-only dry-run, using dedicated operator configuration, complete ledger/cluster fingerprint checks and a READ ONLY query. Default batch is 25 (26th row detects pagination), with an opaque --after UUID cursor. Report contains counts/cursor, not object paths or credentials. Eligibility is max(intent expiry, capability expiry)+10 minutes. Canonical paths and any submission reference protect final objects. No object deletion, row deletion or tombstone purge is available; --execute is refused before configuration. Provider late-write/deletion safety remains deferred.

Offline schema/tooling checks and isolated transactional SQL doubles pass. Real SQL constraint enforcement, timestamp driver compatibility, advisory/row-lock contention, rollback/commit acknowledgement and migration replay require separately authorized Phase 10.2C.3. Earlier Phase 10.2B real PostgreSQL results above are historical and do not validate 0014.


## 2026-10-22 - Phase 10.2C.3B.1 preparation only: migration/recovery and fixtures

No database, backup, restoration, Storage or browser operation was executed in this checkpoint. The 0014 source/hash/snapshot and all earlier migrations remain unchanged. Earlier C.3A read-only evidence is retained: known local PostgreSQL 18.4 cluster/database identity, exact 14-entry ledger through 0013, 15 original tables, private development/test Supabase project (owner-confirmed) and private research-submissions bucket. Its PDF MIME and exact 10 MiB restrictions were unset. These are retained observations, not fresh live checks or permission to execute.

### Narrow migration operator

New scripts/migrate-upload-intents.ts is only for the independently confirmed loopback thesishs_ai database, port 5432, cluster 7652422818440234372 and database OID 16387. It rejects other environments/targets, requires explicit expected identity arguments, existing strict operator configuration and an operator username distinct from the runtime username. It never falls back to DATABASE_URL for writes. Existing scripts/database-operator.ts still requires the complete 15-entry ledger; it is not weakened or repurposed for a pre-0014 execution.

Preparation commands (NOT executed here):

    node --import tsx scripts/migrate-upload-intents.ts --inspect --expected-cluster 7652422818440234372 --expected-oid 16387

Read-only inspection validates identity before reading records, the source prefix/order/snapshot, the approved migration SHA-256 and the approved pre-0014 catalog fingerprint. It outputs only target, record/schema/sequence fingerprints, applied status and migration hash. The approved schema pin is deliberately local/PG18-specific; a mismatch requires review, not bypass. Dedicated operator privileges must support pg_control_system(), SELECT on all application tables/sequences and ledger, migration DDL/REFERENCES and bounded table locking. Configuration/grants remain owner-controlled and unconfigured; do not copy runtime credentials into an operator URL.

    node --import tsx scripts/migrate-upload-intents.ts --execute --expected-cluster 7652422818440234372 --expected-oid 16387 --confirm-target <inspection-fingerprint> --backup-file <absolute-private-archive> --confirm-backup <archive-sha256> --recovery-evidence <absolute-private-evidence>

Execution requires a private interactive terminal and explicit target/backup confirmation. Source hash must remain 9077be13113496dfa894cfd376f0dd69b613eda6e1460da443990300152f71ab. The runner acquires a transaction advisory lock, locks the ledger and original tables, rechecks the exact 14-entry prefix/table absence/schema/records/sequences, then runs only source[14] SQL and its ledger insert in one transaction. Lock/statement timeouts are three/ten seconds. SHARE locks on all 15 original tables enforce a quiet window and can block application writers; keep the app stopped. Existing rows and public sequences must match before/after. New columns/nullability, FK targets/actions/columns, primary/unique keys, CHECK names/validation and index structure are inspected, along with full source ledger. Actual SQL constraint enforcement still needs separately authorized PostgreSQL acceptance.

Commit uncertainty triggers one independent durable read, never automatic reapplication or DROP rollback. A complete matching applied state is reconciled; an intact 0013 state reports not-applied-review-before-retry. Partial/mismatched/unavailable state refuses confirmation. An already-applied 0014 is verified and never replayed, including when intents exist. No new migration/grant/schema relaxation is introduced.

### Private backup and separate restore procedure (manual; separately authorize every operation)

1. Stop application writers; independently confirm cluster/OID and run read-only inspection. Keep the source unchanged. Use compatible PostgreSQL 18 client tools (18.4 was found in C.3A).
2. Prepare an absolute private directory outside this application and every Git checkout. On Windows remove broad inherited grants and allow only the current operator, SYSTEM and Administrators; on POSIX use directory 0700/files 0600. The runner checks file and directory ACL/mode and rejects in-repository artifacts/symlink files. Keep passwords/archives/credentials out of terminal output, shell history and Git. Use a protected external PGPASSFILE for client authentication and non-secret PGHOST/PGPORT/PGDATABASE/PGUSER settings; do not place a URL/password in command arguments or edit application env files.
3. Only after backup authorization, use pg_dump --format=custom --no-owner --no-acl --file <private-archive> for the verified source, with no schema/table filters: include public, drizzle.__drizzle_migrations and sequences. Record archive SHA-256 privately and check the archive inventory privately with pg_restore --list. The runner requires the PGDMP custom-format header and matching archive digest. It does not create backups.
4. Separately authorize creation of an empty template0 disposable database named thesishs_upload_restore_<32-lowercase-hex-run-id>, on the same confirmed cluster with a distinct OID. Revoke PUBLIC connection permission and restrict access to the approved operator before restoring. Restore the exact archive there using pg_restore --exit-on-error --single-transaction --no-owner --no-privileges. Never restore into thesishs_ai. No restore command is automated here.
5. Prepare a zero-byte evidence file in the same private directory with restrictive permissions. Supply the distinct restore connection only through THESISHS_UPLOAD_RESTORE_URL in the operator process, using the approved operator username/loopback endpoint. This is a temporary process value, not a committed/env-file setting.

    node --import tsx scripts/migrate-upload-intents.ts --verify-recovery --expected-cluster 7652422818440234372 --expected-oid 16387 --confirm-target <inspection-fingerprint> --backup-file <private-archive> --confirm-backup <archive-sha256> --recovery-evidence <private-zero-byte-evidence-file> --restore-database <owned-restore-name> --restore-oid <independently-verified-distinct-oid>

Recovery verification performs only read-only database transactions, compares restored schema/ledger/public row and sequence digests against the unchanged original and records private recovery evidence. It creates/restores no database. It refuses the original DB/OID or an unexpected restore name/cluster. Evidence is an ACL-protected operator record, not a cryptographic signature or independent proof of who ran pg_restore; the operator must restore the named exact archive. Migration requires matching evidence no older than 24 hours and unchanged original fingerprints. If any writer changes the source, take and verify a fresh backup. Keep the disposable restore until migration acceptance; removal requires separate exact-identity authorization.

### Run-owned acceptance fixtures

scripts/upload-acceptance-fixtures.ts exports fixturePlan, createUploadFixtures and removePristineUploadFixtures; importing it performs no I/O. There is no automatic provisioning CLI/hook. A future separately authorized one-off operator invocation must use the verified dedicated connection, run UUIDv4, target fingerprint, explicit execute/operation/run/target confirmation and five privately generated credentials (minimum 16 characters, maximum 72 UTF-8 bytes). Save the UUID/credentials privately before creation; never log the return from an interactive credential entry.

The minimum dedicated set is three Students (a/b together, c outside), one Adviser, one Admin, two groups and three papers (a/b in group a; c in group b). All records use UPLOAD_<run> markers/reserved example.invalid emails, fresh identities and existing canonical role IDs. No existing account is implicitly approved for reuse. Passwords use bcrypt12. Per-run advisory locking and exact email/name/role/group/title/membership checks make retry with the same private credentials reuse the same IDs without resetting passwords/memberships or duplicating records. A collision/changed record refuses and rolls back. Serial gaps are retained.

The caller privately records the returned manifest (run/target/users/groups/papers) and credentials. Cleanup requires that exact manifest and separate remove-pristine authorization. It locks and validates every run-owned parent and exact membership; a foreign ID, renamed row, extra group paper/member or any upload intent/submission/notification/activity refuses the entire operation. Other FK conflicts roll back. Pristine teardown is idempotent and deletes no Storage objects. Research-bearing fixtures, intents/tombstones and objects are deliberately retained until separately reviewed Storage-aware cleanup; do not bypass restrictive FKs or bulk-delete by a loose name prefix.

### Focused browser and bucket prerequisites

New tests/phase102c3-browser.acceptance.cjs is standalone and opt-in (not an auto-discovered Playwright spec). It requires --execute, --run, --base-url, --confirm-base and --private-fixtures. The private JSON has a fixture manifest and a credentials map keyed student-a/student-b/student-c/adviser/admin. It must pass the same external private-file checks. Use node --import tsx to invoke it only after owner approval. No default URL/credentials or existing accounts are used.

The harness accepts only an explicitly confirmed HTTP loopback origin with an unprivileged non-3000 port. It verifies DB identity/full ledger, exact marked fixture identities/groups/papers and absence of prior submissions, then launches its own Next dev child with pinned Development resources. It waits for that child's readiness and does not attach to an existing server. The Supabase origin is pinned to owner-confirmed test-project fingerprint 2df59fc572539320. Privileged operator/restore credentials are removed from the app child's environment. Each user has a separate Chromium context. Network access is restricted to the local app and canonical signed staging PUT/OPTIONS at that project. No global playwright.config.ts capture settings are inherited: trace/HAR/video/screenshots/storage-state export, body/console capture and API/protocol debug logging are absent/disabled. Child logs and raw errors are not printed.

It exercises actual Student login, project selection, one deliberately aborted direct upload, status/retry, progress UI, a separate explicit Submit research click, history/DB confirmation and separate Adviser visibility. It retains all fixtures/objects and closes only its owned browser/server processes. It does not prove exact 10 MiB reliability, hostile authorization, real locking, timing/memory or hosted Preview behavior. Those acceptance cases remain separately gated. Do not run the harness until the bucket and source/fixture checks pass.

Required Supabase checklist: known development/test project; existing research-submissions private; allowed MIME types exactly [application/pdf]; file_size_limit exactly 10485760; modern browser publishable key only; privileged secret server-only and absent from client bundles; actual exact-path/upsert:false capability behavior; anonymous/public document denial/RLS and CORS; random staging paths; private final paths; run-owned recovery/cleanup with expiry grace. Current known missing MIME/size settings require separate authorization to change. No provider call or bucket/object change was made by this preparation checkpoint.


## Minimal operator preflight and next action (2026-10-22)

Historical pre-provisioning report, superseded by the applied/recovery status at the top of this reference and the latest Master Context. Its commands are retained procedures, not instructions to repeat completed work.

### Confirmed read-only findings

The existing `scripts/migrate-upload-intents.ts`, `scripts/upload-acceptance-safety.ts`, `scripts/database-operator.ts` and `lib/db/config.ts` provide the required tooling; no new framework is needed. The runner has explicit inspect/recovery/execute modes, refuses runtime username reuse, pins the approved loopback target, verifies full source/ledger/schema/data/sequence fingerprints, and requires private recovery evidence before migration. It never creates a backup or restores a database itself.

Fresh minimal inspection used the existing runtime credential **only for READ ONLY transactions**, not as an operator. Target identity was verified before catalog inspection: localhost:5432, database `thesishs_ai`, OID `16387`, cluster `7652422818440234372`. The ledger count was 14 and `submission_upload_intents` was absent. This count is not a fresh full ledger/hash audit; the prior full 0000-0013 verification remains historical evidence. No account contents, passwords, connection strings or raw tokens were printed or searched.

`pg_roles` showed **zero other non-system LOGIN roles** and **one role administrator** (CREATEROLE or superuser). Thus no currently available separate login was identified for reuse; a privileged administrator must provision one. `THESISHS_DATABASE_ADMIN_URL` and `THESISHS_DATABASE_TARGETS_JSON` were absent. No role/grant/environment changes, backup/restore, migration, fixture or Storage operation occurred. The blocked Gate 1 was not resumed.

### Recommended smallest setup - separate owner authorization required

Have the existing PostgreSQL administrator create a dedicated local LOGIN with a privately generated credential, distinct from the runtime username. Role creation requires CREATEROLE or superuser authority; object grants also require an authorized owner/grantor. Do not make the migration login a superuser or role administrator. See PostgreSQL's [role attributes](https://www.postgresql.org/docs/18/role-attributes.html). No executable role/grant SQL is authorized by this documentation checkpoint.

Review only the privileges needed by the existing runner and separately approved backup/restore steps:

| Purpose | Proposed narrowly scoped access |
|---|---|
| Connect and create the new table | CONNECT on the approved test DB; USAGE on public/drizzle schemas; CREATE on public |
| Inspect/preserve existing state and make a logical backup | SELECT on the exact 15 existing public tables and migration ledger; SELECT on existing public sequences; required metadata visibility |
| Add intent foreign keys | REFERENCES on users, research_papers and submissions (the referenced IDs can be column-scoped) |
| Append migration ledger | INSERT on drizzle.__drizzle_migrations; USAGE/SELECT on its serial sequence |
| Identity guard | EXECUTE on pg_control_system(), as required by the existing cluster pin; refusal must not be bypassed |
| Explicit migration locks | MAINTAIN on the exact existing public tables and ledger, subject to administrator review on the installed PostgreSQL 18 server |
| Disposable restore | Administrator creates a uniquely named empty template0 database owned by the operator and restricts PUBLIC connection; operator restores/read-checks that database under separately approved recovery scope |

The lock privilege matters: SELECT alone permits ACCESS SHARE and INSERT permits at most ROW EXCLUSIVE, while this runner takes SHARE on existing tables and EXCLUSIVE on the ledger. PostgreSQL 18 permits these locks with MAINTAIN (or broader UPDATE/DELETE/TRUNCATE). Prefer reviewed MAINTAIN grants rather than granting academic-record DML merely to obtain locks; MAINTAIN itself permits maintenance operations and must remain restricted to the operator. See [PostgreSQL LOCK privileges](https://www.postgresql.org/docs/18/sql-lock.html). This is a source-based recommendation, not a tested new role/grant configuration.

An administrator-created disposable database avoids giving the operator permanent CREATEDB. The existing restore URL must use the same operator username and approved loopback cluster, with a distinct database name/OID. Required restore object/extension permissions must be reviewed against the actual archive; do not add broad privileges on assumption. Runtime access to the new operator-owned intent table and least-privilege runtime grants must also be reviewed before application acceptance; do not assume migration ownership grants application access.

### Expected private configuration format

Use a private operator terminal/process environment, or a separately reviewed owner-only external credential file loaded into that process. Do not change tracked/untracked environment files for this checkpoint, copy runtime credentials, place operator secrets in Vercel, or print connection strings. Preserve runtime `DATABASE_URL` unchanged. Required variable names:

- `THESISHS_DATABASE_ENV=development`
- `THESISHS_DATABASE_CONNECTION_MODE=direct` for the approved local endpoint
- `THESISHS_DATABASE_ADMIN_URL`: private URL for the distinct operator; never log it
- `THESISHS_DATABASE_TARGETS_JSON`: endpoint pins in the following placeholder-only shape

```json
{
  "development": {
    "identity": "<owner-approved-local-test-identity>",
    "runtime": {
      "host": "localhost", "port": 5432,
      "database": "thesishs_ai", "user": "<runtime-user>"
    },
    "operator": {
      "host": "localhost", "port": 5432,
      "database": "thesishs_ai", "user": "<distinct-operator-user>"
    }
  }
}
```

Use the exact approved host spelling matching the private URL, and different runtime/operator users. A configuration identity label is not proof of physical isolation; the runner additionally verifies actual cluster/OID/loopback identity. Hosted Preview/production configuration separately requires all three stage mappings and non-overlapping identities/endpoints; do not put production credentials into a local acceptance shell merely to plan those mappings.

After separately authorized provisioning/configuration, start with the existing read-only runner inspection, **not migration execution**:

```sh
node --import tsx scripts/migrate-upload-intents.ts --inspect --expected-cluster 7652422818440234372 --expected-oid 16387
```

This command is documented, not run in this checkpoint. Once identity, privileges and the full state are verified, separately authorize private backup, disposable restore/read-back and evidence preparation using the existing procedure above. Migration 0014 still requires its own execution approval, fresh matching recovery evidence and record/sequence preservation checks. Stop safely if credentials or privileges remain unavailable; never weaken the distinct-operator or recovery guards.

### Roadmap precedence and deferred tools

The owner-approved lean roadmap supersedes the earlier mandatory dedicated-fixture/browser sequence. Existing B.1 fixture and browser tools are preserved but optional/deferred; explicitly approved synthetic accounts may instead be reused where safe. No new fixtures are needed just to unblock operator configuration. Preserve the backup/restore and identity gates. Isolated Storage configuration (private, PDF-only, exactly 10,485,760 bytes) and Preview mappings/deployment remain separately authorized work, followed by owner-led manual acceptance. Earlier isolated PASS does not establish live PDF upload or hosted readiness.


## Hosted Preview initialization and identity contract (Phase 10.2D.2A, 2026-10-23)

Implemented, isolated-tested operator/runtime compatibility only. No hosted database exists or was contacted by this checkpoint; no migrations, roles, accounts, grants or provider settings were executed. Local 0014 and retained recovery evidence remain unchanged. Preview and production remain NOT DEPLOYED.

### Expected metadata, not connection authorization by label

`THESISHS_DATABASE_TARGETS_JSON` retains Development, Preview and Production entries. Each active hosted profile now needs `observed`: `provider` (`postgres` or `supabase`), `databaseOid`, distinct `runtimeRole`/`operatorRole`, and either native `cluster` or managed `projectRef`. Native identities require the cluster identifier; a Supabase profile requires its exact 20-character project ref and provider-supported route. Active profiles participating in hosted isolation checks, including the Development metadata, require these pins. The existing local Development URL/mapping behavior is retained.

Future Production may be exactly `{ "identity": "future-production-reservation", "reserved": true }`. This contains no endpoint or credentials and CANNOT be selected for a connection. Missing entries, incomplete active pins, a selected reservation, duplicate identity labels, duplicate known cluster/database-OID pairs and any reused Supabase project ref are refused. No actual Production password or project is needed to prepare Preview. Shared pooler host/port/database strings may be equal only when independently approved Supabase project routes differ; username strings alone do not prove different databases or privileges.

Illustrative metadata (angle-bracket placeholders are deliberately invalid until independently observed; no secrets belong here):

```json
{
  "development": {
    "identity": "approved-local-development",
    "runtime": { "host": "localhost", "port": 5432, "database": "thesishs_ai", "user": "<local-runtime-role>" },
    "operator": { "host": "localhost", "port": 5432, "database": "thesishs_ai", "user": "<local-operator-role>" },
    "observed": { "provider": "postgres", "databaseOid": "<observed-oid>", "cluster": "<observed-cluster>", "runtimeRole": "<local-runtime-role>", "operatorRole": "<local-operator-role>" }
  },
  "preview": {
    "identity": "approved-isolated-preview",
    "runtime": { "host": "db.<project-ref>.supabase.co", "port": 5432, "database": "postgres", "user": "preview_runtime" },
    "operator": { "host": "db.<project-ref>.supabase.co", "port": 5432, "database": "postgres", "user": "preview_operator" },
    "observed": { "provider": "supabase", "projectRef": "<project-ref>", "databaseOid": "<observed-oid>", "runtimeRole": "preview_runtime", "operatorRole": "preview_operator" }
  },
  "production": { "identity": "future-production-reservation", "reserved": true }
}
```

### Independent provider verification procedure - required before execution

1. The owner verifies the project's ref, organization, intended Preview use and physical separation in the authenticated Supabase control plane (Dashboard or supported read-only Management API). Keep approval and observations privately; a variable name, fabricated pin or copied hostname is not evidence. Do not deploy Management API credentials.
2. Copy direct/session endpoints from that project's Connect panel. Direct uses `db.<project-ref>.supabase.co:5432` and the actual PG role. Supported shared-session routes use the provided `aws-<index>-<region>.pooler.supabase.com:5432` and `<actual-role>.<project-ref>`. The configured `observed` roles are the actual, possibly dotted, PG names; no generic split-at-dot normalization is used. Runtime and operator may use different routes to this same approved project, with purpose-specific connection modes in their separate processes.
3. Independently inspect each dedicated connection READ ONLY: `current_database()`, database OID from `pg_database`, `current_user`, `session_user`, both roles' attributes and `pg_auth_members`. Confirm the expected database, effective login and role separation. Observe `has_function_privilege(current_user,'pg_catalog.pg_control_system()','EXECUTE')` before considering that function. If executable, record/compare its actual system identifier; an execution failure or wrong cluster fails closed. Never grant a reserved privilege just to satisfy this check.
4. Where the managed role cannot execute that function, only the explicit Supabase fallback is accepted: control-plane-approved project ref, canonical certificate-verified project route, actual database OID and effective-role/catalog checks together. A known cluster pin is still checked by roles that can read it; other roles use the managed route proof. This is a provider trust boundary, not an independently queried cluster proof, and its real behavior is NOT VERIFIED here. Native PostgreSQL has no such fallback. Stop if routing, role semantics, catalog visibility or certificate trust cannot be established; prefer a validated direct connection where session pooling cannot meet the contract.

Hosted runtime queries are lazy: build/import does not connect. The Drizzle adapter verifies the selected database and both roles on the SAME transaction connection before application SQL. Individual statements use an autocommit-equivalent transaction; explicit transactions/savepoints retain their scope and advisory locks. Pending queries execute once. Only safe Drizzle transaction settings precede observation. Both PG roles must be LOGIN, non-superuser/non-CREATEDB/non-CREATEROLE/non-replication/non-BYPASSRLS and have no role memberships (including SET ROLE paths). Runtime cannot own the database/application schemas or objects, or CREATE in the database/public/drizzle. Other missing DML privileges fail normally; least-privilege grants still need live verification.

Hosted TLS remains certificate-verified, prepared statements stay enabled, transaction pooling remains refused, and the pool/timeouts remain runtime 2/operator 1, connect 5 seconds, idle 20 seconds and lifetime 300 seconds. Hosted search path is fixed to `pg_catalog,public`. No certificate-validation bypass or unsupported pooler port is accepted. `NODE_ENV=production` with `VERCEL_ENV=preview` selects explicit `THESISHS_DATABASE_ENV=preview`, never the Production reservation. Runtime refuses `THESISHS_DATABASE_ADMIN_URL`.

### Explicit initializer - commands are documentation, NOT executed here

Use a private operator process with the approved metadata and separate `THESISHS_DATABASE_ADMIN_URL`; do not place that URL in Vercel. `scripts/initialize-preview-database.ts` accepts Preview only. First inspect:

```sh
node --import tsx scripts/initialize-preview-database.ts --inspect
```

Only after separately approved provider verification, an empty application namespace, permissions and disabled/unexposed Data API have been confirmed, use an interactive private terminal and the returned non-sensitive fingerprints:

```sh
node --import tsx scripts/initialize-preview-database.ts --execute --confirm-target <inspection-fingerprint> --confirm-source f917e170f56d4623e085b8d3b70e8ba0758bb21c1994506dba51c6813954e031 --confirm-data-api-disabled yes
```

The Data API flag is an explicit operator attestation, NOT an API audit performed by the tool. The tool rechecks identity/permissions, rejects existing application relations/routines/types or any migration ledger (including an empty leftover ledger), pins all 15 committed SQL hashes/timestamps plus journal/snapshot bytes, acquires a bounded migration advisory lock, and rechecks the empty-state fingerprint. The supported Drizzle migrator applies 0000-0014 sequentially within one outer transaction; its inner transaction is a postgres-js savepoint. That DDL transaction sets its local search path to `public` so unqualified committed CREATE TABLE statements target the application schema; PostgreSQL still searches implicit `pg_catalog` first. No role/account seed runs. Three-second lock and ten-second statement limits apply.

Before commit, PostgreSQL catalogs are checked against snapshot 0014: exact columns/order/types/nullability/defaults, PK/unique/FK columns and public targets/actions, CHECK identity/validation/enforcement and expressions, indexes including predicates/order, object kinds/ownership, empty table counts and initial serial sequences. PostgreSQL canonicalizes trusted source CHECK/default/index SQL using empty temporary probes; no general SQL-text normalizer or dropped integrity check is used. Probes are removed inside the transaction. A separate durable inspection verifies the exact ledger and catalog/count/sequence fingerprint. Ambiguous acknowledgement, partial schema or verification failure causes inspection and controlled refusal, never automatic retry, DROP/restore or account creation. Review durable state before any separately approved recovery.

### Minimum privileges and subsequent bootstrap

| Identity | Required reviewed privileges | Must not receive |
|---|---|---|
| Runtime dedicated LOGIN | CONNECT, public USAGE; SELECT on role and application tables; required INSERT/UPDATE/DELETE for existing workflows (including shared limiter cleanup/upsert); USAGE/SELECT on application serial sequences | Database/schema CREATE, application ownership, migration ledger writes, memberships/escalation or provider-reserved roles |
| Operator dedicated LOGIN | CONNECT, public USAGE/CREATE, TEMP; database CREATE only if needed to create the absent drizzle schema (otherwise its pre-created USAGE/CREATE); catalog/identity reads; owns newly created app tables/sequences and ledger | Superuser, CREATEDB, CREATEROLE, replication, BYPASSRLS, provider-reserved memberships |
| Operator after migration | Exact full ledger SELECT; app ownership/DML needed by unchanged role/Admin tools; role sequence ownership for transactional restart | Runtime credentials fallback or public/bootstrap HTTP routes |

No grants are executed by this implementation. Runtime grants must be provisioned separately after migration; do not expose the operator-owned tables through the Data API. Provider restrictions on catalog visibility, `pg_control_system`, schema creation, TEMP, locks and role/sequence ownership remain live checks. Unavailable privileges are blockers, not a reason to elevate the operator.

After verified initialization, role seeding and Admin bootstrap remain separate private-terminal `db:seed:roles` / `db:bootstrap:admin` inspect-and-confirm operations. The hosted operator check uses the observed PG role, not the pooler routing username, preserves writable-session and full-ledger guards, and retains conflict rejection, deterministic Admin=1/Adviser=2/Student=3/Panel=4 IDs, bcrypt and hidden Admin input. There is no default password or deployment seed. Local-only fixture tools are not implicitly authorized or generalized to cloud targets.

### Data API and remaining hosted gates

Standing owner security policy (2026-11-09): **ThesiSHS AI requires the Supabase Data API to remain disabled in Preview and Production. Database migrations and runtime access must not depend on enabling the Data API.** This replaces the earlier optional-disablement/alternative-exposure recommendation. Never enable it for development, testing or migration convenience, and do not introduce REST/PostgREST as a fallback. If enabled is observed, stop and report a security-policy violation; configuration changes require separate authorization. The application uses approved PostgreSQL TCP and the separate Storage API. Retain dated Dashboard evidence with project identity and explicit reload-confirmation status; private bucket metadata does not protect database tables. See [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api), [connection formats](https://supabase.com/docs/guides/database/connecting-to-postgres) and [managed-role limits](https://supabase.com/docs/guides/database/postgres/roles-superuser).

All hosted TLS/routing/effective-role/catalog permissions, actual migration rollback/canonicalization, least-privilege runtime access and pooler scheduling remain NOT VERIFIED by isolated doubles or the synthetic build. No Vercel/project/bucket/credential changes occurred. Before Preview PDF testing, independently verify anonymous private-document denial, unrelated-path signed-upload denial and privileged-key exclusion from browser output. Full Storage policy audit remains required before production. Next: owner review, then separately authorize the minimum D.2B hosted provisioning/identity/privilege/Data API and explicit initialization steps; deployment remains a later approval.

## R4A PostgreSQL CA trust and Data API checkpoint (2026-10-23)

This checkpoint supersedes earlier unverified TLS/Data API statements only within its verified scope. The owner approved existing Development/Test Supabase project `cbkplqkkjuoglpimwmib` (Singapore) for proposed Preview PostgreSQL. Local Development PostgreSQL remains separate. Development and Preview intentionally share existing test Storage and its project-wide privileged-key trust boundary. Production will have separate clean resources.

Every non-Development runtime/operator configuration requires `THESISHS_DATABASE_CA_PEM`, containing exactly one public CA certificate in PEM format with real line breaks (LF or CRLF), at most 16,384 characters including surrounding whitespace. Missing/malformed, non-CA, not-yet-valid and expired certificates are refused with the existing sanitized error. Obtain the approved CA via the provider Dashboard's Database Settings -> SSL configuration -> Download certificate; the observed official source is `https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`. Verify its provenance before privately configuring the server/operator environment. No environment file was changed here. Never use `NEXT_PUBLIC_`, URL SSL-option overrides, `NODE_TLS_REJECT_UNAUTHORIZED=0`, or a private key. There is no file/path fallback, runtime download or global trust-store modification.

The public Supabase Root 2021 CA fixture in `tests/fixtures/tls/supabase-root-2021.crt` is isolated-test material only, not an automatic deployed trust source. Its SHA-256 certificate fingerprint is `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`. The shared configuration passes validated CA bytes to Postgres.js 3.4.9 with `rejectUnauthorized: true`, default hostname verification and unchanged direct/session/transaction-pooler restrictions. Local Development ignores this hosted CA input and retains its prior TLS behavior. A credential-free handshake using the new source configuration passed TLS 1.3/certificate/hostname verification against the approved session pooler and exited 0. No PostgreSQL startup/login/SQL was sent; actual authenticated driver success remains NOT VERIFIED.

The approved project's Data API setting changed enabled -> disabled, saved and independently reloaded as disabled. No exposure-list, RLS, grant or role settings were changed. Two publishable-key GET probes returned REST 401 and RPC 503/PGRST002, with no data returned. These responses did not identify API disablement specifically: definitive endpoint-denial verification remains unresolved; no repeated probing or re-enablement was performed. Source review found no application REST/RPC/GraphQL dependency; custom auth/data use direct PostgreSQL and PDFs use Storage endpoints.

Server-authorized bucket metadata access succeeded before and after disablement. Full returned bucket metadata had identical SHA-256 `0fc4245dcc176cf75805601dd4c7096ccd3f57d3cb3e69ab070cf0de46f6eea7`: private, `application/pdf`, 10,485,760 bytes. No object inventory, PDF read/write, signed capability or policy operation occurred; the previously observed 20 objects were not re-enumerated. Metadata compatibility does not establish signed-upload/private-document acceptance.

The previously observed non-extension `public.rls_auto_enable()` and enabled `ensure_rls` remain untouched initialization blockers. Dedicated non-elevated/non-member operator/runtime logins, actual identity/privilege checks, full source/ledger/schema safeguards and separately approved migration/bootstrap remain required. No hosted initialization, roles/grants, RLS changes, Vercel configuration or deployment were authorized or executed. R4B requires owner review, resolution of endpoint-verification ambiguity, then separately approved exact helper treatment and dedicated-role provisioning before migration approval.

## C2 Collaborative Research Workspace schema source (2026-11-05)

**Local source foundation only. No workspace migration has been generated or applied, and no database connection occurred.** Current migration SQL, snapshots and journal remain exactly 0000-0015 (16 entries); `0016` is only the next candidate, to be rechecked at a separately approved preparation checkpoint. Current P.3F.3 Preview status is controlled by the latest Master Context and supersedes historical unapplied/initialization labels above.

`db/schema/group-task.ts` defines `group_tasks`: `id serial PRIMARY KEY`; required integer `paper_id` and `created_by`; required `title varchar(200)`; nullable `description text`, `assigned_student_id integer`, `due_date date`; required `status varchar(16) DEFAULT 'To Do'`; required timezone-aware `created_at`/`updated_at DEFAULT now()`. Named CHECKs enforce nonblank title of 1-200 characters, description at most 5,000 characters and exactly `To Do`/`In Progress`/`Done`. Paper, creator and assignee FKs use `ON DELETE RESTRICT`. `UNIQUE(id,paper_id)` supports the note reference. The sole additional task index is `(paper_id,created_at,id)`.

`db/schema/task-note.ts` defines `task_notes`: `id serial PRIMARY KEY`; required integer `paper_id`, `created_by`; nullable integer `task_id`; required `title varchar(200)`, `content text`; required timezone-aware `created_at`/`updated_at DEFAULT now()`; required integer `version DEFAULT 1`; nullable timezone-aware `deleted_at`. CHECKs require nonblank title of 1-200 characters, nonblank content of 1-20,000 characters and `version > 0`. Paper/creator FKs are restrictive. Composite `FOREIGN KEY(task_id,paper_id) REFERENCES group_tasks(id,paper_id) ON DELETE RESTRICT` enforces project consistency with default MATCH SIMPLE; the independent non-null paper FK also protects unlinked notes. Indexes are `(paper_id,updated_at,id)` and `(task_id,paper_id)`.

Both are exported by `db/schema/index.ts`. No group-membership schema, existing table/column, academic status, migration or historic snapshot is changed. Assignment/current membership and role eligibility remain service rules; an FK to a user does not establish group membership. Dates are calendar-date strings. Application validation uses bounded positive integer IDs, strict Zod objects, trimmed nonblank titles, nonblank plain-text note content, exact statuses and valid ISO calendar dates. Text content is stored as text, not rendered HTML.

**Mutation integrity:** the repository uses short transactions with local 3-second lock and 5-second statement timeouts. Sorted involved user rows are locked FOR UPDATE for writes; group/membership/paper rows are locked FOR SHARE and rechecked. Task operations discover then recheck immutable creator identity. Locking the creator user also conflicts with the users-FK KEY SHARE check on a concurrent membership insertion, protecting absent-membership orphan decisions; existing membership rows are share-locked against removal. These PostgreSQL behavior expectations need real acceptance; doubles verify emitted SQL/order only. Relevant locking semantics: [PostgreSQL explicit locks](https://www.postgresql.org/docs/current/explicit-locking.html).

Task deletion locks the task FOR UPDATE, sets `task_id=NULL` on every associated note including deleted notes, increments each note's version in SQL, updates its timestamp, then deletes the task, all in one transaction. Content, author, note ID and deletion state are preserved. A failed unlink/delete or missing delete result throws to roll back. Linking takes FOR SHARE on the same task before creating/updating the note, preventing linking from passing a concurrent deletion. Note mutation predicates include ID, paper, creator, expected version and required deletion state; version increments and timestamps are SQL expressions in the same UPDATE/RETURNING. Integer overflow or any constraint failure rolls back rather than silently losing versions.

### Deferred migration preparation and execution

The exact future additive SQL requirements are the two CREATE TABLE definitions above, their serial sequences/PKs, five simple FKs, the composite task FK, one composite unique key, six CHECKs and three explicit indexes. Generate and review these from the schema only after approval; do not handwrite a numbered migration. No data backfill, existing-record rewrite, migration-prefix edit or sequence reset is intended.

`scripts/preview-migration-source.ts` remains pinned to its exact 16-migration SQL/journal/0015-snapshot digest. `preview-schema.ts` and `initialize-preview-database.ts` still describe the reviewed empty-initialization/0015-upgrade contracts; `preview-initialization.ts` preserves its recovery and uncertain-acknowledgement handling. C2 deliberately makes no speculative checksum/count/snapshot change. Schema source is now ahead of migration history; neither offline migration-history checks nor TypeScript imply that a workspace table exists.

A separately approved migration-preparation checkpoint must generate the real next migration/snapshot/journal, verify unchanged 0000-0015 bytes, review the exact new SQL, then update the complete source pin and schema/ledger expectations together. Prepare a bounded populated-database upgrade from the independently verified current ledger; do not repurpose/replay `upgradePreview0015` or relax source validation. Preserve existing-record/sequence fingerprints, target/TLS/operator separation, rollback and uncertain-result inspection. Do not copy the old synthetic-account recovery requirement into routine additive releases; apply the current owner release policy proportionately.

Future execution must independently verify the target, exact ledger, constraints/indexes, existing-record preservation, provider exposure and least-privilege grants. Intended new permissions: runtime SELECT/INSERT/UPDATE on both workspace tables, DELETE on tasks only, USAGE on their two serial sequences, and required read/row-lock privileges on existing users/groups/memberships/papers. Notes need no runtime DELETE; neither table needs runtime DDL/TRUNCATE. Verify actual row-lock prerequisites rather than assuming SELECT is sufficient. Grants, FK failures, membership rejoin/removal/account/group races, task link/delete races, actual stale-update winners, rollback and hosted behavior are **not verified by C2 isolated tests**. No operator command is authorized here.

## C2.1 Workspace migration preparation (2026-11-05)

**Generated/reviewed local source only, NOT APPLIED.** The installed Drizzle Kit 0.31.10 generated `db/migrations/0016_collaborative_research_workspace.sql`, `meta/0016_snapshot.json` and one journal entry. Generation used the existing credential-free offline config, `npx.cmd --no-install drizzle-kit generate --name=collaborative_research_workspace`. No database connection, database operator execution, grant, fixture, deployment or C3 UI work occurred. This supersedes C2's earlier not-generated status only; Preview/Production and current P.3F.3 acceptance remain unchanged.

### Exact artifacts and additive SQL review

- SQL SHA-256: `5723a915ab263564713874da26365b58e45d3001b491dec26bcff0170da5fb63`.
- New snapshot ID: `553326b6-bce0-4e89-9ff5-57e7563019f1`; `prevId` matches 0015 ID `04a95e0f-e6b9-4ea8-9f0b-4ab3434467f3`.
- Journal entry: `idx:16`, version `7`, tag `0016_collaborative_research_workspace`, generated timestamp `1793874420209`, `breakpoints:true`. There are now 17 source entries with strictly increasing timestamps; this is not an observed target ledger.
- Snapshot SHA-256: `6049ab489b5d27c377f7086d80556dadaa53f55fb38e94797cf389c68656e50e`.
- Journal SHA-256: `071b6565a5deace3b057883ae10f71b336ffcbaaa40a6caeae02484616f2e54d`.

The generated SQL has exactly 11 statements: two CREATE TABLEs, six ALTER TABLE ADD CONSTRAINT FKs on those new tables only, and three CREATE INDEX statements. It reproduces the C2 column types/nullability/defaults and all six CHECKs. Two serial PKs create two sequences; the composite task UNIQUE and two PKs add three backing indexes, for six new indexes including the three explicit ones. There are 15 PK/UNIQUE/FK/CHECK constraints, excluding PostgreSQL's own NOT NULL catalog representation.

The five simple FKs and the composite `(task_id,paper_id)` task FK all use `ON DELETE RESTRICT ON UPDATE NO ACTION`. `UNIQUE group_tasks(id,paper_id)` is present. Notes can be unlinked because `task_id` is nullable, while `paper_id` stays non-null with its own restrictive paper FK. The SQL contains no cascading deletion, existing-table alterations, data updates/backfills, DROP/TRUNCATE, grants, triggers or new enums/functions. The 0016 snapshot adds only `public.group_tasks` and `public.task_notes`; all 17 existing table definitions and other snapshot collections match 0015. Historical SQL/snapshot bytes and C2 application/schema source are preserved. The journal's original 16 records are unchanged.

### Versioned integrity and source-level compatibility

`scripts/preview-migration-source.ts` verifies both exact identities on every source read:

| Contract | Source identity |
|---|---|
| Legacy 0000-0015, `previewMigrationSource()` | 16 migrations, original snapshot and preserved digest `37824a5d2df42e54df9e50ee115c6eb7d6c42a94864c99aedfb1d63b4dbf51e0` |
| Current 0000-0016, `workspaceMigrationSource()` | 17 migrations, generated 0016 snapshot/full journal, digest `66ae30ee48e5aef8497b11015acbeb81fc339f9799eea6fe619361319385ffbc` |

The legacy journal serialization is reconstructed from its first 16 unchanged records in memory only and reproduces the exact original bytes/digest. The real generated journal is never rewritten by the source reader. A changed historical SQL hash, 0015 snapshot or prefix journal is rejected independently even if the new source digest were re-pinned. Missing/extra source migrations and changed current metadata are also rejected. Counts, raw-byte checksums and snapshots remain enforced; there is no arbitrary-prefix acceptance.

`verifyPreviewLedger` remains explicitly 15/16 for legacy 0015 preparation/recovery. `verifyWorkspaceLedger` accepts explicitly requested 16/17, defaulting to the complete 17-entry workspace contract. `recognizeWorkspaceLedger` returns `pre-workspace` for the exact 16-entry baseline or `workspace-recorded` for the exact 17-entry ledger, requiring every source hash/timestamp and ordered positive IDs when supplied. Rollback ID gaps remain valid. A recorded ledger alone does not verify catalog, grants or operational readiness. No target was inspected here.

The old Preview initializer still handles empty initialization/0015 upgrade only. Its application helper now passes the verified 16-entry prefix to the installed ORM dialect migrator through the existing postgres-js transaction/savepoint adapter, preventing folder expansion from accidentally applying 0016. The original source approval identity, target pins, recovery evidence and uncertain-acknowledgement/no-retry logic remain intact. The generic role/Admin operator likewise verifies the exact legacy prefix; it cannot silently consume 0016. These legacy operators intentionally refuse a later 17-entry target; the new ledger recognizer is source-level preparation for a separate workspace operator, not a new execution CLI.

`preview-schema.ts` preserves legacy `initialize`/`upgrade-0015` contracts and adds explicit `workspace-baseline` (0015 catalog with existing data, including push subscriptions) and `upgrade-0016` (0016 catalog; only the two new workspace tables/new sequences must be unused) verification modes. All other full catalog/ownership/FK/CHECK/index/default/trigger checks remain. Unknown modes are refused. These functions include temporary database DDL for expression canonicalization, so they were **not run against a database** in C2.1.

### Privilege plan and remaining execution gates

No GRANT/REVOKE SQL is embedded in 0016; current privileges are unchanged. Follow the existing separately reviewed operator-grant convention after independently verifying the exact environment and runtime identity:

| New object | Required runtime privilege |
|---|---|
| `public.group_tasks` | SELECT, INSERT, UPDATE, DELETE |
| `public.task_notes` | SELECT, INSERT, UPDATE; no hard DELETE |
| `public.group_tasks_id_seq`, `public.task_notes_id_seq` | USAGE only |

Verify effective privileges, inheritance, ownership/default grants and provider/Data API/browser-role exposure; merely omitting a grant does not prove denial. Verify existing SELECT and row-lock UPDATE prerequisites on users/groups/memberships/papers before proposing any narrowly scoped extra privilege. Do not broadly grant existing-table access, sequence UPDATE, runtime DDL/TRUNCATE, note DELETE or anonymous/browser access. No new grant/operator command is supplied or executed in this checkpoint.

Before application, separately approve a bounded workspace upgrade/acceptance procedure: independently verify target/TLS/operator/runtime identities and exact 16-entry baseline, verify catalog with the populated baseline contract, capture existing-record/sequence preservation, apply only reviewed 0016 with the intended minimal grants, verify the exact 17-entry ledger/catalog/new-sequence state and independently confirm durable preservation. Inspect an uncertain result rather than retrying. Keep raw migration/metadata bytes intact and recheck source identity after any future reviewed Git checkout. Routine additive changes use the current proportionate release policy, without replaying synthetic-account backup/recovery setup.

Local Drizzle check, generated-object comparisons, eight C2.1 source tests, nine focused legacy operator/migrator guard tests, one existing C2 source-boundary test, TypeScript, targeted ESLint and whitespace checks PASS. Actual PostgreSQL constraint violations, concurrency/row locks, privileges, migration application, durable rollback/preservation and deployment acceptance remain pending. Full commands/evidence and proposed C2.2 scope are in the latest Master Context.

## C2.2 disposable database safety gate (2026-11-05)

**BLOCKED BEFORE DATABASE CONNECTION OR MUTATION.** The owner authorized real acceptance only on a positively identified disposable local target, and required stopping if target/operator/isolation could not be verified. No database was created, connected, migrated, granted, seeded, changed or removed in this attempt. No target ledger, PostgreSQL constraints, runtime permissions or concurrency result is claimed. Source preparation remains valid; database acceptance remains pending.

The read-only configuration inspection found a credentialed loopback application `DATABASE_URL` with no disposable acceptance marker. It is the ordinary application configuration and was excluded from acceptance writes. No local `THESISHS_DATABASE_ADMIN_URL`, acceptance URL or target mapping was available in the inspected process/application configuration. The project's private operator-configuration candidates were also inspected without emitting secrets: no approved local acceptance operator/target was established, and the available connection configuration was non-loopback. It was not used. Installed PostgreSQL 18 binaries alone do not establish an authorized disposable database or operator.

Consequently, exact local acceptance cluster/database OID, database marker/ownership, emptiness, distinct runtime/operator identities and target-specific privileges could not be independently verified. No runtime-credential fallback or new local cluster/role/database setup was attempted. The existing ordinary development database and hosted Preview/Production remain untouched; Preview's previously reported 16 applied migrations were not queried here.

Offline preflight confirmed the exact `0016_collaborative_research_workspace.sql` hash `5723a915ab263564713874da26365b58e45d3001b491dec26bcff0170da5fb63`, 17 source-journal entries and workspace source digest `66ae30ee48e5aef8497b11015acbeb81fc339f9799eea6fe619361319385ffbc`; the preserved legacy reader still returns its reviewed 16-entry prefix. There is no migration-source discrepancy. `npx.cmd --no-install drizzle-kit check` and the eight local tests in `tests/c21-workspace-migration.unit.cjs` PASS. These are offline source checks, not PostgreSQL acceptance. No C2.2 operator/test code was added, so TypeScript/lint/build/browser checks were not repeated. Only this database handoff and Master Context receive appended status documentation.

**Minimal setup to resume:** make a distinct approved local migration operator and an independently marked, empty disposable acceptance database available through a protected private process configuration compatible with the project's target guards. Provide the intended separate runtime identity and independently verified cluster/database OID, owner and disposable marker. Alternatively, provide an existing approved local operator and isolation policy that explicitly permit creating that dedicated database. Keep the normal development application configuration and all hosted resources unchanged; do not put credentials in chat or source control. Resume the safety gate and verify actual identities/privileges/emptiness before any migration. An empty target still requires the reviewed guarded 0000-0015 baseline before applying only 0016.

All real C2.2 checks remain NOT RUN: 16-to-17 application/durable ledger/catalog, positive/negative runtime grants, FK/CHECK behavior, service authorization/orphan recovery, note CAS, task unlink/delete/rollback, linking/removal races and synthetic data preservation. No synthetic resources were created, so cleanup was unnecessary. C3 readiness remains blocked pending successful C2.2 acceptance and separate owner UI authorization.

## C2.2 retry: recovered local connectivity, isolation still blocked (2026-11-05)

**Local PostgreSQL connectivity VERIFIED; acceptance remains BLOCKED before mutation.** This retry follows the owner's report that pgAdmin connects again. It does not replace the first attempt's historical no-connection result. No database/role/schema/data/grant mutation, migration application, cleanup, hosted connection or deployment occurred in this retry.

The Windows `postgresql-x64-18` service is Running and `pg_isready` reports loopback port 5432 accepting connections. A bounded connection using the existing application configuration verified an actual local server address, matching configured database/port and session identity. Both metadata inspections used startup `default_transaction_read_only=on`, explicit READ ONLY transactions, a five-second statement timeout and clean connection closure. Queries were limited to server identity and role/database catalogs; no research records or passwords were queried or printed.

Observed ordinary application database identity: cluster `7652422818440234372`, database OID `16387`, loopback port 5432. This identifies the non-acceptance database used for read-only recovery inspection only; it is not an approved writable target. The application login has administrative flags and was not substituted for a migration operator.

Actual role metadata shows `thesishs_local_operator` exists with LOGIN and without SUPERUSER/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS. It is the only other non-system role; no separate acceptance runtime role was found. Its private connection is not configured in the inspected process/application environment: operator URL, acceptance URL and target mapping remain absent. No operator authentication or target-specific ownership/permissions were tested.

Catalog inspection found `thesishs_ai_phase5_acceptance` as the other non-maintenance application database. It is owned by `postgres`, has no database comment/marker, and has no independently verified C2.2 disposable purpose. No C2.2-marked database was found. The candidate was not connected, queried for application data, migrated, dropped or repurposed. Its name is not isolation evidence.

**Smallest safe owner setup using existing pgAdmin:** use the administrative pgAdmin session to create a new empty dedicated database, proposed name `thesishs_c22_acceptance`, owned by the existing `thesishs_local_operator`; explicitly record its disposable C2.2 purpose in a database comment/approved private target record. Create a separate non-administrative runtime LOGIN, proposed name `thesishs_c22_runtime`, for this target only. Provide protected acceptance-process connection/profile configuration for both roles and pin the new database OID, observed cluster, owner and marker. These proposed resources have not been created. Do not reset operator passwords automatically, grant the operator cluster-wide CREATEDB/CREATEROLE, or alter/recreate either existing application database. Keep the normal application `.env` and hosted settings unchanged; do not paste secrets into chat. Runtime privileges and row-lock prerequisites must be verified/granted only through the separately checked acceptance target.

After setup, resume the safety gate: independently verify both logins, exact new identity/owner/marker/emptiness and operator authority, establish the guarded 16-entry baseline, then apply only approved 0016 and perform the bounded checks. Current source identity and expected SQL hash still match C2.1; no artifacts changed. Successful offline suites were not repeated because their relevant source is unchanged. Actual target ledger, constraints, privilege denials, authorization/orphan recovery, CAS, task deletion/rollback/races and synthetic preservation remain NOT TESTED. C3 remains blocked pending real acceptance and separate owner authorization.

## C2.2A development-first local upgrade gate (2026-11-05)

**BLOCKED - no migration applied.** This owner-approved checkpoint targets the existing thesishs_ai directly, preserving records and workflows. It supersedes the earlier disposable-target/new-runtime proposal for C2.2A only; no new service/database/role, destructive test, Preview/Production change or automatic C2.2B/C3 work is authorized.

Fresh bounded READ ONLY observation confirmed loopback ::1:5432, cluster 7652422818440234372, database thesishs_ai/OID 16387, owner postgres and exactly 15 source-matching ledger entries through 0014. All 16 prior public tables remain present. push_subscriptions/group_tasks/task_notes and the two new workspace sequences are absent. Source reader accepted the 17-entry aggregate 66ae30ee48e5aef8497b11015acbeb81fc339f9799eea6fe619361319385ffbc; 0016 SHA-256 is 5723a915ab263564713874da26365b58e45d3001b491dec26bcff0170da5fb63. Required pending order: 0015 then 0016; neither was executed. Full live catalog compatibility is not established by ledger/table presence alone.

The existing operator has public USAGE/CREATE, drizzle USAGE, ledger SELECT/MAINTAIN and INSERT(hash,created_at), ledger-sequence USAGE/SELECT, REFERENCES(users.id,research_papers.id), and pg_control_system EXECUTE. It is a non-elevated LOGIN without memberships. Table-level ledger INSERT is false while the required column-level INSERT privileges are true: do not recommend a redundant broad ledger grant from the table-level result. No missing grant has been established for the inspected SQL dependencies; final execution-specific locking/preservation requirements still need review.

The protected local operator connection is unavailable to this process: no THESISHS_DATABASE_ADMIN_URL or THESISHS_DATABASE_TARGETS_JSON in the process/application environment, and no usable local operator URL found in the seven inspected protected Connections files. Those files contain hosted configuration, which was not connected. pgAdmin/other-session/other-location credentials remain unverified. Existing application postgres credentials were used only for authorized read-only identification/catalog checks, never migration authority. Authenticate the existing operator privately before mutation; do not recreate/reset it automatically or change normal DATABASE_URL.

### Backup and recovery procedure to complete after the operator gate

No backup was created because C2.2A requires stopping before mutation if authenticated operator authority is unavailable. Existing whole-database backup conventions remain applicable; no restore test or new disposable database is required by C2.2A. For an owner-operated pgAdmin backup:

1. Select the existing local PostgreSQL 18 server and independently confirm thesishs_ai/OID 16387 and cluster 7652422818440234372. Arrange a quiet window for application writers.
2. Use an existing private directory under C:/ThesiSHS-Private/Backups outside every checkout, with protected ACLs permitting only the authorized account, SYSTEM and Administrators. Select a unique C2.2A archive filename; do not overwrite a retained archive.
3. Right-click thesishs_ai, choose Backup, select Custom format, and use the installed PostgreSQL 18 pg_dump. Include pre-data, data and post-data; leave schema/table filters empty; use the established no-owner/no-privileges convention. Include public, drizzle migration ledger, sequences and all existing account/group/paper/submission metadata. Keep connection credentials inside the private connection mechanism, never command arguments or logs.
4. Require a successful backup process exit, nonzero archive size, PGDMP header and recorded SHA-256. Privately inspect pg_restore --list and confirm TABLE DATA entries for users, research_groups, group_members, research_papers, submissions, submission_upload_intents and drizzle.__drizzle_migrations, plus sequence definitions/values and all other expected relations. An inventory/checksum is archive verification, not a tested restore. Record the absolute private archive path and client version outside Git.
5. Recovery approach: retain that exact whole-database custom archive and separately review a complete logical restore with compatible PostgreSQL 18 pg_restore, exit-on-error/single-transaction and the recorded no-owner/no-privileges convention. Recovery must account for existing-object conflicts and restore required ownership/ACLs from the verified pre-migration model. Do not restore into development as a test or issue an automatic DROP/clean/rollback. Any actual recovery/destructive preparation needs an exact target/recovery plan and separate owner authorization. No restoration was attempted here.

After private operator authentication and verified backup, a narrow local operator extension must pin cluster/database/OID and migration digests, verify the complete starting ledger/catalog, apply only 0015 then 0016, and verify the exact 17-entry durable result and existing-record/sequence preservation. Existing hosted/0014 guards stay unchanged. No such extension was implemented or run while this gate was blocked. Existing runtime remains postgres as explicitly accepted for this development-only checkpoint; restricted-runtime acceptance is not claimed.

Validation: 8/8 C2.1 source-integrity tests and 9/9 selected legacy operator/source/savepoint/upgrade-guard tests PASS, offline with doubles. No changed tooling requires a new TypeScript run; no behavioral/concurrency/rollback/browser acceptance ran. Only this file and Master Context were appended; incoming code/migrations/index remain untouched. C2.2B remains BLOCKED pending successful C2.2A execution and verification.

Final C2.2A source checks: targeted ESLint PASS; staged/unstaged git diff --check PASS. Incoming-file and raw-index byte preservation are checked separately; only the two authorized document appendices may differ.

## C2.2A simplified local migration applied through 0016 (2026-11-05)

**PASS - Local development database migrated through 0016.** The owner's explicit local-administrator exception supersedes the prior separate-operator connection blocker for this checkpoint only. Existing protected local credentials authenticated postgres/current-session identity on ::1:5432, thesishs_ai/OID 16387, cluster 7652422818440234372, owner postgres, superuser true. No pgAdmin saved-password extraction or unverified URL fallback. Hosted Preview/Production and their role/TLS/operator policies were not changed or contacted. No roles, databases, services or runtime infrastructure were created.

Starting state: exact 15-entry source-matching ledger through 0014, 16 existing public tables, no push/workspace tables. Full source-based baseline catalog validation passed (67 constraints, 33 indexes), including the existing operator-owned submission_upload_intents table/indexes. Source aggregate 66ae30ee48e5aef8497b11015acbeb81fc339f9799eea6fe619361319385ffbc and 0016 SHA-256 5723a915ab263564713874da26365b58e45d3001b491dec26bcff0170da5fb63 remain unchanged; SQL, journal and snapshots were not rewritten.

### Actual backup and execution evidence

- Whole-database PostgreSQL 18.4 custom-format pg_dump, outside Git/cloud folders in a new protected private backup directory. Exact location/inventory/baseline/migration result retained privately. No table/schema filters; schema/data/ownership/ACLs and public/drizzle sequences included. Temporary private PGPASSFILE removed after use. Backup table/ledger SHARE locks and aggregate state comparisons established a consistent quiet window.
- Archive 73,368 bytes, PGDMP header, SHA-256 a6bf26593d5b48daec02b778fd3f0135b2f194824bd9aa1ebb57184dbbe9e7d7. pg_restore --list verified 17 TABLE DATA entries (16 application tables plus ledger) and sequence values. Full archive SQL decoding to NUL passed without connecting. Archive checksum remained unchanged afterward. This is archive verification, not an executed restoration test. Actual recovery would require a reviewed exact-target/conflict plan before any restore/clean; no restore or destructive rollback ran.
- New narrowly scoped scripts/migrate-local-workspace.ts uses the owner-approved existing local postgres connection with strict loopback/port/admin/cluster/database/OID pins, source/ledger checks and private backup/state binding. Explicit --execute requires target/source/archive confirmations; --inspect is a pre-upgrade-only command. It refuses completed/partial-history replay; errors stop without automatic retry and attempt bounded durable-state reporting if execution began.
- Installed Drizzle PgDialect/session migration, using the existing postgres-js savepoint technique, supplied exact reviewed prefixes in two separate transactions: first 16 source entries applies only pending 0015, verifies/commits/read-backs 16; then 17 source entries applies only pending 0016, verifies/commits/read-backs 17. Accurate ledger writes are performed by the installed ORM in each transaction. Session advisory lock, ledger/table locks and timeouts bound the operation. No manual fabricated ledger records, drizzle-kit push, unrelated migration or source rewrite.
- scripts/preview-schema.ts adds a distinct local 15/16/17 catalog entry point with pinned snapshot selection and exact postgres/legacy-upload-operator ownership expectations. Existing hosted modes/ownership safeguards remain. Full catalog checks use only empty temporary canonicalization objects in addition to the approved new schema; no research/synthetic data writes.

### Verified installed state and preservation

0015 and 0016 both returned applied-verified. Final ledger has exactly 17 expected hashes/timestamps, valid ordered IDs and no duplicate/missing entry. push_subscriptions has 11 columns, four CHECKs, two UNIQUE constraints, PK/users cascade FK and three indexes; zero subscriptions. group_tasks/task_notes each have ten columns; six restrictive FKs, six CHECKs, two PKs, one composite UNIQUE and matching composite task/project FK; three explicit indexes, six indexes total and two serial sequences. Note version/deleted_at are installed. Workspace tables are empty; both new sequences remain 1 / not called.

Independent READ ONLY post-verification compared the private pre-backup state: all 16 original table row digests/counts, column/default/constraint/index signatures and existing public sequence definitions/values are unchanged. Counts remain users 10, groups 12, memberships 5, papers 18, submissions 33, feedbacks 22, repository entries 12, notifications 25 and upload intents 1; remaining activity/security tables were also included. Existing PDF metadata and submission/review history were preserved. No research records or credentials were printed.

Validation: 6 new local guard tests, 8 existing C2.1 source tests and 9 selected legacy operator/savepoint/upgrade guards PASS (23 selected tests total); TypeScript PASS, targeted ESLint PASS, Drizzle Kit consistency check PASS. Final whitespace and byte-preservation checks are recorded with the owner result. Exact checkpoint edits: scripts/migrate-local-workspace.ts (new), tests/c22a-local-migration.unit.cjs (new), scripts/preview-schema.ts (local-only support), and this/Master Context appendices. Incoming source/documentation and Git index remain preserved; no stage/commit/push/merge.

**C2.2B: READY FOR SEPARATELY SCOPED FOCUSED FUNCTIONAL TESTING, not executed.** No CRUD, runtime authorization/privilege denial, CAS/orphan recovery, concurrency, destructive rollback, PDF/browser workflow or notification-delivery acceptance is claimed. Local runtime remains the existing elevated postgres identity under the explicit exception. No C3/C4 or deployment began.

## C2.2B lean local database functional acceptance (2026-11-05)

**PASS - All seven essential database-backed tests passed.** Fresh observed identity: ::1:5432, thesishs_ai/OID 16387, cluster 7652422818440234372, postgres current/session/owner with superuser true. Configured DNS/loopback identity and exact 17-entry source-matching ledger were verified before mutations and on the fixture transaction connection. group_tasks/task_notes existed and started empty. No migration execution, new backup, database/role/service or hosted connection was needed.

New explicit --execute harness tests/c22b-workspace.acceptance.cjs uses one outer transaction and actual Drizzle/Postgres.js service savepoints. Existing upload fixture conventions were inspected but their old version gate/larger committed fixtures were not reused. Only new marked synthetic records were inserted: four accounts (Adviser plus three Students), one active group with two members, two Draft papers (second only for cross-project ID checks), two tasks and three notes. All IDs were recorded; no real development account, paper or stored document was repurposed.

Actual workspace service/repository and JWT create/verify/getSession ran; the harness supplies a synthetic in-memory cookie adapter and process-only signing key instead of an HTTP request. The application DB singleton is forbidden by the harness. This exercises service authorization with real persisted memberships/account roles, not password-login/browser acceptance or non-superuser SQL privilege enforcement.

| Essential test | Result |
|---|---|
| Task creation | PASS: stored correct paper/JWT creator/default To Do; forged creator input rejected. |
| Assignment | PASS: eligible member assignment stored; external assignment denied without changing the stored assignee. |
| Status | PASS: assignee stored In Progress then Done; outsider denied; paper stayed Draft. |
| Unauthorized access | PASS: external listing/direct-ID mutations denied without details; cross-paper task IDs failed even for an otherwise authorized group member; absent/tampered sessions denied. No getTask endpoint exists; task reads are list-only and actual direct-ID mutation boundaries were exercised. |
| Note create/edit | PASS: correct attribution/content; version 1 to 2; other-member and outsider edits denied without changes; outsider direct note read denied. |
| Delete task/preserve notes | PASS: active and other-author soft-deleted notes survived, both links nulled, content/authorship/deletion state preserved, versions incremented once; unrelated task/note unaffected. |
| Sequential stale note edit | PASS: current edit persisted; stale edit returned conflict; winning content retained and version advanced once. |

All writes were read back inside the outer rollback transaction; this is real database-backed functional evidence, not a durable-commit or concurrency-race test. After intentional rollback, independent READ ONLY checks confirmed all exact fixture IDs and marker absent, both workspace counts restored to zero, all 19 application tables' original row digests/counts and schema signatures unchanged, and the 17-entry ledger unchanged. Sequence definitions/unrelated values matched. The six fixture sequences advanced normally (users, research_groups, group_members, research_papers, group_tasks, task_notes); no sequence reset or broad deletion was performed. No failed-cleanup evidence file was necessary.

No C2 defect/fix, schema change or migration modification. Seven acceptance scenarios ran once and passed; targeted harness ESLint and final whitespace/preservation checks PASS. No changed TypeScript implementation or C2 source required further compiler/isolated regression runs; prior migration suites were not repeated. Exact edits: new tests/c22b-workspace.acceptance.cjs plus this and Master Context appendices. Incoming work/prior documentation/index preserved; no Git writes.

**C3 readiness:** lean C2 functionality is verified for separate owner scoping of C3, which was not started. Restricted-runtime privileges, HTTP/browser authentication, concurrent races, orphan recovery/restore/link variants, additional constraints/negative cases and production readiness remain unverified. No PDF upload, publication, Web Push delivery, AI/offline/full UI or hosted acceptance was claimed; Preview/Production remain untouched.


## C6 Collaborative Research Workspace local database closure (2026-11-06)

Collaborative Research Workspace is complete for the approved local demonstration scope. Preview activation and production-readiness checks remain separately gated.

The C2.2A/C2.2B/C5 handoffs establish local application through 0016 with 17 source-matching entries, verified private backup/archive evidence, seven functional service/repository scenarios and actual authenticated browser persistence. C5's 13 groups combine main-run and focused follow-up evidence, not an uninterrupted corrected full-harness run. Each executed fixture attempt verified cleanup and original-row/catalog/ledger preservation; fixture-used sequence advances were retained. C6 does not reconnect to PostgreSQL or independently refresh that historical runtime evidence.

Offline C6 source review confirms 0016 SHA-256 5723a915ab263564713874da26365b58e45d3001b491dec26bcff0170da5fb63, unchanged historical 0000-0015 SQL/snapshot bytes, preserved journal prefix and old snapshot tables. The legacy 16-entry source digest remains 37824a5d2df42e54df9e50ee115c6eb7d6c42a94864c99aedfb1d63b4dbf51e0; the 17-entry source digest remains 66ae30ee48e5aef8497b11015acbeb81fc339f9799eea6fe619361319385ffbc. Existing legacy operators still cannot apply 0016 accidentally. The scoped local migration runner is a historical pre-upgrade execution path, not a command to replay against the already migrated database. No SQL, snapshot, journal, role, grant or database is changed during C6.

Deferred: Preview migration 0016 and minimum runtime privileges, Preview/Production deployment, restricted-runtime privilege verification, production concurrency/race testing, additional browsers/devices and an uninterrupted rerun of the corrected full C5 harness. No database/server/provider operation, push, merge or deployment is authorized by C6. The local privileged postgres acceptance exception does not establish restricted-runtime grants. Backups/credentials/private operator state and browser evidence remain outside the commit. See [the C6 closure and exact inventory](MASTER_CONTEXT_UPDATED.md#c6-collaborative-research-workspace-local-closure-2026-11-06).

## Research Supervision S3.1 — migration 0017 source, UNAPPLIED

`db/schema/research-supervision.ts` and generated `0017_research_supervision.sql`/`0017_snapshot.json` add exactly two tables. No existing table or historical migration/snapshot is altered. The journal appends entry 17 (18 total source entries). The SQL additionally inserts only the unconfigured singleton row, with ID 1, null Adviser/Admin references and revision 0. No account is selected, created or modified by the migration.

- `main_adviser_designation`: fixed-key primary key/CHECK enforcing at most one row; nullable restrictive user references for `main_adviser_id` and `updated_by`; nonnegative integer revision and timezone-aware update timestamp. A CHECK distinguishes the initial null/null/revision-0 state from configured non-null references/positive revision. Active Role ID 2 target eligibility and active Admin authority are checked transactionally in the application, not inferred from foreign keys or JWT designation claims. There is no runtime clear/delete operation.
- `co_adviser_review_assignments`: exact submission FK, Co identity, assigning Main identity, state, nullable private recommendation, creation/completion/closure timestamps, optional closing actor and bounded closure reason. All six new-table foreign keys use `ON DELETE RESTRICT`. A partial unique index prevents duplicate `open` rows for one submission/Co pair while permitting distinct Co-Advisers and retained historical rows; an inbox index supports later exact-assignment queries. No redundant paper/version or separate recommendation table is added.
- CHECKs require distinct assigning/assigned actors, nonblank recommendations of 1–20,000 characters when present and consistent lifecycle data. Open rows have no recommendation/completion/closure data; completed rows require content and completion timestamp with no closure data; closed rows require closure time/reason and preserve either no recommendation/completion or both, with ordered timestamps. A null closing actor permits later system closure. No workflow, API, runtime grants or delegation access is activated by this foundation.

The legacy 16-entry and workspace 17-entry source digests remain unchanged. `supervisionMigrationSource()` separately pins the 18-entry source; existing initialization/upgrade commands retain their old ranges and cannot execute 0017. No hosted/local project migration command was run. Offline snapshot/Drizzle consistency and source-pin checks pass; real PostgreSQL CHECK/unique/FK execution, migration compatibility and race behavior remain BLOCKED pending explicit approval for a fresh disposable local cluster. S3.2/S3.3 and a separately reviewed migration/least-privilege execution plan are required before integrated deployment. Before 0017 exists, the new configuration and managed role/status writes intentionally fail closed.


## Research Supervision S3.2 - transaction delta only (2026-11-08)

No schema, migration, snapshot, journal, source pin, role or grant changes are made by S3.2. The existing 0017 remains unapplied to existing development/hosted databases. The retained disposable S3.1 verification completed 20 actual PostgreSQL 18.4 groups with no remaining failures, then positively identified/stopped/removed its own cluster; that receipt supersedes the earlier S3.1 blocked label only for its tested scope. It was not rerun for S3.2.

S3.2 adds current-Main SQL predicates and a common academic lock boundary: ascending user rows -> singleton SHARE -> resource rows, compatible with unchanged S3.1 replacement/lifecycle protections. Feedback decisions lock the submission before writing feedback/status/paper/activity. Membership add/remove locks the Main and target Student accounts, then designation and related group rows before rechecking eligibility and mutating. This serializes Main membership assignment requests without adding a new membership constraint or rewriting existing records. Main authority is fail-closed while 0017 is absent/unconfigured; Student upload commits remain independent and skip unavailable Main notifications.

Focused SQL-shape/service/rollback/race checks use synthetic doubles only. Actual PostgreSQL validation of these new academic/membership lock interactions remains pending separate authorization for a new disposable local cluster. No existing database credentials were loaded and no cluster, connection, migration, Storage or hosted operation ran in S3.2. S3.3 delegation lifecycle and integrated readiness remain separate.


## Research Supervision S3.3 - existing 0017 runtime use (2026-11-08)

No schema, SQL, snapshot, journal, source-pin, role or grant change. The existing co_adviser_review_assignments table stores every private recommendation and terminal history. Its partial unique open-pair index remains the backstop; services also reject duplicate open requests while holding the exact submission lock. Requests support up to twenty distinct active eligible Co-Advisers atomically. Completed/Closed records are never reopened or overwritten; later delegation inserts a new row.

Account/singleton/submission/assignment lock ordering follows S3.2. Completion conditionally changes open to completed with text/time plus activity in one transaction. Cancellation conditionally closes open with main-cancelled reason. Official decisions close all exact-submission open rows with official-decision reason and Main attribution inside the existing feedback/status/paper/activity transaction. Completed recommendations and other submission versions are untouched. Timestamps use greatest(clock_timestamp(), created_at), and no recommendation text enters activity or notification messages.

Offline doubles verify conditional writes, exact owner/version predicates, state preservation and audit rollback, including final activity failure after academic writes. These are not PostgreSQL constraint/concurrency evidence. The preserved S3.2 receipt under test-results/s32-pg-20261108-aa495123-9e1b-45d1-a7de-f05965a518ef records 17 real PostgreSQL checks/nine observed races and verified cleanup for S3.2 only. S3.3 real contention and restricted-runtime permissions require separate authorization. No cluster initialization, connection, migration, grant or existing/local/hosted database operation ran here. 0017 remains unapplied to existing development/hosted databases.


## S3.4B.1 - Prepared Preview 0017 upgrade boundary (2026-11-09)

The existing initialize-preview-database.ts now supports separate --inspect-upgrade-0017 / --upgrade-0017 modes. Execution requires exact source-matching 17 entries through 0016, pinned Preview operator identity, explicit terminal confirmations and fresh verified private archive/evidence bound to the unchanged preflight target/catalog/preservation digests. Only 0017 is passed to the existing ORM savepoint migrator. Runtime grants are designation SELECT/UPDATE, assignments SELECT/INSERT/UPDATE and assignment-sequence USAGE; no unrelated grants/roles are modified. Canonical schema, singleton/empty assignments/new sequence, existing-data/ACL/sequence preservation and minimum/denied/exposure privileges are checked before commit and durable readback. Read-only inspection reports installed 0017 without authorizing replay; it does not run temporary canonicalization DDL.

Preparation only: 41 focused offline cases and static checks PASS; all PostgreSQL/catalog/parser/backup-loading effects are doubles. No connection, migration, grant, backup/export/restore or Storage/hosted operation ran. Existing source artifacts and legacy modes are retained. No new hosted ledger or readiness claim supersedes the last verified 0016 baseline. Exact evidence record, scope, safeguards and future approval sequence: [S3.4B.1 operator handoff](PHASE10_S34B1_PREVIEW_OPERATOR.md). The prior 0016-only no-backup exception cannot authorize 0017.


## S3.4B.2C.1 - Read-only catalog compatibility (2026-11-09)

The 0017 guarded operator now uses SELECT-only verification for both accepted 17/18-entry states and migration pre/post checks. It checks exact application and ledger structures, defaults, keys/CHECKs, index definitions/health, serial sequence ownership/properties, object ownership/security, triggers, expression bindings and rewrite rules. Existing target/source/history, effective grants/exposure, backup/pre-state and preservation controls remain. TEMP is no longer required by this 0017 catalog path; legacy/local temporary canonicalization is preserved. No migration or grant changed.

63 offline tests and static checks PASS; no PostgreSQL connection, new instance, migration, grant, backup access, Storage or provider operation. Exact forms fail closed on unsupported equivalent representations; live-server renderings and provider DDL-trigger behavior remain unverified. The current Data API prerequisite needs a read-only inspection/reload of Enable Data API in the pinned project Dashboard, with safe identity/time evidence. CLI confirmation, local api.enabled, exposed schemas and HTTP error responses are insufficient. See the [updated operator handoff](PHASE10_S34B1_PREVIEW_OPERATOR.md#s34b2c1---catalog-only-compatibility-2026-11-09) for the supported procedure and separate authorization gates.

## Migration 0017 - verified execution handoff (2026-11-10)

Migration 0017 was previously applied to LOCAL development. The separately authorized Preview execution now also records PASS: one guarded execution, commit and independent durable inspection; 18 source-matching ledger entries through 0017. The pinned Preview target is project `cbkplqkkjuoglpimwmib`, database `postgres`, OID 5, native cluster `7678069749886157684`. No replay or additional migration is required by this handoff.

The reviewed SQL SHA-256 remains `155d1cfacb773838133d4bce215c1dbbd4011d277c1f11f7cb7ca0299169a98a`; the supervision source aggregate remains `2e914ebc46baa807051618a2dc6542ec3f859b166bf4a759fca6f7a56a35ef40`. Historical migrations and the previous 19 table definitions are unchanged. The receipt confirms the two additive tables, unconfigured singleton (revision 0), zero assignments and the unused new serial sequence. Exactly three minimum grant statements provided runtime designation SELECT/UPDATE, assignment SELECT/INSERT/UPDATE and sequence USAGE, without grant options or new API-role exposure. Existing application records, catalog definitions, ACLs and sequence state were preserved.

These are retained execution results; no database connection or write occurred in the local Git checkpoint. Backup scope, Data API evidence limitations, durable results and pending authenticated Preview/PDF acceptance are recorded in the [operator handoff](PHASE10_S34B1_PREVIEW_OPERATOR.md#s34b2c---verified-preview-execution-2026-11-10). The permanent disabled-Data-API policy remains mandatory; this checkpoint does not independently refresh Dashboard state or authorize a designation, account change, restore or deployment.
