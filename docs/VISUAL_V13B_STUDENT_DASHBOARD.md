# Visual-V1.3B-Student: dashboard layout and content refinement

Date: 2026-11-16 (Asia/Manila). Status: **implemented locally; focused synthetic checks PASS; owner visual acceptance PENDING**. The owner approves the V1.3A-R backdrop, although Light remains slightly faint; it is preserved byte-for-byte here. Earlier Main/Co/Admin and Navigation/Responsiveness PASS remain owner-reported. This checkpoint does not close the previously rejected Student presentation without new owner acceptance.

## Baseline and scope

Verified branch `feature/development`, HEAD `0d2c0ef8b707207ffb61c68da006b307472e4f0a`, empty index. Incoming modified paths: `components/dashboard/admin-overview.module.css`, `components/dashboard/adviser-overview.module.css`, `components/dashboard/dashboard-shell.module.css`, `components/dashboard/student-progress-widgets.module.css`, `components/dashboard/student-ui.module.css`, `docs/MASTER_CONTEXT_UPDATED.md`, `docs/PHASE10_STUDENT_EMAIL_OTP.md`, `docs/SOURCE_OF_TRUTH_UPDATED.md`. Incoming untracked paths: `docs/VISUAL_V13AR_BACKDROP_CORRECTION.md`, `docs/VISUAL_V13A_DASHBOARD_PRESENTATION.md`, `scripts/groq-developer-test.cjs`, `tests/ai-p212-developer-groq.unit.cjs`.

All 679 incoming nonignored files were hashed. Work is limited to the seven Student source paths below plus this report. Incoming Student CSS is intentionally refined within the authorized scope; all other V1.3A/V1.3A-R work and unrelated authentication/Groq files remain byte-for-byte unchanged. Nothing is staged. No commit, push, merge, branch switch, deployment, database/Storage operation, email, AI call, dependency, configuration or schema change.

Read project design/agent guidance, current canonical handoffs and the V1.2/V1.3 reports. Installed Next.js guides support scoped CSS Modules and passing server-rendered content into Client Component slots. The existing React/component architecture and all server authorization/service contracts are preserved.

## Exact modified files

- `app/dashboard/student/page.tsx`
- `components/dashboard/student-progress-widgets.tsx`
- `components/dashboard/student-progress-widgets.module.css`
- `components/dashboard/student-ui.module.css`
- `components/dashboard/research-progress-widget.tsx`
- `components/dashboard/revision-widget.tsx`
- `components/dashboard/group-workspace-widget.tsx`
- `docs/VISUAL_V13B_STUDENT_DASHBOARD.md` (new)

## Existing inventory and findings

The page previously placed Research Group and Latest Feedback in a two-column overview, then placed Research Progress, Revision Checklist and Group Workspace in three equal-width columns. Group context came from `getStudentWorkspace`; Latest Feedback selected the latest allowed feedback across all returned submissions. Progress/revisions/tasks used their existing project-specific actions with a shared selector.

Problems: equal narrow columns gave primary progress the same visual weight as secondary tools; content-dependent card heights misaligned neighbors; each widget repeated the same project title; the group card repeated submission/project context; summary values lacked a dedicated hierarchy. Guidance was already available in Help popovers and must remain there. Missing progress percentages or academic stages cannot be invented.

## Before / after arrangement

| Area | New presentation | Preserved meaning |
|---|---|---|
| Group identity | Compact contextual row with existing member disclosure | All returned group identities, strand/section/year and member names/actions remain available |
| Project context | One selector above the dashboard content; a wrapped heading for a single project; direct View submissions link | Existing query/default resolution and local project selection; all project options retained |
| Summary | Two related cards stretch to equal row height: Research status and Submissions | Actual `project.status`; count of existing selected-paper submission records; latest stored version via the existing `resolveResearchTarget` ordering |
| Primary row | Research Progress gets a 1.4:1 column beside Latest Feedback; cards stretch together | Existing verified-milestone numerator/denominator, deadline and overdue information; feedback remains cross-submission |
| Secondary row | Revision Checklist and Group Workspace share a wider two-column row | Existing project-scoped revision counts, task-status counts, Help and direct destinations |

Summary cards use an 8rem minimum height on wider screens and can grow naturally; mobile uses 7rem. Detail cards have no forced fixed height. At <=900px the primary row stacks; at <=640px summary and secondary rows stack and controls reflow. The shell's navigation breakpoints, dimensions, installed-mode behavior, accepted backdrop and theme values remain untouched.

## Copy, data and academic semantics

Three repeated widget project headings are removed; a single project context drives all three. The oversized group card's repeated submission block is replaced by selected-project status/count/latest-version summaries. Latest Feedback gains concise source context: **Across your submissions**, original project title/version and review date. Its existing three-line preview and exact full-feedback link preserve access to complete content. No feedback selection or privacy filter is changed.

Only minimal existing-derived summary props cross the server/client boundary: ID, title, status, submission count and latest version. The server-rendered feedback card passes through the existing client composition as `children`; its source is independent of the selected project. No additional query, service, endpoint, browser storage or academic calculation is added.

The existing progress helper still controls milestone counts and deadlines; no percentage or inferred approval is introduced. A project can display Approved while its milestone bar remains incomplete when the existing milestone data says so. Addressed revisions are not Approved; workspace Done is not Main Adviser verification. Original explanatory Help, optional-verification notices, loading/empty/error states and retry controls remain intact. Neutral View submissions / workspace destinations provide quick access without guessing an academic next action.

Existing asynchronous cancellation guards and project keys remain. Tests cover changing projects while former-project requests are pending, preventing stale results from populating the new project. Summary values update from the same selected-project state; Latest Feedback remains the latest across allowed submissions.

## Styling, accessibility and review

Neutral cream/ivory or deep blue-black cards, existing text/status colors and Student shadows remain. Blue header markers group detail sections; existing meaningful icons identify summaries/tools. No global control/card rules change. A low-specificity base badge selector allows the existing academic dashed/colored-border rules to retain precedence. The group-member control receives an opaque existing surface after moving outside a panel; this protects action-text contrast over the accepted backdrop without modifying that backdrop.

**Anti-Slop During verdict: PASS for this scope.** Deliberate proportions and consistent summary sizing implement the owner's requested hierarchy rather than preserving the rejected narrow-card arrangement. No decorative icons, fabricated charts, motivational text, extra nested cards, new motion or arbitrary academic completion values. Contrast, keyboard controls and useful information take precedence; normal text remains at least 4.5:1 in the bounded checks.

**React delivery review: PASS.** Existing state/effect cleanup and project keys preserved; derived presentation values computed without effects; server data fetches remain parallel and unchanged; minimal serializable props plus a server-rendered content slot; direct existing imports, accessible labels/headings, native progress, retries and Help. No new subscription, async provider path or component framework.

## Focused validation and evidence limits

Ignored gallery: `test-results/visual-v13bs/index.html`, with representative Light/Dark desktop/mobile before/after screenshots, long-content and state screenshots, fixture scripts/HTML and `evidence.json`. The baseline is the incoming V1.3A-R Student presentation. The new synthetic fixture deliberately puts the newest feedback on project B while project A is selected, making cross-submission behavior explicit; counts/records are synthetic and differ from live data.

| Check | Result |
|---|---|
| Isolated real-component browser checks | PASS: 42 checked views, 28 state/interaction checks, 2,118 rendered-text observations, minimum 4.56:1, zero page errors/unexpected requests |
| Responsive hierarchy | PASS: Light/Dark at 360/640/641/900/901/1023/1024/1280px; matching summary-row heights, wider primary progress column, stacked narrow views and no horizontal overflow |
| Selection / navigation / async state | PASS: keyboard project switching, multi/single/query-selected projects, scoped summary/widget links, late former-project responses ignored, member disclosure, Help, drawer Escape/focus and installed-mobile navigation emulation |
| Feedback / progress semantics | PASS: newest feedback remains from another project after selection changes; full-feedback target retained; Approved project status does not automatically complete milestones |
| Content and states | PASS: long project/group titles and feedback; no group/project, no feedback/unavailable feedback, empty widget data, loading, denied account, widget errors and working retries |
| Other-role / backdrop preservation | PASS: six exact computed before/after Main/Co/Admin snapshots across Light/Dark; unchanged shell backdrop and stacking properties in representative Student views |
| `node --import tsx tests/ui-s1-student.unit.cjs` | PASS: 4/4 existing task-count, research-tab and Help-position checks |
| `node --import tsx tests/phase975-student.unit.cjs` | PASS: existing target resolution, cross-project isolation, denied account/role, member names, submitter-only feedback and minimized DTO with mocked repositories; no live database |
| Current-source TypeScript program | PASS: 402 roots, excluding 3,583 ignored historical build-source roots in memory; no compiler/configuration output. The historical unfiltered-command limitation remains unresolved |
| Targeted ESLint | PASS: five changed TSX files, no autofix |
| CSS / patch integrity | PASS: real CSS Modules bundled and rendered; scoped whitespace, UTF-8/separator integrity and SHA-256 preservation checks |
| Full build / broad historical suites | SKIPPED: focused source/fixture checks cover the scoped change; no new build/runtime or hosted claim |

The esbuild fixture used the established filesystem-read fallback; all services/actions/authentication are mocked and external requests blocked. Agent screenshot review covers Light/Dark desktop/mobile and long-content states. Fixtures use fallback fonts; configured Manrope remains unchanged. Native multi-project selects retain full option labels even when browser rendering clips a long selected value; single-project headings and feedback source titles wrap. This is not authenticated Next.js Server Action/RSC transport acceptance, full WCAG certification, hosted acceptance or physical-device/browser certification. Actual AI Assistant interactions are NOT TESTED; Student has no new assistant surface and its implementation/navigation/backdrop are unchanged.

## Owner acceptance and handoff

Suggested owner review, one area at a time:

1. Desktop Student Light/Dark: compact context, readable matching summaries, prominent Research Progress, balanced feedback and wider secondary cards.
2. Project selection: summaries and three project widgets follow the selected project; Latest Feedback may correctly retain a different source project and opens the complete original feedback.
3. Narrow/tablet widths: natural stacking, readable titles and values, usable direct actions/Help/member disclosure and unchanged navigation.
4. Available empty/loading/error cases: honest values, readable guidance and retries; no fabricated completion or missing critical instructions.

Recommendation: **ready for owner visual acceptance; do not close yet**. Apply only owner-identified Student corrections if needed. Preserve the accepted backdrop and other-role presentation. No V1.4/V1.5, commit, push or deployment starts automatically.
