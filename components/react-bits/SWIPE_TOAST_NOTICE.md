# Swipe Toast provenance

Official React Bits Swipe Toast by David Haz, retrieved 2026-10-31.

- Documentation: https://reactbits.dev/micro/swipe-toast
- Official TS/CSS registry: https://reactbits.dev/r/SwipeToast-TS-CSS.json
- License: MIT + Commons Clause License Condition v1.0, copyright 2026 David Haz. Full, unchanged notice in adjacent `LICENSE.md` and `/licenses/react-bits-swipe-toast.txt`.
- Upstream license: https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md
- Registry SHA-256: `8f03b7841a0468a72d5270c7c0654080a597764e43eb0cfb6e8a628ebf167df7`.
- Original `SwipeToast.tsx` SHA-256: `e133570fee810e66a610f9b13fe7b6418787ee0bb14d7bc16c94f9965980257f`.
- Original `SwipeToast.css` SHA-256: `dcb13f804fa6c3012b48bfa3c2c3c2ca35369209c4fe0687283191b516db22be`.
- License SHA-256: `4bdd1fa59a6b7d5954bc3b213dbc34e455c635a94bbcecf9293553797d0fad02`.
- Registry dependencies: `motion@^12.23.12`, `@hugeicons/react@^1.1.10`, `@hugeicons/core-free-icons@^4.3.3`.
- Existing Motion 12.43.0 satisfies the range and React 19 peers. The sole Hugeicons use is the close glyph; it is replaced with the existing application's inline SVG convention. No Hugeicons or other package was installed. Existing Motion/transitive MIT notices remain at `/licenses/motion.txt`.

Application incorporation only. Do not sell, sublicense or redistribute these components as a standalone library or component bundle. Retain this provenance and full license with applicable distribution. This is not plain MIT.

Local adaptations of the official source:

- Replace the close glyph, preserve title/body/fuse, phase transitions, down-swipe/velocity/rubberband handling and optional controls.
- Use safe global-receiver timer calls, committed callback refs and an active guard. A cancellable timeout controls the remaining seven seconds independently of the cosmetic Web Animation; focus/interaction/background pause both. Resume remaining time without resetting on edits. Cleanup cancels timeouts, requestAnimationFrame, Web Animations and Motion values; delayed swipe completions cannot update after disposal.
- Preserve editor focus on appearance and timeout. Manual keyboard dismissal can return to the originating editor without scrolling. Auto-dismiss pauses while the toast owns focus; no keyboard trap.
- Live reduced-motion subscription, server-safe first render, restored focus-visible outlines, 36px desktop/44px touch close target, neutral shared theme/font tokens and forced-colors styles. A reduced-motion fuse is static; ordinary fade/slide motion is suppressed.
- Application wrapper uses one always-mounted polite live region per dirty session; the visual card suppresses duplicate announcements. No portal or viewport globals are read during server render.
- A local body portal escapes the review container's containing block. It prefers an unobstructed bottom viewport slot, accounts for viewport/keyboard changes and safe-area inset, and avoids the PDF, editor, links and review controls. If the viewport has no safe slot, it reserves compact in-flow space beside the persistent draft indicator. This fallback prioritizes usable controls over forced floating placement. Placement observers/listeners exist only while the notice is visible.

The accepted feedback engine, codec, storage representation, two-phase confirmation, navigation guards and PDF lifetimes are not changed by this component.
