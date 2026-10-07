# ThesiSHS AI --- Database Reference

**Purpose:** Database/schema reference for AI agents and developers.

**Current Git checkpoint (2026-10-07):** `feature/development`, HEAD `73ca174` ---
`docs(progress): record Phase 4 audit commit`. Phase 5.1/5.2 source changes are in the uncommitted working tree.

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
-   Signed URL lifetime: five minutes

The database record and storage object must remain consistent.

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

`0009_repository_paper_unique.sql` exists in the current repository
migration history. It was **not applied** during Phase 5.1/5.2 work.

Its existence does not establish its state in any target database.
Inspect the migration and verify the intended database before any
future application; do not apply it as part of Phase 5.2.

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

1.  Read `SOURCE_OF_TRUTH.md`.
2.  Read `MASTER_CONTEXT.md`.
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
