# ThesiSHS AI --- Source of Truth

**Last reviewed:** 2026-10-21 (platform/transition reconciliation only)\
**Scope:** This document defines the stable architecture, product rules,
design decisions, constraints, and long-term direction for ThesiSHS AI.
Current implementation progress, testing evidence, blockers, and
immediate next actions belong in `docs/MASTER_CONTEXT_UPDATED.md`.

------------------------------------------------------------------------

## 1. Project Overview

**ThesiSHS AI** is a thesis/research evaluation and repository system
designed for Senior High School research groups. It provides a workflow
for managing research projects, student submissions, adviser feedback,
and a published repository of approved research.

### Target Users

-   **Admin:** System oversight, user management, group monitoring, and
    repository administration
-   **Adviser:** Create/manage research groups, manually assign/remove
    students, review submissions, provide feedback/decisions
-   **Student:** View their assigned group, create research projects,
    submit documents, receive and act on feedback
-   **Panel:** Role exists in the system but Panel Evaluation is **not
    actively developed** unless the roadmap is explicitly changed

### Project Goals

1.  Support the complete research project lifecycle: creation →
    submission → review → feedback → approval/revision
2.  Maintain research submission and feedback history without
    overwriting prior versions
3.  Provide role-based access control with strong authorization
    enforcement
4.  Offer a published repository of approved research accessible to
    authenticated users
5.  Provide limited adult-only AI interpretation of authorized aggregate
    administrative/workflow statistics, and a non-AI Student system guide

------------------------------------------------------------------------

## 1B. Capstone-Scale Development Principles (Owner Decision, 2026-10-09)

ThesiSHS AI is a college capstone deployment project. Prioritize a functional, secure, demonstrable system on the existing Next.js, PostgreSQL, Supabase and Vercel stack.

- Prefer free tiers, existing services, minimal dependencies and the smallest clear implementation within the current layered architecture.
- Avoid unnecessary dashboards, microservices, enterprise monitoring, elaborate infrastructure and excessive abstraction. Add infrastructure only for a demonstrated technical requirement; use the existing stack first.
- Keep Codex prompts, implementation, documentation and tests focused and token-efficient. Reuse verified work; do not repeat completed audits or introduce planning phases without an actual technical blocker.
- Test critical authorization, ownership/privacy, consent, database integrity, functionality and relevant regressions. Repeat or broaden checks only for changed code, failures or unresolved concerns.
- Capstone simplicity never relaxes active-account/current-role authorization, independent adult verification, explicit versioned consent, suppression, fixed-input/output validation, provider isolation or safe fallback. Student guidance remains static; AI never makes academic decisions.
- Separate a bounded local synthetic-data demonstration from deployment authorization. Local test evidence does not prove shared Vercel quotas, network controls or real-data readiness. Resolve genuine deployment blockers with the smallest feasible existing service, not a speculative enterprise platform.

Current model/terms findings, proposed limits, consent wording and approvals belong in Master Context; they do not constitute provider activation or completed deployment evidence.

------------------------------------------------------------------------
## 1A. Platform Strategy

ThesiSHS AI follows a **PWA-first platform strategy**. This remains the functioning Web/Desktop baseline; it is not evidence of production deployment or physical-device installation.

-   **Primary platform:** The system is developed for delivery as a
    Progressive Web App (PWA), providing the main experience across
    desktop and mobile devices.
-   **Mobile:** Mobile users should initially access ThesiSHS AI through
    the responsive PWA rather than through a separate native mobile
    application.
-   **Desktop:** Desktop users should initially use the PWA. A separate
    desktop application is deferred.
-   **Electron:** Electron may be considered in the future only if
    substantial desktop-specific requirements demonstrate capabilities
    that the PWA cannot reasonably provide.
-   **Push notifications:** Device push notifications may be added to
    the PWA in the future. Push notifications are not currently
    implemented; the current notification system is in-app only.
-   **Shared platform:** Any future client application must use the same
    underlying ThesiSHS AI backend, authorization rules, research data,
    submissions, repository records, and shared platform services rather
    than becoming a separate system.

**Platform direction clarification (owner, 2026-10-21):** The professor expects specialized or unique Mobile and Desktop functionality beyond the ordinary Web experience; no explicit PWA prohibition or Electron requirement was reported. Preserve the existing Next.js PWA while evaluating that requirement. The separate Expo React Native repository `https://github.com/Genryux/thesishsai` is a candidate standalone Mobile client, not an approved or integrated application. Desktop initially remains the PWA; specialized capabilities and Electron require separate justification and authorization. No platform-specific feature is approved by this direction alone.

Future clients must share the existing services, PostgreSQL, server-side authorization and private Supabase Storage. Expo cannot be assumed to reuse browser Server Actions directly: secured API contracts and compatible authentication must be designed and approved first. External mobile ZIP-audit findings are unverified against the actual mobile source; retain their provenance and integration risks in the Master Context. Do not attribute those findings to the Next.js application.

------------------------------------------------------------------------

## 2. Technology Stack

### Core Framework & Language

-   **Next.js:** 16.2.9 (App Router)
-   **React:** 19.2.4
-   **TypeScript:** 5.x
-   **Node.js:** Required by the Next.js application/runtime

### Backend & API

-   **Server Actions:** Next.js native server-side functions called from
    client components
-   **Zod:** Input validation and schema enforcement
-   **Jose:** JWT token generation and verification
-   **Bcrypt:** Password hashing

### Database

-   **PostgreSQL:** Primary database
-   **Drizzle ORM:** Query builder and database access
-   **Drizzle Kit:** Schema management and migration generation

### Storage

-   **Supabase Storage:** Private bucket-based document storage
    -   Bucket: `research-submissions` (private)
    -   Document format: PDF only
    -   Maximum file size: 10 MB
    -   Access method: Server-generated signed URLs with 300-second / five-minute expiry

### Frontend & Styling

-   **Tailwind CSS:** 4.x
-   **React Components:** Server and client components through the
    Next.js App Router

### Testing

-   **Playwright:** Browser automation and end-to-end acceptance testing

### Deployment

-   **Target:** Vercel
-   Production deployment must use secure production environment
    configuration.

------------------------------------------------------------------------

## 3. Application Architecture

### Layered Architecture

``` text
┌─────────────────────────────────┐
│  Pages / UI Components          │ React Server Components & Client
├─────────────────────────────────┤
│  Server Actions                 │ Direct server-side entry points
├─────────────────────────────────┤
│  Validation (Zod)               │ Input validation & normalization
├─────────────────────────────────┤
│  Services                       │ Business logic, authorization, workflows
├─────────────────────────────────┤
│  Repositories                   │ Database access through Drizzle ORM
├─────────────────────────────────┤
│  Drizzle ORM & PostgreSQL       │ Data persistence
└─────────────────────────────────┘
```

**Key principle:** Authorization is enforced **server-side** in
services. UI hiding is not access control.

### Core Modules

#### Authentication & Authorization

-   **Location:** `lib/auth/`
-   `jwt.ts`: Token creation and verification
-   `session.ts`: HTTP-only secure cookie management
-   `roles.ts`: Role ID constants and helpers
-   `authorization.ts`: `requireAuth()`, `requireRole()`, and
    access-control helpers
-   `hash.ts`: Password hashing utilities

#### Services

-   **Location:** `lib/services/`
-   Business logic, authorization, workflows, and domain rules are
    implemented here.

#### Repositories

-   **Location:** `lib/repositories/`
-   Thin data-access layer using Drizzle ORM.

#### Server Actions

-   **Location:** `lib/actions/`
-   Public async functions using `"use server"` and serving as
    server-side entry points for client interactions.

#### Validation

-   **Location:** `lib/validations/`
-   Zod schemas for input validation.

### Client-Side Pages & Routes

#### Authentication Routes

-   `app/(auth)/login/page.tsx`
-   `app/(auth)/register/page.tsx`
-   `app/page.tsx`

#### Protected Dashboard Routes

-   `app/dashboard/`
-   `app/dashboard/admin/`
-   `app/dashboard/adviser/`
-   `app/dashboard/student/`
-   `app/dashboard/repository/`

------------------------------------------------------------------------

## 4. User Roles & Permissions

### Role IDs

  -----------------------------------------------------------------------
  Role ID                 Role Name               Description
  ----------------------- ----------------------- -----------------------
  1                       Admin                   System administration,
                                                  oversight, and
                                                  repository management

  2                       Adviser                 Group
                                                  creation/management,
                                                  student assignment, and
                                                  submission review

  3                       Student                 Assigned-group research
                                                  creation and submission

  4                       Panel                   Defined in the system
                                                  but not actively
                                                  developed
  -----------------------------------------------------------------------

### Key Authorization Rules

#### Admin

-   View/manage users, groups, and research papers within administrative
    permissions
-   Publish/unpublish approved research
-   Access administrative oversight and reporting features

#### Adviser

-   Create groups
-   Add/remove students from own groups
-   Review submissions belonging to own groups
-   Provide feedback and review decisions

#### Student

-   Work within their assigned group
-   Create research projects
-   Submit documents
-   View feedback and review outcomes

#### Panel

-   Panel Evaluation is not implemented in the active development scope.

------------------------------------------------------------------------

## 5. Major Features & Workflows

### Authentication & Session Management

-   User registration and login with password hashing
-   JWT-based sessions
-   Seven-day session expiry
-   HTTP-only secure cookies
-   Role-based access control

### Research Group Management

-   Adviser creates groups with strand, section, and school year
    metadata
-   Adviser manages group membership by assigning/removing students
-   Students do not self-join groups
-   A student may have one active group membership

### Research Project Creation

-   Students create research projects within their assigned group
-   Research metadata includes title, abstract, category, and keywords
-   New research begins in Draft status

### Submission & Versioning

-   Students submit PDF documents
-   Submissions are versioned (`v1`, `v2`, `v3`, ...)
-   Previous submission history is preserved rather than overwritten
-   The database enforces unique `(paper_id, version)` values

### Adviser Review Workflow

-   Adviser starts a review, moving the submission into review status
-   Adviser provides feedback and a decision
-   Decision options are:
    -   **Revision Required**
    -   **Approved**
-   Related research/submission status is kept consistent with the
    review workflow
-   Students receive the resulting feedback/notification

### Notifications

-   Notifications are currently **in-app only**
-   Adviser is notified when a student submits a new version
-   Student is notified when an adviser makes a decision
-   Notification failure must not block the primary research operation;
    failures are logged/handled separately

### Activity Logging

-   Important adviser review decisions are recorded for audit purposes
-   Logged actions include approval and revision-required decisions

### Published Repository

-   Admin publishes approved research to the repository
-   Authenticated users can browse published research
-   Search fields:
    -   Title
    -   Abstract
    -   Keywords
-   Filters:
    -   Category
    -   School year
    -   Strand
-   Ordering: newest first only (owner-approved lean Phase 6, 2026-10-08)
-   Pagination: 10 results per page
-   Document access uses temporary server-generated signed URLs

### Repository Publication Rule

Only research that satisfies the project's approval/publication rules
may be published to the repository.

Repository publication does not replace the underlying research paper or
submission history. Repository records reference the approved research
rather than creating an independent copy of the research workflow.

------------------------------------------------------------------------

## 6. Database Design

### Core Tables

-   `users`: User accounts
-   `role`: Role definitions
-   `research_groups`: Groups created by advisers
-   `group_members`: Group membership
-   `research_papers`: Research projects
-   `submissions`: Versioned document submissions
-   `feedbacks`: Adviser feedback
-   `repositories`: Repository publication records
-   `notifications`: User notifications
-   `activity_logs`: Audit trail

### Important Constraints

-   Unique `(paper_id, version)` in submissions
-   Repository records are associated with a research paper and must not
    create a duplicate research workflow
-   Foreign-key constraints enforce referential integrity
-   One active group membership per student is a system rule

------------------------------------------------------------------------

## 7. Storage & Document Handling

### Supabase Storage

-   **Bucket:** `research-submissions` (private)
-   **Path pattern:** `research/{paperId}/{version}/{sanitizedFileName}`
-   **Format:** PDF only
-   **Maximum size:** 10 MB
-   **Access:** 300-second / five-minute server-generated signed URLs

### Upload Flow

1.  Validate the uploaded file as PDF and within the size limit
2.  Generate the storage path
3.  Upload through the server-side Supabase client
4.  Store the storage path in the submission record

### Submitted Document Access Flow

```text
Authenticated request
→ submission ID validation
→ active-account/database-role verification
→ Student membership or Adviser ownership authorization
→ persisted submission/file metadata verification
→ storage path bound to submission paper/version
→ server-side 300-second signed URL
```

Submitted-document access requires an authenticated Student/Adviser session, positive submission ID validation, current active-account/database-role verification, Student group membership or Adviser group ownership, persisted submission/file metadata verification, and a storage path bound to the submission paper/version. Admin and Panel are denied under the submitted-document rules. Only the persisted path is passed to the existing server-only signer for 300 seconds in private bucket `research-submissions`; no client-supplied paper, path, version, identity, or role is trusted.

Missing/invalid metadata, unauthorized access, and storage/database failures return controlled results without sensitive details. No permanent/public storage URL or credentials are exposed. The DB retains the storage path, not signed URLs. Published-repository access is a separate existing flow governed by publication eligibility; its rules do not grant submitted-document access to Admin/Panel.

Already issued signed URLs may remain usable until their 300-second expiry after authorization is revoked. Legacy/nonconforming paths outside the established naming convention are intentionally rejected; do not weaken validation. Full submission/review regression evidence is service-level; browser acceptance specifically covered document access. These are known limitations, not blockers.

------------------------------------------------------------------------

## 8. Important Architectural Decisions

1.  **Layered Architecture:** Maintain clear separation between
    pages/UI, actions, validation, services, repositories, and
    persistence.
2.  **Server-Side Authorization:** Authorization is enforced in
    server-side services; UI restrictions are not security boundaries.
3.  **Signed URLs:** Private research documents are accessed through
    temporary signed URLs rather than public storage URLs.
4.  **Version Preservation:** Research submission history is preserved
    and prior versions are not overwritten by later submissions.
5.  **Notification Failure Tolerance:** Notification failure does not
    block the primary operation.
6.  **Unique Version Constraint:** The database enforces unique
    submission versions per research paper.
7.  **Status Consistency:** Related submission and research statuses
    must remain consistent with the defined workflow.
8.  **Role-Based Navigation:** The interface may expose different
    navigation paths based on role, but authorization remains
    server-side.
9.  **PWA-First Delivery:** Web/PWA is the primary client experience
    across desktop and mobile. Separate native/mobile/desktop clients
    are deferred unless a later requirement justifies them.
10. **Shared Backend:** Future client experiences must use the same core
    backend, data model, authorization rules, and business services.

------------------------------------------------------------------------

## 9. Important Constraints & Non-Features

### Constraints

-   **Panel Evaluation:** Not implemented in the active scope.
-   **Self-service group joining:** Students are assigned to groups by
    advisers.
-   **One active group per student:** Students do not maintain multiple
    active group memberships.
-   **No email delivery:** Notifications are currently in-app only.
-   **AI deployment gate:** Adult-only Admin/Adviser AI is approved in scope
    but unimplemented and disabled pending eligibility, privacy, usage/cost
    and deployment approval. The Student guide is static and uses no provider.
-   **No separate mobile application currently:** Mobile access is
    provided through the PWA-first strategy.
-   **No separate desktop application currently:** Desktop access is
    provided through the PWA; Electron is deferred.

### Security Rules

-   Secrets such as JWT and Supabase credentials are server-only.
-   Passwords are hashed with Bcrypt.
-   JWT sessions expire after seven days.
-   HTTP-only secure cookies reduce exposure of session cookies to
    client-side JavaScript and help protect session credentials.
-   All authorization checks must occur server-side.
-   Private research documents must not be exposed through permanent
    public storage URLs.

------------------------------------------------------------------------

## 10. Deployment & Environment

### Required Environment Variables

``` text
NODE_ENV=production|development
DATABASE_URL=postgresql://...
JWT_SECRET=<secure-random-string>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SECRET_KEY=<secret-key>
```

### Commands

-   **Build:** `npm run build`
-   **Development:** `npm run dev`
-   **Production:** `npm start`
-   **Lint:** `npm run lint`
-   **Seed roles:** `npm run db:seed:roles`

### Test and Production Environment Separation

The database and storage environment used during development and
acceptance testing is a **test environment**.

-   Synthetic/test records must not be treated as production data.
-   Acceptance artifacts must not be assumed to represent real student
    data.
-   Production must use a separate clean production
    database/environment.
-   The development/test database must not simply be converted into the
    production database.
-   Production migrations and initialization must be evaluated
    independently against the production environment.
-   Test fixtures and acceptance-only data should remain isolated from
    production data.

------------------------------------------------------------------------

## 11. Phase 8 — Approved Role-Separated AI Scope (Owner Decision, 2026-10-09)

This section **supersedes** any earlier proposal for a generative **AI
Chatbot Guide**, optional AI explanations for Student topics, and **AI
Research Summarization**. Those generative feature proposals are retired,
not deferred implementation tasks. The completed Phase 8.2 static guide
foundation is retained. This is an approved **design/scope decision**,
not evidence that Groq integration is operational.

### Approved experiences

1. **Admin — AI Administrative Report Interpretation:** Groq may explain
   approved, minimized, non-identifying *aggregate* metrics already
   available from authorized administrative reporting. It may not view
   private research content or make administrative decisions.
2. **Adviser — AI Workflow Assistant:** Groq may explain permitted
   aggregate submission/review workflow counts for the authenticated
   Adviser's authorized scope and provide procedural guidance. It must
   not grade, approve/reject submissions, create official feedback, or
   replace human judgment.
3. **Student — Static Rule-Based Chatbot:** Predefined clickable topic IDs
   and reviewed answers only. No free-text prompts, AI provider calls,
   chat history submitted to AI, or external AI requests. Preserve the
   existing Phase 8.2 static guide; ensure role-filtered authorization.
4. **Panel:** No Phase 8 AI/guide entitlement unless separately approved.

### Provider and activation gate
- Fixed text-only model: `openai/gpt-oss-20b`; native server REST endpoint `https://api.groq.com/openai/v1/chat/completions`. No automatic model fallback, SDK, browsing or tools. Account settings/verification and pilot progress belong in Master Context; selecting this model does not authorize requests.
- Any future approved key loader must use dedicated server-only `GROQ_API_KEY` configuration, never `NEXT_PUBLIC_`, client code, payloads or logs. Codex must not inspect/request the key or environment-file contents. Current code remains hard-disabled; runtime key loading requires separate implementation authorization. No other credentials may be made available to the provider.

- **Selected provider:** Groq API **Free tier** for eligible adult Admin
  and Adviser features only. Groq is an approved *candidate deployment
  choice*, **not** authorization to activate it.
- Groq integration remains **disabled by default**, including in
  production, until the owner expressly approves the provider's
  applicable age/eligibility terms, privacy/data processing, quotas and
  cost exposure, and deployment controls. Do not claim the free tier's
  terms or allowances have been verified merely from this decision.
- Eligibility requires verified active account, approved role, and
  verified adult status. Role alone is **not** proof of age. Design and
  approve an appropriate eligibility mechanism before enabling AI.
- Static guidance and normal system operations must work when Groq is
  absent, unavailable, rate-limited, or disabled.

### Non-negotiable AI data/security boundaries

- AI/provider modules have **no direct** PostgreSQL, Supabase Storage,
  PDF, private research, signed-URL, credential, or arbitrary internet
  access. They must not receive database/storage clients, tools,
  function-call capabilities, browsing, or user-chosen URLs.
- A **separate trusted server-side authorization and aggregation layer**
  may access only appropriately scoped data, then construct a fixed,
  approved, minimized, non-identifying aggregate payload. This layer
  must independently validate session, active account, role, resource
  scope, and adult eligibility before any Groq call.
- Avoid identifiers, student names, paper titles/abstracts, PDF text,
  feedback text, signed URLs, secrets, raw records, and arbitrary user
  input in provider payloads. Small or identifying groups must be
  suppressed or withheld; set the exact privacy thresholds during design.
- Server-side allowlists, strict request validation, role isolation,
  safe output handling, request quotas/concurrency controls, and graceful
  fallback are required. Do not rely on prompt instructions as the
  primary security boundary.
- Only an explicitly approved Groq API endpoint may be used for provider
  traffic; arbitrary browsing/network egress must be restricted at the
  deployment level where supported. An application-level rule alone is
  **not** a network firewall. The app itself must still communicate with
  its backend and approved infrastructure for ordinary features.
- AI is supplementary and must never grade research, make final academic
  decisions, approve/reject submissions, or generate official Adviser
  feedback. AI outputs are explanatory, not authoritative.

### Decision longevity / change control

These are **durable owner-approved requirements**, not a request for
ongoing documentation churn. Do not revise this section for routine test
runs, wording tweaks, or provider experimentation. Change it only on an
explicit owner-approved change to stable scope, provider, privacy,
architecture, or security. Implementation evidence belongs in the Master
Context or actual repository, not in this section.

------------------------------------------------------------------------

## 12. Long-Term Product Direction

Owner-aligned direction (2026-10-21): retain Phase 8's static/mock-only boundary and hard-disabled Groq. Phase 9 **UI/UX Refinement & PWA Integration** moves to closure without further scope expansion; verified results and limitations belong in the Master Context. Phase 10 is proposed as **Deployment Preparation, Authentication Hardening, and Multi-Platform Feasibility**: 10.0 platform feasibility review, 10.1 Student email verification/authentication readiness, 10.2 production environment preparation, 10.3 Vercel deployment, and 10.4 deployment smoke testing. This is a working sequence subject to owner approval, not implementation or deployment authorization. Expo integration and desktop-specific/Electron implementation remain separately approved future work. Phase 11 **Final Testing, Evaluation & Documentation** retains final QA, user evaluation, capstone demonstration and documentation. The detailed roadmap and immediate next action belong in the Master Context.

Retain the PWA-first shared research lifecycle, repository, in-app
notifications, user-facing improvements, security, QA, release preparation,
and thesis evaluation support. Phase 8 consists only of the three approved
role-separated experiences described above; the original generative
student Chatbot Guide and AI Research Summarization are no longer planned.
The precise implementation sequence and verified completion state belong
in `docs/MASTER_CONTEXT_UPDATED.md`.

------------------------------------------------------------------------

## 13. Change-Control & Authority Rules

This document is the authoritative reference for **stable project
architecture, product rules, constraints, and durable design
decisions**.

When project information changes:

-   Update `docs/SOURCE_OF_TRUTH_UPDATED.md` when a stable architecture, product
    rule, security rule, or durable design decision changes.
-   Update `docs/MASTER_CONTEXT_UPDATED.md` for current phase status, completed work,
    blockers, testing evidence, commits, and immediate next actions.
-   Update `docs/ARCHITECTURE_UPDATED.md` for detailed technical architecture,
    component relationships, and data flows.
-   Update `docs/DATABASE (1).md` for schema, migrations, database-specific
    rules, and database state.
-   Update `README.md` when the documentation/handoff process itself
    changes.
-   Future coding agents should verify the actual repository/git state
    before implementing changes and must not infer missing requirements
    from the retired historical development chat.
-   Historical chat is supporting context only and is not required
    project state when the authoritative project documentation is
    available.
-   If two documents conflict, prefer the document responsible for that
    type of information and reconcile the conflict explicitly rather
    than silently choosing one.

------------------------------------------------------------------------

**End of Source of Truth**


---

## Current Implementation Boundary

This document defines stable product, architecture and security rules; current implementation evidence and historical tests belong in `docs/MASTER_CONTEXT_UPDATED.md`. Git inspection during the 2026-10-09 merge confirmed `feature/development` at `ca95fd3` (`feat(admin): complete Phase 7 reporting`), with Phase 8 edits unstaged/uncommitted. Application tests were not rerun. Phase 8.2 static-guide acceptance is recorded in the existing master handoff; revised adult-only AI scope is a design decision, not an implemented provider.

Inspect actual source/schema/migrations before making implementation claims. Stable rules alone do not prove functionality. Migration 0009 remains development/test-only; production migration state is unverified. CI remains deferred.

Publication requires an authenticated, active database Admin and validated identifiers. The service verifies approved research, an approved submission, its persisted paper/version path, and private object existence. A per-paper transaction row lock plus `UNIQUE (paper_id)` serialize requests and prevent duplicate rows; repeated publication preserves the original timestamp. All 14 Phase 5.4 cases and Chromium authorization coverage passed, including Student/Adviser/Panel/anonymous denial and safe database failure. The Student upload -> Adviser review -> Revision Required -> v2 -> Approved -> Admin publication regression passed with history and Phase 5.3 protections preserved. Synthetic database/storage fixtures were removed and independently checked. Detailed accepted evidence is recorded in `docs/MASTER_CONTEXT_UPDATED.md`.

Known non-blocking publication risks: storage verification holds the database transaction during a network request; an object can be deleted after publication; repository records dynamically resolve an approved submission. Production migration state is unverified.

Phase 5.5 repository document access is complete and runtime-accepted: authenticated active Student, Adviser, Admin and Panel accounts are permitted through database-account checks, published/approved database eligibility, shared strict persisted paper/version path validation, and existing server-only 300-second signing. Chromium view/download, exact PDF retrieval, failure/denial checks, Phase 5.3/5.4 regression, and independent cleanup passed. No schema/migration changes. Actual signed-token lifetime was exactly 300 seconds (exp - iat); Phase 5.5 did not repeat the full expiry wait already verified in Phase 5.3. Repository eligibility is independent of group ownership and does not weaken the separate Phase 5.3 Student/Adviser ownership rules. Unpublished research is denied. Issued URLs remain bearer access until expiry, including after unpublication; legacy path validation remains strict. See the latest Phase 5.5 handoff in `docs/MASTER_CONTEXT_UPDATED.md`.

Phase 5.6 practical final verification and Phase 5.7 documentation closure passed: upload -> revision -> v2 -> approval -> Admin publication -> authenticated repository listing/detail/view/download, basic security, preserved history and independent synthetic cleanup. Phase 5.1 through 5.7 and Phase 5 overall are complete. No schema/migration changes in this final pass; existing 0009 remains development/test-only. Known limitations remain: issued URLs last until expiry; objects may be removed after publication; strict nonconforming paths are rejected; approved-document resolution is dynamic. This is capstone-level validation, not enterprise production hardening. Phase 5 closure evidence is historical; the current next design target is in the Master Context. CI remains deferred.

------------------------------------------------------------------------

## 14. Planned Authentication and Account Management Improvements — Post-Phase 9.6

**Owner-approved design direction (2026-10-21): planned improvements, not implemented functionality.** Finish Phase 9.6 manual core workflow testing first. This plan supports a practical 3–5 week college capstone deployment using the existing PostgreSQL-based authentication architecture. Implementation requires a separate review and authorization; current registration/login behavior is unchanged by this decision. Preserve earlier decisions as historical context. Detailed implementation progress and test evidence belong in `docs/MASTER_CONTEXT_UPDATED.md`.

### A. Student registration

- Students may register with personal email addresses, including Gmail, Outlook, Yahoo or other valid providers. Institutional email addresses are also acceptable but are not required.
- Students continue to log in using email and password. The future implementation must require email ownership verification before permitting normal login.
- Prefer a time-limited, single-use email verification link. Do not implement email OTP and verification links simultaneously.
- Self-registration assigns the Student role only. After successful email verification, no additional Admin approval is required.
- Advisers remain responsible for assigning Students to research groups.
- Email verification proves mailbox ownership; it does not establish official enrollment status.

### B. Admin account management

- Preserve Admin-controlled creation of Admin and Adviser accounts. Each Admin and Adviser should use an individual email address under their control.
- Future improvement: invite Admin-created users to verify their email and establish their own password.
- Admin User Management should display registered email, email verification status and account status.
- Admins must not be able to view plaintext passwords, verification tokens or personal inbox content.
- A new Super Admin role requires separate owner approval.

### C. Authentication security

Preserve the existing PostgreSQL-based authentication architecture and server-side role protections. Future implementation must plan for:

- Secure verification-token hashing and storage, with single-use, expiring verification links.
- Reasonable verification resend and request limits.
- Duplicate-email handling and email-change re-verification.
- Secure transition of existing accounts when verification is introduced.
- Consistent enforcement in authentication services; UI-only restrictions are insufficient.
- Appropriate password recovery support and protection against unauthorized role assignment.

The exact schema, email delivery provider, token lifetime, rate limits, existing-account transition and recovery workflow require implementation review. This decision does not select those technical details.

### D. Deferred features

The following require separate owner approval:

- Google Sign-In.
- Migration to Supabase Auth.
- Multiple simultaneous verification methods.
- Enterprise SSO.
- A new Super Admin role.
- Unnecessary authentication redesign.

### E. Implementation sequence

1. Finish Phase 9.6 manual core workflow testing.
2. Review the existing authentication implementation and email delivery options.
3. Implement Student email verification as a focused feature.
4. Test registration, verification, login and existing research workflows.
5. Implement Admin/Adviser account invitations only if approved and practical before deployment.
6. Verify deployment readiness.

Phase 9.6 remains manual-first. Gate A.2 remains **FROZEN — OPTIONAL TEST SUPPORT TOOLING**; this plan does not authorize Gate A.2b-VII, fixture provisioning or account/database/Storage writes. Preserve existing fixture files and protections. Live account preparation and testing require separate authorization.


---

## 2026-10-21 - Superseding Phase 9.6 closure and fixture-tooling removal

Phase 9.6 is **PASS / CLOSED for the agreed owner-performed manual core-workflow acceptance scope**: the owner reports 11 PASS, 0 FAIL and no errors. Codex did not independently execute these steps. Production-load testing, hosted deployment verification and physical PWA installation are outside this result; detailed evidence and remaining deployment checks are recorded in the latest Master Context handoff.

The owner has discontinued Gate A.2. The abandoned `tests/fixtures/phase96/` provisioning framework, dedicated tests and supporting scripts are removed from the current codebase to keep the project within practical capstone scope. Earlier frozen-tooling and preserve-fixture instructions above are historical and superseded by this removal authorization; the utility is no longer available. Existing useful acceptance tests and shared lifecycle/navigation/server helpers remain. External protected enrollment state is left untouched and requires separate authorization for deletion. Do not rebuild or restart Gate A.2.

The approved authentication plan above remains preserved and unimplemented: Student personal-email registration with email/password; planned time-limited single-use verification links; no extra Admin approval after verification; Adviser-controlled group assignment; future Admin/Adviser invitations; deferred Google Sign-In; and existing PostgreSQL authentication. Student email verification is the next planned authentication improvement, requiring separate review and implementation authorization. This closure changes no authentication behavior, schema, database data or Storage objects.

## 2026-10-21 — Phase 10.1B.1 Student verification backend foundation

Owner-authorized Stage 1 backend implementation adds verification schema definitions, a generated **unapplied** migration, server-only request/explicit-confirmation services and a development/test delivery seam. This supersedes older statements that no verification code exists; it does not establish operational email delivery or mandatory verification. Detailed files, checks and limitations are in the latest Master Context handoff.

Registration still creates a Student session immediately. Existing/new Students and Admins/Advisers retain their current password-login behavior, active-account checks and authorization. No registration/login hook sends verification messages; no verification UI, route, mobile API, normal-session creation on confirmation, real sender or enforcement is implemented. Existing accounts are not backfilled as verified. Email ownership remains separate from active status, enrollment and AI eligibility/consent; Groq stays hard-disabled.

The approved policy for this foundation is a 60-minute opaque link, 60-second resend cooldown and five requests per account per rolling hour. Requests require a current authenticated active Student; confirmation requires the valid token and matching current active Student/email. Endpoint/IP abuse protection, link/referrer/log hygiene, delivery configuration, existing-account/session transition and any login enforcement must be reviewed before separately approved integration. No database migration was executed and no live account, membership, research history or Storage object was changed.


## 2026-10-21 ? Phase 10.1B.1 development database acceptance

The separately owner-authorized PostgreSQL acceptance supersedes the preceding UNAPPLIED status **for the verified local development/test database only**. Migration 0012 was applied once through Drizzle after local identity verification, exact 0000?0011 ledger reconciliation and explicit owner confirmation that the dataset contains no real Student data. Resulting schema/13-entry ledger and 15 focused PostgreSQL acceptance groups passed; run-owned synthetic records were cleaned and all pre-existing records preserved. See the latest Master Context for evidence and limits.

Stage 1 remains unchanged: no required verification, automatic sending, UI/route, production provider or normal session creation on confirmation. Existing accounts were not automatically verified. Production/staging migration and email delivery remain unverified. Phase 10.1B.2 requires separate owner approval.


## 2026-10-22 - Phase 10.1B.2 optional local verification experience

The separately authorized checkpoint adds Student-only status/request UI, explicit public confirmation and development-only Mailpit capture using the existing foundation. Registration/login remain unchanged and verification remains optional. Settings is the sole new Student navigation entry; no research access gate or automatic send/verification is introduced.

Generated links carry tokens in fragments, removed by the browser before explicit confirmation POST; GET never consumes a token and confirmation never creates a normal session. Current active-Student/database email checks and the existing cooldown/rolling quota remain authoritative. Production mutations and delivery are disabled even when the local flag is enabled. Process-local shared/account attempt limits are deliberately not represented as distributed/per-IP controls.

Real local HTTP/cookies/PostgreSQL/SMTP/Chromium and production refusal/cache-header checks passed; complete evidence, exact changed files and limits are in the latest Master Context. Production responses are no-store/no-referrer; installed Next.js overrides development page caching to no-cache/must-revalidate, explicitly documented. No new schema/migration, existing-record mutation, real email, mobile API, deployment or mandatory enforcement occurred. Production sender, durable abuse controls, existing-account/session transition/recovery and dependency advisories require owner review before activation.

## 2026-10-22 - Phase 10.1D.2 authentication hardening implementation

Verified `feature/development` / `2e49983d3f63b059401d943db5cf66af641efdec`; pre-existing D.1 dependency changes preserved. Shared PostgreSQL/HMAC attempt budgets now guard login/Student registration and optional local verification actions. Production cannot disable shared limiting or fall back to process-local counters; local development/test has an explicit pre-migration activation gate. Unknown ingress uses account/global budgets; source headers require a separately verified direct-Vercel contract. Shared authorization checks current active database accounts/roles; notification and published-repository services enforce their own authenticated scope. JWT claims and new-password UTF-8 limits are strengthened while preserving seven-day HS256 cookies, legacy bcrypt login, immediate Student registration sessions and optional verification.

Additive migration **0013_auth_rate_limit_buckets.sql is generated/reviewed, UNAPPLIED**. No database/Storage/email mutations, migration execution, environment changes, deployment or staging/commit/push. Focused mock/driver tests (74/74 reported checks), TypeScript, clean lint, build and Drizzle history check pass; actual PostgreSQL contention/constraints/expiry and hosted source verification remain pending. Exact files, thresholds, recovery, validation and limitations are in [the D.2 report](PHASE10_1D2_AUTH_HARDENING.md) and latest Master Context. This is not an internet-readiness claim. Next requires owner review and separately authorized isolated migration/runtime acceptance; production sender, mandatory verification, mobile infrastructure and Phase 10.2 remain outside scope.

## 2026-10-22 - Migration 0013 APPLIED locally; real limiter acceptance FAIL

The separately authorized acceptance reverified the same owner-approved isolated loopback PostgreSQL database/cluster, exact 0000-0012 ledger and sole pending additive migration. Drizzle applied only 0013 once; the resulting 14-entry ledger/schema and actual constraint failures passed. This supersedes UNAPPLIED above for the verified development/test database only.

Real admission uncovered a blocker: raw SQL Date parameters in `auth-rate-limit.repository.ts` cause postgres-js `ERR_INVALID_ARG_TYPE`; enabled limiting therefore denies valid attempts. No application correction is authorized by this acceptance checkpoint, so live acceptance stopped after independent cleanup. Proposed narrow fix is encoding/serializing the two timestamp parameters, followed by real-driver acceptance using `--accept-applied`. Migration must not be reapplied. Actual concurrency/retention/authentication/verification acceptance remains blocked; isolated regressions still pass 74/74. Existing schema/complete row fingerprints across all 14 original tables are unchanged, and no synthetic limiter records remain. See latest Master Context and [D.2 report](PHASE10_1D2_AUTH_HARDENING.md) for exact evidence/changed files. No production readiness, deployment, real email, mandatory verification, mobile integration or Phase 10.2 claim is made.

## 2026-10-22 - Phase 10.1D.2F real limiter acceptance PASS

The owner-authorized narrow fix supplies the existing Drizzle timestamp column encoders for the two raw INSERT parameters, preserving timezone semantics, atomic counters, HMAC identifiers, thresholds and fail-closed behavior. The real first-admission regression fails before correction and passes after it. No schema/migration/dependency/environment changes; 0013 remains applied only to the same verified isolated development/test database, with all 14 ledger entries matched and no migration rerun.

Final PostgreSQL acceptance **18/18 groups PASS** plus independent cleanup; isolated regressions **74/74 PASS**, TypeScript, targeted lint and Drizzle history check PASS. Real contention/rollback/window cleanup, synthetic authentication/authorization and optional verification now pass. Cookie/request/navigation and delivery boundaries remain synthetic; no new browser/SMTP claim. All pre-existing fingerprints/structure across the 14 original tables are unchanged; zero owned fixtures remain. The earlier blocker is resolved. Recommend owner closure review for **scoped Phase 10.1D PASS WITH DOCUMENTED LIMITATIONS**, retaining hosted ingress/configuration/secrets/dependency/sender gates and existing abuse/session limits. Exact files/evidence are in the latest [D.2F report](PHASE10_1D2_AUTH_HARDENING.md). No deployment, real email, mandatory verification, mobile APIs, commit/push or Phase 10.2.

## 2026-10-22 - Phase 10.2B database initialization foundation

Canonical role initialization now enforces explicit IDs **1 Admin / 2 Adviser / 3 Student / 4 Panel**, inserts only compatible missing rows and rejects conflicts without renaming/renumbering. Operator-only first-Admin bootstrap requires verified target identity/complete ledger, interactive hidden input, canonical roles and no existing Admin (inactive included); it reuses current validation and bcrypt12. No default credentials, public endpoint or automatic hook.

Runtime database connectivity is server-only with explicit hosted environment/target pinning, separate privileged operator credentials, validated TLS, bounded pool/timeouts and direct/session mode only. Hosted runtime refuses privileged Admin URL configuration. All three environment profiles must identify separate data; operator verification of real provider identity/routing/grants remains necessary. Direct Drizzle Kit database commands are blocked; future production migration execution requires a separately reviewed operator procedure.

New disposable PostgreSQL replay passed all 14 migrations/ledger entries, 15-table schema with 51 application constraints/26 indexes, role/sequence/concurrency/conflict and first-Admin/bcrypt acceptance. Run-owned databases were removed; independent checks found all existing development rows/schema/sequences/ledger unchanged. Focused isolated tests, TypeScript, targeted lint, Drizzle check and production build pass; exact evidence/files/operator usage are in latest Master Context and Database reference. Schema/migration/dependency/environment/auth/research/Storage source remains preserved.

Recommendation: **scoped Phase 10.2B PASS WITH DOCUMENTED LIMITATIONS**, awaiting owner review. Provider selection/permissions (including cluster inspection), physical isolation, least-privilege grants, TLS/pool/transaction compatibility, backup/restore and production migration procedure are unverified. Earlier upload/Storage/ingress/secrets gates remain. No production infrastructure, existing-record writes, real email, mandatory verification, Expo, deployment, staging, commit, push or automatic Phase 10.2C.
