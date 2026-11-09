# Phase 10.S3.4 UI: Co-Adviser workspace and recommendation reuse

Local implementation checkpoint, 2026-11-08 (Asia/Manila). **Compatible UI implemented; formatted Co-Adviser persistence BLOCKED.** No S3.4B, commit or deployment is authorized.

## Baseline and preservation

Verified `feature/development`, HEAD `ff95cd2f00a4ec0df80953c9c47132db2db59b1e`, 69 incoming pending paths and an empty index. Incoming bytes were captured under ignored `test-results/s34-ui/`; existing changes were extended only in the scoped paths below. Historical migrations, schema, journal, existing lifecycle/decision transactions and the server document signer are unchanged. The existing Main dashboard body remains byte-identical after its non-Main fallback branch.

Retained evidence, not rerun here: local development migration 0017 completed in the preceding separately authorized task; S3.4A recorded 13 authenticated synthetic integration groups; the owner reports 7/7 local supervision acceptance. These do not establish authenticated acceptance of this new UI. This checkpoint performs no database connection or write, migration, Storage request, provider delivery, environment change or Git write.

## Implemented behavior

- Non-Main Advisers receive Total Assigned, Open / Pending Review and Completed Recommendations cards and up to five recent delegated versions. Values use only their server-authorized assignment projection. Main overview data and rendering are retained.
- Research Groups falls back to a read-only delegated directory. It uses only `Group {id}`, assigned manuscript title/version/status and exact assignment links. It does not query Student membership directories or unrelated submissions. Existing Main group management remains unchanged.
- Assignment links use `/dashboard/adviser/submissions/{submissionId}?assignment={assignmentId}`. The server matches both IDs, the current active non-Main Adviser and the live designation. Other versions, other Co accounts and unauthorized roles fail closed. Completed/Closed assignments expose only minimal metadata and their author's own recorded recommendation.
- Main and Co detail pages reuse `ReviewWorkspace`, existing route CSS, `AuthorizedPdfPreview` and the shared PDF access controller. Desktop PWA uses the existing two-column layout; smaller screens and ordinary browser layouts stack. Co receives no version selector, official decision, group-management or Student-publication control.
- Signing authority is unchanged: Co requests use the existing exact-assignment action and 300-second server signer; Main review remains 1,800 seconds. Co's local explicit-renewal window is 240 seconds; Main retains 1,680 seconds. These windows do not revoke issued capabilities. Terminal Co views cannot request a new PDF.
- The Co workspace keeps the 20,000-character plain-text editor, with explicit review/confirmation, the existing recommendation action, uncertain-outcome handling and the shared unsaved-draft navigation guard. Completed recommendations are read-only. Browser Back/programmatic-navigation and already-issued-capability limitations remain.
- Completed recommendation cards offer **Use in Official Feedback** only while the exact official feedback form is editable. A new read-only service/action rechecks current Main authority, exact completed assignment and Under Review status. Its repository follows Main account/singleton/submission locking and performs no feedback or academic write; it adds no Co-account lock after the submission.
- Imports append a literal-text recommendation and labeled separator to the existing feedback document. Existing formatting and decision selection remain intact. Multiple distinct recommendations are supported; duplicate imports are prevented for the current draft. Imported content can be edited or removed. Reloading the delegation panel does not reset the form. An in-flight import cannot mutate a decision confirmation. Saving still requires the existing explicit Main confirmation and transactional authorization.
- Official feedback retains its 5,000-character limit. An import that would exceed it is rejected without changing the draft; the Main may add a shorter excerpt manually. Recommendations are never interpreted as HTML or as pre-encoded official feedback. Their original records remain unchanged.

## Rich-text persistence decision and smallest proposal

The existing `recommendation` column means bounded **plain text**. Its service validator rejects control characters, including the `U+001E` marker used by the official feedback document envelope. Reusing that envelope inside this column would silently reinterpret historical text and violate the approved compatibility restriction. The editor remains plainly labeled plain text; no formatting controls imply unsupported persistence. No editor library or migration was added or generated.

**BLOCKED: formatted Co-Adviser save/reload.** The smallest proposed additive design is a nullable, versioned `recommendation_document` JSONB column, with the existing `recommendation` value retained as canonical plain text. Old rows remain NULL and render literally; no backfill or interpretation of old content. A separately approved migration/service contract must bind document text to the plain-text value, bound document complexity/visible text to the Co limit, sanitize to the existing semantic run/list model, and persist both fields atomically on completion. Completed/Closed records remain immutable. Only then should the shared editor support formatted Co persistence and format-preserving import. This is a proposal, not a generated migration or execution request.

The deferred Main formatting defect was not reproduced in the focused toolbar/keyboard/import checks. The existing `FeedbackEditor`, codec and renderer remain unchanged; no broad editor rewrite or full browser-compatibility claim is made.

## Focused verification

- **PASS: 32 unit/service checks** across `s33-co-adviser.unit.cjs`, `s34-supervision-ui.unit.cjs` and `phaseP2C-feedback.unit.cjs`. Services/repositories use transaction doubles; concurrency cases are simulated, not PostgreSQL evidence. Coverage includes exact assignment/version/account scope, own historical recommendations, Main replacement at the import authority boundary, no academic writes on import, immutable terminal behavior, safe bounded appending and captured 300/1,800-second signer requests.
- **PASS: 2 selected legacy unit checks** for the Main review access window and document-action authorization.
- **PASS: 15 new synthetic Chromium groups** and **11 existing S3.3 component groups**, run sequentially. Actions, document signing and the iframe response are mocked; unexpected requests are blocked. No authenticated application, database or real PDF-provider acceptance is claimed. Desktop PWA, ordinary browser and 360px layouts, Light/Dark, draft guards, terminal states, formatting, multiple imports, explicit finalization and literal injection-looking text are covered.
- **PASS:** TypeScript with the root configuration and ignored test-result copies excluded; targeted ESLint without warnings; diff/whitespace checks. See ignored `test-results/s34-ui/verification.json` for final commands and preservation results.
- **FAIL:** no unresolved executed failures. Fixture resolver/provider mocks were corrected; screenshot inspection caught and corrected Co subgrid row alignment. A regression assertion now keeps PDF controls near their heading.
- **BLOCKED:** one feature boundary, formatted Co recommendation persistence, as described above.
- **NOT TESTED:** authenticated whole-application acceptance of these refinements; real PostgreSQL behavior of the new read path; real Storage/signed capability delivery and expiry; physical installed PWA/native PDF behavior; fresh production build or hosted Preview/Production. Existing accepted PostgreSQL matrices were not rerun.

## Exact phase files

Modified existing tracked files:

```text
app/dashboard/adviser/groups/page.tsx
app/dashboard/adviser/page.tsx
app/dashboard/adviser/submissions/AuthorizedPdfPreview.tsx
app/dashboard/adviser/submissions/FeedbackForm.tsx
app/dashboard/adviser/submissions/ReviewDraftBoundary.tsx
app/dashboard/adviser/submissions/[submissionId]/page.tsx
app/dashboard/adviser/submissions/review-workspace.module.css
docs/MASTER_CONTEXT_UPDATED.md
lib/utils/submission-pdf-access.ts
```

Extended incoming S3.3 files that were already untracked:

```text
components/dashboard/co-adviser-workspace.tsx
components/dashboard/main-delegation-panel.tsx
lib/actions/co-adviser.action.ts
lib/repositories/co-adviser.repository.ts
lib/services/co-adviser.service.ts
tests/s33-co-adviser-ui.browser.cjs
tests/s33-co-adviser.unit.cjs
types/co-adviser.ts
```

New phase files:

```text
app/dashboard/adviser/submissions/OfficialFeedbackDraft.tsx
app/dashboard/adviser/submissions/ReviewWorkspace.tsx
components/dashboard/co-adviser-groups.tsx
components/dashboard/co-adviser-overview.tsx
components/dashboard/co-adviser-review.tsx
docs/PHASE10_S34_UI_HANDOFF.md
lib/utils/co-adviser-workspace.ts
lib/utils/recommendation-import.ts
tests/s34-supervision-ui.browser.cjs
tests/s34-supervision-ui.unit.cjs
```

## Owner-led manual acceptance

1. As Main, confirm the existing dashboard, group-management and official review workflow remain available.
2. As an eligible Co, compare cards/recent items with actual assignments. Verify only delegated groups and exact versions are listed; another Co's links and unassigned versions must deny access.
3. In Desktop PWA, open an assigned version: PDF left and private editor right. Check browser/mobile stacking, keyboard focus, Light/Dark and native PDF behavior. This owner-led step may mint/read a real Storage capability; it is not authorized as agent automation by this checkpoint.
4. Enter a plain-text draft, cancel leaving/reloading and verify it remains. Review/cancel confirmation, then explicitly submit when intended; verify terminal history is immutable and new PDF signing closes.
5. As Main on the same Under Review submission, keep an existing formatted draft, import two completed recommendations and verify separators, literal characters and original formatting. Duplicate clicks must not duplicate content. Edit/remove imported text and check that nothing is saved until explicit final confirmation.
6. Verify an oversized import leaves the draft unchanged, recommendation privacy persists for Students, and finalized versions cannot import into a new official draft.
7. Confirm any final official decision only when intended, then verify only official feedback becomes Student-visible and recorded private recommendations remain unchanged.

These manual workflow writes and real Storage checks were not performed by this implementation task. **Single smallest next action:** owner reviews the non-mutating Co dashboard, delegated group listing and workspace navigation locally. Approve the separate formatted-persistence design only if that feature is still desired. Stop; no S3.4B starts automatically.


## S3.4 UI formatting defect correction (2026-11-09)

This focused correction supersedes the earlier not-reproduced formatting note for the submission boundary only. Entry: feature/development at ff95cd2f00a4ec0df80953c9c47132db2db59b1e, 84 pending paths and empty index. The owner reports Co dashboard, delegated groups, Desktop PDF review, terminal assignments, multiple imports and finalization UI PASS; formatted submission acceptance remains subject to the retest below.

### Confirmed cause and boundary

The editor/toolbar/codec produce the existing v1 envelope with an LF header. Native multipart FormData normalizes its newline to CRLF. The installed React Server Action transport copies FormData string fields into its multipart payload. The old decodeFeedback required an exact LF header, so createAdviserFeedbackAction -> createFeedbackSchema -> feedbackCommentsSchema -> validateFeedback rejected otherwise valid formatted documents before calling the service or persistence. The former S3.4 component fixture returned a mocked success directly and did not exercise this transport/validation boundary. Imports are not the root cause: plain feedback and plain imports pass; rich feedback fails without any import.

Safe redacted payload shape (synthetic content only):

~~~text
Editor:    \u001eTHESISHS_FEEDBACK:1\n{"version":1,"blocks":[{"type":"paragraph","content":[{"text":"[synthetic]","bold":true}]}]}
Multipart: \u001eTHESISHS_FEEDBACK:1\r\n{same versioned document}
~~~

### Minimal correction

The shared codec accepts only the existing v1 LF marker and its known CRLF multipart spelling, then uses the unchanged strict document schema. It preserves the existing encoded-size cap with an allowance for only the additional header CR. Existing normalization emits the canonical LF envelope before persistence and remains idempotent across Action and service validation. The safe semantic renderer recognizes both known spellings. Invalid/unknown markup still rejects, now with an instruction to use the supported toolbar or paste plain text; failed validation leaves the draft unchanged. No global newline replacement, arbitrary HTML interpretation, new format version, library, editor rewrite, migration or Co storage change. Editor state, import logic, Action/service authority checks and academic persistence code are unchanged.

### Exact affected files

~~~text
lib/utils/feedback-content.ts
components/feedback-content.tsx
tests/phaseP2C-feedback.unit.cjs
tests/s34-feedback-formatting.browser.cjs (new focused regression)
docs/PHASE10_S34_UI_HANDOFF.md (this append)
docs/MASTER_CONTEXT_UPDATED.md (handoff append)
~~~

### Verification and boundaries

- Before: native browser transport and the captured original codec reproduced Action-level rejection in all eight formatted variants, with zero service/persistence calls. Three plain variants passed. The corresponding new unit regressions failed before correction.
- After: 13 shared codec/transport unit checks plus 5 existing import/compatibility checks PASS (18 total); 17 focused synthetic Chromium groups PASS, including eleven valid submission variants, all supported toolbar marks/list types and paragraph breaks, single/multiple imports, editing imported text, explicit decisions, canonical saved-document equality and rendering after actual fixture page reload.
- Negative cases prove that unsupported attributes/blocks, malformed JSON and unknown versions cannot invoke persistence. A failed Action response preserves the rich imported draft and decision; feedback, status, paper status, audit, notification/push and cache state remain unchanged in doubles. A retry still requires explicit confirmation. The service independently rejects unsafe document attributes. HTML-looking legacy text remains literal and never executes.
- TypeScript, targeted lint without warnings and whitespace/diff checks PASS. Detailed source preservation and final results: ignored test-results/s34-formatting-20261109/verification.json. Synthetic screenshots and pre/post matrices are retained alongside it.
- No unresolved executed failures or database authorization blocker for this fix. Real authenticated local acceptance, actual PostgreSQL persistence/reload, hosted Storage/Preview/Production and physical PWA/browser coverage are NOT TESTED here. Native multipart encoding and the real Action/service/codec/rendering code are exercised; session/current-Main identity, persistence, notifications, push and cache invalidation use explicit doubles. No concurrency matrix or real database operation ran. The independent formatted Co persistence feature remains out of scope and blocked as previously documented.

### Owner retest and smallest next action

Refresh the local Main Adviser review page. On an intended synthetic Under Review submission, enter bold/italic/underline, bullet/number lists and paragraph breaks; import one or two completed recommendations; edit the imported text. Choose the intended decision, inspect Review & Confirm, then explicitly Confirm & Submit only when ready. Reload and verify both formatting and decision. Plain feedback should still work. If validation fails, retain the draft and report the message rather than clearing or replacing it. Previously failed validation did not commit a decision; verify the current submission status before a retry.

The single smallest next action is an owner-led formatted-feedback retest on the intended local synthetic submission. The agent has not finalized any development-database decision. Stop; no next phase, Git write or deployment.
