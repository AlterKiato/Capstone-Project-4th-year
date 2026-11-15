# Visual-V1.2A: CASAP-inspired theme foundation

Date: 2026-11-16 (Asia/Manila). Status: **Visual-V1.2 PASS / CLOSED for the agreed local visual scope.** Final owner-reported acceptance is 7 PASS, 0 FAIL; it was not independently rerun by Codex. Focused offline validation remains PASS with the unfiltered TypeScript limitation below. Hosted and physical-device acceptance remain NOT TESTED. This closure authorizes one scoped local commit only; no push or deployment.

## V1.2 closure and checkpoint progression

- **V1.2A:** implemented the CASAP-inspired muted blue/gold Light/Dark foundation while preserving the existing System default, stored preferences, OS synchronization and pre-paint initialization.
- **V1.2B:** reviewed palette fidelity and Anti-Slop compliance against actual application components in isolated synthetic fixtures. Of 30 supplied palette values, 29 matched exactly; the Light primary adjustment to `#1D728B` is justified by readable inline action text on cream, hover and notice surfaces. The review's historical PARTIAL fidelity classification described this documented adjustment, not an unjustified Anti-Slop override. Its 48 captures and 1,616 rendered-text observations passed contrast checks with a 4.62:1 minimum and no page errors or unexpected requests.
- **V1.2C:** implemented and subsequently received owner acceptance for the lighter Light floating sidebar (`#253C4D` versus Dark `#101B26`), selective Adviser/Admin Light card shadows and the Settings selected-theme contrast correction. The [corrections and final acceptance record](VISUAL_V12C_VISUAL_CORRECTIONS.md) owns current sidebar/depth values and all seven manual outcomes; the A mapping below remains historical implementation evidence.

Final acceptance covers Student, Main Adviser, Co-Adviser, Admin, Floating Sidebar/Navigation, Authentication/OTP and Theme Switching: **all owner-reported local visual PASS**. Synthetic Chromium checks and agent screenshot review are separate technical evidence, not these manual results or hosted/device certification.

**Final Anti-Slop verdict: PASS; no unjustified override.** The accepted muted institutional palette, lighter Light navigation and restrained overview depth preserve the owner's design direction. Accessibility adaptations are documented rather than attributed to aesthetic suppression. Temporary text branding, academic status semantics, role authority and workflows are unchanged.

## Scope and baseline

Branch `feature/development`, HEAD `a16e94737d598919781f6fbf0bff3564ededa15d`; empty index. Incoming modified paths: `docs/MASTER_CONTEXT_UPDATED.md`, `docs/PHASE10_STUDENT_EMAIL_OTP.md`, `docs/SOURCE_OF_TRUTH_UPDATED.md`. Incoming untracked paths: `scripts/groq-developer-test.cjs`, `tests/ai-p212-developer-groq.unit.cjs`. These five protected paths are outside this implementation; SHA-256 comparisons verify preservation at completion.

At V1.2A, application changes were limited to `app/globals.css`, `components/dashboard/dashboard-shell.module.css` and `components/ui/sheet.module.css`; this report was its only new deliverable document. The combined closure contains six CSS files and these two Visual reports, as listed in the corrections report. Temporary analysis and screenshots live in ignored `test-results/visual-v12a/`; navigation evidence uses a fresh OS temporary directory.

The palette is inspired by the owner's supplied CASAP logo colors. It is not an independently verified official institutional color specification. No logo, photograph, icon or font asset changes. Manrope remains configured; the network-isolated fixture renders with the existing fallback fonts.

The existing theme provider, preference key, pre-paint initialization, OS synchronization and menu behavior remain unchanged. No component markup, layout geometry, animation, services, actions, authentication/OTP, research contracts, AI configuration, database, schema or environment changes. V1.3, V1.4 and V1.5 have not begun.

## Token inventory and before/after mapping

Historical V1.2A values: hex values are case-insensitive. Each cell is **before -> after**. Existing token names are preserved. V1.2C supersedes sidebar backgrounds, hover/active/border values and the scoped navigation accent; see the linked corrections report for the accepted current values.

| Actual token | Light | Dark |
|---|---|---|
| `--background` | `#f6f8fb -> #f5f3ea` | `#101b2a -> #0b1117` |
| `--foreground` | `#1e293b -> #263440` | `#e2e8f0 -> #e8eff3` |
| `--surface` | `#ffffff -> #fbfaf5` | `#182638 -> #111a22` |
| `--surface-secondary` | `#f6f8fb -> #ffffff` | `#1e2f43 -> #16212b` |
| `--surface-hover` | `#eef2f6 -> #eeece3` | `#293e55 -> #1d2b36` |
| `--muted` | `#475569 -> #59636a` | `#b5c3d4 -> #b8c3cc` |
| `--border` | `#dbe2ea -> #d8d2c2` | `#42556d -> #344553` |
| `--border-subtle` | `#e2e8f0 -> #e5e0d4` | `#364a62 -> #283947` |
| `--border-strong` | `#cbd5e1 -> #7c7b71` | `#566c86 -> #718794` |
| `--input-border` | `#64748b -> #74746c` | `#7c91aa -> #718794` |
| `--action` | `#1e40af -> #1d728b` | `#a9c8f0 -> #7fafbd` |
| `--action-hover` | `#172554 -> #17657d` | `#c9def8 -> #a2cad5` |
| `--on-action` | `#ffffff`, unchanged | `#101b2a -> #0b1117` |
| `--focus` | `#2563eb -> #17657d` | `#8dc8ff -> #a2cad5` |
| `--notice` | `#eff6ff -> #e5edf0` | `#20374e -> #1d303a` |
| `--brand` | `#244565 -> #17657d` | `#b3cfe9 -> #7fafbd` |
| `--brand-gold` | new: `#b89a2e` | new: `#d2bf6a` |
| `--heading` | `#203b57 -> #263440` | `#d6e5f4 -> #e8eff3` |
| `--preview-heading` | `#243b53 -> #263440` | `#c6d8e9 -> #e8eff3` |
| `--preview-icon` | `#526276 -> #59636a` | `#b5c3d4 -> #b8c3cc` |
| `--sidebar-background` | new: `#0e1820` | new: `#0e1820` |
| `--sidebar-text` | `#334155 -> #d1e3ea` | `#c9d5e3 -> #d1e3ea` |
| `--sidebar-hover` | `#f1f5f9 -> #1a303c` | `#24374d -> #1a303c` |
| `--sidebar-active` | `#eaf0f6 -> #254756` | `#2b425b -> #254756` |
| `--sidebar-border` | new: `#718794` | new: `#718794` |
| `--sidebar-focus` | new: `#a2cad5` | new: `#a2cad5` |

Academic and error colors retain their previous values and meanings:

| Token | Light | Dark |
|---|---|---|
| `--revision` | `#805314` | `#edc27d` |
| `--feedback` | `#25635e` | `#91d2c5` |
| `--error-border` | `#b91c1c` | `#f2a4a4` |
| `--error-surface` | `#fef2f2` | `#402832` |
| `--error-text` | `#991b1b` | `#ffc4c4` |

`--font-app`, Tailwind aliases and `color-scheme` behavior are unchanged. Panels/dialogs/popovers inherit `--surface`/`--foreground`; inputs use `--input-border`; primary buttons use `--action`/`--on-action`; information and Under Review states use `--notice`/`--action`. Revision Required and Approved retain their labelled statuses and existing border/dash distinctions.

## Mapping choices and accessibility adjustments

1. The proposed Light primary `#1f7a96` gives only 4.41:1 on the proposed cream background, 4.14:1 on hover and 4.13:1 on the derived notice surface. Use `--action: #1d728b`: 4.93:1, 4.63:1 and 4.62:1 respectively. White button text is 5.48:1. Dark primary and both proposed hover colors are retained exactly.
2. Map proposed elevated surface to the existing `--surface-secondary`; its existing neutral secondary uses remain. No second theme system or redundant elevated-surface token is introduced.
3. The proposed base borders remain decorative panel/divider borders. Derived `--border-strong` and `--input-border` provide at least 3:1 against the five tested page/control surfaces where a visible interactive boundary matters. The base border is not claimed to meet 3:1.
4. `--notice` and `--border-subtle` are derived companion colors because the supplied table did not define them. Foreground/muted/action/status contrast was checked on those notice surfaces as well as normal and hover surfaces.
5. Existing `--brand` remains text/action-safe teal; headings and preview text map to foreground/muted colors. Gold is a separate accent, not general body text: Light gold has only 2.61:1 on the Light surface. Its actual uses are the dark rail wordmark and selected navigation stripe. The wordmark is 6.58:1 in Light and 9.74:1 in Dark; the selected stripe is at least 3.64:1 against the active fill.
6. The proposed Light focus `#17657d` gives only 2.73:1 on the dark rail. Dedicated shared `--sidebar-focus: #a2cad5` reaches 5.65:1 even on the active fill. Derived sidebar hover and border values keep controls readable; the border is 3.65:1 on its hover background and 4.78:1 on its normal background.
7. Desktop rail and portaled navigation Sheet locally bind existing surface/brand/heading/focus/border variables to the sidebar palette. This is necessary because the Sheet portal is outside the shell DOM ancestry. Existing layout, focus handlers and Radix behavior remain intact.
8. The mobile menu trigger and installed-mobile bottom navigation retain page-palette text/background variables rather than inheriting the now-light sidebar text on a light page. Active bottom navigation keeps its existing indicator and uses the readable notice/heading pair. No routes, breakpoints, sizing or navigation preference logic changes.

## Contrast evidence

Calculated with sRGB relative luminance and `(lighter + 0.05) / (darker + 0.05)`. Ordinary text target 4.5:1; qualifying large text 3:1; relevant control boundaries/focus/selection indicators 3:1. Disabled controls are excluded from ordinary-text assertions. Decorative dividers are not treated as essential control boundaries.

| Pair | Light | Dark |
|---|---:|---:|
| Foreground / background | 11.47 | 16.33 |
| Muted text / hover surface | 5.19 | 8.07 |
| Action text / notice | 4.62 | 5.71 |
| On-action / action | 5.48 | 7.92 |
| Input border / surface | 4.51 | 4.68 |
| Strong border / hover surface | 3.60 | 3.86 |
| Focus / notice | 5.54 | 7.78 |
| Sidebar text / active fill | 7.51 | 7.51 |
| Sidebar focus / active fill | 5.65 | 5.65 |
| Error text / error surface | 7.60 | 8.90 |
| Revision text / secondary surface | 6.63 | 9.80 |
| Approved feedback text / secondary surface | 6.94 | 9.51 |

164 token-pair assertions PASS. Across 26 rendered surface checks, the lowest observed ordinary text contrast was 4.62:1. Actual drawer close-control hover boundary and focus contrast also PASS. These are bounded checks, not a full WCAG conformance certification.

## Validation and evidence limits

| Check | Result |
|---|---|
| `node --import tsx tests/phase973-theme.unit.cjs` | PASS: normalization, System resolution, pre-paint script, blocked-storage fallback |
| `node --import tsx tests/dashboard-navigation.unit.cjs` | PASS: 10/10 preference/role/route/storage checks |
| Temporary `test-results/visual-v12a/verify.cjs` | PASS: 164 token pairs, 26 rendered Light/Dark checks, 360/1280px, actual theme menu keyboard/storage/OS changes, dark portaled drawer, focus/Escape restoration, sample native dialog, emulated installed-mobile navigation, no horizontal overflow |
| `node tests/dashboard-navigation.browser.cjs` | PASS: inspected offline real-shell/Radix regression, all-role geometry/targets, compact/hidden modes, short drawers, draft guards/provider stability, Light/Dark contrast, reduced motion, storage and emulated touch |
| Targeted ESLint on theme provider/menu, shell and Sheet TSX | PASS; no autofix. CSS parses through esbuild/browser; the project ESLint configuration does not lint CSS |
| `npx.cmd tsc --noEmit --incremental false` | FAIL: stale ignored `test-results/*/build-source` copies reference obsolete component and OTP types. No current-source error was reported in this run |
| In-memory current-source TypeScript program | PASS: 402 roots, excluding only 3,583 ignored historical build-source roots; no tsconfig/compiler-output changes |
| Scoped `git diff --check` | PASS |
| Production build / historical DB-backed theme browser script | SKIPPED: unnecessary build; historical script reads DB credentials/accounts and assumes the superseded light sidebar |
| Agent-executed authenticated application, hosted and physical-device/PWA acceptance | NOT TESTED |
| Owner local visual acceptance | Initially NOT TESTED at A; final V1.2C closure is owner-reported 7/7 PASS |

Initial sandbox dependency-read and temporary fixture-bundling failures were resolved for the bounded offline harness. No production build or Next server was started. All fixture Server Actions are mocked; unexpected network requests are blocked and the final harness recorded zero. The navigation harness similarly mocks routing/actions/push and uses synthetic content. No SMTP, provider, database or Storage access.

Agent visual inspection covers representative Light/Dark workspace, drawer, public landing and mobile authentication screenshots. This is screenshot review of an isolated fixture, not owner manual acceptance or a full authenticated page check. The harness does not reproduce live role data, actual font loading, private PDFs, screen-reader speech or physical software keyboards. Existing acceptance records remain unchanged.

The original A follow-up was completed through B review, C corrections and the owner's final local visual acceptance. Recorded synthetic tests are reused for closure; only documentation, patch integrity, exact Git scope and protected-file preservation require fresh checks. No broad test rerun or production build is claimed.

**Next proposed checkpoint: V1.3**, separately scoped layout/hierarchy review using the accepted V1.2 palette and navigation as its baseline. No V1.3 implementation has begun. Hosted publication and physical-device acceptance remain separate work requiring their applicable authorization; V1.2 local closure does not imply either.
