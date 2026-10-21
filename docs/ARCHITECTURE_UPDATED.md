# ThesiSHS AI --- Architecture Reference

**Purpose:** Technical reference for the current application's
architecture, module boundaries, data flow, and security model.

**Current-state pointer (2026-10-21):** See `docs/MASTER_CONTEXT_UPDATED.md` for the verified `feature/development` / `6f02b7e` checkpoint, Phase 9 closure with documented limitations and proposed Phase 10 sequence. This technical reference does not establish production deployment, native-Mobile integration or Electron implementation. Older phase-status paragraphs below are historical and do not override that handoff.

**Historical Git checkpoint (2026-10-07):** `feature/development`, HEAD `70b8fb4` — `docs(phase5): close Phase 5.4 acceptance`. Phase 5.1/5.2 are committed; Phase 5.3 is committed; Phase 5.4 is committed locally; Phase 5.5 source/tests and handoff changes are uncommitted.

Phase 5.1, Phase 5.2, and Phase 5.3 are complete and runtime-accepted. Phase 5.3 completion/documentation audit is complete. No Phase 5.3 schema/migration change was needed or applied; `0009_repository_paper_unique.sql` was applied in Phase 5.4 to the designated development database after safety checks. Phase 5.4 — Repository Publication is complete and runtime-accepted (PASS; completion/documentation audit complete). Phase 5.5 — Repository Document Access is complete and runtime-accepted (PASS). Phase 5.6 — End-to-End Verification & Security Audit and Phase 5.7 — Documentation & Completion Audit are complete. **Phase 5 overall is complete.** Phase 6 — Search, Filtering & Discovery is next and requires explicit owner direction; it was not started in this pass. CI remains deferred. Do not commit or push.

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

### Existing client and proposed platform boundary (2026-10-21)

The implemented client is the Next.js Web application with an online-first PWA manifest, icons and installation guidance. Desktop initially uses this same PWA. Physical installation/standalone and production HTTPS acceptance remain unverified; no offline academic workflow or private-document cache is provided.

The separate Expo React Native repository `https://github.com/Genryux/thesishsai` is a candidate Mobile client only. Its ZIP-audit findings have not been verified against actual mobile source in this task. No mobile code is integrated here. Future integration would require a separately approved authenticated API entry layer, validation and existing services/repositories, sharing PostgreSQL and private Supabase Storage. Browser Server Actions are not an assumed Expo API contract. Mobile session validation, active-account/current-role/ownership checks and authorized temporary PDF access must be designed before integration; storing a token is not sufficient authorization.

Specialized Mobile/Desktop features remain design candidates. The professor's requirement does not itself select Electron or prohibit PWA. Evaluate Electron only if justified by separately approved desktop capabilities. Current browser JWT/HTTP-only-cookie/bcrypt authentication remains unchanged; Student email verification and compatible future mobile authentication are planned, not implemented. See the latest Master Context for the proposed Phase 10.0-10.4 sequence and external audit risks.

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

### Repository publication (Phase 5.4)

Admin UI uses controlled action results and pending buttons. Publication actions validate IDs/state with Zod and derive user identity from the authenticated session. `repository-publication.service.ts` rechecks the active database Admin account before lookup and under the transaction lock; Student/Adviser/Panel cannot publish. `repository-publication.repository.ts` locks the account in shared mode and the paper for update, resolves approved submission metadata and existing publication state, and performs only data access/writes.

The service checks approved paper/submission state, exact persisted paper/version path, and actual private-object existence using the existing server-side 300-second signer; that verification URL is discarded server-side. Paper locks serialize duplicate requests, and `repositories_paper_id_unique` enforces one row per paper. Already-published requests return a controlled result without changing timestamps/counters. Hidden entries reuse the same row on republication. No submissions/feedback/objects are copied, overwritten, or made public. Database/storage errors return generic failures. Publication remains separate from repository document authorization, which is now secured in Phase 5.5.

Known non-blocking publication risks: private-object verification holds the transaction during a network request; objects can be deleted after publication; repository records dynamically resolve the paper's approved submission rather than an immutable submission snapshot. These do not invalidate accepted Phase 5.4 requirements.

### Repository document access (Phase 5.5)

Existing View PDF / Download PDF controls call the authenticated Server Action. Zod strictly validates numeric paper IDs and view/download mode; the session user ID goes to the server-only repository-document service. It rechecks an active database account with the established Student, Adviser, Admin or Panel role, then resolves a published repository row joined to an approved paper and approved submission. The latest approved submission is selected by submitted timestamp and ID as a deterministic tie-breaker. The shared Phase 5.3 PDF path validator binds the persisted path to its paper/version before the existing private-storage signer generates a 300-second URL. Group ownership is irrelevant to published repository access; Phase 5.3 submitted-document ownership remains unchanged. No client path/version/submission identity is accepted. Storage/database failures return generic results. Successful download requests increment the existing download counter; publication state/timestamps and submission history are untouched. No signed URL is rendered in initial HTML. Unpublished records are denied. Issued URLs may remain usable until their 300-second expiry after account revocation or repository unpublication; strict legacy/nonconforming paths remain rejected.

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

Phase 5.6 practical final verification and Phase 5.7 documentation closure passed: upload -> revision -> v2 -> approval -> Admin publication -> authenticated repository listing/detail/view/download, basic security, preserved history and independent synthetic cleanup. Phase 5.1 through 5.7 and Phase 5 overall are complete. No schema/migration changes in this final pass; existing 0009 remains development/test-only. Known limitations remain: issued URLs last until expiry; objects may be removed after publication; strict nonconforming paths are rejected; approved-document resolution is dynamic. This is capstone-level validation, not enterprise production hardening. Phase 6 is next; CI remains deferred.
