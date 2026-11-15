# Visual-V1.2C: owner-requested visual corrections

Date: 2026-11-16 (Asia/Manila). Status: **Visual-V1.2 PASS / CLOSED for the agreed local visual scope**, following A foundation, B fidelity/Anti-Slop review and C corrections. Focused offline checks PASS; final owner-reported local visual acceptance is 7 PASS, 0 FAIL. Codex did not independently rerun the manual acceptance. Hosted and physical-device acceptance remain NOT TESTED. One scoped local closure commit is authorized; no push or deployment.

## Final owner-reported local acceptance

| Acceptance area | Final owner result |
|---|---|
| Student Dashboard | PASS |
| Main Adviser Dashboard | PASS |
| Co-Adviser Dashboard | PASS |
| Admin Dashboard | PASS |
| Floating Sidebar / Navigation | PASS |
| Authentication and OTP Screens | PASS |
| Theme Switching | PASS |

These seven results come from the owner's closure instruction. They supersede the earlier local failures and pending review below within this visual scope only. They are distinct from agent-executed synthetic tests, hosted acceptance and physical-device certification.

The owner accepts the CASAP-inspired muted blue/gold foundation, Light/Dark/System behavior, lighter Light floating sidebar and selective Adviser/Admin Light card shadows. The [A foundation report](VISUAL_V12A_THEME_FOUNDATION.md) preserves the initial implementation and evidence. B reviewed 30 supplied palette values: 29 exact matches and the accessibility-motivated Light primary `#1D728B` adjustment. Its historical PARTIAL fidelity classification records that valid variant; **final Anti-Slop compliance is PASS with no unjustified override**. B's 48 synthetic captures, 1,616 rendered-text observations, 4.62:1 minimum contrast and zero page errors/unexpected requests remain recorded technical evidence, separate from owner acceptance.

## Owner evidence and clarification

The earlier supplied V1.2B results were owner-reported: Student Dashboard PASS, Authentication PASS, Adviser Dashboard FAIL, Admin Dashboard FAIL and Navigation FAIL. These historical results motivated C; the final acceptance table above supersedes them. They are not agent-executed acceptance results.

The owner subsequently clarified: "oh none, I accidentally put failure in theme switching". The Theme Switching FAIL is therefore withdrawn; no functional failure was reported. Do not describe a provider bug as the cause of that withdrawn report or infer new hosted acceptance from this clarification.

The requested corrections are restrained Light-mode card depth and a visibly lighter sidebar in Light mode, preserving the muted blue/gold direction. This checkpoint does not implement V1.3 layouts, V1.4 imagery/auth expansion or V1.5 motion.

## Repository baseline and scope

Branch `feature/development`; HEAD `a16e94737d598919781f6fbf0bff3564ededa15d`; empty index. The incoming tree matched V1.2B: six modified paths (`app/globals.css`, shell CSS, Sheet CSS and the three pending canonical/authentication documents) and three untracked paths (the V1.2A report, Groq developer CLI and its unit test).

Before implementation, 676 nonignored repository files were hashed. The six application paths intentionally changed by V1.2C are:

- `app/globals.css`
- `components/dashboard/adviser-overview.module.css`
- `components/dashboard/admin-overview.module.css`
- `components/dashboard/dashboard-shell.module.css`
- `components/ui/sheet.module.css`
- `components/theme-preferences.module.css`

This report was C's only added nonignored document. At closure, only this report and `docs/VISUAL_V12A_THEME_FOUNDATION.md` receive documentation updates; the A token mapping remains historical and this report owns current sidebar/depth values. The combined commit scope is exactly the six CSS files listed above plus these two reports. The pending Master/Source of Truth/OTP documentation and both Groq CLI files remain outside this checkpoint, byte-for-byte preserved and unstaged. No application TSX, theme provider/store/initializer, actions, services, schema, migrations, assets or configuration changes.

## Sidebar colors

| Token/use | Before Light / Dark | After Light | After Dark |
|---|---|---|---|
| Background | `#0E1820 / #0E1820` | `#253C4D` | `#101B26` |
| Hover | `#1A303C / #1A303C` | `#304F61` | `#1D303E` |
| Active fill | `#254756 / #254756` | `#365768` | `#254756` |
| Control border | `#718794 / #718794` | `#94A7B1` | `#718794` |
| Text/icons | `#D1E3EA / #D1E3EA` | unchanged | unchanged |
| Focus | `#A2CAD5 / #A2CAD5` | unchanged | unchanged |
| Scoped wordmark/selection accent | root gold: `#B89A2E / #D2BF6A` | `#D2BF6A` | `#D2BF6A` |

The two backgrounds match the owner's preferred starting values exactly. Root tokens are available to both the rail and the navigation Sheet portal. Only those navigation surfaces rebind their local surface/brand/heading/focus/border variables. Other dialogs and popovers are not globally recolored. Installed-mobile bottom navigation retains the accepted page-palette treatment.

Accessibility adaptation: the previous Light gold `#B89A2E` gives only 4.20:1 for the wordmark on the newly lighter sidebar, and 2.83:1 for the selected stripe against the new active fill. Scoped `--sidebar-accent: #D2BF6A` reuses the approved muted Dark gold, giving 6.22:1 for the wordmark and 4.19:1 for that indicator. The application-wide Light gold token remains `#B89A2E`. Derived Light control borders preserve at least 3:1 on normal/hover/active navigation fills. No bright logo yellow is introduced.

## Light-mode card depth

The new opt-in `--overview-card-shadow` is:

```css
0 2px 5px rgba(25, 40, 55, 0.035),
0 8px 22px rgba(25, 40, 55, 0.055)
```

It applies only through the existing overview modules:

- Main Adviser and Co-Adviser metric cards and overview sections, including Needs Your Attention and recent delegated manuscripts.
- Admin primary metrics, secondary role-statistic cards and Recent Activity sections.
- Existing Admin Reports cards that reuse these same metric/section styles receive the same presentation; their data contracts, queries and actions are unchanged.

Those overview cards use `none` in Dark mode, keeping their separation based on existing surfaces and borders. The shared `.dashboard-panel` rule retains its previous `0 2px 6px #0f172a05` shadow; accepted Student cards and other panels do not opt into the new elevation. Overview section shadow selectors require both the local section class and `.dashboard-panel`, outranking the shared panel shadow without depending on CSS import order. Borders, radii, spacing, text, order, metrics and actions are unchanged. No hover lift/cursor or click affordance is added. No elevation is added to nested form controls, dialogs or tables.

Computed shadow values confirmed both Light layers and the intended Dark absence. The affected overview cards have no hidden/clip overflow ancestors in the fixture. Screenshot review confirms visible, restrained Light depth. The owner subsequently accepted this presentation in the final local visual results above.

## Theme investigation and independent Settings correction

No functional theme defect was reproduced. The existing menu and Settings radios update Light/Dark/System, stored preference survives reload, System follows OS changes, explicit Dark overrides OS Light, and the canonical initialization sets the effective theme before the fixture body exists. Sidebar and open navigation portal colors update with the provider. No provider rewrite or JavaScript fix was needed.

An independent, confirmed visual defect was found in the Settings theme selector: `.preferences label:has(:checked)` reused `--sidebar-active` while its text used the Light page heading color. Actual computed colors were `rgb(38, 52, 64)` on `rgb(37, 71, 86)`, only 1.28:1.

The one-property correction changes the selected label background from `var(--sidebar-active)` to `var(--notice)`. The label retains its existing text, border, radio semantics, focus handling and events. Actual selected-label contrast is now 10.74:1 in Light and 11.76:1 in Dark. This is a CSS contrast correction, not a claim that theme selection was functionally broken or that it caused the owner's withdrawn FAIL.

Brave-specific behavior was not exercised by the synthetic harness. Reduced-motion emulation did not prevent theme application in Chromium. Agent-executed authenticated runtime, physical-device/software-keyboard and hosted acceptance remain NOT TESTED; the owner's local visual results do not establish those broader checks.

## Adviser/Admin findings and Anti-Slop

Confirmed presentation findings: the old rail/drawer used the same background in both themes; old overview cards shared a near-flat generic panel shadow; Settings had the contrast defect above. The first two changes implement the owner's explicit depth/tone preference. No dashboard-specific contrast failure, layout overflow or geometry regression was found in the bounded representative checks.

No owner evidence established a content-density, card-order or metric-layout defect. Those possible concerns remain separately scoped V1.3 discussion, not speculative V1.2C implementation. Main official authority and Co private recommendation wording stay intact; all fixture counts are explicitly synthetic.

Anti-Slop verdict: **PASS for this corrective scope.** R-01/R-20 allow purposeful muted institutional color; R-12 supports the requested selective depth; R-25/R-32 justify the scoped gold, control-border and Settings contrast corrections. Student/Auth preservation and the owner's scope take precedence over adding shadows everywhere. No requested shadow or sidebar adjustment was rejected, and no animation or decorative expansion was introduced.

## Focused evidence

Ignored evidence lives under `test-results/visual-v12c/`; earlier V1.2A/B fixtures and images remain intact. `index.html` is the correction gallery and `evidence.json` records computed observations, before-state preservation and theme checks. All services, authentication and actions are mocked; CSP/network interception blocks external calls. No real account, research record, provider, email, database or Storage access.

| Check | Result |
|---|---|
| Before-state capture | PASS: actual Settings contrast reproduced; 14 role/auth theme-view style/geometry baselines retained |
| `node --import tsx test-results/visual-v12c/verify.cjs` | PASS: 48 representative Light/Dark captures/checks, 1,558 rendered text observations, minimum 4.62:1, zero page errors/unexpected requests |
| Student/Auth preservation | PASS: 8 Light/Dark baseline comparisons preserve card/form geometry, surfaces, borders, radii, text colors and shadows exactly |
| Main/Co/Admin preservation | PASS: 6 Light/Dark comparisons preserve card geometry, surfaces, borders, radii and text colors; only intended shadows differ |
| Shadow checks | PASS: targeted two-layer Light / none Dark values, Admin secondary cards included, no clipping ancestors |
| Navigation | PASS: distinct rail/drawer colors; active/hover/focus; 240px expanded and 64px compact geometry; mobile drawer Escape/focus; emulated installed-mobile bar; desktop-PWA hidden zero offset |
| Theme behavior | PASS: actual menu/radio selection, persistence/reload, explicit preference vs OS, System updates/reload, canonical pre-body initialization, open portal recoloring |
| `node --import tsx tests/phase973-theme.unit.cjs` | PASS: normalization, effective resolution, pre-paint initialization and unavailable-storage fallback |
| CSS parsing / scoped whitespace | PASS: real CSS Modules bundled and browser-rendered; `git diff --check` |
| TypeScript/ESLint / production build / broad historical suites | SKIPPED: CSS-only source changes; no relevant TS/JS logic change or build need. Existing full-command stale ignored-copy limitation is not claimed resolved |
| Owner acceptance of corrections | PASS: final owner-reported local visual results are 7/7; not independently rerun by Codex |

Contrast details: Light sidebar text/active fill 5.84:1, focus/active fill 4.39:1, wordmark/base 6.22:1; Dark wordmark/base 9.45:1. Academic status colors/labels and the V1.2A Light primary accessibility adjustment are unchanged. Fixtures use fallback fonts while the application's Manrope configuration remains untouched; they do not establish a full authenticated/device/browser acceptance matrix.

## Closure verification and proposed next checkpoint

The owner's seven PASS results close V1.2 for the agreed local visual scope. Theme Switching's earlier accidental FAIL was withdrawn and the final result is explicitly PASS. A's foundation, B's fidelity/Anti-Slop review and C's corrections are complete within their recorded limits. The valid Light primary adjustment, scoped navigation gold and Settings contrast fix remain justified accessibility adaptations; no owner-requested visual direction was suppressed by Anti-Slop.

Closure reuses the recorded synthetic browser/unit, CSS parsing, current-source TypeScript and targeted ESLint evidence at their original scopes. Fresh closure checks cover the complete eight-file patch, whitespace/UTF-8 integrity, exact staged contents, expected branch/parent and byte-for-byte preservation of unrelated work. No new broad suite or production build is claimed; A's unfiltered TypeScript failure from stale ignored build copies remains documented.

Recommend **V1.3 as the next proposed checkpoint**: agree a bounded layout/hierarchy scope against this accepted visual baseline before implementation. V1.3/V1.4/V1.5 have not begun. Broader workflow, hosted and physical-device acceptance is not inferred. Publication remains separately authorized work. Stop after the one authorized local Visual-V1.2 commit and closure report; no push, merge or deployment.
