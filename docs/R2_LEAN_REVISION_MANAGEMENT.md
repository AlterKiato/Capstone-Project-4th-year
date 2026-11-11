# R2 Lean Revision Management

## Current partial acceptance closure (2026-11-11)

**R2 — PARTIAL PASS / CLOSED FOR CURRENT ACCEPTED SCOPE.** This closure supersedes pending migration/publication/acceptance wording in the historical implementation and preparation sections below. It does not establish full hosted validation of the revision workflow.

**Reused accepted implementation/publication evidence, recorded as reported:** R2 implementation commit `cb2e7d00bdb1864e84e089ecfe204619b493447a` (`cb2e7d0`); 129/129 focused offline tests PASS; additive Preview migration 0019 successfully applied with verified runtime grants and backup integrity; GitHub branch publication completed; Vercel integration reported deployment completed; Preview authentication protection confirmed. Deployment ID: `4Bctp88wG6na7kSpKJgGwxhpKQoZ`; [branch Preview](https://thesishs-ai-git-feature-development-thesi-shs-ai.vercel.app/). Direct Vercel Dashboard Ready verification remains unconfirmed. No validation, hosted inspection or publication is repeated in this documentation checkpoint. Existing ignored receipts: `test-results/r2/`, `test-results/r2-preview-0019-20261111/`, `test-results/r2-publication-20261111/`.

**Owner-reported manual acceptance:** the owner reported exactly these four results; Codex did not independently reproduce them.

1. Main Adviser Review / Revisions / Co-Adviser tabs visible — PASS.
2. Tab navigation and existing review/delegation controls accessible — PASS.
3. Student Dashboard Revision Checklist widget displays its appropriate empty state — PASS.
4. Student widget navigation opens the relevant submissions area and Paper 1 history remains accessible — PASS.

**NOT TESTED in hosted manual acceptance:**

- Main Adviser creation and official finalization of structured revision items on hosted Preview.
- Student Action Taken persistence and Pending/Addressed transitions with actual revision records.
- Dashboard counts with real revision items.
- Historical response preservation after a later manuscript submission.

These scenarios remain covered by local automated tests but lack hosted manual acceptance. The four owner-reported passes do not validate the entire R2 workflow.

**Preservation and fixture decision:** preserve Paper 1 and submissions v1–v5, v5 Under Review, existing official feedback, Main/Co-Adviser designations and recommendations, the R1 milestone and its linked evidence, notifications and audit history. No additional test projects, uploads, revision items, responses or fixtures are authorized. Avoid unnecessary fixture creation; keep this accepted cycle closed and resume deferred testing only when legitimate eligible revision records exist and the specific owner-led actions are separately authorized. Do not infer v5 completion or alter history to satisfy a test. R1 PARTIAL PASS and Phase 10 supervision S3.4B.5 PARTIAL PASS remain unchanged; deferred R1 acceptance is not an R2 prerequisite.

**This checkpoint:** documentation changes and lightweight consistency/diff checks only; no application changes, tests, database/Storage access, provider/configuration or GitHub/Vercel operations, staging/commit/push/merge/rebase/deployment. Leave the three documentation changes unstaged and uncommitted. **Smallest recommended next development priority:** agree one bounded, separately scoped R3 requirement before implementation; this closure neither selects nor authorizes an R3 feature.

## Local checkpoint (2026-11-11)

**Historical implementation checkpoint:** the status and authorization below describe Prompt 1 at that time; the current partial closure above governs present status and next actions.

**Implementation complete; local validation PASS. Hosted migration, publication and owner acceptance NOT RUN.** Starting branch `feature/development`, parent `1fe763d51c42e444494dc632e7de34dcced153e4`. The authorized local checkpoint commit is `feat(r2): add structured revision tracking and streamline review UI`; resolve its SHA with `git log -1 --format=%H` after creation. No push, merge, rebase or deployment belongs to this checkpoint.

The three incoming, owner-reviewed R1 closure changes in `R1_MINIMAL_RESEARCH_PROGRESS.md`, `MASTER_CONTEXT_UPDATED.md` and `SOURCE_OF_TRUTH_UPDATED.md` are included intact. R1 remains **PARTIAL PASS / closed for the accepted scope**. S3.4B.5 supervision remains **PARTIAL PASS / closed for the accepted scope**; its deferred expiry/formatting/automatic-closure checks are not upgraded by R2 tests.

## Dependency assessment

| Dependency | Delta and evidence |
|---|---|
| Schema/operator | Changed, Tier C preparation: additive 0019, two tables, exact 0018→0019 operator and minimum grants. Real disposable PostgreSQL replay/catalog PASS; existing application/local and hosted database ledgers were not inspected or modified. |
| Authorization | Changed: current Main alone finalizes corrections; current active group Students read structured corrections and edit only their own responses. Fresh account/designation/membership and paper checks run under transaction locks. |
| Existing Preview data | Unchanged. Reuse the baseline inventory and accepted R1 closure: Paper 1 v1–v4 Revision Required, latest v5 Under Review. No backfill of checklist items or inference of v5 completion. |
| Private Storage | Signing, PDF upload transport, paths, TTLs and policies unchanged. Both existing database submission-persistence paths now freeze responses in their existing transaction. Tests use synthetic paths without Storage calls. |
| Authentication/environment/providers | No new variables, configuration, dependencies, recipients or provider calls. Existing login/session behavior, strict TLS and disabled Groq/Resend remain. Data API ALWAYS DISABLED; no REST/PostgREST fallback. |
| Acceptance | Read-only tab/draft checks can use existing eligible records. Full new-decision/resubmission evidence needs separately authorized suitable synthetic evidence; v4/v5 must not be mutated. Deferred R1 acceptance is not an R2 prerequisite. |

## UI and behavior

- **Shared:** research title, version, status, version navigator and existing secure PDF panel remain outside the tab content. Existing PDF handling and finalization services/actions are extended rather than replaced.
- **Review:** rich-text official feedback, decision, confirmation and recorded feedback. Decision controls appear once. Confirmation includes the exact ordered corrections. Approved explicitly excludes draft corrections.
- **Revisions:** Add/Edit/Remove draft corrections with optional page/section while Under Review; finalized cycles show immutable corrections and Student response history. Maximum 30 corrections, 2,000 characters each, 120-character references. Blank corrections prevent Revision Required finalization. Drafts are local to the existing review session, not autosaved.
- **Co-Adviser:** existing assignment, private recommendation and import controls. This panel loads on first visit and remains mounted. Review/editor and revision drafts remain mounted across tabs; inactive tabs do not initiate requests. Existing dirty-navigation guard includes revision drafts. The portaled unsaved-feedback toast hides when its anchor is in an inactive tab.
- **Student project:** Revision Checklist on the existing submissions page; existing project selector scopes it. Each active group member sees published structured corrections and only their own Action Taken responses. Full official feedback retains its existing original-submitter privacy. This R2 group-visible structured-correction scope follows the owner's explicit requirements; private Co-Adviser recommendations are not included.
- **Student Dashboard:** one compact Revision Checklist card. It defaults to the same authorized project ordering/valid `?project=` selection as the submissions view, offers a selector when multiple projects exist and links to `/dashboard/student/submissions?project=<id>#revision-checklist`. Counts cover that Student's saved responses in that project's newest correction cycle, including a labeled historical cycle when a later manuscript exists. Counts never aggregate projects or represent academic approval. Pending, all-addressed, empty/no-project, loading, error and retry states are explicit. No R1 dashboard widget was added.
- Context help uses native accessible button/popover controls with touch, keyboard and Escape dismissal. Consequences, validation errors, permissions and review status remain visible. No UI library, charts, scoring or new review/upload workflow.

## Persistence, permissions and history

`revision_items.feedback_id → feedbacks.submission_id → submissions.paper_id` is authoritative; no duplicate official feedback or submission records. Correction position and creation time belong to that feedback cycle. The existing official decision transaction inserts corrections only for Revision Required, closes eligible delegations, changes statuses and writes the audit entry together. Any correction/status/delegation/audit failure rolls back the entire transaction. No draft corrections are exposed before commit. There is no correction update/delete action or runtime grant.

`revision_responses` has one row per `(item_id, student_id)`, text, optimistic revision, updated time and optional `frozen_by_submission_id`. Nonempty trimmed saved text derives Addressed; empty text derives Pending. Addressed does not mean Approved. A Student cannot set another actor, edit an original correction or change official review status. Main can view responses; Co-Adviser/Admin/Panel receive no new editing power. Response audit entries record IDs/revision/state, not response text.

Response reads/writes use the same per-paper advisory namespace as manuscript submission, then account/current authority, active group/membership, submissions and paper locks. Editing is allowed only while the latest manuscript is the exact originating Revision Required submission, and only before its response is frozen. A stale expected revision fails without overwriting another save. Both existing submission paths freeze all earlier unfrozen responses to the newly committed manuscript ID in the submission transaction. A snapshot failure rolls back the new submission. Failed/cancelled upload intents do not freeze responses. Subsequent responses belong to a new official correction cycle; original corrections, feedback, responses and manuscript versions remain intact.

## Migration and future Preview prerequisites

`db/migrations/0019_lean_revision_management.sql` adds only `revision_items` and `revision_responses`, their two sequences, restrictive foreign keys, uniqueness/check constraints and one response index. It changes no existing table/row and performs no seed, backfill, drop or grant. The 20-entry journal/0019 snapshot preserves every historical migration/snapshot and the exact 0015–0018 source pins.

Prepared entry point: `scripts/migrate-preview-revisions.ts`, with `--inspect` and separately approved `--execute`. Import/build/install/start never execute it. It reuses pinned Preview target verification, server-only operator configuration, CA/hostname validation, Data API disablement confirmation, bounded transactions, exact ledger/catalog checks, legacy-table locks, migration 0019 only and existing-data/catalog/ACL/sequence preservation. Independent durable readback must confirm the 20-entry ledger, catalog and preservation digest. Uncertain execution never retries writes automatically.

Current source digest: `cb722c3a6e278f30255ae2ba6eed528cf47da9cb73692d24eec287a459480a0c`.

Exactly three proposed runtime grant statements, executed only under separate Preview migration/grant authorization:

```sql
GRANT SELECT, INSERT ON TABLE public.revision_items TO thesishs_preview_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE public.revision_responses TO thesishs_preview_runtime;
GRANT USAGE ON SEQUENCE public.revision_items_id_seq, public.revision_responses_id_seq TO thesishs_preview_runtime;
```

Checks reject broader table/column/sequence grants, grant options, PUBLIC/anon/authenticated exposure and correction UPDATE. No new environment variables or platform settings. **Do not publish schema-dependent R2 code before separately approved 0019/minimum-grant readiness is established on the intended Preview target.** No hosted operation was executed in Prompt 1.

## Validation and evidence limits

- **129/129 focused offline tests PASS:** R2 schema/transport/confirmation/service/action/repository-SQL/operator/grants, existing review/version/PDF access, direct-upload workflow, Co-Adviser/import and R1 regressions. Actual multipart decoding covers the new JSON correction field with the existing rich-text normalization. Transactional doubles verify correction/audit rollback and historical finalization. Eleven new R2 policy/SQL/operator tests are included; file-level historical harnesses also contain multiple assertions.
- Real PostgreSQL: task-owned isolated cluster on `127.0.0.1:55439`, with exact user/address/data-directory checks before a uniquely named disposable database. Full migration replay and canonical installed/new 0019 catalog, exact minimum grants/correction UPDATE denial, atomic correction/decision/delegation rollback, own-response save/clear, stale concurrent saves, response audit rollback, submission snapshot rollback, queued submission-versus-response ordering, both submission freeze paths, unchanged historical rows, Approved exclusion, cross-group/role/account denial all PASS. The cluster was stopped afterward. These are local synthetic database facts, not Preview acceptance or real Storage/PDF/provider evidence.
- One bounded synthetic Chromium context: actual Main/Student pages/components, mocked actions/data and intercepted requests. Three tabs/keyboard, no inactive requests, existing PDF control, draft retention/add/edit/remove/private import, native help/Escape, exact confirmation, failure retention, read-only finalization, Student save/clear/stale/frozen history, Dashboard project scoping/counts, empty/loading/error/no-project states, 360px/1480px Light/Dark and zero page errors/unexpected requests PASS. Responsive screenshots were visually inspected. Synthetic PDF iframe HTML does not verify a native PDF viewer.
- TypeScript, changed-file ESLint, Drizzle check, whitespace/source/secret checks and the isolated one-worker Next.js 16.4.3 webpack build on Node 24.18.0 PASS (27/27 page-generation tasks). Build uses no `.env` files and non-routable synthetic service settings; it proves neither hosted configuration nor connectivity. Initial stale test doubles and an omitted existing script in the build snapshot were corrected before the passing final runs.
- Ignored local evidence: `test-results/r2/` (focused test log, disposable-PostgreSQL result, screenshots, isolated build manifest/log/result). Initial approval review misclassified the current R2 request under the older documentation-only checkpoint; rereading the latest explicit test scope resolved the approvals. No bypass or hosted fallback was used.

## Historical owner-led protected Preview acceptance plan

This plan was prepared before publication and acceptance. The current partial closure above records the four owner-reported passes and the exact hosted scenarios still NOT TESTED; the plan does not authorize additional execution or fixtures.

Use the canonical two-prompt playbook. Give **one action**, expected result and any separately authorized mutation, then wait for **PASS / FAIL / BLOCKED**.

1. After separately approved migration/grants and publication, open an existing Main review without saving: shared PDF/header and Review/Revisions/Co-Adviser tabs. Confirm draft feedback/correction survives switching tabs and importing an existing private recommendation. Clear/discard the local draft; do not finalize v4/v5.
2. Read the existing Student Dashboard and selected project checklist. Historical feedback without structured items shows an honest empty state. Confirm other roles cannot open Main official authoring controls. These steps require no new fixture or decision.
3. **Dependency:** full R2 acceptance requires a separately authorized suitable new synthetic official Revision Required cycle and later manuscript. Do not create projects/accounts, manufacture Approved evidence, mutate v4/v5, reset Paper 1 or alter R1's milestone. The current v5 Under Review prevents another Paper 1 manuscript. Identify safe future evidence and obtain scope approval before this step.
4. On that approved evidence only, Main finalizes a small correction list; Student views it, saves/clears their own Action Taken and checks counts; a second authorized member confirms separate responses; next manuscript submission freezes previous responses; Main reads preserved history. Check one affected Co-Adviser/private-feedback boundary. Keep all academic decisions human-operated and version-specific.

Deferred: hosted R2 acceptance, native device/PDF compatibility, wider reliability/security/expiry coverage, exports/signatures, per-item Adviser approval, AI scoring/reminders, analytics and the R1 dashboard widget. R1's deferred Approved-evidence acceptance remains separate. Production and Prompt 2 do not start automatically.

## Anti-Slop delivery gate

PASS/FAIL below is bounded to local source, disposable database and synthetic Chromium evidence; hosted/device evidence is explicitly deferred.

- PASS R-02/17/18/23/24/28/36/38: short academic UI copy, real derived counts, no invented claims/testimonials/assets/FAQ, and an existing scoped submissions link. Synthetic fixture content is labeled synthetic.
- PASS R-03/25/32/34: 360px/1480px Light/Dark screenshots and overflow checks, keyboard tabs/labels/native popover dismissal; existing foreground/action/surface/focus tokens retained. No new theme behavior.
- PASS R-26/27/35: recorded click-through covers Add/Edit/Remove, tab/arrow navigation, help/Escape, private import, PDF control, confirmation/back/failure/success, response save/clear/stale denial, read-only history, project selector and reload; loading/error/empty/no-project states asserted. Browser requests are synthetic, not authenticated Next acceptance.
- PASS Purpose-Gate R-01/04/06/07/08/09/10/12/13/14/19/22: no added illustration, marketing decoration or animation. Tabs separate three real review tasks; compact ordered correction rows preserve version context; the single native progress bar represents only saved responses. Existing typography and surfaces serve readable academic work.
- PASS R-37 and Liveliness: approved `DESIGN.md`, ENERGY 1 / RHYTHM 2 / MOTION 1. Product-specific manuscript/version/correction/Action Taken content supplies identity; no new assets.
- PASS C-1–C-5 and R-05/11/15/16/20/21/29/30/31: functional, content-led composition; existing radii/palette/themes; concrete action labels, responsive states and documented evidence limits. No global redesign or library dependency.
