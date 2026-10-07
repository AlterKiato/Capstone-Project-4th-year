# ThesiSHS AI --- Source of Truth

**Last reviewed:** 2026-10-07\
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
5.  Enable future AI-assisted features for research/workflow guidance
    and document summarization

------------------------------------------------------------------------

## 1A. Platform Strategy

ThesiSHS AI follows a **PWA-first platform strategy**.

-   **Primary platform:** The system is developed and deployed as a
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
-   Sorting:
    -   Newest
    -   Oldest
    -   Title A--Z
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
-   **No AI features yet:** AI capabilities are planned but not
    considered implemented until built and verified.
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

## 11. AI Scope & Principles

### AI Scope

The two confirmed AI capabilities are:

1.  **AI Chatbot Guide** --- assists users with system/research workflow
    guidance and role-appropriate assistance.
2.  **AI Research Summarization** --- assists users by generating
    summaries of supported research material.

AI functionality is **assistive and human-supervised**.

AI must not:

-   make final academic decisions;
-   make final Adviser review decisions;
-   automatically approve or reject research;
-   replace human academic/review judgment.

AI features are planned and are not considered implemented until they
are built, tested, and explicitly verified.

------------------------------------------------------------------------

## 12. Long-Term Product Direction

The current core system is the foundation for the broader ThesiSHS AI
product.

Future development may include:

-   AI-assisted research workflow guidance
-   AI-assisted research summarization
-   Notification and communication enhancements
-   Web UI/UX refinement
-   Expanded administration and reporting
-   Security, performance, and production hardening
-   Comprehensive quality assurance
-   Production deployment and release preparation
-   Technical and user documentation
-   Thesis implementation and evaluation support

AI features remain assistive and human-supervised and must not replace
Adviser judgment or make final academic/review decisions.

The detailed implementation sequence and current completion status are
maintained in `docs/MASTER_CONTEXT_UPDATED.md`, not in this document.

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

**Current Git checkpoint (2026-10-07):** `feature/development`, HEAD `5762e24` — `feat(phase5): complete Phase 5.2 submission integration`. Phase 5.1/5.2 are committed; accepted Phase 5.3 changes and documentation are uncommitted.

This document defines the stable product, architecture, security, design, and long-term rules of ThesiSHS AI. It is **not** the authoritative record of current implementation progress. That role belongs to `docs/MASTER_CONTEXT_UPDATED.md`.

Phase 5.1 Document Storage Foundation, Phase 5.2 Submission ↔ Document Integration, and Phase 5.3 Secure Document Access are complete and runtime-accepted. Phase 5.3 completion/documentation audit is complete. Phase 5.2 and the Phase 5.3 full review regression were service-level; Phase 5.3 browser acceptance covered document access. No Phase 5.3 schema/migration change was needed or applied; `0009_repository_paper_unique.sql` remains unapplied. Phase 5.4 — Repository Publication is the next start-gated task. Do not start it, publication work, or CI until explicitly directed. CI remains deferred; do not commit/push or include unrelated untracked `.github/`. See `docs/MASTER_CONTEXT_UPDATED.md` for executed evidence and working-tree details.

If a target/design rule in this document conflicts with the actual current source code, schema, or migrations regarding what is implemented, inspect the repository and treat the actual checkout as implementation evidence. Do not silently interpret historical or target-state design as current functionality.
