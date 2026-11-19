# E1C-B: Co-Adviser criteria-based recommendations

2026-11-18, Asia/Manila. **CONDITIONAL PASS — Important acceptance pending.** Implementation and focused isolated validation pass. Normal-local activation and authenticated owner acceptance remain pending; the read-only preflight contradicted the reported local 0022 activation. No existing-local or hosted migration was applied.

## 1. Git baseline and preservation

Branch before/after: `feature/development`. HEAD before/after: `a9d4fa5ce75e1a4fc29cf95ea913b4a3d5c176b2`. Index remains empty. No staging, commit, push, merge, deployment, reset, stash or cleanup of incoming work.

Before-edit SHA-256 inventory: ignored `test-results/e1cb/incoming-hashes.json`, covering 97 distinct incoming pending/migration paths. Of these, 92 remain byte-identical. The five intentional integration changes are:

- `components/dashboard/submission-evaluation.tsx`: extract shared fields/window/confirmation without changing Main template controls.
- `components/dashboard/submission-evaluation.module.css`: Co-only compact wrapping/checkbox and recorded-details styles.
- `db/schema/submission-evaluation.ts`: composite unique key supporting the exact-submission foreign key.
- `db/migrations/meta/_journal.json`: append 0023; the reconstructed first 23 entries match the original journal bytes/hash.
- `scripts/preview-migration-source.ts`: pin 0023 while retaining all previous bounded source identities.

All 46 historical SQL/snapshot files through 0022 are byte-identical. Existing E1B/E1B-N/E1B-L/E1C-A/V1 handoffs and unrelated pending changes are preserved. The five protected paths match their incoming SHA-256 values:

| Protected path | SHA-256, before = after |
| --- | --- |
| `docs/MASTER_CONTEXT_UPDATED.md` | `bb72b97e82a7c1dcd1df468218b2f58e9f974953291885e4c5ffc70773f736fe` |
| `docs/PHASE10_STUDENT_EMAIL_OTP.md` | `de6385df2cb27b491af0de4366e72ec7abcc9f2d57baf6d77118780d2e49a44d` |
| `docs/SOURCE_OF_TRUTH_UPDATED.md` | `827f92703f2b6bbc72ed2e6b577aa353890813f4e855edbae8f007d7f3ea135a` |
| `scripts/groq-developer-test.cjs` | `59f684334a9782b812351b41ad6c98f573e30acf6a366ba3e424f64bdb5f017c` |
| `tests/ai-p212-developer-groq.unit.cjs` | `cb9b4e2bd582dadbcab1049540b09e6d3a61fadd81ccf6de16324b0e59f63a35` |

## 2. Local migration 0022 verification

**DISCREPANCY — independently verified read-only.** Authorized normal Development identity matched: database `thesishs_ai`, OID `16387`, cluster `7652422818440234372`, direct loopback `::1:5432`, login/current user/owner `postgres`. Explicit read-only transaction was verified `on`.

Actual ledger: **22 entries through 0021**, with exact source hash prefix. Expected: 23 through 0022. `submission_evaluation_assignments`, `submission_evaluations` and `submission_evaluation_items` are absent; consequently their 0022 constraints cannot be verified on this target. No writes, repair, schema push, backfill or 0022 execution occurred. Safe aggregate evidence: `test-results/e1cb/local-preflight.json`. The preflight exits nonzero intentionally on the discrepancy.

The owner's five E1C-A visual PASS results and subsequent local-activation report remain owner-reported evidence. Prior E1C-A-V1's 13 PostgreSQL / 6 authenticated workflow groups belong to their recorded disposable run; they are not rerun or reclassified here. This current database observation takes precedence for normal-local readiness.

## 3. Existing Co-Adviser architecture

Existing Main delegation, Co review and private recommendation paths remain in use. `co_adviser_review_assignments.submission_id` references an exact submission record; its paper and version are resolved from that record, never supplied as alternate client authority.

Main can delegate a version to multiple Co-Advisers. A partial unique index permits one **open** assignment per submission/Co pair. Completing an assignment writes its narrative once; existing service/CAS paths do not reopen or edit completed rows. Another recommendation requires a new Main delegation, retaining previous attribution, narrative and timestamps. Cancellation and official finalization close open delegations rather than deleting history. There is no separate recommendation-edit operation or configured expiry timestamp to extend.

The existing Main panel reads private completed recommendations. Existing “Use in Official Feedback” imports narrative with attribution into an editable Main draft. It does not publish feedback by itself. Existing PDF/delegation checks and routes are unchanged.

## 4. Exact implementation files

Changed application/source files:

- `components/dashboard/co-adviser-review.tsx`
- `components/dashboard/main-delegation-panel.tsx`
- `components/dashboard/submission-evaluation.tsx`
- `components/dashboard/submission-evaluation.module.css`
- `db/schema/research-supervision.ts`
- `db/schema/submission-evaluation.ts`
- `lib/actions/co-adviser.action.ts`
- `lib/repositories/co-adviser.repository.ts`
- `lib/services/co-adviser.service.ts`
- `lib/validations/co-adviser.ts`
- `types/co-adviser.ts`
- `scripts/preview-migration-source.ts`

New application modules:

- `components/dashboard/evaluation-workspace.tsx`
- `components/dashboard/co-adviser-evaluation.tsx`
- `lib/co-evaluation.ts`

Migration artifacts: `db/migrations/0023_co_adviser_evaluation.sql`, `db/migrations/meta/0023_snapshot.json`, appended `db/migrations/meta/_journal.json`.

New focused tools/tests: `tests/e1cb-local-preflight.cjs`, `tests/e1cb-validation.cjs`, `tests/e1cb-postgres.cjs`, `tests/e1cb-review.browser.cjs`. This report is the only documentation addition. Existing official feedback transaction, notification infrastructure, repository policies, AI/email code, Student UI, routes, dependencies and configuration files were not changed by E1C-B.

## 5. Assigned-template access

`getCoAdviserEvaluationAction` calls the existing layered Co service/repository scope. It rechecks active Adviser status, current Main designation, own exact delegation, open state and eligible submission status before reading the latest frozen assignment generation under the submission lock.

It reads only `submission_evaluation_assignments`; no Main working ratings, official results or private template-library query is needed. No assigned snapshot means narrative-only operation. Co cannot choose, replace, clear, archive, duplicate or enumerate Main templates. Existing Main-only template-service checks remain in force and were exercised against PostgreSQL.

## 6. Floating UI reuse

E1C-A fields, bounded draggable desktop window, mobile Radix modal, scoring preview and read-only confirmation were extracted into `evaluation-workspace.tsx`. Main retains its existing chooser/change/clear controls. The shared module imports no template-management actions.

Co gets one compact “Evaluation Criteria” entry with assigned name, optional “Include ratings” checkbox and “Open Evaluation”. Editing ratings opts in; opting out permits narrative-only completion. The floating panel has explicit ratings, optional comment disclosures, permitted N/A reasons, minimize/close/restore, Clear Ratings and Done / Return to Recommendation. No new dashboard page, permanent expanded rubric or second recommendation-submit action.

Ratings remain in memory. Existing dirty guards now include ratings and the inclusion choice. Review confirmation hides the working window, captures validated narrative/rating data and compares the current validated payload before the sole existing submit action. Cancel preserves edits. Unknown/rejected submission preserves the draft and requires an explicit reload/discard before retry. Mobile wrapping was corrected after screenshot inspection. Anti-Slop During mode and existing Visual-V1.5 theme tokens remain in use; the React checklist was applied.

## 7. Criterion scoring

The existing `assessEvaluation` validator is reused unchanged by this feature. Frozen custom maxima 2–5, explicit selection, exact criterion keys, optional comments, allowed justified N/A and denominator exclusion all use the same rules as Main. Missing/unsupported/duplicate/foreign criteria, stale revisions, forbidden/blank-reason N/A, simultaneous N/A plus numeric rating, forged totals and all-N/A completion are rejected.

The server derives totals and canonical item order inside the recommendation transaction. Clients send assessments, not trusted points. A persisted-result reader revalidates items against the original frozen definition and verifies stored totals before returning details. The bounded JSON capacity accommodates 30 criteria with maximum Unicode comments/reasons. No grade, threshold, average, approval rule or automatic academic decision was added.

## 8. Persistence and atomicity

The minimum extension is two nullable columns on the existing delegation/recommendation row:

- `evaluation_assignment_id`: reference to the original immutable frozen assignment row.
- `evaluation`: versioned JSON containing server-derived earned/possible points and canonical criterion assessments.

No duplicate submission/user/paper/feedback relationship or separate Co evaluation table. A composite foreign key binds the frozen assignment to the recommendation's existing exact `submission_id`. A CHECK enforces both-null legacy/narrative rows or a bounded, versioned completed result with positive possible points. Existing narratives need no backfill.

Narrative, rubric payload, completion timestamp and existing audit insertion use the same Co transaction. Validation runs before completion, and an audit persistence failure rolls the whole operation back. Existing completion CAS prevents two successful concurrent submissions. Notification delivery remains best-effort after commit.

## 9. Assignment changes and stale handling

Completed ratings retain the old assignment row, criterion keys, scale and texts. Staleness is derived by comparing its generation with the exact submission's current generation, including replacement/clear tombstones. No remapping, rewriting or deletion occurs.

Old in-flight structured payloads fail against the locked current revision. If Co submits first in a race, its valid result is preserved and becomes stale after replacement; if replacement wins, old submission fails without a partial recommendation. A new eligible delegation reads the new generation. Completed rows stay read-only through existing application paths. Narrative-only recommendations remain valid after assignment changes.

Existing lock order is retained: Co account → designation → submission → own delegation; no Main-account lock is acquired after the submission. Main replacement/finalization and cancellation serialize on the same submission. Account/designation/status/delegation checks are repeated under the established locks.

## 10. Main visibility

The existing private recommendation panel keeps narrative/author/state and adds a collapsed criterion summary: points and Current/Stale. Expanded details show original template name, source template revision, assignment generation, custom rating labels, comments and N/A reasons. Stale explanation is concise.

“Use in Official Feedback” remains narrative-only with existing attribution. No rubric-import action, automatic average, overwrite of Main ratings or official transaction expansion was introduced. Browser validation confirmed importing narrative leaves Main's own rating controls blank, then verified Main's independent ratings/confirmation through the extracted shared UI.

## 11. Authorization and privacy

Only current Main may assign templates or finalize official decisions. Co may read current frozen criteria and complete recommendations only for its own eligible open delegation and exact submission. Completed Co history is readable only through its existing own-history authority; Main private visibility remains under current Main checks.

Anonymous, Student, Admin, Panel, unrelated Adviser, another group's unassigned Adviser, inactive Co, promoted-to-Main Co, revoked delegation, wrong version and finalized submission were denied in focused service/database checks. Student feedback projection remains unchanged and does not return private Co narrative/comments/results. No new powers for Admin/Panel or group-membership-based access. No Data API/REST fallback, provider activation, Storage operation or privacy-policy change.

## 12. Migration artifacts and application status

Next available number was independently confirmed as **0023**. Generated with `npx.cmd drizzle-kit generate --name=co_adviser_evaluation`; reviewed ordering creates the referenced composite unique constraint before its foreign key. Snapshot matches the source definition; `drizzle-kit check` passes. Historical 0000–0022 SQL/snapshots and the journal prefix are preserved.

- SQL SHA-256: `86619dfff7d6caf9b7d862799d3450266e8f250c7a15f98f7c22cb7aed2f2889`.
- Snapshot SHA-256: `ce71c98e5e1b25bea3e65f290e58c3f106bdbe81ce75e1df7b12a07b54ac800a`.
- Complete 24-entry source digest: `f0140057433afdfb912e6da5d785086d16872eb2197de084b7e5e6ed49379f16`.
- Existing bounded 16/22/23-entry source identities remain unchanged; the 0022 helper still returns exactly 23 entries.
- **Applied:** final 0023 once, only to a newly initialized, independently verified disposable PostgreSQL cluster after the exact 23-entry prerequisite; fresh reconnect verified the 24-entry ledger and three new constraints.
- **Not applied:** normal local Development, Preview, Production or any shared/hosted target. No schema push/reset/backfill.

## 13. Focused tests and real database coverage

Final run: **16 PostgreSQL groups PASS, 0 FAIL**, using real PostgreSQL 18, guarded runtime client, actual Drizzle repositories and application services. Only request actor and notification delivery were injected. This is real database/service evidence, not credential-authenticated browser evidence.

Covered migration durability/legacy preservation; exact frozen reads/private-library denials; narrative-only behavior; all four custom scale sizes/N/A/comments; malformed/all-N/A atomic denials; injected audit failure rollback; maximum-size 30-criterion Unicode payload; role/inactivity/exact-version denial; revocation/status denial; stale history/new generation; concurrent duplicate completion; concurrent assignment replacement; concurrent cancellation; designation change; SQL composite-FK/nullable-pair enforcement; and unchanged Main official finalization with independent points/Student privacy.

Final-source commands:

```text
node --import tsx tests/e1cb-validation.cjs --execute setup
node --import tsx tests/e1cb-validation.cjs --execute database
node --import tsx tests/e1cb-validation.cjs --execute cleanup
node tests/e1cb-review.browser.cjs
npx.cmd drizzle-kit check
```

Targeted ESLint, current-source TypeScript (zero diagnostics; ignored output copies excluded in memory) and whitespace checks pass. No tsconfig edit, full previous suite rerun or production build.

Final run manifests/results are in ignored `test-results/e1cb/`, selected by `current-run.json`; browser results are `browser-results.json`. Initial harness-only failures were corrected: fault injection had to avoid validating prior successful audit rows; raw PostgreSQL JSON binding needed an explicit text cast; browser assertions needed stable criterion keys and the title container rather than text width. Final fresh-cluster execution passed without retry. The original smaller payload cap was increased before this final run to support valid Unicode bounds.

Disposable safety: no existing env connection string was consumed; generated credentials, new random owned database/directory, loopback-only port 55451, control-file/system identifier, SQL data directory, owner and database OID were verified. Initial automatic approval review missed the attached disposable authorization; the exact user-request clause was supplied and setup was subsequently approved. Windows required elevated `pg_ctl` for shutdown. Final cleanup independently verified the target, dropped only the disposable DB, stopped and removed its cluster, confirmed ports 55451/3061 free and erased generated secrets. No disposable server remains running.

## 14. Browser and visual results

**9 focused Chromium groups PASS; 0 console/page errors; 0 unexpected requests.** Actual changed Co UI, shared floating fields/window, Main recommendation panel and Main feedback form ran with synthetic Server Actions/data and bounded PDF/header/assistant shells. All browser requests were intercepted; no authenticated Next server, normal-local DB, Storage or provider was used.

Covered optional compact entry/no template management; explicit ratings/N/A/comments; keyboard/pointer window movement and minimize/restore; ratings-only dirty navigation; confirmed payload/whitespace normalization/latest edits; completed read-only display; no-template and opt-out narrative-only paths; incomplete-included rejection; failure/reload/discard behavior; historical stale Main details/narrative-only import; and Main's independent current-generation scoring/confirmation.

Light/Dark captures at 1440px and 360px were generated. Inspected desktop Light, mobile Dark and Main stale-details images, then inspected the corrected compact mobile capture. No horizontal overflow, reachable footer and mobile modal focus containment passed. Captures: `co-evaluation-{light,dark}-{1440,360}.png`, `co-compact-dark-360.png`, `main-stale-recommendation-dark-1440.png` under `test-results/e1cb/`.

## 15. Known limitations

- Normal-local 0022 is absent. E1C-A/E1C-B runtime must not be treated as activated on that database.
- E1C-B credential login, authenticated Next/RSC/Server Action transport, real PDF integration and owner visual/workflow acceptance are **NOT TESTED** here. Prior E1C-A development stream/console limitations are not reclassified by a synthetic UI run.
- Hosted/Production, physical devices, screen-reader speech, exhaustive race schedules and lost-acknowledgement recovery remain **NOT TESTED**. Concurrent duplicate/replacement/cancellation and status-denial cases are the bounded executed coverage.
- Drafts are not autosaved. Browser Back/programmatic navigation retains the existing documented limitations; explicit page-link/reload guards were extended for ratings.
- Completed recommendations cannot be edited in place. New assessment needs a new eligible delegation. No new expiry policy was invented.
- Database CHECKs provide relationship/shape bounds; criterion semantics and completed-row immutability through application operations rely on the validated service/transaction path, as in the existing recommendation architecture.

## 16. E1D implications

E1D remains separately scoped and unimplemented. Future Student results should use finalized official results and the existing exact original-submitter rule. Private Co narrative, ratings, comments, drafts and Main template library must not become Student results. This feature adds no Student result endpoint/UI or visibility widening. No score import, aggregation or automatic decision is a prerequisite or authorized follow-on.

## 17. Next owner action

Review this implementation and migration 0023, resolve the normal-local 0022 discrepancy, then separately authorize the exact local migration chain if activation is desired. After activation, perform owner-led authenticated Co/Main acceptance, including current criteria, narrative-only completion, stale history and independent Main finalization. No local migration, Git write, Preview publication, E1D or other next feature starts automatically.

## 18. Final verdict

**CONDITIONAL PASS — Important acceptance pending.** E1C-B implementation, 16 real PostgreSQL groups, nine focused synthetic browser groups, static checks and preservation checks pass. Missing normal-local 0022 and unexecuted authenticated owner acceptance prevent a claim of local runtime acceptance. Stop after this report for owner review.
