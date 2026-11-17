# Visual-V1.5B: Dashboard branding alignment

Date: 2026-11-17 (Asia/Manila). Status: **IMPLEMENTED / focused local validation PASS; owner visual acceptance pending.** Anti-Slop: **PASS** for this scoped correction. V1.2, V1.3 and V1.4 retain their recorded local closures.

## Baseline and preservation

Confirmed before editing and after implementation: branch `feature/development`, HEAD `811495d89bf2d50d1b37fb992bb14acb14c5a20c`, empty index. Incoming working tree: three modified documents and two untracked developer-test files below; 695 nonignored files were hashed before editing. No reset, stash, discard, staging, commit, push, merge or deployment.

SHA-256 values below are **identical before and after**; all five paths remain unstaged, with the scripts/test still untracked:

| Protected pending path | Before = after SHA-256 |
| --- | --- |
| `docs/MASTER_CONTEXT_UPDATED.md` | `bb72b97e82a7c1dcd1df468218b2f58e9f974953291885e4c5ffc70773f736fe` |
| `docs/PHASE10_STUDENT_EMAIL_OTP.md` | `de6385df2cb27b491af0de4366e72ec7abcc9f2d57baf6d77118780d2e49a44d` |
| `docs/SOURCE_OF_TRUTH_UPDATED.md` | `827f92703f2b6bbc72ed2e6b577aa353890813f4e855edbae8f007d7f3ea135a` |
| `scripts/groq-developer-test.cjs` | `59f684334a9782b812351b41ad6c98f573e30acf6a366ba3e424f64bdb5f017c` |
| `tests/ai-p212-developer-groq.unit.cjs` | `cb9b4e2bd582dadbcab1049540b09e6d3a61fadd81ccf6de16324b0e59f63a35` |

Only two incoming files change; the other 693 incoming nonignored files remain byte-for-byte identical. This report is the sole new nonignored path. The approved shared SVG is unchanged: SHA-256 `df0e4c53464c43d965af9230f8fd03fad4ecb1301256444d8654b6467e0df333`.

Read: `AGENTS.md`, `DESIGN.md`, `ANTISLOP.md`, relevant layered-architecture documentation, V1.3 closure in `VISUAL_V13BR2_STUDENT_SUMMARY.md`, `VISUAL_V14D_CLOSURE.md`, installed Next Image documentation, and existing Landing/Auth asset usage. The newer owner-approved logo direction supersedes historical temporary-branding wording without changing those documents.

## Exact change and root cause

| Changed/new path | Purpose |
| --- | --- |
| `components/dashboard/dashboard-shell.tsx` | Import existing Next Image; replace only the brand-slot `NavigationIcon name="book"` with `/branding/thesishs-mark.svg`, width/height 22, decorative `alt=""`. |
| `components/dashboard/dashboard-shell.module.css` | One `.brandSymbol` rule reserves the original 22px square and prevents flex shrinking. |
| `docs/VISUAL_V15B_DASHBOARD_BRANDING.md` | This checkpoint report. |

Root cause: the shared shell still used the generic navigation book glyph for product identity, while Landing/Auth used the approved Open Book + Check mark. The repository navigation book icon remains correct and unchanged. The replacement uses the same SVG and Next Image pattern as Landing/Auth. No duplicate logo, institutional seal, framing, filter, recoloring or asset variant is introduced.

The existing product wordmark and accessible brand label are retained. **The original brand is a non-interactive span, with no link destination.** It remains a span: clicking it causes no navigation. All actual navigation links retain their destinations, labels and icons.

## Presentation and role results

Isolated Chromium ran the actual before/current DashboardShell, actual Next Image, CSS, navigation components, preference store and Radix Sheet. Routing, platform detection and authentication/action boundaries use safe synthetic doubles. The only permitted request responses are fixture HTML and the unchanged local SVG; all other requests are blocked. No signed-in application, database, Storage, email, AI provider or real logout operation was exercised.

**40 paired before/after cases PASS:** four role presentations x two themes x five modes. Each pair compares sidebar/content/brand/wordmark/symbol and navigation geometry, all navigation SVG markup, labels and hrefs, and overflow. This is 80 fixture renders, not 40 authenticated workflow tests.

| Coverage | Result |
| --- | --- |
| Expanded browser sidebar, 1280x900, Light/Dark | PASS: approved 22x22 SVG loaded; 240px sidebar, original 8px brand gap, wordmark and toggle geometry identical. |
| Compact browser sidebar, 1280x900, Light/Dark | PASS: 64px rail and expand button unchanged. The accepted CSS intentionally hides the entire brand in compact mode; no new logo is forced into this occupied header. Expanding restores the same 22px mark. |
| Narrow mobile browser, 390x844, Light/Dark | PASS: desktop sidebar remains hidden; existing text header, touch-open navigation drawer, close/focus return and link/icon geometry preserved. |
| Simulated installed mobile, 390x844, Light/Dark | PASS: existing bottom navigation and secondary drawer preserved; no duplicate product mark added. |
| Simulated installed desktop, 1280x900, Light/Dark | PASS: expanded mark and existing desktop navigation/preference behavior preserved. |
| Student, Main Adviser, Co-Adviser, Admin | PASS across every mode/theme above. Main/Co-Adviser share existing Adviser role ID 2 and navigation contract; fixtures label both separately without simulating delegated authority or changing permissions. |
| Brand destination and navigation icons | PASS: non-link brand remains non-link; no routes triggered by brand click; all link hrefs/labels and navigation icon markup equal before/after, including Browse Repository. |
| Layout and overflow | PASS: compared geometry is identical before/after; no horizontal page overflow. Existing label wrapping is unchanged. |

`app/dashboard/layout.tsx` still supplies authorized account links through the same shell. All role pages, widgets, project switching, feedback, card typography, palette, floating sidebar, backdrops, Landing/Auth, PWA icons and AI interfaces are byte-for-byte unchanged. Cross-role evidence covers the shared presentation contract, not authenticated authorization or complete dashboard feature execution.

## Focused validation and accessibility

- TypeScript program with `noEmit` and `incremental: false`: **PASS, 403 project roots, zero diagnostics**. Ignored historical/generated fixture roots excluded; no generated type-build cache written.
- `npx.cmd eslint components/dashboard/dashboard-shell.tsx`: **PASS**.
- Scoped `git diff --check`, strict UTF-8 decode, replacement-character/NUL and trailing-whitespace checks: **PASS**.
- Chromium fixture: **40/40 PASS**, zero runtime/console errors and zero unexpected requests in the final run. Existing controls retain keyboard activation and visible focus; touch opens mobile navigation; Escape returns focus. The logo adds no new focus stop or touch target.
- The original `aria-label="ThesiSHS AI"` and visible text remain. Empty image alt avoids repeating the adjacent product name. Width/height attributes plus fixed CSS preserve the previous symbol's layout allocation.
- Visual inspection of Light/Dark expanded screenshots confirms the book, gold check and arc remain recognizable at 22px. No shared-asset alteration is required. Wordmark contrast against sidebar surfaces is **6.22:1 Light / 9.45:1 Dark**. Gold in the logo is **3.47:1 / 5.26:1**; light-blue pages **4.47:1 / 6.78:1**. The dark teal outline has low surface contrast (**1.17:1 / 1.77:1**), and the muted-blue fill is **2.35:1 / 3.57:1**; this is a multicolor decorative brand mark, not a standalone functional control. These figures do not certify every logo pixel at 3:1. Owner small-size visual acceptance remains pending.

Initial sandbox fixture bundling was blocked by ancestor-directory access; a filesystem-enabled local rerun succeeded. The fixture also needed a browser `process.env` shim for bundled Next code; the final run uses the actual Next Image implementation, not an image replacement double. These fixture setup failures are not application test failures. No dependency installation, production build or broad suite was needed.

## Anti-Slop and acceptance handoff

**Anti-Slop PASS:** During mode, project-approved academic palette/layout retained, consistent existing product mark, zero new decoration, animation, gradients or borders. CSS/source edits are direct and limited to the logo slot. Compact-mode invisibility is an accepted-layout preservation decision rather than a new branding treatment.

Owner acceptance gallery: [`../test-results/visual-v15b/index.html`](../test-results/visual-v15b/index.html), with **24 screenshots** covering all four role presentations in Light/Dark expanded, compact and open mobile navigation. The ignored folder also contains `check.cjs`, original source snapshots, `baseline.json`, `results.json` and `preservation.json`. Evidence is local and excluded from commit scope. Content is deliberately synthetic and uses system font fallback; the deployed application's font loading and physical-device/installed-PWA behavior are not newly tested.

**Ready for owner visual acceptance of V1.5B.** Review the expanded mark's small-size appearance in both themes and confirm preservation of the compact rail and mobile drawer. V1.5C can be considered only after owner acceptance and a separately scoped instruction; favicon/PWA-icon alignment has not started. No commit, push, merge, deployment, backend operation or AI modernization performed.
