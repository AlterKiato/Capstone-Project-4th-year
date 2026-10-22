# ThesiSHS AI --- Database Reference

**Purpose:** Database/schema reference for AI agents and developers.

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
