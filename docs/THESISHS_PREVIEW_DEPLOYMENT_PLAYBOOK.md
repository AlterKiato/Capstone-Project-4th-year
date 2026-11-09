# ThesiSHS AI — Lean Vercel Preview Deployment & Testing Playbook

**Established:** 2026-11-06 (Asia/Manila)\
**Audience:** Future ChatGPT project conversations, Codex agents, and the project owner\
**Purpose:** Ship small, reviewable feature batches to **Vercel Preview**, test the actual deployed system promptly, and prevent planning/audit/recovery work from becoming larger than the feature test itself.\
**Status:** Working project guidance; **not** proof of a live deployment or permission to perform unapproved operations.

**Repository import note (2026-11-06):** Adapted from the owner-supplied playbook. Historical conversation/source-review claims below are attributed to that supplied document; they were not independently reconstructed during this import. The configuration baseline retains its evidence limits, including the distinction between the reported screenshot count/scope and the code-backed variable inventory. Existing canonical Development/Preview test Storage sharing remains unchanged; no new resource-isolation verification is claimed.

> **Start here in future chats:** Read this playbook, then `docs/VERCEL_PREVIEW_BASELINE.md`, current `AGENTS.md` and relevant project docs. Check the *actual current Git state*. Treat the baseline as previously observed settings, not live assurance. For changes that do not affect deployment, database, storage, authentication, or environment configuration, use **delta checks** instead of rediscovering all Vercel settings.

## 1. Governing principle — capstone demonstration first, not enterprise preparation

**Deliver a working, safe demonstration of the Student–Adviser research workflow.** Prefer the smallest check that can detect a meaningful risk. Do not delay a low-risk Preview UI test behind a production-grade recovery exercise, exhaustive device matrix, generalized disaster plan, repeated architecture review, or a new test harness. Preserve authentication and authorization, isolate test activity from real user data, retain deployment protection, and require authorization for hosted writes.

**Scope test:** Before proposing more preparation, answer: (a) What specific failure could this prevent for *this batch*? (b) Does existing evidence already cover it? (c) What is the shortest safe test? (d) Is it a release concern rather than a Preview smoke-test concern? If no concrete incremental benefit, **stop preparing and test the deployed feature**.

**Time/token discipline:** One short readiness pass; one focused deployment; one focused smoke test. Prefer concise PASS / BLOCKED / NOT TESTED reports, exact evidence, and the **single smallest next action**. Do not create multi-phase reviews of a check already passed unless evidence changed. Keep the owner informed of blockers; don't repeatedly request the same screenshots or inputs.

## 2. Evidence from prior work, with limits

- **P.3A Push Feasibility Planning (available source):** Approved a capstone demonstration-first strategy; split implementation into small checkpoints, favor focused testing, defer enterprise-scale infrastructure, preserve necessary security and failure isolation. It explicitly warned against repeating feasibility/design phases without a genuine blocker.
- **Group Taskboard integration (limited access):** The owner reports that earlier group-taskboard Preview pushes worked using the Preview Supabase project. This is supporting historical context for reusing known deployment procedures, **not an independently reconstructed log of the entire chat**. Do not invent its exact commands, tests, or incidents. If that transcript becomes available, incorporate only confirmed lessons.
- **Current Batch A:** A previously excessive readiness gate stopped a UI/performance Preview push when an authenticated Vercel browser/CLI was unavailable, even though a later owner-assisted review established branch tracking, variable scopes, build settings, and protection. The lesson is to **re-use captured evidence with a lightweight change-sensitive gate**, not to weaken material safety controls.
- **Captured configuration:** `VERCEL_PREVIEW_BASELINE.md` was documented using owner screenshots. Evidence is marked screenshot-verified, owner-confirmed, historical/Codex-reported, or unverified. Never silently promote evidence levels.

## 3. Known Vercel Preview baseline (snapshot, not permanent truth)

| Item | Recorded understanding | Evidence / caveat |
|---|---|---|
| Repository | `AlterKiato/Capstone-Project-4th-year` | Owner screenshot |
| Production tracking | `main` | Owner screenshot |
| Preview tracking | Enabled for unassigned branches; intended `feature/development` | Owner screenshot; check for new overrides if relevant |
| Preview environment variables | 16 entries reported scoped to Preview and `feature/development` | Owner-supplied screenshot findings; exact row membership of the code-backed inventory remains unverified; **values masked** |
| Preview Supabase | Project `ThesiSHS AI`, reference `cbkplqkkjuoglpimwmib`, Singapore | Project identity screenshot findings; Preview/testing use owner-confirmed; canonical Development/Preview test Storage sharing retained |
| DB and Supabase URLs | Owner says Preview `DATABASE_URL` and `SUPABASE_URL` came from that test project | Owner-confirmed; masked values not independently inspected |
| Build | Next.js default commands, repository root; Vercel Node.js `24.x` | Screenshot; dependency compatibility still needs focused review |
| Protection | Vercel Authentication enabled for all deployments | Screenshot; do not bypass for automation |
| Production DB/Storage separation | Not independently established | **Unverified**; stronger checks mandatory before migrations or significant hosted writes |

Read `docs/VERCEL_PREVIEW_BASELINE.md` for the full evidence table; if the repository uses a different location, locate it without creating duplicates.

## 4. Risk-tiered deployment gate (match effort to change)

| Tier | Examples | Minimum checks | Avoid |
|---|---|---|---|
| **A — UI / read-only** | CSS, layout, sidebar, skeletons, read-only query optimization | Correct branch/commit; fast-forward; no unexpected deploy scripts; reuse branch/env baseline; focused build compatibility check if dependencies changed; Preview deploy + visual/auth smoke test | Full disaster recovery, exhaustive DB inspection, broad test suites, re-collecting unchanged screenshots |
| **B — Auth / data-writing behavior** | Login/session changes, submissions, feedback, repository writes, push enrollment | Tier A **plus** targeted authorization and data-integrity checks; confirm intended test resource; use pre-existing synthetic test data; bounded state-changing acceptance only with authorization | Full production resilience program, indiscriminate seed/reset |
| **C — Schema / infrastructure / sensitive resources** | Migrations, grants, storage policy changes, new DB target, secret scope, production routing | Pause for explicit approval; verify exact target/resource identity, migration SQL, compatibility and rollback/backup appropriate to risk; inspect impacted access policies | Automatic migration, unrestricted push, guessing masked values |

**Hard stops (all tiers):** Production is the deploy target; incorrect/unexpected remote commit; suspicious secret disclosure; automatic destructive DB step; known wrong DB target; cross-user authorization regression; or a requested operation would change hosted data beyond authorization. **Unknown non-critical metadata is not automatically a blocker** for a Tier A build-only Preview push when prior scoped evidence is consistent and no relevant configuration changed. State the residual uncertainty honestly.

**Do not equate push permission with permission for migrations, resets, test-user provisioning, submission/publication, real notifications, or production promotion.** Those remain separate actions.

## 5. Default batch workflow (efficient and traceable)

1. **Identify the delta.** List only files changed since the last approved/Preview-tested commit; classify tier. Record new env vars, packages, schema, CI/scripts, permissions and deployments. Do not rerun an entire feature audit already closed.
2. **Focused local verification.** Run lint/type/build checks relevant to the delta. Reuse previous PASS evidence unless code or environment affecting that evidence changed. If Vercel Node 24 and local runtime differ, validate declared runtime/dependencies quickly and let the actual Preview build provide the decisive hosted check.
3. **Git preflight.** Confirm `feature/development`, intended SHA, current remote fast-forward, no staged surprises and no secrets. A separate documentation-only commit may be appropriate, but **do not make a large new closure process merely to record the baseline**. No force push or `main` merge.
4. **Preview route check.** Read existing baseline and confirm no known changes to branch tracking or Preview scopes. If this batch changes env/DB/storage/hosting, verify that specific change. If owner screenshots are current and unchanged, don't insist on a fresh browser connector solely to duplicate the same observations.
5. **Push, only when authorized.** A push may auto-trigger a protected Preview build. Record the exact deployed SHA, environment, status and URL. A successful build is **not** acceptance.
6. **Smoke-test the affected feature.** Owner-led protected sign-in is valid when agents cannot access Vercel Authentication. Test the new functionality, one prior critical workflow that it could break, and relevant role restrictions. Use existing synthetic accounts. Record PASS / FAIL / BLOCKED / NOT TESTED with direct observation.
7. **Fix only discovered failures.** Isolate the smallest patch; focused retest; new reviewed commit/push with approval. After subsequent batches, rerun **targeted regression** against older batches touched by shared code. Perform broader integrated acceptance before production readiness.
8. **Handoff.** Give a compact status with SHA, URL/status, what actually passed, what remains owner-only, and one next task. No invented results.

### Minimum Batch A/early navigation Preview acceptance

- Protected Preview opens; Student, Adviser, Admin test-account login and logout.
- Student dashboard/submissions/workspace, Adviser dashboard/groups, Admin dashboard load; skeletons resolve; report observed delays rather than assuming DB read-count reductions are time gains.
- Installation and push controls appear in intended Settings/platform contexts (do **not** trigger real push unless authorized).
- Web/Desktop sidebar preferences and Mobile navigation destinations; basic drawer/keyboard close behavior and Adviser unsaved-feedback navigation guard where testable.
- No unexplained crashes, wrong-role access or incorrect database target. Mark physical installed-device coverage pending when unavailable.

## 6. Database safety without overengineering

**Standing owner security policy (2026-11-09): ThesiSHS AI requires the Supabase Data API to remain disabled in Preview and Production. Database migrations and runtime access must not depend on enabling the Data API.** No development/testing convenience or REST/PostgREST fallback overrides this rule. If enabled is observed, stop and report a policy violation; do not automatically toggle the setting. Record the correct project's dated Dashboard evidence and whether reload confirmed the saved state. Separate Storage services and their authorization gates remain unchanged.

For **Tier A** UI/read-only batches, reuse the owner-confirmed Preview Supabase assignment, verify no build-time migrations/seeds, and avoid hosted writes. Retain the documented Development/Preview test Storage sharing. Record that masked URLs and Production separation are not independently proven. **Do not demand a production-style backup/recovery drill merely to open a protected Preview UI.**

For **any hosted mutation** (including tests that submit PDFs, create taskboard records, enroll devices or alter research status), require a correctly identified test target and authorized synthetic records. For migration/schema/grant work, follow the stricter database procedures and separate approval. If the preview DB target is demonstrably wrong, stop. A protected Preview URL does **not** itself make DB writes safe.

## 7. Escalation and anti-loop rules

- Attempt unavailable authenticated browser/CLI integration **once**, document failure, then use owner-assisted evidence or owner-led acceptance. Do not repeatedly install tools, extract cookies, or request a bypass token.
- Don't run repeated full audits of the same unchanged deployment configuration. Record the baseline and investigate **deltas**.
- Don't declare a failure merely because a nice-to-have proof, metric, screenshot, or enterprise hardening document is missing. Distinguish **blocking risk** from **residual uncertainty**.
- If a blocker exists, name the exact impacted action and propose the **smallest reversible next step**; do not expand to unrelated redesigns, disaster-recovery engineering, or broad load tests.
- Production readiness is a different gate from **Preview testing**. Do not silently convert one into the other.
- Never claim `PASS` for hosted authentication, push delivery or actual installed PWA behavior based solely on local/synthetic tests.

## 8. Current handoff snapshot (refresh before acting)

- Approved UI/performance checkpoint: `4404f7db4f4bcad6ca0c24dc144f6c4389fc94de` on `feature/development`.
- Last reported remote HEAD: `dc6249c2032e404f38e1fb6cbc87bf9c8f179cae`.
- Current local documentation: `docs/VERCEL_PREVIEW_BASELINE.md` created as **untracked** by Codex; no staging/commit/push/deploy reported after creation.
- Owner screenshots captured Vercel Git/Environments, Preview variable names/scopes, Build & Deployment, Deployment Protection, and Supabase Preview project identity.
- Node.js 24 compatibility remains a focused check; the database/Storage Production separation is not independently proven; Preview acceptance is not yet performed.
- **Do not treat these as live current Git/hosted status.** Refresh before any action. No push, deploy or hosted mutation is authorized by this document alone.

## 9. Suggested new-chat instruction

> Read `docs/THESISHS_PREVIEW_DEPLOYMENT_PLAYBOOK.md` and `docs/VERCEL_PREVIEW_BASELINE.md` first. Follow the demonstration-first, risk-tiered Preview workflow. Avoid repeating completed feasibility, Vercel configuration, recovery or broad testing work without a specific changed risk. Use prior evidence with explicit confidence labels, run only relevant delta checks, preserve existing work, and distinguish build success from hosted acceptance. Ask for authorization only at real action boundaries (push, deployment, migrations, hosted writes, Production), not for every read-only step. For the current task, report the shortest safe path to Preview testing and any concrete blocker.

---

**Source limitations:** The P3A source was available and reviewed directly. The complete Group Taskboard integration conversation was not available in the accessible records; only owner descriptions and baseline references were used. Any detailed claim about that conversation requires the original chat/transcript.
