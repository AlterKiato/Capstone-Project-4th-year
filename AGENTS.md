<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->


# ThesiSHS AI — Complete Development Progress & Handoff Guide

> **Purpose:** Working source of truth for progress, implementation decisions, test evidence, and contributor handoffs.
>
> **Project:** ThesiSHS AI — Thesis Evaluation and Repository Project  
> **Last confirmed branch:** `feature/development`
> **Latest confirmed Phase 4 implementation commit:** `bc87caf` — `fix(review): close Phase 4 regression audit`
> **Git state (2026-10-01):** Phase 4 fixes and regression test were committed as `bc87caf` on `feature/development`. The source-of-truth progress documents are in Downloads (outside this repository); this handoff update records the completed commit.
> **Current checkpoint:** Sprint 3I.9 Phase 4 closure and regression audit passed on 2026-10-01. Phase 4 is complete; the Phase 5 repository document-access acceptance remains the next task. Existing Phase 6 acceptance evidence is retained below.
> **Next task:** Resume pending Phase 5 repository document-access acceptance. Do not treat this closure sprint as Phase 5 work.
>
> **Accuracy note:** Re-check `git status` and `git log -1 --oneline` before continuing. Items marked planned or needs verification are not confirmed complete.

---

## 1. How to Use This Document

This file is intended for the project owner and other contributors to resume work without losing context.

### Status key
- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete and verified
- `[?]` Needs verification
- `[!]` Blocked

### Maintenance rules
1. Code written is not enough to mark a task complete; record build/test evidence.
2. Record files changed, schema/migration impact, test results, commit hash, and remaining work.
3. Never invent a commit hash or claim a test passed unless confirmed.
4. If information is uncertain, label it `Needs verification`.
5. Before starting, check this file, the relevant source files, branch, commit, and working tree.
6. After each meaningful milestone, update the checkpoint and handoff log and commit the progress document.

### Feature tracking template
```md
### Feature: [name]
- Status: [ ] / [~] / [x] / [?] / [!]
- Scope:
- Files changed:
- Migration/schema:
- Validation and test evidence:
- Commit:
- Known limitations:
- Exact next action:
- Updated by/date:
```

---

## 2. Project Goal and Scope

ThesiSHS AI is a research/thesis workflow and repository system for Senior High School research groups. It supports research group management, student research creation and submissions, Adviser review and feedback, version history, repository access, and planned AI-assisted features.

### Roles
- **Admin:** system oversight, user management, group monitoring, and system/repository administration.
- **Adviser:** creates/manages own research groups, manually assigns/removes students, reviews submissions, and provides feedback/decisions for own groups.
- **Student:** views own group, creates research projects, submits documents, receives feedback, and resubmits when revision is required.
- **Panel:** role exists, but **Panel Evaluation is excluded from the active roadmap** unless the owner explicitly changes scope.

### Planned AI features
1. **AI Chatbot Guide** — guides users through system/research workflow and usage.
2. **AI Summarization** — summarizes research material for assistance.

AI is assistive and human-supervised. It must not make final academic/review decisions. Do not claim either feature is implemented until built and tested.

---

## 3. Current Checkpoint

### Confirmed
- Step 3H submission and version-integrity functionality implemented.
- Step 3I Adviser review, feedback, activity logging, and notification workflows implemented incrementally.
- Student decision notifications tested and committed.
- Adviser new-submission notifications tested and committed.
- Adviser notification page already existed and was tested; no code change was needed.
- Latest verified repository tip before document access work: `79d3347`.
- Working tree was clean before this document access fix; current changes are being committed at the owner's explicit request while browser acceptance remains pending.

### Step 3I-8 — end-to-end review/revision cycle

Owner-confirmed complete: all six end-to-end tests passed. Details below reflect the reported test summary; no new test execution is claimed here.

---

## 4. Architecture and Conventions

### Application architecture
```text
UI / Pages
    ↓
Server Actions
    ↓
Zod validation
    ↓
Services (business rules and authorization)
    ↓
Repositories (database access)
    ↓
Drizzle ORM
    ↓
PostgreSQL

Research documents → private Supabase Storage
```

### Stack (as last documented)
- Web: Next.js App Router, React, TypeScript
- Backend: Next.js Server Actions and server-side services
- Database: PostgreSQL
- ORM/migrations: Drizzle ORM / Drizzle Kit
- Validation: Zod
- Authentication: custom JWT/session using `jose`
- Password hashing: `bcrypt`
- Storage: **Supabase Storage**, private bucket
- Deployment target: Vercel (verify deployment status)
- Mobile: Expo React Native is in the broader plan; verify implementation status before assigning work.

### Non-negotiable rules
- Follow the layered architecture; keep business logic in services and DB access in repositories.
- Enforce authorization server-side; hiding UI is not access control.
- Verify ownership in services for Adviser-owned groups and user-owned notifications/documents.
- Validate untrusted input with Zod.
- Keep Supabase secret credentials server-only; never use `NEXT_PUBLIC_` for secrets or commit `.env` files.
- Bucket `research-submissions` is private. Use authorized server-side signed URLs.
- Preserve submission/version history; never overwrite old submissions with a new version.
- Do not add a `Resubmitted` status without owner approval.
- UI/UX polish is deferred to a dedicated phase.
- Do not implement Panel Evaluation unless the owner explicitly reopens it.
- Do not log credentials, tokens, or sensitive personal data.

---

## 5. Data Model Snapshot

Documented tables:
- `users`
- `research_groups`
- `group_members`
- `research_papers`
- `submissions`
- `feedback` / `feedbacks` (verify actual schema/table name)
- `repository`
- `notifications`
- `activity_logs`
- `role`

Important documented rules:
- A Student can belong to only one active research group at a time.
- Adviser group/member operations must verify group ownership.
- Research papers belong to a research group.
- Submissions are versioned per paper.
- A unique `(paper_id, version)` constraint was added in migration `0008_keen_frightful_four.sql` and reported applied.
- Feedback belongs to a specific submission/version.
- Notification mutation verifies notification ownership.
- Database stores Supabase storage path, not a public URL.

---

## 6. Step 3 — Research Submission and Adviser Review

### 3A–3G — Foundations
- [x] Authentication/session and role access foundation.
- [x] Research group and membership management foundation.
- [x] Adviser ownership checks for group operations.
- [x] Student research/project creation.
- [x] Research paper retrieval and service/repository structure.

**History note:** Individual sub-step labels and hashes for 3A–3G are not fully reconstructed here. Do not invent historical commit hashes.

### 3H — Student Submission System
- [x] Student research document submission.
- [x] Submission record stores paper, submitter, version, storage path, remarks, status, timestamp.
- [x] Supabase private bucket integration: `research-submissions`.
- [x] PDF validation and documented 10 MB limit.
- [x] Storage path: `research/{paperId}/{version}/{sanitizedFileName}`.
- [x] Authorized signed URL access for Students and Advisers.
- [x] Student submission list and document access.
- [x] Version numbering and next-version eligibility logic.
- [x] Unique paper/version constraint; migration reported applied.
- [x] Drizzle migration check reported passed.
- [x] Normal version progression browser-tested (historically reported through v8).
- [x] Commit: `c425f1a` — `feat(submission): enforce unique paper versions`.

### 3I — Adviser Review, Feedback, Activity Logs, Notifications

#### 3I-1 — Adviser submissions and ownership
- [x] Adviser submission list scoped to own groups.
- [x] Submission details and ownership-filtered retrieval.
- [x] Authorized document access via signed URL.
- [x] Cross-Adviser access tests reported passed.

#### 3I-2 — Start review
- [x] Adviser can start review for eligible `Submitted` submission.
- [x] Status changes to `Under Review`.
- [x] List/detail refresh tested.
- [x] Unauthorized Adviser review attempt rejected.

#### 3I-3 — Activity logging
- [x] Activity action constants for approval/revision decisions.
- [x] Logging wired into Adviser decisions.
- [x] Browser tests for both decision paths reported passed.

#### 3I-4 — Feedback and decisions
- [x] Feedback tied to a specific submission.
- [x] Feedback allowed only when status is `Under Review`.
- [x] `Revision Required` updates submission and research status.
- [x] `Approved` updates submission and research status.
- [x] Feedback/status tests reported passed.

#### 3I-5 — Student notifications
- [x] Notification title constants and domain helpers.
- [x] Failure-safe notification creation.
- [x] Student notification for approval.
- [x] Student notification for revision-required decision.
- [x] Student page supports view, mark read, delete.
- [x] Ownership/access tests passed.
- [x] Decision-to-notification end-to-end tests reported passed.
- [x] Commit: `cad078c` — `feat(notification): notify students of adviser decisions`.

#### 3I-6 — Notify Adviser of new submission
- [x] Student submission notifies assigned Adviser.
- [x] Notification includes version and research title.
- [x] Notification failure is logged without changing submission success.
- [x] Correct-Adviser and cross-Adviser tests passed.
- [x] Commit: `4499aea` — `feat(notification): notify adviser of new submissions`.

#### 3I-7 — Adviser notification page
- [x] Existing page at `app/dashboard/adviser/notifications/page.tsx` reviewed.
- [x] Adviser-only access using `ROLE_IDS.ADVISER`.
- [x] Displays own notifications, status, and received date.
- [x] Mark-as-read and delete actions connected.
- [x] Tests passed: access, content, mark read, delete, ownership isolation.
- [x] No new commit required; page was already implemented/tracked.
- [x] Working tree reported clean.

#### 3I-8 — End-to-end review/revision cycle
- [x] Student submits initial version and assigned Adviser notification is verified. (Owner-confirmed; all six tests passed.)
- [x] Adviser starts review and `Submitted → Under Review` transition is verified. (Owner-confirmed.)
- [x] Adviser submits `Revision Required`; submission/research statuses, Student notification, and feedback visibility are verified. (Owner-confirmed.)
- [x] Student submits next version; version increment and preservation of prior submission/feedback are verified. (Owner-confirmed.)
- [x] Adviser reviews the new version and approves; statuses and Student notification are verified. (Owner-confirmed.)
- [x] Cross-Adviser and document-access isolation verified. (Owner-confirmed.)
- **Evidence source:** Project owner reported all six tests passed in the development conversation; no test log or new commit hash was supplied in this update.

#### 3I-9 — Step 3 closure audit (proposed checklist; not a confirmed original label)
- [x] Invalid status transitions: passed (owner-confirmed).
- [x] Version and feedback history: passed (owner-confirmed).
- [~] Notification failure handling: deferred by owner; excluded from current closure checks unless explicitly resumed.
- [x] Role/ownership boundaries: covered by owner-confirmed 3I-8 cross-Adviser/document-access isolation tests.
- [x] `npm.cmd run build` passed on 2026-09-27 after removing literal merge markers from the in-progress Admin Repository page; Next.js 16.2.9 compiled, TypeScript completed, and all 22 static pages generated.
- [x] `npm.cmd run lint` passed on 2026-09-27 after the same cleanup.
- [x] Regression evidence reviewed: 3I-8 end-to-end workflow, invalid status transitions, version/feedback history, and ownership boundaries are owner-confirmed passed. No automated test/spec files or test script are present in the checkout.
- [x] Phase 4 closure checks complete for the agreed scope. Notification failure handling remains explicitly deferred and is not represented as verified.
- [x] Proceed to Phase 5 — Research Repository.

### Sprint 3I.9 — Phase 4 closure and regression audit
- [x] `3I.8 Complete Review Cycle` — VERIFIED.
- [x] `3I.9 Closure & Regression` — VERIFIED COMPLETE.
- [x] Phase 4 — Adviser Review & Feedback — COMPLETE.
- [ ] Phase 5 — Research Repository — NEXT (existing document-access acceptance remains pending).
- [x] Full review/revision/approval cycle, version history, feedback association, notifications, authorization, role isolation, invalid operations, and PDF access verified. Detailed 3I.8 evidence is preserved in the progress source.
- [x] Adviser detail now displays the submission status. Adviser PDF access now navigates the current tab to the authorized five-minute signed URL; opening a delayed popup was not reliable in Chromium.
- [x] Added `tests/phase4-adviser-submission-status.spec.ts`; Chromium verified v1 `Revision Required`, v2 `Approved`, and the v2 private PDF response (HTTP 200, `application/pdf`, expected v2 storage path).
- [x] `npm.cmd run build` passed (Next.js 16.2.9; 22 static pages); `npx.cmd tsc --noEmit`, `npx.cmd eslint .`, and `git diff --check` passed. A sandboxed build initially failed only when fetching Google Fonts; the network-enabled build passed.
- [x] Phase 4 implementation and regression test committed as `bc87caf` — `fix(review): close Phase 4 regression audit`.
- [x] Notification delivery failure handling remains deferred per the prior owner decision; notification correctness, title content, and ownership were verified.

---

## 7. Later Roadmap (Confirm Exact Phase Numbering)

### Phase 5 — Research Repository — [ ] NEXT
- [x] Inclusion rule confirmed for current implementation: Adviser-approved research and approved submission, followed by Admin publication.
- [x] Metadata/access rules implemented: title, abstract, category, keywords, group/strand/section/school-year metadata; only authenticated system roles can browse; PDF downloads use server-authorized signed URLs.
- [~] Repository association and Admin publish/unpublish flow implemented in code. Unique `(paper_id)` migration generated as `0009_repository_paper_unique.sql`; migration has **not** been applied to a database.
- [x] Repository listing and detail pages implemented; listing and metadata behavior preserved.
- [x] Server-side document lookup selects the latest approved submission for the requested paper and reuses its existing `research/{paperId}/{version}/...` storage path.
- [x] Short-lived signed URL generation remains server-side and uses the private `research-submissions` bucket; no duplicate document is uploaded.
- [~] Separate inline PDF viewing and attachment download implemented; path validation, approval checks, and user-facing access errors are in place. Build and lint pass; browser/runtime acceptance remains pending.
- [ ] Browser-test approved vs. unapproved visibility, PDF view, PDF download, signed object path, expired/missing document handling, and role/URL tampering boundaries.
- [ ] Verify existing Student/Adviser submission document access still works in the browser.
- [ ] Check for existing duplicate `paper_id` rows in the intended database before applying migration `0009_repository_paper_unique.sql`; migration is generated but not applied.
- [ ] Complete browser/runtime acceptance and update this handoff with executed results. The owner explicitly requested the implementation commit before these checks; do not mark Phase 5 acceptance complete until they pass.

### Phase 6 — Search, Filtering & Discovery
- [x] Approved requirements confirmed: search title/abstract/keywords; category, school year, and strand filters; newest, oldest, and title A–Z sorting; 10 results per page; no-results state with Clear filters.
- [x] Search and filters are validated and applied in SQL; published research with at least one approved submission remains required.
- [x] Deterministic sort modes and stable tie-breakers implemented; database count and pagination are applied before returning results.
- [x] Listing controls, filter choices, page navigation, active-query persistence, invalid-parameter fallback, and empty-state clearing implemented.
- [x] Drizzle runtime query corrected: `sortDate` has SQL alias `sort_date`; repository and paper ID selections have distinct `repository_id` and `paper_id` aliases.
- [x] Validation evidence: `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `git diff --check`, and network-enabled `npm.cmd run build` passed. Direct database queries for newest, oldest, and title sorting each executed successfully. Search parameter checks for repeated, oversized, and invalid values passed.
- [x] Manually tested and user-confirmed with an authenticated Student session and 11 eligible published papers: 10 results on page 1 and the remaining paper on page 2; searches in title, abstract, and keywords; category, school-year, and strand filters individually and combined; newest, oldest, and title A–Z sorting; search/filter state persistence while navigating pages.
- [x] Playwright browser acceptance with the authenticated Student test account: unmatched search and a valid zero-result filter combination each show the empty message, zero results, no papers, and no pagination; Clear filters after no results and after partial criteria resets controls and restores the default 11-paper listing with 10 items on page 1 of 2. The cleared URL has no query parameters (the browser may retain a bare trailing `?`).
- [x] Access-boundary browser acceptance: unauthenticated redirect, Student access, Adviser access, Admin access, and query-parameter tampering passed. Source review confirms all four roles (Admin, Adviser, Student, Panel) are permitted; Test E is not applicable because no restricted authenticated role exists.
- **Test dataset:** Synthetic records marked `PHASE6_ACCEPTANCE_20260929` in local `localhost:5432/thesishs_ai`; no production or Supabase data used. Keep the dataset until acceptance testing and cleanup are explicitly requested.

### AI-Assisted Features
**AI Chatbot Guide**
- [ ] Define allowed topics, role-aware behavior, and safe fallback.
- [ ] Document provider/model, privacy, cost/usage limits, and secrets handling.
- [ ] Keep it assistive; no review/approval decisions.
- [ ] Test accuracy, role-specific guidance, and fallback behavior.

**AI Summarization**
- [ ] Define supported document types, size limits, extraction, and output format.
- [ ] Define privacy, retention, provider, and cost controls.
- [ ] Label output as AI-generated; never treat it as an official review decision.
- [ ] Test long documents, extraction failures, and unsupported files.

### Other later work (verify against actual roadmap)
- [ ] Remaining Admin oversight/reporting and role modules.
- [ ] Notification navigation/unread count if required.
- [ ] Dedicated responsive/accessibility/UI polish phase.
- [ ] Deployment/environment/security/backups/operations checks.
- [ ] Documentation, user guide, final acceptance testing.
- [ ] Mobile app work (confirm scope/status).

**Panel Evaluation remains excluded.**

---

## 8. Efficient, Safe Development Workflow

### Before coding
1. Read this document and relevant source files.
2. Check repository state:
   ```bash
   git status
   git branch --show-current
   git log -5 --oneline
   ```
3. Define user story, roles, ownership boundary, acceptance criteria.
4. Inspect related schema, repository, service, action, page, validation, and constants.
5. Determine whether a migration is needed.
6. List exact files to change and tests to run.

### During coding
- Work on one small, coherent step at a time.
- Preserve unrelated code and existing conventions.
- Keep business rules in services and DB access in repositories.
- Add concise comments for purpose/non-obvious rules, not noisy line-by-line comments.
- Do not silently change statuses, role semantics, storage paths, or schema.
- Avoid new dependencies unless justified and documented.

### Validation
Run the relevant checks:
```bash
npm run build
```
For schema/migration work, as applicable:
```bash
npx drizzle-kit check
```
For migrations: inspect generated SQL, confirm no unintended destructive changes, apply only to the intended environment, and verify resulting schema.

Feature tests should cover as applicable:
- Happy path and invalid input
- Unauthorized role and cross-user/group ownership
- Status-transition restrictions
- External storage/notification failure behavior
- Revalidation/UI refresh
- Version/history preservation

Never claim a test passed unless it was actually run and reported.

### Commit protocol
```bash
git status
git diff --check
git diff
git add <specific-files>
git commit -m "<type>(<scope>): <short description>"
git log -1 --oneline
git status
```
Use specific paths; review diffs; exclude secrets, `.env`, generated junk, and unrelated changes. Record exact hash and working-tree state. Do not commit unless requested/approved.

---

## 9. Contributor Handoff Protocol

### Taking over
1. Read this file and latest handoff.
2. Verify branch, commit, and working-tree state.
3. Inspect actual files and relevant commits.
4. Check whether the feature already exists before creating duplicate files.
5. Ask for clarification when a business rule or acceptance criterion is missing.

### Handing back
Record:
- Feature/sub-step and status
- Summary of completed/incomplete work
- Files changed
- Schema/migration details and whether applied
- Build and test commands/results
- Browser test scenarios/results
- Commit hash and Git state
- Known bugs/limitations/risks
- Decisions needing owner approval
- Exact next action (file/function/test)

### Handoff template
```md
## Handoff — YYYY-MM-DD — [Feature / Sub-step]
- Contributor:
- Status: [x] / [~] / [?] / [!]
- Branch:
- Starting commit:
- Ending commit:
- Working tree:
- Summary:
- Files changed:
- Schema/migrations:
- Build:
- Tests performed and results:
- Known issues/risks:
- Owner decisions needed:
- Exact next action:
- Progress document updated: Yes/No
```

---

## 10. Security and Quality Gate

Before marking a feature complete:
- [ ] Authentication required for protected routes/actions.
- [ ] Role authorization enforced server-side.
- [ ] Ownership checked server-side.
- [ ] Input validated and normalized.
- [ ] Errors do not leak secrets or sensitive data.
- [ ] External service failures handled safely.
- [ ] Critical invariants enforced by database constraints where appropriate.
- [ ] Upload type/size/path rules enforced.
- [ ] Private documents not exposed through public URLs.
- [ ] Version and feedback history preserved.
- [ ] Notification ownership protected.
- [ ] Build and relevant regression tests pass.
- [ ] Progress and commit evidence recorded.

---

## 11. Decisions and Constraints
- Supabase Storage is the selected current storage direction; older Firebase references are stale unless the owner revisits the decision.
- Private bucket: `research-submissions`.
- The application uses its own JWT/session authentication; do not assume Supabase Auth.
- Supabase secret key remains server-only.
- Documents are accessed through server-authorized signed URLs.
- A Student can be in one active group at a time.
- Advisers access only their own groups/submissions.
- Feedback belongs to a specific submission/version.
- No separate `Resubmitted` status.
- Panel Evaluation excluded.
- UI/UX polish deferred.
- AI features assist users; they do not make final academic decisions.

---

## 12. Handoff Log

### Handoff — 2026-09-29 — Phase 6 Search, Filtering & Discovery
- **Status:** Implementation was committed as `82e63fd`; core authenticated listing acceptance is now user-confirmed. Remaining empty-state and access-boundary checks are pending.
- **Branch:** `feature/development`.
- **Latest confirmed commit before this worktree diff:** `26d56d2` — `feat(dashboard): add temporary role navigation`.
- **Working tree at implementation handoff:** Phase 6 implementation and progress files were modified before commit; this handoff predates commit `82e63fd`.
- **Files in the Phase 6 implementation diff:** `app/dashboard/repository/page.tsx`, `lib/repositories/repository.repository.ts`, `lib/services/repository.service.ts`, `lib/constants/repository.ts`, `lib/validations/repository.ts`, and `types/repository.ts`.
- **Scope:** Search title/abstract/keywords; category, school-year, and strand filters; newest/oldest/title sorting; SQL-level 10-item pagination and count; stable tie-breakers; active criteria retained across page links; invalid URL values default safely; empty state includes Clear filters.
- **Runtime issue and resolution:** The first authenticated browser report showed Drizzle rejecting `sortDate` because its raw SQL selection had no declared alias. The selected expression now has `.as("sort_date")`. A direct DB call then exposed ambiguous duplicate `id` names in the subquery SQL; the repository and paper IDs now have explicit `repository_id` and `paper_id` aliases. Published/approved predicates and authorization were not changed.
- **Schema/storage:** No schema or migration change. Supabase document access and storage behavior were not changed.
- **Validation:** `npm.cmd run lint`, `npx.cmd tsc --noEmit`, `git diff --check`, and network-enabled `npm.cmd run build` passed after the alias corrections. A direct DB query executed successfully for newest, oldest, and title sort modes; each returned one record. Search parameter validation checks for repeated values, oversized input, invalid sort, and invalid page passed.
- **Browser acceptance at implementation handoff:** Not completed at that time. The configured DB then had one eligible published paper, insufficient for pagination and varied filters/orderings; the acceptance update below records the later user-confirmed results after preparing a synthetic dataset.
- **Acceptance update (2026-09-30):** User confirmed the manual browser tests passed for 10-per-page pagination with the remaining paper on page 2; title/abstract/keyword search; category, school-year, and strand filters individually and combined; newest/oldest/title A–Z sorting; and search/filter persistence during page navigation. Dataset marker: `PHASE6_ACCEPTANCE_20260929`; 11 eligible entries.
- **Exact next action:** Verify no-results and Clear filters behavior, then test access boundaries. After Phase 6 acceptance is complete, continue the Phase 5 document-access browser matrix.

### Handoff — 2026-09-30 — Phase 6 Functional Acceptance
- **Status:** Core listing functionality is user-confirmed; empty-results/Clear filters A–D and access-boundary checks A, B, and F passed in Playwright-managed Chromium. Adviser/Admin checks remain not run.
- **Commit:** `82e63fd` — `feat(repository): add search and discovery`.
- **Test dataset:** 11 eligible synthetic published papers in the local development database, marked `PHASE6_ACCEPTANCE_20260929`. Dataset was not modified during documentation update.
- **Passed (user-confirmed):** Pagination; title, abstract, and keyword search; category, school-year, and strand filters; combined filters; newest-first, oldest-first, and title A–Z sorting; search/filter persistence during page navigation.
- **Passed (Playwright browser acceptance):** A unmatched search; B valid zero-result filter combination; C Clear filters after no results; D Clear partial criteria. Verified zero-result message/count, no result cards or pagination, reset controls, cleared query parameters, and restored default listing/pagination. The URL retained a bare trailing `?`, with no query parameters.
- **Access boundary results and remaining Adviser/Admin tests:** See the following access-boundary handoff.
- **Exact next action:** Complete Adviser/Admin browser checks if an approved local authentication mechanism becomes available, then resume Phase 5 repository document-access acceptance.
- **Implementation commit:** `82e63fd` — `feat(repository): add search and discovery`.
- **Documentation commit:** None; do not commit the progress updates unless requested by the owner.

### Handoff — 2026-09-30 — Phase 6 Empty Results and Clear Filters Acceptance
- **Status:** A–D passed in Playwright-managed Chromium using the authenticated Student test account.
- **Browser test:** `tests/phase6-empty-results.manual.spec.ts`; run with `npx.cmd playwright test tests/phase6-empty-results.manual.spec.ts --project=chromium --headed`.
- **Results:** A unmatched search and B valid zero-result category/school-year/strand combination showed the expected empty state, zero count, no paper cards, and no pagination. C clearing search after no results and D clearing partial search/category criteria reset controls and restored 11 papers, 10 on page 1 of 2.
- **URL behavior:** Clear filters returned to `/dashboard/repository?`; the URL contains no query parameters. Assertions verify path and empty query parameter set.
- **Data/schema:** The existing synthetic dataset was read only; no record, schema, or migration changes were made.
- **Implementation changes:** None. Only the temporary Playwright acceptance spec was adjusted to authenticate from process environment variables and accept the empty-query URL semantics.
- **Validation:** The targeted Chromium Playwright spec passed (1 test); `git diff --check` passed. No build was run because application code was unchanged.
- **Pending:** Phase 6 unauthenticated and role-based access-boundary checks; then Phase 5 repository document-access browser acceptance.
- **Commit:** None.

### Handoff — 2026-09-30 — Phase 6 Access Boundary Acceptance
- **Status:** A, B, C, D, and F passed; E is not applicable because all supported roles are explicitly authorized for repository access.
- **Source model:** Listing and detail pages require authentication and allow Admin, Adviser, Student, and Panel. Panel Evaluation remains excluded. Unauthenticated requests redirect to `/login`; authenticated roles outside an allowed list would redirect to `/dashboard`.
- **Eligibility:** SQL listing predicates require a published repository entry, approved research status, and at least one approved submission. URL filters cannot remove these predicates.
- **Browser results:** A unauthenticated direct navigation redirected to `/login` without rendering repository content. B Student direct access showed 11 eligible papers and a title search returned results. F unsupported publication/status parameters, invalid sort, invalid page, and an unsupported limit did not change the eligible first-page titles/count; sort/page safely defaulted to newest/page 1.
- **Role account availability:** A read-only query to the approved local `localhost:5432/thesishs_ai` database found active accounts for all roles (Admin 1, Adviser 2, Student 4, Panel 1). Student, Adviser, and Admin browser sign-ins succeeded using credentials passed at runtime; no credentials were written to files.
- **Database:** Read-only account-count query only. No record, schema, or migration changes; synthetic dataset untouched.
- **Validation:** The complete targeted spec passed in headed Chromium (5 tests); `git diff --check` passed. No application code changed; no build run.
- **Pending:** Phase 5 repository document-access acceptance. Other pre-existing Phase 6 checklist items remain as recorded.
- **Commit:** None.

### Handoff — 2026-09-28 — Repository document access fix
- **Status:** Implementation complete; browser/runtime acceptance pending. Owner explicitly requested a commit while these checks remain unrun.
- **Branch:** `feature/development`.
- **Starting commit:** `79d3347` — `docs(progress): record repository checkpoint`.
- **Ending implementation commit:** `deb0224` — `fix(repository): support PDF viewing and downloads`.
- **Working tree after implementation commit:** Clean before this progress-only hash update.
- **Root cause from code inspection:** Repository document access had one same-tab button for both viewing and downloading and created signed URLs without Supabase's `download` option. Service errors returned `null`; the client did not catch rejected Server Actions or reset loading state on failure. The repository path/query did use the existing approved submission path and private `research-submissions` bucket; no wrong-path evidence was found in code.
- **Changes:** Added inline-view and attachment-download modes, validates the stored path against the selected paper/version, returns clear service errors, opens viewing in a new tab, and displays the five-minute URL expiry behavior. Existing Student/Adviser submission calls retain the helper's default parameters.
- **Validation:** `npm.cmd run lint` passed. Sandboxed `npm.cmd run build` initially failed fetching configured Google Fonts; network-enabled `npm.cmd run build` then passed with TypeScript and all 22 static pages generated. `git diff --check` passed. No browser test or live Supabase URL test was run.
- **Storage/migration:** Existing `research-submissions` bucket and object path are reused. No upload, duplicate document, bucket, or migration changes.
- **Pending acceptance:** Confirm viewing, attachment download, exact signed object URL, approved-only access, unauthorized direct Server Action access, expired/missing file messages, and existing submission document access in browser/integration tests.
- **Exact next action:** Run the pending browser scenarios with test accounts and the configured Supabase environment; update the acceptance status only after actual results are confirmed.

### Handoff — 2026-09-27 — Phase 4 closure and Phase 5 start
- **Status:** Phase 4 closure checks complete for the agreed scope; Phase 5 repository implementation is in progress.
- **Branch:** `feature/development`.
- **Starting commit:** `7d79fa0` — `feat(AGENTS.md) updated AGENTS.md to utilize CODEX and soon, CLAUDE`.
- **Ending implementation commit:** `4a58815` — `feat(repository): add approved research repository`.
- **Starting working tree:** Already had uncommitted Phase 5 changes in `app/dashboard/admin/repository/page.tsx`, `db/schema/repository.ts`, `app/dashboard/repository/`, `lib/actions/repository.action.ts`, and `lib/repositories/repository.repository.ts`; `AGENTS.md` was stale.
- **Progress document:** Updated for owner-confirmed Sprint 3I.8 results and Sprint 3I.9 checkpoint; historical roadmap and hashes retained.
- **Phase 4 validation:** Owner-confirmed all six 3I.8 end-to-end tests passed; invalid status transitions and version/feedback history passed. `npm.cmd run build` and `npm.cmd run lint` both passed on 2026-09-27 after removing literal conflict markers from the Admin Repository page.
- **Deferred:** Notification failure handling remains deferred by owner. No automated test/spec files or test script are present. No browser checks were run in this session.
- **Phase 5 rule:** Current repository implementation uses approved research and approved submission as eligibility, with Admin publication controlling in-app visibility. Details, role access, and signed document retrieval are implemented and build-validated; manual acceptance scenarios remain pending.
- **Phase 5 progress:** Admin publish/unpublish interface and service/action/repository layers implemented; catalog/details and signed PDF download implemented; database uniqueness constraint added to Drizzle schema with generated migration `0009_repository_paper_unique.sql`.
- **Phase 5 validation:** `npm.cmd run build` passed (Next.js 16.2.9, TypeScript, 22 static pages); `npm.cmd run lint` passed; `npx.cmd drizzle-kit check` passed; `git diff --check` passed after progress header cleanup. Migration not applied.
- **Known changes in this session:** `AGENTS.md`; conflict marker cleanup and Admin repository UI; repository pages/actions/service/data layer; schema and migration generation. No migration was applied. The feature commit `4a58815` was followed by a clean working-tree check; this progress-only update records its hash.
- **Pending checks:** Browser visibility and role-boundary scenarios were not run; no browser automation tool or test accounts were available in this session. Existing automated test suite/spec files are absent. Confirm intended database environment and inspect existing duplicates before applying unique constraint migration.
- **Exact next action:** Run browser scenarios with project test accounts; inspect repository table for duplicate `paper_id` values in the intended database, then apply migration `0009` to that environment if safe; record results and complete Phase 5 acceptance checks.

### Handoff — 2026-09-25 — Step 3I-7 Adviser Notifications
- **Status:** `[x]` Complete and verified.
- **Branch (last confirmed):** `feature/development`.
- **Last confirmed commit:** `4499aea` — `feat(notification): notify adviser of new submissions`.
- **Working tree:** Reported clean.
- **Summary:** Adviser notification page at `app/dashboard/adviser/notifications/page.tsx` was already implemented, reviewed, and tested without code changes.
- **Tests:** Adviser access, correct notification content, mark as read, delete, cross-Adviser isolation — all reported passed.
- **Build:** No new build reported for this no-code-change checkpoint; prior feature build passed during 3I-6.
- **Next action:** Step 3I-8 — run full submission → Adviser review → revision → resubmission → approval workflow.
- **Caution:** Re-check Git state before continuing.

### Explicitly confirmed commits
| Commit | Description |
|---|---|
| `c425f1a` | `feat(submission): enforce unique paper versions` |
| `cad078c` | `feat(notification): notify students of adviser decisions` |
| `4499aea` | `feat(notification): notify adviser of new submissions` |

Only hashes explicitly confirmed in project history are listed here.

---

## 13. New Chat / Session Start Checklist
1. Read this file first.
2. Verify current `git status`, branch, and latest commit.
3. Phase 4 closure is recorded complete; notification failure handling remains deferred.
4. Phase 6 core authenticated search/filter/sort/pagination scenarios are user-confirmed passed on 11 eligible synthetic papers; no-results and Clear filters A–D passed in Playwright.
5. Phase 6 access-boundary checks are complete for applicable roles; continue Phase 5 repository document-access acceptance and preserve the synthetic dataset until cleanup is explicitly requested.
6. Then continue Phase 5 repository document-access acceptance from the 2026-09-28 handoff; do not treat build/lint as proof of document delivery.
7. Do not apply migration `0009_repository_paper_unique.sql` until the intended database is confirmed and duplicate paper associations are checked.
8. Do not commit uncommitted feature work until required acceptance tests pass and the project owner confirms.
9. After a milestone, update the checkpoint and handoff with executed test evidence and confirmed commit hash.

**Current next task: continue Phase 5 repository document-access acceptance.**
