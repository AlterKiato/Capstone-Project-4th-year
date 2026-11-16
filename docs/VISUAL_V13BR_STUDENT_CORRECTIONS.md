# Visual-V1.3B-R: Student headings and compact Group Members control

Date: 2026-11-16 (Asia/Manila). Status: **implemented locally; focused synthetic checks PASS; owner visual acceptance PENDING**. No staging, commit, push, merge or deployment. Accepted project switching, cross-submission feedback, mobile behavior, backdrop and other-role presentation are preserved.

## Baseline and exact scope

Verified `feature/development`, HEAD `0d2c0ef8b707207ffb61c68da006b307472e4f0a`, empty index. The incoming tree contained all pending V1.3A/V1.3A-R/V1.3B-Student work, three modified canonical/authentication documents and two untracked Groq developer files. All 680 incoming nonignored files were hashed before this correction.

Only these deliverables change here:

- `components/dashboard/group-members.tsx`
- `components/dashboard/student-ui.module.css`
- `components/dashboard/student-progress-widgets.module.css`
- `docs/VISUAL_V13BR_STUDENT_CORRECTIONS.md` (new)

The shared GroupMembers component has one current consumer: the Student Dashboard. No membership service, query, authorization, data contract, theme token, backdrop/navigation stylesheet, other-role component or previous report changes.

## Group Members behavior and appearance

The existing button, count and complete `Group Members · View Members / Hide Members` label remain. Border, colors, font family/size/weight, line height and radius match the baseline. Intrinsic sizing and padding `.35rem .65rem` remove excess width/padding while retaining the 44px minimum touch target. Existing member-list markup, names, order, bullets, spacing and source are unchanged.

Mouse entry opens the disclosure. Pointer entry/exit handlers live on the existing combined wrapper containing both button and list, including the list's existing margin gap. Moving from the button through that gap into the list keeps it open; leaving the combined region closes it, including after a mouse click. Mouse clicks do not pin the list open.

Touch/pen activation retains toggling. A ref records pointer type so hybrid touchscreen devices can use tap activation independently of mouse hover. Keyboard-visible focus opens the list; Enter/Space toggle it, Escape dismisses it and leaving the focus region closes it. Existing `aria-expanded` / `aria-controls`, native button semantics and focus styling remain. No new icon, tooltip, popover, portal, global event listener or interaction dependency.

## Heading corrections

Research Progress and the secondary widgets already use headers containing 44px Help controls. Latest Feedback's shorter header caused its title to sit above its neighbor. Its existing heading now has the same 44px minimum header height; SVG/title centers align in the desktop comparison. No new Help control was added.

Standard Student card titles, group identity and project-context headings use weight 700; summary headings and the project-selector label use the same bold weight. Existing heading sizes, icons, palette and body copy remain. The Group Members button's existing typography is deliberately unchanged.

## Verification and evidence limits

Ignored evidence: `test-results/visual-v13br/index.html`, fixture/build/verification scripts, before/after screenshots and `evidence.json`. Real application components render with synthetic records and mocked service/action/authentication boundaries. External requests are blocked.

| Check | Result |
|---|---|
| Focused browser verification | PASS: 42 views, 31 state/interaction checks, six other-role comparisons, 2,118 text observations, minimum checked contrast 4.56:1, zero page errors/unexpected requests |
| Compact appearance | PASS in Light/Dark: narrower button, >=44px height; exact baseline border/radius/colors/font/line-height; unchanged computed member-list appearance/content |
| Hover / focus / activation | PASS: mouse opens, button-to-list gap and list traversal retain visibility, combined-region exit closes after click; keyboard focus/Enter/Space/Escape/Tab; touch-emulated taps open and close |
| Heading presentation | PASS: aligned primary-card title/icon centers, weight 700 on standard Student headings; desktop/mobile screenshot review |
| Preserved Student behavior | PASS: existing eight responsive widths, project switching and scoped links, cross-project Latest Feedback, single/multiple projects, long content, empty/loading/error states/retries and late-response protection |
| Other-role / backdrop preservation | PASS: exact Main/Co/Admin computed comparisons in Light/Dark and unchanged backdrop; SHA-256 preservation confirms untouched source files |
| Current-source TypeScript | PASS: 402 roots, excluding only 3,583 stale ignored historical build-source roots in memory; no compiler/configuration output. Historical unfiltered-command limitation remains documented |
| Targeted ESLint | PASS: `components/dashboard/group-members.tsx`, no autofix |
| Integrity | PASS: scoped whitespace, UTF-8, expected branch/HEAD, empty index and incoming-file preservation checks |

**Anti-Slop / React review: PASS for the correction.** Existing visual design and meaningful labels are retained; no decorative expansion or new framework. React state/ref handling stays inside the existing client disclosure, with no effects, subscriptions or backend path. Keyboard/touch accessibility and honest evidence classification are preserved.

Synthetic browser evidence is separate from owner acceptance. Fixtures use fallback fonts; Manrope configuration remains unchanged. Physical touchscreen/browser behavior, screen-reader speech and authenticated/hosted transport remain NOT TESTED. Actual AI Assistant dragging/resizing is not exercised; its source and shell positioning remain unchanged. No broad historical suite or production build is claimed.

## Owner review

Ready for owner acceptance: hover over Group Members, move into the list and then outside; verify compact button styling and unchanged names/list appearance. Check keyboard focus/activation and a touch tap where available, then review aligned bold titles in Light/Dark. No new manual PASS is inferred. Stop after this correction; no publication or automatic next checkpoint.
