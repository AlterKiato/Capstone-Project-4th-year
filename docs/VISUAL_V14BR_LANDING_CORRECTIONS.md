# Visual-V1.4B-R: landing visual corrections

Date: 2026-11-16 (Asia/Manila). Status: **corrections implemented locally; focused checks PASS; owner acceptance PENDING. V1.4B remains OPEN.** No staging, commit, push, merge or deployment. V1.4C has not begun.

## Baseline and bounded scope

Verified `feature/development`, HEAD `155b3b2ce9fcb899be2102797057235b680d1b69`, empty index. The incoming tree contains V1.4B's two modified landing files, its untracked report/two branding assets, three modified canonical/authentication documents and two untracked Groq developer/testing files. All **685 incoming nonignored files** were hashed before correction.

This report supersedes only the original [V1.4B implementation report](VISUAL_V14B_LANDING_BRANDING.md)'s header, logo-backing and no-photography treatment. That report and its technical evidence remain unchanged historical records. The owner's three reported presentation issues are correction inputs, not agent-executed acceptance.

Exact correction deliverables:

- `app/page.tsx`
- `app/page.module.css`
- `public/images/landing/research-study.jpg` (new)
- `public/images/landing/library-study.jpg` (new)
- `public/images/landing/ATTRIBUTION.md` (new)
- `docs/VISUAL_V14BR_LANDING_CORRECTIONS.md` (this new report)

No SVG, official CASAP seal, original V1.4B report, shared token, theme provider, dashboard/PWA branding, favicon, auth page/form/action, OTP, service, schema, configuration or dependency change. Only the two intended existing source files change; all other incoming files, including the five protected paths below, remain byte-for-byte unchanged and unstaged:

- `docs/MASTER_CONTEXT_UPDATED.md`
- `docs/PHASE10_STUDENT_EMAIL_OTP.md`
- `docs/SOURCE_OF_TRUTH_UPDATED.md`
- `scripts/groq-developer-test.cjs`
- `tests/ai-p212-developer-groq.unit.cjs`

## Header alignment

Root cause: the flex header used `justify-content: space-between` with unequal brand/action widths. Its middle links were placed in the remaining gap rather than centered within the entire header. The correction uses **`minmax(0, 1fr) auto minmax(0, 1fr)`** CSS Grid columns: equal side tracks, centered navigation and right-aligned actions. No absolute positioning or new navigation framework.

At >1100px, brand/navigation/action vertical centers align and bounding-box assertions confirm separation and exact navigation centering against the header container. At <=1100px, navigation occupies a centered full-width second row; at <=600px, controls move to their own row. Existing 900/600px content breakpoints remain. Three existing anchors, Login, theme menu, focus/hover styling and 44px targets are preserved. Keyboard Tab/Enter exercises all three header anchors, and intermediate-width checks confirm no collisions or horizontal overflow.

## Transparent product logo

The original SVG already has a transparent canvas: it contains paths, with no cream background rectangle. The pale tile came from `.brandSymbol { background: #f9f6e8; border-radius: .5rem; }` added in B. Removing that CSS backing/radius is sufficient. The approved symbol now sits directly on the theme background, with its exact original paths, proportions and colors; no filter, recoloring, rasterization or new variant is needed.

The existing live wordmark, its prior contrast adaptation and 64/52px symbol sizing remain unchanged. Light/Dark screenshot review confirms recognizable blue pages and gold check/arc without the stark tile. Computed image background is transparent in all checked views. The official CASAP seal retains its separate accepted affiliation-area treatment and original bytes; it never replaces the product identity. Existing PWA/favicon/dashboard marks are unchanged.

## Verified academic imagery

Two photographs are incorporated, with [full source/license/download/hash records](../public/images/landing/ATTRIBUTION.md):

| Asset / placement | Verified creator and individual source |
|---|---|
| Research desk, workflow section | [Yen Vu on Unsplash](https://unsplash.com/photos/desk-with-open-book-laptop-and-study-materials-HNjWq8WPyoY): books, study notes, notebook and laptop; local 1400 x 2488 JPEG, 562,565 bytes |
| Empty library, beside role descriptions | [Tuyen Vo on Unsplash](https://unsplash.com/photos/library-tables-and-chairs-7o7DqXJArf4): local 1200 x 1797 JPEG, 275,744 bytes |

Both individual pages identify the standard [Unsplash License](https://unsplash.com/license). Its reviewed grant permits commercial/noncommercial website use and modification, including layout cropping; attribution is optional and is supplied here and in visible source links. Source HTML provided the exact image IDs; each optimized download returned HTTP 200 / `image/jpeg` from `images.unsplash.com`. No remote image allowlist, hotlink dependency, new package or local image editing. The local files match the downloaded bytes.

Visual inspection found no identifiable people or watermarks. Captions identify generic illustrative settings, not actual CASAP students or facilities. The workspace preview remains the original interface illustration; photography does not replace or duplicate it. No third image or additional promotional section is added.

## Selective glass-pane treatment

The workflow introduction is the **single frosted panel**, layered over the study photograph. Its existing heading/short paragraph remain intact. `backdrop-filter` and the WebKit equivalent use 12px blur inside a feature-support query, with a thin theme-tuned border, restrained shadow and existing .75rem radius. Supported Light uses surface-colored `.92` opacity; Dark uses `.9`. Body text uses the strong existing foreground. The photographs retain their original colors; CSS `object-fit: cover` and reserved layout dimensions crop without stretching.

The base panel uses opaque `var(--surface)`, so a browser without backdrop filtering gets a readable solid panel. Light/Dark fallback checks remove only the support block in the isolated stylesheet, confirming `backdrop-filter: none` and exact opaque surfaces. This models unsupported CSS; it is not actual old-browser certification. Contrast checks compose translucent backgrounds against conservative black/white image extrema, covering the photo brightness range. No long paragraph is left directly on the photograph.

The role image uses a simple editorial 16:9 crop alongside existing role text. The affiliation panel, seal and closing action retain their accepted presentation. No glass effect is added to the header, theme controls, footer, dashboard, dialogs or authentication screens; no animation or floating effect.

## Focused evidence and limitations

Ignored [desktop/mobile before-after gallery](../test-results/visual-v14br/index.html) and [computed evidence](../test-results/visual-v14br/evidence.json). Baseline screenshots are the incoming V1.4B work, not committed V1.3. The prior B gallery/package review stays intact.

| Check | Result |
|---|---|
| Browser delta checks | PASS: **24 views**, **1,392 rendered-text observations**, four retained interaction groups, zero page errors/unexpected requests |
| Header | PASS: recorded whole-container centering, vertical alignment and separation at desktop; centered wrapped navigation at intermediate/mobile sizes; transparent logo background; keyboard Tab/Enter/focus on all three anchors |
| Widths/themes | PASS: Light/Dark at 360/600/601/900/901/1100/1101/1280/1440px; 320px reduced-motion stress and 360px touch emulation; no horizontal overflow |
| Glass/fallback | PASS: supported blur/background/border presentation, conservative composited text contrast, Light/Dark opaque fallback via omission of the CSS support block |
| Contrast | PASS: minimum ordinary-text ratio **4.93:1** across the bounded checks; qualifying large text >=3:1; primary hover in both themes |
| Images | PASS: four local images load; unchanged logo/seal ratios and no filters; photos use intentional cover cropping without stretching; source/license verification recorded |
| Preservation | PASS: entire original main text matches incoming B after excluding only new photo credits; one original workspace preview, original sample caption, six-part hierarchy, CTA routes, affiliation, document wheel scrolling and natural footer flow retained |
| Interaction | PASS: all section anchors, Back to top, Login/register href/activation in the routing double, skip link/main focus, >=44px targets, actual Light/Dark/System menu, OS changes, persisted System/prepaint, Escape/focus and touch-emulated theme/anchor operation |
| TypeScript | PASS: **402 current-source roots**, zero diagnostics; **3,585 ignored historical/fixture roots** excluded in memory; no compiler/configuration output. Historical unfiltered TypeScript limitation remains unresolved |
| Targeted lint/integrity | PASS: `app/page.tsx` ESLint, no autofix; scoped whitespace, UTF-8, exact source/asset/report inventory and SHA-256 preservation |
| Production build/broad historical suites | SKIPPED: focused presentation checks only, with unchanged evidence reused at its original scope |

Before/after 360px and 1440px screenshots cover both themes. Additional header, workflow and opaque-fallback screenshots expose the corrected details. Agent visual inspection covers both desktop header/workflow themes, mobile Light and Dark opaque fallback. The fixture uses actual source/CSS/theme components with Next Link/Image presentation doubles; every browser request is intercepted locally. An established filesystem-only fallback resolved esbuild's sandbox directory-read denial. No real Next server, auth, account creation, email, database, Storage or AI operation occurs. Links verify destinations through a routing double, not authenticated transport.

Fixtures use fallback fonts; production Manrope remains configured and unchanged. Physical-device/software-keyboard/PWA, screen-reader speech, Safari/legacy-browser behavior, hosted/production and actual Next image optimization remain NOT TESTED. No new acceptance is inferred for prior OTP, research or dashboard workflows.

## Anti-Slop and owner review

**Anti-Slop During: PASS for this correction.** The owner's requested photographs and frosted editorial treatment are implemented, not suppressed for minimalism. Hard-gate evidence: truthful photo captions and role copy, source/license verification, working destinations, visible keyboard focus, touch targets, contrast and both themes. Purpose-gate evidence: one glass panel groups the existing workflow introduction; two photographs support research materials and study context. ENERGY 1 / RHYTHM 2 / MOTION 1 remains appropriate. Content-led variation, consistent palette/radii and original semantic boundaries satisfy the craftsmanship review. No new framework, fake metric, unsupported AI claim or excessive effect.

Owner acceptance remains pending for three corrected areas: balanced header positioning, transparent Light/Dark logo, and the two photographs/single glass panel including narrow layouts. **V1.4B stays OPEN** until the owner reviews the corrections. Stop here: no V1.4C, staging, commit, push, merge or deployment.
