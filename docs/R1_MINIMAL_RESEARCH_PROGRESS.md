# R1 minimal research progress tracker

Local implementation checkpoint, 2026-11-11 (Asia/Manila). Approved Option B: paper-scoped milestones, existing submission evidence and explicit Main Adviser verification. This is not hosted acceptance or migration execution authorization.

## Behavior and authority

- The current active designated Main Adviser creates and edits a title and date-only deadline for an active group's paper. Historical `research_groups.adviser_id` does not grant this authority. The existing institutional Main designation applies across supervised papers.
- Active Students in the paper's active research group can view progress and link an existing version from that same paper. All group members may see version/status evidence metadata; no feedback, recommendation text, submitter directory, Storage path or signed URL is returned by R1.
- Every milestone begins incomplete. Submitted, Under Review and Revision Required evidence remains incomplete. Approved evidence displays **Awaiting verification** until the current Main explicitly confirms completion. This label is a derived milestone display, not a new submission status.
- Verification records the Main user, timestamp and exact linked submission ID. Uploading a newer version does not change that evidence or completion. A real title, deadline or evidence change clears verification; a no-op save preserves it. Revision checks reject stale forms. Transactional activity logs preserve prior/current evidence IDs and verification attribution when a requirement changes.
- Deadline dates follow the existing date-only display convention; overdue means an incomplete milestone whose due date precedes today's Asia/Manila date. Due today is not overdue. Progress shows a count, with **Milestones not configured** for an empty paper.
- Student access is inside the existing Submissions page after selecting a project. Main management is inside Research Groups, under the selected group's research project. Co-Adviser, Admin and Panel authority is unchanged. There is no independent upload, notification, reminder or feedback workflow.

Services validate inputs and resolve the current account. Repository transactions recheck active role, current Main designation or current group membership, active group and exact paper. Account/designation/membership locks stabilize authority; submission locks precede the paper lock to preserve official-decision ordering. Evidence is checked again under lock before verification. Milestone revision checks and atomic audit persistence prevent stale or partially logged changes.

## Additive migration and operator preparation

`0018_research_progress.sql` adds one `research_milestones` table, its serial sequence, paper/deadline index and title/revision/verification constraints. It also adds `submissions_id_paper_unique (id, paper_id)` before creating the composite milestone `(submission_id, paper_id)` foreign key. The extra UNIQUE is redundant with submission ID uniqueness but supplies PostgreSQL's required referenced key and enforces the same-paper evidence boundary. Existing submission/version uniqueness and all rows remain unchanged. No destructive SQL or seed data is included.

The repository ledger has 19 source entries, 0000–0018. This is source inspection only; the existing local project database was not queried. The retained hosted 0017 receipt establishes 18 entries within its dated scope, not a fresh hosted query. Migration 0018 is not applied to any project or hosted database by this checkpoint.

Reviewed 0018 source digest: `9cc94f061162696564eada77af9f67f1887f57b21c3df26ec595b60eafd07001`. It binds the complete migration hash/timestamp sequence, final snapshot and journal bytes; it is not a hosted target confirmation.

`scripts/migrate-preview-progress.ts` extends the established operator helpers with a separate bounded 0018 entry point. Imports, install and build do not connect or migrate. The legacy 0015/0016/0017 sources retain their exact pins and migration slices.

- Future inspection: `npx tsx scripts/migrate-preview-progress.ts --inspect`, only after separate hosted connection authorization.
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

The owner explicitly selected **offline tests only** on November 11. A proposed disposable PostgreSQL test did not run: the initial sandboxed attempt failed during `initdb` before server startup and cleanup completed; escalation was rejected by automatic approval review because database initialization/migration required explicit approval. The unexecuted harness was omitted after the owner's decision. **Actual PostgreSQL migration, canonicalization, concurrency and runtime acceptance remain NOT VERIFIED.** SQL-shape, transaction and catalog doubles do not establish those outcomes. This limitation is retained for the separately approved Preview migration/acceptance, not an outstanding request for local database permission.

No existing local/project or hosted database connection, migration, hosted workflow, PDF upload, protected Preview browser access or physical-device acceptance is claimed. S3.4B.5 remains PARTIAL PASS / closed for the accepted scope; its Open-assignment automatic-closure test and deferred expiry/rich-text limitations are unchanged. R2/R3 and every excluded R1 capability remain deferred.

## Owner-led protected Preview acceptance, after separate approvals

Use the [two-prompt playbook](THESISHS_PREVIEW_DEPLOYMENT_PLAYBOOK.md) and [fixture inventory](VERCEL_PREVIEW_BASELINE.md#reusable-synthetic-preview-fixture-inventory). Recheck only affected Main/account/membership/version facts. The known group/paper is 1, Main user 2, Student user 3 and Co-Adviser user 4; these are dated owner-reported fixture identifiers, not current authority proof.

1. Separately approve exact 0018 migration and two grants on the pinned Preview target, with Data API disabled-state evidence and durable preservation receipt. Do not repeat 0017 or change v4/v5, account history or Storage objects.
2. Separately approve the reviewed pinned commit's normal fast-forward push and automatic protected Preview publication. Stop publication before executing workflow acceptance.
3. Owner Main creates one milestone for the chosen authorized paper, then edits its title/deadline. Owner Student checks the selected paper, count, pending/overdue display and links an existing same-paper version. Revision Required/Under Review evidence must remain incomplete; Main verification must be unavailable/rejected.
4. Check foreign paper/group evidence denial and Co-Adviser inability to manage/verify, using already available authorized fixtures. Do not create extra fixtures automatically.
5. Explicit verification requires an existing genuinely Approved version of that paper. The known historical v4 is Revision Required and v5 is Under Review; neither is eligible. If no approved evidence is available, separately authorize the smallest synthetic paper/submission/review setup after fixture lookup. Preserve v4/v5 unchanged; do not infer approval or alter their history for this test.
6. Link approved evidence, confirm that linkage alone does not complete, then have Main explicitly verify. Check exact version and completed count. Relink to different evidence or edit the requirement and confirm completion clears; uploading a later version must preserve an unchanged verification. Inspect existing submission/feedback history.

Proceed one owner action at a time. Hosted mutations, fixture setup and migration/grants require their own scope; this document does not authorize them. After local Git closure, the smallest next release action is separate authorization for exact Preview 0018 inspection/migration/minimum grants. Obtain its durable receipt before authorizing Prompt 2 publication. Prompt 2 is not executed automatically.

## UI delivery gate

- PASS, scope/direction (R-23/R-37): existing academic design, themes and navigation reused; no new assets or navigation architecture.
- PASS, purpose/hierarchy: one compact paper-scoped list; title, deadline, actual version/status and explicit completion serve the approved workflow. No charts, decorative effects, percentages or invented metrics.
- PASS, controls/states (R-26/R-27/R-32/R-35): all four mutations and reload were clicked in synthetic Chromium; shared dialogs retain focus, Tab/Escape, labels and status feedback; empty/loading/denial states exercised. Hosted end-to-end behavior remains unverified.
- PASS, responsive/themes (R-03/R-25/R-34): 360px dark and 1280px light screenshots inspected, no horizontal overflow, inherited theme colors and 44px controls. New colors are not introduced.
- PASS, content/craft: real derived count/status semantics, no fabricated product claims or decorative statistics, no added animation; ENERGY 1 / RHYTHM 2 / MOTION 1 preserved. TypeScript/lint/build evidence and its limits belong to the checkpoint receipt.
