# ThesiSHS AI --- Architecture Reference

**Purpose:** Technical reference for the current application's
architecture, module boundaries, data flow, and security model.

**Latest upload checkpoint (2026-10-23):** Phase 10.2C implementation and local preparation are complete for the approved scope; the historical File-bearing upload diagrams below are superseded. Local migration 0014 is APPLIED and verified; the development/test bucket is private, PDF-only and limited to exactly 10,485,760 bytes. Direct upload is IMPLEMENTED, pending live/hosted acceptance. Storage policy catalog audit and live signed-upload/document-access denial are NOT VERIFIED; no live or hosted upload acceptance has run. Verify anonymous denial and unrelated-path capability isolation before Preview testing, and finish the policy audit before production approval.

**Current-state pointer (2026-10-23):** Phase 10.2C closure on `feature/development`, parent `556dde189d5881fc32258ef8c68ad4842b7d93c3`; resolve the owner-authorized closure commit with `git log -1 --oneline`. See the [approved Master Context roadmap](MASTER_CONTEXT_UPDATED.md#approved-phase-10-roadmap-2026-10-22) for current gates. Authentication/security preparation, database/Admin foundations and direct-upload source exist; hosted readiness is unverified. Older phase-status paragraphs are historical and do not override this checkpoint. Preview and production are NOT DEPLOYED; native-Mobile/Electron integration remains deferred.

## Current deployment boundaries (2026-10-22)

| Component | Implemented boundary | Deployment/validation status |
|---|---|---|
| Client/application | Next.js App Router online-first PWA; UI -> Server Actions -> validation -> services -> repositories | Local application exists; Vercel Preview configuration/deployment pending; physical PWA acceptance unverified |
| Authentication | bcrypt passwords, signed JWT HTTP-only cookies, active database account/current role/ownership guards; shared PostgreSQL rate limiter | Local validation recorded; hosted origin/proxy/cookie/shared-limiter configuration requires review. Stage 1 email verification optional; real email deferred |
| Data | PostgreSQL and Drizzle; runtime/operator separation and guarded target mappings | Approved local test database inspected; Preview/production physical separation, credentials and connection contracts not established |
| PDF transfer | Browser -> exact signed private Supabase staging path; metadata/intent Server Actions; separate server-side bounded byte/signature/hash validation and finalization | Source implemented with isolated tests; local 0014 applied/verified and development bucket metadata configured; policy audit/live provider/CORS and hosted duration/memory acceptance pending |
| PDF access | Current role/group/publication authorization followed by short-lived private signed URL | Existing historical acceptance retained; issued links may outlive revocation until expiry |
| Environments | Preview uses synthetic data, separate database/Storage resources and secrets from production | Planned, not configured or deployed; Preview PASS cannot authorize production |

The active upload flow is detailed at the end of this reference; the older File-through-Server-Action diagram describes the legacy transport. Private staging/final objects are not public, and successful transfer alone does not create a completed academic submission. The bucket must be private, PDF-only and limited to exactly 10,485,760 bytes (10 MiB); server finalization independently validates the bytes. No privileged Supabase credential reaches the browser.

Preview preparation must establish runtime/connection/authentication/Storage/build readiness before separately approved deployment. Owner-led manual Preview acceptance follows deployment; necessary automated checks stay focused, sequential and bounded. Existing local fixture/browser tools remain available but optional/deferred. Extensive reliability/load validation may still be needed before production.

PWA remains primary for Web/Mobile-browser/Desktop. Expo requires a separately designed secured API/actor adapter over reusable services/repositories; browser Server Actions are not an assumed mobile API. Electron requires separate capability justification. Neither native client is integrated. Groq stays hard-disabled; no provider or mandatory verification is activated by this architecture.

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

Specialized Mobile/Desktop features remain design candidates. The professor's requirement does not itself select Electron or prohibit PWA. Evaluate Electron only if justified by separately approved desktop capabilities. Current browser JWT/HTTP-only-cookie/bcrypt authentication is implemented. Optional Stage 1 Student email verification is implemented locally; mandatory verification, real email and compatible future mobile API authentication remain deferred. See the latest Master Context for the approved Preview-first roadmap and separately recorded external audit risks.

------------------------------------------------------------------------

## 2. Technology Stack

-   Next.js 16.3.8 (verified package checkpoint)
-   React Server Components and Client Components
-   TypeScript
-   PostgreSQL
-   Drizzle ORM
-   Drizzle Kit
-   Zod
-   JWT authentication
-   Bcrypt password hashing
-   Supabase Storage
-   Owner-led manual acceptance; Playwright available for necessary focused, bounded sequential checks

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

The following diagram records the historical internal File service, retained for compatibility regression. The active public action is blocked and the Student interface now uses the Phase 10.2C.2 intent/finalization workflow below; its transactions do not hold locks during Storage transfers.

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

Historical transport only; superseded by the Phase 10.2C.2 architecture below.

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

## 2026-10-22 - Phase 10.2B database initialization boundary

Runtime `lib/db.ts` is server-only and validates explicit connection policy through `lib/db/config.ts` before constructing postgres-js. Local development/test retains its normal URL; hosted Preview/Production require approved distinct environment target mappings, matching endpoint/user, validated TLS, bounded pool/timeouts and explicit direct/session mode. Transaction pooling is refused; existing prepared statements, transactions and advisory-lock code are preserved. Physical isolation, aliases/provider routing and grants still need operator verification.

Privileged initialization is a separate Node command path, never a route, Server Action or startup/build/migration hook. `scripts/database-operator.ts` uses only dedicated operator credentials, checks live database/cluster identity and the complete source ledger, then requires a matching fingerprint and interactive terminal for writes. The service reuses account validation/bcrypt; its repository receives the verified database explicitly and enforces canonical roles and transaction/table-lock-backed single-Admin creation. It never imports the runtime database. Direct Drizzle Kit database commands are blocked; offline history/schema tooling remains. Supported migration replay is confined to a newly owned disposable database.

No authentication provider, JWT/cookie/limiter implementation, research rule, schema or private Storage integration changed. Future Expo can reuse existing backend services through a separately secured API; operator bootstrap/configuration are never mobile/client APIs. See Database/Master Context for configuration, command usage, real replay evidence and managed-provider/production-executor limitations.


## 2026-10-22 - Phase 10.2C.2 direct private PDF upload boundary

Historical C.2 implementation evidence: source replaces only the active Student upload transport. Migration 0014 was generated and unapplied during C.2; it was subsequently applied and verified under the separately approved local H checkpoint described above. This section's isolated validation is not live or hosted acceptance. Earlier File-through-Action diagrams and upload-held transaction descriptions are historical. The internal legacy service remains for compatibility regression; its public File action now authenticates and refuses upload.

Flow: Student dialog -> metadata-only submission-upload actions -> server-only service wiring -> upload workflow -> injected intent repository / bounded Storage adapter. Browser XMLHttpRequest sends the File directly to the exact private signed staging URL with the necessary publishable key, no application JWT or cookies. It reports transfer progress and best-effort cancellation. A separate Submit research click calls finalization with only the opaque intent UUID. Transfer success alone never refreshes academic history as a completed submission.

Initiation derives identity from the existing session/current-account guard, locks the account and paper scope, checks active Student/group/membership and current revision eligibility, validates strict metadata and durably creates the intent before minting. Per-Student account locking serializes quotas across papers. Limits are 15 minutes, two live per Student, one per Student/paper and ten new per rolling hour; failed capability issuance and cancelled rows still count. Request UUID retries freeze the initial metadata.

The Storage adapter uses installed storage-js 2.116.0 with an abort-aware fetch wrapper. Before capability issuance, it reads bucket settings and requires private research-submissions, an exact 10,485,760-byte limit and PDF-only MIME policy. It requires SUPABASE_PUBLISHABLE_KEY in modern publishable-key form; no env file was changed. The signed response must match the configured origin, exact staging route/path and sole token query. Only trusted provider-returned JWT expiry is decoded server-side (not a client assertion); it must be future and at most approximately two hours. The bound is committed before exposure. Capabilities are neither assumed single-use nor revocable; cancellation/expiry blocks server finalization, not an already-issued Storage capability.

Finalization uses Node runtime/maxDuration 60 at the active submissions page, a cooperative 55-second processing deadline, 20-second Storage request bounds and at most two expensive finalizations per process/workflow instance. SQL lock/statement bounds are three/five seconds. Actual provider metadata, response MIME/encoding/length when present and streamed bytes must agree with the declared nonzero size up to 10 MiB. A preallocated bounded buffer and actual byte counter enforce the limit; the existing %PDF- signature rule is retained. SHA-256 binds the validated bytes to a prepared final path before Storage writes. This is not full PDF parsing or malware scanning.

Short prepare/commit transactions share the existing per-paper advisory namespace. Account UPDATE lock -> group/membership SHARE locks -> existing submission SHARE locks -> paper SHARE lock -> intent UPDATE lock is used after the advisory lock. Submission-before-paper ordering matches Adviser decisions. No Storage I/O runs in those transactions. Authorization, expiry, latest version and immutable plan are checked again at commit; submission insert plus intent completion commit atomically, with existing paper/version uniqueness as backstop. Other research statuses and Adviser decision transactions are unchanged.

Final objects use research/<paper>/vN/<intent-id>-<safe-name>.pdf, compatible with existing document validators. Writes use upsert:false. An existing or uncertain write is reconciled by bounded read/size/hash; an uncertain DB acknowledgement triggers a fresh durable-state check. Completed retries return the original submission, never allocate another version, and never notify again. No final object is blindly removed after failure. A lost commit acknowledgement can omit the best-effort notification; no outbox or exactly-once delivery claim is made.

Status/renew/cancel remain self-only and reauthorize against current DB scope. The dialog keeps capabilities and Files only in memory; session storage retains only the opaque per-paper intent locator for explicit status/retry recovery. Pending/closed/error state never grants final-path access. Existing submitted/repository document access, publication and HTTP-only JWT authentication remain unchanged. Future secured APIs can reuse service/workflow boundaries with a separately approved actor adapter; these Server Actions are not a mobile API.

Cleanup is a separate operator command, read-only dry-run only, default maximum 25 intents and no public/scheduled hook. It verifies the complete 15-entry source ledger and target fingerprint, queries in a READ ONLY transaction, waits for max(intent expiry, recorded capability expiry)+10 minutes and protects committed references/canonical paths. Destructive execution is refused before configuration; provider late-upload behavior and a deletion recheck protocol require Phase 10.2C.3 acceptance. Tombstones are retained.

The 10 MiB boundary, installed SDK response handling and recovery races pass isolated doubles. Development bucket configuration metadata was subsequently verified in checkpoint I; actual Supabase CORS/raw PUT/publishable-key acceptance, expiry/non-overwrite semantics, real upload lock scheduling, pooled endpoint behavior and Vercel duration/memory remain unverified. DB pool waits, uncertain COMMIT and post-commit best-effort notification are not hard-cancel guarantees; the platform budget still needs measurement. See Master Context for exact files and checks. The fail-closed bucket/migration prerequisites are satisfied locally; this is not a live upload or hosted-readiness claim.


## 2026-10-23 - Phase 10.2D.2A hosted database boundary (implemented, not live-accepted)

The connection contract separates provider routing syntax from observed PG identity. Active hosted targets need independently approved database OID, native cluster or Supabase project ref, and distinct runtime/operator PG roles; all three environment mappings remain explicit. Future Production can be a strict non-connectable reservation without credentials. Same known physical identities or Supabase project refs cannot cross environments; distinct verified projects can share a session pooler address. `NODE_ENV=production` does not override the explicit Preview database stage.

`lib/db/identity.ts` verifies current/session role, database OID and available cluster evidence through authoritative catalogs, rejects elevated/member roles and runtime database/schema/object ownership or CREATE privileges, and implements only the documented canonical Supabase-route fallback when cluster access is unavailable. The owner must independently bind that route to the correct provider project first. `lib/db/guarded-client.ts` applies the checks lazily on the same transaction connection before hosted application SQL, preserving Drizzle row decoding, transaction settings, savepoints, prepared statements, advisory locks and single execution of pending queries. Imports/build do not connect. Local Development keeps its existing client path. Hosted TLS validation, bounds and transaction-pooling rejection remain; search path is fixed to pg_catalog/public.

The new operator-only Preview initializer pins the committed 0000-0014 source, refuses an existing application schema/ledger, and uses the supported Drizzle migrator under an outer transaction and bounded migration lock. Catalog/default/CHECK/index verification uses PostgreSQL's own canonical output from temporary probes. It checks full ledger, empty tables, sequences and a durable fingerprint; uncertainty stops after inspection without replay or destructive recovery. No public route, build/startup hook, role seed or account creation exists. Existing role/Admin commands retain explicit private-terminal confirmation and now distinguish the actual role from a pooler qualifier.

The exact metadata/CLI/privilege matrix and provider verification procedure are in the Database reference. No live database or provider settings were touched. Data API application-table isolation must be established separately before migration; the unused Data API is preferably disabled without changing Storage. Actual hosted identity/permissions/TLS/migration behavior, Preview configuration/deployment and direct-access security tests remain pending. JWT/bcrypt, shared auth limiter logic, research workflows/history, Storage, optional verification and hard-disabled Groq are unchanged.
