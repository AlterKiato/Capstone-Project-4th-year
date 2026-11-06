# ThesiSHS AI — Vercel Preview Configuration Baseline

Recorded: **2026-11-06**. Scope: reusable Phase 10 Preview configuration reference, based on the owner's supplied screenshot findings and confirmations, with a read-only repository check. This document does not authorize a push, deployment, provider change or database operation.

## Evidence and repository boundary

| Classification | Meaning in this baseline |
|---|---|
| **SCREENSHOT-VERIFIED** | Configuration reported as visible in the owner's Vercel or Supabase screenshots. This task received the owner's written capture of those findings; Codex did not inspect the original images or live dashboards. This label attributes the supplied screenshot evidence, not independent verification in this task. |
| **OWNER-CONFIRMED** | Explicit owner confirmation beyond what the screenshot establishes; not independently checked by Codex. |
| **HISTORICAL / CODEX-REPORTED** | Evidence retained in repository handoffs, or the local source/preflight inspection performed for this document. Each use identifies which applies; neither establishes current hosted configuration. |
| **UNVERIFIED** | Not established by the supplied evidence or local inspection; requires the relevant future check. |

**HISTORICAL / CODEX-REPORTED — local preflight on 2026-11-06:** branch `feature/development`; HEAD `4404f7db4f4bcad6ca0c24dc144f6c4389fc94de` (`feat(phase10): checkpoint UI refinements and dashboard performance`); working tree clean and staging index empty before this document was created. This is a local checkpoint, not a claim that this commit is deployed.

The [Master Context](MASTER_CONTEXT_UPDATED.md) controls implementation status. The [future release policy](SOURCE_OF_TRUTH_UPDATED.md#future-release-policy-owner-decision-2026-11-05) controls proportionate release checks. Reuse unchanged evidence, but investigate any contradictory current evidence. This baseline does not replace those canonical documents or expand their authorization.

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

**UNVERIFIED — future deployment targeting:** `feature/development` targets Preview only while no conflicting branch assignment, custom environment or deployment rule overrides that handling. Reconfirm the effective target before an approved push; branch naming alone is insufficient.

**HISTORICAL / CODEX-REPORTED — retained P.3F.4 handoff:** the [limited synthetic Preview Web Push closure](MASTER_CONTEXT_UPDATED.md#p3f4-web-push-closure-and-development-handoff-2026-11-05) records a Ready Preview at `f82a08105158713ffad5161c0235fac1d23327fd` and stable installed-PWA origin `https://thesishs-ai-git-feature-development-thesi-shs-ai.vercel.app`. That branch URL is distinct from a Preview custom domain. This task did not refresh deployment metadata or verify that the local HEAD is deployed.

## Preview environment variables — identifiers only

**SCREENSHOT-VERIFIED:** the owner-provided Vercel capture shows **16 variables**, scoped to **Preview** and restricted to **`feature/development`**, covering Web Push, Database, Supabase and Authentication. No values were accessed or recorded.

**HISTORICAL / CODEX-REPORTED — current local source inspection:** the identifiers below are supported by the checked-out code. The inventory contains 16 names consistent with those categories, but the supplied screenshot transcription does not enumerate every row. **UNVERIFIED:** exact one-to-one membership of this inventory in the screenshot, current live presence, per-variable scope and value validity. Do not infer those findings from the matching count.

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

**HISTORICAL / CODEX-REPORTED — current local source inspection:** [package.json](../package.json) declares Next.js `16.4.3`, React/ReactDOM `19.2.4`, `build: next build` and `start: next start`; it has no `engines` pin or root install/build lifecycle hook that invokes migration, initialization, reset or seeding. The database seed/bootstrap/cleanup scripts are separate commands. No tracked `vercel.json`, `.nvmrc` or `.node-version` was found. [next.config.ts](../next.config.ts) was inspected; no configuration was changed. These observations do not audit every dependency installation side effect or prove live command defaults.

**UNVERIFIED — next release compatibility:** perform a focused repository compatibility check for the actual Node.js 24 runtime and reviewed commit before deployment. Select checks according to dependency/configuration changes and existing evidence; use the project's isolated, credential-free build approach when needed. No package installation, build, application test or runtime connection check was run for this documentation task. Historical builds do not establish compatibility of a later checkpoint or current hosted settings.

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

## Reusable Preview deployment checklist

This is a future procedure, not execution approval. Follow the [owner's release policy](SOURCE_OF_TRUTH_UPDATED.md#future-release-policy-owner-decision-2026-11-05); a Git push may itself trigger deployment.

1. **Read this baseline and current handoffs.** Reuse unchanged settings and bounded evidence; contradictory current evidence takes precedence. Do not repeat complete configuration discovery or synthetic-account backup/restore setup for routine releases.
2. **Verify Git.** Record the current branch, exact reviewed SHA, working tree and index; preserve unrelated work. Confirm the intended release remains on `feature/development`.
3. **Review relevant changes.** Inspect the checkpoint diff for configuration, dependencies, database/schema/grants, Storage, authentication, push origin/keys and deployment behavior. Determine which existing focused checks and approvals apply.
4. **Reconfirm live targeting and assignments.** Confirm the correct connected repository/project, Production branch `main`, effective Preview handling of `feature/development`, relevant variable names/scopes and approved database/Storage assignments. Resolve conflicting branch/environment rules. Verify assignments privately without copying values into reports; keep operator credentials outside runtime. Reconfirm relevant protection settings and the installed-PWA origin when affected.
5. **Check automatic commands before triggering a build.** Review current package lifecycle scripts, build/install overrides and deployment rules for migration, initialization, reset or seed operations. Do not let an ordinary build perform an unsafe database operation. Schema source alone does not establish the hosted migration ledger or runtime grants; any required migration uses its separately approved, target-verified operator path. Add backup/recovery precautions for destructive changes under the existing policy.
6. **Run focused compatibility checks when necessary.** Establish Node.js 24 compatibility for the reviewed checkpoint, using relevant existing static/build checks and prior evidence where applicable. Do not substitute a local compile for hosted runtime/resource acceptance or launch a broad matrix without a demonstrated need.
7. **Push only the approved checkpoint.** Obtain the separate push/deployment authorization required by the handoff, accounting for automatic Git deployment triggers. Do not advance `main` or release Production as part of Preview work.
8. **Verify the resulting Preview.** Check the exact deployment SHA, Preview environment, Ready/build result and effective protection. Verify the intended branch origin and relevant runtime/resource configuration through approved checks; do not assume the newest local commit matches the deployment.
9. **Perform focused authenticated acceptance and regression checks.** Use approved synthetic accounts/data and owner-led visible workflows for changed behavior; use bounded sequential automation only when necessary. Record source/metadata evidence separately from owner/device reports. Retain deferred hosted authorization, Storage/expiry, broader device and reliability gates; Preview acceptance does not authorize Production.

## Remaining verification and this task's result

**UNVERIFIED for a future release:** effective live branch/deployment rules; exact current variable inventory, scopes and private assignment validity; current Node.js 24 compatibility; absence of newly introduced automatic database side effects; any required schema/ledger/grant alignment; effective protection/access; exact deployed SHA/environment and focused authenticated acceptance. Production isolation and retained production-readiness security/device gates remain separate. None of these checks was executed against hosted services in this task.

**Documentation result — PASS:** only `docs/VERCEL_PREVIEW_BASELINE.md` was created. The document was reviewed for unsupported claims and secret content; identifier/source checks, local file-link checks, credential-pattern inspection, `git diff --check` and the untracked document's `git diff --no-index --check` passed. HEAD is unchanged, the index is empty and the sole working-tree entry is this untracked document. No source/configuration/dependency edits, secret-value access, raw screenshot copies, database/Storage operations, provider changes, staging, commit, push or deployment occurred. Work stops at this documentation checkpoint; remaining deployment checks do not block its completion.
