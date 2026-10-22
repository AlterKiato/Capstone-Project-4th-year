# ThesiSHS AI --- Database Reference

**Purpose:** Database/schema reference for AI agents and developers.

**Current Git checkpoint (2026-10-07):** `feature/development`, HEAD `70b8fb4` — `docs(phase5): close Phase 5.4 acceptance`. Phase 5.1/5.2 are committed. Phase 5.3 is complete and runtime-accepted; Phase 5.4 is committed locally; Phase 5.5 source/tests and documentation remain uncommitted.

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

Typical commands:

``` bash
npx drizzle-kit check
npx drizzle-kit generate
npx drizzle-kit migrate
```

Do not run `migrate` against a target environment without first
reviewing the generated migration and confirming that it is safe for
that database.

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
