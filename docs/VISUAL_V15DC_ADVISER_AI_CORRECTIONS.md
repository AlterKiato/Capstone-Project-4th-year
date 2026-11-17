# Visual-V1.5D-C: Minimalist Adviser AI chat corrections

Date: 2026-11-17 (Asia/Manila). **Implementation and focused local validation: PASS. Owner visual acceptance: PENDING.** Dashboard integration and responsive preservation retain the owner's incoming PASS classification; this report does not close the three owner-reported failed areas automatically.

## Baseline and exact scope

Confirmed `feature/development`, HEAD `b3d19d44e90132da1335773f90472fcb10fe15ce`, empty index and 22 incoming pending paths. All 699 nonignored files were hashed before editing. D-B's pending implementation was the baseline, not discarded work.

Exactly three existing files change, plus this report:

- `components/dashboard/adviser-research-assistant.tsx`
- `components/dashboard/adviser-research-assistant.module.css`
- `tests/ai-a11-research-assistant.browser.cjs`
- `docs/VISUAL_V15DC_ADVISER_AI_CORRECTIONS.md` (new)

Read project instructions/design, D-B report, relevant assistant/governance presentation, installed Next client-component guidance and Anti-Slop. The owner's five screenshot files were not present in this attachment; the follow-up supplied reference links. Corrections follow the detailed written findings, incoming implementation/screenshots and [shadcn Chat](https://ui.shadcn.com/docs/ai-elements/base/chat), [Bubble](https://ui.shadcn.com/docs/components/base/bubble) and [Vercel chatbot](https://github.com/vercel/chatbot) as interaction/visual references only. No reference code, assets, components or dependencies were imported.

## Findings addressed

| Owner finding | Result |
| --- | --- |
| A. Instructional clutter | Default view keeps the Demo identity, mode status, a short empty-thread prompt and composer. One **Demo guide** contains reviewed question choices first, other existing task actions and an expandable scope/limitations section. Fictional excerpt, consent access, recovery limitations and window reset remain available there. |
| B. Assistant replies unframed | User bubble remains right-aligned; assistant bubble is left-aligned with an existing neutral surface and one restrained border. Structured answer headings have more breathing room; there are no nested decorative section cards. Exact response labels, strings and four result fields remain unchanged. |
| C. Oversized header controls | Clear/Restart and Close use consistent 18px glyphs, unframed backgrounds and a 32px hover surface inside unchanged 44x44px interactive targets. Native titles, accessible names, keyboard focus and drag exclusion remain. |
| D. Finish Chat looks like a link | Existing `type="button"` trigger now has secondary-button padding, border, radius and hover/focus treatment. Confirmation, Cancel, selected-mode clearing and other-conversation preservation remain. Escape dismisses the innermost guide/Finish surface first; launcher focus recovers after portal teardown without overriding another focused dialog. |
| E. Icon light backing | **Diagnosed, deliberately not changed:** every ICO frame has opaque `#f5f3ea` corners (RGBA 245/243/234/255); all three PWA/Apple PNGs are opaque RGB with the same corner color. The approved source SVG has transparent corners (alpha 0). The backing is part of the generated artifacts, not the SVG; cache alone cannot explain these current bytes. |

Guide behavior: mouse hover previews it; moving between trigger and guidance does not close it. Click pins the preview, keyboard Enter/Space and touch open it, and Close/Escape dismiss with focus return. Leaving a hover preview closes it unless focus remains within the region; outside pointer activation dismisses it while respecting a native modal. Essential guidance is not hover-only. Question selection fills/focuses the existing composer without dispatching; the original task-start and follow-up actions retain their original send behavior.

## Functionality and governance preservation

`send`, `reset`, `submit` and `useFloatingWindow` function source is unchanged (compared after line-ending normalization). Exact reviewed strings, task/history validation, four-exchange bound, request invalidation, response-account checks and context/account/version/authority-bound two-hour Demo recovery remain. Original answer rendering fields/disclosures and human academic authority remain intact.

Demo still uses prepared fictional responses. Institutional Live remains disabled by the unchanged gates; synthetic browser fixtures also exercise the retained guarded Live branch without enabling it. Restricted evaluation retains the actual unchanged shared component, separate provider disclosure, allowlists, budget, fixed selectors and independent results. Its availability/remount behavior remains temporary component state, not a new persistence promise. No AI service, consent, eligibility, repository, authorization or backend file changes.

Accepted Main/Co dashboard entries, review drafts, Student/Admin behavior, floating window bounds, mobile safe-area/bottom-navigation rules, Landing/Auth and V1.5B/C branding remain unchanged.

## Validation

| Check | Result |
| --- | --- |
| Complete existing + extended synthetic assistant browser harness | **22/22 groups PASS**, zero browser errors, unexpected external requests or academic writes. Actual Main/Co hosts, assistant, Radix controls and shared evaluation with synthetic action/service/navigation/PDF boundaries. |
| New correction coverage within that run | Desktop/mobile Light/Dark default, hover boundary, pin/dismiss, Enter/Space/Escape, visible keyboard focus, 44px targets/18px glyphs, exact question selection, two bubble surfaces/alignment, structured long-answer scrolling, Finish confirmation/focus and a separate touch-enabled context all PASS. |
| Preserved regression coverage | Drag/resize/keyboard bounds, short simulated installed-mobile layout, review/Co drafts, higher-priority dialogs, unsupported questions, four exchanges, late responses, Clear/Finish, context/account/version changes, revoked access, recovery and separate evaluation PASS. Access loss remains visible, polite/atomic and focused when appropriate. |
| Demo + recovery unit checks | **28/28 PASS**: `node --import tsx --test tests/ai-a11-research-assistant.unit.cjs tests/ai-p12b-research-draft.unit.cjs`. Uses existing `tsx` for project aliases; bare Node cannot resolve those aliases. No unit source or auth fixture adaptation needed. |
| TypeScript | **403 current project roots, zero diagnostics**, no emit/incremental artifacts; ignored historical fixture roots excluded. |
| Targeted ESLint / CJS syntax / whitespace / strict UTF-8 | **PASS** for the three source/test paths and report as applicable. |
| Text contrast | Measured visible enabled text samples: minimum **5.24:1 Light / 7.34:1 Dark** in correction views. Disabled controls excluded. |
| Preservation | **696/699 incoming files unchanged**; only the authorized three existing paths differ. This report is the sole new nonignored path. All 19 other incoming pending paths match their before hashes and remain unstaged. |

The browser harness required the established filesystem-enabled local retry after sandboxed esbuild ancestor-directory denial. It was updated for guide nesting, native option attributes, keyboard focus-visible modality and one-layer-at-a-time Escape behavior. Evaluation screenshots are captured after Clear/Finish preservation assertions because screenshot/viewport changes can revalidate/remount its existing temporary state. Final 22-group results are in `test-results/visual-v15dc/browser-results.json`; initial setup/selector failures are not claimed passing runs.

## Icon evidence and separately scoped option

Approved assets are byte-for-byte preserved, including favicon SHA-256 `a0b95a9824c230b125399ebff7790c58f0e2b9aff580c20c70992a91eb651525` and source mark SHA-256 `df0e4c53464c43d965af9230f8fd03fad4ecb1301256444d8654b6467e0df333`. Per-frame/PWA pixel evidence: `test-results/visual-v15dc/icon-diagnosis.json`.

For reproducible owner verification, open the current app's `/favicon.ico` directly and compare its downloaded bytes/hash with this record, then compare the tab in a fresh private window/profile. A remaining old TS icon can indicate retained browser artwork; the current cream rectangle is expected from these artifact pixels. This does not inspect or clear an installed device's icon cache, and browser/OS presentation can also contribute.

If the owner requires no backing, the smallest separately authorized candidate is to regenerate **only the favicon** preserving source alpha and valid ICO transparency/masks. Keep the source SVG unchanged. Reconsider PWA/Apple background treatment separately against installation/mask requirements rather than automatically making every icon transparent. No replacement/variant was generated or applied here.

## Preservation and owner handoff

Branch/HEAD remain as recorded above; index remains empty. Baseline/final file hashes and all 19 incoming protected pending paths are recorded in ignored `baseline.json` / `preservation.json`. This includes both accepted dashboard entry files, V1.5B/C source/reports/assets, D-B report and the five expressly protected paths below. Before = after SHA-256:

| Protected path | SHA-256 |
| --- | --- |
| `docs/MASTER_CONTEXT_UPDATED.md` | `bb72b97e82a7c1dcd1df468218b2f58e9f974953291885e4c5ffc70773f736fe` |
| `docs/PHASE10_STUDENT_EMAIL_OTP.md` | `de6385df2cb27b491af0de4366e72ec7abcc9f2d57baf6d77118780d2e49a44d` |
| `docs/SOURCE_OF_TRUTH_UPDATED.md` | `827f92703f2b6bbc72ed2e6b577aa353890813f4e855edbae8f007d7f3ea135a` |
| `scripts/groq-developer-test.cjs` | `59f684334a9782b812351b41ad6c98f573e30acf6a366ba3e424f64bdb5f017c` |
| `tests/ai-p212-developer-groq.unit.cjs` | `cb9b4e2bd582dadbcab1049540b09e6d3a61fadd81ccf6de16324b0e59f63a35` |

**Anti-Slop During verdict: PASS for the correction scope**, pending owner visual acceptance. Delivery review: existing palette/type/window retained, one guide rather than repeated visible instructions, meaningful two-sided bubbles, compact real controls with keyboard/touch access, no avatars, ornament, animation, gradients or new assets. Required synthetic labels take precedence over stylistic simplification.

[Owner gallery](../test-results/visual-v15dc/index.html): eight selected default/guide/bubble/long-response/touch views, additional confirmation/evaluation/access-loss links, and side-by-side actual favicon/transparent-source evidence. Local screenshots use fallback fonts and synthetic content. The original five owner screenshots, authenticated runtime, real provider/database/email/Storage, physical-device safe areas/software keyboards, Safari and screen-reader speech remain **NOT TESTED** here.

Ready for owner correction review. No commit, push, merge, deployment, dependency installation, canonical-document edit, approved icon edit or Admin AI modernization. Stop for owner acceptance.
