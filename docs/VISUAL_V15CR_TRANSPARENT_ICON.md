# Visual-V1.5C-R — Transparent favicon refinement

Date: 2026-11-17 (Asia/Manila). **Asset correction and focused local validation PASS; owner visual acceptance PENDING.** No commit, push, merge, deployment or installation.

## Baseline and exact scope

Verified `feature/development`, HEAD `b3d19d44e90132da1335773f90472fcb10fe15ce`, empty index and 31 incoming pending paths. SHA-256 baseline covers all 703 nonignored incoming files. Read AGENTS, DESIGN, Anti-Slop, V1.5C identity and V1.5D-C diagnosis, existing PWA configuration, installed Next icon conventions and the existing generation/check fixtures.

Only these nonignored paths change in this checkpoint:

- `app/favicon.ico` — regenerated transparent favicon.
- `docs/VISUAL_V15CR_TRANSPARENT_ICON.md` — this new report.

The approved SVG, all three PNG assets, manifest/layout, accepted V1.5B/D/E implementation and the five protected authentication/Groq files remain byte-for-byte unchanged and unstaged. Of 703 incoming files, only the authorized favicon differs; the other 702 match. Preservation evidence: ignored `test-results/visual-v15cr/baseline.json` and `preservation.json`. The original favicon is backed up beside them; no incoming evidence or history was overwritten.

## Diagnosis and correction

The incoming ICO contains three 32-bit DIB frames at 16, 32 and 48px. Every pixel was opaque; the corners were RGBA `(245,243,234,255)` / `#f5f3ea`. The 192px, 512px and 180px PNGs are RGB with the same cream corners. The approved 128-unit SVG has transparent exterior pixels and no rectangular background. The earlier generator explicitly flattened its render onto cream; this was asset content, not solely a browser-cache issue.

Existing Sharp 0.35.5 renders the unchanged SVG directly at each target resolution, with no flattening, cropping, rescaling of the viewBox, redraw, outline or color substitution. The ICO preserves its existing directory, sizes, 32-bit bottom-up BGRA DIB format and 15,086-byte length. It now retains the original alpha and uses a DWORD-padded AND mask whose bits are set exactly where alpha is zero. Partially transparent antialiasing is preserved.

| Frame | Fully transparent pixels | Partial-alpha pixels | Opaque pixels | Exterior corner alpha |
| --- | ---: | ---: | ---: | ---: |
| 16px | 120 | 80 | 56 | 0 |
| 32px | 542 | 185 | 297 | 0 |
| 48px | 1,282 | 295 | 727 | 0 |

Every decoded frame matches an independent original-SVG RGBA render exactly. Structural checks verify the directory, dimensions, offsets, lengths, bit depth, row order, bitmap headers and each transparency-mask bit.

SHA-256:

- Original favicon: `a0b95a9824c230b125399ebff7790c58f0e2b9aff580c20c70992a91eb651525`
- Corrected favicon: `acb7e2cd64d5546fe4368f34fe22bf1d6ed81713be287f918e6a78f4dd876725`
- Unchanged approved SVG: `df0e4c53464c43d965af9230f8fd03fad4ecb1301256444d8654b6467e0df333`

## Apple-touch and installed-PWA decision

Retain the opaque 180px Apple-touch PNG. Chrome's published Apple-touch guidance recommends a valid 180px/192px icon with a nontransparent background: [official guidance](https://developer.chrome.com/docs/lighthouse/pwa/apple-touch-icon). Its Lighthouse PWA audit is deprecated; this is platform guidance, not a claim of a new Lighthouse certification or identical rendering on all Apple versions.

Retain the accepted opaque 192px and 512px PWA PNGs. Their existing manifest entries omit purpose and therefore remain ordinary `any` icons; they are not declared maskable. Transparency is not universally prohibited for `any`, but no installed-icon defect was demonstrated and an additional transparent variant would not improve the reported tab-favicon problem. Preserving the current assets avoids an unnecessary installed-app appearance/configuration change. The [Web App Manifest specification](https://www.w3.org/TR/appmanifest/#icons-member) distinguishes these icon purposes; no new maskable/safe-zone compatibility claim is made.

`app/manifest.ts` and `app/layout.tsx` are byte-for-byte preserved, including icon paths, Apple metadata, startup/theme colors, display mode, scope and start URL. No new icon variant, dependency, configuration or SVG was introduced.

## Validation and review evidence

**PASS** — `node test-results/visual-v15cr/check.cjs`:

- Exact source geometry/colors/alpha in all three ICO frames; matching transparent masks and corners.
- Chromium independently decodes single-frame ICO containers at 16/32/48px; canvas readback confirms alpha-zero exterior corners and opaque artwork.
- All PNG signatures/dimensions/opaque formats and hashes remain correct; approved SVG and manifest/layout hashes match baseline.
- Installed Next-generated favicon and manifest GET handlers return exact bytes/JSON in a bounded loopback fixture. All existing icon destinations return HTTP 200 with appropriate MIME types; Chromium's manifest parser reports zero errors.
- Every gallery image decodes; zero unexpected external requests or browser/page/fixture errors.
- Node syntax checks and focused whitespace/strict UTF-8 checks pass. No TypeScript/application source changed, so no broad build or TypeScript suite was needed.

Existing V1.5C static checks were reused and adapted in ignored local evidence for the new transparency contract. The database/authentication-dependent `tests/phase9-pwa.browser.cjs` was deliberately not run; no tracked test needed alteration. No application server, real login, database, Storage, email or provider operation occurred.

Owner gallery: `test-results/visual-v15cr/index.html`; comparison image: `test-results/visual-v15cr/comparison.png`; machine-readable evidence: `results.json`; reproducible local generation/check scripts are alongside them. These are ignored review artifacts, not new application assets.

Visual inspection: the cream rectangle disappears on Dark; the blue pages, gold check and arc remain recognizable at native sizes on Light/Dark reference surfaces. The dark teal perimeter naturally has lower contrast on Dark and fine detail compresses at 16px. No artificial border, backing or white outline was added.

Image/canvas checks and static comparisons do not establish actual browser-tab chrome, OS icon selection, installation or physical-device appearance. Those remain owner acceptance items. Browser and OS icon caches may retain the earlier artwork; a fresh local browser profile or private window may help comparison but is not a guaranteed cache reset. No cache clearing, browser installation, deployment or device operation was performed.

**Anti-Slop PASS:** unchanged identity and geometry, no decoration or redesign. **Ready for owner icon acceptance and later separately authorized Visual-V1.5 closure.** This checkpoint does not close V1.5 or imply acceptance of other pending visual scopes. Stop without staging, committing, pushing, merging or deploying.
