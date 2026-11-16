# Visual-V1.4C-R: Registration password visibility

Date: 2026-11-17 (Asia/Manila). **Local implementation and focused checks: PASS. Refinement owner acceptance: PENDING.**

The owner reports acceptance of all five V1.4C visual areas. That owner-reported acceptance supersedes the pending V1.4C acceptance wording in the earlier implementation report, which remains unchanged. This final Registration usability refinement does not reopen the accepted design or start V1.4D.

## Baseline and exact changed files

Verified branch `feature/development`, HEAD `155b3b2ce9fcb899be2102797057235b680d1b69`, empty index. The incoming uncommitted landing/auth presentation, assets, reports, three protected documentation changes and two protected Groq files were inspected and preserved. SHA-256 baseline: 693 nonignored files.

- `components/auth/register-form.tsx`: two independent, initially false visibility states; existing inputs wrapped in the existing password-control structure; two accessible eye buttons using the existing Login inline SVG pattern.
- `docs/VISUAL_V14CR_REGISTRATION_PASSWORD_VISIBILITY.md`: this new report.

No CSS, layout, page, Login/OTP component, dependency, server action, schema or validation change. Existing `.auth-password-field` / `.auth-password-toggle` styles supply positioning, input padding, colors, hover, visible keyboard focus and 44 x 44px button targets. Accepted form geometry and styling are retained.

## Implementation and accessibility

Password and Confirm Password are masked on initial render. Each button changes only its corresponding input's type between `password` and `text`. Existing uncontrolled input nodes remain mounted, preserving their typed values. Activation follows the existing Login focus behavior: the native button keeps focus, and Tab continues through the form without forced input focus or remounting.

Both buttons have `type="button"`, dynamic accessible labels/title, and `aria-controls` pointing to the corresponding input. Labels are exactly Show password / Hide password and Show confirmation password / Hide confirmation password. The decorative 20px SVGs are hidden from accessibility APIs and are not focusable. The slash reflects the revealed state, matching Login. No icon package or shared component refactor was introduced.

All original field names, order, labels, autocomplete, required flags, min/max attributes, described-by/help text and form messages remain unchanged. The existing `useActionState(registerAction, initialState)` and submit/pending behavior are unchanged. The registration schema still requires matching passwords, at least eight characters, at most 100 characters, and at most 72 UTF-8 bytes for the password. Confirmation matching and Student registration authority remain server-side; no duplicate client-side matching rule was added.

## Focused validation

Reused the existing V1.4C offline fixture builder with actual current pages, forms, CSS and theme components. Session/status/configuration, Server Actions and Next presentation boundaries are doubles. No server, real account, email, database, Storage or AI/provider operation occurred. The established filesystem-only esbuild fallback was used; all browser requests were fulfilled locally or blocked. Fallback fonts are used in screenshots.

Ignored evidence: [gallery](../test-results/visual-v14cr/index.html), [browser results](../test-results/visual-v14cr/evidence.json), [browser checks](../test-results/visual-v14cr/verify.cjs), [incoming hashes](../test-results/visual-v14cr/baseline-hashes.json), and [preservation proof](../test-results/visual-v14cr/preservation.json).

| Check | Result |
| --- | --- |
| Light/Dark desktop/mobile | PASS: 1440px and 360px in both themes; masked/revealed screenshots and visual review; no horizontal overflow |
| Independent state | PASS: both masked initially; Password-only, both revealed, Confirmation-only, then both masked; labels and types follow each field |
| Value/node/focus preservation | PASS: synthetic values unchanged through every toggle; original input nodes retained; native button focus and normal Tab order preserved |
| No accidental submission | PASS: valid, fully populated form generates zero action calls during mouse, touch, Space and Enter eye activation |
| Keyboard/touch | PASS: Tab reaches each button; Space/Enter activate; visible focus rings; mobile touch activation; both targets 44 x 44px |
| Input contracts | PASS: source AST comparison confirms all original non-type attributes and all five field positions exactly match the incoming form |
| Native validation/submission | PASS: missing confirmation and too-short password prevent submission; unchanged valid five-field payload reaches only the offline action double; pending/error announcement retained |
| Actual unchanged registration schema | PASS: matching values and the 72-byte boundary accepted; mismatch, seven-character password, >100 characters, and >72 UTF-8 bytes rejected with existing messages |
| Login/OTP smoke | PASS: Login reveal retains value without submitting; OTP leading-zero `000007` reaches offline confirmation and shows its error; unavailable delivery leaves Verify enabled and Resend disabled |
| Browser integrity | PASS: zero page/console errors and zero unexpected requests |
| TypeScript | PASS: 403 current source roots, zero diagnostics, no emit/incremental writes; 3,590 ignored historical/fixture roots excluded in memory only |
| Targeted ESLint | PASS: `npx.cmd eslint components/auth/register-form.tsx`, no autofix |
| Whitespace/UTF-8 | PASS: scoped Git check plus strict UTF-8 decoding, no replacement/NUL characters or trailing whitespace in both deliverables |

The browser tests exercise real React state and native controls with simulated action results. The schema checks call only the real pure Zod schema. They do not establish account creation, email delivery, deployed registration or physical-device acceptance. Unchanged V1.4C evidence is retained; no broad legacy suite or production build was rerun.

Accessibility finding: the reused muted eye color clears the 3:1 graphical-control contrast threshold against the opaque input surface in both themes; exact computed ratios and target dimensions are in the browser results. Existing text colors/contrast, form surfaces and keyboard focus styling are unchanged from accepted V1.4C. No new accessibility blocker was observed within these focused checks.

## Preservation and handoff

Comparison of all 693 incoming nonignored files confirms **692 unchanged**, with only `components/auth/register-form.tsx` intentionally changed. This report is the only new nonignored file. All accepted landing/auth presentation files, earlier reports, assets, attribution, global styles, Login/OTP implementation, server operations and unrelated pending work remain byte-for-byte unchanged. The ignored preservation proof includes SHA-256 values for all five protected files:

- `docs/MASTER_CONTEXT_UPDATED.md`
- `docs/PHASE10_STUDENT_EMAIL_OTP.md`
- `docs/SOURCE_OF_TRUTH_UPDATED.md`
- `scripts/groq-developer-test.cjs`
- `tests/ai-p212-developer-groq.unit.cjs`

Branch/HEAD are unchanged; index remains empty. No commit, push, merge, deployment, database write, real email, AI call, environment change or dependency install.

**Anti-Slop During verdict: PASS for this refinement.** The owner-requested controls serve a concrete form usability purpose, reuse the accepted visual pattern, remain keyboard/touch accessible and work in both themes. Existing ENERGY 1 / RHYTHM 2 / MOTION 1 direction and all accepted background/branding treatment are preserved. No redesign, decorative assets or extra visual effects were added.

Ready for owner acceptance: review Password and Confirm Password visibility independently on Registration, including keyboard/touch use in Light/Dark. The broader five-area V1.4C acceptance remains owner-reported PASS; this refinement awaits its own acceptance. V1.4D has not begun and will not start automatically.
