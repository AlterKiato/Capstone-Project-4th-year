# E1B-N navigation and proposed E1C integration

2026-11-18, Asia/Manila. **E1B-N implemented locally; E1C/E1D are proposals only.** This handoff supersedes only the entry-point wording in the preserved E1B handoff. Earlier E1B-V1 PostgreSQL/authenticated evidence remains historical evidence for that executed source, not a rerun of this navigation checkpoint.

## 1. Git baseline and preservation

Branch `feature/development`, HEAD `a9d4fa5ce75e1a4fc29cf95ea913b4a3d5c176b2`; empty index; 25 incoming pending paths. The five protected paths are unchanged. Before/after hashes are recorded in ignored `test-results/e1bn/`. Only the submissions page and template action receive intentional integration edits among the incoming pending files; all remaining incoming files, template components, domain/service/repository logic, schema/migrations, existing tests and handoffs are preserved. No database connection, migration, account fixture, provider operation, staging, commit, push, merge or deployment.

## 2–4. Implemented navigation and access

One **Evaluation Criteria** item follows **Review Submissions** in the shared Adviser navigation. It reuses the existing checklist SVG path and unmodified sidebar layout, links, hover/focus/active styles, tooltips, compact rail, Radix Sheet and navigation-close/focus-restoration behavior. It is secondary in installed-mobile More, without another bottom tab. Student/Admin/Panel metadata is unchanged.

Canonical route: `/dashboard/adviser/evaluation-criteria`. A pathname route avoids query-aware active matching and extra Suspense/query plumbing in both shared navigation components. The exact scalar legacy `?view=templates` redirects there with Next's server `redirect`; other query values still render the submissions directory. Its redundant Evaluation templates link is removed. The directory/filter/detail routes and the manager's Back to submissions link remain intact.

The wrapper requires an authenticated Adviser role, then freshly checks institutional Main authority. Main receives the existing `EvaluationTemplateManager` and its existing initial list service. Successful template actions invalidate both canonical and legacy paths; mutation/authorization semantics are unchanged.

Other Advisers see a compact explanation that assigned criteria will appear through delegated submission reviews when assignment becomes available, plus a return link. This branch never imports/calls the private template-list service and never mounts manager/editor controls. No fake delegation or assignment is created. Other roles are redirected by the server role guard. Sidebar visibility grants no template authority; all existing server action/repository guards remain in place.

## 5. Exact checkpoint file scope

Changed:

- `lib/constants/dashboard-navigation.ts`: one path constant/item and existing checklist icon type.
- `app/dashboard/adviser/submissions/page.tsx`: legacy redirect and removal of redundant entry link.
- `lib/actions/evaluation-template.action.ts`: canonical cache invalidation, retaining legacy invalidation.

Added:

- `app/dashboard/adviser/evaluation-criteria/page.tsx`: guarded wrapper and truthful non-Main state.
- `tests/e1bn-navigation.unit.cjs`: focused offline integration checks.
- `tests/e1bn-navigation.browser.cjs`: isolated rendered navigation checks.
- `docs/FEATURE_E1BN_NAVIGATION_E1C_PLAN.md`: this implementation handoff and proposal.

Generated ignored evidence: `test-results/e1bn/`. Existing E1B and E1B-V1 harnesses remain unchanged. Their old secondary-link/query-render assertions describe the previous entry point; the new focused harness covers its replacement. Their CRUD and historical execution evidence is retained, not presented as current navigation acceptance.

## 6–8. Visual reuse and focused evidence

Four new offline integration groups PASS: role-specific metadata/bottom tabs/active matching; canonical role/Main gate and absence of Co list queries; exact legacy redirect versus unchanged directory; successful canonical/legacy invalidation.

Eleven existing focused navigation checks also PASS (`dashboard-navigation.unit.cjs` and `phase972-navigation.unit.cjs`): total 15 offline checks. Targeted ESLint for the six changed/added source/test files and `git diff --check` PASS. Current-source TypeScript has zero diagnostics, using the original compiler settings with ignored historical `test-results` copies excluded in memory. Plain `tsc --noEmit` does not pass: its broad existing include glob also checks stale copied applications/archived component snapshots under `test-results`, producing unrelated historical-source errors. No tsconfig or historical evidence was changed to hide them. No full build or E1B-V1 database suite was rerun.

Five synthetic Chromium groups PASS: Main keyboard/sidebar entry and manager; Submissions/Back/refresh/deep link/legacy redirect; 1440 Light/Dark and expanded/compact sidebar; 360 Light/Dark drawer, focus restoration and simulated installed-mobile More; non-Main information without private-list/CRUD and other-role navigation/route denial. Zero page errors or unexpected requests. Actual shell, route components, manager and CSS render; auth, data and Next routing are explicit doubles. No authenticated Next/PostgreSQL acceptance occurred here. Exact runtime redirects and physical installation/device behavior are not established by this synthetic router.

Agent inspected `sidebar-light-1440.png`, `sidebar-dark-1440.png`, `drawer-light-360.png`, `drawer-dark-360.png` and `co-adviser-360.png`. No clutter, horizontal overflow or clipped navigation labels was observed. Native controls, visible focus, existing touch targets and compact information remain. Manrope configuration is unchanged; the offline harness uses font fallback, so exact font fidelity is not claimed. No global CSS, new motion, card statistics, categories or editor redesign.

Anti-Slop During: Hard Gate/Purpose/Liveliness/Craftsmanship pass for the bounded rendered navigation, using the existing 1/2/1 direction. This is not comprehensive accessibility or hosted acceptance certification. The React skill review found no new client state/hooks, duplicate CRUD, unauthorized data fetch, broad serialization or dependency addition.

## 9. Migration 0021 and future LOCAL activation

0021 passed earlier only on the now-cleaned E1B-V1 disposable cluster. It remains unapplied to normal local development and hosted databases by the current owner handoff; no live database was inspected here. If normal development lacks the tables, Main management returns the existing unavailable/error state; navigation does not create or initialize schema. Co information does not require those tables.

**There is no reviewed existing-local 0021 executor in this checkout.** `migrate-local-workspace.ts` is a historical 0015/0016 administrator exception with a fixed older ledger and target; `migrate-preview-email-otp.ts` is Preview-only 0020; the disposable E1B-V1 harness deliberately creates its own cluster. None is an approved normal-local 0021 command. Do not relabel one, replay it or bypass the guard with `drizzle-kit push/migrate` or manual schema SQL.

The precise bounded procedure to prepare and then separately authorize is:

1. Review 0021 SQL/snapshot/journal and `evaluationTemplateMigrationSource()`'s 22-entry digest, preserving the immutable 0000–0020 prefix. Prepare a LOCAL-only guarded 0021 runner using established PostgreSQL/Drizzle tooling; keep preparation distinct from execution approval. No new runner is implemented here.
2. Privately resolve only the approved development connection. Require loopback/DNS verification and development environment. Independently verify database name/OID, server address/port, cluster control identifier, current/session operator identity and database owner against owner-approved LOCAL pins. Reuse the fail-closed local identity pattern; changed pins require owner revalidation. Hosted `verifyDatabaseIdentity` intentionally rejects development and cannot substitute for the local check. Do not print credentials.
3. Read the complete local ledger/catalog. Require exactly 21 matching hash/timestamp entries through 0020, absence of the two new tables, and expected existing schema. If older, stop and scope missing predecessors; if 22 matching entries already exist, verify and stop without reapplying; any mismatch/partial state stops for investigation.
4. Take and validate a private backup under established local safeguards (archive hash, inventory/full decode and disposable restore evidence as required). Capture aggregate row/catalog/constraint/index/sequence preservation fingerprints without exporting research/account content.
5. Obtain explicit execution approval for the exact local fingerprint, source digest and backup evidence, including the documented operator exception only if actually needed. In one bounded session take the established migration advisory/ledger locks and recheck identity/ledger/catalog under lock. Apply only pending 0021 through the installed Drizzle migrator, never raw schema shortcuts.
6. Before commit verify exact 22-entry ledger, both tables, constraints/FKs/indexes and unchanged existing rows/catalog/sequences. Review only necessary runtime access: header SELECT/INSERT/UPDATE, criteria SELECT/INSERT/DELETE, template sequence USAGE, existing authority-lock/audit prerequisites. Grant changes need explicit scope; no header DELETE, runtime DDL, browser grants or Data API enablement.
7. Independently reconnect and verify durable ledger/catalog/effective privileges. Lost/uncertain acknowledgement means inspect, not retry. Then perform separately authorized focused LOCAL Main/Co UI acceptance. No Preview/Production or Storage action follows automatically.

This is the required project-safeguarded procedure for a future reviewed runner, not a claim that an executable 0021 local migration has already been approved.

## 10. Proposed E1C persistence and authorization — NOT IMPLEMENTED

Prefer **two new tables and an extension of the existing recommendation row**, with bounded versioned JSON payloads using E1B's existing validators. No per-template sharing, second recommendation engine, grading or reporting subsystem.

| Proposed relation/extension | Minimum responsibility |
| --- | --- |
| `submission_criteria_assignments` | Append-only snapshot generations per exact `submissions.id`: source template ID/owner/revision, assigning Main ID, DB timestamp, and complete versioned template name/criterion keys/order/wording/descriptions/N/A permissions/custom scale. Unique `(submission_id, generation)`; a composite `(id, submission_id)` key supports exact-version FKs. Latest generation is current, resolved while holding the submission lock; no extra mutable current-pointer table is needed. |
| Existing `co_adviser_review_assignments` | Add nullable snapshot reference plus nullable bounded structured ratings/comments payload; require both or neither and exact matching submission. Old plain-text recommendations remain valid with null additions. Save typed assessment and the existing mandatory recommendation text in the same existing completion transaction. |
| `submission_evaluations` | One immutable finalized result per submission, unique official `feedback_id`, exact-version snapshot FK, finalizing Main/time and strict criterion ratings/comments/N/A reasons. INSERT/SELECT only at runtime; no finalized update/delete path. Existing feedback remains the official decision, not a second approval state. |

`submission_id` already identifies a frozen uploaded version; never assign by paper ID/latest-version lookup. Do not reference mutable live criterion rows as assessment history. Assignment must lock/read one current Main-owned active template and copy its complete, strictly validated scale/criteria atomically. Template edits/archive later affect future selection only. Reject client-supplied snapshots/owner IDs, stale template revision and malformed/reordered/duplicate criterion keys.

Persisted source ownership is provenance, not permission to browse that owner's library. After institutional Main replacement, the successor may inspect/retain an already assigned submission snapshot under their current submission authority, but cannot enumerate/edit/copy the predecessor's private templates. A new selection must use the successor's own active template. Former Main loses assignment/finalization authority. Previously assigned/finalized snapshots survive source archive and replacement.

No private-library query is added to Co flows. Assigned-definition reads require fresh active Adviser account, non-Main identity, own **open exact-assignment/exact-submission** delegation and existing eligible status; recheck at save. Cancel/closure/finalization removes new delegated access. Historical plain-text recommendation reads retain existing policy; a general snapshot endpoint must not use a completed assignment as an active capability.

## 11. Proposed Main/Co workflow and change handling — NOT IMPLEMENTED

Choose **within FeedbackForm after Start Review**, not inside Start Review. The latter remains the small existing Submitted → Under Review transition. Assignment itself never changes academic status. Existing general-text delegation can continue for Submitted/Under Review; structured controls appear only once a snapshot is assigned. No fake default assignment for old reviews.

Main opens one compact **Evaluate using criteria** disclosure, selects one owned active template, and explicitly assigns it to that version. Save a new immutable generation on replacement, including reselecting an edited template. Allow replacement until official finalization, with confirmation describing affected work and `expectedSnapshotId/generation` concurrency checks. Do not silently follow later source-template changes.

All active Co delegates for the version use the same current snapshot; each keeps their own existing delegation/recommendation row. Replacing selection makes old structured drafts stale: reject save, retain draft for copying, require reload and explicit re-rating; never automatically map old numeric values. Preserve completed recommendations and their snapshot references. Show previous-generation assessments as outdated; do not import/aggregate their ratings into the new official draft. Their text remains historical context. To request a new structured recommendation from an already completed Co assignment, explicitly redelegate using the existing new-assignment flow; never reopen or overwrite completed records. Pending open assignments can remain open and reload the new selection.

Main can inspect current compatible Co recommendations and explicitly copy selected ratings/comments into their editable draft. No automatic average, merge, overwrite, final result or status transition. Text-only recommendations remain text-only. Existing General feedback / Revision Required / Approved controls stay authoritative. Main need not wait for every Co; existing finalization closes open delegations transactionally.

For every criterion require exactly one legal frozen-scale point OR allowed N/A with a nonblank bounded reason; reject both/neither. Comments remain optional and bounded. Earned points are summed ratings; available points use **that frozen scale's maximum**, excluding N/A criteria. All-N/A yields “No applicable criteria” with zero available points, never division by zero or a grade. Scores never imply Approved/Revision Required.

Extend `persistAdviserDecision` in `lib/repositories/feedback.repository.ts`, not a new official finalize endpoint. Its current paper advisory lock → Main/account/singleton → submission UPDATE ordering, Under Review check, delegation closure, feedback/revision insertion, academic statuses and activity log must remain atomic with the new final result. Snapshot selection, Co completion and finalization serialize on the same submission; source-template locks follow existing Main/singleton ordering. Do not open a nested independent template transaction while holding review locks or acquire a Main account after a Co holds the submission. Concurrency/lock-order review is required before implementing SQL.

Bind confirmation to submission, current snapshot generation, typed ratings/N/A/comments, general feedback, decision and correction draft. Any change invalidates confirmation. Extend existing dirty/pending/unknown-outcome safeguards; stale server responses preserve the draft but cannot finalize against another snapshot. Notifications remain after acknowledged commit and never carry private recommendation content.

Students get finalized official results only through the current `getStudentFeedbackBySubmission` rule in `lib/services/student-feedback.service.ts`: active Student plus that exact submission's `submittedBy`, even when another Student shares the group. No draft/snapshot/library/Co recommendation read. Do not broaden this to group membership. E1D rendering remains separately scoped.

## 12. Proposed UI placement — NOT IMPLEMENTED

| Surface | Reuse and smallest addition |
| --- | --- |
| Main | Existing `ReviewTabs` Review panel and `FeedbackForm`, `review-workspace.module.css`, native controls and `ContextHelp`: one disclosure, one selector, compact criterion rating rows, comment disclosure, small earned/available summary. Existing final confirmation is the single official finalize action. Keep Revisions and Co-Adviser tabs; add no fourth evaluation workspace/tab/card. |
| Co | Existing `CoAdviserReview` / `co-adviser.module.css`, `ReviewWorkspace`, existing `ResearchDialog` confirmation and `submitCoAdviserRecommendationAction`: assigned read-only heading/scale, compact rating rows and optional comments above the existing private-text recommendation. One existing submit action, no library selector or official decision controls. |
| Student E1D | Existing `student-feedback-dialog.tsx`, `feedback-content` and version context: compact earned/available summary plus expandable criterion details beside existing official feedback. No private recommendation or additional dashboard card. |

## 13–14. Risks, owner decisions and review readiness

E1B's custom 2–5-point scale supersedes E1A's proposed fixed four points. E1C must freeze the full custom scale, avoid hard-coded 4, and preserve current Main/Co/Student authority. The append-only generation model avoids mutable history; JSON shape/limits plus cross-reference validation and exact-version FKs need real PostgreSQL tests in E1C. Multiple delegates and replacement must be tested against simultaneous recommendation/finalization, not merely hidden controls.

Recommended compatibility default for owner review: criteria remain opt-in; once selected, official finalization requires a complete current-snapshot assessment. Whether every institutional review must use criteria, whether all-N/A should be accepted, and final wording of superseded-recommendation warnings require approval in the E1C scope. Proposed choices above are recommendations, not implemented or newly approved policy.

The next additive migration would follow 0021 (normally 0022 if no intervening work); reserve no number or journal entry now. It must preserve existing recommendation lifecycle constraints/records and feedback semantics, with nullable additions for old text-only recommendations and no fabricated historical snapshots. Runtime grants, existing-target activation and publication remain separately authorized.

E1B-N is ready for owner source/visual review within its offline/synthetic evidence boundary. Normal-local management activation still depends on separately authorized 0021 preparation/application. E1C/E1D persistence, UI, migration generation and execution have not started.

Final preservation: 5/5 protected paths and 47 existing schema/migration/snapshot hashes are identical; 23/25 incoming pending files are byte-identical, with only the two declared integration edits. Final branch/HEAD match the baseline and the index is empty.
