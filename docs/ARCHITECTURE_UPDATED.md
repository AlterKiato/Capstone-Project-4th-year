# ThesiSHS AI --- Architecture Reference

**Purpose:** Technical reference for the current application's
architecture, module boundaries, data flow, and security model.

**Current Git checkpoint (2026-10-07):** `feature/development`, HEAD `5762e24` — `feat(phase5): complete Phase 5.2 submission integration`. Phase 5.1/5.2 are committed; Phase 5.3 source/tests and documentation remain uncommitted.

Phase 5.1, Phase 5.2, and Phase 5.3 are complete and runtime-accepted. Phase 5.3 completion/documentation audit is complete. No Phase 5.3 schema/migration change was needed or applied; `0009_repository_paper_unique.sql` remains unapplied. Phase 5.4 — Repository Publication is the next start-gated task. Do not start it, publication work, or CI until explicitly directed. CI remains deferred; do not commit/push or include unrelated untracked `.github/`.

------------------------------------------------------------------------

## 1. System Architecture

``` text
Browser / React UI
        ↓
Next.js App Router
        ↓
Server Actions
        ↓
Zod Validation
        ↓
Services
        ↓
Repositories
        ↓
Drizzle ORM
        ↓
PostgreSQL

                    ┌──────────────────────┐
                    │ Supabase Storage     │
                    │ private documents    │
                    └──────────▲───────────┘
                               │
                        Storage Service
```

### Core principle

The application uses a layered architecture:

``` text
Pages/UI
  → Server Actions
  → Validation
  → Services
  → Repositories
  → Drizzle ORM
  → PostgreSQL
```

Business logic and authorization belong in services. Repositories remain
focused on data access.

------------------------------------------------------------------------

## 2. Technology Stack

-   Next.js 16.2.9
-   React Server Components and Client Components
-   TypeScript
-   PostgreSQL
-   Drizzle ORM
-   Drizzle Kit
-   Zod
-   JWT authentication
-   Bcrypt password hashing
-   Supabase Storage
-   Playwright for browser acceptance testing

The project uses the Next.js App Router.

------------------------------------------------------------------------

## 3. Module Organization

### `app/`

Contains the Next.js routes and dashboard UI.

Current protected dashboard areas include:

``` text
app/dashboard/
├── admin/
├── adviser/
├── student/
└── repository/
```

Only functionality actually present in the current checkout should be
treated as implemented.

### `lib/auth/`

Authentication and authorization utilities.

Key responsibilities:

-   JWT creation and verification
-   Session cookie handling
-   Password hashing
-   Role constants
-   `requireAuth()`
-   `requireRole()`
-   authorization helpers

Role IDs:

``` text
ADMIN   = 1
ADVISER = 2
STUDENT = 3
PANEL   = 4
```

Panel exists as a role but is not actively implemented.

### `lib/services/`

Business logic and workflow orchestration.

Representative services include:

-   `auth.service.ts`
-   `student-research.service.ts`
-   `adviser-feedback.service.ts`
-   `adviser-review.service.ts`
-   `adviser-submission.service.ts`
-   `submission.service.ts`
-   `submission-document.service.ts`
-   `storage.service.ts`
-   `notification.service.ts`
-   `activity-log.service.ts`
-   `group.service.ts`
-   `group-member.services.ts`
-   `paper.service.ts`
-   `user.service.ts`
-   `research-group.services.ts`

A service should:

-   validate the caller's authority;
-   verify ownership/scope;
-   enforce workflow rules;
-   coordinate repositories and external services;
-   return controlled results.

### `lib/repositories/`

Thin database-access layer using Drizzle ORM.

Repositories should:

-   execute database queries;
-   return data;
-   perform query-specific transformations where necessary.

Repositories should not become the primary location for business
authorization rules.

### `lib/actions/`

Next.js Server Actions are the server entry points used by forms and
client interactions.

Typical pattern:

``` typescript
export async function someAction(formData: FormData) {
  const session = await requireRole([ROLE_IDS.STUDENT]);

  const parsed = someSchema.safeParse({
    // normalized input
  });

  if (!parsed.success) return;

  const result = await someService.someMethod(
    parsed.data,
    session.userId
  );

  if (!result.success) return;

  revalidatePath("/dashboard/...");
}
```

### `lib/validations/`

Zod schemas for input validation and normalization.

Validation should occur before business operations.

### `lib/constants/`

Shared workflow constants and enums, including submission and research
statuses, notification/action values, and other domain constants.

### `lib/supabase/`

Supabase integration.

The secret Supabase key is server-only.

------------------------------------------------------------------------

## 4. Authentication & Authorization

### Session lifecycle

``` text
Registration
   ↓
Validate input
   ↓
Bcrypt password hash
   ↓
Create user
   ↓
Login
   ↓
Verify password
   ↓
Create JWT
   ↓
HTTP-only secure cookie
   ↓
Authenticated request
   ↓
Verify JWT
   ↓
Role / ownership authorization
```

JWT lifetime is seven days.

### Authorization rule

UI restrictions are not authorization.

Server-side code must verify:

1.  authentication;
2.  required role;
3.  resource ownership/scope.

For example, an Adviser may review submissions only for research groups
belonging to that Adviser.

Typical behavior:

``` text
requireAuth()
    ↓
No session → /login

requireRole(...)
    ↓
Wrong role → /dashboard

Service ownership check
    ↓
Not permitted → controlled Unauthorized/Forbidden result
```

------------------------------------------------------------------------

## 5. Research Workflow Architecture

### Group and research relationship

``` text
Adviser
   ↓
Research Group
   ↓
Student Membership
   ↓
Research Paper
   ↓
Submission Versions
   ↓
Adviser Review / Feedback
```

Students do not self-join groups.

### Submission workflow

``` text
Student submits PDF
        ↓
Server Action
        ↓
Zod validation
        ↓
Submission service
        ├─ verify Student role
        ├─ verify group membership
        ├─ serialize eligibility/version allocation with a per-paper transaction-scoped advisory lock
        └─ upload document
        ↓
Submission repository
        ↓
Notification service
        ↓
Adviser notified
```

A later submission creates another version. Existing versions are
preserved.

The lock is held through upload and insert. The unique
`(paper_id, version)` constraint remains the final integrity backstop;
an insert failure triggers storage cleanup. Adviser feedback, the
conditional `Under Review` submission update, research status update,
and activity log insert commit in one transaction. Notifications are
attempted after commit and their failure does not fail the primary
operation.

### Adviser review workflow

``` text
Submitted
    ↓
Under Review
    ↓
┌──────────────────────┐
│                      │
▼                      ▼
Revision Required    Approved
│                      │
▼                      ▼
Student resubmits    Research approved
│
└──→ new submission version
```

The review workflow keeps submission and research status consistent.

Important verified Phase 4 behavior:

-   Adviser access is limited to own groups.
-   Adviser can start review.
-   Adviser can issue `Revision Required` or `Approved`.
-   Student receives decision notifications.
-   Adviser receives notification for new student submissions.
-   Activity logs record review decisions.
-   Version history remains preserved.
-   Cross-Adviser access isolation was verified.

------------------------------------------------------------------------

## 6. Document Storage Architecture

Research PDFs use a private Supabase Storage bucket:

``` text
research-submissions
```

Storage path pattern:

``` text
research/{paperId}/{version}/{sanitizedFileName}
```

Rules:

-   PDF only
-   Maximum size: 10 MB
-   Store the storage path in the database
-   Do not expose permanent public URLs
-   Generate temporary signed URLs server-side
-   Signed URL lifetime: 300 seconds / five minutes

### Upload flow

``` text
PDF submitted
   ↓
Validate type/size
   ↓
Sanitize filename
   ↓
Generate storage path
   ↓
Server-side Supabase upload
   ↓
Persist storage metadata
```

### Submitted-document access flow

```text
UI document button
→ lib/actions/storage.action.ts (authenticated role gate)
→ lib/validations/submission-document.ts (Zod ID validation)
→ lib/services/submission-document.service.ts
→ existing user/submission/paper/group/membership repositories
→ lib/services/storage.service.ts (server-only Supabase signer)
→ controlled URL or null
```

Submitted-document access requires an authenticated Student/Adviser session, positive submission ID validation, current active-account/database-role verification, Student group membership or Adviser group ownership, persisted submission/file metadata verification, and a storage path bound to the submission paper/version. Admin and Panel are denied under the submitted-document rules. Only the persisted path is passed to the existing server-only signer for 300 seconds in private bucket `research-submissions`; no client-supplied paper, path, version, identity, or role is trusted.

The service derives the role from the current active DB account, traverses submission → paper → group, and reuses the existing `createResearchDocumentSignedUrl` helper with `300`. Valid paths must match `research/{paperId}/{version}/{safePdfName}` exactly; public URLs, cross-paper/version paths, traversal, extra segments, and invalid/missing metadata are rejected before signing. Student and Adviser buttons navigate the current tab to the short-lived URL. Unexpected DB/storage failures return null and generic error messages, without raw SDK details.

Already issued signed URLs may remain usable until their 300-second expiry after authorization is revoked. Legacy/nonconforming paths outside the established naming convention are intentionally rejected; do not weaken validation. Full submission/review regression evidence is service-level; browser acceptance specifically covered document access. These are known limitations, not blockers.

------------------------------------------------------------------------

## 7. Database Architecture

-   PostgreSQL is the persistent data store.
-   Drizzle ORM is the application query layer.
-   Drizzle Kit manages migrations.
-   Schema definitions live under `db/schema/`.
-   Migration files live under `db/migrations/`.

Core entities include:

``` text
role
users
research_groups
group_members
research_papers
submissions
feedbacks
repositories
notifications
activity_logs
```

The exact schema, field definitions, relationships, constraints, and
migration state belong in `docs/DATABASE (1).md`.

Do not infer database state from application code alone.

------------------------------------------------------------------------

## 8. Error Handling

Expected business failures should be returned as controlled service
results.

Typical pattern:

``` typescript
return {
  success: false,
  message: "User not found",
};
```

Expected authorization failures should not expose sensitive reasons.

Examples:

-   unauthenticated → redirect to login;
-   wrong role → redirect to dashboard;
-   unauthorized resource operation → controlled failure.

### External service failures

Storage failures should return a user-safe failure result.

Notification failures are explicitly tolerated by the current design:

``` text
Primary operation
      ↓
Notification attempt
      ↓
Failure → log failure
      ↓
Primary operation remains successful
```

------------------------------------------------------------------------

## 9. Security Architecture

### Client

-   No secrets in client-accessible code.
-   UI restrictions are not security controls.

### Server

-   Server-side authorization
-   Ownership checks
-   Zod validation
-   Parameterized database queries through Drizzle
-   Server-only Supabase secret
-   Signed URLs for private documents

### Database

Important invariants are enforced with database constraints where
appropriate, including submission-version uniqueness.

### Secrets

Never commit:

``` text
JWT_SECRET
SUPABASE_SECRET_KEY
DATABASE_URL
```

Environment files remain outside source control.

------------------------------------------------------------------------

## 10. Performance and Data Access

-   Keep repository queries focused.
-   Avoid unnecessary N+1 queries.
-   Use SQL-level filtering/sorting/pagination where the feature
    requires it.
-   Use `revalidatePath()` after relevant mutations.
-   Do not proxy large private PDFs through application memory when a
    signed URL is appropriate.

------------------------------------------------------------------------

## 11. Testing Architecture

### Static/project checks

Relevant checks include:

``` bash
npm run lint
npx tsc --noEmit
npm run build
git diff --check
npx drizzle-kit check
```

### Browser acceptance

Playwright is the project's browser acceptance mechanism.

Phase 4 browser acceptance is part of the verified history. Phase 5.1
storage acceptance was runtime-verified separately. Phase 5.2 workflow,
concurrency, authorization, transaction, and notification-failure
acceptance was exercised through service-level runtime flows, not
browser-level acceptance. Do not describe the Phase 5.2 checks as
browser tests.

Phase 5.3 document access passed real Chromium Student/Adviser access and tampered/cross-group/anonymous/Admin/Panel denial. Runtime acceptance verified exact PDF bytes, real 300-second expiry, direct/public denial, process-local signing failure, service-level review/version regression, and independently checked cleanup. Detailed executed evidence is in `docs/MASTER_CONTEXT_UPDATED.md`.

### Test data

Acceptance data must be isolated from production data.

Never use real student/research data merely to make an automated test
pass.

------------------------------------------------------------------------

## 12. Implementation Rules for Agents

Before implementing:

1.  Read `docs/SOURCE_OF_TRUTH_UPDATED.md`.
2.  Read `docs/MASTER_CONTEXT_UPDATED.md`.
3.  Check Git branch, HEAD, and working tree.
4.  Read `docs/DATABASE (1).md` for database changes.
5.  Inspect the actual source files.
6.  Preserve existing architecture.
7.  Avoid unrelated refactors.
8.  Keep authorization server-side.
9.  Preserve submission history.
10. Inspect the current checkout; do not restore historical implementation blindly.
11. Do not claim browser/build/test success without evidence.
12. Do not commit unless the owner explicitly authorizes the commit.

------------------------------------------------------------------------

**End of Architecture Reference**
