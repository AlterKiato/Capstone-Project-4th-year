# Student registration email OTP: local implementation

Date: 2026-11-15 (Asia/Manila). **PASS for local implementation and focused offline validation.** Database application, real SMTP/Mailpit delivery, actual PostgreSQL contention and protected Preview acceptance are **NOT TESTED**. No migration, database/Storage connection, actual email, dependency installation, credential configuration, commit, push or deployment was performed.

Baseline and ending HEAD: `feature/development`, `3f6865b701288110c8c704ffd877cafdf2db8d56`. All OTP changes are unstaged. The incoming modifications to `docs/MASTER_CONTEXT_UPDATED.md` and `docs/SOURCE_OF_TRUTH_UPDATED.md`, and incoming untracked `scripts/groq-developer-test.cjs` and `tests/ai-p212-developer-groq.unit.cjs`, remain byte-for-byte unchanged. Canonical reconciliation is deferred to a separately authorized update; this document records the new implementation without replacing historical evidence.

## Behavior

- Public registration explicitly creates a Student with `email_verification_required=true`. It sets a restricted HTTP-only pending cookie, attempts OTP delivery and redirects to `/verify-email`; it creates no normal session. Delivery failure retains the account, challenge and request quota. Duplicate registration retains the existing generic error and cannot overwrite credentials.
- Correct password entry resumes pending verification after browser interruption. Incorrect/missing/inactive credentials retain the existing generic denial. Resuming does not automatically send more email.
- Codes use `crypto.randomInt(0, 1000000)` with six-digit zero padding. Only a purpose-, account-, email- and issuance-bound HMAC-SHA256 digest is stored. Its key is derived from the separate OTP secret. Code comparison uses `timingSafeEqual`; immediate random collisions cannot reuse the preceding code on resend.
- Expiry is five minutes; resend cooldown is 60 seconds; five requests per rolling hour include failed/uncertain delivery. Five incorrect submissions, including malformed codes, invalidate the current challenge. Resend replaces the digest and resets only the per-challenge failure count. Existing request history/account associations remain intact.
- The existing account lock and post-lock database clock serialize requests, incorrect-attempt updates and consumption. Verification consumes the challenge and updates `emailVerifiedAt` in one transaction. SMTP runs only after challenge commit, outside the lock.
- Normal session issuance/reading, central account resolution, research mutation authority and mobile login reject pending new Students. Seven-day normal JWTs/cookie settings remain unchanged. A valid older JWT cannot bypass current pending status. The one-hour pending cookie has a separate name, derived key, issuer/audience and JWT type, and cannot function as a normal session. It remains restricted after confirmation so refresh can show success; normal password login clears it.
- Existing Students retain the default `email_verification_required=false`, without fabricating verified timestamps. Active-account/current-role checks, Admin/Adviser authentication and managed-account creation remain intact. Email ownership grants no enrollment, group membership or institutional identity approval.
- `/verify-email` now accepts OTP codes instead of links. The old Student status route redirects to this same interface. Existing Students may voluntarily verify through their own current session. No parallel active link-verification endpoint was added. The disabled Resend adapter remains disabled and unchanged.

## Migration and operator preparation

`db/migrations/0020_student_email_otp.sql` contains exactly three additive statements:

1. Add `email_verification_requests.failed_attempts integer NOT NULL DEFAULT 0`.
2. Add `users.email_verification_required boolean NOT NULL DEFAULT false`.
3. Constrain `failed_attempts` to 0 through 5.

No backfill of verified timestamps, historical-row rewrite or new table. Drizzle generated the matching snapshot and journal entry offline. Every historical migration and reviewed prefix identity is retained. The 0020 reviewed source digest is `a23b05a91f7941d7b319bb34d8662d282116132ce9ae97c62e68c1b65f223f30`.

The prepared `scripts/migrate-preview-email-otp.ts` follows the existing guarded operator: pinned Preview target/TLS/operator identity, exact 20-entry predecessor ledger, source/target/Data-API-disabled confirmations and interactive execution approval; lock/reinspect before applying only 0020; schema/permissions/default/preservation checks; durable readback; no automatic retry. It neither enables the Data API nor widens runtime grants. Missing required permissions stop for separate review. Existing row fingerprints omit only the two planned new fields when comparing before/after; legacy columns, constraints, ACLs, relationships, rows and sequences remain covered.

**Ready for separate source/migration review, not claimed database-executed or Preview-accepted.** The application now depends on 0020: apply the separately approved migration and establish runtime permissions before publishing or accepting this code against a database. Do not run the prepared operator under implementation or push approval alone.

## Email configuration (names/scopes only)

| Server-only variable | Purpose |
|---|---|
| `THESISHS_EMAIL_OTP_ENABLED` | Exact value `enabled` opts into Gmail on Vercel Preview only. |
| `THESISHS_GMAIL_USER` | Gmail sender/authentication address. |
| `THESISHS_GMAIL_APP_PASSWORD` | Eligible Gmail account's App Password; owner configures privately. |
| `THESISHS_EMAIL_OTP_SECRET` | Independent strong random secret, at least 32 UTF-8 bytes, different from JWT/auth-limit secrets. Used for domain-separated code and pending-cookie keys. Required locally too. |

Scope hosted configuration to Preview and `feature/development`; retain the existing Preview baseline and protection. Gmail transport requires Vercel's `NODE_ENV=production`, `VERCEL=1`, `VERCEL_ENV=preview` plus opt-in; Production delivery is refused. No new origin variable or dependency is needed. Transport is fixed to `smtp.gmail.com:465`, TLS with normal certificate verification, 5-second connection/greeting and 10-second socket timeouts, awaited sending, no pooling/retry/debug logging, and sanitized failure results. Sender acceptance is not an inbox-delivery claim.

Local Mailpit remains explicitly development-only, loopback-only and `.invalid`-recipient-only, using existing `THESISHS_LOCAL_MAILPIT=enabled` and loopback `THESISHS_VERIFICATION_ORIGIN`. Its messages now contain OTP codes. The OTP batch used mocked transports, not a running SMTP service. Existing database and durable auth-limit settings are reused. Credential values were not inspected, exported or configured. Rotating the OTP secret invalidates outstanding codes/pending cookies; password login remains the recovery entry.

## Exact changed-file inventory

| Purpose | Paths |
|---|---|
| Schema/history | `db/schema/users.ts`; `db/schema/email-verification.ts`; `db/migrations/0020_student_email_otp.sql`; `db/migrations/meta/0020_snapshot.json`; `db/migrations/meta/_journal.json` |
| Registration/credentials | `lib/actions/auth.action.ts`; `lib/services/auth.service.ts`; `lib/repositories/user.repository.ts`; `app/api/mobile/v1/auth/login/route.ts` |
| Current authority/pending cookie | `lib/auth/account-principal.ts`; `lib/auth/current-account.ts`; `lib/auth/research-mutation-account.ts`; `lib/auth/session.ts`; `lib/auth/student-verification.ts`; `lib/auth/email-otp-config.ts`; `lib/auth/pending-verification.ts` |
| OTP persistence/actions/status | `lib/repositories/email-verification.repository.ts`; `lib/services/email-verification.service.ts`; `lib/services/email-verification-status.service.ts`; `lib/actions/email-verification.action.ts`; `lib/validations/email-verification.ts` |
| Email transport | `lib/email/gmail-delivery.ts`; `lib/email/mailpit-delivery.ts`; `lib/email/verification-delivery.ts` |
| Minimal UI/copy | `app/(auth)/register/page.tsx`; `app/(auth)/verify-email/page.tsx`; `app/dashboard/student/page.tsx`; `app/dashboard/student/verify-email/page.tsx`; `components/auth/verification-confirmation-form.tsx`; `components/auth/verification-request-form.tsx` |
| Guarded migration support | `scripts/migrate-preview-email-otp.ts`; `scripts/preview-email-otp.ts`; `scripts/initialize-preview-database.ts`; `scripts/preview-migration-source.ts`; `scripts/preview-schema.ts`; `scripts/preview-catalog-contract.ts` |
| Focused tests | `tests/phase101b1-email-verification.unit.cjs`; `tests/phase101b1-email-verification-sql.unit.cjs`; `tests/phase101b2-verification.unit.cjs`; `tests/phase101d2-auth-security.unit.cjs`; `tests/phase10-verification-ux.unit.cjs`; `tests/phase10-email-otp-auth.unit.cjs`; `tests/phase10-email-otp-migration.unit.cjs`; `tests/phase10-email-otp-ui.browser.cjs` |
| Technical handoff | `docs/PHASE10_STUDENT_EMAIL_OTP.md` |

The four incoming protected paths are excluded from this inventory. No dependency, global CSS, AI implementation, institutional Live configuration, actual environment file or native mobile checkout changed.

## Validation evidence and limits

- **92/92 reported Node tests PASS**, zero failed/skipped, in the final sequential focused run below. These include real services/crypto/JWT/bcrypt and Drizzle SQL generation with synthetic cookie/repository/driver boundaries; serialized in-memory contention is not real PostgreSQL contention. SMTP is mocked before import. No database or external email request occurs.
- **Current-source TypeScript PASS**, zero diagnostics using the existing compiler configuration with only ignored `test-results` copies excluded in memory. The unfiltered project command fails on stale generated build-source copies and their cross-imports; neither those artifacts nor the project config was changed to hide this distinction.
- **Targeted ESLint PASS**, zero warnings/errors, for changed/new source and test files, excluding the two protected CLI files. Whitespace checks PASS.
- **Drizzle history check PASS** (`npx.cmd drizzle-kit check`); historical-prefix and additive-schema tests PASS. No migration was applied, including to a disposable database.
- **Isolated Next.js 16.4.3 webpack production build PASS**, one worker, TypeScript and 27/27 page-generation tasks. The first sandboxed build failed only on the existing Manrope font fetch; one approved network-enabled fallback passed. No environment files were copied; service settings were synthetic/non-routable and no SMTP credentials were configured. All 486 copied source/dependency/configuration files match their final source hashes. Existing workspace-root warning is retained.
- **Bounded synthetic Chromium form check PASS**: actual React forms and shared CSS; complete six-digit/leading-zero input, keyboard submit, pending/invalid/expired/success states, resend cooldown, delivery failure and login link. 360px Light and 1280px Dark have no horizontal overflow, 44px controls, visible focus and input contrast at least 4.5:1. Two screenshots inspected. Zero browser errors/unexpected requests. Actions are synthetic; this is not Next Server Action transport, real SMTP, physical-device or hosted acceptance.

```powershell
node --import tsx --test --test-concurrency=1 tests/phase101b1-email-verification.unit.cjs tests/phase101b1-email-verification-sql.unit.cjs tests/phase101b2-verification.unit.cjs tests/phase101d2-auth-security.unit.cjs tests/phase101d2-rate-limit.unit.cjs tests/phase101d2-rate-limit-sql.unit.cjs tests/phaseM3a-auth-foundations.unit.cjs tests/phase10-email-otp-auth.unit.cjs tests/phase10-email-otp-migration.unit.cjs tests/phase10-verification-ux.unit.cjs
node tests/phase10-email-otp-ui.browser.cjs
npx.cmd drizzle-kit check
```

Ignored evidence: `test-results/email-otp-20261115/` contains the build log/result/source manifest, synthetic UI result and two screenshots. Local filesystem restrictions required the approved browser/build fallback; they are not application failures. Old real-database/Mailpit/link-browser acceptance harnesses remain historical and were not run; they need a separately authorized OTP fixture/migration review before reuse.

## UI delivery gate (scoped evidence)

- **Hard Gate PASS:** actual existing auth styles, working form actions/feedback/recovery, numeric input and keyboard submission, measured mobile overflow/targets/focus/contrast, both recorded themes, no added decorative assets or fabricated product claims. No CSS or runtime source-patching mechanism added; UI behavior lives in the React source. Build and synthetic click-through passed within the explicit limits above.
- **Purpose-Gate PASS:** a single native input supports full-code paste and leading zeros; countdown explains when resend is available; the existing error surface identifies actionable failure. No new palette, icons, badges or decorative effects.
- **Liveliness PASS:** existing academic direction and ENERGY 1 / RHYTHM 2 / MOTION 1 retained; direct submit/loading feedback and no added animation.
- **Craftsmanship/React PASS:** labels/status relationships, pending/empty/error/success states, server-authoritative cooldown/quota, effect timer cleanup, hydration-stable initial countdown and server-only imports kept out of client runtime. Source review and the bounded synthetic UI checks support these findings; real transport/device acceptance remains pending.

## Smallest next action

Owner review of 0020 and the prepared operator, followed by explicit authorization for the affected Preview target/ledger/permission preflight. Migration execution, any minimum-grant change, Preview-only Gmail/OTP secret configuration, commit/push/publication and one controlled real-inbox registration test retain their separate gates under the existing playbook. No comprehensive deployment audit or new infrastructure is proposed.

After the separately approved migration/configuration/publication, use one owner-controlled new Student email: register, confirm that protected research access is unavailable, receive and enter the OTP, then log in normally. Execute owner-led acceptance one action at a time. Preserve existing Students/staff/history and do not email historical synthetic fixture addresses. Record actual inbox receipt and protected Preview behavior separately from this local PASS. Canonical handoff reconciliation and the Phase 10 UI Overhaul do not start automatically.
