# Warm Tooltip provenance

Official React Bits Warm Tooltip by David Haz, retrieved 2026-10-31.

- Documentation: https://reactbits.dev/micro/warm-tooltip
- TS/CSS registry: https://reactbits.dev/r/WarmTooltip-TS-CSS.json
- Upstream license: https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md
- License: MIT + Commons Clause License Condition v1.0. The full notice is retained in adjacent `LICENSE.md`.
- The same full notice is served with the application at `/licenses/react-bits-warm-tooltip.txt`; the source includes a legal-comment pointer for bundle attribution.
- Original `WarmTooltip.tsx` SHA-256: `69ffa99b90c0b3238bef118ad9f73f3e346eb3694dc5983853fc38508df3762e`.
- Original `WarmTooltip.css` SHA-256: `241941731b1a83626caa3df16bb535e55ece65591154d5eac4ea9c5e3e940386`.
- Original `LICENSE.md` SHA-256: `4bdd1fa59a6b7d5954bc3b213dbc34e455c635a94bbcecf9293553797d0fad02`.
- Registry direct dependency ranges: `react-dom@^19.0.0`, `motion@^12.23.12`. This application pins Motion 12.43.0.
- MIT notices for Motion and the three added transitive packages are served at `/licenses/motion.txt`.

This source is incorporated into the ThesiSHS AI application, not distributed or marketed as a standalone component library. Retain this provenance and the full license with any applicable source distribution; the upstream component redistribution restrictions remain applicable.

Local compatibility/accessibility adaptations:

- Preserve existing `aria-describedby` references while the tooltip is active.
- Dismiss an open hover tooltip on Escape even while focus stays in the editor.
- Publish imperative handlers after commit and mirror render-facing swap/press metadata in React state for this project's React lint compatibility. Keep the upstream disabled-trigger synchronization effect, with one documented lint exception for closing the external group tooltip.
- Prefer the opposite vertical side when the requested side has insufficient space; clamp the portal to viewport bounds.
- Guard viewport reads during Motion's initial server-render calculations so Next.js can pre-render the client component before hydration.
- Remove cold-open/close presence animation under reduced motion, along with optional fuse/layer movement.
- Subscribe to live reduced-motion changes with React's external-store API because the installed Motion 12.43.0 hook samples only its initial preference. CSS also removes visual motion immediately when the preference changes.
- Capture touch pointers on the actual button so a normal tap preserves button activation; suppress the long-press inspection click and clear stale suppression on the next pointer/keyboard activation.
- Application integration uses public theme/color, timing and restrained-motion props. Native editor commands, selection guards and feedback data are unchanged.

Changes are local adaptations of the official component, not a separately authored imitation. This notice covers Warm Tooltip; the separately scoped Swipe Toast integration has its own `SWIPE_TOAST_NOTICE.md`.
