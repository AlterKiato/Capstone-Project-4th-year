# ThesiSHS AI — Development and Protected Preview Playbook

**Updated:** 2026-11-10 (Asia/Manila). Canonical operating procedure for small feature batches. This document grants no execution permission. Current progress belongs in [Master Context](MASTER_CONTEXT_UPDATED.md); configuration and synthetic fixtures belong in the [Preview baseline](VERCEL_PREVIEW_BASELINE.md); incident causes and established remedies belong in the [prevention register](PHASE10_S34B1_PREVIEW_OPERATOR.md#preview-prevention-register).

## 1. Default: two prompts per feature batch

**Prompt 1 implements the approved feature and, only if explicitly authorized, creates one reviewed local commit. Prompt 2 publishes that pinned commit to protected Preview after explicit push/deployment authorization.** Owner-led acceptance follows publication, one action at a time. Simple batches may use one prompt containing both explicitly authorized checkpoints, conditional on every applicable gate passing. Two prompts are a default, not permission to cross a security boundary.

Read this playbook, the baseline, current `AGENTS.md`, Master Context and Source of Truth before release work. Inspect actual Git state and affected source. Treat dated handoffs as historical evidence, never reusable authorization. Preserve unrelated work. Prefer the smallest check that detects a concrete changed risk; reuse accepted evidence when its dependencies are unchanged. Do not turn routine UI work into a complete infrastructure or recovery audit.

## 2. Compact dependency check before coding

Record each row as **changed / unchanged / not applicable**, with only the affected prerequisite, existing evidence and next check. Resolve implementation dependencies before coding; do not connect to hosted services merely to fill this table.

| Dependency | Change-sensitive question |
|---|---|
| Schema and migration operator | Does the feature need a migration? Does the actual intended local database have it? Can the guarded Preview operator inspect and apply exactly that transition? Source files alone prove neither applied state nor operator support. |
| Grants and authorization | Which runtime permissions and current role/account/paper/assignment checks change? Prepare minimum-grant support and focused denial/integrity tests in the same batch. |
| Existing local/Preview data | Does current ledger or workflow state satisfy the feature? Reuse the baseline fixture inventory before proposing creation; do not reset history to fit a test. |
| Private Supabase Storage | Does upload/signing/path/TTL/policy behavior change? Development and Preview share test Storage; local PostgreSQL does not make a Storage workflow local-only. |
| Authentication and session | Are login, active-account/current-role checks, session lifetime or revocation affected? Test the changed boundary. |
| Environment and scopes | Any new/renamed variable, target, origin, routing or secret scope? Compare names/scopes only; reuse unchanged baseline evidence. |
| Notifications and providers | Any new recipients, privacy exposure, post-commit side effects or external calls? Keep failures isolated and Groq/Resend disabled. |
| Fixtures and acceptance | Which existing disposable account/paper/version and current status are needed? State safe actions, owner authorizations and deferred coverage before testing. |

For UI work also read `DESIGN.md` and `ANTISLOP.md`, apply approved During mode and retain themes, accessibility, routes and workflow semantics. Read relevant installed Next.js guides before writing application code. Preserve UI → Server Actions → Zod → services → repositories → Drizzle layering and server-side authorization.

## 3. Risk tiers and execution boundaries

| Tier | Scope | Minimum relevant checks |
|---|---|---|
| **A — UI/read-only** | Layout, CSS, read-only views/queries | Affected behavior, accessibility and query scope; focused static/build checks when relevant; Git and Preview routing delta. No comprehensive database audit. |
| **B — Authentication, permissions, data-writing** | Sessions, submissions, feedback, publication, enrollment | Tier A plus focused authorization/data-integrity regressions, intended test resource, reusable synthetic records and bounded acceptance prerequisites. |
| **C — Schema/infrastructure/sensitive resources** | Migrations, grants, Storage policy, secret scope, Production routing | Prepare reviewed operator support with implementation. Before execution require separate explicit approval, exact resource/target/source/ledger/grant checks and risk-appropriate preservation/recovery. |

Assign the highest applicable tier; a UI label does not hide a write or permission change. Preparation of an approved additive migration/operator is local work; an unexpected security-sensitive or destructive requirement stops at its applicable approval boundary.

Separate explicit authorization remains required for hosted migrations/grants, destructive or unbounded changes, new fixture creation/cleanup, push/deployment, sensitive configuration changes and all Production operations. Publication alone authorizes none of those other actions. Reusing fixtures is not authorization to mutate them. A single prompt can pre-authorize precise safe conditional steps; unmet gates stop only the dependent operation.

**Hard stops:** wrong/unverified sensitive-write target or Production isolation, unexpected remote/commit, secrets exposed, cross-user authorization failure, automatic destructive database step, or actions beyond approved scope. **Supabase Data API must ALWAYS remain disabled in Preview and Production, including testing.** If enabled is observed, stop and report; never toggle it or use REST/PostgREST as a migration/runtime fallback. Retain strict CA/hostname TLS, private credential-file safeguards, runtime/operator separation, private PDFs, audit/history and Deployment Protection.

Follow the [release policy](SOURCE_OF_TRUTH_UPDATED.md#future-release-policy-owner-decision-2026-11-05). Routine releases do not require repeated synthetic-account backup/restore setup. Existing guarded operators retain their own prerequisites: the 0017 backup gate and the historical 0016-only waiver are not interchangeable. Destructive work needs its separately approved recovery precautions.

## 4. Prompt 1 — implementation and local Git checkpoint

1. Inspect actual branch/HEAD/index/tree, approved specification and affected source/contracts. Identify dependencies using section 2, classify A/B/C and consult only applicable prevention entries.
2. Implement the complete approved batch. Prepare needed additive migration, operator compatibility, minimum-grant plan and acceptance support together. Keep hosted execution separately gated. Reuse existing Preview fixture inventory.
3. Run focused unit/integration and authorization checks, relevant lint/TypeScript and build checks. Include changed transport/persistence boundaries rather than only component mocks (for example multipart FormData normalization). Distinguish doubles, real local database tests and hosted evidence. No hosted test mutation without approval.
4. Inspect the diff for secret disclosure, authorization/schema regressions, install/build migration or seed side effects, and unintended changes. Fix routine test whitespace, documentation reconciliation and commit preparation in this same checkpoint. Update only affected canonical documentation.
5. If committing was explicitly authorized, review exact file scope, branch, parent, remote ancestry, staged diff and whitespace; create **one local commit**. Preserve unrelated modifications; no broad staging, push, merge or deployment. If committing was not authorized, leave edits unstaged and report that status.
6. Return SHA (or explicitly no commit), tier, validation and evidence limits, new variables/schema/operator/grant implications, fixture prerequisites, concrete blockers and the smallest next action.

Do not spawn a new planning checkpoint for routine corrections. A meaningful failure or unexpected sensitive/destructive dependency justifies a bounded stop and specific next step.

## 5. Prompt 2 — guarded Preview publication

1. Confirm explicit authorization covers **one normal fast-forward push and its automatic protected Preview deployment**. Pin exact local HEAD on `feature/development`; require clean working tree and index. Confirm origin URL, destination ref and fresh remote tip through an authorized read-only remote query/fetch; verify remote is an ancestor of pinned HEAD. Stop on drift/divergence; no force push, merge, rebase or `main` advancement.
2. Review only changes since the prior reviewed/published checkpoint: dependencies, scripts/CI, build/install overrides, routing, env, auth, schema and Storage. Reuse previously accepted repository/project, branch mapping, protection and variable-scope evidence in the baseline unless affected or contradicted. Verify only new/changed variables and routing; do not rediscover all 16 entries.
3. For schema-dependent code, establish that the **separately approved** migration and minimum grants are applied to the correct Preview target using applicable durable receipts/current delta checks. Source presence or a local migration does not suffice. If required state is missing/unverified, stop publication of incompatible code; do not run the migration under push approval.
4. Perform **one authorized fast-forward push** of the pinned commit to `origin/feature/development`. Observe the Git-triggered protected Preview build. Do not create an additional CLI deployment or retry a push after an uncertain result; inspect the remote/deployment first.
5. When accessible, verify deployed SHA, Preview environment, status, URL and protection. If access is unavailable, use the section 7 fallback and label each missing fact. A GitHub deployment-completed notification is a reported completion, not independent Ready/runtime acceptance.
6. Return pinned SHA, Preview URL, observed deployment status/provenance, configuration deltas and a short acceptance procedure: intended fixture, changed feature, one affected prior workflow/role restriction and remaining gaps. **Stop before executing the user workflow.** Do not automatically submit, finalize, delegate, enroll, publish records or clean up data.

A historical passed check is reusable evidence, not a claim that the present deployment was inspected. Missing noncritical metadata is not automatically a Tier A publication blocker when unchanged accepted evidence remains consistent. Exact deployed SHA/environment/protection may remain unconfirmed and must be reported as such; never turn that uncertainty into PASS.

## 6. Owner-led manual acceptance

The **owner performs hosted user-facing acceptance**. Codex gives **ONE action at a time**, with fixture/current-state prerequisite, expected visible result and any authorized mutation made explicit. Wait for the owner's **PASS / FAIL / BLOCKED** before the next action. A short overall checklist may accompany publication; execution remains sequential and owner-led.

Reuse safe historical synthetic records after fixture lookup. Obtain owner authorization for actual hosted mutations; fixture reuse does not permit resets. Preserve submissions, feedback, assignment/audit rows, notification history and Storage objects. Previously accepted tests repeat only when an affected dependency or contradiction justifies it. Focused technical verification remains useful for unit tests, authorization regressions and repeatable technical checks; whole browser user workflows are not the default. Necessary automation is sequential, bounded and resource-limited.

Record **local automated**, **owner-reported hosted**, **deployment metadata**, **BLOCKED** and **NOT TESTED/deferred** separately. Full device/reliability/security/expiry gates and Production readiness remain separate. A partial accepted scope can close as **PARTIAL PASS** while named coverage remains untested. Fix observed failures narrowly and obtain new commit/push approval when needed.

## 7. Anti-loop escalation

Attempt the approved authenticated inspection channel **once**. If unavailable, classify it as **TOOLING / EVIDENCE ACCESS**, then use accepted dated evidence or owner Dashboard screenshots where sufficient. Request only facts that evidence cannot establish. Continue the existing checkpoint when applicable gates pass; do not repeatedly repair unrelated browser tooling or duplicate accepted configuration checks. No cookie extraction, protection bypass or token request.

| Classification | Response |
|---|---|
| Application failure | Capture the affected behavior and repair/retest the narrow defect. |
| Configuration failure | Identify the wrong setting/target; obtain required configuration authorization before changing it. |
| Tooling failure | Use the one-attempt fallback above; do not label it an application defect. |
| Missing evidence | Name the exact required fact and smallest suitable observation; advisory gaps do not become blanket release gates. |
| Authorization/security failure | Stop the affected operation, preserve evidence and resolve the applicable hard requirement. |

The intended public CA certificate's visibility advisory is nonblocking by itself; it is not independent proof of TLS failure. Actual CA/hostname verification failures, wrong target, secret exposure or disabled-Data-API violations remain security gates. See the [incident register](PHASE10_S34B1_PREVIEW_OPERATOR.md#preview-prevention-register) for established resolutions and fresh-check triggers.

## 8. Reusable prompts (future instructions; no present authorization)

### Prompt 1 template — next R1 batch

```text
Read AGENTS.md, current Master Context/Source of Truth, the Preview playbook and baseline, relevant architecture/database guidance, and applicable prevention entries. Implement only this approved R1 specification: [paste exact approved paper-scoped milestone scope, roles, validation rules and exclusions]. Do not infer the entire R1-R3 roadmap as approved.

Inspect actual Git/source state; identify dependencies before coding and classify Tier A/B/C. Reuse current-Main/paper authority and existing architecture. Prepare any approved additive migration, guarded operator compatibility, minimum-grant plan and acceptance prerequisites in the same batch. Use the reusable Preview fixture inventory; do not create/reset fixtures. Read installed Next.js guidance and DESIGN.md/ANTISLOP.md when applicable.

Run focused relevant tests/static/build checks, inspect secret/authorization/schema regressions, correct routine test/documentation issues and update only affected docs. I authorize ONE reviewed local commit containing only this approved batch after applicable checks pass. Preserve unrelated work. Stop for an unexpected security-sensitive/destructive requirement. No push, deployment, database/Storage connection or hosted mutation, configuration change or provider call is authorized. Return SHA, validation/evidence limits, Preview dependencies and the smallest next action.
```

### Prompt 2 template — publish the reviewed R1 checkpoint

```text
I authorize ONE normal fast-forward push of reviewed R1 commit [full SHA] from feature/development to origin/feature/development in AlterKiato/Capstone-Project-4th-year and its automatic protected Vercel Preview deployment. Read the playbook/baseline/current handoff. Verify pinned HEAD, clean tree/index, destination, fresh remote ancestry and applicable delta checks. Reuse unchanged accepted Vercel configuration evidence; check only affected routing, scripts and new/changed variable names/scopes. Preserve protection; no force push or main change.

If R1 needs schema/grants, publish only after the separately approved exact migration/minimum-grant result is established on the intended Preview target: [receipt/reference, or not applicable]. Stop incompatible publication if missing; this prompt does NOT authorize migration/grant execution. Push once, observe the automatic deployment, and report URL, deployed SHA/environment/protection/status when accessible with evidence limits. Use the one-attempt tooling fallback.

Prepare a short owner-led acceptance procedure using existing safe fixtures, one action at a time when I begin testing. Stop before executing it. No hosted user-workflow writes, fixture creation/cleanup, Storage operation, sensitive configuration change, provider call or Production operation is authorized.
```

Replace placeholders before use. Schema execution can require an additional explicit authorization; the two-prompt default never waives it. The owner reviews this documentation checkpoint before authorizing a documentation commit or beginning R1.
