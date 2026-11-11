# R1 minimal research progress tracker

## UI-R1.1 Student Dashboard widget (2026-11-11)

**Status: implemented locally; focused validation recorded below. Hosted UI-R1.1 acceptance is NOT TESTED.** This is a bounded read-only UI refinement, not R3 or completion of deferred R1/R2 acceptance. Local checkpoint parent: `cb2e7d00bdb1864e84e089ecfe204619b493447a`; resolve the resulting commit from Git by its message `feat(ui): add student research progress dashboard widget`.

### Scope and unchanged dependencies

- One Research Progress card sits alongside the existing R2 Revision Checklist on wider Dashboard layouts; cards stack at 640px and below. Existing surfaces, spacing, typography, native compact progress indicators and contextual Help are reused. No unrelated Dashboard redesign or new UI dependency.
- One local Research project selector controls both cards. It uses the existing authorized directory, deterministic default and validated `?project=` context. No global/persistent selection system or cross-project aggregate. Switching remounts each project's data view; abandoned reads cannot replace the new selection.
- The R1 card calls existing `readResearchProgressAction` and its authorization-enforced service/repository. Only explicitly verified milestones count as completed. Existing `milestoneCompleted`, `completedMilestones` and `milestoneOverdue` rules drive the summary.
- Show selected title, completed/total, a compact progress bar, overdue incomplete count and the nearest incomplete deadline on/after the service's Manila date. Due today is not overdue; date ties resolve by milestone ID. All-complete and overdue-only data show no upcoming deadline.
- No milestones shows **Milestones not configured.**, without a misleading zero/complete progress bar. No-project, loading, safe error and working retry states are explicit.
- **View progress** opens `/dashboard/student/submissions?project=<id>#research-progress`, a focusable anchor around the existing R1 panel. R2 retains its existing project-specific Revision Checklist destination. Help explains Main verification and why submitting/linking a PDF alone is insufficient; native popover supports keyboard, Escape, pointer and touch.
- **Changed:** Dashboard presentation, local selection ownership, summary derivation and the existing Submissions anchor. **Unchanged:** schema/migrations (existing 0018/0019), grants, role/account/membership authorization, authentication, environment variables, Storage, providers, notifications and audit writes. No operator/schema work is needed. This is Playbook Tier A.
- All hosted records are untouched: Paper 1/v1-v5, v5 Under Review, official feedback, designations/recommendations, R1 milestones/evidence, R2 revisions/responses, notifications and audit history. Supabase Data API and Preview/Production isolation settings are unchanged; no database/Storage or hosted operation occurred.

### Focused local evidence

- `node --import tsx --test tests/ui-r1-dashboard.unit.cjs tests/r1-progress.unit.cjs`: **16/16 PASS** (five new presentation/route checks plus eleven existing R1 offline checks). Covers verification versus linkage, overdue exclusions, today/Manila midnight, nearest deadline/ties, empty/all-complete/overdue-only data and malformed/foreign project selection. Existing service doubles and real-repository SQL doubles cover active role/membership and exact-paper denial; these are not live database tests.
- `node tests/ui-r1-dashboard.browser.cjs`: **PASS**, one bounded sequential synthetic Chromium context using actual Dashboard and Submissions pages, mocked services/actions and blocked external requests. Shared selection, loading/stale-switch isolation, both actual project-specific navigation destinations, empty/no-project/error/retry, all/none-complete states, keyboard Enter/Escape/Tab and touch Help, 360/768/1440px layouts, Light/Dark/System, text contrast >=4.5:1 and 44px Help targets passed. Zero mutation calls, unexpected requests or browser/console errors. Desktop Light/Dark and narrow Dark screenshots were inspected.
- TypeScript with an ignored focused config excluding `test-results/`: **PASS**. The initial root command included a stale ignored R2 build snapshot with the old widget signature; no application type defect was found. Targeted ESLint: **PASS**, zero warnings.
- Isolated one-worker Next.js 16.4.3 webpack production build on Node 24.18.0: **PASS**, including TypeScript and 27/27 page-generation tasks, with no environment files and synthetic non-routable database/Storage settings. The final seven changed application/style files match the build manifest. This proves neither hosted configuration/connectivity nor authenticated Preview acceptance. The existing multiple-lockfile/root-inference warning remains nonblocking; no configuration change was made.
- Initial sandbox esbuild resolution failed before browser startup; the authorized isolated harness then passed outside that filesystem sandbox. A missing mock resolve directory was corrected before the passing run. No hosted fallback or protection bypass.
- Anti-Slop During-mode delivery gate: **PASS** for the scoped widget, with item-by-item evidence in ignored `test-results/ui-r1.1/design-gate.md`. ENERGY 1 / RHYTHM 2 / MOTION 1 and existing academic design retained. React review retained small serializable props, keyed project state, primitive effect dependencies and cancellation; no new cache/library or authorization duplication.
- Local artifacts only, ignored: `test-results/ui-r1.1/` (screenshots, browser evidence, typecheck config, build manifest/log/result). No credentials, environment files or generated artifacts belong in the checkpoint.

### Retained acceptance and next action

**R1 PARTIAL PASS, R2 PARTIAL PASS and S3.4B.5 supervision PARTIAL PASS remain unchanged.** All prior NOT TESTED classifications are retained. UI-R1.1 does not verify hosted Main completion/evidence changes, hosted structured-correction finalization, Action Taken persistence/transitions, real revision counts or historical response preservation.

After separately authorized protected Preview publication, the owner can perform read-only acceptance one action at a time:
1. Open the Student Dashboard for the existing authorized Paper 1; compare its milestone summary/deadlines with the existing Submissions panel, without changing records.
2. Use **View progress** to confirm the correct project/panel and preserved history; check **View revisions** still opens that project's checklist. Exercise project switching only if another legitimate authorized project already exists; otherwise defer hosted multi-project acceptance.
3. Open/close Help by keyboard/touch, then inspect narrow/wide layouts and themes. Do not create milestones, responses, projects or submissions to fill missing states.

Main Adviser progress discoverability remains a separately scoped deferred refinement. R3 is not started. Smallest next action: review this local checkpoint, then separately authorize its pinned fast-forward Preview publication. No push/deployment or hosted manual acceptance is included here.


**R1 — PARTIAL PASS / CLOSED FOR CURRENT ACCEPTED SCOPE**, owner-confirmed 2026-11-11 (Asia/Manila). Approved Option B: paper-scoped milestones, existing submission evidence and explicit Main Adviser verification. This closure records completed work and bounded acceptance; it authorizes no further execution.

## Current closure and evidence

- Implementation commit: `1fe763d51c42e444494dc632e7de34dcced153e4`, published to GitHub `feature/development`.
- Preview migration 0018 and exactly two minimum runtime grants: **PASS**, including installed catalog, 19-entry ledger and independent durable preservation verification. Reused receipt: `test-results/r1-preview-0018-20261111/postcheck.json`; no migration or grant is repeated for closure.
- Protected Preview deployment: `48w9yguhD2iDAH4n4ZccTYLTsyPF`, [served Preview](https://thesishs-7bysy8er1-thesi-shs-ai.vercel.app/). Publication completion evidence is retained under `test-results/r1-publication-20261111/`; authenticated application access and the results below are owner-reported, not independently executed browser acceptance by Codex.
- Local validation: **75/75 focused offline tests PASS**, with the existing synthetic Chromium/static/build evidence and limits retained below. No tests are rerun for this documentation checkpoint.

| Owner-reported manual check | Result |
|---|---|
| Main Adviser accessed R1 after locating its nested navigation | PASS |
| Main Adviser created a milestone with a deadline | PASS |
| Student viewed the milestone with correct permissions | PASS |
| Student linked existing submission v4 / Revision Required | PASS |
| Milestone remained incomplete after that linkage | PASS |
| Existing Approved evidence for Paper 1 | NONE available; prerequisite absent, not a verification PASS |

**Main navigation:** `/dashboard/adviser/groups` → expand `PreviewGroup` using **Details** → **Research Projects** → **Research progress for [actual paper title]** → **Create milestone**. Both the group and paper disclosures must be opened. There is no standalone milestone route or milestone panel on the submission review-detail page. Student access is `/dashboard/student/submissions?project=1`, with Paper 1 selected.

**NOT TESTED in hosted manual acceptance:** Main completion verification using Approved evidence; clearing verification when linked evidence changes. Isolated synthetic coverage does not establish either hosted behavior. Other implementation behaviors, including title/deadline edits, no-op preservation, newer-upload preservation and broader denial checks, are not promoted to owner-reported PASS by this closure.

**Preserved fixture and owner decision:** retain Research Paper 1, historical submissions v1–v5, v5 **Under Review**, all official feedback, the existing R1 test milestone linked to v4, and audit/notification history. The preceding authorized read-only readiness check found no Approved version for Paper 1 and no other existing paper. A new Paper 1 revision is blocked while its latest submission v5 is Under Review, even though the paper status remains Revision Required. Additional research projects and synthetic submissions are **deferred**; do not alter v4/v5 or official decisions to manufacture eligibility. No fixture creation, upload, cleanup or database/Storage operation is part of this closure.

The current testing cycle is closed at this partial scope. Completion testing may resume later, under separately authorized owner-led acceptance, when legitimately Approved evidence exists on the milestone's own paper. Another paper's approval cannot complete Paper 1's milestone. The smallest next development priority is to agree the scope of R2 revision management; R2/R3 remain unimplemented and require separate authorization. Deferred R1 completion checks remain available for later resumption without reopening or repeating accepted checks automatically.

## Behavior and authority

- The current active designated Main Adviser creates and edits a title and date-only deadline for an active group's paper. Historical `research_groups.adviser_id` does not grant this authority. The existing institutional Main designation applies across supervised papers.
- Active Students in the paper's active research group can view progress and link an existing version from that same paper. All group members may see version/status evidence metadata; no feedback, recommendation text, submitter directory, Storage path or signed URL is returned by R1.
- Every milestone begins incomplete. Submitted, Under Review and Revision Required evidence remains incomplete. Approved evidence displays **Awaiting verification** until the current Main explicitly confirms completion. This label is a derived milestone display, not a new submission status.
- Verification records the Main user, timestamp and exact linked submission ID. Uploading a newer version does not change that evidence or completion. A real title, deadline or evidence change clears verification; a no-op save preserves it. Revision checks reject stale forms. Transactional activity logs preserve prior/current evidence IDs and verification attribution when a requirement changes.
- Deadline dates follow the existing date-only display convention; overdue means an incomplete milestone whose due date precedes today's Asia/Manila date. Due today is not overdue. Progress shows a count, with **Milestones not configured** for an empty paper.
- Student access is inside the existing Submissions page after selecting a project. Main management is inside Research Groups, under the selected group's research project. Co-Adviser, Admin and Panel authority is unchanged. There is no independent upload, notification, reminder or feedback workflow.

Services validate inputs and resolve the current account. Repository transactions recheck active role, current Main designation or current group membership, active group and exact paper. Account/designation/membership locks stabilize authority; submission locks precede the paper lock to preserve official-decision ordering. Evidence is checked again under lock before verification. Milestone revision checks and atomic audit persistence prevent stale or partially logged changes.

## Additive migration and operator preparation (historical implementation scope)

`0018_research_progress.sql` adds one `research_milestones` table, its serial sequence, paper/deadline index and title/revision/verification constraints. It also adds `submissions_id_paper_unique (id, paper_id)` before creating the composite milestone `(submission_id, paper_id)` foreign key. The extra UNIQUE is redundant with submission ID uniqueness but supplies PostgreSQL's required referenced key and enforces the same-paper evidence boundary. Existing submission/version uniqueness and all rows remain unchanged. No destructive SQL or seed data is included.

The repository ledger has 19 source entries, 0000–0018. The original local implementation checkpoint did not query or migrate an existing project database. The separately approved Preview execution subsequently verified all 19 installed entries through 0018, as recorded in the current closure above; the existing local development database remains uninspected here.

Reviewed 0018 source digest: `9cc94f061162696564eada77af9f67f1887f57b21c3df26ec595b60eafd07001`. It binds the complete migration hash/timestamp sequence, final snapshot and journal bytes; it is not a hosted target confirmation.

`scripts/migrate-preview-progress.ts` extends the established operator helpers with a separate bounded 0018 entry point. Imports, install and build do not connect or migrate. The legacy 0015/0016/0017 sources retain their exact pins and migration slices.

- Any future inspection: `npx tsx scripts/migrate-preview-progress.ts --inspect`, only after separate hosted connection authorization. Preview 0018 is already applied; these operator rules are not instructions to replay it.
- Execution needs separate approval, an interactive terminal, the fresh target digest, the reviewed source digest and `--confirm-data-api-disabled yes`. Use `--execute --confirm-target <digest> --confirm-source <digest> --confirm-data-api-disabled yes` only within that approved operation.
- The runner checks the existing exact Preview project/database/cluster/operator pins and strict TLS through the existing configuration/identity adapters. It accepts only exact 18-entry pre-state or 19-entry installed inspection. Execution requires the pre-state and never replays an installed migration.
- Read-only preflight uses canonical catalog checks without temporary DDL. The write transaction takes the existing operator advisory/ledger guards and old-table writer locks, applies only 0018 through the installed Drizzle migrator, checks the new catalog and grants, and compares all old records, sequences, ACLs and definitions. Only the planned new composite UNIQUE/index is excluded from old-definition comparison; the exact new catalog verifies it separately. Independent durable readback follows commit; uncertain execution never triggers retry or recovery.
- Exactly two new grant statements: `SELECT, INSERT, UPDATE` on `public.research_milestones` and `USAGE` on `public.research_milestones_id_seq` to `thesishs_preview_runtime`. No DELETE, TRUNCATE, REFERENCES, grant option, schema privilege or existing-table grant expansion. Existing lock/read/audit privileges are required and checked. PUBLIC/anon/authenticated exposure is rejected.
- No new environment variable, Supabase/Vercel configuration, Data API access, Storage operation or provider activation is needed. Data API must remain disabled. Additive index creation briefly locks `submissions`; execute during a quiet synthetic Preview interval. Runtime publication before schema/grant completion is incompatible.

## Validation and limits

PASS: **75/75 focused offline tests**, including eleven new service/action/schema/repository-SQL/grant/orchestration tests, existing catalog/operator/source checks, the new 0018 canonical catalog case, current-Main/collaboration regressions, and existing submission/revision/approval coverage after its empty Co-Adviser fixture repair. Synthetic Chromium passed create/edit/link/verify/relink, empty/loading/error states, project switching, keyboard dialogs and 360px dark/1280px light layout with zero unexpected requests/page errors. Screenshots were visually inspected. TypeScript, targeted ESLint, `drizzle-kit check` and whitespace checks passed. Final isolated Next.js 16.4.3 webpack build passed on Node 24.18.0 with one worker, 27/27 page-generation tasks and exit 0. The snapshot excludes `.env` files and uses synthetic non-routable service settings; its Google Fonts fetch required the bounded network-enabled retry. Ignored evidence: `test-results/r1/`.

## Changed file scope

| Area | Exact paths |
|---|---|
| UI | `components/dashboard/research-progress.tsx`, `components/dashboard/research-progress.module.css`, `components/dashboard/student-research.tsx`, `components/dashboard/adviser-groups.tsx` |
| Schema/history | `db/schema/research-milestone.ts`, `db/schema/submission.ts`, `db/schema/index.ts`, `db/migrations/0018_research_progress.sql`, `db/migrations/meta/0018_snapshot.json`, `db/migrations/meta/_journal.json` |
| Domain/actions | `lib/research-progress.ts`, `lib/validations/research-progress.ts`, `lib/repositories/research-progress.repository.ts`, `lib/services/research-progress.service.ts`, `lib/actions/research-progress.action.ts` |
| Operator | `scripts/preview-progress.ts`, `scripts/migrate-preview-progress.ts`, `scripts/initialize-preview-database.ts`, `scripts/preview-migration-source.ts`, `scripts/preview-schema.ts`, `scripts/preview-catalog-contract.ts` |
| Focused tests | `tests/r1-progress.unit.cjs`, `tests/r1-progress.browser.cjs`, `tests/s34b2c1-preview-catalog.unit.cjs`, `tests/f1-research-mutations.unit.cjs` |
| Documentation | `docs/R1_MINIMAL_RESEARCH_PROGRESS.md`, `docs/MASTER_CONTEXT_UPDATED.md`, `docs/SOURCE_OF_TRUTH_UPDATED.md` |

The owner explicitly selected **offline tests only** for local validation on November 11. A proposed disposable PostgreSQL test did not run: the initial sandboxed attempt failed during `initdb` before server startup and cleanup completed; escalation was rejected by automatic approval review because database initialization/migration required explicit approval. The unexecuted harness was omitted after the owner's decision. The dedicated real local PostgreSQL/concurrency suite remains **NOT RUN**; SQL-shape, transaction and catalog doubles do not establish its outcomes. Separately approved Preview migration/catalog/grant verification subsequently passed, and owner-reported hosted acceptance covers only the checks listed in the current closure. These are distinct evidence classes, not a request for local database permission.

The original local implementation did not establish hosted or physical-device acceptance. Later Preview migration/publication and the owner-reported R1 subset are recorded above; full hosted completion and physical-device acceptance are not claimed. S3.4B.5 remains PARTIAL PASS / closed for the accepted scope; its Open-assignment automatic-closure test and deferred expiry/rich-text limitations are unchanged. R2/R3 and every excluded R1 capability remain deferred.

## Deferred owner-led acceptance resumption

Use the [two-prompt playbook](THESISHS_PREVIEW_DEPLOYMENT_PLAYBOOK.md) and [fixture inventory](VERCEL_PREVIEW_BASELINE.md#reusable-synthetic-preview-fixture-inventory). Do not repeat completed migration/publication or accepted manual checks. Before separately authorized resumption, recheck only affected current Main/account/membership and same-paper evidence eligibility. Current fixture references are Main user 2, Student user 3, group/paper 1; identifiers alone do not establish future authority.

When legitimately Approved evidence becomes available on the selected milestone's own paper, the owner can resume one action at a time: link that evidence and confirm it still awaits explicit verification; have Main verify and check the exact evidence/completed count; then change linked evidence and confirm verification clears. These steps remain **NOT TESTED** in hosted manual acceptance until performed and reported. Additional fixture creation is deferred, and this closure does not authorize it or any other hosted mutation.

## UI delivery gate

- PASS, scope/direction (R-23/R-37): existing academic design, themes and navigation reused; no new assets or navigation architecture.
- PASS, purpose/hierarchy: one compact paper-scoped list; title, deadline, actual version/status and explicit completion serve the approved workflow. No charts, decorative effects, percentages or invented metrics.
- PASS, controls/states (R-26/R-27/R-32/R-35): all four mutations and reload were clicked in synthetic Chromium; shared dialogs retain focus, Tab/Escape, labels and status feedback; empty/loading/denial states exercised. This fixture mounts the Progress panel directly and does not test the full Main navigation/group/paper disclosure path. Owner-reported nested access and the bounded hosted subset are recorded above; deferred hosted behavior remains unverified.
- PASS, responsive/themes (R-03/R-25/R-34): 360px dark and 1280px light screenshots inspected, no horizontal overflow, inherited theme colors and 44px controls. New colors are not introduced.
- PASS, content/craft: real derived count/status semantics, no fabricated product claims or decorative statistics, no added animation; ENERGY 1 / RHYTHM 2 / MOTION 1 preserved. TypeScript/lint/build evidence and its limits belong to the checkpoint receipt.
