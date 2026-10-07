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

**Current Git checkpoint (2026-10-08):** `feature/development`, HEAD
`482b112` ? `docs(phase5): close research repository phase`. Phase 5 is
complete and committed. Lean Phase 6 reuses existing search/filter/SQL
pagination with newest-first ordering; changes and focused acceptance
evidence remain unstaged/uncommitted. See the latest handoff in
`docs/MASTER_CONTEXT_UPDATED.md`; older Phase 6 start-gate notes below
are historical. CI and `.github/` remain untouched.
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
applied during Phase 5.2. It was subsequently applied only to the designated development/test database during Phase 5.4.

Submitted-document access requires an authenticated Student/Adviser session, positive submission ID validation, current active-account/database-role verification, Student group membership or Adviser group ownership, persisted submission/file metadata verification, and a storage path bound to the submission paper/version. Admin and Panel are denied under the submitted-document rules. Only the persisted path is passed to the existing server-only signer for 300 seconds in private bucket `research-submissions`; no client-supplied paper, path, version, identity, or role is trusted.

Phase 5.3 acceptance passed actual PDF retrieval (HTTP 200, `application/pdf`,
exact uploaded-byte match), Chromium access/denial checks, real 300-second
expiry (HTTP 400 afterward), anonymous public/unsigned denial (HTTP 400),
safe process-local storage failure, service-level review/version regression,
and independently verified fixture cleanup. No Phase 5.3 schema/migration
change was needed; `0009_repository_paper_unique.sql` was applied in Phase 5.4 to the designated development database after safety checks.
See `docs/MASTER_CONTEXT_UPDATED.md` for executed evidence.

Already issued signed URLs may remain usable until their 300-second expiry after authorization is revoked. Legacy/nonconforming paths outside the established naming convention are intentionally rejected; do not weaken validation. Full submission/review regression evidence is service-level; browser acceptance specifically covered document access. These are known limitations, not blockers.

Phase 5.4 — Repository Publication is complete and runtime-accepted (PASS; completion/documentation audit complete). Phase 5.5 — Repository Document Access is complete and runtime-accepted (PASS). Phase 5.6 — End-to-End Verification & Security Audit and Phase 5.7 — Documentation & Completion Audit are complete. **Phase 5 overall is complete.** Phase 6 — Search, Filtering & Discovery is next and requires explicit owner direction; it was not started in this pass. CI remains deferred. Do not commit or push.

Publication requires an authenticated, active database Admin and validated identifiers. The service verifies approved research, an approved submission, its persisted paper/version path, and private object existence. A per-paper transaction row lock plus `UNIQUE (paper_id)` serialize requests and prevent duplicate rows; repeated publication preserves the original timestamp. All 14 Phase 5.4 cases and Chromium authorization coverage passed, including Student/Adviser/Panel/anonymous denial and safe database failure. The Student upload -> Adviser review -> Revision Required -> v2 -> Approved -> Admin publication regression passed with history and Phase 5.3 protections preserved. Synthetic database/storage fixtures were removed and independently checked. Detailed accepted evidence is recorded in `docs/MASTER_CONTEXT_UPDATED.md`.

Known non-blocking publication risks: storage verification holds the database transaction during a network request; an object can be deleted after publication; repository records dynamically resolve an approved submission. Production migration state is unverified.

Phase 5.5 repository document access is complete and runtime-accepted: authenticated active Student, Adviser, Admin and Panel accounts are permitted through database-account checks, published/approved database eligibility, shared strict persisted paper/version path validation, and existing server-only 300-second signing. Chromium view/download, exact PDF retrieval, failure/denial checks, Phase 5.3/5.4 regression, and independent cleanup passed. No schema/migration changes. Actual signed-token lifetime was exactly 300 seconds (exp - iat); Phase 5.5 did not repeat the full expiry wait already verified in Phase 5.3. Repository eligibility is independent of group ownership and does not weaken the separate Phase 5.3 Student/Adviser ownership rules. Unpublished research is denied. Issued URLs remain bearer access until expiry, including after unpublication; legacy path validation remains strict. See the latest Phase 5.5 handoff in `docs/MASTER_CONTEXT_UPDATED.md`.

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

Phase 5.6 practical final verification and Phase 5.7 documentation closure passed: upload -> revision -> v2 -> approval -> Admin publication -> authenticated repository listing/detail/view/download, basic security, preserved history and independent synthetic cleanup. Phase 5.1 through 5.7 and Phase 5 overall are complete. No schema/migration changes in this final pass; existing 0009 remains development/test-only. Known limitations remain: issued URLs last until expiry; objects may be removed after publication; strict nonconforming paths are rejected; approved-document resolution is dynamic. This is capstone-level validation, not enterprise production hardening. Phase 6 is next; CI remains deferred.
