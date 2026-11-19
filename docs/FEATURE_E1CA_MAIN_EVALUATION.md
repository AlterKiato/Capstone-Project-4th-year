# E1C-A: Main Adviser evaluation implementation

2026-11-18, Asia/Manila. **CONDITIONAL PASS: Important acceptance pending.** Main-only implementation and offline/synthetic checks are complete. Migration 0022 is generated and **NOT APPLIED anywhere**. Real PostgreSQL and authenticated acceptance require separate authorization. E1C-B and E1D are deferred. This checkpoint supersedes only the proposed E1C placement/model in E1B-N; its historical evidence remains intact.

1. **Git and preservation.** Branch `feature/development`, HEAD `a9d4fa5ce75e1a4fc29cf95ea913b4a3d5c176b2`; index empty before/after. SHA-256 baseline captured before edits in ignored `test-results/e1ca/incoming-hashes.json`. Of 75 distinct incoming pending/historical files, 72 are byte-identical; the only changes are the three necessary integration files: schema exports, journal append, and migration-source helper extension. All 0000-0021 SQL/snapshot files and the historical 22-entry journal identity remain unchanged. All five protected files match before/after hashes below. No reset, stash, staging, commit, push, merge or deployment. Existing E1B implementation and unrelated pending work are retained.

   | Protected file | Before and after SHA-256 |
   | --- | --- |
   | `docs/MASTER_CONTEXT_UPDATED.md` | `BB72B97E82A7C1DCD1DF468218B2F58E9F974953291885E4C5FFC70773F736FE` |
   | `docs/PHASE10_STUDENT_EMAIL_OTP.md` | `DE6385DF2CB27B491AF0DE4366E72EC7ABCC9F2D57BAF6D77118780D2E49A44D` |
   | `docs/SOURCE_OF_TRUTH_UPDATED.md` | `827F92703F2B6BBC72ED2E6B577AA353890813F4E855EDBAE8F007D7F3EA135A` |
   | `scripts/groq-developer-test.cjs` | `59F684334A9782B812351B41AD6C98F573E30ACF6A366BA3E424F64BDB5F017C` |
   | `tests/ai-p212-developer-groq.unit.cjs` | `CB9B4E2BD582DADBCAB1049540B09E6D3A61FADD81CCF6DE16324B0E59F63A35` |

2. **Exact checkpoint file inventory: 21 paths.** Nine existing files changed:

   ```text
   app/dashboard/adviser/submissions/FeedbackForm.tsx
   db/migrations/meta/_journal.json
   db/schema/index.ts
   lib/actions/adviser-feedback.action.ts
   lib/repositories/feedback.repository.ts
   lib/services/adviser-feedback.service.ts
   lib/utils/review-confirmation.ts
   scripts/preview-migration-source.ts
   tests/phaseP3-events.unit.cjs
   ```

   Twelve new files:

   ```text
   components/dashboard/submission-evaluation.tsx
   components/dashboard/submission-evaluation.module.css
   db/schema/submission-evaluation.ts
   db/migrations/0022_submission_evaluation.sql
   db/migrations/meta/0022_snapshot.json
   lib/submission-evaluation.ts
   lib/actions/submission-evaluation.action.ts
   lib/services/submission-evaluation.service.ts
   lib/repositories/submission-evaluation.repository.ts
   tests/e1ca-submission-evaluation.unit.cjs
   tests/e1ca-submission-evaluation.browser.cjs
   docs/FEATURE_E1CA_MAIN_EVALUATION.md
   ```

   Other `git status` entries predate E1C-A. Ignored hashes, browser results and screenshots are under `test-results/e1ca/`. No dependency, environment, global style, sidebar, AI, Student or Co implementation file changed. The existing P3 notification test mocks were aligned with current Main authority/group helper names and the action's structured failure response; notification semantics were preserved.

3. **Template selection.** One compact Evaluation Criteria row immediately above Review Decision. Inactive state is approximately one 44px control row, with no empty fields or new tab. Assigned state shows the frozen name and Open Evaluation. The compact Radix chooser shows owned active template name/count/scale, explicit Select/Cancel, and no expanded criteria. Assignment/replace/clear uses the exact submission ID and expected assignment revision. Replace explicitly says it clears ratings; clear has a separate confirmation. Cancellation preserves scores. Source template revision is checked again under lock.

4. **Floating workspace.** Source inspection confirmed the existing AI Assistant has actual drag/resize infrastructure. This feature follows its fixed panel, theme tokens, header gesture and viewport conventions with a smaller implementation and no resizing or new library. One desktop non-modal window supports header pointer drag, arrow-key movement, viewport clamping on resize, Minimize/Close and Open Evaluation to restore. Coordinates are not stored. Mobile uses the existing Radix modal/focus pattern, fixed bounds and internal scrolling; dragging is disabled. Header/footer stay reachable with 30 criteria. Long titles occupy at most two visual lines while retaining the full accessible text/title. Close/minimize preserves ratings in the parent review state. Official confirmation hides the window.

5. **Persistence and snapshots.** Three additive tables: `submission_evaluation_assignments` stores append-only exact-submission generations, attribution and frozen JSON; a null snapshot is an explicit clear tombstone. Frozen JSON includes source template ID/revision/owner, name, full custom scale and ordered criterion IDs/names/descriptions/N/A permissions. Neither a mutable criterion FK nor redundant paper/group columns are stored. `submission_evaluations` references an assignment and the existing official feedback, uniquely; `submission_evaluation_items` contains each criterion's rating/N/A/reason/comment. Submission and reviewer attribution derive from assignment/feedback. Snapshot generations survive reusable-template edits/archive and Main replacement. SQL triggers reject UPDATE/DELETE/TRUNCATE on these three historical tables; replacement inserts another generation. Real trigger/catalog enforcement is pending PostgreSQL validation.

6. **Scale and N/A.** Strict shared Zod definitions accept 2-5 consecutive integer levels from 1, including custom labels/descriptions. No score is preselected. Every frozen criterion must occur exactly once; missing/duplicate/extra/foreign keys, forbidden points, forged totals and unknown fields are rejected. N/A is available only when enabled, requires a nonblank reason up to 2,000 characters and excludes that criterion from available points. Optional comments are bounded to 2,000. All-N/A is explicitly displayed as no applicable criteria, 0/0; no division or inferred grade. The server derives totals using the frozen maximum, independently of Approved/Revision Required.

7. **Official transaction.** `persistAdviserDecision` remains the sole finalization transaction. It retains paper advisory lock -> active Main account/singleton locks -> exact submission UPDATE lock and Under Review checks. It reads the current frozen assignment, checks revision and validates the complete payload before closing delegations. Result/items, feedback, corrections, submission/paper statuses and activity log use the same transaction. Unique result references and existing status serialization reject duplicate finalization. Failures roll back all official writes. No-template historical callers remain valid for never-assigned versions; after an explicit clear, the current tombstone revision is required to reject ABA/stale drafts. Existing post-commit push callback and in-app notification ordering are retained. The action returns a bounded failure message on rejected/uncertain transactions and retains the client draft; no automatic retry is added.

8. **Authorization.** Every new action resolves fresh current institutional Main authority through the existing uncached account/designation helper. Assignment reads and writes recheck account/designation under the established locks, scope through the exact submission/paper/group relation and require Under Review. New selections must be owned, active and at the expected source revision. A successor can retain a previously assigned snapshot but selection lists still use only their private templates. Former Main, Co, Student, inactive users and forged IDs gain no new authority. Student original-submitter feedback restrictions and Co private recommendation lifecycle are unchanged; no general snapshot/result read endpoint was added for them.

9. **Draft and confirmation.** Assignment persists server-side; ratings/comments/reasons remain in memory with an explicit reload-loss warning. No autosave or rubric browser storage is added. Rubric changes feed existing dirty/navigation protection; assignment requests feed pending protection. Feedback state is keyed by submission ID to prevent version reuse. Confirmation deeply copies/freezes the assignment, revision, assessments, general feedback, decision and corrections; changing any field invalidates a stale confirmation. The UI validates complete assessments before opening confirmation, which includes each rating/N/A reason/comment and derived points. Only the existing Review & Confirm Decision -> Confirm & Submit flow finalizes. Existing browser Back/programmatic-navigation limitations remain; no claim of comprehensive navigation interception.

10. **Migration artifacts and application.** Generated offline with `npx.cmd drizzle-kit generate --name=submission_evaluation`: `0022_submission_evaluation.sql`, `0022_snapshot.json`, and one appended journal entry. Custom append-only triggers are explicitly included in SQL; Drizzle's snapshot does not represent triggers. No existing table is altered. The new source helper pins 23 migrations, while the E1B helper remains bounded to its original 22 and all earlier helpers retain their existing identities. Aggregate source SHA-256: `43ee2f88850c7b5f360bd9f49565f5107da5fd1ab55734abd92e4718f9706c52`; SQL SHA-256: `6eede979948ac7cb2476b479c8a756101073e92a0e8d382120e2677afdfb3c24`. **0022 NOT APPLIED to local, disposable, Preview, Production or any shared database.** No database connection, schema push/reset/backfill, grants, provider/Storage configuration or Data API operation occurred. Future runtime privileges need narrowly reviewed SELECT/INSERT on the three tables and USAGE on two new serial sequences, alongside existing review prerequisites; none were granted.

11. **Offline tests.** 53/53 focused checks PASS: nine new E1C-A groups plus unchanged review-confirmation/PDF/formatting/revision tests and updated notification doubles. Actual new repository/service policy is exercised with SQL/transaction doubles: source snapshot stability, exact version, CAS replacement/clear, active Main/ownership/archive/status denial, scale/N/A validation, duplicate decision, no-template path and rollback injected at each official write/delegation closure. Snapshot comparison confirms the 26 existing table definitions are identical. Current-source TypeScript has zero diagnostics; targeted ESLint, `drizzle-kit check` and whitespace checks PASS. TypeScript used the configured compiler API with ignored `test-results/` copies excluded in memory; `tsconfig.json` was unchanged. No full E1B rerun or full Next production build. The browser harness compiles the actual React UI. Initial notification test failure was outdated dependency mocks; these were corrected and all 53 passed.

12. **Browser and visual evidence.** 11/11 bounded synthetic Chromium groups PASS: compact placement, chooser keyboard entry, explicit custom ratings/N/A/comments, pointer and keyboard movement, resized viewport clamp, minimize/close retention, confirmation visibility/transport/rejection retention, dirty link guard, Review/Revisions regression, replace/cancel/clear, synthetic persisted-assignment reload with score loss, no-template confirmation and 30-criterion scrolling. 1440px and 360px Light/Dark captures checked; representative desktop/mobile and long-title renders inspected. Footer controls remain reachable, mobile focus stays in the modal, and document width stays within the viewport. Zero browser errors/unexpected requests on the final run. Harness auth/data/action/routing are synthetic; assignment reload persistence is simulated in the fixture, not evidence of PostgreSQL persistence. Manrope remains configured in source; isolated screenshots use fallback fonts without font fetching. Initial filesystem/harness assertions and a Windows encoding edit failure were corrected before the final pass. Mobile semantic/focus and long-title layout defects were corrected within feature scope.

13. **NOT TESTED / important limits.** No execution of 0022, real PostgreSQL constraints/triggers/transactions/lock contention/permissions, authenticated Next/RSC/Server Action transport, real assignment refresh/finalization, lost commit acknowledgement, hosted deployment, physical devices or screen-reader speech. Owner visual acceptance remains pending. The normal local DB has only the previously authorized migration 0021: do not use new rubric actions or treat this checkpoint as local runtime activation. E1B/E1B-N local acceptance is owner-reported context; it was not independently repeated here. Test doubles and source inspection cannot establish durable database behavior. Preserve the existing Data API-disabled boundary.

14. **E1C-B / E1D readiness.** Stable assignment generations and criterion keys are available for a future separately scoped delegated recommendation model. No Co scoring, copying/aggregation of rubric scores, delegated snapshot reads or extra permissions were implemented. E1D can later read immutable official results through the existing feedback/submission relationship under the original submitter rule; no Student screen, read widening or result endpoint is implemented now. AI scoring remains absent. These are integration boundaries, not acceptance or authorization for either feature.

15. **Anti-clutter verdict.** PASS within synthetic evidence; owner acceptance pending. Accepted review/editor/tabs and shared Visual-V1.5 CSS remain intact. One small row appears when inactive, chooser stays compact, and the sole official action is preserved. Descriptions/comments use disclosures; criteria use separator rows rather than nested cards. Existing Manrope/themed surfaces, border/focus/action tokens and 44px touch controls were reused. The panel shadow expresses floating elevation; the modal overlay expresses focus capture. No decorative chart, badge, animation, asset or new design system. Anti-Slop During/project direction and React quality checks applied with dials 1/2/1. The review decision remains the focal action; mobile line clamping preserves working space. Full shell/authenticated visual acceptance is outside the synthetic fixture's coverage.

16. **Next owner action.** Review this implementation and generated 0022, then explicitly authorize a focused disposable PostgreSQL validation checkpoint with independent identity verification. Existing-local activation and subsequent owner-led authenticated acceptance require separate scoped migration authorization. No commit, publication or E1C-B/E1D work starts automatically.
