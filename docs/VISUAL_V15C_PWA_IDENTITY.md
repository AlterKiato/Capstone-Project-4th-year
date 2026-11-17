# Visual-V1.5C: Favicon and PWA identity

Date: 2026-11-17 (Asia/Manila). **IMPLEMENTED / focused local checks PASS; owner acceptance pending.** V1.5B owner approval is recorded by the current instruction; its source/report remain unchanged and uncommitted. Anti-Slop: **PASS**.

## Baseline and scope

Before editing: `feature/development`, HEAD `811495d89bf2d50d1b37fb992bb14acb14c5a20c`, empty index. Eight incoming pending paths: the two V1.5B source files, V1.5B report, three protected canonical documents and two untracked Groq developer files. All 696 nonignored files were hashed. After this checkpoint, branch/HEAD/index and all incoming pending paths are preserved. Only seven incoming files change; the other 689 remain byte-for-byte identical. This report is the sole new nonignored file.

Read current `AGENTS.md`, `DESIGN.md`, `ANTISLOP.md`, architecture/PWA guidance, V1.2A token documentation, V1.4D closure, V1.5B report and installed Next.js icon/manifest/PWA documentation. No dependency installation, backend connection, authentication, email, Storage, AI, staging, commit, push, merge or deployment.

## Assets and exact changed files

Source of truth: unchanged `public/branding/thesishs-mark.svg`, SHA-256 `df0e4c53464c43d965af9230f8fd03fad4ecb1301256444d8654b6467e0df333`. Existing Sharp 0.35.5 renders the original 128-unit viewBox directly at each target resolution. No redraw, trimming, SVG editing, text, CASAP branding or generated artwork. A flat opaque `#f5f3ea` background improves small-icon separation on dark browser/OS surfaces and matches the Light startup color.

| Changed/new path | Final result |
| --- | --- |
| `app/favicon.ico` | Real ICO, three 32-bit DIB frames: 16x16, 32x32, 48x48; 15,086 bytes. Previously one 32x32 PNG-backed TS frame, 377 bytes. |
| `public/icons/thesishs-192.png` | 192x192 RGB PNG; 6,279 bytes. |
| `public/icons/thesishs-512.png` | 512x512 RGB PNG; 19,661 bytes. |
| `public/icons/thesishs-apple-180.png` | 180x180 RGB PNG; 5,985 bytes. |
| `app/manifest.ts` | Static `theme_color` and `background_color`: `#f6f8fb` to `#f5f3ea`. |
| `app/layout.tsx` | Static viewport `themeColor`: `#f6f8fb` to `#f5f3ea`; all other layout/metadata source unchanged. |
| `tests/phase9-pwa.browser.cjs` | Update only two obsolete color expectations to `#f5f3ea`; test execution remains deferred because it uses database/authentication. |
| `docs/VISUAL_V15C_PWA_IDENTITY.md` | This report. |

All four previous assets were inspected and contained temporary blue TS artwork. Existing destinations are retained. Next's top-level `app/favicon.ico` convention serves `/favicon.ico` and provides its icon metadata; `app/manifest.ts` supplies `/manifest.webmanifest`. Existing public PNG paths remain in the manifest; the Apple-touch PNG remains explicitly referenced by root `metadata.icons.apple` with `180x180` / `image/png`. No additional application icon files or duplicate metadata links were added.

The manifest had no maskable purpose declaration: omission continues to mean ordinary `any` icons. No separate maskable asset or new purpose claim is introduced. The source's existing padding is retained: visible pixel bounds are x19..172/y23..163 at 192px, x52..459/y63..435 at 512px and x18..161/y22..152 at 180px. Nontransparent artwork fits within a radius below 0.472 of icon width, preserving it through a circular crop. This is **not** the 0.4-radius maskable safe-zone claim.

## Metadata decisions and validation

`app/globals.css` currently defines Light `--background: #f5f3ea`, corroborated by the accepted V1.2A token inventory. Manifest startup/background and root viewport fallback now use that value. Theme selection, prepaint initialization, Dark/System behavior and `colorScheme: "light dark"` are untouched. Static metadata remains static; no dynamic color synchronization is introduced. `start_url: "/dashboard"`, `scope: "/"`, `display: "standalone"`, app names, descriptions, installation and service-worker behavior are unchanged.

Focused results:

- **PASS:** PNG signatures, dimensions, RGB/opaque format, background pixels, exact pixel comparison to independent target-resolution SVG renders and unclipped artwork bounds.
- **PASS:** ICO directory, frame offsets/lengths, bitmap headers, 32-bit BGRA row order, opaque AND masks and exact source-derived pixels for every frame. Chromium decodes the exact ICO bytes via a data URL. Native 16/32/48px previews retain the book/check silhouette; fine arc detail naturally compresses at 16px.
- **PASS:** Installed Next metadata loader-generated favicon and manifest GET handlers, served in a bounded loopback fixture: required paths return HTTP 200, correct MIME types and exact asset/manifest bytes. Actual Next metadata render helpers retain Apple-touch metadata and emit the aligned theme color. Chromium's manifest parser returns zero errors; every gallery PNG decodes. No application server, sign-in or database is involved.
- **PASS:** Targeted TypeScript, 403 project roots / zero diagnostics, `noEmit` and `incremental: false`; ignored historical fixture roots excluded. ESLint on root layout, manifest and the existing PWA test; Node syntax check of that test; scoped whitespace and strict UTF-8 checks.
- **PASS:** All protected incoming hashes match; accepted V1.4 Landing/Auth, V1.5B sidebar source/report, global theme CSS, navigation, role/academic workflows, provider restrictions and dependencies are byte-for-byte preserved.

The fixture's direct browser HTTP ICO image/fetch probe returned `EncodingError` / `Failed to fetch`; the final checks therefore distinguish successful HTTP byte/MIME validation from successful Chromium data-URL decoding. Classic DIB frames are used for broad ICO compatibility. This does not establish actual tab-chrome favicon display. The earlier PNG-frame attempt and HTTP probe failures are retained as limitations rather than reported as passing runtime UI checks. No full production build or database/authentication-based PWA suite was run.

## Preservation evidence

Before = after SHA-256 for every incoming pending path:

| Path | SHA-256 |
| --- | --- |
| `components/dashboard/dashboard-shell.tsx` | `5b9b06e2edf3b8e6c9534dbdcf6e825041c1466be22bdd9db558b2d5eaece916` |
| `components/dashboard/dashboard-shell.module.css` | `d8a3c4225b8e4009fdfbf4482058ca5a76aa8a66853867308d1cdfbda1f08519` |
| `docs/VISUAL_V15B_DASHBOARD_BRANDING.md` | `a07d8a622d71742d8173ba727a8d1984ae62e3d46eeaf69e67d39363c8efc2cc` |
| `docs/MASTER_CONTEXT_UPDATED.md` | `bb72b97e82a7c1dcd1df468218b2f58e9f974953291885e4c5ffc70773f736fe` |
| `docs/PHASE10_STUDENT_EMAIL_OTP.md` | `de6385df2cb27b491af0de4366e72ec7abcc9f2d57baf6d77118780d2e49a44d` |
| `docs/SOURCE_OF_TRUTH_UPDATED.md` | `827f92703f2b6bbc72ed2e6b577aa353890813f4e855edbae8f007d7f3ea135a` |
| `scripts/groq-developer-test.cjs` | `59f684334a9782b812351b41ad6c98f573e30acf6a366ba3e424f64bdb5f017c` |
| `tests/ai-p212-developer-groq.unit.cjs` | `cb9b4e2bd582dadbcab1049540b09e6d3a61fadd81ccf6de16324b0e59f63a35` |

## Owner acceptance and next checkpoint

Gallery: [`../test-results/visual-v15c/index.html`](../test-results/visual-v15c/index.html); full-page image: [`gallery.png`](../test-results/visual-v15c/gallery.png). Includes all native icon sizes, pixel-enlarged favicon previews, dark-surface context and previous TS examples. Ignored evidence also includes `generate.cjs`, `check.cjs`, `generation.json`, `results.json`, `baseline.json` and `preservation.json`; no generated fixture is part of application source.

**Anti-Slop PASS:** one approved identity, restrained flat background, no gradients, ornamental borders, effects, animation or extra symbols. Generation is deterministic using existing tooling.

Owner acceptance remains required for small-size appearance and favicon/application identity. Browsers and installed PWAs can retain old icons independently of application assets; no cache-clearing, reinstallation or device icon refresh is claimed. Actual installed-device masks/startup appearance, Safari/Windows shell behavior, deployed metadata and tab-chrome rendering remain NOT TESTED. No production-readiness claim is inferred.

**Ready for owner V1.5C acceptance, then separately authorized V1.5D review/closure.** No automatic commit, publication or AI modernization; stop here.
