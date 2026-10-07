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
`5762e24` — `feat(phase5): complete Phase 5.2 submission integration`. Phase
5.1/5.2 are committed; accepted Phase 5.3 source/tests and reconciled
documentation remain uncommitted. `.github/` is unrelated and untracked.
Check `git status` before changing or staging files.

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
browser-level. Phase 5.3 Secure Document Access is complete and runtime-accepted
(`PHASE 5.3 PASS`); its completion/documentation audit is complete.

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

Submitted-document access requires an authenticated Student/Adviser session, positive submission ID validation, current active-account/database-role verification, Student group membership or Adviser group ownership, persisted submission/file metadata verification, and a storage path bound to the submission paper/version. Admin and Panel are denied under the submitted-document rules. Only the persisted path is passed to the existing server-only signer for 300 seconds in private bucket `research-submissions`; no client-supplied paper, path, version, identity, or role is trusted.

Phase 5.3 acceptance passed actual PDF retrieval (HTTP 200, `application/pdf`,
exact uploaded-byte match), Chromium access/denial checks, real 300-second
expiry (HTTP 400 afterward), anonymous public/unsigned denial (HTTP 400),
safe process-local storage failure, service-level review/version regression,
and independently verified fixture cleanup. No Phase 5.3 schema/migration
change was needed; `0009_repository_paper_unique.sql` remains unapplied.
See `docs/MASTER_CONTEXT_UPDATED.md` for executed evidence.

Already issued signed URLs may remain usable until their 300-second expiry after authorization is revoked. Legacy/nonconforming paths outside the established naming convention are intentionally rejected; do not weaken validation. Full submission/review regression evidence is service-level; browser acceptance specifically covered document access. These are known limitations, not blockers.

Phase 5.4 — Repository Publication is the next start-gated task. Do not start it, publication work, or CI until explicitly directed. CI remains deferred; do not commit/push or include unrelated untracked `.github/`.

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
-   Signed document URLs are generated server-side for 300 seconds / five minutes.
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
