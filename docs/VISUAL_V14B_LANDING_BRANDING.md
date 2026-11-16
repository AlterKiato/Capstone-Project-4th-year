# Visual-V1.4B: landing page and approved branding

Date: 2026-11-16 (Asia/Manila). Status: **implemented locally; focused presentation checks PASS; owner visual acceptance PENDING**. V1.4A is owner-approved PASS. V1.2/V1.3 retain their recorded local visual closures. No staging, commit, push, merge or deployment. V1.4C has not begun.

## Baseline and exact scope

Verified `feature/development`, HEAD `155b3b2ce9fcb899be2102797057235b680d1b69`, empty index. All 682 incoming nonignored repository files were hashed before editing. Protected modified documents: `MASTER_CONTEXT_UPDATED.md`, `PHASE10_STUDENT_EMAIL_OTP.md`, `SOURCE_OF_TRUTH_UPDATED.md` under `docs/`. Protected untracked files: `scripts/groq-developer-test.cjs`, `tests/ai-p212-developer-groq.unit.cjs`.

Deliverable changes are limited to:

- `app/page.tsx`
- `app/page.module.css`
- `public/branding/thesishs-mark.svg` (new, unchanged supplied symbol)
- `public/branding/casap-official.png` (new, unchanged official-source image)
- `docs/VISUAL_V14B_LANDING_BRANDING.md` (this report)

The two existing source paths intentionally change. Every other incoming nonignored file must remain byte-for-byte unchanged. No authentication page/form/action, OTP workflow, dashboard component, provider restriction, global token, PWA icon/favicon, dependency, configuration or academic logic change. Temporary source snapshots, package review copies, fixtures, scripts and screenshots remain ignored under `test-results/visual-v14b/`.

Read project agent/design guidance, relevant architecture and OTP contracts, the completed V1.2/V1.3 records and installed Next.js CSS/image guides. Apply Anti-Slop During using the owner's repository preference. The explicit owner branding direction supersedes historical temporary-branding wording for this landing page only; canonical documents remain untouched.

## Landing structure and behavior

| Area | Implemented presentation |
|---|---|
| Header | Supplied book/check symbol with live product wordmark; research-workflow, role and affiliation anchors; Login and existing theme selector |
| Hero | Left-aligned research headline and specific Student-account action; existing right-side illustrative workspace; concise registration/access explanation |
| Introduction/workflow | One combined explanation of submission versions, review/revisions, Main-verified milestones and authenticated published-research discovery |
| Roles | Distinct Student, Main/Co-Adviser and Admin responsibilities in a text-led layout, without repetitive promotional cards |
| Affiliation/closing action | Secondary official CASAP seal, Rodriguez Campus context, one closing Student-account action and honest group-assignment wording |
| Footer | Natural-flow product context, Back to top, Login and official CASAP website; obsolete provisional contact disclosures removed |

The old `height: 100dvh` wrapper and `main` overflow/min-height constraints are removed. The page retains a minimum viewport height but grows with content. Header, main and footer use normal document flow; no second scrolling region or overlay footer. The header is not sticky. The original workspace figure markup/content is byte-identical to HEAD and remains explicitly labelled sample content; no second preview, live query or fake interactive control is added.

Section navigation points to real IDs; the skip link targets the focusable main landmark. Login and registration remain `/login` and `/register`. Only the hero and closing section repeat the primary registration action. Public Adviser/Admin signup, automatic publication, Co final approval, anonymous repository access and operational AI evaluation are not advertised.

The 900px breakpoint stacks hero/roles and changes the workflow to rows; 1100px moves section navigation below the header identity/actions; 600px adapts controls and affiliation layout. New styles are confined to the landing CSS Module. Existing Light/Dark/System tokens, Manrope configuration and provider behavior remain intact.

## Supplied product branding

Source: owner-provided `C:\Users\admin\Downloads\thesishs_ai_logo_assets.zip`.

ZIP SHA-256: `264fb749495104365f4b63e3ffb147f21ce2d510d8cec3fb06837893be808e6d`.

All nine actual entries were inspected: standalone mark SVG, app-icon SVG, Light/Dark wordmark SVGs, four 32/180/192/512px icon PNGs and README. SVG XML validation found only expected svg/group/path/rect/text elements, with no scripts, event handlers, external references or embedded active content. Package README is treated as asset metadata, not permission to expand implementation scope.

Only `thesishs-mark.svg` is incorporated into the application, byte-identical to its ZIP entry. SHA-256: `df0e4c53464c43d965af9230f8fd03fad4ecb1301256444d8654b6467e0df333`. The complete package is copied only into ignored review evidence; candidate icons do not replace existing icons or manifest entries.

Differences from the concept board for owner review:

- This is the supplied clean SVG reconstruction, not a vector extraction. It uses simpler flat book pages, a rounded stroke check and a uniform curved arc instead of the board's tapered/layered illustrative treatment.
- The supplied wordmarks use nonoutlined text with a font fallback and fixed text coordinates; the review exposes a broad gap before `AI` under fallback rendering. They are reviewed as supplied rather than silently rewritten or deployed.
- The application follows the package's suitable composition: original symbol plus live inherited Manrope text, including the product name and Research Management System descriptor. It is not an exact rendering of either supplied full-wordmark SVG.
- A small warm `#F9F6E8` backing preserves the symbol's original dark outline in both themes. The SVG itself is not recolored.
- Initial live Light `AI` gold `#B38622` measured 2.975:1 on the accepted cream, just below the 3:1 large-text threshold. Only the live wordmark gold becomes `#A87D20`; Dark uses `#D2BF6A`. Global theme values and supplied asset colors remain unchanged.

Header symbol boxes are 64px desktop and 52px mobile. The ignored asset-review image shows original symbol sizes 64/48/32px and app-icon candidates at 192/48/32px. The book/check remains recognizable at 32px, but finer arc/page details compress; final favicon/PWA adoption remains a separate owner decision. None is proposed as already approved or implemented.

## Official institutional logo and authorization

Downloaded from the exact owner-supplied official HTTPS source:

[CASAP original logo](https://casap.edu.ph/wp-content/uploads/2022/01/logo-casap.png).

Verified final URL remained that address, HTTP 200, `image/png`, PNG signature and dimensions **447 x 387**, 262,352 bytes. SHA-256: `752257fa0608ee62d0b24c2b33afa1b9544ff4b50e01961d3951b5153e0f9f79`. The local public file is byte-identical to the downloaded original. The [institution's logo explanation](https://casap.edu.ph/logo-2/) describes the Griffin/crown/shield/laurel identity matching this official image.

The owner **reports verbal permission** to display the institutional affiliation logo. This report does not represent that statement as written permission or independently verified institutional authorization. The round campus-seal approximation on the concept board is not used.

The original image appears only in the affiliation area, secondary to the product's primary header/hero identity. Its aspect ratio, colors, transparency and appearance are preserved; no filter, crop or generated replacement. A white backing supports readability in both themes. The image is served locally, with reserved intrinsic dimensions and `unoptimized` so the original file is delivered directly. It is not used as the application wordmark, favicon or dashboard/PWA icon.

No optional academic photography or third-party image selection was needed.

## Focused validation

Ignored [before/after gallery](../test-results/visual-v14b/index.html), [computed evidence](../test-results/visual-v14b/evidence.json) and [asset-size review](../test-results/visual-v14b/asset-review.png).

| Check | Result |
|---|---|
| Real-component fixture build | PASS: actual before/after landing source, CSS Modules and unchanged theme provider; Next Link/Image presentation doubles only. The established narrow filesystem fallback resolved sandboxed esbuild module-read denial |
| Sequential Chromium checks | PASS: 20 checked views, 1,040 rendered-text observations, four interaction groups, zero page errors/unexpected requests |
| Responsive views | PASS: Light/Dark at 360/600/601/900/901/1100/1101/1440px; additional 320px reduced-motion stress and 360px touch emulation; no horizontal overflow |
| Scrolling/footer | PASS: actual document wheel scroll moves the footer; main overflow visible; no nested scrolling content region; footer follows main and is not fixed/sticky |
| Links/navigation | PASS: all section anchors reach their targets; Back to top; two registration and two Login links activate their correct destinations in the isolated routing double; official website href checked without external navigation |
| Themes | PASS: real menu Light/Dark/System, keyboard selection/Escape/focus, System OS change, persisted System reload and pre-body initialization, explicit Light override; touch-emulated Dark selection |
| Accessibility/motion | PASS within scope: skip link and main focus, one h1/main, visible keyboard focus, >=44px control heights, no decorative animation under reduced-motion emulation |
| Contrast | PASS: ordinary-text minimum **4.93:1**; large text checked against 3:1; primary hover checked in both themes. Bounded text checks, not full WCAG certification |
| Images/branding | PASS: local images load, original intrinsic/rendered ratios match and no filters; original preview figure unchanged; SVG/package validation and exact byte comparisons |
| TypeScript | PASS: current-source program, 402 roots, zero diagnostics; 3,584 ignored historical/fixture build-source roots excluded in memory, no output or tsconfig changes. The historical unfiltered-command limitation is not claimed resolved |
| Targeted ESLint | PASS: `app/page.tsx`, no autofix |
| Integrity/preservation | PASS: scoped whitespace/UTF-8 checks and full incoming-file SHA-256 comparison; exact intended source/asset/report inventory, protected files unstaged, branch/HEAD unchanged |
| Production build/broad historical suites | SKIPPED: bounded presentation evidence reused where unchanged; no new runtime/build claim |

Screenshots include before/after 360px and 1440px Light/Dark, two desktop hero views and the package/size review. Agent inspection covers full mobile Light, desktop Dark, both hero themes and original asset candidates. The fixture renders fallback fonts; production Manrope remains configured and unchanged. All requests are intercepted locally; there is no Next server, real authentication, account creation, email, database, Storage or AI request. Account-link activation verifies the routing double and hrefs, not authenticated runtime navigation or OTP execution. No real records are shown.

## Anti-Slop and handoff

**Anti-Slop During verdict: PASS for this scoped implementation.** Hard-gate evidence: working destinations, honest sample content, keyboard focus/targets, checked contrast/states/themes and no fabricated academic/security claims. Purpose-gate evidence: the supplied book/check represents research/review, small gold markers identify section hierarchy, and only the workspace preview receives restrained elevation. No generic AI imagery, decorative animation, extra library or repeated promotional card grid. Liveliness remains ENERGY 1 / RHYTHM 2 / MOTION 1, with a clear hero focal point and content-led variation. Craftsmanship: natural scrolling, real role distinctions, responsive wrapping and separate product/institutional identities.

Ready for owner local visual review, not closed: accept/correct the overall hierarchy and scrolling, the supplied reconstruction/live-wordmark treatment, its small warm backing/deeper Light gold, and the official secondary CASAP seal. Review both themes and a narrow screen using the actual local application when available. Hosted behavior, physical devices/PWA, screen-reader speech and actual Manrope loading in this fixture remain NOT TESTED. Existing V1.2/V1.3 and OTP evidence is not expanded by this checkpoint.

Stop after V1.4B. No V1.4C implementation, canonical-document reconciliation, staging, commit, push, merge or deployment.
