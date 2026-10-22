# Phase 10.1D.2 - Shared authentication safeguards

Implementation checkpoint: 2026-10-22. Baseline: `feature/development`, HEAD `2e49983d3f63b059401d943db5cf66af641efdec`. The pre-existing Phase 10.1D.1 package/lock changes and auth test are retained. No deployment or database acceptance is implied by this implementation.

**Latest outcome - Phase 10.1D.2F (2026-10-22): timestamp binding corrected; real PostgreSQL acceptance PASS, 18/18 groups plus independent cleanup; isolated regressions PASS, 74/74 reported checks.** Migration 0013 remains applied only to the verified development/test database; no migration ran in D.2F. Earlier failed/pending sections retain historical evidence and are superseded by the D.2F handoff at the end. Recommend scoped Phase 10.1D closure with documented limitations; hosted ingress, deployment configuration/secrets, dependency advisories and production sender remain separate gates.

## Shared limiter and exact budgets

All new budgets use aligned **15-minute fixed windows**, calculated from PostgreSQL wall-clock time. Each admitted attempt counts, including successful login, duplicate registration, wrong passwords and later downstream failures. Counts are not reset on successful login. Separate HMAC namespaces identify operation and dimension.

| Operation | Normalized account | Trusted source | Global across instances |
| --- | ---: | ---: | ---: |
| Login | 10 | 300 | 1,200 |
| Student registration | 5 | 60 | 120 |
| Verification request/resend | 10 | 120 | 600 |
| Verification confirmation | None | 120 | 600 |

Login/registration account keys use trimmed lowercase email, without checking existence. Verification-request keys use the signed session user ID (anonymous attempts share a key); confirmation keys never contain the submitted token. All configured dimensions must admit the attempt. Source budgets accommodate multiple Students on a school NAT; they still need deployment-specific capacity review. These are request budgets, not guaranteed numbers of successful sign-ins or deliveries.

The repository starts one transaction, removes at most 64 expired rows with `SKIP LOCKED`, obtains database time, then conditionally upserts counters. `(key_digest, window_start)` is the primary key. `ON CONFLICT ... DO UPDATE ... WHERE hit_count < limit RETURNING` admits at most the configured count per bucket/window under PostgreSQL's conflict locking. Global is always consumed first; identity digests follow in stable lexical order. Denial commits preceding counts, so traffic denied by an account/source still consumes global capacity. Once global is full, arbitrary account/source values cannot allocate additional rows. Errors roll back and the service denies admission. SQL/lock behavior has driver-double coverage; actual PostgreSQL concurrency remains pending.

Buckets expire one hour after their window ends (75 minutes after window start). Expired rows are ignored for admission and deleted lazily; idle databases can retain expired digests until another attempt. Cleanup is bounded per request, not a wall-clock deletion guarantee. Successful-operation budgets bound identity-row allocation per window; storage constraints enforce digest format, positive counts and expiry order. No account FK, raw email, IP, password, token or research relation is stored.

Retry returns the same controlled message for throttling, invalid limiter configuration and limiter storage failure: wait up to 15 minutes and try again. There is no permanent account lock or password change. An exhausted account/source/global budget can affect legitimate users until the next boundary, and an active attacker can exhaust another window again. Existing read-only research authorization does not call this limiter. Logout remains available. An ordinary account database outage can still deny reads through current-account authorization.

## Activation and configuration

`NODE_ENV=development` or `test` defaults to existing local-only behavior: shared limiting is bypassed until explicitly enabled with `THESISHS_SHARED_AUTH_LIMITS=enabled`. This supports local registration/login before migration 0013. It is not an internet deployment configuration. Existing verification endpoint budgets remain supplementary local controls, and all verification actions still require their existing local Mailpit gate.

**Production, missing or unrecognized NODE_ENV always requires shared limiting.** The local opt-in variable cannot disable it. Missing table, configuration, request context or database availability fails closed before account lookup/bcrypt or verification delivery. There is no process-local production fallback. Building the app does not establish runtime limiter readiness.

Server-only configuration (do not put values in source, `NEXT_PUBLIC_` variables, logs or this document):

- `THESISHS_AUTH_LIMIT_SECRET`: independently generated high-entropy secret, at least 32 UTF-8 bytes. Use the same value across all instances; no fallback to `JWT_SECRET`. Rotation resets effective budgets and leaves previous digests for normal cleanup. Coordinate rotation rather than rotating per instance/request.
- `THESISHS_AUTH_LIMITS_JSON`: optional strict JSON overrides, maximum 4,096 characters. Operation names are `login`, `registration`, `verificationRequest`, `verificationConfirm`. Each allows `source` and `global`; all except confirmation also allow `account`. Counts must be integers 1..10,000, and each account/source count must not exceed the resulting global count. Example shape only: `{"login":{"account":10,"source":300,"global":1200}}`. Invalid selected limits deny authentication attempts.
- `THESISHS_AUTH_SOURCE_MODE=vercel-direct`: optional only after verifying the deployment ingress contract below. `VERCEL=1` is also required. Omit the mode for unknown/unverified ingress.

Next separately authorized checkpoint: inspect the intended isolated test database and ledger, apply only the pending migration after owner approval, test actual PostgreSQL contention/expiry/rollback and pre-migration failure, then validate production-mode configuration and trusted ingress before internet use. No migration, secret provisioning or deployment was performed here. An existing production runtime without the new table/secret will intentionally refuse login/registration; coordinate migration/configuration before activating this build.

## Trusted source contract

Default: ignore all forwarding headers and use account/global limits. Unknown sources are not mapped to a spoofable pseudo-source. Confirmation consequently uses global protection when source identity is unknown.

The optional Vercel mode accepts only one valid `x-vercel-forwarded-for` IPv4/IPv6 address, normalizes IPv6, rejects chains/ports/zone identifiers and ignores `x-forwarded-for`, `x-real-ip` and caller-selected form fields. It HMACs the source in memory before the repository receives it. Vercel documents overwritten forwarding headers for spoof protection and notes proxy caveats in its [request-header reference](https://vercel.com/docs/headers/request-headers).

This code cannot establish infrastructure provenance from header text. The mode assumes requests reach the app through a verified direct Vercel ingress that overwrites this header, with no alternate origin or untrusted proxy path. That contract has not been verified against a hosted deployment. Do not opt in merely because a request contains a Vercel-named header. For other hosts/proxies retain the documented fallback until a separately reviewed trusted-source adapter exists. Raw IPs are never passed to persistence or application logging by this limiter; platform access-log policy is outside this checkpoint.

## Authorization, JWT, passwords and enumeration

`getCurrentAccount` is an uncached server-only guard: validate the session, find its current account, require active status and an unchanged recognized database role. `requireAuth` and `requireRole` now use it. Deleted/deactivated/stale-role sessions redirect to login; legitimate users whose roles change sign in again. There is no verification requirement. Notification history/read/delete service boundaries additionally require the current recipient identity and preserve ownership checks. Repository listing/filter/detail/view-count service boundaries require an active current account in any existing repository role. Existing submission/review transaction locks, group ownership and private-document checks remain intact.

JWT verification retains HS256, the existing signing key and seven-day issuance. It requires `iat`/`exp`, safe finite nonnegative integer timestamps, expiration after issue time, no future issue time, user ID 1..2,147,483,647, numeric role 1..4 and a valid email string of at most 255 characters. Signature, expiration and claim failures return null. Normally issued existing tokens remain compatible; malformed legacy claims are intentionally rejected. No session registry, bearer/refresh tokens or issuer/audience migration was added. Clocks must be synchronized; no future-iat tolerance is introduced.

Student registration and the inherited managed Admin/Adviser creation schema now reject passwords over 72 UTF-8 bytes, preserving the eight-character minimum and confirmation check. Services validate new-password input before hashing. Repository inspection found no other existing password-setting flow. Nothing truncates new input silently or changes stored hashes. Login retains its previous 8..100-character validation and bcrypt comparison, including legacy passwords over 72 bytes. Such legacy hashes retain bcrypt's existing truncation behavior; no forced reset is introduced.

Wrong-password, nonexistent and inactive-account logins have the same public failure. Missing accounts perform one cost-12 dummy bcrypt comparison; inactive accounts also compare. Limiting precedes lookup and bcrypt. This reduces obvious timing differences, not constant-time end-to-end authentication. Duplicate registration and a unique-email race return the same generic failure; the existing unique email constraint remains the concurrency backstop. Immediate Student session creation on successful registration is preserved, so success/failure and hashing/database timing still allow some registration enumeration.

## Verification and remaining limits

Optional verification retains 60-minute tokens, SHA-256 digest persistence, single-use transactional confirmation, explicit confirmation POST, 60-second cooldown, five requests per rolling hour (including delivery failures), local synthetic-only Mailpit and production refusal. New shared checks run before request processing/delivery and confirmation token lookup. The previous process-local endpoint budgets remain local fast shedding only. Production verification and email delivery remain disabled. No automatic session is created by confirmation.

Fixed windows permit a boundary burst across adjacent windows. Shared NAT/global exhaustion can deny legitimate traffic. Attackers can still incur limiter database work, and global counter rows serialize authentication traffic; this is a small-school safeguard, not upstream DDoS protection or load certification. HMACs are pseudonymous identifiers, not anonymity if the secret is compromised. Retention is lazy. Deployment-specific logging, secrets, trusted ingress, database capacity and production sender decisions remain unverified. Existing signed document URLs can remain usable for their established 300-second lifetime after revocation; logout deletes only the local cookie, not stolen JWTs. Remaining D.1 dependency advisories are separate work. No internet-readiness certification is claimed.

## Validation evidence

- PASS: one focused `node --import tsx --test` run across the three new D.2 files and 12 relevant existing files reported **74 tests, 74 pass, 0 fail/skip**. Node includes parent test containers and standalone file checks in that count. The three D.2 files contain **25 named cases** (11 security/authorization, 8 limiter-boundary, 6 SQL-driver contracts), plus three parent tests. Existing coverage includes D.1 real bcrypt/JWT/actions/cookie behavior, B.1/B.2 optional verification, F1 submission/review and rollback, private submitted/repository documents, Student workspace, Adviser submissions, Admin reporting, notifications and managed-account boundaries. No browser/full-suite acceptance was run.
- PASS: `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- PASS: `npm.cmd run lint`, final run with zero warnings/errors. An earlier run reported one test-cleanup expression warning, corrected before the final run.
- PASS: `npm.cmd run build`, installed Next.js 16.3.8, compile/TypeScript and 25/25 generated pages. Authorized network access was used for existing Google Fonts; this is a build, not deployment/runtime acceptance.
- PASS: `node node_modules/drizzle-kit/bin.cjs check`. SQL/snapshot review confirms only the new table/index; removing that table and snapshot IDs leaves a structurally identical 0012 snapshot. Previous migration files are byte-preserved and the journal only appends 0013.
- PASS: `git diff --check` after source/documentation review; only Git's existing LF/CRLF conversion notices, no whitespace errors.
- Preservation check: SHA-256 comparison against the initial workspace confirms D.1 package/lock bytes, environment-file bytes and migrations through 0012 are unchanged. The D.1 test retains all five cases, with a current-account lookup double and matching database-role fixture added. Existing denial tests now expect rejection at the earlier shared guard and retain their no-write/no-storage assertions. No credentials/authentication payloads are logged by new controls; only HMAC digests reach limiter SQL.

Initial regression attempts failed because revoked/unsupported-role fixtures now redirect before reaching older service-result assertions. Fixtures/expected redirects were corrected without removing cases. A SQL-driver error assertion was corrected to inspect Drizzle's wrapped cause. The final focused run above passes.

All tests in this checkpoint use synthetic inputs and isolated doubles; bcrypt and JWT checks use the real libraries. SQL-double transactions simulate serialization/rollback and do not prove PostgreSQL scheduling. Real PostgreSQL migration/constraint/locking acceptance and deployed Vercel source verification remain pending. No database connection/record mutation, migration execution, private Storage operation, actual email, environment-file change, dependency install, staging, commit, push or deployment occurred. HEAD/index are unchanged. Phase 10.2 remains outside scope.

## Exact file manifest

Modified in D.2 (including compatibility adjustments to the pre-existing untracked D.1 test):

```text
db/migrations/meta/_journal.json
db/schema/index.ts
lib/actions/email-verification.action.ts
lib/auth/authorization.ts
lib/auth/jwt.ts
lib/services/auth.service.ts
lib/services/notification.service.ts
lib/services/repository.service.ts
lib/validations/auth.ts
tests/f1-research-mutations.unit.cjs
tests/phase5-document-access.unit.cjs
tests/phase5-repository-document.unit.cjs
tests/phase7-reporting.unit.cjs
tests/phase101d1-auth.unit.cjs
docs/DATABASE (1).md
docs/MASTER_CONTEXT_UPDATED.md
docs/SOURCE_OF_TRUTH_UPDATED.md
```

New in D.2:

```text
db/migrations/0013_auth_rate_limit_buckets.sql
db/migrations/meta/0013_snapshot.json
db/schema/auth-rate-limit.ts
lib/auth/auth-rate-limit-config.ts
lib/auth/current-account.ts
lib/auth/request-source.ts
lib/repositories/auth-rate-limit.repository.ts
lib/services/auth-rate-limit.service.ts
tests/phase101d2-auth-security.unit.cjs
tests/phase101d2-rate-limit-sql.unit.cjs
tests/phase101d2-rate-limit.unit.cjs
docs/PHASE10_1D2_AUTH_HARDENING.md
```

Pre-existing D.1 `package.json` and `package-lock.json` modifications remain byte-for-byte unchanged by D.2. Together these are the complete working-tree changes; all remain unstaged/uncommitted.

## 2026-10-22 - Migration 0013 / PostgreSQL acceptance: FAIL, stop for owner review

The manifest above describes the implementation checkpoint. This later acceptance adds `tests/phase101d2-auth.acceptance.cjs` and updates only this report, Master Context, Source of Truth and Database reference. No application/dependency/migration source is changed in acceptance. Git remains `feature/development` at `2e49983d3f63b059401d943db5cf66af641efdec`, empty index, existing work preserved and uncommitted.

### Isolation, preflight and migration (real PostgreSQL)

The configured target was reverified without printing credentials: loopback port 5432, database `thesishs_ai`, database OID 16387, cluster `7652422818440234372`, observed server address `::1/128`. It matches the previously owner-approved database containing only development/test data. All 10 accounts have explicit test/synthetic email/name markers; existing group/paper counts remain 12/18. The prior owner confirmation covers the research fixtures without explicit markers. Both independent connection pools match that identity; connection headroom passed. Environment file values were never printed or changed.

Source/live ledger hashes and timestamps matched all 13 entries through 0012; 0013 was the sole pending migration, and the limiter table was absent. SQL/snapshot review confirmed only CREATE TABLE/CREATE INDEX and no changes to existing objects. There were no unexpected public tables or triggers. Full-row count/fingerprints across all 14 existing public tables and their columns/constraints/indexes were captured before writes.

The enabled limiter was exercised against the genuinely missing table and returned false (fail closed). Drizzle then applied only reviewed `0013_auth_rate_limit_buckets.sql` once. The ledger now exactly matches all 14 source migrations, including hashes/timestamps. Migration 0012 was not reapplied. The limiter has four non-null fields with expected types, composite PK, three checks and two indexes (PK plus expiry). PostgreSQL 18 additionally catalogs four NOT NULL constraints. Existing columns/constraints/indexes and complete existing-row fingerprints match pre-migration values.

Real PostgreSQL violations passed: malformed digest, zero count and invalid expiry each produce `23514`; duplicate composite key produces `23505`. Invalid inserts roll back. The one valid, run-owned constraint fixture was removed after each attempt. No synthetic user, notification or verification fixture stage was reached.

### Confirmed application defect and proposed smallest correction

The first normal `allowAuthAttempt('login', syntheticIdentifier)` after migration returns false, although no budget is exhausted. The actual repository raises `ERR_INVALID_ARG_TYPE` from postgres-js while serializing a JavaScript Date parameter; the service catches it and correctly denies admission. `lib/repositories/auth-rate-limit.repository.ts` passes `windowStart` and `expiresAt` directly through untyped raw SQL interpolation in the INSERT VALUES clause. The SQL driver double accepts those values and therefore did not detect the real driver failure.

The runner records only whitelisted error codes and a Date-serialization category, never query text/parameters, raw error messages, credentials or tokens. The failure was reproduced using `--accept-applied` with cleanup; migration was not rerun. A prior runner assertion expecting only four total constraints was corrected to recognize PostgreSQL 18's four additional NOT NULL catalog entries. That was a test expectation issue, separate from the confirmed application defect.

Recommended owner-reviewed change, **not implemented**: serialize the two timestamp SQL parameters as ISO strings, or attach the corresponding Drizzle timestamp column encoders. The smallest proposed VALUES expression is:

```ts
values (${bucket.keyDigest}, ${windowStart.toISOString()}, ${expiresAt.toISOString()}, 1)
```

This preserves window/expiry calculations, parameterization, SQL conflict semantics, thresholds, secrets and schema. It needs a real-driver regression and rerun of this acceptance runner. Do not substitute a driver-double PASS or disable production limits. The current enabled/production limiter denies valid login/registration rather than admitting them; local development/test defaults still leave shared limiting off. No environment or production configuration was changed.

### Executed results versus blocked coverage

- Real evidence across attempts: identity/ledger/additive preflight PASS; actual pre-migration fail-closed PASS; migration/14-entry ledger/schema preservation PASS; actual constraint violations PASS; independent cleanup/preservation PASS after every attempt.
- Final diagnostic run: **3 named groups PASS, 1 group FAIL, 13 later groups not run**, plus separate independent cleanup PASS. The pre-migration fail-closed group passed only on the first attempt while the table was genuinely absent; it is intentionally omitted on applied-schema reruns.
- Default configuration values matched the documented account/source/global limits, but valid real admission failed before counter creation. Successful increments, threshold exhaustion and HMAC persistence through a successful application upsert are not accepted.
- Real multi-connection limiter contention, counter rollback injection, window rollover/retention cleanup, PostgreSQL-backed login/registration/current-account/notification/repository checks, isolated limiter-outage research-read checks and real verification regression are **blocked/not run** after this failure. No capacity or internet-readiness claim is made.
- Fresh isolated regression run: **74/74 reported checks PASS, zero failures/skips**, including real bcrypt/JWT with mocked account/request/delivery boundaries and SQL driver doubles. This covers login/registration, JWT/password policy, current-account/notification/repository authorization, optional verification and research/private-document regressions only at their existing isolated-test scope; it does not contradict the PostgreSQL failure.
- Fresh TypeScript (`tsc --noEmit --incremental false`), runner syntax, targeted runner ESLint and Drizzle history check PASS. Production build was not repeated: application code is unchanged from its prior passing build. Final diff/preservation check accompanies this handoff.

### Cleanup and owner-review boundary

Each attempt used an unguessable run marker and independent ephemeral HMAC secret, tracked exact intended emails/IDs and bucket digests, and finished synthetic-only cleanup. An independent database connection confirmed no owned users/notifications/verification requests and zero limiter rows, and matched all 14 complete pre-existing table fingerprints plus original structure. No existing account/password/role, group, research paper/submission/feedback, repository counter, notification/history or verification record was modified. No Storage, SMTP, real email, production configuration, mandatory verification or Phase 10.2 work occurred. Migration 0013 and its ledger entry intentionally remain applied; no reset/rollback/reapplication.

Next checkpoint requires owner review of the narrow application timestamp-encoding correction. After approval, fix that expression, add/check a real-driver regression and rerun `node --import tsx tests/phase101d2-auth.acceptance.cjs --confirmed-test-data --accept-applied`. Do not use the migration-application mode to reapply 0013. Hosted source trust, deployment secrets/configuration, remaining dependency advisories and production sender decisions remain separate unverified gates. Nothing was staged, committed, pushed or deployed.

## 2026-10-22 - Phase 10.1D.2F timestamp correction and PostgreSQL acceptance PASS

### Baseline, exact correction and regression

Verified `feature/development`, HEAD `2e49983d3f63b059401d943db5cf66af641efdec`, empty index and the expected 32 changed/untracked D.1/D.2 files. All existing work is retained. The owner explicitly authorized the narrow timestamp correction and applied-schema acceptance; no authentication redesign or other application correction was made.

The raw limiter INSERT interpolated `Date` objects without a column encoder. In this binding context postgres-js rejects them with `ERR_INVALID_ARG_TYPE`, and the service denies otherwise valid attempts. Both live columns are non-null `timestamp with time zone`. Inspection of installed Drizzle's `PgTimestamp.mapToDriverValue` confirms ISO UTC encoding. The only application change attaches each existing column encoder through `sql.param`:

```ts
values (${bucket.keyDigest}, ${sql.param(windowStart, buckets.windowStart)}, ${sql.param(expiresAt, buckets.expiresAt)}, 1)
```

All values remain SQL parameters. Window calculation, 75-minute bucket lifetime, conditional conflict update, transaction/lock order, HMACs, budgets, local activation gate and production fail-closed policy are unchanged. No migration/schema/dependency/environment file changed.

A named real PostgreSQL regression was added before the previously failing threshold group. With the original application code it reproduced the Date-binding error: three preceding groups PASS, timestamp regression FAIL, cleanup PASS. With the encoder correction the first legitimate admission succeeds and an independent pool reads all three expected HMAC buckets at count 1, aligned UTC window starts, valid future expirations exactly 4,500,000 ms after window start; the second admission increments all three to 2. The SQL driver double additionally asserts that compiled timestamp parameters are ISO UTC strings, preventing it from silently accepting bare Dates again.

### Real PostgreSQL acceptance and evidence boundaries

Command: `node --import tsx tests/phase101d2-auth.acceptance.cjs --confirmed-test-data --accept-applied`.

Final result: **18 named groups PASS, 0 FAIL**, plus separate independent cleanup PASS. `migrated0013:false`, no failure/cleanup error, zero real emails. The missing-table pre-migration case is intentionally not executed against an applied schema and is not counted as a new PASS. Its previous evidence is historical. Application repositories, transactions, bcrypt, JWT and session functions are real; Next request/cookie/navigation surfaces and delivery are in-memory boundaries, so this is not a fresh HTTP/browser/SMTP acceptance claim.

- Isolation/ledger/schema: same owner-approved loopback `thesishs_ai`, port 5432, OID 16387, cluster `7652422818440234372`, server `::1/128`; 10 pre-existing test-marked accounts. Both pools match. All 14 ledger hashes/timestamps through 0013 match source, no migration pending. Four columns/types, composite PK, three checks, four PostgreSQL 18 NOT NULL catalog entries and both indexes verified. Actual constraint violation/rollback groups pass. `--accept-applied` now requires all 14 entries during preflight. No migrate/push/generation/reapplication occurred.
- Persistence/policy: first admission and actual increments pass; default limits are unchanged and configuration-verified. Default account limits are exercised, with smaller ephemeral source/global overrides used to verify all four operations without unnecessary load. Normalized accounts, source/global dimensions and operation namespaces stay independent; unknown source uses the documented global/account fallback.
- Contention/atomicity: 20 simultaneous requests across two independent connection pools admit exactly five for a five-attempt account budget. Persisted global count is 20 and account count 5; source count matches its position in sorted identity locking. Distinct backend PIDs are observed. An injected exception after the actual transaction callback writes rolls back all counters and returns denial; the next normal attempt succeeds.
- Expiry/retention: run-owned rows with saturated previous-window counters do not block a new current-window admission. Current starts align to 15 minutes and expire 75 minutes after start. Of 100 aged expired owned rows, one attempt deletes exactly 64. Eight concurrent admissions with the remaining expired rows admit exactly five for a five-attempt budget, remove the remaining 36 and leave active counters unchanged. This uses aged synthetic timestamps and the actual database clock; it does not claim an elapsed 15/75-minute wait test or strict deletion while idle.
- Failure/privacy: a dedicated already-closed postgres-js client causes controlled retry/denial, with no unlimited fallback or internal errors in public results. Active account-backed repository/notification reads continue using healthy connections without invoking the limiter. Missing production limiter-secret configuration denies admission. Persisted limiter rows contain only tracked 64-character HMAC digests/window/expiry/count, with no email/password/IP/token columns or raw credential logging.
- Authentication/authorization: real synthetic Student/Admin/Adviser login, seven-day JWT issuance and HttpOnly/SameSite=Lax cookie options, production Secure option, immediate Student registration, optional unverified login, generic wrong/missing/inactive failures, and excessive login/duplicate-registration denial pass. A synthetic legacy 80-byte bcrypt password logs in. New 72-byte Unicode registration succeeds; over-limit ASCII/multibyte passwords are rejected and managed creation schemas retain the same byte policy. Actual current-account active/deleted/stale-role denial and notification recipient ownership pass; valid active roles retain repository/notification reads. Malformed/missing/expired/future/unsupported JWT claims reject and logout clears the synthetic cookie jar.
- Optional verification: actual PostgreSQL cooldown/quota and consumption are exercised with a loopback development delivery adapter whose send callback captures only in memory. Immediate resend denies, five requests in the current rolling hour succeed when only owned cooldown timestamps are aged, sixth denies, expiry is exactly 60 minutes and only a SHA-256 token digest is stored. Two concurrent confirmations yield one winner; replay fails and no login/session cookie is created. Normal password login continues and production actions/development delivery refuse execution. No SMTP or real email was used.

Two intermediate corrected-source runs reached 16 PASS groups and then found a runner assertion problem: a raw SQL timestamp-array value was returned as text, so `.length` counted characters instead of requests. The runner now uses the application's Drizzle column decoding. This was not a second application defect. Each intermediate run performed independent successful cleanup; the final 18-group run above passes without weakening quota or single-use assertions.

### Other validation, cleanup and closure recommendation

- PASS: the same 15-file focused isolated regression command documented above reports **74 tests, 74 PASS, 0 FAIL/skip**. bcrypt/JWT are real; SQL-driver/account/request/delivery doubles retain their documented scope. The strengthened SQL parameter assertions pass.
- PASS: `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- PASS: targeted ESLint for the repository and two changed tests, zero warnings/errors; runner syntax check and non-mutating Drizzle history check. Final diff/preservation checks accompany this handoff.
- Production build not repeated: the only application change supplies two existing Drizzle column encoders, verified by TypeScript and the real database; no framework, dependency or client/UI code changed. The previous build remains historical evidence. No unrelated browser/Phase 9 suite ran.

Every run used unique synthetic markers and ephemeral HMAC/JWT material. Cleanup recovered only exact run-owned accounts by marker plus intended email, deleted their notifications/verification requests and exact tracked bucket keys, then verified through an independent connection: no owned user/notification/verification records, zero limiter buckets, unchanged complete pre-existing record fingerprints across all 14 original public tables, and unchanged original columns/constraints/indexes. Five owned accounts were created in each fixture-bearing run; one was deliberately deleted for authorization testing and cleanup removed the remainder. Existing users/passwords/roles, groups, papers/submissions/feedback, repository counters/history and verification records are preserved. Serial gaps are retained; no sequence reset. All owned connections closed, no Storage or SMTP call, no environment-file write or production configuration.

Exact files changed in D.2F (no new files):

```text
lib/repositories/auth-rate-limit.repository.ts
tests/phase101d2-auth.acceptance.cjs
tests/phase101d2-rate-limit-sql.unit.cjs
docs/PHASE10_1D2_AUTH_HARDENING.md
docs/MASTER_CONTEXT_UPDATED.md
docs/SOURCE_OF_TRUTH_UPDATED.md
docs/DATABASE (1).md
```

Recommend **PASS WITH DOCUMENTED LIMITATIONS for the approved Phase 10.1D correction/acceptance scope**, subject to owner closure review. No currently blocked executed acceptance group or second application defect remains. This is not a hosted/production-readiness certification: trusted Vercel ingress is not deployed-verified, production secrets/configuration and sender remain unconfigured, other dependency advisories remain, fixed-window/NAT/global exhaustion and lazy retention still apply, and established JWT/signed-URL revocation limits remain. No threshold/control change, mandatory verification, mobile API, deployment, staging/commit/push or Phase 10.2 work occurred. All existing and new work stays unstaged/uncommitted at the same HEAD. Owner review of the checkpoint is the next action; no automatic deployment or commit follows.
