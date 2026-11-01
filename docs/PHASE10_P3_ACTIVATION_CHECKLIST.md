# Phase 10.P3F.0 — Preview activation readiness and owner checklist

Date: 2026-11-01. This is a preparation record. **No hosted migration, credential generation/configuration, activation, push, merge or deployment is authorized by this document.** P.3F.0 authorizes one reviewed local commit only. Resolve its SHA from Git; its parent is `b4352d1ea456dfce18097b039f9237ef46fc33a6`.

## Evidence and decision

| Classification | Finding |
| --- | --- |
| VERIFIED | Entry branch `feature/development`, HEAD above, empty index, 55 pending paths (29 tracked modifications, 26 new). All are attributed below. |
| VERIFIED | Local source implements enrollment, root worker, generic VAPID delivery and four post-commit research events. P.3E.1a key-ID correction and P.1/P.2 protections are preserved. |
| VERIFIED | P.3F.0 smoke: 83 reported tests pass; TypeScript and targeted ESLint on 45 changed/new code files pass. Manifest/lock/direct installed versions agree. Offline 16-entry migration digest passes; 30 historical SQL/snapshot files and the first 15 journal entries are unchanged. Git clean filters preserve pinned migration bytes. |
| VERIFIED, prior execution | P.3E.2: 20 real PostgreSQL checks pass in a fresh private PostgreSQL 18.4 cluster; cleanup complete. All 16 migrations matched source; 16 prior tables were preserved. This did not use an existing project database. |
| VERIFIED, prior execution | P.3E.1b: 118 reported isolated compatibility tests and credential-free Next 16.4.3 production **compile** pass. This was not full prerender/build finalization. |
| DOCUMENTED | Protected Vercel Preview project `thesishs-ai`, branch `feature/development`; `main` reserved for undeployed Production. Supabase test project `cbkplqkkjuoglpimwmib`, Singapore, dedicated runtime/operator, Session Pooler 5432 and functions `sin1`. These are retained owner-operated/reported facts, not a fresh remote audit. |
| DOCUMENTED | No linked `.vercel/project.json` or available Vercel CLI was found locally. Live project/team, domains, deployed SHA, protection, settings and variable scopes need owner verification; no secrets were fetched. |
| BLOCKED for activation | Existing project migration 0015, hosted grants, approved full-build configuration/finalization, real VAPID provisioning, live deployment verification and Android/iOS delivery remain outstanding. Local commit readiness does not satisfy these gates. |
| PROPOSED | P.3F.1 should prepare and review the bounded existing-Preview upgrade command and privately confirm target/configuration metadata. Execution, key provisioning, push/deployment and physical-device work need explicit scope/approval. |

The P.3E.1b audit retained 23 affected package entries (three high, 20 moderate), all development-only in the lockfile; zero runtime entries were reported then. P.3F.0 rechecked that saved audit against the unchanged lock, without a fresh registry audit. Proportionate build/tooling risk review remains open. No full build or database operation was rerun here.

## Complete reviewed file inventory

Every entry pending at preflight appears once below. Counts: backend 8, worker/client 11, sender/events 12, dependencies 2, migration/tooling 9, focused tests 9, canonical docs 4 = **55**. This checklist is one additional documentation file, making the reviewed local commit **56 files**. Unrelated/unexplained files: **zero**.

`lib/pwa/research-push-client.ts` also contains the P.3E.1a one-condition key-ID correction; its regression is in `tests/phaseP3-pwa.unit.cjs`. Package changes include the P.3D sender and P.3E.1b security updates. Existing browser/database acceptance harness changes are source maintenance only; those harnesses were not executed in P.3F.0.

### P.3C.1 subscription backend (8)

- `app/api/push/subscription/route.ts`
- `lib/push/contract.ts`
- `lib/push/http.ts`
- `lib/push/subscription.ts`
- `lib/repositories/push-subscription.repository.ts`
- `lib/services/push-subscription.service.ts`
- `lib/auth/auth-rate-limit-config.ts`
- `lib/services/auth-rate-limit.service.ts`

### P.3C.2 worker and enrollment (11)

- `app/dashboard/adviser/submissions/ReviewDraftBoundary.tsx`
- `app/dashboard/layout.tsx`
- `components/auth/logout-button.tsx`
- `components/dashboard/research-push-enrollment.module.css`
- `components/dashboard/research-push-enrollment.tsx`
- `lib/pwa/research-push-browser.ts`
- `lib/pwa/research-push-client.ts`
- `lib/pwa/research-push-navigation.ts`
- `lib/services/dashboard-account.service.ts`
- `next.config.ts`
- `public/sw.js`

### P.3D VAPID sender and event integrations (12)

- `app/dashboard/adviser/submissions/[submissionId]/page.tsx`
- `lib/actions/adviser-feedback.action.ts`
- `lib/actions/submission-upload.action.ts`
- `lib/services/adviser-feedback.service.ts`
- `lib/uploads/submission-upload-workflow.ts`
- `lib/push/config.ts`
- `lib/push/delivery.ts`
- `lib/push/request.ts`
- `lib/push/schedule.ts`
- `lib/push/transport.ts`
- `lib/repositories/push-delivery.repository.ts`
- `lib/services/research-push.service.ts`

### P.3E dependency corrections (2)

- `package.json`
- `package-lock.json`

### Migration and integrity tooling (9)

- `db/migrations/meta/_journal.json`
- `db/schema/index.ts`
- `db/schema/push-subscription.ts`
- `db/migrations/0015_push_subscriptions.sql`
- `db/migrations/meta/0015_snapshot.json`
- `scripts/database-operator.ts`
- `scripts/initialize-preview-database.ts`
- `scripts/preview-initialization.ts`
- `scripts/preview-migration-source.ts`

### Focused tests (9)

- `tests/phase102b-database.acceptance.ts`
- `tests/phase102c2-tooling.unit.cjs`
- `tests/phase102c2-upload.unit.cjs`
- `tests/phase102d2a-hosted-database.unit.cjs`
- `tests/phase9-pwa.browser.cjs`
- `tests/phaseP3-delivery.unit.cjs`
- `tests/phaseP3-events.unit.cjs`
- `tests/phaseP3-pwa.unit.cjs`
- `tests/phaseP3-subscription.unit.cjs`

### Canonical documentation (4)

- `docs/ARCHITECTURE_UPDATED.md`
- `docs/DATABASE (1).md`
- `docs/MASTER_CONTEXT_UPDATED.md`
- `docs/SOURCE_OF_TRUTH_UPDATED.md`

The added canonical checklist is `docs/PHASE10_P3_ACTIVATION_CHECKLIST.md`. Review found no real credentials/VAPID keys, environment files, database dumps, disposable clusters, build/cache artifacts or private test evidence in this manifest. Deterministic test scalars/public points, synthetic endpoints and non-routable examples are test fixtures. Ignored `.next/` evidence stays outside Git. Dependency artifact integrity strings are package metadata.

P.2 closure is preserved: draft protection gains only the guarded push navigation event; Adviser detail gains Node/60-second declarations. Existing academic authorization, version/feedback history, in-app notifications, 1,800-second Adviser PDF window/1,680-second explicit-renewal threshold and other 300-second signers are unchanged. Logout adds bounded best-effort cleanup before the existing cookie deletion. No feature edits were made during F.0.

## Preview target and prerequisites — owner verification later

- [ ] Confirm intended Vercel team/project ID for `thesishs-ai`, Preview environment, `feature/development`, exact reviewed commit and approved stable HTTPS **branch Preview origin**. Do not substitute a Production domain or invent a URL from the project name.
- [ ] Confirm branch-specific variable overrides, Git deployment triggers, protection and Node 24 selection. A Git push can trigger deployment, so push itself requires separate authorization. Keep `main` and Production untouched.
- [ ] Revalidate database target privately: Supabase project `cbkplqkkjuoglpimwmib`, database `postgres`, historically OID `5` / cluster `7678069749886157684`; observed identities must still match approved pins. These historical values alone are insufficient authorization.
- [ ] Obtain the exact approved pooler hostname/user route from private owner configuration. Use Session Pooler port 5432, runtime `thesishs_preview_runtime`, distinct operator `thesishs_preview_operator`, verified CA/certificate/hostname and current driver identity checks. Do not place credential URLs in Git/evidence.
- [ ] Prove separation from `localhost:5432/thesishs_ai` and Production using endpoint plus observed project/database/cluster identities, not aliases alone. Development/Preview deliberately share test Storage and its privileged-key boundary; Production requires separate clean database/Storage resources.
- [ ] Preserve the guarded runtime: `NODE_ENV=production`, Vercel-provided `VERCEL_ENV=preview`, `THESISHS_DATABASE_ENV=preview`, `THESISHS_DATABASE_CONNECTION_MODE=session`, server-only `DATABASE_URL`, `THESISHS_DATABASE_TARGETS_JSON`, `THESISHS_DATABASE_CA_PEM`. Target map retains all required Development/Preview pins and the non-connectable Production reservation. No runtime `THESISHS_DATABASE_ADMIN_URL`; it belongs only in the separately authorized operator session.
- [ ] Preserve server-only `JWT_SECRET`, secure HttpOnly SameSite=Lax seven-day web cookie, current active-account/database-role checks and existing private Storage configuration. Enrollment authorization ends at verified session expiry (or earlier native expiry); foreground refresh does not renew it.
- [ ] Preserve `THESISHS_AUTH_LIMIT_SECRET` (at least 32 UTF-8 bytes, no surrounding whitespace, at most 4096 characters). Hosted limits stay enabled. Only use `THESISHS_AUTH_SOURCE_MODE=vercel-direct` after verifying direct Vercel ingress; arbitrary forwarded headers are untrusted. Push policies are fixed and do not accept JSON overrides.
- [ ] Complete the full configured build/prerender with approved Preview settings and capture its result. Keep ordinary production-mode build configuration distinct from database environment Preview; do not insert dummy Production credentials, bypass guards or call a compile-only result full build acceptance.

Vercel supports branch-specific Preview variables and branch URLs. Environment changes affect new deployments, so rollback/activation must identify and verify a newly configured deployment. See [Vercel variables](https://vercel.com/docs/environment-variables) and [environments](https://vercel.com/docs/deployments/environments), read 2026-11-01. No dashboard state was inferred from these general docs.

## Migration 0015 — proposed execution gate, not executed

**Fresh empty initialization:** the existing `initialize-preview-database.ts` supports explicitly approved empty-database initialization through all 16 migrations, with independent durable verification. It refuses populated state; it is **not an upgrade command**.

**Existing Preview upgrade:** the documented Preview already has 0000–0014 and research records. Latest full-ledger operator/initializer checks expect 16 and intentionally reject its current 15-entry state. The historical 0014 runner remains pinned to its old source; do not weaken/replay it. A separately reviewed bounded command/harness for this exact 15-to-16 transition is still required; no new framework or executable upgrade command is introduced here.

1. Obtain explicit owner approval naming Preview target, reviewed commit, one-time 0015 scope, operator, private backup/recovery evidence, grants and verification window. Keep push disabled; coordinate a short quiet window.
2. Freshly validate exact identity/TLS through the existing guarded configuration/identity primitives, with separate runtime/operator principals. Compare all 15 ledger hashes/timestamps with the reviewed prefix, validate expected existing catalog/ownership and confirm `push_subscriptions` is absent. Unexpected/partial/drifted state means stop.
3. Take a private restorable backup and verify a usable recovery path before writes. Protect all research/account/history records; keep backups/credentials out of Git. Define stop/recovery ownership and preserve the before catalog/ledger fingerprint.
4. Verify source digest `37824a5d2df42e54df9e50ee115c6eb7d6c42a94864c99aedfb1d63b4dbf51e0` using `previewMigrationSource()`; retain exact SQL bytes and unchanged historical prefix/journal. Snapshot has only the additive 11-column push table.
5. The reviewed future upgrade must take an operator transaction/advisory lock, recheck identity/ledger under it, apply **only pending 0015** with the installed supported Drizzle migrator, and verify the exact 16-entry ledger and table contract before commit. Use the existing transaction/savepoint integration; no startup/build migration hooks.
6. Review grants separately from DDL. Minimum new-table runtime access is `USAGE` on existing public schema plus `SELECT, INSERT, UPDATE ON public.push_subscriptions`; no sequence is required (UUID generations). No new table DELETE, DDL, ownership or browser/anonymous grants. Existing account-row `SELECT ... FOR UPDATE` also requires users SELECT and UPDATE privilege on at least one column; verify the established legitimate matrix, rather than broadening users access. Disposable tests used only `UPDATE(updated_at)` for that prerequisite.
7. Inspect hosted default privileges, memberships, owner, Data API exposure and any RLS/automatic-trigger effects before commit. A private in-app API is not proof that a new public-schema table is inaccessible through provider APIs. Preserve provider definitions and existing application grants; stop rather than broadly revoke shared privileges.
8. Independently reconnect for durable post-commit checks: exact identity, 16 hashes/timestamps, four validated CHECKs, PK, two unique constraints, users cascade FK, timestamp types, expected grants/no excess powers and unchanged prior academic catalog. Use only approved disposable synthetic fixtures if behavioral checks are authorized; remove only run-owned fixtures and preserve evidence without capability material.
9. On pre-commit failure roll back and inspect. On uncertain acknowledgement **inspect durably, do not retry automatically**. Keep push disabled and record whether committed state is confirmed. Prefer retaining additive table/schema on feature rollback. DROP/reverse migration or restoring a populated backup is a separate destructive recovery decision, never automatic.

No hosted connection, grant, SQL execution or normal-local migration was performed by F.0. The E.2 disposable PostgreSQL pass does not verify the hosted server version, pooler/TLS, privileges or timing.

## Exact push configuration checklist — owner selection/provisioning later

Use project-scoped **Preview variables for `feature/development`**; set separate Development values only if local testing is separately approved. Ordinary local `.env.local` remains ignored. Never copy Production credentials into either environment.

| Variable | Required format/selection | Exposure/stability |
| --- | --- | --- |
| `THESISHS_WEB_PUSH_ENABLED` | Exact lowercase `true` enables only when every validation succeeds. Absent/`false` disables. Keep off during preparation/migration. | Server config; activation and rollback switch. |
| `THESISHS_PUSH_ORIGIN` | Exact canonical HTTPS origin, no path, trailing slash, credentials or query. Must equal the installed app/mutation Origin. Only Development permits HTTP loopback. | Server trusted boundary; use an approved stable Preview branch origin across deployments. |
| `THESISHS_WEB_PUSH_PUBLIC_KEY` | Canonical unpadded base64url, 87 characters, valid 65-byte uncompressed P-256 public point. | Server env source; may be exposed by authenticated public-config DTO. Keep paired identity stable. |
| `THESISHS_WEB_PUSH_PRIVATE_KEY` | Canonical unpadded base64url, 43 characters/32-byte P-256 scalar deriving exactly the public key above. | Server-only Secret; never `NEXT_PUBLIC_`, client props, logs or repository. Keep privately backed up and stable. |
| `THESISHS_WEB_PUSH_KEY_ID` | Owner-chosen identifier, 1–64 ASCII letters/digits/underscore/hyphen. | Safe authenticated DTO metadata; stable for that identity. Changing it requires explicit enrollment again, even with the same public key. |
| `THESISHS_WEB_PUSH_SUBJECT` | Owner-selected real contact: valid `mailto:` email, or canonical HTTPS URL with dotted hostname, no credentials/hash; max 256 characters, no whitespace. | Server-only contact setting (also present in VAPID claims sent to the push provider); excluded from browser DTO. |

The public/private pair **may later be generated once with standard tooling**, for example the already pinned local `node node_modules/web-push/src/cli.js generate-vapid-keys`, run privately by the owner after approval. Its output is sensitive; do not paste it into chat or logs. **This command was not executed.** Contact and key ID are owner decisions. Do not regenerate on builds or deployments. Use a separate Production identity later. Explicit global TLS disablement makes push unavailable and is never an activation workaround.

GET `/api/push/subscription` exposes only availability/public key/key ID plus safe enrollment metadata. POST/DELETE require exact trusted Origin, non-cross-site Fetch Metadata, JSON <=4096 bytes, valid cookie/current active Student or Adviser and shared limiter admission. POST also requires valid enabled configuration; DELETE can clean up while disabled if trusted Origin/auth/database remain usable. Admin/Panel are denied. The expected-account header is a stale-context precondition, not authentication. GET is no-store; endpoint, auth and private key never enter a browser status DTO.

## Preview-only activation sequence — later approval required

1. Review P.3F.1's concrete upgrade/configuration plan and authorize specific execution steps. Confirm target/team/project/branch/commit/protection, backup/recovery and rollback owner.
2. Apply/verify only the approved migration/grants on exact Preview as above, still disabled. Privately provision the stable Preview VAPID pair/ID/contact/origin and existing required auth/DB/Storage build settings, with no Production changes.
3. After separate Git push/deployment authorization, create the reviewed **Preview-only** build/deployment with push off. Verify its full build, SHA, runtime DB mapping, authentication, ordinary synthetic research workflow and in-app notifications. Confirm root `/sw.js` responds as 200 JavaScript (not a protection/login HTML challenge), nosniff and `Cache-Control: no-cache, max-age=0, must-revalidate`. Preserve Vercel Authentication; resolve device access through the approved protected Preview workflow.
4. Verify the app uses Node (not Edge), both research action pages declare `maxDuration=60`, the platform's actual configured duration supports this, and `after()` executes under that request lifetime. Root worker registration uses scope `/` and `updateViaCache: none`; no fetch interception, cache, forced activation or offline research support is added.
5. Only after those gates, separately approve exact `THESISHS_WEB_PUSH_ENABLED=true` and a new Preview deployment. Verify availability without exposing secrets. Enrollment must be explicit in an installed eligible PWA; browser permission alone is insufficient.
6. Run the bounded owner device checks below using synthetic accounts/documents. Record device/OS/browser, approved origin/commit, event, foreground/background/closed-app state, receipt/time, click route, disable/logout result and any safe outcome category. Provider acceptance alone is not device display/read proof. Stop on a significant infrastructure failure.
7. Keep Production release, public access and real Student data excluded. No automatic progression from a local commit.

The sender supports exact FCM and Apple push subdomains only. Egress requires validated public DNS, normal certificate/hostname verification, no redirects, bounded HTTPS I/O and current active-role/key-ID/session-bound enrollment. Four events only: fresh initial/revised submission to assigned Adviser, revision-required/approval to persisted submitting Student. They run after acknowledged academic commit independently of existing in-app notifications. There is one best-effort attempt, no retry queue. The three-second target is **not an absolute DB deadline**: pool acquisition, identity checks, five-second connection settings, commit acknowledgement, event-loop delay and OS DNS may overrun; real hosted timing is unverified.

## Minimal physical-device acceptance — owner execution later

Use only approved test accounts and synthetic PDF research. Confirm the test research is eligible for each next transition; preserve prior versions/feedback. Notifications use one fixed tag and can replace each other, so exercise events sequentially and record each before the next.

| Step | Android installed PWA | Compatible iOS/iPadOS Home Screen app |
| --- | --- | --- |
| Install/access | Install from approved protected HTTPS Preview origin; open standalone and sign in as eligible Student/Adviser. | Add approved URL to Home Screen, launch standalone, pass protected Preview access and sign in. |
| Permission/enrollment | Select Enable Notifications explicitly; confirm browser/OS permission and server-confirmed enabled state. | Repeat from explicit in-app gesture where supported; verify OS per-app permission/Focus settings. |
| Research events | With enrolled Adviser, submit synthetic v1, then request revision; with enrolled Student verify revision notice. Submit v2 to Adviser, then approve and verify Student notice. Check both eligible roles. | Repeat the same small sequential synthetic workflow where supported. |
| Receipt/navigation | Record actual generic notification arrival with app backgrounded; tap into the correct authorized notification history. Also check one closed-app receipt if supported. | Record actual receipt/tap destination in Home Screen context, including background/closed state as supported. |
| Safety/lifecycle | Disable; trigger a new eligible synthetic event and verify no new delivery to that enrollment (allow already queued TTL). Re-enable explicitly, then logout; protected routes require login, new events must not use disabled/expired enrollment. | Repeat disable/logout/protected-destination checks. |
| Draft guard | If notification focuses an Adviser review with a dirty draft, cancel/accept leave and verify the existing guard. | Check when that review context is available; otherwise label not exercised. |

Home Screen Web Push and direct-interaction permission requirements are described by [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/). An unsupported device is recorded as unsupported/BLOCKED, not PASS. Test one device per account first; enabling a second replaces the first. Session expiry/key-ID rotation requires explicit enabling again. No local unit test or prior PWA installation acceptance proves delivery.

## Rollback and remaining gates

- [ ] Set Preview-scoped `THESISHS_WEB_PUSH_ENABLED=false` (or remove the flag) and deploy that disabled configuration through a separately authorized Preview rollout. Verify the new active deployment/branch URL reports unavailable and ordinary in-app notifications/research actions still work. Existing immutable deployments retain their settings; retire/restrict any still-enabled old URLs and account for in-flight requests. Reverting to an older **enabled** deployment is not a feature-off rollback.
- [ ] Retain DB table/grants and stable trusted Origin/auth settings so authenticated explicit DELETE/local unsubscribe can still clean up. Keep credentials protected; do not remove existing in-app notifications or delete academic data. Owner-controlled key revocation/rotation is a separate action if needed.
- [ ] An installed worker remains installed: it has no fetch/cache logic and no server flag check during push. Already accepted/queued push (TTL 300 seconds), displayed notifications and in-flight sends cannot be recalled universally; they can still show fixed generic text. Clicks use fixed destinations and normal session/role authorization. Disabling stops newly admitted enrollment/delivery on disabled deployments; it does not unregister the worker or immediately purge every device.
- [ ] Carry forward full build/prerender finalization, unapplied project 0015, unverified hosted grants/configuration, unconfigured real VAPID and unverified Android/iOS delivery. Retained build-time dependency risks are development-only, not marked fixed.
- [ ] Preserve existing application auth, active-role/ownership/CSRF boundaries and protected Preview access. Hosted anonymous document-action denial, cross-group isolation, signed-upload path isolation, capability expiry and Storage policy review remain NOT VERIFIED/deferred to production readiness. Prior four Storage GETs and Vercel protection denial are bounded evidence, not comprehensive authorization proof.
- [ ] Preserve hard-disabled Groq/Resend, frozen Expo/Electron, P.1/P.2 closure, P.4/R.1–R.3 scope and all prior device/editing/reassignment limitations. Mandatory Student email verification/real email remain deferred under the initial-deployment decision.

**Stop:** P.3F.0 ends after the reviewed local commit and readiness report. P.3F.1 preparation is recommended, not started; no push or hosted execution is implied.
