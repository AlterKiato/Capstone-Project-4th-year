<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Current Phase 10 direction (2026-10-27)

Latest Phase 10.2E.3 handoff: protected Vercel Preview is online for `feature/development`; `main` remains reserved for Production, which is not deployed. The owner reports synthetic Admin login, dashboard, refresh persistence, logout, unauthenticated application access protection and navigation PASS after correcting the Preview runtime connection value and moving functions to Singapore (`sin1`). These are owner-reported browser checks and limited performance samples, not independently rerun automation or production acceptance. See the [current acceptance handoff](docs/MASTER_CONTEXT_UPDATED.md#phase-102e3---hosted-preview-admin-acceptance-2026-10-27). Preserve prior research-policy changes and ignored evidence. This checkpoint is documentation only: do not stage, commit or push until the owner approves the exact proposed file set. Next propose minimal synthetic Student/Adviser acceptance; no account setup, database/Storage operation, browser testing or deployment is authorized automatically. PDF/private-Storage checks, broader reliability, operational AI/consent and production gates remain open; Groq stays hard-disabled.

Historical R4E handoff (2026-10-24), superseded for current deployment/Admin status by 10.2E.3 above: hosted migrations 15/15, dedicated runtime grants, four canonical roles and one synthetic Preview Admin are verified PASS from preserved owner-operated evidence; bcrypt password comparison PASS, actual browser login pending. Git checkpoint preparation only: keep all 13 pending paths unstaged and preserve ignored evidence. Preview environment secrets, Node 24 dashboard selection and Vercel Authentication/Standard Protection require owner configuration/verification; protected Preview deployment remains separately authorized. Fresh local production build remains unverified after restricted Google Fonts failure and a bounded network-enabled timeout. Operator database CREATE revocation is a separate narrow owner decision, not authorized here. Do not replay completed database operations. See latest Master Context for exact findings, candidate files and remaining deployment gates.

Historical owner-approved R4A checkpoint: local Development PostgreSQL stays separate; existing test Supabase project `cbkplqkkjuoglpimwmib` is the proposed hosted Preview database and intentionally shared Development/Preview test Storage boundary. Production needs separate clean resources. Hosted runtime/operator configuration now requires validated server-only `THESISHS_DATABASE_CA_PEM`; verified TLS/hostname checks remain mandatory. Data API disablement persisted after reload and Storage bucket metadata was unchanged. REST/RPC probes returned 401/503 (`PGRST002`), so definitive endpoint-denial verification remains unresolved. `rls_auto_enable()`/`ensure_rls`, dedicated roles/grants and authenticated driver identity remain blockers. R4A does not authorize helper/trigger changes, roles, migrations, Vercel configuration or deployment; stop for owner review. See the latest Master Context for exact evidence.

Read the [approved Master Context roadmap](docs/MASTER_CONTEXT_UPDATED.md#approved-phase-10-roadmap-2026-10-22) and current Source of Truth before work. Historical Phase 10.2C closure entered on `feature/development`, parent HEAD `556dde189d5881fc32258ef8c68ad4842b7d93c3`, empty index and 43 unstaged implementation/documentation/tooling paths. The owner authorized one reviewed closure commit and normal push; resolve its resulting SHA with `git log -1 --oneline` and recheck actual Git state.

The owner-approved sequence is minimal test-environment preparation → isolated Vercel Preview preparation → separately approved Preview deployment → owner-led manual acceptance → focused corrections → production readiness → separately approved production release. Local migration 0014 is APPLIED and verified (15-entry ledger); the distinct operator and private backup/disposable recovery verification passed. The approved development/test `research-submissions` bucket is private, PDF-only and limited to 10,485,760 bytes. Storage policy catalog audit and live signed-upload/document-access denial are NOT VERIFIED. Before Preview testing, independently verify anonymous private-document denial and signed-upload isolation from unrelated paths; complete the policy audit before production approval. Do not repeat preparation or start fixtures, browser suites or deployment automatically. Database/Storage/security operations retain separate execution approval gates.

Prefer owner-led visible-workflow checks and focused security/regression tests, with appropriate static/build/migration checks. Necessary browser automation must be sequential, bounded and resource-limited; stop after significant infrastructure failure. Defer extensive matrices, repeated full-system runs, large fixtures and demo-stage load testing; preserve useful existing tests/tools. Production may require broader reliability/load evidence. Mandatory Student verification and real email are deferred for initial deployment; Groq stays hard-disabled. PWA remains primary; Expo/Electron are deferred, separately authorized work.

This direction and the latest Master Context supersede older next-phase statements below. Historical evidence and UI decisions remain valid within their recorded scope. At that historical closure, Preview and production were not deployed. Current Preview status is superseded above; production remains undeployed. That closure authorized minimal factual documentation corrections, focused offline validation and the reviewed 43-file commit/push only; no application, environment, database, Storage or deployment changes. Stop for owner review after closure; Phase 10.2D does not start automatically.

## UI/UX Design Instructions

For tasks involving UI design, visual components, layouts, responsive behavior or accessibility:

1. Read `DESIGN.md` for the current product design direction.
2. Read `ANTISLOP.md` for the design-quality filter (core-only integration).
3. Apply Anti-Slop in **During mode** for future owner-authorized UI/UX implementation checkpoints, as explicitly approved on 2026-10-11; do not ask again for that project choice or change global preferences.
4. Preserve approved requirements, security controls, role permissions and workflow semantics.
5. Use the existing application, approved `DESIGN.md` decisions and `ANTISLOP.md` as active design references.
6. Figma Make is no longer part of the active workflow. Do not perform the cancelled inspection or create `docs/UI_UX_REFERENCE.md` for it.
7. Refine only the authorized checkpoint's screens; propose unresolved branding or scope decisions separately.
8. Preserve the minimal academic style, temporary text branding and approved Light/Dark/System themes (Phase 9.7.3 supersedes the earlier light-only baseline). Phase 9 is closed with documented limitations; further UI implementation requires separate owner authorization.

UI decision precedence: security/privacy/authorization > owner-approved scope/workflows > verified implementation/contracts > approved `DESIGN.md` decisions > applicable Anti-Slop rules. Preserve approved decisions on conflict and report the relevant rule/tradeoff. `DESIGN.md` records the active application-based workflow; no prototype inspection or implementation scope is inferred.

Historical 2026-10-21 checkpoint: `feature/development`, HEAD `6f02b7ebb0d7978c415bb3248f7008f662863d08`. Phase 9 is **PASS WITH DOCUMENTED LIMITATIONS** for the agreed UI/UX and online-first PWA scope. Phase 9.6 is owner-reported manual acceptance: **11 PASS, 0 FAIL**; Codex did not independently rerun those steps. Physical PWA installation/standalone behavior and hosted deployment remain unverified. The initial working tree already modified `app/(auth)/login/page.tsx`, `app/globals.css` and `docs/MASTER_CONTEXT_UPDATED.md`; preserve that work, including its pending styling verification. See the latest Master Context closure/transition handoff for evidence and the proposed Phase 10.0-10.4 sequence. Phase 10.1 is ready for owner discussion, not implementation. No new features, database writes, deployment, staging or commit are authorized by this documentation task. Figma Make remains cancelled; do not recreate removed `tests/fixtures/phase96/` tooling. Preserve multiple research projects per group, Phase 8 safeguards and hard-disabled Groq. Anti-Slop provenance and full MIT attribution remain in `DESIGN.md` and `ANTISLOP.LICENSE`.

**Handoff precedence:** The current Phase 10 direction above and the latest `docs/MASTER_CONTEXT_UPDATED.md` handoff supersede older current/next-phase statements below. The following development guide and dated handoffs retain historical evidence; do not restart completed Phase 9 work from their stale status labels. The PWA remains the functioning baseline. Expo reuse is a proposal with integration readiness unestablished; native Mobile and Electron are not implemented by this repository or authorized for integration here.


# ThesiSHS AI — Complete Development Progress & Handoff Guide

> **Purpose:** Working source of truth for progress, implementation decisions, test evidence, and contributor handoffs.
>
> **Project:** ThesiSHS AI — Thesis Evaluation and Repository Project  
> **Last confirmed branch:** `feature/development`
> **Current Git checkpoint (2026-10-10):** Phase 8 provisional closure commit on `feature/development`: `feat(phase8): checkpoint provisional static and mock closure`. Resolve its hash with `git log -1 --oneline`; predecessor is `ca95fd3` (Phase 7). Phase 8 static/mock-only Chromium, focused security/quota, lint, TypeScript and build evidence PASS. Migrations 0010/0011 remain development/test-only.
> **Working tree:** Reviewed Phase 8 source, test source, migrations/snapshots, designs and required handoffs are captured by the closure commit containing this checkpoint. Verify post-commit status; earlier unstaged checkpoints below are historical. No CI or `.github/` modification, push or merge.
> **Current phase status:** Phase 5 and lean Phase 6 are complete in the verified checkout. Lean Phase 7 is fully complete, including final Chromium browser acceptance; see the latest closure handoff in `docs/MASTER_CONTEXT_UPDATED.md`. Migration 0009 remains development/test-only.
> **Next task:** Phase 8 is provisionally complete for the implemented static/mock-only scope. Phase 9 UI/UX Refinement & PWA Integration is the next development target; lean implementation scope/branding/priority screens await explicit approval in the latest Master Context. No Phase 9 implementation yet. Preserve all Phase 8 security/quota/static guidance work and hard-disabled Groq. Mock-demonstrated Admin/Adviser interpretation is not operational Groq. Institutional consent/verifier, live synthetic testing and Vercel activation remain separate unfinished gates. This closure commit is owner-authorized; no push, merge or Phase 9 implementation.
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

## 3. Historical Step 3 Checkpoint

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
- [x] Phase 4 closure checks complete for the agreed scope. Its notification-failure handling was deferred from that closure scope; Phase 5.2 post-commit notification failure was separately verified.
- [x] Proceed to Phase 5 — Research Repository.

### Sprint 3I.9 — Phase 4 closure and regression audit
- [x] `3I.8 Complete Review Cycle` — VERIFIED.
- [x] `3I.9 Closure & Regression` — VERIFIED COMPLETE.
- [x] Phase 4 — Adviser Review & Feedback — COMPLETE.
- [x] Phase 5.1 — Document Storage Foundation — implementation and runtime acceptance complete.
- [x] Phase 5.2 — Submission ↔ Document Integration — implementation and service-level runtime acceptance complete; no schema/migration change required. Concurrent submissions and Adviser decisions were exercised; notification failure was fault-injected after commit. Browser-level Phase 5.2 acceptance was not run.
- [x] Phase 5.3 — Secure Document Access — complete and runtime-accepted; completion/documentation audit complete.
- [x] Phase 5.4 — Repository Publication — complete and runtime-accepted; completion/documentation audit complete; see the latest handoff. Phase 5.5 runtime acceptance passed; Phase 5.6/5.7 are complete; Phase 6 is next and CI remains deferred.
- [x] Full review/revision/approval cycle, version history, feedback association, notifications, authorization, role isolation, invalid operations, and PDF access verified. Detailed 3I.8 evidence is preserved in the progress source.
- [x] Adviser detail now displays the submission status. Adviser PDF access now navigates the current tab to the authorized five-minute signed URL; opening a delayed popup was not reliable in Chromium.
- [x] Added `tests/phase4-adviser-submission-status.spec.ts`; Chromium verified v1 `Revision Required`, v2 `Approved`, and the v2 private PDF response (HTTP 200, `application/pdf`, expected v2 storage path).
- [x] `npm.cmd run build` passed (Next.js 16.2.9; 22 static pages); `npx.cmd tsc --noEmit`, `npx.cmd eslint .`, and `git diff --check` passed. A sandboxed build initially failed only when fetching Google Fonts; the network-enabled build passed.
- [x] Phase 4 implementation and regression test committed as `bc87caf` — `fix(review): close Phase 4 regression audit`.
- [x] Notification delivery failure handling was deferred within the Phase 4 closure audit scope; Phase 5.2 separately runtime-verified post-commit notification failure as non-blocking.

---

## 7. Later Roadmap (Confirm Exact Phase Numbering)

### Phase 5 — Research Repository — COMPLETE
- [x] Phase 5.1 storage foundation and runtime acceptance complete (private bucket, PDF/10 MiB validation, safe versioned storage paths, server-side five-minute signed URLs).
- [x] Phase 5.2 submission/document integration and runtime acceptance complete. Per-paper transaction-scoped advisory locking serializes version eligibility/calculation through upload and insert; `(paper_id, version)` uniqueness remains the database backstop. Losing concurrent requests are rejected without an orphan object. Adviser feedback, conditional submission/research status changes, and activity logging commit in one transaction; notifications run afterward and failures do not fail the primary operation.
- [x] Phase 5.2 required no schema or migration changes. `0009_repository_paper_unique.sql` was not applied during Phase 5.2; it was subsequently applied only to the designated development/test database during Phase 5.4.
- [x] Phase 5.2 runtime acceptance used service-level flows, not browser-level acceptance. Synthetic fixtures were cleaned up. Static checks and build passed.
- [x] Phase 5.3 — Secure Document Access — complete and runtime-accepted; completion/documentation audit complete.
- [x] Phase 5.4 — Repository Publication — complete and runtime-accepted; completion/documentation audit complete; see the latest handoff. Phase 5.5 runtime acceptance passed; Phase 5.6/5.7 are complete; Phase 6 is next and CI remains deferred.

#### Phase 5.3 — Secure Document Access — Complete

Submitted-document access requires an authenticated Student/Adviser session, positive submission ID validation, current active-account/database-role verification, Student group membership or Adviser group ownership, persisted submission/file metadata verification, and a storage path bound to the submission paper/version. Admin and Panel are denied under the submitted-document rules. Only the persisted path is passed to the existing server-only signer for 300 seconds in private bucket `research-submissions`; no client-supplied paper, path, version, identity, or role is trusted.

Acceptance: actual PDF retrieval, Chromium Student/Adviser access and denial boundaries, real 300-second expiry, anonymous object denial, safe storage failure, service-level submission/review regression, independently checked fixture cleanup, and final static checks all PASS. See the detailed live acceptance and completion audit handoffs below.

Already issued signed URLs may remain usable until their 300-second expiry after authorization is revoked. Legacy/nonconforming paths outside the established naming convention are intentionally rejected; do not weaken validation. Full submission/review regression evidence is service-level; browser acceptance specifically covered document access. These are known limitations, not blockers.

#### Phase 5.4 — Repository Publication — Complete and runtime accepted

- [x] Active database Admin account required; Student, Adviser, Panel, anonymous, inactive, stale-role, and tampered requests denied.
- [x] Only approved research with an approved submission, validated persisted paper/version path, and existing private storage object is publishable.
- [x] Per-paper transaction row lock serializes publication. `UNIQUE (paper_id)` prevents duplicate repository rows; concurrent requests produce one row and repeated publication preserves the original timestamp.
- [x] Existing migration `0009_repository_paper_unique.sql` applied only to the designated development/test database after schema, duplicate, and ledger checks. Constraint and ledger entry verified; no new schema/migration files.
- [x] All 14 acceptance cases, Chromium authorization coverage, safe database failure, upload/revision/v2/approval/publication regression, and independent fixture cleanup passed. Submission/version history and Phase 5.3 protections preserved.
- [x] Completion/documentation audit complete. See latest handoffs for executed evidence and known risks. Phase 5 overall is complete.

#### Phase 5.5 — Repository Document Access — Complete and runtime accepted

- [x] Active database-backed Admin, Adviser, Student, and Panel may access published approved research regardless of group ownership. No anonymous access or Panel evaluation functionality.
- [x] Session-derived identity, strict paper/mode validation, published/approved DB relationship, and shared paper/version PDF-path validation precede server-only 300-second signing.
- [x] All 18 required cases, real Chromium View PDF and four-role downloads, exact PDF bytes, regression and independent synthetic cleanup passed. Publication timestamps/state and submission history preserved; Phase 5.3/5.4 boundaries remain intact.
- No schema/migration change. Phase 5.6/5.7 are complete; Phase 6 is next and CI remains deferred. See latest handoff for scope, evidence and limitations.

#### Phase 5.6 — End-to-End Verification & Security Audit — Complete

- [x] Practical upload/revision/v2/approval/publication/repository PDF regression, key server authorization/private-storage boundaries, Chromium listing/detail/view/download and independent fixture cleanup passed.
- [x] Lint, TypeScript, network-enabled build, diff check and Drizzle check passed. No new framework, load test or exhaustive concurrency retest.

#### Phase 5.7 — Documentation & Completion Audit — Complete

- [x] Current source-of-truth documents reconciled; Phase 5 overall complete. PDFs stay private, URLs last 300 seconds, Admin controls publication and repository access requires authentication.
- [x] Migration 0009 remains development/test-only. Known limitations retained; this is capstone-level verification, not enterprise production hardening.

### Phase 6 — Search, Filtering & Discovery — Next start-gated task

The owner authorized a lean pass on 2026-10-08. Existing discovery is reused with newest-first ordering only; focused runtime checks, lint, TypeScript and build passed. See the latest master-context handoff. The following checklist records earlier historical implementation/acceptance, including sorting modes now removed from the lean scope.
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

### Phase 7 — Administration & Reporting — Complete

- [x] Existing Admin Reports placeholder replaced with a read-only overview; dashboard services now enforce session-derived identity and an active database Admin role.
- [x] Counts: all users with Admin/Adviser/Student/Panel breakdown; all research groups; all research papers with Draft/In Review/Revision Required/Approved breakdown; zero and Other buckets retained.
- [x] Distinct published paper count reuses repository eligibility: published entry, approved paper, approved submission. No storage access, counters or document URLs.
- [x] Latest five recorded activity actions/timestamps, deterministic timestamp/ID ordering; actor details, descriptions and IP addresses omitted from reporting and the existing dashboard activity output.
- [x] Focused unit/rendering, read-only local database aggregation and actual production HTTP access checks PASS. Anonymous and non-Admin redirects, stale database roles, inactive/missing accounts and safe errors covered.
- [x] Lint, TypeScript, production build, existing repository-document isolated regression and diff checks PASS. No schema/migration/dependency changes, fixtures, commits or pushes.
- [x] Final focused Chromium browser acceptance PASS: existing Admin navigates Dashboard -> Admin Dashboard -> Reports; all implemented sections/metrics visible; screenshot inspected with no obvious rendering issues; no page/console/HTTP 5xx errors. Existing Student direct reports URL redirects to /dashboard without report content.
- Limits: Live counts use separate reads, not a historical or transaction-consistent snapshot. Activity includes only existing logged operations. Charts, exports, date-range analytics and comprehensive auditing remain deferred.
- Exact next action: Phase 8.2 static guide foundation complete; await owner review and explicit next-phase authorization. Phase 7 is closed and committed at ca95fd3.

### Phase 8 — AI-Assisted Features — Provisionally complete for implemented static/mock-only scope; Groq hard-disabled
**AI Chatbot Guide (retained static foundation)**
- [x] Phase 8.5B.4A persistent eligibility/consent backend and server-only verifier configuration foundation built; focused synthetic tests/lint/TypeScript/build/Drizzle/diff PASS. Migration 0010 applied to development/test only; institutional bootstrap/config absent, so not operational. Groq hard-disabled.
- [x] Phase 8.5B.2B test-only synthetic mock integration/security and Student static regression PASS, plus lint/TypeScript/build/diff checks. No application/provider activation or real adult approval; see latest handoff.
- [x] Phase 8.5A local Admin/Adviser foundations verified: strict static actions, active-role authorization, fail-closed adult eligibility, owned Adviser aggregate query and suppressed/coarsened DTOs. Groq hard-disabled; no outbound calls.
- [x] Focused local AI unit/read-only SQL/Chromium, Student guide regression, lint, TypeScript, build and diff checks PASS. See latest handoff for scope and deferred activation controls.
- [x] Phase 8.4 Adviser design proposed: fixed topics, owned submission-version aggregates, k=5 contributor/paper guards and static fallback. No aggregate API/provider implementation; owner decisions pending.
- [x] Phase 8.3 Admin report design proposed; see docs/PHASE8_3_ADMIN_AI_DESIGN.md. Groq candidate only; no provider implementation. SOURCE_OF_TRUTH_UPDATED.md section 11 supersedes older generative guide/summarization plans.
- [x] Phase 8.1 design proposal preserved. Phase 8.2 static foundation explicitly authorized and verified on 2026-10-08; provider approval remains pending.
- [x] Phase 8.2: strict predefined IDs, canonical role-filtered guidance, active database-backed authorization, verified links and disabled provider boundary. No AI generation, free text, private research access or external fetches.
- [x] Static allowed topics, role-aware behavior and safe fallback implemented and tested.
- [~] Provider design documented; exact model, school-age eligibility, privacy terms and cost/usage controls require approval before provider implementation.
- [x] Static guide remains assistive; no review/approval decisions or official feedback generation.
- [x] Canonical source facts, role/topic matrix and static fallback verified with focused unit/Chromium checks. Generated-answer accuracy remains untested because no provider exists.

**AI Summarization — retired by owner scope update (2026-10-09); historical unimplemented checklist follows**
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


### Durable capstone development rules (owner-approved 2026-10-09)

- Build a functional, secure college capstone deployment on existing Next.js/PostgreSQL/Supabase/Vercel; prefer free tiers, existing services, minimal dependencies and simple layered code.
- Avoid unnecessary dashboards, microservices, enterprise monitoring/infrastructure/abstraction. Do not create planning phases or repeat completed audits unless an actual technical blocker requires them.
- Keep prompts, implementation, documentation and verification focused/token-efficient; test critical authorization, consent/privacy, database integrity, functionality and changed regressions, not repeated broad suites.
- Keep mandatory active-account/current-role/ownership, independent adult verification, versioned consent, k=5 suppression, strict contracts/provider isolation and fallback. Student guide stays static; AI never makes academic decisions.
- Follow docs/SOURCE_OF_TRUTH_UPDATED.md section 1B and latest Master Context checkpoint. Local synthetic pilot approval does not authorize Vercel/real-data activation; use the smallest existing service for demonstrated deployment requirements.
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

### Research Before Implementation Policy

Follow the durable [Research Before Implementation Policy](docs/SOURCE_OF_TRUTH_UPDATED.md#research-before-implementation-policy-owner-decision-2026-10-27) for future development tasks:

- Research before implementing unfamiliar, technically uncertain, security-sensitive or architecturally significant features. Routine UI refinements, simple fixes and established patterns need no external research unless material uncertainty arises.
- Start with existing source/patterns, then canonical documentation/approved decisions, official framework/library/provider documentation, reputable relevant GitHub implementations, and finally custom implementation if existing approaches are unsuitable. Third-party examples never override project requirements.
- Before external implementation searches, define the problem, expected behavior, stack, architecture/integration constraints, authentication/authorization/privacy needs, performance and maintainability; use specific queries.
- When GitHub comparison is useful, shortlist approximately 2–3 strong candidates. Report each name/URL, license/reuse obligations, most recent commit and latest relevant implementation activity, maintenance/abandonment indicators, dependency/framework compatibility, verifiable security concerns and project suitability. Stars alone are not quality evidence; label unverifiable findings unverified.
- Before copying licensed code, confirm permitted reuse and satisfy attribution/compliance obligations. Unknown or incompatible licensing requires owner approval and appropriate review before copying; approval alone cannot supply missing license permission.
- Compare architecture, security/privacy, maintainability, performance, licensing, dependency complexity and effort. Prefer adapting established patterns; avoid new dependencies or architectural changes when existing code safely suffices.
- Keep research proportional: official documentation may suffice; avoid repeated searches, extended routine-change research and new test frameworks solely for borrowed patterns. If browsing is unavailable, report it and use verified local resources.
- Preserve server-side role/ownership checks, PostgreSQL/Drizzle layers, JWT/session security, private Supabase documents, submission versions, Student/Adviser/Admin workflows, AI eligibility/privacy restrictions and environment/migration safeguards. Do not weaken security or add external services without explicit authorization; research does not authorize implementation or separately gated operations.
- When external research materially influences work, report the exact use case, sources, shortlisted repositories' license/latest relevant commit evidence, approaches compared, selection/reasoning, security/compatibility considerations and uncertainties. Never claim repository, vulnerability, license or dependency verification without evidence.

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
- **Phase 5 validation:** `npm.cmd run build` passed (Next.js 16.2.9, TypeScript, 22 static pages); `npm.cmd run lint` passed; `npx.cmd drizzle-kit check` passed; `git diff --check` passed after progress header cleanup. Migration was unapplied at this historical checkpoint; existing migration 0009 was subsequently applied only to the designated development/test database during Phase 5.4.
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
3. Phase 4 closure is complete; its notification-failure deferral remains limited to that closure scope. Phase 5.1 and 5.2 are complete and runtime-accepted.
4. Phase 6 core authenticated search/filter/sort/pagination scenarios are user-confirmed passed on 11 eligible synthetic papers; no-results and Clear filters A–D passed in Playwright.
5. Phase 5.2 runtime acceptance was service-level, not browser-level. Do not treat it as browser acceptance.
6. Phase 5.3 is complete and runtime-accepted. Phase 5.4 — Repository Publication is complete and runtime-accepted (PASS; completion/documentation audit complete). Phase 5.5 — Repository Document Access is complete and runtime-accepted (PASS). Phase 5.6 — End-to-End Verification & Security Audit and Phase 5.7 — Documentation & Completion Audit are complete. **Phase 5 overall is complete.** Phase 6 — Search, Filtering & Discovery is next and requires explicit owner direction; it was not started in this pass. CI remains deferred. Do not commit or push.
7. Migration `0009_repository_paper_unique.sql` was applied only to the designated development database in Phase 5.4; verify migration state before changing other environments.
8. Preserve unrelated uncommitted source, `.github/`, and documentation changes when committing a scoped task.
9. After a milestone, update the checkpoint and handoff with executed test evidence and confirmed commit hash.

**Current next task: owner manual review/commit of Phase 5 work; await direction before Phase 6. CI remains deferred; do not stage/commit/push in this session.**

## Handoff — 2026-10-07 — Phase 5.3 Secure Document Access

Historical implementation snapshot: pending statuses and next actions below were superseded by live acceptance and the completion audit.

- Status: Implementation complete; live/browser acceptance pending at the owner's request. Not ready to mark Phase 5.3 complete.
- Branch / starting and ending HEAD: `feature/development`, `5762e24` — `feat(phase5): complete Phase 5.2 submission integration`. No commit or push made.
- Scope: Submitted PDFs only. Existing repository publication/document access, `.github/`, CI, Phase 5.4, and unrelated UI work were not modified.
- Inspection: Historical Student/Adviser document access lived in `lib/actions/storage.action.ts` with repository calls and only a nonempty-path check. Existing five-minute private-bucket signer is `createResearchDocumentSignedUrl` in `lib/services/storage.service.ts`. Published repository access is a separate existing flow and remains outside this change.
- Implementation: The action authenticates/role-gates, validates a positive PostgreSQL submission ID with Zod without coercion, and calls a server-only document service. The service rechecks the current active account and database role, resolves submission → paper → group, checks Student membership or Adviser ownership, and validates that the persisted PDF path exactly matches the stored paper and version before signing for 300 seconds. Missing metadata and DB/storage errors return null. Signing errors no longer log raw SDK errors. Student PDF navigation uses the current tab, matching the existing Adviser button.
- Authorization: Students may access submissions in groups where they are currently members, including another member's submission. Advisers may access their owned groups only. Inactive/deleted accounts, other groups/Advisers, Admin, and Panel are denied by the submitted-document flow. Admin denial preserves the existing action's rules; Admin published-repository access is unchanged. No client paper ID, path, version, identity, or role is used for signing.
- Files changed: `lib/actions/storage.action.ts`, `lib/services/submission-document.service.ts`, `lib/validations/submission-document.ts`, `lib/services/storage.service.ts`, `app/dashboard/student/submissions/DownloadSubmissionButton.tsx`, `tests/phase5-document-access.unit.cjs`, `tests/phase5-document-access.acceptance.cjs`, `AGENTS.md`, and `docs/MASTER_CONTEXT_UPDATED.md`.
- Schema/migrations: None required, generated, or applied. Existing `0009_repository_paper_unique.sql` was unapplied at this historical checkpoint; it was subsequently applied only to the designated development/test database during Phase 5.4. `npx.cmd drizzle-kit check` passed and does not apply migrations.
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
- Final static checks: `npm.cmd run lint` PASS; `npx.cmd tsc --noEmit` PASS; network-enabled `npm.cmd run build` PASS (Next.js 16.2.9, TypeScript, all 22 static pages); `git diff --check` PASS; `npx.cmd drizzle-kit check` PASS. No migration generated/applied; `0009_repository_paper_unique.sql` was unapplied at this historical checkpoint; it was subsequently applied only to the designated development/test database during Phase 5.4.
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
- Schema/migrations: No changes required, generated, or applied for Phase 5.3 or this audit. Existing `0009_repository_paper_unique.sql` was unapplied at this historical checkpoint; it was subsequently applied only to the designated development/test database during Phase 5.4; Drizzle check is validation, not migration application.
- Working-tree scope: Seven accepted Phase 5.3 application/test files plus the six reconciled documentation files. Phase 5.1/5.2 implementation is already in HEAD. Existing untracked `.github/` is unrelated, untouched, and excluded; its existing workflow checksum is unchanged. Nothing is staged.
- Known limitations, not blockers: Already issued URLs can remain usable until their 300-second expiry after revocation; nonconforming/legacy paths are intentionally rejected without weakening validation; full submission/review regression is service-level and browser acceptance covered document access specifically.
- Recommended future commit grouping, only when authorized: (1) `feat(storage): secure submitted PDF access` containing `app/dashboard/student/submissions/DownloadSubmissionButton.tsx`, `lib/actions/storage.action.ts`, `lib/services/submission-document.service.ts`, `lib/services/storage.service.ts`, `lib/validations/submission-document.ts`, `tests/phase5-document-access.unit.cjs`, and `tests/phase5-document-access.acceptance.cjs`; (2) `docs(phase5): close Phase 5.3 acceptance` containing only the six documentation files above. Exclude `.github/`, environment files, and migrations from both groups. No hashes exist for these proposed commits.
- Exact next action: Await owner direction. Phase 5.4 — Repository Publication is the next start-gated task; it was not started. CI remains deferred and was not started. Do not commit/push yet.

## Handoff — 2026-10-07 — Phase 5.4 Repository Publication PASS

- Recommendation: **PHASE 5.4 PASS**. Implemented and runtime-accepted; all intended changes remain uncommitted for owner review. Branch/starting and ending HEAD: `feature/development`, `20c733f` — `feat(storage): secure submitted PDF access`. Working tree was clean at start; Phase 5.3 is already committed. No staging/commit/push performed.
- Inspection: Historical publication actions/UI/repository code existed. Actions had only session-role gates, no active DB Admin service check, silent results, and nontransactional eligibility/write logic. Existing schema and migration 0009 declare `UNIQUE(paper_id)`, but the confirmed test DB lacked it. Repository entries reference papers; document lookup uses that paper's approved submission and persisted private path. No historical code was blindly restored.
- Implementation: Action authentication and Zod IDs/state validation; server-only service checks active database Admin and derives paper/approved submission/path/state from DB. Transaction locks account (shared) and paper (update) through eligibility, object-existence verification via the existing 300-second signer, and write. Service rejects invalid/nonapproved/missing-document/already-published requests. Unique constraint plus conflict-do-nothing is the insert backstop. Hidden records are reused on republication; duplicate requests do not change publication timestamps/counters. Safe generic failures and clear Admin UI result/pending state. Submitted-document authorization and repository document access remain unchanged.
- Migration decision/application: Required for database-level paper uniqueness and the existing conflict target. Designated DB confirmed as `localhost/thesishs_ai`; configured development Supabase host confirmed. Verified no duplicate paper IDs, exact migration SQL/schema compatibility, and all nine existing ledger hashes/timestamps. Only existing `0009_repository_paper_unique.sql` was applied using Drizzle migrator; verified `repositories_paper_id_unique UNIQUE (paper_id)` and tenth ledger entry. No migration/schema files were generated/changed, no data deleted, no production/credentials/environment configuration changed. Other environments unverified.
- Runtime command: Process-only `PHASE5_ACCEPTANCE_CONFIRMED=1`, then `node --import tsx tests/phase5-publication.acceptance.cjs`. Real local app and Chromium; synthetic fixtures only. Runner reuses the established Phase 5 acceptance login/PDF/cleanup patterns and submission/review services, and exited 0.

| Required acceptance | Result | Evidence |
|---|---|---|
| 1 Admin publishes eligible approved research | PASS | Real Chromium Admin button returned visible publication success. |
| 2 Published record references correct paper | PASS | Repository row and repository data lookup matched the fixture paper ID. |
| 3 Correct approved document relationship | PASS | Published detail matched approved v2 submission ID and persisted path; missing approved submission, cross-paper path, and missing object rejected. |
| 4 Student cannot publish | PASS | Service denied and real Server Action replay redirected/denied. |
| 5 Adviser cannot publish | PASS | Service denied and real Server Action replay redirected/denied. |
| 6 Panel cannot publish | PASS | Service denied and real Server Action replay redirected/denied; no Panel functionality added. |
| 7 Unauthenticated denied | PASS | Anonymous Server Action replay redirected/denied. |
| 8 Nonapproved research denied | PASS | Draft submission could not publish; no row created. |
| 9 Invalid/tampered IDs rejected | PASS | Negative/fractional/zero/nonexistent/malformed identifiers and SQL-like strings denied; manipulated object-shaped action arguments returned controlled invalid-request result. |
| 10 Already published does not duplicate | PASS | Duplicate service/action requests rejected; one row and original publication timestamp preserved. |
| 11 Concurrent requests yield one publication | PASS | Two active Admins raced new-row publication and hidden-row republication; each race had exactly one success and one repository row. Direct duplicate DB insert was rejected by unique constraint. |
| 12 Historical submissions preserved | PASS | Submission and feedback snapshots for v1/v2 were identical before/after publication. |
| 13 Phase 5.3 remains secure | PASS | Permitted Student/Adviser URL generation, exact private PDF retrieval, 300-second token policy, Admin/Panel/foreign-group denial, and public-object denial rechecked. Phase 5.3 implementation files unchanged. |
| 14 State consistent after failures | PASS | Missing metadata/object and process-local injected database transaction failure produced controlled failures with no publication writes. Disabled/reassigned Admin service and stale-session browser requests denied. |

- Regression: Existing Student upload → Adviser review → Revision Required → Student v2 → Adviser approval → Admin publication passed. Approved resubmission rejected; version/feedback history preserved. Review regression was service-level; publication/authorization acceptance used Chromium and real Server Actions.
- Cleanup: Runner removed synthetic repository/users/groups/papers/submissions/memberships/feedback/activity/notifications and uploaded PDFs. Independently verified no PHASE54 markers, zero fixture rows in publication/history tables, and empty storage prefixes. No temporary harness files remain; intended `tests/phase5-publication.acceptance.cjs` is preserved. Local test server stopped.
- Static validation: `npm.cmd run lint` PASS with no warnings after removing an unused harness import; `npx.cmd tsc --noEmit` PASS; network-enabled `npm.cmd run build` PASS (Next.js 16.2.9, TypeScript, 22 static pages); `npx.cmd drizzle-kit check` PASS; `git diff --check` PASS.
- Changed source/tests: `app/dashboard/admin/repository/page.tsx`, `app/dashboard/admin/repository/RepositoryManagement.tsx`, `lib/actions/repository.action.ts`, `lib/services/repository.service.ts`, `lib/services/repository-publication.service.ts`, `lib/repositories/repository.repository.ts`, `lib/repositories/repository-publication.repository.ts`, `lib/validations/repository-publication.ts`, `tests/phase5-publication.acceptance.cjs`.
- Changed documentation: `AGENTS.md`, `README.md`, `docs/MASTER_CONTEXT_UPDATED.md`, `docs/SOURCE_OF_TRUTH_UPDATED.md`, `docs/ARCHITECTURE_UPDATED.md`, and `docs/DATABASE (1).md`; current checkpoint/phase/migration facts updated, historical Phase 5.3 handoffs preserved.
- Blocked/unverified: None in the required Phase 5.4 acceptance matrix. Other database environments and Phase 5.5 repository-document acceptance were not tested.
- Remaining risks: Supabase object verification holds a DB transaction while the storage request completes. Storage and DB do not share an atomic transaction; an object may later be removed, and document retrieval must continue to fail safely. Repository records refer to the paper and dynamically resolve its approved submission rather than storing an immutable submission snapshot. Phase 5.3 bearer-URL expiry and strict legacy-path limitations remain unchanged.
- Exact next action: Owner manual review/commit/push only when desired. Do not commit/push in this session. Phase 5.5 — Repository Document Access remains start-gated; CI, .github workflows, AI features, and unrelated UI/refactors were not started or modified.

## Handoff — 2026-10-07 — Phase 5.4 Completion / Documentation Audit

- Final result: **PHASE 5.4 COMPLETE**. Phases 5.1/5.2/5.3 remain complete; all 14 accepted Phase 5.4 runtime cases, Chromium authorization coverage, full service-level upload/revision/v2/approval/publication regression, and independently checked cleanup are recorded above. Live acceptance was reviewed, not rerun during this documentation audit.
- Reconciliation: Updated only `AGENTS.md`, `README.md`, `docs/MASTER_CONTEXT_UPDATED.md`, `docs/SOURCE_OF_TRUTH_UPDATED.md`, `docs/ARCHITECTURE_UPDATED.md`, and `docs/DATABASE (1).md`. Historical migration notes now distinguish their original checkpoint from current development/test application. No application/test behavior changed; no correctness defect found.
- Database audit: Read-only verification reconfirmed `repositories_paper_id_unique UNIQUE (paper_id)` and the exact existing 0009 SQL SHA-256/journal timestamp in the migration ledger of the designated development/test database. Migration 0009 was applied during Phase 5.4 acceptance only to that environment, not production. No migration/schema files added/changed; no migration executed during this audit. Other environments remain unverified.
- Validation rerun: `npm.cmd run lint` PASS; `npx.cmd tsc --noEmit` PASS; `npx.cmd drizzle-kit check` PASS; `git diff --check` PASS. Sandboxed `npm.cmd run build` failed only fetching Google Fonts; authorized network-enabled retry PASS (Next.js 16.2.9, TypeScript, all 22 static pages).
- Working-tree scope: Nine accepted Phase 5.4 application/test files (listed in the preceding handoff) and the six reconciled documents. HEAD remains `20c733f` on `feature/development`; no staged changes. Current Git status reports no `.github/` files; that directory was untouched.
- Known non-blocking risks: Storage verification holds the database transaction during a network request; objects may be deleted after publication; repository records dynamically resolve an approved submission. Phase 5.3 300-second bearer-URL and strict legacy-path limitations remain unchanged.
- Recommended manual commit grouping: (1) `feat(repository): secure Admin publication` for the nine application/test files; (2) `docs(phase5): close Phase 5.4 acceptance` for the six documents. Existing migration 0009 is already tracked and unchanged. Exclude `.github/`, environment files, and generated artifacts. No staging, commit, or push performed.
- Next start gate: **Phase 5.5 — Repository Document Access** requires explicit owner direction. Phase 5.5, CI, AI work, and unrelated refactors were not started.

## Handoff — 2026-10-07 — Phase 5.5 Repository Document Access PASS

- Recommendation: **PHASE 5.5 PASS**. Implementation and runtime acceptance complete. Branch/starting and ending HEAD: `feature/development`, `70b8fb4`. Phase 5.4 commits `a6bae0f` and `70b8fb4` remain intact, two commits ahead of the local origin tracking ref. No reset/rebase/amend/staging/commit/push or remote fetch performed.
- Audit: Existing repository listing/details permit all four authenticated roles. Existing document controls/action/service and published/approved joins were retained, not blindly restored. Historical service lacked active DB account checks and duplicated weaker path validation; it logged raw errors. Repository rows reference papers, and approved documents resolve dynamically. Phase 5.3 submitted-document access remains separate and unchanged.
- Implementation: Existing UI -> authenticated Server Action -> strict numeric paper ID/mode Zod validation -> dedicated server-only repository-document service -> existing published/approved repository lookup -> shared Phase 5.3 path validator and private-storage signer for 300 seconds. Service verifies an active account with database role Admin/Adviser/Student/Panel and persisted submission identity/paper/version metadata. Group ownership does not restrict published repository access. Client storage paths, roles, versions and submission IDs never select the object. Approved submission resolution has a stable ID tie-breaker. Generic safe failures; existing view/download controls now report success as well as pending/failure. Only the existing download counter changes; no public URLs or signed URLs in initial HTML.
- Reuse: `isSubmissionDocumentPath`, `submissionDocumentIdSchema`, `createResearchDocumentSignedUrl` (existing default 300 seconds), published/approved database query, established synthetic PDF/login/cleanup acceptance patterns. Phase 5.3 service/action/storage helpers and Phase 5.4 publication services/constraints were not changed.
- Schema/migrations: None required, created, changed, or applied. Existing migration 0009 remains applied only to the designated development/test DB; production/other environment states unverified.
- Runtime command: Process-only `PHASE5_ACCEPTANCE_CONFIRMED=1`, `node --import tsx tests/phase5-repository-document.acceptance.cjs`. Guarded designated DB `localhost/thesishs_ai`, Supabase `cbkplqkkjuoglpimwmib.supabase.co`, private bucket `research-submissions`. Real network-enabled local production app and Chromium; synthetic fixtures only. Final runner exited 0.

| Required acceptance | Result | Executed evidence |
|---|---|---|
| 1 Student published PDF | PASS | Service HTTP 200 PDF exact bytes and real Chromium download. |
| 2 Adviser same PDF | PASS | Same approved-v2 bytes through service and real Chromium download. |
| 3 Admin published PDF | PASS | Service and real Chromium download. |
| 4 Panel published PDF | PASS | Established four-role repository rule verified; service/Chromium download, no evaluation features. |
| 5 Unauthenticated denied | PASS | Actual anonymous Server Action replay redirected/denied; isolated action check also passed. |
| 6 Unpublished denied | PASS | Service/action reject hidden publication; detail controls absent after unpublication. |
| 7 Tampered identifiers denied | PASS | Invalid/malformed/nonexistent numeric/object/path identifiers rejected; only paper ID accepted, no client repository/submission selector. |
| 8 Client path injection cannot redirect | PASS | Malformed mode/path rejected; extra path/version/submission/role arguments ignored and authoritative approved v2 signed. |
| 9 Correct approved submission/version | PASS | DB lookup matches v2 ID/path; exact distinct v2 bytes retrieved. |
| 10 Older/unapproved/revision version denied | PASS | Revision-v1 path injection cannot select v1; nonapproved/missing approved selection fails safely. |
| 11 Expected PDF retrieval | PASS | HTTP 200, application/pdf, byte-for-byte uploaded-v2 match; Chromium View PDF HTTP 200 and four-role download byte match. |
| 12 300-second lifetime | PASS | Actual signed JWT exp minus iat exactly 300 seconds; isolated signer arguments exactly 300. Real post-expiry retrieval was not repeated for Phase 5.5 (Phase 5.3 already runtime-verified it). |
| 13 Public/unsigned storage denied | PASS | Both anonymous direct/public object requests returned HTTP 400. |
| 14 Missing object safe | PASS | Valid bound nonexistent path yields generic failure with no URL. |
| 15 Storage/signing failure safe | PASS | Process-local fetch fault injection, restored in finally; generic result, no path/sensitive detail. Isolated DB/storage failures also pass. |
| 16 Publication state/timestamp preserved | PASS | Snapshots before/after successful document requests match; intentional unpublish test is separate. History/feedback unchanged. |
| 17 Phase 5.3 intact | PASS | Authorized Student/Adviser submitted URLs; Admin/Panel/foreign Student/foreign Adviser denied. Existing isolated Phase 5.3 suite rerun PASS. |
| 18 Phase 5.4 protections intact | PASS | Concurrent publication one winner/row, repeated publish rejected, direct duplicate DB insert denied. |

- Browser: Real authenticated Server Action and View PDF passed; Student/Adviser/Admin/Panel downloads matched uploaded v2 bytes. Anonymous, manipulated requests, inactive account with stale session, and hidden publication denied. Foreign-group Student/Adviser repository service access works as intended while their submitted-document access is denied.
- Regression: Student upload -> Adviser review -> Revision Required -> v2 -> Approved -> Admin publication -> authenticated repository PDF PASS. Submission/review exercised at service level; repository view/download exercised in Chromium.
- Harness corrections: Sandboxed storage reachability failed before fixtures; network-enabled service/app retries succeeded. Initial token assertion used workstation wall clock; changed to exact issuer exp-iat lifetime. An unordered history snapshot produced an assertion failure after adding view coverage; fixed by ordering both snapshots by ID. No application defect or security weakening was found. Failed-run fixtures were cleaned by the runner.
- Cleanup: All synthetic users/groups/papers/submissions/memberships/feedback/activity/notifications/repository rows and PDFs removed. Independent read-only marker and fixture/child-row counts were zero; synthetic storage prefixes empty. Temporary creation helper removed; intended unit/acceptance files retained. Local test app stopped. No real/production data or environment configuration changed.
- Final checks: `npm.cmd run lint` PASS; `npx.cmd tsc --noEmit` PASS; `npx.cmd drizzle-kit check` PASS; `git diff --check` PASS. Sandboxed build failed only on Google Fonts; authorized network-enabled `npm.cmd run build` PASS (Next.js 16.2.9, TypeScript, 22 static pages). Both isolated document suites PASS.
- Files: `app/dashboard/repository/[paperId]/DownloadRepositoryDocumentButton.tsx`, `lib/actions/repository.action.ts`, `lib/services/repository.service.ts`, `lib/services/repository-document.service.ts`, `lib/repositories/repository.repository.ts`, `lib/validations/repository-document.ts`, `tests/phase5-repository-document.unit.cjs`, `tests/phase5-repository-document.acceptance.cjs`, and the six source-of-truth documentation files.
- Blocked/unverified: No required acceptance cases blocked. Phase 5.5 did not repeat the real expiry wait or verify other environments. Browser coverage targets repository documents, not the entire submission/review UI.
- Remaining risks: Issued bearer URLs remain usable until their 300-second expiry after revocation/unpublication; strict legacy/nonconforming paths are rejected; storage can be deleted after signing/publication; approved document selection is dynamic. Phase 5.4 network request inside publication transaction remains unchanged. No schema migration needed.
- Stop gate: Everything uncommitted/unstaged for owner review. No CI/.github changes, Phase 5.6, AI features, or unrelated refactors. Await explicit owner direction before the next phase.

## Handoff — 2026-10-07 — Phase 5.5 Completion / Documentation Audit

- Final result: **PHASE 5.5 COMPLETE**. Phases 5.1 through 5.5 are complete and runtime-accepted. All 18 required Phase 5.5 cases and independent database/storage cleanup are accepted and recorded in the preceding handoff. Live acceptance was reviewed, not rerun during this documentation audit; no fixtures were created.
- Evidence reviewed: Chromium View PDF and Student/Adviser/Admin/Panel downloads PASS; expected PDF HTTP 200, application/pdf, exact uploaded-byte match. Anonymous, unpublished, inactive and manipulated requests denied; malformed metadata/missing objects and injected storage failures fail safely. Actual token exp - iat = 300 seconds. Phase 5.5 did not repeat the real expiry wait already runtime-verified in Phase 5.3. Submission -> Adviser approval -> Admin publication -> authenticated repository PDF regression PASS; history and Phase 5.3/5.4 protections preserved.
- Authorization audit: Submission documents remain Student membership/Adviser ownership scoped (Admin/Panel denied). Published repository documents permit active database-backed Student/Adviser/Admin/Panel accounts, independently of group ownership, only for published approved research and its database-resolved approved submission. Shared Phase 5.3 ID/path validation, server-only private-storage signer, 300-second expiry and safe storage handling are reused. No application correctness defect found; application/test files unchanged during this audit.
- Documentation reconciled: `AGENTS.md`, `README.md`, `docs/MASTER_CONTEXT_UPDATED.md`, `docs/SOURCE_OF_TRUTH_UPDATED.md`, `docs/ARCHITECTURE_UPDATED.md`, `docs/DATABASE (1).md`. Corrected stale Phase 5.4 working-tree descriptions and README's current .github status; named the Phase 5.6 gate, clarified role/access separation, expiry evidence and migration boundary. Earlier handoffs remain historical records.
- Validation rerun in this audit: `npm.cmd run lint` PASS; `npx.cmd tsc --noEmit` PASS; `npx.cmd drizzle-kit check` PASS; `git diff --check` PASS. Sandboxed `npm.cmd run build` failed only fetching existing Google Fonts; authorized network-enabled retry PASS (Next.js 16.2.9, TypeScript, 22 static pages).
- Schema/migrations: No Phase 5.5 changes, new migrations or migration applications. Existing 0009 remains applied only to the designated development/test database during Phase 5.4; production/other environments remain unverified. No environment configuration changed.
- Git boundary: Branch `feature/development`, HEAD `70b8fb4`; Phase 5.4 commits `a6bae0f` and `70b8fb4` preserved without reset/rebase/amend/squash/cherry-pick/rewrite. Local origin tracking comparison remains zero behind/two ahead. Eight accepted application/test files and six documentation files comprise the working tree; nothing staged. No .github files appear in current Git status and that directory was untouched.
- Known non-blocking limitations: Issued bearer URLs can remain usable until 300-second expiry after account revocation/unpublication; strict legacy/nonconforming paths are intentionally rejected; storage objects may be removed after publication; approved-document selection resolves dynamically. Submission/review regression is service-level; Chromium covered repository documents. No required acceptance blockers remain.
- Recommended manual commits: (1) `feat(repository): secure published PDF access` for the eight application/test files listed in the preceding handoff; (2) `docs(phase5): close Phase 5.5 acceptance` for only the six documents. Exclude .github, environment files, migration/schema files and generated artifacts. Nothing staged, committed or pushed.
- Next start gate: **Phase 5.6 — End-to-End Verification & Security Audit** requires explicit owner direction. Phase 5.6, CI, AI work and unrelated refactors were not started.

## Handoff — 2026-10-07 — Phase 5.6 / 5.7 Final Verification and Closure

- Results: **Phase 5.6 PASS; Phase 5.7 COMPLETE; PHASE 5 COMPLETE**. Proportional capstone verification, no new test framework or enterprise/load/security scanning. Earlier detailed acceptance evidence remains valid.
- Command: Process-only `PHASE5_ACCEPTANCE_CONFIRMED=1` and `PHASE5_FINAL_VERIFICATION=1`, then `node --import tsx tests/phase5-repository-document.acceptance.cjs`. Reused existing guarded test runner with a reduced final-verification mode. Designated environment checks passed: localhost/thesishs_ai and confirmed test Supabase private research-submissions bucket. No configuration change or production/real student data.
- Runtime PASS: Student PDF -> owned Adviser review -> Revision Required -> v2 -> approval -> Admin publication -> authenticated repository PDF. Approved resubmission blocked, foreign Adviser review denied, Student/Adviser/Panel publication denied, repeated publication rejected with one row. Submission/feedback history and publication timestamp/state preserved. No exhaustive concurrency retest.
- Browser PASS: Authenticated Student followed repository listing title link to details; actual Server Action download matched exact uploaded v2 bytes; View PDF returned HTTP 200 application/pdf. Anonymous, unpublished, tampered and inactive-session requests denied. Submission/review/publication regression was service-level; browser focused on important repository navigation/documents rather than repeating every earlier UI case.
- Security PASS: Server-side authentication and database-role/account checks, strict IDs/persisted path, Student/Adviser ownership-scoped submitted documents versus authenticated published repository access, private bucket and public/unsigned object HTTP 400, signed JWT exp - iat exactly 300. No public PDF URL introduced or secrets/internal errors returned by document access. Prior expiry wait/fault-injection coverage was reused, not repeated. No application defect found and no application code changed in this final pass.
- Cleanup PASS: Runner removed all synthetic users/groups/papers/submissions/memberships/feedback/activity/notifications/repository rows/PDFs. Independent read-only marker and fixture-child counts zero; synthetic storage prefixes empty; existing UNIQUE(paper_id) intact. Existing unrelated/historical data preserved. Local test app stopped.
- Static PASS: npm.cmd run lint; npx.cmd tsc --noEmit; npm.cmd run build (network-enabled retry; initial sandbox attempt failed only fetching Google Fonts); git diff --check; npx.cmd drizzle-kit check. Next.js 16.2.9 generated all 22 static pages.
- Phase 5.7 reconciliation: Six source-of-truth docs updated only where stale. Phases 5.1 through 5.7 and Phase 5 overall complete; next start gate Phase 6 — Search, Filtering & Discovery. Earlier Phase 6 checklist/handoffs remain historical, not new work in this pass.
- Files changed this pass: tests/phase5-repository-document.acceptance.cjs plus AGENTS.md, README.md, docs/MASTER_CONTEXT_UPDATED.md, docs/SOURCE_OF_TRUTH_UPDATED.md, docs/ARCHITECTURE_UPDATED.md, docs/DATABASE (1).md. Prior uncommitted Phase 5.5 changes preserved. Schema/migrations: none created/changed/applied; 0009 remains applied only to the designated development/test DB from Phase 5.4; production state unverified.
- Known limitations, not blockers: Issued URLs remain usable until 300-second expiry after revocation/unpublication; storage objects may be removed after publication; strict legacy paths rejected; approved-document resolution dynamic. This verification supports the capstone delivery/demo, not enterprise production hardening.
- Git/stop gate: HEAD 70b8fb4, Phase 5.4 commits a6bae0f/70b8fb4 untouched; everything unstaged/uncommitted. No Phase 6, CI, .github changes, AI work, reset/rebase/amend, commit or push. Suggested manual commits for accumulated work: feat(repository): secure published PDF access; test(phase5): verify capstone repository workflow; docs(phase5): close research repository phase.


## Handoff - 2026-10-08 - Phase 8.2 AI Chatbot Guide Static Foundation

- Contributor: Codex.
- Status: Static foundation COMPLETE and verified. AI provider/chat generation, age eligibility review, summarization and Phase 8.3 are NOT implemented or started.
- Branch / starting and ending HEAD: feature/development, ca95fd3 - feat(admin): complete Phase 7 reporting. Actual Git inspection supersedes older current-state documentation at 435dc36. At start, Phase 7 was already committed and only docs/PHASE8_1_CHATBOT_GUIDE_DESIGN.md was untracked. This task created no commits; all Phase 8.2 edits remain unstaged/uncommitted and the existing design file is preserved unchanged.
- Scope: /dashboard/guide with 13 canonical predefined topic IDs (7 Admin questions, 6 Adviser, 6 Student). Main /dashboard has a System Guide entry for those roles. Only exact { topicId } requests pass strict Zod validation; no free text, histories, instructions or client-supplied identities/routes. This explicitly supersedes the optional local typed-question matching in the Phase 8.1 proposal for this implementation.
- Authorization: Page requireRole plus service session-derived identity, positive safe user ID, active database user and matching current database role. Every action rechecks authorization. Panel/anonymous/unknown roles, inactive/missing accounts and stale role claims denied; cross-role/unknown topics rejected without returning a topic or links. Generic unavailable/unsupported messages expose no account/query details.
- Knowledge: Reviewed canonical navigation/workflow guidance for projects/submission/revision, own Adviser groups/review/human feedback, Admin users/groups/publication/read-only reports, repository use, own notifications and human-help boundaries. Preserve separate submission Under Review versus research In Review terminology; no academic decisions or official feedback generation. Links are local authored route constants, not request values.
- Isolation: Guide service's sole DB dependency is existing findUserById for authentication. No research queries, notification reads, Supabase, PDFs, signed URLs, provider calls, external fetches, credentials, logs, persisted transcripts or browser storage. No schema/migrations/dependencies/environment changes.
- Provider boundary: lib/ai/guide-provider.ts contains only a static availability notice. AI_GUIDE_ENABLED defaults off; even "true" returns static guidance pending provider approval and cannot invoke a provider. No Gemini/SDK/API-key configuration. No cost/rate-limit infrastructure needed while zero provider calls are possible; appropriate limits remain a future provider-enablement gate.
- Files created: app/dashboard/guide/page.tsx; app/dashboard/guide/ChatbotGuide.tsx; lib/constants/chatbot-guide.ts; types/chatbot-guide.ts; lib/validations/chatbot-guide.ts; lib/ai/guide-knowledge.ts; lib/ai/guide-provider.ts; lib/services/chatbot-guide.service.ts; lib/actions/chatbot-guide.action.ts; tests/phase8-chatbot-guide.unit.cjs; tests/phase8-chatbot-guide.browser.cjs.
- Existing files changed: app/dashboard/page.tsx (one role-filtered guide link); AGENTS.md; docs/MASTER_CONTEXT_UPDATED.md. Existing Phase 7 files/workflows and Phase 8.1 design preserved.
- Unit command: node --import tsx tests/phase8-chatbot-guide.unit.cjs PASS. Every role/topic allow/deny combination, active-role question lists and existing role-authorized routes; anonymous/Panel/unknown/inactive/stale/missing/invalid identity and safe DB failure; strict request/extra-field/injection rejection; no private user projection; page rendering with no input fields; disabled and accidentally enabled provider flag both static with zero fetches; dependency boundary blocks research/storage repositories.
- Browser command: node --import tsx tests/phase8-chatbot-guide.browser.cjs PASS. Focused Playwright Chromium against temporary production server http://127.0.0.1:3018, existing active local Admin/Adviser/Student/Panel users and existing JWT helper. All three allowed roles navigate Dashboard -> System Guide, select role-specific answers and canonical human-help/static AI-disabled fallback, then return to Dashboard. No cross-role question buttons or free-text fields. Panel has no entry link and direct guide access redirects to Dashboard; anonymous redirects to login; stale Student-as-Admin claim shows unavailable without Admin questions. No external browser requests, console/page errors or HTTP 5xx. Browser/server stopped; no fixtures, database/storage writes or account changes.
- Static checks: npm.cmd run lint PASS; npx.cmd tsc --noEmit PASS; npm.cmd run build PASS (installed Next.js 16.2.9, 23 generated pages, /dashboard/guide dynamic); git diff --check PASS. Installed Next.js Server Action documentation read before coding. Source review confirms facts and all authored navigation links correspond to current routes. No broad workflow regression repeated because research/auth implementation was unchanged.
- Limits/risks: Canonical text must be maintained as workflows change. This is an English static guide with a single current answer, not an AI chat implementation. Client can still display an already-returned static answer after account changes; future requests reauthorize and no private records are exposed. Inactive/missing accounts tested in isolation; browser denial covers Panel/anonymous/stale role only. No provider model/pricing/privacy/age claim was verified.
- Owner decisions needed: Before any provider work, approve eligibility for intended school-age users, provider privacy/retention terms, exact model and spending controls, plus shared usage-limit deployment. Do not interpret approval of this static phase as approval of Gemini.
- Exact next action: Owner reviews Phase 8.2 static foundation. Await explicit next-phase authorization; do not proceed to Phase 8.3, add providers, summarize documents, stage, commit or push. CI and Panel evaluation remain deferred.
- Progress document updated: Yes.

## Handoff - 2026-10-09 - Phase 8.3 Admin AI Report Interpretation Design

- Status: Design proposal COMPLETE; policy details/activation approvals pending. No application/provider implementation.
- Branch / starting and ending HEAD: feature/development, ca95fd3 (feat(admin): complete Phase 7 reporting). Existing Phase 8.1/8.2 edits and modified SOURCE_OF_TRUTH_UPDATED.md preserved; all changes remain unstaged/uncommitted.
- Deliverable: docs/PHASE8_3_ADMIN_AI_DESIGN.md. Verified existing overview/role/status/activity metrics; initial allowlist uses only four coarsened overview totals. Proposed k=5 suppression with published subset/complement checks, no role/status/activity payloads, no free-text input or tools.
- Eligibility/provider: Active database Admin plus independent institution-verified adult registry proposed; no existing adult verification exists. Groq API Free tier remains approved candidate only, disabled pending actual eligibility/privacy/model/quota/deployment approvals. Provider has no DB/storage access. No Student/Adviser feature changes.
- Files changed in this task: new docs/PHASE8_3_ADMIN_AI_DESIGN.md; AGENTS.md; docs/MASTER_CONTEXT_UPDATED.md only. No SOURCE_OF_TRUTH_UPDATED.md/application/schema/migration/dependency/credential edits.
- Validation: git diff --check PASS. Source inspection only; no lint, TypeScript, build, browser/unit tests or Groq requests in this documentation-only task.
- Risks/decisions: Small-count bands are not formal anonymization; repeated snapshots/outside knowledge may still infer changes. Adult verification governance, exact provider terms/model/free quotas, shared limiter/daily cache, egress restrictions and generated-answer fidelity unresolved. Separate live reporting reads require consistent-snapshot handling or safe withholding before future interpretation.
- Exact next action: Owner reviews/approves metric/privacy/eligibility/provider-control design. Follow the approved design-only sequence for Adviser scope only if explicitly requested; provider implementation/activation requires separate authorization. No staging/commit/push.

## Handoff - 2026-10-09 - Phase 8.4 Adviser AI Workflow Assistant Design

- Status: Design proposal complete; owner review/approvals pending. No application/provider implementation or activation.
- Branch / starting and ending HEAD: feature/development, ca95fd3 (feat(admin): complete Phase 7 reporting). All existing Phase 8 changes and modified Source of Truth preserved; unstaged/uncommitted.
- Deliverable: docs/PHASE8_4_ADVISER_AI_DESIGN.md. No existing Adviser aggregate API was found; proposed aggregate-only repository counts use existing owned submission-version rows/statuses, including archived owned groups, not invented latest-paper/backlog metrics.
- Allowlist/privacy: Total recorded versions plus Submitted and Under Review version counts, coarsened after k=5 distinct-contributor and distinct-paper guards plus complement/residual suppression. No raw listing, research/feedback/documents/identities or arbitrary filters sent to Groq. Small cohorts and procedural topics stay static with zero provider calls.
- Authorization/provider: Active session/database Adviser, SQL ownership scope and independent institutional adult verification before optional AI. Shared Phase 8.3 Groq isolation/disabled flags, combined deployment quotas and scoped daily cache proposed. Student guide and manual Adviser decisions untouched.
- Files changed in this task: new docs/PHASE8_4_ADVISER_AI_DESIGN.md; AGENTS.md; docs/MASTER_CONTEXT_UPDATED.md only.
- Validation: git diff --check PASS. No lint/build/unit/browser checks or live aggregate/provider requests; no schema/migration/dependency/credential changes.
- Risks/decisions: Version counts are not current-paper workload; small capstone cohorts may never qualify. Adult verification and cache invalidation absent today; combined limits/shared infrastructure, actual provider terms/model and residual inference/hallucination risk need owner approval.
- Exact next action: Owner reviews Phase 8.3/8.4 privacy, eligibility and metrics. Any Phase 8.5 integration/security work requires separate authorization; Groq activation remains gated. No staging/commit/push.

## Handoff - 2026-10-09 - Phase 8.5A Local AI Security and Aggregation Foundation

- Contributor: Codex. Status: LOCAL FOUNDATION COMPLETE and verified. Groq is hard-disabled and unimplemented; no live integration/activation performed.
- Branch / starting and ending HEAD: feature/development, ca95fd3 (feat(admin): complete Phase 7 reporting). Existing Phase 8.1-8.4 work, Student guide, owner-updated Source of Truth and all prior handoffs preserved. All changes remain unstaged/uncommitted.
- Authorization: getActiveAIAccount derives session identity, requires a positive safe ID, active database user and current matching Admin/Adviser role. No client identity/scope. Adult eligibility is a server-only fail-closed stub returning registry-unapproved for every account; no approved independent registry exists. Role, JWT, self-attestation and environment flags cannot grant eligibility.
- Local aggregation: Internal server-only preparation services authorize independently and recheck active account/role after reading. They produce only minimized DTOs or a null suppressed result; no Server Action exports these DTOs. Authorized local preparation is distinct from provider eligibility: it may read aggregates locally without adult approval, but client-facing overview actions stop at static fallback with zero aggregate/provider calls.
- Admin snapshot: Existing Phase 7 user/group/paper/status counts and publication eligibility reused in a repeatable-read, read-only transaction. Existing count helpers accept an optional select executor, defaulting to their existing db; reporting behavior unchanged. Approved-paper count is a local complement guard only.
- Adviser query: One aggregate-only SQL query joins the same existing submission/paper/group/user relationships and enforces researchGroups.adviserId = session-derived account ID. Counts total/Submitted/Under Review historical submission versions plus distinct-contributor/paper and complement/residual guards; includes archived owned groups. No raw names, titles, paths, feedback or records selected. No unscoped list filtering or new schema.
- Privacy: Strict Zod raw aggregate/DTO allowlists, fixed count bands, k=5 contributor AND paper guards, subset/complement and combined-residual suppression; Admin published-paper complement suppression. Counts 0-4 withheld; invalid/impossible counts fail safely. Client results contain canonical text only, never raw aggregates or DTOs.
- Provider separation: groq-provider.ts is a server-only availability stub with enabled=false/available=false; no SDK, credentials, fetch, environment enablement, DB/storage imports, tools or arbitrary URLs. No provider calls are possible. Existing guide provider stub preserved.
- UI/actions: Admin Reports has Explain report metrics; Adviser submissions has four predefined workflow buttons. Strict report/topic ID requests reject extra fields, client metrics, prompts, URLs, histories and forged ownership/adult claims. Each action verifies the current active role, then returns disabled/static or safe unavailable/unsupported guidance. No research decisions, feedback generation, writes or Student provider features.
- Added files: lib/auth/ai-authorization.ts; lib/auth/adult-eligibility.ts; lib/ai/groq-provider.ts; lib/ai/aggregate-policy.ts; lib/validations/ai-foundation.ts; lib/repositories/admin-ai-aggregate.repository.ts; lib/services/ai-aggregation.service.ts; lib/services/ai-foundation.service.ts; lib/actions/ai-foundation.action.ts; types/ai-foundation.ts; components/dashboard/local-ai-assistance.tsx; tests/phase8-local-ai.unit.cjs; tests/phase8-local-ai.acceptance.cjs; tests/phase8-local-ai.browser.cjs.
- Existing application files changed: app/dashboard/admin/reports/page.tsx; app/dashboard/adviser/submissions/page.tsx; lib/repositories/dashboard.repository.ts; lib/repositories/repository.repository.ts; lib/repositories/adviser-submission.repository.ts. Documentation changes this task: AGENTS.md; docs/MASTER_CONTEXT_UPDATED.md only. Design files and SOURCE_OF_TRUTH_UPDATED.md not edited.
- Focused unit command: node --import tsx tests/phase8-local-ai.unit.cjs PASS. Role matrix, stale/inactive/missing/anonymous/invalid account, session-derived ownership binding, strict injection/extra-field/forged ownership denial, DTO projection and bands, k=5 contributors/papers and complement/residual suppression, invalid counts, adult assertions/flags denied, zero provider calls and zero aggregate reads from UI actions.
- Read-only acceptance: node --import tsx tests/phase8-local-ai.acceptance.cjs PASS against guarded localhost/thesishs_ai. Every existing Adviser aggregate matches independent ownership/status SQL; empty owner scope returns zeros, invalid ID rejected; Admin snapshot matches independently queried Phase 7 metrics/publication eligibility. Counts-only projection checked. No fixtures, database/storage writes or account changes.
- Student guide regression: node --import tsx tests/phase8-chatbot-guide.unit.cjs PASS; existing role/topic/input/privacy/disabled-provider tests unchanged.
- Browser command: node --import tsx tests/phase8-local-ai.browser.cjs PASS. Focused Chromium against a temporary local production server on 3018, existing role accounts and JWT helper. Admin/Adviser panels visible, fixed buttons return static fallback and procedural guidance; guide role navigation/Student static answers and Panel/anonymous/stale denial preserved. No external browser requests, console/page errors or HTTP 5xx. Temporary server/browser stopped.
- Static checks: npm.cmd run lint PASS; npx.cmd tsc --noEmit PASS; npm.cmd run build PASS (Next.js 16.2.9, 23 generated pages); git diff --check PASS. Initial mechanical executor edit briefly affected countUsersByRole and was corrected before final TypeScript/build checks; its original behavior is preserved.
- Schema/migrations/dependencies/credentials: None created, changed or configured. No Groq requests or live-provider feature flags enabled. Test-process flags were used only to prove they cannot enable the stubs; no env-file change.
- Limits/risks: Count bands are not formal anonymization; version counts are not a latest-paper backlog. Conservative small cohorts may produce no DTO. Local snapshots are not cached or sent anywhere; current SQL ownership applies at read time. No adult registry, shared counters/daily snapshots, ownership-cache invalidation, provider fidelity/terms review or egress enforcement is implemented. These remain required before live use; do not reuse the local preparation service as a provider authorization gate.
- Exact next action: Owner reviews this local foundation and approves independent eligibility/privacy/provider/model/usage/deployment controls before separately authorizing further integration/security work. Groq stays disabled; do not proceed to live integration, stage, commit or push.
- Progress document updated: Yes.

## Handoff - 2026-10-09 - Phase 8.5B.1 Groq Provider and Deployment Readiness Audit

- Status: Audit complete; NOT READY for live activation. Deliverable: docs/PHASE8_5B_GROQ_READINESS.md. Phase 8.5A remains local/static with Groq hard-disabled.
- Branch / starting and ending HEAD: feature/development, ca95fd3 (feat(admin): complete Phase 7 reporting). All existing work preserved, unstaged/uncommitted; no staging or commit.
- Verified: Official Groq agreement requires 18+ and no input/output training without customer permission; documented retention exceptions, US retained-data location, ZDR controls, organization-wide Free quotas and paid-upgrade billing recorded with links. Public production Free candidates are gpt-oss-20b/120b; exact organization settings remain unverified. Service Specific Terms link redirects to website-only terms; applicability unresolved.
- Source audit: Active DB role/session checks, strict fixed IDs, owned aggregate queries, bands/complement suppression and static fallbacks present. Adult registry stub denies everyone; provider has no fetch/credentials/enable path. UI does not aggregate. Local aggregate preparation is not a provider eligibility gate; cohort ownership is checked at read time only.
- Blockers/owner decisions: Institution-controlled independent verification with expiry/revocation, actual terms/privacy/DPA/US transfer/ZDR/billing/model approval, shared atomic counters/daily snapshots and ownership invalidation, selected deployment/region/store cost and demonstrable outbound restrictions. No registry, limiter/cache or egress enforcement is implemented or deployment-verified. Suppression cannot eliminate outside-knowledge inference; generated fidelity/reasoning token accounting remains untested.
- Files changed this task: docs/PHASE8_5B_GROQ_READINESS.md (new), AGENTS.md and docs/MASTER_CONTEXT_UPDATED.md only. Source of Truth/designs/application/schema/dependencies/credentials untouched.
- Validation: git diff --check PASS. Read-only source/Git inspection and official public documentation browsing only. No lint, TypeScript, build, unit/browser/database tests or Groq API requests; Phase 8.5A passes are historical evidence, not rerun here.
- Exact next action: Owner reviews audit blockers and chooses eligibility/privacy/model/billing/shared infrastructure/egress controls. Await separately authorized implementation; preserve hard-disabled Groq and Student static guide. No staging/commit/push.

## Handoff - 2026-10-09 - Phase 8.5B.2A Groq Local Pilot Security Preparation

- Status: Documentation/test plan COMPLETE; no pilot implementation, execution or live activation. Deliverable: docs/PHASE8_5B2_LOCAL_PILOT_PLAN.md.
- Branch / starting and ending HEAD: feature/development at ca95fd3. All existing work preserved, unstaged/uncommitted; no staging or commit.
- Verified source: Active database role authorization, strict fixed IDs, ownership-scoped aggregate queries, k=5 bands/complements and static fallbacks remain present. Adult eligibility denies everyone; Groq hard-disabled regardless of flags. UI actions never aggregate. Internal local aggregation is not a provider gate; cohort changes require additional checks before future delivery.
- Proposed pilot: Standalone synthetic-only test harness, independent verifier-controlled signed tester approvals with <=24-hour expiry/revocation, literal boundary/complement/invalid fixtures, strict mock transport/output contracts and trapped outbound network. Application stubs remain unchanged. No fixture files, database seeds, keys, approvals or mock gateway created now.
- Limits/security: Proposed combined 3 attempts/tester/day, 10/local environment/day, 120-second cooldown and one active global/tester request; private restart-safe local ledger only for a single-process pilot. No sensitive logging; rollback terminates run/revokes approval and preserves static features. Local mechanisms do not satisfy Vercel shared limits/cache/registry/egress.
- Blockers: Actual independent tester approvals/governance absent; mock evidence not yet produced; provider terms/privacy/settings/model/token accounting and deployment controls unresolved. Schema validation alone cannot prove generated fidelity or eliminate inference/race risk.
- Files changed this task: docs/PHASE8_5B2_LOCAL_PILOT_PLAN.md (new), AGENTS.md and docs/MASTER_CONTEXT_UPDATED.md only. Source of Truth/designs/application/tests/schema/dependencies untouched.
- Validation: git diff --check PASS only; read-only source/Git inspection, no test/build/browser/database/provider requests. Existing Phase 8.5A test results are historical.
- Exact next approval: Owner approves this synthetic fixture/eligibility/mock plan and separately authorizes mock-only test preparation/execution. Live local testing and subsequent Vercel readiness/activation each require separate approvals. Groq remains disabled; no staging/commit/push.

## Handoff - 2026-10-09 - Phase 8.5B.2B Mock-Only Groq Integration Testing

- Status: MOCK-ONLY TESTING COMPLETE and verified. Application Groq/eligibility stubs remain unchanged and hard-disabled; no live integration or activation.
- Branch / starting and ending HEAD: feature/development at ca95fd3 (feat(admin): complete Phase 7 reporting). All pre-existing work preserved, unstaged/uncommitted. No staging/commit/push.
- Files added: tests/helpers/phase8-synthetic-fixtures.ts; tests/helpers/phase8-mock-groq.ts; tests/phase8-mock-groq.unit.cjs. Only existing files changed this task: AGENTS.md and docs/MASTER_CONTEXT_UPDATED.md. No application/design/Source of Truth/schema/migration/dependency changes.
- Fixtures: Fictitious two-Adviser ownership/version rows and counts only; distinct-union aggregation, every band boundary, k=4/5, repeated contributor/paper, overlapping contributors, subset/complement/combined residual suppression and inconsistent/invalid counts. No actual database, existing student records, storage, PDFs, seeds or cleanup mutations.
- Adapter: Test-only injected in-process transport with fixed model/endpoint metadata, strict existing minimized DTO plus nonempty serialized metrics, bounded envelope, strict bounded plain-text output, unique references restricted to supplied metrics, fake-timer 10-second abort and late-result discard. No default transport/fetch, credentials, SDK, flags or DB/storage clients. No application module imports the test adapter.
- Integration evidence: Real active-role authorization, static actions and local preparation run against synthetic session/user/aggregate repository doubles. Anonymous/inactive/stale/missing/invalid/cross-role/error denial, correct session-derived Adviser owner binding, foreign/empty scope, strict input/injection rejection and allowlisted payloads PASS. Actual repository SQL owner predicate checked in source; no real SQL/database acceptance executed in this phase.
- Adult/provider evidence: Real adult stub denies all accounts before aggregation/gateway in the default test orchestration. Synthetic injected eligibility alone exercises positive mock, expiry/revocation and response-time scope/eligibility rechecks; it does not create independent human approval or modify the application gate. All tested provider flags still leave application static/hard-disabled.
- Failure/limits evidence: 429/500/503/redirect, malformed/oversized/HTML/link/extra-field/unknown or duplicate metric output, empty/undefined metrics, timeout/late completion, procedural/all-withheld fallback PASS with no retry/raw errors. In-memory simulation enforces 3 account attempts/day, 10 global/day, 120-second cooldown, one active request globally/account, idempotent release, UTC reset and failures consuming attempts. Category-only test logs contain no payloads/identity. Fetch/HTTP/HTTPS/TCP/TLS traps observed ZERO outbound attempts in mock tests.
- Focused commands: node --import tsx tests/phase8-mock-groq.unit.cjs PASS; node --import tsx tests/phase8-local-ai.unit.cjs PASS; node --import tsx tests/phase8-chatbot-guide.unit.cjs PASS. Student role/topic/static-answer/private-dependency and zero-fetch regression preserved; no browser run using actual users.
- Static checks: npm.cmd run lint PASS; npx.cmd tsc --noEmit PASS; npm.cmd run build PASS (Next.js 16.2.9, 23 generated pages); git diff --check PASS. Focused ESLint and TypeScript repeated after the final undefined-metric/expiry assertions and passed. Installed Next.js use-server/testing guides read before coding.
- Limits/blockers: This is contract/security simulation, not a live Groq client, model-fidelity check, actual adult registry/signature verification, restart-safe pilot ledger, shared deployment limiter/cache or egress firewall. Schema/text checks cannot guarantee semantic accuracy or absence of prohibited advice. Actual SQL/ownership-change races, independent tester approval, terms/privacy/model/token accounting and Vercel shared infrastructure remain separately gated.
- Exact next action: Owner reviews mock evidence and resolves local-plan/readiness prerequisites before separately authorizing bounded synthetic-only live local testing. Do not configure credentials, enable provider flags or proceed to Vercel activation. Keep existing static features/workflows intact; no staging/commit/push.

## Handoff - 2026-10-09 - Phase 8.5B.3 Institutional AI Eligibility and Consent Design

- Status: Design COMPLETE; implementation/activation pending. Deliverable: docs/PHASE8_5B3_ELIGIBILITY_CONSENT_DESIGN.md. Branch/starting and ending HEAD: feature/development at ca95fd3; all existing changes unstaged/uncommitted, preserved.
- Verified: Public registration creates Students only; Admin Users has role/status management, no Admin creation UI. Existing user-management guard relies on session role, not current active DB authority. Schema has no eligibility/consent/designation records. Adult stub denies all; Groq remains hard-disabled; prior mock tests are historical, not rerun.
- Design: Pending/Eligible/Not Eligible dialog in existing management, independent designated active Admin verifier and self-approval denial, controlled external institutional bootstrap, persistent revocation/no automatic expiry; first-use unchecked versioned consent, decline/withdraw/reacceptance without affecting normal workflows. Existing role promotion can host popup; a new Admin creation flow requires scoped approval.
- Proposed minimal migration: Three additive tables for verifier designations, append-only eligibility decisions and consent events, user FKs/CHECKs/indexes, no grandfathered eligibility/consent or research/user-column changes. Missing entries fail closed. No migration generated/applied. Earlier registry/90-day proposals are superseded for this new design; historical pilot evidence retained.
- Ordering: active account -> current role -> institutional eligibility -> current consent -> ownership/privacy -> quotas -> isolated provider; response-time revision/scope rechecks and static fallback. Student static guidance/reports/manual workflows remain independent. Consent is not adulthood evidence or provider activation approval.
- Files changed this task: docs/PHASE8_5B3_ELIGIBILITY_CONSENT_DESIGN.md (new), AGENTS.md and docs/MASTER_CONTEXT_UPDATED.md only. Source of Truth left untouched because explicit permission to edit it was not supplied; stable changes recorded as task-approved requirements/design here.
- Validation: git diff --check PASS only. No application/schema/dependency edits, generated migrations, test/build/database/provider requests, credentials, staging or commits.
- Decisions/blockers: verifier/officer/operator governance and recovery, compromised-issuer remediation, exact certification criteria, record retention/erasure, terms/materiality/contact, schema constraints and absent Admin creation flow; Groq privacy/terms/model/quotas and Vercel security gates remain unresolved.
- Exact next approval: Owner reviews design and separately authorizes eligibility/consent implementation and additive migration preparation. Applying migrations and live integration/activation remain separately gated. Keep Groq hard-disabled and all existing work unstaged/uncommitted.

## Handoff - 2026-10-09 - Phase 8.5B.4A AI Eligibility and Consent Backend Foundation

- Status: BACKEND FOUNDATION implemented and checks PASS; NOT OPERATIONAL until separately approved migration application, PostgreSQL acceptance and independent verifier bootstrap. No UI or live provider integration.
- Branch / starting and ending HEAD: feature/development at ca95fd3 (feat(admin): complete Phase 7 reporting). Existing Phase 8/owner Source of Truth changes preserved; all work unstaged/uncommitted, no commit/push.
- Schema decision: Approved manual server configuration replaces the proposed designation table. Two append-only domain event tables are sufficient: ai_eligibility_events captures subject, decision/role/account-management revision, certifying verifier and configured authorization reference (or external bootstrap reference), timestamp and revoked flag; ai_consent_events captures subject, eligibility event binding, terms version/digest, accepted/declined/withdrawn and timestamp. Missing eligibility means Pending, missing consent means denied; no automatic expiry, birthdate, document upload or users/research table change.
- Verifier configuration: lib/auth/ai-verifier-config.ts reads only AI_INSTITUTIONAL_VERIFIERS_JSON server-side: JSON array of {userId,authorizationRef}; malformed/missing/duplicate/extra-field configuration denies all. Maximum 32 entries, positive integer IDs and bounded opaque authorization references. No configuration set in .env or deployment now; no returned/logged allowlist, verifier-management dashboard or web bootstrap endpoint. Certification requires configured active database Admin AND independently Eligible verifier; self-certification/reset/revocation denied.
- Backend: Strict actions delegate to Zod/services/repository. User rows locked in deterministic ID order; decision and any existing consent withdrawal append in one transaction. Expected revisions reject stale/concurrent/replayed mutations. Explicit Eligible/Not Eligible/Pending and revoked=true events preserved; no history update/delete API. Role/account-management updatedAt binding invalidates approval after account changes, including role-away-and-back/reactivation. Re-certification requires fresh consent. Existing auth/user/research workflows untouched.
- Consent: Server-owned ai-assistance-v1 text/digest; explicit literal acceptance=true and current version required, client identities/digests/timestamps rejected. Accept requires independently Eligible active Admin/Adviser. Decline/withdraw preserve ordinary access; withdrawal also works after eligibility or role loss for the active account. Latest event must be accepted with current version/digest and current eligibility-event ID. Material changes require a new immutable version and renewed acceptance; text needs institutional review before a future UI/live use.
- Authorization: Existing ai-authorization boundary adds getAIInterpretationAuthorization, delegating to locked active-account/current-role -> independent eligibility -> current consent checks. Returns internal revisions only. getAIProviderAccount always denies while Groq is hard-disabled, even with valid entitlement/flags. Existing local aggregation remains explicitly local, not a provider authorization gate; future optional interpretation must use this entitlement boundary before ownership/privacy/quotas and recheck revisions before delivery. Existing static actions short-circuit without registry queries; removed the outdated claim that all adults are unverified. Legacy no-account eligibility probe remains intentionally deny-only for compatibility and is not the persisted entitlement API.
- Added source: db/schema/ai-governance.ts; lib/auth/ai-verifier-config.ts; lib/auth/ai-entitlement.ts; lib/ai/consent-terms.ts; lib/validations/ai-governance.ts; lib/repositories/ai-governance.repository.ts; lib/services/ai-governance.service.ts; lib/actions/ai-governance.action.ts; tests/phase8-ai-governance.unit.cjs. Existing source changed: db/schema/index.ts; lib/auth/adult-eligibility.ts; lib/auth/ai-authorization.ts; lib/services/ai-foundation.service.ts. Documentation: AGENTS.md and docs/MASTER_CONTEXT_UPDATED.md only; Source of Truth/designs untouched.
- Migration generated and inspected: db/migrations/0010_ai_eligibility_consent.sql, meta/0010_snapshot.json and journal entry. SQL contains two CREATE TABLE statements, five restrictive FK additions on the new tables, CHECK constraints (including NULL-safe certification/self-approval rules), and two subject/event indexes. No existing table alterations, data backfill, destructive SQL, role changes or applied migrations. The journal file is generation metadata, not proof of database application.
- Focused commands: node --import tsx tests/phase8-ai-governance.unit.cjs PASS; node --import tsx tests/phase8-local-ai.unit.cjs PASS; node --import tsx tests/phase8-mock-groq.unit.cjs PASS; node --import tsx tests/phase8-chatbot-guide.unit.cjs PASS. New tests execute actual services/repository against a synthetic transactional persistence double: authority/self/role denial, Pending/revocation, missing/outdated/digest-mismatch/withdrawn consent, persistence/history, stale concurrent mutation, atomic rollback, explicit reacceptance, account-revision invalidation, safe errors and zero outbound/provider calls. Student static guide and k=5/input/mock regressions preserved. No actual SQL constraint/persistence/browser acceptance was run; no database accessed by tests.
- Verification: npm.cmd run lint PASS; npx.cmd tsc --noEmit PASS; npm.cmd run build PASS (Next.js 16.2.9, 23 generated pages); npx.cmd drizzle-kit check PASS; git diff --check PASS. Installed Next.js use-server guidance read. Initial new test-double decoding omitted nested SQL parameters and the SQL-review assertion mistook ON DELETE/UPDATE clauses for destructive statements; both test-only issues corrected before passing runs.
- Manual steps BEFORE operational use: (1) Review 0010 SQL and actual intended database schema/Drizzle ledger, including existing 0009 development-only status; approve a target/backup and migration plan separately. Apply only after explicit authorization, then run isolated PostgreSQL constraint/rollback/persistence acceptance. No migrate/push command executed here. (2) Independent institutional officer verifies initial active Admin outside the app; authorized operator records approval reference and, in a locked transaction, inserts an initial bootstrap eligibility event for that account with decision=Eligible, event_kind=bootstrap, decision_role_id=1, account_updated_at copied from users.updated_at, external_authority_ref=approved opaque reference, verifier_user_id/verifier_authorization_ref=NULL, revoked=false. Confirm no existing event before initial bootstrap; recovery/recertification requires separate audit and consent invalidation. Never self-attest or fabricate approval. (3) Operator configures the matching user ID/authorization reference only in secure non-NEXT_PUBLIC server environment, with institution-controlled change/revocation records; restart/redeploy affected instances to propagate config changes. Keep application API unable to designate verifiers. (4) Review/version consent text before future UI collection; users must explicitly accept for themselves. (5) Keep Groq hard-disabled; UI work, actual provider/privacy/model/quota approvals and Vercel shared controls remain separate gates.
- Limits/risks: Append-only is enforced by application repository/API design, not an immutable database-owner boundary; review runtime/operator DB grants and retention before deployment. No automatic designation revocation propagation across old deployment instances. Real PostgreSQL constraints/persistence untested because applying migrations is prohibited. Missing tables fail closed for governance/entitlement, while static assistance and normal account operations remain independent. No schema/dependency/credentials/provider activation beyond the generated unapplied schema migration; no new dependencies/SDK/keys.
- Exact next action: Owner reviews generated SQL/backend evidence and separately authorizes target-specific migration application plus independent bootstrap and real PostgreSQL acceptance. Do not proceed to UI, configure live Groq, apply migrations, stage, commit or push in this task.

### Phase 8.5B.4A.3 migration checkpoint (2026-10-09)
- Migration 0010 applied to development/test only; restorable pre-migration backup revalidated against source. Ledger through 0010 and new constraints/indexes/FKs verified read-only; event tables empty.
- Verification stopped on Result-versus-Array harness assertion after commit. Real PostgreSQL acceptance, Drizzle check, lint, TypeScript and build remain pending; no synthetic fixture writes or live provider work. git diff --check PASS. See latest docs/MASTER_CONTEXT_UPDATED.md handoff for exact evidence and resume steps.

### Phase 8.5B.4A.4 verification checkpoint (2026-10-09)
- COMPLETE: normalized driver Result rows in new tests/phase8-ai-governance.acceptance.cjs; real PostgreSQL services/constraints and rollback cleanup PASS. Fresh read-only check: zero eligibility events, consent events and synthetic users; ledger intact through 0010. Migration not reapplied.
- Focused governance/local aggregation/mock Groq/Student guide regressions, lint, TypeScript, build (23 pages), Drizzle check and diff check PASS. No application/schema changes, provider calls, persistent tester certification, staging or commits.
- Actual institutional bootstrap/configuration, consent review and deployment privilege/provider gates remain pending. See latest Master Context handoff. PostgreSQL sequence advancement on rollback is expected; no sequence reset performed.

### Phase 8.5B.4B UI checkpoint (2026-10-09)
- Admin Users now supports active-DB-Admin-only Admin/Adviser account creation and separate Pending-default eligibility modal; designated independently eligible verifiers only, explicit unchecked confirmation/self-approval prevention and revocation reuse backend actions.
- Admin/Adviser assistance includes first-use eligible consent modal, draft version ai-assistance-v2-draft, explicit acceptance/decline/withdrawal and nonblocking static fallback. No Student provider/governance changes, schema/dependency changes or Groq activity.
- Extended rollback-only PostgreSQL tests, synthetic Chromium popup tests, real read-only production route/Student static regression, focused units, lint, TypeScript, build (23 pages) and diff checks PASS. No real operational eligibility/consent recorded. See latest Master Context handoff for files/evidence and institutional/bootstrap/privacy/deployment blockers. No staging/commit.

## Handoff - 2026-10-09 - Minimal Disabled Groq Adapter

- Status: Adapter/mock verification COMPLETE; runtime provider remains hard-disabled. Added server-only fixed REST transport, internal guarded service and deny-only pilot reservation boundary; existing actions/UI and Student static guidance unchanged.
- Verification: five focused synthetic unit scripts, lint, TypeScript, production build (23 pages) and diff checks PASS. No live outbound attempts, credentials, dependencies, database changes, staging or commits. Existing work preserved; feature/development at ca95fd3.
- Limits/blockers: 3 attempts/account/UTC day, 10 combined/day, 120-second cooldown and one concurrent request remain the policy; test-only memory simulation is not operational protection. Reservation denies all attempts until a separately approved restart-safe atomic store exists. Configuration also returns unavailable regardless of flags. Institutional/bootstrap/consent/provider settings and synthetic-only pilot authorization remain outstanding; Vercel/live-data deployment is a separate gate. See latest MASTER_CONTEXT_UPDATED.md handoff for files and evidence.

## Handoff - 2026-10-09 - Minimal Persistent Groq Quota Ledger

- Implemented one PostgreSQL operational attempt table and atomic server-only reservation/release repository; UTC 3/user/day, 10 combined/day, 120-second per-user cooldown and one global active slot. Reservations commit before provider invocation; failed attempts remain charged. No in-memory fallback or automatic crash-slot expiry.
- Synthetic multi-instance/restart/UTC/cooldown/failure contracts and REST/static regressions PASS; lint, TypeScript, build, Drizzle and diff checks PASS. No live provider calls or database writes. Migration 0011 generated/reviewed only; existing work unstaged/uncommitted, HEAD ca95fd3 unchanged.
- Next: owner approves migration application and real PostgreSQL verification. Stale-slot recovery requires all affected workers stopped and provider requests ended; never clear by elapsed time alone. See Master Context for exact files, evidence and remaining consent/provider approvals. Groq remains hard-disabled.

## Handoff - 2026-10-09 - Migration 0011 Applied; Quota Acceptance Pending

- Migration 0011 ONLY applied via existing Drizzle migrator to confirmed localhost:5432/thesishs_ai after exact history/SQL and current restore-verified backup checks. 0010 not reapplied; ledger now has 12 matching entries. Quota table has expected PK/FK/CHECK, three NOT NULL constraints and four indexes, zero rows.
- STOPPED on external verification-helper constraint-count assertion before synthetic fixture writes/tests. PostgreSQL 18 includes NOT NULL constraints in pg_constraint; SQL/catalog state is expected. Read-only diagnosis recorded in Master Context. No quota acceptance, lint/TypeScript/build/Drizzle rerun claimed; diff check PASS.
- Next: correct metadata assertion and resume focused real PostgreSQL quotas/cleanup and remaining checks; never reapply 0011. Provider remains hard-disabled, HEAD ca95fd3 unchanged, prior work preserved unstaged/uncommitted.

## Handoff - 2026-10-09 - PostgreSQL Quota Verification Complete (Rollback Scope)

- Corrected external helper to validate named PK/FK/CHECK and separate PostgreSQL 18 NOT NULL constraints; helper is now verification-only. No migrator invocation, schema/application changes or credentials. Ledger remains 12 matching entries, required indexes intact, quota table empty before/after tests.
- Added tests/phase8-pilot-quota.acceptance.cjs: actual repository SQL on PostgreSQL/savepoints verifies limits, cooldown/UTC, cross-connection locking, module recreation, failure charging, abandoned-slot/count-preserving recovery, CHECK/FK/unique failures and missing-storage denial. All synthetic fixtures rolled back; every table/ledger/sequence fingerprint unchanged; zero provider calls. Rollback-only scope does not prove committed crash/physical restart durability.
- Focused quota/REST/governance/privacy/Student unit regressions, lint, TypeScript, build, Drizzle and diff checks PASS. Groq remains hard-disabled; next approvals/contact/consent/provider-account settings and limitations recorded in latest Master Context. HEAD ca95fd3 unchanged; no staging/commit.

## Handoff - 2026-10-09 - Secure Groq Key Loader and Synthetic CLI

- Both components implemented/mock-verified; application and local pilot remain hard-disabled. Key loader reads no secret while unauthorized. CLI accepts fixed topics only and exits at disabled gate before auth/database imports.
- Persistent approval-window cap uses existing PostgreSQL attempt rows: at most two total attempts including failures, >=120-second global pilot spacing, unchanged 3/user/day/10/day/global active-slot limits. No schema/migration/dependency change or database writes.
- Six focused synthetic unit scripts, disabled CLI checks, lint, TypeScript, build (23 pages) and diff checks PASS. No actual key/environment-file contents inspected or live provider calls; all existing work preserved unstaged/uncommitted, HEAD ca95fd3 unchanged.
- Institution/bootstrap/current non-draft consent and explicit live authorization remain pending. New approval-window SQL is mock-contract tested, not new real PostgreSQL acceptance. See Master Context for secure runtime configuration names and exact next action.

## Handoff - 2026-10-09 - Synthetic Pilot Quota PostgreSQL Verification
- PASS: migration 0011 already applied on localhost:5432/thesishs_ai; actual window SQL enforces two charged attempts, denied third, 120-second global spacing, UTC-window persistence, and normal 3/user/day plus 10/global/day limits.
- PASS: 16 independent connections and two fresh processes denied under the shared lock; recreated modules retain SQL counts. Rollback scope does not prove committed crash/restart durability.
- Cleanup: all synthetic account/attempt transactions rolled back; every public/drizzle table, ledger and sequence state unchanged. ZERO provider requests; no eligibility/bootstrap/application/schema changes.
- Validation: focused PostgreSQL synthetic-window acceptance, five relevant mock regressions, lint, TypeScript and diff checks PASS. Only existing quota acceptance helper and these handoffs changed. No build/broad audit repeated, staging or commit.
- Next: resolve institutional verifier/tester/non-draft consent approval, then separately approve bootstrap/configuration and up to two supervised synthetic attempts. Groq stays hard-disabled; detailed evidence/limitations in latest Master Context.

## Handoff - 2026-10-10 - Phase 9 Roadmap Definition (Proposal Only)
- Verified feature/development at ca95fd3; no original numbered Phase 9-11 found in available Markdown history. Existing UI polish/PWA-first requirements and recent owner-proposed sequence retained.
- Proposed Phase 9: shared presentation/navigation; responsive accessible critical screens and existing dialogs/forms; minimal online PWA manifest/icons/metadata and install/launch acceptance. Reuse installed stack/components, no new dashboard/dependencies/schema or private offline caching. Full sequence and scope approval status in latest Master Context.
- Phase 8 provisional closure remains pending: interrupted test-only mock browser edits preserved, Chromium acceptance not executed. Groq stays hard-disabled; live/institutional/Vercel requirements remain unfinished.
- Documentation/inspection only; AGENTS.md and Master Context updated, prior Source of Truth/browser work preserved. git diff --check PASS; no application changes, tests rerun, DB/provider activity, staging or commit in this task.
- Next approval: owner approves Phase 9 lean scope/branding/priority screens and separately authorizes its implementation. Roadmap definition does not authorize live AI or later proposed Phases 10/11.

## Handoff - 2026-10-10 - Phase 8 Provisional Static/Mock Closure

- Phase 8 provisionally complete for implemented static/mock-only scope: focused Chromium demonstration, seven security/mock unit scripts, read-only ownership SQL and rollback-only ordinary/two-attempt PostgreSQL quota acceptance PASS. Student canonical guidance is static; Admin/Adviser labeled mock interpretation uses fictional minimized bands and browser interception only. No operational Groq.
- Lint, TypeScript, network-enabled production build (23 pages), diff/changed untracked-file whitespace checks PASS. Sandbox build needed Google Fonts network access; stale browser free-text assertion corrected to exclude consent checkbox. Synthetic-only account selection enforced; no application changes.
- All quota fixtures rolled back; tables/ledger/sequences unchanged, zero outbound provider attempts and no real institutional certification/bootstrap. Existing work unstaged/uncommitted; feature/development at ca95fd3 unchanged. No migration, credentials, activation, staging or commit.
- Phase 9 UI/UX Refinement & PWA Integration is next, pending explicit approval of existing lean scope/branding/priority screens. Institutional approvals/final consent, live Groq integration/testing and Vercel activation remain unfinished. Detailed commands, mock-vs-operational boundary and limitations are in the latest Master Context handoff. Source of Truth unchanged by this task.

## Handoff - 2026-10-10 - Phase 8 Closure Commit and Phase 9 Decisions

- Owner-authorized single checkpoint: `feat(phase8): checkpoint provisional static and mock closure` on feature/development, predecessor ca95fd3. This handoff is part of that commit; use git log -1 --oneline for its actual hash and git status --short for post-commit cleanliness. No push/merge or Phase 9 implementation.
- Reviewed static role guide, Admin/Adviser static/mock assistance, governance/account UI/backend, disabled Groq REST/key/CLI foundations, suppression, persistent quotas, source tests and migrations 0010/0011 with additive snapshots. Earlier-module repository executor and account-management additions support Phase 8; documentation also retains earlier-phase reconciliation and the proposed Phase 9 handoff. No unrelated application edits identified.
- Tracked/proposed file inventory and redacted secret-pattern scan found no credentials, env files, dumps or generated synthetic artifacts. Fictional fixture generators and rollback/mock test source are intentional; no runtime approval records, tokens or generated outputs included.
- Prior provisional-closure Chromium/unit/SQL/lint/TypeScript/build evidence retained; only read-only Git/source/snapshot and whitespace checks performed for this commit task. No database operations, migrations, provider calls or new application changes. Historical phase8-ai-governance.acceptance.cjs expects an 11-entry ledger through 0010; align that harness with 0011 before any future rerun. It was not rerun here; current 12-entry quota verification is separately documented.
- Phase 9 implementation remains unapproved. Decisions needed: approve existing shared presentation/navigation, responsive accessible critical-screen and minimal online PWA scope; confirm branding/theme/logo and 192/512 icons; choose priority/order among the documented candidate screens. Live Groq/institutional/final-consent/Vercel gates remain unfinished and independent.
