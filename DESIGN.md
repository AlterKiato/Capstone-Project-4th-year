# ThesiSHS AI — Provisional Design Direction

Owner direction updated on 2026-10-11. The committed Phase 9.1 implementation (`906bca0`) remains the active UI baseline. Use the existing application, approved decisions in this document and `ANTISLOP.md` as design references. Figma Make is no longer part of the active UI/UX implementation workflow. This document does not authorize Phase 9.2.

## Product direction

- Product: ThesiSHS AI.
- Audience: Senior High School Students, Research Advisers and Administrators.
- Style: Minimal, modern, professional academic application.
- Theme: Light mode only.
- Branding: Temporary text-based "ThesiSHS AI".
- Platform: Responsive PWA-first web application; installation is still deferred to Phase 9.5.
- Target browsers: Android Chrome, desktop Chrome/Edge and iPhone Safari. Targets do not imply completed device acceptance.
- Implementation preference: Existing Tailwind CSS 4 and React components; no new UI component library.
- Priorities: Clear information hierarchy, readable statuses, accessible forms and research workflows over decorative presentation.
- Palette, typography system, logo and icon set: Not finalized. Preserve the Phase 9.1 baseline pending approved design decisions.

## Provisional Anti-Slop dials

- ENERGY: 1
- RHYTHM: 2
- MOTION: 1

These are owner-supplied provisional settings, not evidence of a completed visual audit. Anti-Slop is a design-quality filter; it does not supply missing branding decisions.

## UI decision precedence

1. Existing project security, privacy and authorization requirements.
2. Owner-approved feature scope and workflow behavior.
3. Existing functional implementation and verified application contracts.
4. Approved ThesiSHS AI design decisions in this document.
5. Applicable Anti-Slop design-quality rules.

When Anti-Slop conflicts with an approved product decision, preserve that decision and report the relevant rule and design tradeoff. Light-only remains approved; no automatic dark mode. Decorative interactions must not interfere with research workflows. Production statistics and research records must be real; design references do not authorize invented data or new features.

Existing AI restrictions remain binding: Student guidance stays static, Groq stays hard-disabled, and AI never makes academic decisions. Preserve active-account/current-role/ownership authorization, independent adult verification, versioned consent, k=5 suppression, quotas, provider isolation and safe fallback. Private research and signed URLs must not enter offline caches.

## Active Phase 9 design workflow

1. Read `AGENTS.md`, this document and `ANTISLOP.md`; use the existing application as the functional and visual baseline.
2. Apply Anti-Slop in **During mode** for future owner-authorized UI/UX implementation checkpoints. This is an explicit project preference approved on 2026-10-11, not a machine-wide preference; no global settings change is required.
3. Preserve the minimal academic style, light-only appearance, temporary text branding and ENERGY 1 / RHYTHM 2 / MOTION 1 dials.
4. Reuse existing Next.js/React/Tailwind components and refine only the approved checkpoint's screens. Apply the quality filter while implementing and verify relevant responsive/accessibility behavior before delivery.
5. Preserve approved workflows, authorization and AI restrictions; propose unresolved branding or scope decisions separately for owner review.

The previously planned Figma Make inspection is cancelled. Do not retrieve or edit that prototype or create `docs/UI_UX_REFERENCE.md` for that plan. Future checkpoints still require owner authorization; this direction update does not start Phase 9.2.

## Anti-Slop provenance and attribution

- Upstream: https://github.com/miqdadbadjuber/anti-slop
- Requested URL: https://raw.githubusercontent.com/miqdadbadjuber/anti-slop/main/ANTISLOP.md (HTTP 404 at retrieval).
- Retrieved original English file: https://raw.githubusercontent.com/miqdadbadjuber/anti-slop/388cbe3b6c37d5175b9f460015bb092ef9e34894/antislop.md
- Revision: `388cbe3b6c37d5175b9f460015bb092ef9e34894`; retrieved 2026-10-10.
- Local copy: `ANTISLOP.md`, preserved byte-for-byte including original rule identifiers. Upstream lowercase filename is mapped to the requested local uppercase name.
- License: MIT; Copyright (c) 2026 Miqdad Badjuber (antislop). Full upstream notice is preserved unchanged in `ANTISLOP.LICENSE` alongside the rulebook.
- Integration: Core file only; no optional skills, installer, dependencies or global preferences installed or changed. Upstream setup/mode procedures do not require activating a UI review for this documentation-only task. For future UI work, use the owner-approved During mode recorded above within the authorized checkpoint; do not infer permission to expand scope.
