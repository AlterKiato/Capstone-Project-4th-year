# ThesiSHS AI — Vercel Preview Configuration Baseline

**Updated:** 2026-11-10 (Asia/Manila). Canonical environment-specific facts and reusable fixture inventory. The [playbook](THESISHS_PREVIEW_DEPLOYMENT_PLAYBOOK.md) owns the procedure; [Master Context](MASTER_CONTEXT_UPDATED.md#current-handoff-2026-11-10) owns current progress; the [prevention register](PHASE10_S34B1_PREVIEW_OPERATOR.md#preview-prevention-register) owns incidents. This baseline authorizes no execution.

## Evidence and reuse boundary

| Classification | Meaning |
|---|---|
| **LOCAL INSPECTION — 2026-11-10** | Repository only: branch `feature/development`, HEAD and locally stored `origin/feature/development` both `d564c3d8404d935843c0d0366ab9fff155b3c4cf`; entry tree/index clean; origin URL matches the repository below. No fetch/remote query or hosted inspection occurred. A stored tracking ref is not a fresh remote-tip observation. |
| **SCREENSHOT-VERIFIED** | Attributed November owner-supplied Dashboard findings; this task did not inspect original pixels or live settings. Masked values are not validated. |
| **OWNER-CONFIRMED** | Accepted owner statements, including November 10 publication/acceptance and fixtures supplied for this checkpoint; not independently rerun. |
| **HISTORICAL / CODEX-REPORTED** | Retained repository/operator receipts or dated source checks; no automatic promotion to current hosted assurance. |
| **UNVERIFIED / NOT TESTED** | Fact or behavior not established within the recorded scope. |

Reuse accepted configuration when unchanged and uncontradicted. Refresh only affected facts after relevant settings/code/target changes or contradictory evidence. Dashboard screenshots do not prove secret correctness; GitHub deployment-completed messages do not independently prove Ready or runtime acceptance. Actual Production isolation remains a hard requirement before sensitive hosted writes. Keep values, credentials and raw private screenshots out of Git and reports.

## GitHub, Vercel environments and domains

| Setting | Recorded baseline | Evidence |
|---|---|---|
| Connected GitHub repository | `AlterKiato/Capstone-Project-4th-year` | SCREENSHOT-VERIFIED |
| Production branch | `main` | SCREENSHOT-VERIFIED |
| Preview branch tracking | Enabled for all unassigned Git branches | SCREENSHOT-VERIFIED |
| Intended Preview branch | `feature/development` | OWNER-CONFIRMED — supplied intended branch |
| Production domain | `thesishs-ai.vercel.app` | SCREENSHOT-VERIFIED — domain assignment alone does not establish a Production release |
| Preview custom domain | None shown | SCREENSHOT-VERIFIED — limited to the captured view |
| Environment boundary | Production and Preview are distinct Vercel environments | SCREENSHOT-VERIFIED — does not prove underlying database/Storage isolation |

**Reuse rule:** accepted November configuration maps `feature/development` to Preview via unassigned branches and `main` to Production. Recheck effective targeting when branch assignments, custom environments, deployment rules or contradictory evidence change; do not rediscover this mapping for every push. Branch naming alone is insufficient.

**HISTORICAL / CODEX-REPORTED — retained P.3F.4 handoff:** the [limited synthetic Preview Web Push closure](MASTER_CONTEXT_UPDATED.md#p3f4-web-push-closure-and-development-handoff-2026-11-05) records a Ready Preview at `f82a08105158713ffad5161c0235fac1d23327fd` and stable installed-PWA origin `https://thesishs-ai-git-feature-development-thesi-shs-ai.vercel.app`. That branch URL is distinct from a Preview custom domain. This task did not refresh deployment metadata or verify that the local HEAD is deployed.

## Preview environment variables — identifiers only

**SCREENSHOT-VERIFIED:** the owner-provided Vercel capture shows **16 variables**, scoped to **Preview** and restricted to **`feature/development`**, covering Web Push, Database, Supabase and Authentication. No values were accessed or recorded.

**HISTORICAL / CODEX-REPORTED — 2026-11-06 local source inspection:** the identifiers below are supported by the checked-out code. The inventory contains 16 names consistent with those categories, but the supplied screenshot transcription does not enumerate every row. **UNVERIFIED:** exact one-to-one membership of this inventory in the screenshot, current live presence, per-variable scope and value validity. Do not infer those findings from the matching count.

| Category | Code-backed identifiers | Repository source |
|---|---|---|
| Web Push | `THESISHS_WEB_PUSH_ENABLED`, `THESISHS_PUSH_ORIGIN`, `THESISHS_WEB_PUSH_PUBLIC_KEY`, `THESISHS_WEB_PUSH_PRIVATE_KEY`, `THESISHS_WEB_PUSH_KEY_ID`, `THESISHS_WEB_PUSH_SUBJECT` | [Push configuration](../lib/push/config.ts) |
| Database | `DATABASE_URL`, `THESISHS_DATABASE_ENV`, `THESISHS_DATABASE_CONNECTION_MODE`, `THESISHS_DATABASE_TARGETS_JSON`, `THESISHS_DATABASE_CA_PEM` | [Database configuration](../lib/db/config.ts) |
| Supabase | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY` | [Privileged server client](../lib/supabase/server.ts), [publishable-key server client](../lib/supabase/client.ts) |
| Authentication | `JWT_SECRET`, `THESISHS_AUTH_LIMIT_SECRET` | [JWT configuration](../lib/auth/jwt.ts), [shared authentication limits](../lib/auth/auth-rate-limit-config.ts) |

**HISTORICAL / CODEX-REPORTED — local source and retained activation guidance:** hosted database configuration enforces target pins, stage agreement and certificate/hostname verification. The operator-only `THESISHS_DATABASE_ADMIN_URL` must be absent from the hosted runtime. Vercel-managed `NODE_ENV`, `VERCEL_ENV` and `VERCEL` are context checks, not additions to the screenshot inventory. Optional `THESISHS_AUTH_SOURCE_MODE` requires verified direct ingress before opt-in; optional `THESISHS_AUTH_LIMITS_JSON` is not established as configured. See the [existing activation checklist](PHASE10_P3_ACTIVATION_CHECKLIST.md) for detailed safeguards.

Future review must compare names and scopes without exporting or publishing values. Keep credentials server-only; do not put secrets in `NEXT_PUBLIC_` variables. Preserve the existing disabled Groq/Resend and frozen Expo boundaries. Configuration presence alone does not prove database connectivity, valid key pairing, enrollment or notification delivery.

## Supabase assignment

| Assertion | Recorded baseline | Evidence |
|---|---|---|
| Project name | `ThesiSHS AI` | SCREENSHOT-VERIFIED |
| Project reference | `cbkplqkkjuoglpimwmib` | SCREENSHOT-VERIFIED |
| Region | `ap-southeast-1` | SCREENSHOT-VERIFIED — Supabase project region, not a fresh Vercel function-region check |
| Intended use | Preview/testing only | OWNER-CONFIRMED |
| Preview `DATABASE_URL` assignment | Owner obtained it from this Supabase project | OWNER-CONFIRMED — no masked connection value independently checked |
| Preview `SUPABASE_URL` assignment | Owner obtained it from this Supabase project | OWNER-CONFIRMED — no masked endpoint independently checked |
| Production resource isolation | Actual separate Production database/Storage resources and assignments | UNVERIFIED |
| Actual masked connections and credentials | Correct endpoint, role, database, key/project association and current validity | UNVERIFIED |

**HISTORICAL / CODEX-REPORTED — canonical resource boundary:** the existing test project was approved for hosted Preview database use and intentionally shared Development/Preview test Storage. Local Development PostgreSQL remains separate; Production needs clean, separate resources. See the [Master Context](MASTER_CONTEXT_UPDATED.md) and [Source of Truth](SOURCE_OF_TRUTH_UPDATED.md). Vercel environment separation and the owner's connection-origin confirmation do not independently establish physical resource isolation or current hosted authorization/Storage acceptance.

## Build configuration

The following rows are **SCREENSHOT-VERIFIED**, attributed to the owner's Vercel capture.

| Setting | Recorded baseline |
|---|---|
| Framework | Next.js |
| Root directory | Repository root |
| Build / install / output / development commands | Vercel defaults |
| Ignored Build Step | Automatic |
| Node.js | 24.x |
| Build machine | Basic |
| On-Demand Concurrent Builds | Disabled |
| Deployment Checks | None configured |
| Rolling Releases | Disabled |

**HISTORICAL / CODEX-REPORTED — 2026-11-06 local source inspection:** [package.json](../package.json) declares Next.js `16.4.3`, React/ReactDOM `19.2.4`, `build: next build` and `start: next start`; it has no `engines` pin or root install/build lifecycle hook that invokes migration, initialization, reset or seeding. The database seed/bootstrap/cleanup scripts are separate commands. No tracked `vercel.json`, `.nvmrc` or `.node-version` was found. [next.config.ts](../next.config.ts) was inspected; no configuration was changed. These observations do not audit every dependency installation side effect or prove live command defaults.

**Compatibility reuse:** Node.js 24 remains the accepted Dashboard baseline. Reuse relevant passed build evidence and perform focused checks when dependencies/runtime/build configuration change. The S3.4B.3 handoff retains a successful isolated build with synthetic non-routable settings; it does not establish hosted connectivity. No application build or runtime check runs for the November 10 documentation task.

## Deployment protection

The following rows are **SCREENSHOT-VERIFIED**, attributed to the owner's Vercel capture; they are not fresh effective-access tests.

| Setting | Recorded baseline |
|---|---|
| Vercel Authentication | Enabled for all deployments |
| Password Protection | Disabled |
| Trusted Sources | Existing entry; identity and effective scope not established here |
| Trusted IPs | Disabled |
| Protection Bypass for Automation | Configured; secret never accessed or recorded |
| Shareable Links | No active links shown |
| Deployment Protection Exceptions | None shown |
| OPTIONS Allowlist | Disabled |
| Protected Source Maps | Enabled |

**UNVERIFIED:** effective current protection coverage, Trusted Sources scope, automation-bypass validity and actual authorized/unauthorized access behavior. Preserve protection during acceptance; use an approved authenticated access path. Dashboard settings do not establish application role/ownership authorization. Do not include bypass tokens, share tokens, credentials or raw screenshots in Git.

## Data API — standing security policy

**ALWAYS DISABLED** in Preview and Production, including development/testing use. Database migrations/runtime must use approved PostgreSQL paths, never depend on enabling the Data API. If observed enabled, stop and report; no automatic toggle. Separate private Storage safeguards still apply.

Accepted disabled-state evidence is the owner's November 9 Dashboard observation for `cbkplqkkjuoglpimwmib`; independent saved-state confirmation after reload remains **unconfirmed**. This limitation is not silently upgraded by the accepted scope. For an affected sensitive operation, use the [established evidence procedure](PHASE10_S34B1_PREVIEW_OPERATOR.md#current-data-api-evidence-procedure---not-executed); CLI attestations, SQL ACLs and HTTP 401/503 are not proof of the Dashboard service setting. No comprehensive Dashboard rediscovery is required for unchanged UI batches.

## CA certificate advisory

The owner-supplied November publication evidence identifies the visibility advisory as concerning the intended **public CA certificate**. That advisory alone is nonblocking and does not independently establish a TLS failure. It does not relax server-only handling, strict CA trust/hostname verification or target pins. A private key/credential disclosure, wrong certificate or actual TLS error requires separate investigation. No PEM/secret value was read for this task.

## Reusable synthetic Preview fixture inventory

**OWNER-CONFIRMED — supplied 2026-11-10; historical reusable test data, not a live query.** These identifiers confer no permissions. Verify only necessary current role/authority/status through an approved observation before dependent acceptance; never assume user 2 is still designated Main merely from its label.

| Fixture | Identifier |
|---|---|
| Admin | user `1`, `preview.admin@example.com` |
| Main Adviser | user `2`, `preview.adviser.e4a@example.com` |
| Student | user `3`, `preview.student.e4a@example.com` |
| Co-Adviser | user `4`, `preview.co.adviser@example.com` |
| Research group | `1` (`PreviewGroup` in historical handoffs) |
| Research paper | `1` |
| Historical submission | submission `4` / `v4`, Revision Required feedback |
| Later revision | `v5` uploaded and manually moved to **Under Review**; database submission ID not supplied |

Do **fixture lookup before fixture creation**. Reuse does not mean disposable history can be reset: preserve audit rows, feedback, submitted versions, notification history and Storage objects. Creation/cleanup and actual acceptance writes need explicit owner authorization. Do not infer v5 delegation, finalization or automatic assignment closure; current state is not freshly inspected.

## Accepted November 10 release evidence

**OWNER-CONFIRMED — supplied for this documentation checkpoint:** supervision commit `d564c3d8404d935843c0d0366ab9fff155b3c4cf` was pushed to `origin/feature/development`; protected Vercel deployment `5rwbC8SzqAt1wHRVhMxjbd1bL43M` was published. Its deployment-specific URL/independent Ready metadata were not supplied or fetched. The historical branch origin above remains a navigation reference, not a fresh SHA/alias check.

The [operator execution receipt](PHASE10_S34B1_PREVIEW_OPERATOR.md#s34b2c---verified-preview-execution-2026-11-10) records completed 0017/minimum runtime grants and independent durable readback; no migration is repeated. Hosted S3.4B.5 acceptance is **PARTIAL PASS / closed for the accepted scope**, with owner-confirmed PDF, recommendation, import and feedback behaviors. **NOT TESTED:** automatic closure of an Open Co-Adviser assignment during Main finalization. **Deferred:** full signed-URL expiry observation and Co-Adviser rich-text recommendation persistence. v5 remains recorded as Under Review with no inferred completion.

Earlier November 6 local SHA `4404f7db4f4bcad6ca0c24dc144f6c4389fc94de`, baseline-untracked and pending-publication statements were historical import evidence; they are superseded as current status. No deployment, hosted settings, secret values or database/Storage state were freshly verified here. Use [Prompt 2](THESISHS_PREVIEW_DEPLOYMENT_PLAYBOOK.md#5-prompt-2--guarded-preview-publication) for future publication; do not maintain a second release checklist in this baseline.
