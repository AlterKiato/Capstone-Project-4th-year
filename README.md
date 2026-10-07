# ThesiSHS AI --- Documentation & Agent Handoff Guide

**Purpose:** Navigation guide for the project's canonical documentation
and AI coding-agent handoff.

## Documentation Files

### `docs/SOURCE_OF_TRUTH_UPDATED.md`

Canonical reference for stable architecture, product rules, scope,
roles, security rules, storage rules, and durable decisions.

### `docs/MASTER_CONTEXT_UPDATED.md`

Living checkpoint for current development progress, completed
milestones, blockers, testing evidence, roadmap status, and immediate
next actions.

**Current Git checkpoint (2026-10-07):** `feature/development`, HEAD
`73ca174` — `docs(progress): record Phase 4 audit commit`. Phase 5.1/5.2
implementation changes are present in the uncommitted working tree.
Check `git status` before treating them as committed or changing files.

### `docs/ARCHITECTURE_UPDATED.md`

Technical reference for the application layers, module responsibilities,
authentication/authorization flow, storage flow, and implementation
patterns.

### `docs/DATABASE (1).md`

Canonical database/schema reference. Use it for tables, relationships,
constraints, migrations, and database-specific rules. Verify the actual
repository/database state before applying migrations.

## Recommended Agent Reading Order

``` text
docs/SOURCE_OF_TRUTH_UPDATED.md
        ↓
docs/MASTER_CONTEXT_UPDATED.md
        ↓
git status / branch / HEAD
        ↓
docs/ARCHITECTURE_UPDATED.md
        ↓
docs/DATABASE (1).md (when database work is involved)
        ↓
actual source code
```

Before changing anything:

``` bash
git status --short
git branch --show-current
git log -1 --oneline
```

Do not assume documentation is newer than the actual checkout.

## Current Development Status

Phase 4 is complete. Phase 5.1 Document Storage Foundation and Phase
5.2 Submission ↔ Document Integration are also complete and
runtime-accepted. Phase 5.2 runtime acceptance was service-level, not
browser-level.

Phase 4 was verified as an end-to-end workflow:

``` text
Student submission
      ↓
Adviser review
      ↓
Feedback / decision
      ↓
Revision Required or Approved
      ↓
Student notification
      ↓
Resubmission
      ↓
Final approval
```

Phase 5.2 uses per-paper transaction-scoped advisory locking for
submission version eligibility/allocation, retains the unique
`(paper_id, version)` constraint, and cleans an uploaded object if the
submission insert fails. Adviser feedback, submission/research statuses,
and activity logging are transactional. Notifications are attempted
after commit and failure is non-blocking. Phase 5.2 required no schema or
migration changes; migration `0009_repository_paper_unique.sql` was not
applied.

Phase 5.3 is the next start-gated task. Do not start Phase 5.3 or CI
until explicitly directed.

## Critical Rules

-   Authorization is enforced server-side; UI visibility is never the
    security boundary.
-   Always verify user/group/resource ownership.
-   Preserve all research submission versions.
-   Students do not self-join research groups; advisers assign students.
-   One active group membership per student.
-   Panel Evaluation is excluded unless explicitly reopened.
-   Notifications are currently in-app only. Phase 4's notification
    failure deferral remains scoped to that closure audit; Phase 5.2
    post-commit notification failure was separately runtime-verified as
    non-blocking.
-   Research documents are stored in private Supabase Storage.
-   Store storage paths, not permanent public document URLs.
-   Signed document URLs are generated server-side.
-   Never commit secrets such as `JWT_SECRET` or `SUPABASE_SECRET_KEY`.
-   Do not apply a generated migration without checking its
    applicability to the target database.
-   Do not invent test evidence or mark a phase complete without
    verification.
-   Preserve unrelated existing working-tree changes when committing a
    scoped documentation update.

## Validation

Use the project's existing checks as appropriate:

``` bash
npm run lint
npx tsc --noEmit
npm run build
git diff --check
npx drizzle-kit check
```

Use Playwright for browser acceptance when the feature being verified is
browser-facing.

## Historical Chat Policy

The former large development chat is historical context only. The
documentation set plus the actual Git checkout should be sufficient for
normal agent handoff.

When historical context conflicts with the current checkout, the current
checkout and current project documentation take precedence unless the
owner explicitly asks to restore a reverted feature.

------------------------------------------------------------------------

**End of Documentation Guide**
