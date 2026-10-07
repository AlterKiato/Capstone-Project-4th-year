# ThesiSHS AI — Master Context

**Last reconciled:** 2026-10-07
**Current branch:** `feature/development`
**HEAD checkpoint:** `5762e24` — `feat(phase5): complete Phase 5.2 submission integration`
**Working tree:** Phase 5.3 source/tests/handoff changes are uncommitted; existing untracked `.github/` is preserved. No commit/push authorized.

> This file is the **current-state handoff document**. Treat the working tree as current source evidence and keep its uncommitted state explicit.

---

## 1. Current Project State

The current checkout is at `5762e24`; Phase 5.1/5.2 are complete and committed. Phase 5.3 is complete and runtime-accepted with its implementation, tests, and documentation uncommitted. Completion/documentation audit is complete; Phase 5.4 — Repository Publication is the next start-gated task. Do not start it, publication work, or CI until explicitly directed. CI remains deferred; do not commit/push or include unrelated untracked `.github/`.

### Current phase status

| Phase | Feature | Status at current checkout |
|---|---|---|
| 0 | Project Foundation & Environment | ✅ Complete |
| 1 | Authentication & Access Control | ✅ Complete |
| 2 | Research/User Foundation | ✅ Complete |
| 3 | Submission & Version Management | ✅ Complete |
| 4 | Adviser Review & Feedback | ✅ Complete |
| 5.1 | Document Storage Foundation | ✅ Complete and runtime-accepted |
| 5.2 | Submission ↔ Document Integration | ✅ Complete and runtime-accepted (service-level, not browser-level) |
| 5.3 | Secure Document Access | Complete and runtime-accepted; completion/documentation audit complete |
| 5.4 | Repository Publication | Next start-gated task; not started in this scope |
| CI | Continuous integration | ⏸️ Explicitly deferred |

**Panel Evaluation:** excluded/deferred unless explicitly reopened.
**AI-assisted evaluation/chat/summarization:** planned, not current implementation.

---

## 2. Git / Rollback Boundary

The authoritative current checkpoint is:

```text
branch: feature/development
HEAD:   5762e24
message: feat(phase5): complete Phase 5.2 submission integration
```

Phase 5.1/5.2 implementation is committed in HEAD. Phase 5.3 source/tests and reconciled documentation are uncommitted; `.github/` is unrelated and untracked. The audit reviewed tracked diffs and new intended source/test files; all other working-tree changes belong to accepted Phase 5.3 work.

Before changing code, verify the actual checkout:

```bash
git status
git branch --show-current
git log -1 --oneline
git log --oneline --decorate -10
```

Do not restore historical work blindly. Inspect the current source first and re-implement only what is actually required.

---

## 3. Phase 4 — Adviser Review & Feedback

Phase 4 Adviser Review & Feedback remains complete. Phase 5.3 is the latest completed implementation milestone.

### Verified workflow

```text
Student submits
      ↓
Adviser notified
      ↓
Adviser starts review
      ↓
Under Review
      ↓
Revision Required ──→ Student resubmits a new version
      │
      └──────────────→ Approved
```

Established Phase 4 behavior:
- Adviser access is scoped to their own research groups.
- Advisers can start review.
- Advisers can provide feedback and select `Revision Required` or `Approved`.
- Submission/research status updates are coordinated.
- Submission versions are preserved.
- Student/adviser in-app notifications are triggered.
- Adviser decisions are activity-logged.
- Cross-adviser isolation was verified.
- The end-to-end review/resubmission/approval workflow was verified.

Relevant commits:
- `c425f1a` — `feat(submission): enforce unique paper versions`
- `cad078c` — `feat(notification): notify students of adviser decisions`
- `4499aea` — `feat(notification): notify adviser of new submissions`
- `bc87caf` — `fix(review): close Phase 4 regression audit`

Notification delivery failure handling was deferred within the Phase 4 closure audit scope. Phase 5.2 separately verified post-commit notification failure as non-blocking.

---

## 4. Phase 5 Status

Phase 5.1 Document Storage Foundation and Phase 5.2 Submission ↔ Document Integration are complete and runtime-accepted.

The stable design in `docs/SOURCE_OF_TRUTH_UPDATED.md` calls for:
- private Supabase Storage
- bucket `research-submissions`
- PDF-only documents
- maximum file size of 10 MB
- storage path pattern `research/{paperId}/{version}/{sanitizedFileName}`
- server-side authorization before document access
- server-generated signed URLs
- 300-second / five-minute signed URL expiry
- database storage of the storage path rather than a public URL

### Phase 5.2 implementation and acceptance

- Submission version calculation and eligibility checks are serialized per paper using a transaction-scoped PostgreSQL advisory lock; the unique `(paper_id, version)` constraint remains the database backstop.
- If a concurrent request loses, it observes the committed state and is rejected without leaving an uploaded object.
- Adviser feedback, conditional submission status, research status, and activity log writes use one database transaction. Competing decisions cannot both commit.
- Student/Adviser notifications are attempted after the primary operation commits. Runtime fault injection confirmed notification failure does not make submission/review appear failed or roll back primary records.
- Runtime acceptance was service-level, not browser-level. Synthetic fixtures were cleaned up. Phase 5.2 required no schema or migration changes.
- Migration `0009_repository_paper_unique.sql` was not applied.

### Phase 5.3 — Secure Document Access — Complete

Submitted-document access requires an authenticated Student/Adviser session, positive submission ID validation, current active-account/database-role verification, Student group membership or Adviser group ownership, persisted submission/file metadata verification, and a storage path bound to the submission paper/version. Admin and Panel are denied under the submitted-document rules. Only the persisted path is passed to the existing server-only signer for 300 seconds in private bucket `research-submissions`; no client-supplied paper, path, version, identity, or role is trusted.

```text
Authenticated request
→ submission ID validation
→ active-account/database-role verification
→ Student membership or Adviser ownership authorization
→ persisted submission/file metadata verification
→ storage path bound to submission paper/version
→ server-side 300-second signed URL
```

All accepted live scenarios and independently verified fixture cleanup passed; see the live acceptance handoff below. No Phase 5.3 schema/migration changes were required or applied.

Already issued signed URLs may remain usable until their 300-second expiry after authorization is revoked. Legacy/nonconforming paths outside the established naming convention are intentionally rejected; do not weaken validation. Full submission/review regression evidence is service-level; browser acceptance specifically covered document access. These are known limitations, not blockers.

### Phase 5.4 — Repository Publication — Next start-gated task

Phase 5.4 — Repository Publication is the next start-gated task. Do not start it, publication work, or CI until explicitly directed. CI remains deferred; do not commit/push or include unrelated untracked `.github/`. Existing historical repository/publication code is not Phase 5.4 completion evidence and was not changed or newly accepted during this audit.

---

## 5. Phase 6 and Phase 7 Context

The project handoff recorded prior Phase 6 and Phase 7 work separately from the current Phase 5 completion. Verify their source and acceptance status from the actual checkout before treating those milestones as current:

### Phase 6 — Search, Filtering & Discovery
Historical work included repository search/filter/sort/pagination, empty-state handling, access-boundary testing, and synthetic acceptance data.

### Phase 7 — Administration & Reporting
Historical work included dashboard/reporting metrics and an Admin reports page.

Do not infer their implementation or acceptance state from this Phase 5.2 handoff.

---

## 6. Stable Project Rules

These rules remain applicable:

- Layered architecture: Pages/UI → Server Actions → Zod validation → Services → Repositories → Drizzle ORM → PostgreSQL.
- Business logic and authorization belong in services.
- Repositories remain focused on data access.
- Authorization must be enforced server-side.
- Verify ownership/group access before protected operations.
- Students do not self-join research groups; advisers assign/remove students.
- A student has one active group membership.
- Preserve submission versions rather than overwriting them.
- Submission versions use unique `(paper_id, version)`.
- Notifications are currently in-app only.
- Notification failure must not block the primary operation.
- Panel Evaluation is excluded/deferred.
- AI assistance must not replace final human academic/review decisions.
- Supabase secret credentials remain server-only.
- Store storage paths rather than public document URLs.
- Generate signed document URLs server-side.
- Keep test and production environments/data separate.
- Never commit secrets.

---

## 7. Database / Migration Safety

`docs/DATABASE (1).md` is the database reference, while the actual `db/schema/`, `db/migrations/`, and target database are authoritative.

The documentation historically referred to 11 core tables while explicitly naming 10. **Do not invent an eleventh table.** Verify the actual schema before resolving that discrepancy.

Migration `0009_repository_paper_unique.sql` was not applied. Inspect the actual migration directory and intended database before any future application; migration state can differ between environments.

Before applying schema changes:

```bash
npx drizzle-kit check
```

Then review the generated SQL and target data before migration.

---

## 8. Documentation Roles

The project documentation is intentionally separated:

- `docs/SOURCE_OF_TRUTH_UPDATED.md` — stable product rules, architecture, constraints, and long-term design.
- `docs/MASTER_CONTEXT_UPDATED.md` — current implementation state, working-tree boundary, blockers, and next action.
- `README.md` — documentation navigation and AI-agent handoff entry point.
- `docs/ARCHITECTURE_UPDATED.md` — technical architecture and data flow.
- `docs/DATABASE (1).md` — database structure and migration safety.

A future agent should not need the historical chat to understand the current project state.

---

## 9. Agent Handoff Protocol

Before implementation:

1. Read `docs/SOURCE_OF_TRUTH_UPDATED.md`.
2. Read `docs/MASTER_CONTEXT_UPDATED.md`.
3. Read `README.md`.
4. Read `docs/ARCHITECTURE_UPDATED.md`.
5. Read `docs/DATABASE (1).md` for database work.
6. Inspect the actual repository and working tree; `5762e24` is HEAD, Phase 5.1/5.2 are committed, and accepted Phase 5.3 work is uncommitted.
7. Check working-tree changes before modifying files.
8. Do not discard unrelated working-tree changes.
9. Do not commit without project-owner approval.

Every handoff should record:
- phase/feature
- implementation status
- files changed
- database/migration changes
- test evidence
- blockers/risks
- exact next action
- commit hash, if applicable

---

## 10. Immediate Next Action

Phase 5.4 — Repository Publication is the next start-gated task. Do not start it, publication work, or CI until explicitly directed. CI remains deferred; do not commit/push or include unrelated untracked `.github/`.

Review the recommended Phase 5.3 commit grouping in the completion audit handoff below; no staging or commit is authorized in this task.


## Handoff — 2026-10-07 — Phase 5.3 Secure Document Access

Historical implementation snapshot: pending statuses and next actions below were superseded by live acceptance and the completion audit.

- Status: Implementation complete; live/browser acceptance pending at the owner's request. Not ready to mark Phase 5.3 complete.
- Branch / starting and ending HEAD: `feature/development`, `5762e24` — `feat(phase5): complete Phase 5.2 submission integration`. No commit or push made.
- Scope: Submitted PDFs only. Existing repository publication/document access, `.github/`, CI, Phase 5.4, and unrelated UI work were not modified.
- Inspection: Historical Student/Adviser document access lived in `lib/actions/storage.action.ts` with repository calls and only a nonempty-path check. Existing five-minute private-bucket signer is `createResearchDocumentSignedUrl` in `lib/services/storage.service.ts`. Published repository access is a separate existing flow and remains outside this change.
- Implementation: The action authenticates/role-gates, validates a positive PostgreSQL submission ID with Zod without coercion, and calls a server-only document service. The service rechecks the current active account and database role, resolves submission → paper → group, checks Student membership or Adviser ownership, and validates that the persisted PDF path exactly matches the stored paper and version before signing for 300 seconds. Missing metadata and DB/storage errors return null. Signing errors no longer log raw SDK errors. Student PDF navigation uses the current tab, matching the existing Adviser button.
- Authorization: Students may access submissions in groups where they are currently members, including another member's submission. Advisers may access their owned groups only. Inactive/deleted accounts, other groups/Advisers, Admin, and Panel are denied by the submitted-document flow. Admin denial preserves the existing action's rules; Admin published-repository access is unchanged. No client paper ID, path, version, identity, or role is used for signing.
- Files changed: `lib/actions/storage.action.ts`, `lib/services/submission-document.service.ts`, `lib/validations/submission-document.ts`, `lib/services/storage.service.ts`, `app/dashboard/student/submissions/DownloadSubmissionButton.tsx`, `tests/phase5-document-access.unit.cjs`, `tests/phase5-document-access.acceptance.cjs`, `AGENTS.md`, and `docs/MASTER_CONTEXT_UPDATED.md`.
- Schema/migrations: None required, generated, or applied. Existing `0009_repository_paper_unique.sql` remains unapplied. `npx.cmd drizzle-kit check` passed and does not apply migrations.
- Static validation: `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `npx.cmd drizzle-kit check`, and `git diff --check` passed. The initial sandboxed `npm.cmd run build` failed fetching existing Google Fonts; a network-enabled build passed (Next.js 16.2.9, TypeScript, all 22 static pages). No CI was started.
- Isolated tests: `node --import tsx tests/phase5-document-access.unit.cjs` passed. Actual action/service modules were exercised with mocked session/repositories/storage: authentication redirects, role denial, input validation, Student/Adviser boundaries, disabled/deleted accounts, missing submission/paper/group/file metadata, path/identifier tampering, database/signing failure safety, and the exact 300-second signer argument.
- Environment: Owner confirmed the configured Supabase project as the designated development/test environment. Inspection matched `localhost:5432/thesishs_ai` and Supabase host `cbkplqkkjuoglpimwmib.supabase.co`. No environment configuration changed; only synthetic fixtures were created.
- Live results actually reached: Private bucket configuration was verified (`public: false`); synthetic uploads using `submitResearch` succeeded; permitted Student, group peer, and Adviser signed-URL generation succeeded; cross-group Student/Adviser and Admin/Panel denial passed; invalid identifiers, absent/disabled accounts, revoked roles, malformed/cross-paper/cross-version paths, and missing-object failure safety passed. All synthetic DB and storage fixtures from that run were cleaned up and cleanup was verified.
- Live harness limitation: The first network-enabled run stopped at a test-harness fault-injection assertion because it attempted to replace a read-only module export. The harness was corrected to inject a fetch failure instead. Two attempts to execute the corrected network rerun were rejected by automatic approval review because its selected review model was at capacity, not because the action was judged unsafe. The owner then explicitly requested leaving live acceptance pending. The corrected complete harness has not been run; its browser, expiry, and regression sections are unverified.
- Remaining required acceptance: Actual PDF HTTP 200/content, Chromium Student/Adviser buttons and direct Server Action tampering/anonymous/Admin requests, token expiry claim and real denial after approximately 300 seconds, public/unsigned anonymous object denial, fault-injected storage outage against the live flow, and full submission → review → revision → approval/history/notification regression. Bucket private configuration alone does not establish anonymous object denial.
- Manual live rerun: Start the local app on `http://localhost:3000`, then set the process-only `PHASE5_ACCEPTANCE_CONFIRMED=1` and run `node --import tsx tests/phase5-document-access.acceptance.cjs`. The runner checks the designated environment, creates synthetic fixtures, uses Playwright Chromium with real synthetic-account login and direct Server Action requests, waits for expiry, and cleans up in finally. Review any failure and cleanup output; do not infer success from the script's presence.
- Remaining risks: Signed URLs are bearer capabilities valid until expiry; revoking membership/account access prevents new URLs but does not invalidate an already issued URL immediately. Strict path validation intentionally rejects malformed/legacy metadata that does not follow the established safe versioned PDF naming convention. Browser behavior and the corrected live harness require acceptance.
- Exact next action: When explicitly resumed, rerun live acceptance, review all twelve requested cases, and perform the Phase 5.3 completion audit. Do not start Phase 5.4, publication, CI, or commit/push without owner direction.

## Handoff — 2026-10-07 — Phase 5.3 Live Acceptance PASS

This entry supersedes the pending live-acceptance status in the preceding Phase 5.3 implementation handoff.

- Final recommendation: **PHASE 5.3 PASS**. All six remaining live acceptance cases passed; no application defect or implementation change was required.
- Branch / starting and ending HEAD: `feature/development`, `5762e24` — `feat(phase5): complete Phase 5.2 submission integration`. Implementation remains uncommitted; no commit/push performed.
- Environment: The existing confirmed designated development environment was rechecked by the runner: database host `localhost`, database `thesishs_ai`, Supabase host `cbkplqkkjuoglpimwmib.supabase.co`, private bucket `research-submissions`. Only synthetic records/PDFs were used. No environment file, schema, migration, publication, CI, `.github/`, or Phase 5.4 work occurred.
- Run command: process-only `PHASE5_ACCEPTANCE_CONFIRMED=1`, then `node --import tsx tests/phase5-document-access.acceptance.cjs`, with the real local application on `http://localhost:3000`. Network-enabled execution was available in this pass; the final full run exited 0.

| Remaining acceptance case | Result | Executed evidence |
|---|---|---|
| Actual PDF retrieval | PASS | Authorized Student signed URL fetched with HTTP 200 and `application/pdf`; response bytes exactly matched the uploaded synthetic PDF. |
| Chromium / real application path | PASS | Real synthetic-user login; Student and Adviser View / Download buttons caused authenticated `getSubmissionDownloadUrlAction` POSTs and successful signed PDF HTTP 200 responses. Captured Student action request contained only the submission ID. Direct action requests with a foreign-group submission, negative/string/nonexistent IDs, and an object attempting paper/path/role manipulation returned null. Adviser cross-group request returned null; Admin, Panel, and anonymous requests were redirected/denied. |
| Signed URL expiry | PASS | Final full run observed 300 seconds remaining in the actual signed URL's token expiry claim. The original URL was retained and fetched five seconds after that expiry: HTTP 400. Default/server policy was never shortened. Both configuration and real runtime expiry were verified. |
| Anonymous / direct object access | PASS | Actual existing synthetic object requested through public and unsigned object endpoints without credentials or a signed token: each returned HTTP 400. Bucket metadata also confirmed `public: false`. |
| Storage failure behavior | PASS | The runner temporarily replaced only its own process's fetch with a throwing function, exercised the actual document service/storage signer against live DB authorization, and restored fetch in finally. Service returned null; logs were limited to generic signing/access messages, without credentials, internal object paths, signed tokens, or SDK errors. Missing-object behavior also returned null safely. No infrastructure or environment configuration changed. |
| Phase 5.1/5.2 submission/review regression | PASS | Synthetic Student uploads for two groups; Adviser start-review and Revision Required for v1; Student v2 upload; Adviser review and approval of v2; resubmission after approval rejected. Both versions remained accessible to permitted users, two version-linked feedback records persisted, research became Approved, five notifications and two activity logs were present. |

- Security reconfirmation: Live service checks passed for Student group membership (including a group peer), Adviser ownership, foreign-group/foreign-Adviser denial, Admin/Panel denial, absent/inactive accounts, database role changes, invalid submission IDs, blank and cross-paper/cross-version paths, traversal/encoded/nested/public-URL metadata, invalid version, and missing storage object. The current service uses only DB-resolved metadata and the authenticated session user ID. Isolated action/service tests were rerun and passed for authentication, roles, validation, missing metadata, DB/signing failures, and exact 300-second signer arguments.
- Harness correction: The initial Chromium attempt timed out because synthetic emails had been inserted with uppercase characters while the existing login flow normalizes email to lowercase. The failed-run fixtures were cleaned up. The intended acceptance runner now creates lowercase emails. No authorization/path validation was weakened and no application code changed. PDF-byte checks, explicit anonymous denial status checks, expiry output, and browser Panel denial coverage were also strengthened in the intended test file.
- Cleanup: Final harness cleanup removed all synthetic PDF objects and DB fixtures and exited 0. Independent read-only audit verified zero fixture rows in users, research_groups, research_papers, submissions, group_members, feedbacks, activity_logs, and notifications, and empty synthetic storage prefixes. No temporary harness files were created; intended acceptance/unit test files were preserved. The local app started for testing was stopped.
- Final static checks: `npm.cmd run lint` PASS; `npx.cmd tsc --noEmit` PASS; network-enabled `npm.cmd run build` PASS (Next.js 16.2.9, TypeScript, all 22 static pages); `git diff --check` PASS; `npx.cmd drizzle-kit check` PASS. No migration generated/applied; `0009_repository_paper_unique.sql` remains unapplied.
- Files changed during this acceptance pass: `tests/phase5-document-access.acceptance.cjs`, `AGENTS.md`, and `docs/MASTER_CONTEXT_UPDATED.md`. Existing Phase 5.3 application changes and the intended unit test were preserved.
- Git / CI boundary: HEAD remained `5762e24`. `.github/` remained untracked; SHA-256 of its existing `workflows/ci.yml` matched before/after (`4896632FD0AC14DEBFC0E1B97FDE3F6CA87270367FCDF5BFF108C5651886A2B3`). No CI started.
- Remaining risks / compatibility: Signed URLs are bearer capabilities valid until expiry; revocation blocks new URLs but does not invalidate a previously issued URL immediately. Nonconforming legacy paths will fail safely; no legacy data was changed, no comprehensive legacy-data audit was performed, and strict validation was preserved. The synthetic regression exercised the service-level review cycle; browser acceptance covered document access, not the full review UI. No remaining blocked acceptance cases.
- Exact next action: Phase 5.3 is ready for completion audit. Await owner direction; do not commit/push or start Phase 5.4, publication, or CI.

## Handoff — 2026-10-07 — Phase 5.3 Completion / Documentation Audit

- Final result: **PHASE 5.3 COMPLETE**. Phase 5.1/5.2 remain complete; Phase 5.3 is complete and runtime-accepted. This audit closes the documentation/completion gate without committing the implementation.
- Branch / starting and ending HEAD: `feature/development`, `5762e24` — `feat(phase5): complete Phase 5.2 submission integration`. No commit/push or staging performed.
- Evidence reviewed, not rerun as live tests in this audit: Actual PDF retrieval PASS (HTTP 200, `application/pdf`, exact uploaded-byte match); Chromium Student/Adviser access PASS with tampered/cross-group/anonymous/Admin/Panel denial; actual token lifetime 300 seconds and original URL HTTP 400 after expiry; public/unsigned anonymous object requests HTTP 400; safe process-local signing failure returned null with generic errors and no sensitive storage details; service-level upload/revision/v2/approval/approved-resubmission denial and version history PASS; synthetic DB/storage cleanup independently verified PASS. Detailed executed evidence remains in the preceding live acceptance handoff.
- Implementation audit: Authenticated request → submission ID validation → active-account/database-role verification → Student membership or Adviser ownership → persisted submission/file metadata verification → path bound to stored paper/version → existing server-only 300-second signer. Admin/Panel submitted-document denial and strict safe-path validation preserved. No correctness defect found; application and intended test files unchanged during this documentation audit.
- Documentation reconciled: `AGENTS.md`, `README.md`, `docs/MASTER_CONTEXT_UPDATED.md`, `docs/SOURCE_OF_TRUTH_UPDATED.md`, `docs/ARCHITECTURE_UPDATED.md`, and `docs/DATABASE (1).md`. All six contained stale checkpoint, phase, next-task, or access-boundary details. Corrected actual documentation paths, current status, architecture, migration boundary, and Phase 5.4 numbering; preserved earlier acceptance handoffs as historical evidence.
- Validation executed in this audit: `npm.cmd run lint` PASS; `npx.cmd tsc --noEmit` PASS; `npx.cmd drizzle-kit check` PASS; `git diff --check` PASS. Sandboxed `npm.cmd run build` failed only fetching existing Google Fonts; network-enabled retry PASS (Next.js 16.2.9, TypeScript, all 22 static pages).
- Schema/migrations: No changes required, generated, or applied for Phase 5.3 or this audit. Existing `0009_repository_paper_unique.sql` remains unapplied; Drizzle check is validation, not migration application.
- Working-tree scope: Seven accepted Phase 5.3 application/test files plus the six reconciled documentation files. Phase 5.1/5.2 implementation is already in HEAD. Existing untracked `.github/` is unrelated, untouched, and excluded; its existing workflow checksum is unchanged. Nothing is staged.
- Known limitations, not blockers: Already issued URLs can remain usable until their 300-second expiry after revocation; nonconforming/legacy paths are intentionally rejected without weakening validation; full submission/review regression is service-level and browser acceptance covered document access specifically.
- Recommended future commit grouping, only when authorized: (1) `feat(storage): secure submitted PDF access` containing `app/dashboard/student/submissions/DownloadSubmissionButton.tsx`, `lib/actions/storage.action.ts`, `lib/services/submission-document.service.ts`, `lib/services/storage.service.ts`, `lib/validations/submission-document.ts`, `tests/phase5-document-access.unit.cjs`, and `tests/phase5-document-access.acceptance.cjs`; (2) `docs(phase5): close Phase 5.3 acceptance` containing only the six documentation files above. Exclude `.github/`, environment files, and migrations from both groups. No hashes exist for these proposed commits.
- Exact next action: Await owner direction. Phase 5.4 — Repository Publication is the next start-gated task; it was not started. CI remains deferred and was not started. Do not commit/push yet.
