# Visual-V1.5D-B — Adviser AI Research Assistant modernization

Date: 2026-11-17 (Asia/Manila). **Implementation and focused local validation: PASS. Owner visual acceptance: PENDING. Checkpoint closure: PENDING.**

## Baseline and scope

Verified branch `feature/development`, HEAD `b3d19d44e90132da1335773f90472fcb10fe15ce`, empty index and 16 incoming pending paths. SHA-256 baseline covers all 698 nonignored files, including every incoming pending file. Evidence is under ignored `test-results/visual-v15db/`.

Exact checkpoint files:

- `app/dashboard/adviser/page.tsx`
- `components/dashboard/co-adviser-overview.tsx`
- `components/dashboard/adviser-research-assistant.tsx`
- `components/dashboard/adviser-research-assistant.module.css`
- `tests/ai-a11-research-assistant.browser.cjs`
- `docs/VISUAL_V15DB_ADVISER_AI_MODERNIZATION.md` (this report)

No staging, commit, push, merge, deployment, dependency installation or canonical-document edit. No real database, email, Storage, authentication or AI operation.

## Result and preserved boundaries

Main and Co-Adviser dashboards now have a compact AI Research Assistant entry linking to the existing `/dashboard/adviser/submissions` directory. Neither dashboard mounts chat or performs an additional AI read. The existing authorized Main review or exact assigned Co review remains the assistant host at `/dashboard/adviser/submissions/[submissionId]`; no independent route was added.

The compact header identifies prepared Demo examples. User messages have a restrained inset surface; structured assistant answers remain unboxed, with clearer spacing and line height. The fictional excerpt sits within the existing explanatory disclosure. A persistent composer labels the reviewed-question restriction. A new supported-question disclosure uses existing canonical strings: selecting one fills and focuses the textarea without sending; existing starter/follow-up actions retain their accepted submission behavior.

Clear and Finish Chat labels describe the selected conversation scope. The Adviser-only wrapper separates the unchanged shared synthetic evaluation controls and explains that conversation clearing does not reset evaluation results. Evaluation results remain temporary component state and may clear through existing availability, unmount or responsive/context behavior; no persistence guarantee was introduced. Shared Admin presentation and evaluation logic are unchanged.

Access denial or an uncertain Demo response still closes and clears the assistant, removes its launcher and invalidates recovery. The existing generic explanation is now a visible, polite, atomic status outside hidden assistant content. Focus moves there when it was inside the removed assistant. The status adds no submission metadata. This is an assistant-state correction, not a change to the underlying review page's existing access lifecycle.

Existing Server Actions, services, entitlement checks, institutional eligibility/consent, fixed fictional excerpt, exact questions and follow-up rules, four-exchange bound and context/account/authority/version-bound sessionStorage recovery are unchanged. Institutional Live remains disabled. The separate restricted synthetic evaluation retains its allowlists, budget and provider disclosure; it is not institutional Live access. No manuscript/PDF input, arbitrary chat, transcript persistence, academic decision or new provider capability was added.

## References and design review

Reviewed [assistant-ui](https://github.com/assistant-ui/assistant-ui), [shadcn chatbot template](https://github.com/shadcn-ui/chatbot-template) and [Vercel chatbot](https://github.com/vercel/chatbot) for thread hierarchy, controlled whitespace, suggestion controls and persistent composition patterns only. No repository was cloned; no code, assets or dependencies were imported. Implementation uses existing React components, CSS modules, design tokens and installed Next.js documentation.

`DESIGN.md`, `ANTISLOP.md`, the V1.3/V1.4 closure evidence and V1.5D-A findings guided this scope. Manrope configuration, accepted Light/Dark/System themes, cream/deep surfaces, blue/gold accents, rounded geometry and focus treatment remain in place.

Anti-Slop During review: **PASS for the implemented local scope**, subject to owner visual acceptance.

| Review block | Evidence |
| --- | --- |
| Hard Gate | Working synthetic controls, visible empty/loading/error/denied states, keyboard focus and responsive checks; required synthetic/governance labels retained under scope precedence. |
| Purpose | One contextual directory entry, distinct message hierarchy, canonical suggestions; no decorative avatars, gradients or new assets. |
| Liveliness | Existing restrained academic palette/type and ENERGY 1 / RHYTHM 2 / MOTION 1; no added motion. |
| Craft | Scoped CSS, TypeScript/ESLint checks, synthetic interaction evidence and protected-file hashes. |

React checklist: hooks remain unconditional; focus tracking uses stable refs/callbacks; existing event cleanup and request invalidation remain; no new fetch, service, bundle dependency or server authorization path. Styles are Adviser-scoped; shared evaluation source is unchanged.

## Focused validation

| Check | Result and boundary |
| --- | --- |
| Complete existing plus extended Chromium harness | **20/20 groups PASS**, zero browser errors, unexpected external requests or academic writes. Preserved in `browser-full-results.json` and `browser.log`. |
| Final D-B screenshot/support delta | **4/4 groups PASS**, `browser-results.json` and `browser-delta.log`; no application change after the complete run. |
| Main/Co entries and authorized navigation | Both roles link to the directory without a dashboard launcher; synthetic navigation reaches actual review components with exact assignment context. |
| Demo contracts | Three starters, canonical suggestion fill/focus without send, explicit Send, unsupported-text rejection, follow-ups, four-exchange limit, late-response invalidation and context-bound recovery PASS. |
| Conversation and availability | Loading/error, Clear, Finish confirmation/cancel, account/version/authority changes, denial clearing, visible atomic status and focus PASS. |
| Separate evaluation | Actual shared component with synthetic action doubles: fixed selector, disclosure, loading, generated/error result, refresh and independent conversation clear/Finish PASS. Native disclosure is reopened when necessary; source behavior is unchanged. |
| Window and review isolation | Desktop pointer/keyboard drag and resize, viewport bounds, Escape/focus restoration, preserved review/Co drafts, higher-priority dialogs and mobile focus containment PASS. |
| Responsive/themes/accessibility | 1440px and 360px Light/Dark views, short viewport and simulated installed bottom navigation; no horizontal overflow, reachable composer, 44px controls (48px launcher), visible focus PASS. Fifteen measured text samples have minimum contrast **5.24:1**; disabled controls excluded. |
| Synthetic unit coverage | **57/57 PASS with an ignored fixture adaptation**, described below; no production auth/service edits. |
| TypeScript | Current nonignored source, 394 roots, TypeScript 5.9.3: **zero diagnostics**; no emit/incremental artifacts. |
| Targeted ESLint / CJS syntax / whitespace / UTF-8 | **PASS** for checkpoint files; LF/CRLF Git advisories do not represent file normalization. |

The browser harness compiles real Main/Co review hosts, dashboard overview content and the assistant/evaluation components, using synthetic account/service/action/PDF/navigation doubles. The Main overview export is fixture-only. Test support was updated for newer evaluation actions, current labels and asynchronous navigation/disclosure behavior. Results establish local component behavior, not authenticated Next.js transport or operational Groq acceptance.

The original unit command reported 46/57 PASS: eleven existing evaluation-fixture failures followed the Student OTP auth refactor (`./student-verification` was unresolved by its VM loader). An ignored loader then gave 55/57; two remaining fixtures still bypassed current session-account validation. An ignored copy of that test delegates its synthetic `getSession` to the real principal resolver with a synthetic account repository; all 57 then pass. Repository unit tests, auth and services were not edited. Reproduction/support and the original failures are retained in `unit.log`, `unit-adapted.log`, `unit-final.log`, `unit-loader.cjs` and `developer-ai-evaluation.adapted.cjs`. This does **not** claim the original unadapted suite passes.

No new production build was run. Prior SEC-Next16-P1 build evidence remains historical evidence only. Hosted deployment, real authentication/database/Storage/provider workflows, physical devices, OS safe areas/software keyboard, installed PWA and screen-reader acceptance are **NOT TESTED**. Browser screenshots use fallback fonts and synthetic names; configured Manrope was not fetched. Simulated Live-available fixtures test retained UI branches without enabling institutional Live or invoking a provider.

## Owner review and next boundary

[Open the local review gallery](../test-results/visual-v15db/index.html): 20 selected views covering Main/Co entries, empty/thread states, evaluation and access loss across desktop/mobile and Light/Dark. Representative PNGs were inspected locally. Owner acceptance remains pending; local checks do not automatically approve the presentation.

V1.5D-B is ready for owner visual review. **V1.5E / Admin AI modernization has not started** and requires acceptance plus separate scope authorization.

## Preservation evidence

Final branch and HEAD match baseline; index remains empty. Of 698 baseline files, 693 are unchanged and only the five authorized existing source/test files differ. This report is the sole added nonignored file. All 16 incoming protected files remain present, byte-for-byte unchanged and unstaged; their original pending statuses remain. Final total: 22 pending paths. Machine comparison: `test-results/visual-v15db/preservation.json`.

For each row below, the **before and after SHA-256 are identical**:

| Protected path | Before = after SHA-256 |
| --- | --- |
| `app/favicon.ico` | `a0b95a9824c230b125399ebff7790c58f0e2b9aff580c20c70992a91eb651525` |
| `app/layout.tsx` | `994b83adab885f77f04417aaa740de75797afca2338186554cea26e8c9af7b85` |
| `app/manifest.ts` | `ee81da22e99cea3af8383817e8e8deea56aeacb3ddd8835b3bc1c58f57bbbd6f` |
| `components/dashboard/dashboard-shell.module.css` | `d8a3c4225b8e4009fdfbf4482058ca5a76aa8a66853867308d1cdfbda1f08519` |
| `components/dashboard/dashboard-shell.tsx` | `5b9b06e2edf3b8e6c9534dbdcf6e825041c1466be22bdd9db558b2d5eaece916` |
| `docs/MASTER_CONTEXT_UPDATED.md` | `bb72b97e82a7c1dcd1df468218b2f58e9f974953291885e4c5ffc70773f736fe` |
| `docs/PHASE10_STUDENT_EMAIL_OTP.md` | `de6385df2cb27b491af0de4366e72ec7abcc9f2d57baf6d77118780d2e49a44d` |
| `docs/SOURCE_OF_TRUTH_UPDATED.md` | `827f92703f2b6bbc72ed2e6b577aa353890813f4e855edbae8f007d7f3ea135a` |
| `public/icons/thesishs-192.png` | `97b0f0024a54ec2f06d5f461216f4e0bc7cccd53dc515e997d18d736d9527111` |
| `public/icons/thesishs-512.png` | `06d4d96daaa994344b3a6cb4617c7bbb689daf6549712a2f646e393143de601f` |
| `public/icons/thesishs-apple-180.png` | `8ac0dbe411805d57023aaf3839c436eb5c7d4d4361ea6e02e14597f3606467c3` |
| `tests/phase9-pwa.browser.cjs` | `9946c074209e7ece658179f91a25a316d9f8a7f75a86ec1e6f53542dfaf5669f` |
| `docs/VISUAL_V15B_DASHBOARD_BRANDING.md` | `a07d8a622d71742d8173ba727a8d1984ae62e3d46eeaf69e67d39363c8efc2cc` |
| `docs/VISUAL_V15C_PWA_IDENTITY.md` | `70e6497606f41d53d1a49c4017664172a6e3435a7b9972db6d450d756d09df85` |
| `scripts/groq-developer-test.cjs` | `59f684334a9782b812351b41ad6c98f573e30acf6a366ba3e424f64bdb5f017c` |
| `tests/ai-p212-developer-groq.unit.cjs` | `cb9b4e2bd582dadbcab1049540b09e6d3a61fadd81ccf6de16324b0e59f63a35` |
