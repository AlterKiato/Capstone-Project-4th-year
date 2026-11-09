# ThesiSHS AI --- Architecture Reference

**Purpose:** Technical reference for the current application's
architecture, module boundaries, data flow, and security model.

## Preview Web Push operational closure (P.3F.3, recorded 2026-11-05)

**CLOSED / PASS for the agreed synthetic Preview scope.** The configured Ready Preview deployment on `feature/development` is `f82a08105158713ffad5161c0235fac1d23327fd`, served at `https://thesishs-ai-git-feature-development-thesi-shs-ai.vercel.app`. Migration `0015_push_subscriptions.sql` is applied on Supabase Preview `cbkplqkkjuoglpimwmib` (16 ledger entries through 0015; generated ID 17 reflects a rollback gap). Dedicated runtime `thesishs_preview_runtime` has `SELECT`, `INSERT`, `UPDATE` on `public.push_subscriptions`, no `DELETE`/`TRUNCATE` or schema `CREATE`; its existing user permissions are retained. UUID push IDs require no sequence grant. Existing accounts, relationships and sequences were preserved.

The shared validated enrollment/sender configuration is enabled only for the approved Preview branch, with owner-approved contact and matching VAPID key pair (`preview-p3-v1`); private values stay outside Git/logs. Enrollment remains explicit and authenticated, with one device per account and generation/key/lease checks. The root worker handles push/click only: generic research-update text, fixed role notification destinations, no private offline cache. Existing post-commit workflow hooks make one best-effort attempt without changing academic success. The three-second attempt target is not an absolute database/transport completion guarantee.

Configured full build passed. Hosted worker source/MIME/cache/nosniff and unauthenticated API no-store/401 checks passed. Android Adviser enrollment was server-verified; receipt after a synthetic Student submission and tap to `/dashboard/adviser/notifications` are **owner-confirmed PASS**. This does not establish iOS, all event paths, other devices or delivery reliability. Production and retained hosted authorization/Storage gates remain separate. Earlier local-only/no-worker/no-sender/unapplied labels below describe their dated checkpoints and are superseded for current Preview status by this section. See the [closure handoff](MASTER_CONTEXT_UPDATED.md#p3f4-web-push-closure-and-development-handoff-2026-11-05) and [future release policy](SOURCE_OF_TRUTH_UPDATED.md#future-release-policy-owner-decision-2026-11-05); no broad infrastructure or application change is introduced by this documentation closure.

## P.3F.0 local source readiness (2026-11-01)

The combined P.3 implementation is reviewed for one local commit; [owner activation checklist](PHASE10_P3_ACTIVATION_CHECKLIST.md) records all 56 paths and the exact future Preview migration/configuration/device/rollback gates. P.3E.2 independently verified constraints, least-privilege repository behavior and real concurrent enrollment/cleanup with 20 passing checks on a fresh disposable PostgreSQL 18.4 cluster, then removed it. Existing project 0015/grants and hosted pooler/TLS/timing remain unverified; no project database was used. F.0's 83-test smoke, TypeScript, targeted ESLint and offline source checks pass. Prior compile-only evidence does not satisfy configured prerender/finalization. Live Vercel team/project/domain/protection/variable settings require owner verification. Push remains disabled; no real credentials, deployment or device delivery. P.1/P.2 policies remain preserved. This latest handoff supersedes older local implementation-status wording only; no push or automatic next phase.

## Targeted dependency security update (P.3E.1b, 2026-11-01)

Next.js and its paired ESLint configuration are now 16.4.3, with required @next/env/SWC/plugin alignment; Zod is pinned to 4.6.6. Existing React/ReactDOM 19.2.4 and web-push 3.6.7 remain unchanged. Only compatible source-map-js 1.2.2 and baseline-browser-mapping 2.11.34 transitives were additionally updated, within existing parent ranges and without overrides. No application source, API, auth, schema, research-event or worker architecture change was required. P.3E.1a's explicit key-ID re-enrollment behavior is preserved.

Independent isolated verification passes 118 reported tests, TypeScript, targeted ESLint, installed-tree/lock checks and a one-worker production compile under Next 16.4.3. Compile mode omits full prerender/finalization; approved build-time JWT/database configuration was not supplied or replaced with dummy production credentials. No environment files or application services were used. The current npm audit finds no runtime entries and 23 development-only affected package entries, including three high, retained for separate tooling review. This does not verify deployed artifacts or comprehensive application security. Push remains disabled and 0015 unapplied; full build configuration, hosted migration/grants, VAPID activation/deployment and device acceptance remain separate gates. See Master Context for exact version/advisory/test evidence; older no-framework-upgrade wording below records the earlier P.3D scope only.

## Research push delivery integration (P.3D, 2026-11-01)

Locally implemented and isolated-verified; disabled, with migration 0015 unapplied and no actual delivery evidence. `lib/push/config.ts` is server-only and supplies separate public/sender results from one validated VAPID identity. The public-key source remains `THESISHS_WEB_PUSH_PUBLIC_KEY`; matching private scalar and approved contact use `THESISHS_WEB_PUSH_PRIVATE_KEY`/`THESISHS_WEB_PUSH_SUBJECT`. Missing/invalid pair, key ID, contact, Origin, feature flag or an explicit global TLS bypass refuses availability. No values were configured by this checkpoint.

`requestResearchPush` in the Server Action adapter owns `after()` scheduling. Upload `finalize` receives a per-call optional callback, invoked only after the fresh transaction acknowledgement, before independent in-app notification work. It exposes only the committed Adviser/version. The feedback service similarly exposes the persisted submitting Student after `persistAdviserDecision`. Actions select the four fixed event categories; `sendNotification` and the three in-app message helpers remain unchanged. Rollback/replay/uncertain-acknowledgement paths never schedule another attempt. The historical lost-ack best-effort notification limitation is retained.

Both invoking research pages declare Node runtime/60 seconds. The scheduler starts a monotonic clock at action entry, uses a 55-second conservative cutoff (five seconds reserved for overhead), and requires at least four seconds remaining both at enqueue and after-response execution. One three-second attempt target includes lazy service import, repository lookup, signing/validation, HTTPS and optional cleanup. AbortSignal destroys the HTTP request; 1.2-second socket inactivity and 750ms SQL statement/250ms lock caps add safeguards. The guarded Drizzle adapter does not expose Postgres.js cancellation. Pool acquisition, its existing five-second connection setting, hosted identity checks before local SQL settings, commit acknowledgement and event-loop delay may exceed the target. Every DB promise is awaited and expiry is checked before later phases. OS DNS lookup cannot be forcibly cancelled, but late/aborted resolution cannot open a connection. No absolute three-second or durable/exactly-once guarantee.

The delivery repository joins current users to enabled subscriptions by server-resolved recipient, exact Student/Adviser role, active status, current key ID and unexpired authorization/browser lease. It holds no transaction over provider I/O. The sender emits exactly `{v:1,destination}`; the existing worker alone supplies generic text. `web-push@3.6.7` generates AES128GCM/VAPID request details, while a small Node HTTPS transport owns egress: existing canonical provider-host allowlist, validated/pinned public DNS addresses, original TLS hostname/certificate verification, no proxy/reused agent/redirect, 256-byte plaintext, 4096-byte ciphertext, 8192-byte header and 1024-byte response-body caps. Provider bodies/endpoint/keys are discarded, never logged; only structured outcome categories are emitted. Conservative IPv4/IPv6 filtering complements the Apple/Google hostname trust boundary and does not establish provider compromise resistance.

Provider 404/410 conditionally disables only captured user/generation/endpoint, creates a new disabled barrier and erases all capability fields; replacement enrollment survives. Network/timeout/429/5xx/configuration errors retain the subscription, with no automatic retry. TTL is 300 seconds, normal urgency; acceptance is not proof of device display/read. Already accepted notifications and post-lookup account/ownership changes remain in-flight limitations. Schema/grants, credentials, deployment and device acceptance remain separate gates. Full dependency-audit findings and focused evidence are in Master Context; no framework upgrades were made.

## Mobile PWA push client foundation (P.3C.2, 2026-11-01)

Implemented locally; push remains disabled and migration 0015 remains unapplied. A shared Student/Adviser Research Notifications section precedes installation help in the authenticated dashboard. P.1 standalone detection and secure browser capabilities guide presentation without viewport/device classification. Default-disabled clients do not register a new worker, request permission, subscribe or automatically call the subscription API. They may inspect an existing owned registration for explicit cleanup. No Admin/Panel enrollment is mounted.

`public/sw.js` is a single root worker with only push/click handlers, fixed generic text, two destination keys and malformed-data fallback. It has no fetch interception, Cache Storage, sync, automatic renewal or forced activation/takeover. Worker clicks focus existing windows; a verified same-origin worker message requests application navigation through `ReviewDraftBoundary`. Without that bridge the worker only focuses; with no window it opens a fixed normally authorized notification route. Script headers require JavaScript/nosniff/revalidation. Manifest unchanged.

The testable client controller and browser adapter preload readiness/configuration and invoke PushManager.subscribe directly from Enable before an await. Unknown browser subscriptions must be cleared, followed by another explicit Enable click. Current account enrollment requires server confirmation, matching fingerprint and permission; permission alone is insufficient. Subscription material stays in memory/native browser facilities, without application persistence or logging. The JSON API contract is unchanged; optional `X-ThesiSHS-Push-Account` is a concurrency precondition checked against the verified session, never an identity authority. It prevents old UI requests following a switched cookie. Local callbacks use cancellation/epochs and session-expiry checks.

Logout cleanup starts inside the accepted Logout click, after the existing capture-phase draft guard, and is bounded to one second before the unchanged cookie-deleting action. Generation-safe server cleanup and captured native endpoint/key comparison preserve replacements. Cleanup failure cannot block logout; known local capability revocation is attempted on infrastructure failure. Native promises/previously queued notifications cannot be universally recalled; cross-tab cookies remain the existing shared authentication model. P.3D delivery, VAPID activation, migration execution and physical-device acceptance are separate unfinished gates. See Master Context for exact isolated evidence and scope.

## Push subscription backend foundation (P.3C.1, 2026-11-01)

Implemented locally, disabled by default; migration 0015 is prepared **not applied**. The new Node route `/api/push/subscription` delegates to a cookie-authenticated service, strict Zod/Origin/body boundaries and a Drizzle repository. Only current active Student/Adviser accounts qualify. Repository transactions lock the user row, recheck authority/expiry, compare enrollment generations and rely on unique user/endpoint constraints. Disabled rows retain a generation barrier while erasing endpoint/keys. Responses expose only safe metadata; no endpoint or encryption credentials. Shared authentication rate-limit buckets are reused, without changing existing operation thresholds.

This supersedes older blanket statements that all P.3 source is unimplemented only for this backend foundation. No worker, enrollment UI, sender/dependency, VAPID configuration, research-event integration or push delivery exists. Research/in-app notification services, P.1/P.2 and P.4/R.1-R.3 are unchanged. See the current P.3C.1 Master Context handoff for API contracts, isolated evidence and the separately gated P.3C.2 next step. Provider-host validation is registration policy, not a claim of sender-side DNS/redirect/TLS enforcement.

## Phase 10.P2 local closure (2026-10-31)

P.2D is **locally CLOSED — PASS**. The owner accepts the complete P.2 workspace through P.2C.4a: core 5/5, hotfix 4/4, layout 6/6, two-phase confirmation 4/4, rich text accepted, Warm Tooltip 5/5, extended PDF-window/manual renewal accepted, and Swipe Toast 6/6. These are owner-led results, not independent automated executions. Final scoped automated checks and an isolated production build passed; the build used synthetic non-routable resource settings and does not establish deployed environment readiness. Earlier pending labels below retain their implementation-era context; the current P.2D handoff in Master Context controls closure status. P.1 stays CLOSED — PASS; P.3/P.4/R.1-R.3 remain unimplemented and separately scoped.

The delivered toast uses the same official React Bits license and existing Motion 12.43.0, with an inline SVG replacing its optional Hugeicons close glyph; no Hugeicons packages are installed. `ReviewDraftBoundary` retains stable guard controls and exposes a separate dirty/session status. The first clean-to-dirty transition creates one 7,000ms active-time notification; edits do not reset it. Dismissal affects only presentation, with a small persistent unsaved indicator and retained nonvisual navigation limitations. A polite live region, keyboard dismissal, focus-preserving expiry, reduced motion, forced colors and safe-area-aware body portal are scoped to the review form. Placement avoids the PDF/editor/confirmation controls and uses compact reserved in-flow space when no safe floating slot exists. No global toast system, auto-save, new scroll container or review mutation is introduced. Full provenance/notices are adjacent to the components and in public license assets.

## Adviser review PDF duration (P.2C.4, 2026-10-31)

Only the authorized Adviser workspace requests the fixed `adviser-review` purpose through the existing `getSubmissionDownloadUrlAction`. Both action and service validate the purpose enum; the service requires a current active Adviser, current group ownership and the existing exact persisted paper/version PDF path before selecting its server-only `ADVISER_REVIEW_PDF_SIGNED_URL_SECONDS = 1800`. The client cannot supply an expiry value. Default submission downloads remain 300 seconds, including Student and legacy Adviser buttons. The shared signer default, all four repository roles' view/download lifetimes and Admin publication object checks remain 300 seconds. No endpoint or authorization rule is added; the new purpose only selects a fixed lifetime within the existing authorized document boundary.

`SubmissionPdfAccess`, imported only by the Adviser preview, now uses `ADVISER_REVIEW_PDF_RENEWAL_SECONDS = 1680` (1,680,000ms). This is a conservative request-start local renewal threshold, not reliable server-expiry metadata. Existing safe timer wrappers, generation guards, foreground reassessment, explicit renewal and disposal remain. At the threshold the component clears its URL/iframe and offers renewal without making a request. New requests recheck session/account/ownership. Already issued bearer URLs can remain usable for up to their provider lifetime after logout, deactivation or ownership change; local clearing does not revoke them or already loaded/downloaded bytes, including separately opened PDFs. No new revocation infrastructure is claimed. Provider expiry/cache enforcement remains a separate security check. The owner accepts P.2C.4 after extended-window/manual-renewal testing and reports P.2C.3c 5/5 PASS. P.2D is locally CLOSED — PASS; earlier automated evidence below remains distinct.

## Adviser formatting presentation (P.2C.3c, 2026-10-31)

P.2C.3b rich-text behavior is owner-accepted without a supplied case breakdown; P.2C.3c presentation is owner-reported 5/5 PASS. P.2D is locally CLOSED — PASS. P.2C.3c adds the official React Bits TS/CSS Warm Tooltip to the existing editor. `FeedbackEditor` is the only application importer of `components/react-bits/WarmTooltip.tsx`, which is the only application source importing `motion/react`. The root shell, Student feedback readers and shared codec do not import Motion. The sole new direct dependency is pinned `motion@12.43.0`, with required transitive Framer Motion/motion-dom/motion-utils entries; existing packages and tslib 2.8.1 remain unchanged. Motion metadata declares MIT, React 18/19 peers, bundled types and `sideEffects: false`. An isolated minified editor comparison adds 149,420 JS bytes / 50,521 gzip bytes with shared React externals; this is not a production Next.js chunk measurement.

All five formatting buttons remain native semantic toggles with independent accessible names and accurate native command state. Existing inline SVG conventions provide decorative icons, with no icon library. A shared `WarmTooltipGroup` provides 400ms initial hover delay and a 300ms warm window. Desktop fine-pointer controls are 38px; touch/coarse controls remain 44px. Public tooltip props map colors to shared theme tokens and inherit Manrope, with restrained 100ms presence/120ms travel and no lean/pop-scale/blur effect. Inline shortcuts are Ctrl/Cmd+B/I/U only; lists do not advertise invented shortcuts. Existing mouse-down selection preservation and the editing/confirmation engine are unchanged.

The vendored official component retains its grouped portal/lifecycle implementation, with documented local compatibility/accessibility changes: server-safe initial viewport reads; viewport clamping/opposite vertical side on opening; merged `aria-describedby`; committed imperative handlers and state-backed render metadata for React lint compatibility; Escape dismissal while editor focus is retained; native button pointer capture for touch and long-press click suppression without swallowing the next activation. A live `useSyncExternalStore` media subscription replaces the installed Motion hook's initial-only reduced-motion sample; presentation CSS immediately removes transforms/blur/fuse motion and the source skips presence animation when reduced motion is active. One narrowly documented lint exception retains the upstream effect that closes the external group tooltip when its trigger becomes disabled. No global lint setting changes.

React Bits is **MIT + Commons Clause**, not plain MIT. Adjacent `LICENSE.md`/`NOTICE.md` retain the full copyright/permission notice, upstream URLs, retrieval date, original TS/CSS/license hashes and local adaptations. The full React Bits notice is served at `/licenses/react-bits-warm-tooltip.txt`; Motion/transitive MIT notices are at `/licenses/motion.txt`. This is application incorporation, not standalone component-library redistribution. The public asset and legal-comment pointer preserve attribution; no licensing exemption or broader redistribution permission is claimed.

Only existing `.feedbackEditor` and wide `.reviewBody` scroll surfaces are refined. Their native `overflow-y: auto` remains; no new nested scrolling region or scroll-state JavaScript is added. On fine-pointer/hover layouts, native thin scrollbars retain a visible, contrast-appropriate thumb while overflowing, with transparent tracks and stronger hover/focus emphasis. Stable gutters avoid text-width shifts. Engines lacking standard scrollbar styling get a scoped WebKit pseudo fallback or keep native behavior. Touch/coarse layouts remain native; forced colors and increased contrast restore automatic native width/colors. Review content is explicitly keyboard-focusable, including completed history. The consistently thin, discoverable thumb is intentional instead of fragile fully automatic hiding. Sidebar/global scroll styles and the browser-owned PDF iframe scrollbar are untouched.

Focused evidence: Chromium 153.0.8010.12 and installed Microsoft Edge 156.0.4314.58, each in isolated headless contexts with synthetic source/service fixtures, desktop and emulated touch, plus real React SSR/hydration checks. No authenticated live application, real PDF/Storage, physical touch, Safari/WebKit/Firefox or screen-reader acceptance is established by those runs. Owner tabs/server are untouched; production build remains unattempted. See the current P.2C.3c Master Context handoff for package/audit details and owner acceptance.

## Adviser rich-text feedback (P.2C.3b, 2026-10-31)

`FeedbackEditor` is a client-only, uncontrolled `contentEditable` editing surface. Its native semantic toolbar applies bold/italic/underline and flat bulleted/numbered lists, preserving mouse/touch/keyboard selection and browser undo/redo. It uses the deprecated but currently available `execCommand`/command-state APIs, isolated from persistence; unsupported commands report an explicit notice, while plain-text editing remains available. No rich-text engine dependency is added. P.2C.3b is owner-accepted without a supplied browser/device breakdown; the separate P.2C.3c presentation dependency and coverage are described above. See the [MDN native editing/undo caveat](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand). Reassess the editing adapter if target browsers remove support, rather than changing stored content or weakening validation.

`feedback-editor-dom.ts` converts transient DOM to a flat document, including native `P > UL/OL` wrappers; it emits only text and boolean marks. External paste inserts `text/plain`, not HTML; HTML-only clipboard content gets a recovery message instead of silently replacing the draft. File/HTML drops are refused. Copy remains native; pasting copied content intentionally strips formatting and is labeled accordingly. There is no `innerHTML` persistence, `dangerouslySetInnerHTML`, custom font/color, link, media, table, attachment or nested-list feature. Initial/external draft restoration uses `createElement`/text nodes; normal keystrokes do not rewrite the DOM or reset the native undo buffer.

The immutable confirmation captures the encoded string, submission ID and decision. It renders the entire document with `FeedbackContent`; Back retains the mounted editor and full draft. Every emitted text/format change invalidates confirmation; encoding errors also close confirmation and block dispatch, preventing a stale previous draft from being sent. Existing duplicate/in-flight/generation/unknown-outcome protections remain unchanged.

`feedback-content.ts` defines the explicit `\u001eTHESISHS_FEEDBACK:1\n` versioned JSON envelope in the existing `feedbacks.comments` text column. No schema or string-API/DTO change. Legacy plain text, Markdown-like symbols, HTML-looking strings and unmarked JSON stay literal. Plain new paragraphs may stay plain strings; trimming a literal string cannot promote it into an unvalidated envelope. Strict Zod schemas allow only version 1, flat paragraphs/lists, text and three boolean marks. Unknown fields/nodes/versions/nesting, more than 256 blocks or items per list, 10,000 total runs or 524,288 encoded UTF-16 units are rejected. Both `createFeedbackSchema` and `createAdviserFeedback` apply the same validation: extracted text must be nonblank and at most 5,000 trimmed UTF-16 units (the existing `.trim().length` semantics), with newlines between blocks/items and encoding overhead excluded. No legacy record conversion or HTML sanitization dependency.

`FeedbackContent` renders only React text nodes and paragraph/list/strong/emphasis/underline elements. It is shared by confirmation, Adviser recorded feedback, Student version feedback and Student dashboard latest feedback. Malformed known-version records display an unavailable notice; HTML-looking text remains escaped. `feedbackPlainText` is the explicit extraction path for future text-only consumers. Current service/DTO/repository serialization preserves the string. Notifications and activity descriptions do not consume comments; no Admin/repository/export feedback-body reader exists in this checkout. Authorization, review statuses, account locks, atomic persistence and generic notifications are preserved. Tests use in-memory persistence/action doubles, not actual research data.

## Shared application typography (P.2C.3, 2026-10-31)

The root layout loads variable Manrope through the installed `next/font/google` integration, with Latin preload, `display: swap`, `--font-manrope` and Arial/Helvetica/sans-serif fallbacks. Shared `--font-app` / sans tokens apply to the body and inherited native controls across authentication and every role. Existing weight styles remain; system monospace fallbacks serve the mono token. No role-specific font loader, font package or checked-in font binary. The full OFL 1.1 notice is served at `/licenses/manrope-OFL.txt`. Native PDF content and browser-owned viewer typography are outside this application-font contract. Development asset serving is verified; production build and owner visual acceptance remain separate.

**Latest upload checkpoint (2026-10-28):** Direct private upload and approved environment preparation are implemented. The owner reports hosted synthetic Student/Adviser workflow PASS (19/19); 10.2E.5F records signed PDF 206 and three unsigned variants 400, four GETs, no writes/database connections. This verifies only the exercised methods. The historical File-bearing diagrams below remain superseded by the direct-upload flow. Anonymous application-action denial, hosted cross-group isolation, provider upload-path isolation, expiry enforcement and Storage policy review remain NOT VERIFIED and are deferred to production readiness by the owner.

**Retained deployment-state pointer (2026-10-29):** **PHASE 10.2E — ACCEPTED FOR CONTROLLED PREVIEW TESTING, WITH DEFERRED HOSTED SECURITY GATES.** Base HEAD at that checkpoint was `c3be85cd59ba516c89e113d8547b6901739ff978`, `feature/development`; `main` remains reserved for undeployed Production. Actual synthetic fixture is `PreviewGroup` (group ID 1), research project ID 1. See the [closure handoff](MASTER_CONTEXT_UPDATED.md#phase-102e-closure-and-handoff-2026-10-28) and [approved roadmap](MASTER_CONTEXT_UPDATED.md#approved-phase-10-roadmap-2026-10-22). Phase 10.2F physical PWA checks are owner-reported PASS: Windows 6/6 and Android Chrome 6/6 (12 PASS, 0 FAIL, 0 BLOCKED); see the [PWA handoff](MASTER_CONTEXT_UPDATED.md#phase-102f-pwa-acceptance-closure-2026-10-29). Older phase statuses are historical. This does not authorize real Student data, public production or unrestricted users. Native clients remain deferred; Expo is frozen under P.1 below.

## Installed PWA presentation foundation (P.1, 2026-10-30)

One Next.js application and backend serve the regular browser and installed PWA. Expo React Native is frozen. P.1 integrates presentation signals into the existing authenticated `DashboardShell`; the manifest, root/dashboard server layouts, role navigation, routes and business services are unchanged. The manifest already requests `standalone`, starts at `/dashboard` and scopes `/`. The root already supplies PWA metadata/icons; installation guidance remains available. No service worker/private offline cache or installation prompt is added.

- `lib/pwa/display-mode.ts` defines `DisplayMode = "unknown" | "browser" | "standalone"`, client/server snapshot readers and a cleanup-returning subscription. Only `(display-mode: standalone)` or feature-detected boolean `navigator.standalone === true` selects standalone. Missing/throwing media APIs fall back to browser; modern change listeners are preferred, with paired legacy WebKit listeners when necessary.
- `lib/pwa/use-display-mode.ts` wraps these in React `useSyncExternalStore`. Server rendering and initial hydration use the stable `unknown` snapshot without reading browser APIs. The existing authorized children and navigation render identically before detection; no content or permission is unlocked by the signal. Hydration behavior follows the snapshot contract; browser/runtime evidence is limited to the owner-reported local manual acceptance below, without an independently executed Codex browser check.
- The shell publishes `data-display-mode`. Its CSS publishes inherited `--dashboard-layout-profile` and `--dashboard-content-max-width`. These are CSS presentation hooks, not a JavaScript device/profile classification API. `unknown`/`browser` retain the existing 1100px main-content maximum and existing navigation.
- Standalone defaults to `standalone-mobile` (compact/touch-oriented presentation). At viewport width >=1024px with primary fine pointer and hover support, CSS selects `standalone-desktop` and a 1280px content maximum. Width is appropriate here because the dashboard shell fills the app viewport. Existing content shrink/wrapping and the 1024px sidebar/drawer breakpoint are reused; no extra navigation is introduced.
- CSS handles resize, orientation and capability changes without JavaScript viewport state. A narrow desktop gets the compact presentation while retaining its actual pointer capabilities. Only `(pointer: coarse)` raises shared standalone navigation/close targets from 44px to 48px. Wide coarse-pointer tablets keep touch-oriented presentation and the existing width-appropriate navigation; hybrid devices use reported primary capabilities, without OS/user-agent assumptions.
- Standalone shell/sidebar/drawer spacing respects available safe-area inset values. Insets may be zero; no viewport/manifest configuration change is made. Unsupported profile queries keep the ordinary responsive layout. The existing sidebar breakpoint listener now also tolerates missing media APIs and pairs modern/legacy listener cleanup.

Display mode is a best-effort presentation signal, not proof of installation, hardware identity or a security boundary. Fullscreen, URL parameters, storage preferences and width alone do not establish standalone. iOS fallback-only browsers may have no live display-mode event; the fallback is sampled when React reads the client snapshot. The broader app retains its pre-existing theme/HTML-dialog browser requirements; the detector's unavailable-API fallback is not a claim of compatibility with browsers lacking those requirements.

**Phase 10.P1 (P.1) — CLOSED — PASS for the agreed local scope.** Earlier Codex evidence remains: seven new isolated detector/actual-shell SSR checks and existing authentication/authorization regressions PASS (25 reported tests including two parent tests), final overlapping seven-case rerun PASS, TypeScript, targeted ESLint and whitespace checks PASS. Separately, the owner reports **six manual checks: 6 PASS, 0 FAIL**, with no observed browser, navigation, layout or runtime errors; Codex did not independently execute them. No individual browser/version/device breakdown was supplied. Production build was not executed; cross-device/browser acceptance, physical Android/iOS, Safari/iOS fallback, safe-area and tablet/hybrid behavior remain pending/deferred. Codex's earlier Chromium smoke was blocked during bundling before browser launch and was not rerun. No new physical PWA or hosted acceptance is claimed. The [implementation handoff](MASTER_CONTEXT_UPDATED.md#phase-p1-installed-pwa-platform-foundation-2026-10-30) and [closure](MASTER_CONTEXT_UPDATED.md#phase-10p1-closure-and-local-git-checkpoint-2026-10-30) separate the evidence, limits and exact eight-file Git checkpoint. P.2 was not authorized by P.1; the separate P.2B authorization and implementation are recorded below.

P.2B now reuses this foundation under separate owner authorization; see below. P.3 is Minimal Research Push Notifications using Web Push API + VAPID for installed Mobile PWA Student/Adviser use, not QR/hardware navigation. P.3, P.4 Admin Desktop Publication Oversight and R.1-R.3 tracker/revision-management behavior remain unimplemented and separately authorized. Server authentication, account/role/ownership checks, optional verification, disabled Resend/Groq, private PDFs and retained deployment/security gates remain authoritative.

## Adviser PDF review workspace (P.2B, 2026-10-31)

**Implemented with focused local validation. Earlier owner core/hotfix/P.2C.2 results remain PASS; the owner reports P.2C.3a 4/4 PASS and P.2C.3b/P.2C.3c acceptance. P.2C.4 duration refinement is owner-accepted; P.2C.4a is owner-reported 6/6 PASS. P.2D is locally CLOSED — PASS.** The existing `/dashboard/adviser/submissions/[submissionId]` server route still calls `getAdviserReviewDetails` before rendering. There is no diagnostic ID/version/host gate, new endpoint, platform-specific service or schema change; P.2C.3c's separately approved Motion dependency is presentation-only. The temporary `LocalPdfDiagnostic.tsx` is removed. Native private-PDF rendering in Edge and Brave is owner-reported; Codex's synthetic UI tests do not independently establish native PDF compatibility.

- The route composes `AuthorizedPdfPreview`, `SubmissionVersionNavigator`, the existing review controls/recorded feedback and `ReviewDraftBoundary`. P.2C.2 CSS in `review-workspace.module.css` scopes a 1720px responsive main cap to this route in standalone/fine-pointer/hover presentation at viewport >=1024px; no global shell/sidebar width changes. At container >=1080px, standalone/fine-pointer/hover uses a 58:42 grid excluding the gap, with 30rem PDF and 22rem review minimums. Browser/unknown mode, smaller containers and unsupported queries remain stacked. CSS changes layout without conditional React branches, preserving form identity across resize/theme/mode changes. Compact metadata/version controls precede the workspace; review status, comments, decision and recorded history remain real existing functionality. P.2C.3a adds only a noninteractive Assessment Criteria notice after review controls, clearly planned/unavailable and not required; completed reviews omit it. No rubric, scores, criteria data/service or third-party component integration.
- The wide standalone iframe height is `clamp(36rem, 82dvh, 80rem)`; compact/browser uses `clamp(24rem, 72dvh, 60rem)`. The document follows normal page scrolling so its enlarged frame remains reachable; wide review content can scroll within a viewport-bounded panel. Existing native PDF controls and no-referrer/title remain unchanged; P.2C.4 extends only the Adviser review lifecycle to the 28-minute threshold described above. Other standalone routes retain P.1's 1280px cap; ordinary browser detail retains 1100px. See [P.2C.2 decisions and audit](MASTER_CONTEXT_UPDATED.md#phase-10p2c2-adviser-workspace-ui-refinement-2026-10-31).
- P.2C.3 adds supported CSS subgrid rows for heading, compact toolbar/status and reading/review body; both headings use the same wrapper and the iframe starts with the review body without fixed offsets. The 58/42 split and frame heights stay intact. Older subgrid support falls back to the existing layout. Toolbar buttons retain labels/focus with decorative SVGs, 36px fine-pointer desktop / 44px other targets, no dependency or motion. State text remains concise above reading; viewer-event guidance is below the frame. Ordinary/compact views remain stacked.
- `findSubmissionVersionsForAdviser` joins submissions, research papers and research groups, filters both paper ID and current Adviser ownership, and projects only ID/version/status. The UI service first verifies the active Adviser and selected submission through existing services, then retrieves feedback and version metadata independently. History failure retains the current version with a safe unavailable message. The selector routes by a verified submission ID; the destination repeats the existing server authorization. Private stored paths never enter the version client props.
- `SubmissionPdfAccess` is a per-component in-memory external store used by `AuthorizedPdfPreview`. A request generation and disposal checks reject stale responses. No signing occurs on render, mount, resize, focus or expiry. Each explicit request records `Date.now()` before calling the existing `getSubmissionDownloadUrlAction` with the fixed Adviser review purpose, sets a 1,680,000ms local deadline (P.2C.4) and starts an expiry timer even while signing is pending. Successful access uses the remaining original deadline; expiry clears the URL and exposes Renew PDF Access. Focus, pageshow and visibility restoration reassess expiry. The provider's 1,800-second Adviser review capability remains independent; neither local clearing nor unmount revokes already downloaded PDF bytes. Provider expiry is authoritative if clocks change or the browser suspends execution. Other access paths retain 300 seconds.
- The iframe has a submission/version-specific title and `referrerPolicy="no-referrer"`, without a blanket sandbox. Waiting, delayed, unavailable and frame-error states retain a separate-open fallback; the load-event message explicitly requires visible PDF pages. Separate opening creates a blank tab during the click, removes its opener, sets a no-referrer meta policy and navigates only with valid authorized access, including reused access. Blocked popups receive a safe message; failed/stale responses and disposal close only the component's still-blank PDF window. Setup/signing/navigation exceptions are handled without navigating the draft-owning page. URLs are not persisted or logged; no PDF.js or service-worker cache is added.
- P.2B.1 timer defaults use global-receiver wrappers, with initialization inside the request error boundary. One active/generation-guarded timer covers the unchanged four-minute request-start deadline. Cancellation failures cannot abort disposal; failed signing/scheduling returns recoverable unavailable state. See the [hotfix evidence](MASTER_CONTEXT_UPDATED.md#phase-10p2b1-pdf-access-runtime-hotfix-2026-10-31); subsequent owner-reported retests are recorded in the P.2C.2 handoff, separately from Codex tests.
- `ReviewDraftBoundary` is keyed by immutable submission ID. `FeedbackForm` retains comments and decision in component state, reports dirty/pending state and uses a synchronous in-flight ref to prevent duplicate submissions. Only successful feedback clears the draft and refreshes the route; failures retain input. Dirty-state listeners confirm ordinary anchor navigation and logout before existing handlers, and attach `beforeunload` only while dirty. The version selector uses the same confirmation. Browser Back/Forward within App Router, arbitrary programmatic navigation and mobile process termination remain limited; the visible draft notice directs users to guarded page links/selector. No history patching, browser storage or universal protection claim is introduced.
- P.2C.3a supersedes timed confirmation: Review & Confirm Decision validates and captures immutable ID/comments/decision via pure `createReviewConfirmation`. P.2C.3b shows the full formatted feedback safely, with the actual decision; Back to Edit preserves the complete draft. Only Confirm & Submit rechecks `matchesReviewConfirmation`, consumes the snapshot and calls the existing feedback action once, guarded synchronously against duplicates. No review timer, delay or automatic dispatch remains. Edits/guarded navigation/unload, unmount or Activity hide invalidate pre-dispatch confirmation; the boundary registers invalidation before leave prompts/router navigation. After dispatch fields lock and status explicitly disallows cancellation. Attempt generations reject late UI responses; a restored already-sent request with unknown outcome stays locked pending reload. Action failures preserve drafts; known success clears/refreshes read-only state. Authorization, transaction and duplicate-decision protection remain server-owned and unchanged; comment validation now accepts the constrained format below. PDF access timers are separate and preserved.
- `updateSubmissionStatusForAdviser` retains the account lock/current-role check and now updates only `id = selectedId AND status = Submitted`. The existing service retains group ownership and status prechecks, returning a safe refresh/conflict response when no row is affected. Feedback transactions, notifications and activity semantics are unchanged. Atomic group ownership revalidation during concurrent reassignment remains deferred.

Focused evidence and the owner acceptance checklist are recorded in the [P.2B handoff](MASTER_CONTEXT_UPDATED.md#phase-10p2b-adviser-pdf-workspace-implementation-2026-10-31). The P.1 closure and all hosted security/production gates remain separate.

## Current deployment boundaries (2026-10-29)

| Component | Implemented boundary | Deployment/validation status |
|---|---|---|
| Client/application | Next.js App Router online-first PWA; UI -> Server Actions -> validation -> services -> repositories | Protected Preview accepted for controlled synthetic testing; Admin and 19/19 Student/Adviser acceptance owner-reported; Windows/Android physical PWA 12/12 PASS, owner-reported; no independent Codex device test |
| Authentication | bcrypt passwords, signed JWT HTTP-only cookies, active database account/current role/ownership guards; shared PostgreSQL rate limiter | Owner-reported Admin login, refresh persistence, logout and unauthenticated application protection PASS after runtime connection correction; broader role/proxy/limiter security acceptance remains open. Stage 1 email verification optional; real email deferred |
| Data | PostgreSQL and Drizzle; runtime/operator separation and guarded target mappings | Local Development remains separate; hosted Preview identity/TLS, 15 migrations, runtime grants, canonical roles and synthetic Admin verified in owner-operated checkpoints; Preview uses verified-TLS Session Pooler on port 5432 with thesishs_preview_runtime; database and current functions (sin1) are in Singapore. Clean Production resources remain pending |
| PDF transfer | Browser -> exact signed private staging path; separate server-side bounded byte/signature/hash validation and finalization | Owner-reported synthetic v1/v2 workflow PASS; local tests reused; provider token path/expiry, policy audit and broader resource/reliability checks unverified |
| PDF access | Current account/role/group or publication checks precede private signing; requested download TTL 300 seconds | Four hosted signed/unsigned GETs PASS; local action/ownership tests reused; hosted application denial/cross-group/expiry checks unverified |
| Environments | Separate local Development PostgreSQL; initialized Preview PostgreSQL; intentionally shared Development/Preview test Storage; separate clean Production resources/secrets required | Protected Preview accepted only for synthetic testing with deferred security gates; no production acceptance |

The active upload flow is detailed at the end of this reference; the older File-through-Server-Action diagram describes the legacy transport. Private staging/final objects are not public, and successful transfer alone does not create a completed academic submission. The bucket must be private, PDF-only and limited to exactly 10,485,760 bytes (10 MiB); server finalization independently validates the bytes. No privileged Supabase credential reaches the browser.

Protected Preview has owner-reported Admin and Student/Adviser workflow acceptance, with the bounded Storage result above; full hosted security acceptance remains PARTIAL, with no confirmed defect in the reviewed evidence. 10.2E.5H sent no hosted POST: a verified deployed action request template and submission ID were missing, and Vercel Authentication precedes application authorization. A protection-layer denial cannot establish application denial. Existing local denial tests remain valid within their isolated scope; no new group/actor was created to claim hosted cross-group proof. Earlier runtime connection correction and sin1 alignment remain historical evidence, not re-executed infrastructure checks.

Upload expiry has distinct boundaries: the application intent closes after 15 minutes, while an issued provider upload capability can remain usable for approximately two hours under the documented contract. Cancellation does not revoke it. The workflow rechecks current authorization, intent state and expiry before finalization, and cleanup accounts for the latest capability expiry plus its grace period. Tokens are bearer capabilities, not application-session-bound credentials. Hosted expiry enforcement, including download caching behavior, remains unverified; current final uploads request cacheControl 0. This is a retained architectural limitation requiring production assessment, not a confirmed exploit.

PWA remains primary for Web/Mobile-browser/Desktop; Windows and Android physical-device acceptance is owner-reported PASS (6/6 each), with Windows standalone launch and Android home-screen launch covered. This acceptance does not establish offline support, push notification reliability, Expo React Native readiness or production release approval. Other devices/browsers and broader reliability remain unverified. Remaining 10.4 coverage, including near-limit PDF acceptance, requires separate owner scope and execution approval. Expo needs a separately approved secured API/actor adapter; browser Server Actions are not an assumed mobile API. Electron needs separate justification. Neither native client is integrated. Groq remains hard-disabled; optional Stage 1 email verification is implemented, while real email, mandatory enforcement and operational AI/eligibility/consent testing remain deferred.

**Historical Git checkpoint (2026-10-07):** `feature/development`, HEAD `70b8fb4` — `docs(phase5): close Phase 5.4 acceptance`. Phase 5.1/5.2 are committed; Phase 5.3 is committed; Phase 5.4 is committed locally; Phase 5.5 source/tests and handoff changes are uncommitted.

Phase 5.1, Phase 5.2, and Phase 5.3 are complete and runtime-accepted. Phase 5.3 completion/documentation audit is complete. No Phase 5.3 schema/migration change was needed or applied; `0009_repository_paper_unique.sql` was applied in Phase 5.4 to the designated development database after safety checks. Phase 5.4 — Repository Publication is complete and runtime-accepted (PASS; completion/documentation audit complete). Phase 5.5 — Repository Document Access is complete and runtime-accepted (PASS). Phase 5.6 — End-to-End Verification & Security Audit and Phase 5.7 — Documentation & Completion Audit are complete. **Phase 5 overall is complete.** Phase 6 — Search, Filtering & Discovery is next and requires explicit owner direction; it was not started in this pass. CI remains deferred. Do not commit or push.

------------------------------------------------------------------------

## 1. System Architecture

``` text
Browser / React UI
        ↓
Next.js App Router
        ↓
Server Actions
        ↓
Zod Validation
        ↓
Services
        ↓
Repositories
        ↓
Drizzle ORM
        ↓
PostgreSQL

                    ┌──────────────────────┐
                    │ Supabase Storage     │
                    │ private documents    │
                    └──────────▲───────────┘
                               │
                        Storage Service
```

### Core principle

The application uses a layered architecture:

``` text
Pages/UI
  → Server Actions
  → Validation
  → Services
  → Repositories
  → Drizzle ORM
  → PostgreSQL
```

Business logic and authorization belong in services. Repositories remain
focused on data access.

### Existing client and proposed platform boundary (2026-10-21)

The implemented client is the Next.js Web application with an online-first PWA manifest, icons and installation guidance. Desktop initially uses this same PWA. Physical installation/standalone and production HTTPS acceptance remain unverified; no offline academic workflow or private-document cache is provided.

The separate Expo React Native repository `https://github.com/Genryux/thesishsai` is a candidate Mobile client only. Its ZIP-audit findings have not been verified against actual mobile source in this task. No mobile code is integrated here. Future integration would require a separately approved authenticated API entry layer, validation and existing services/repositories, sharing PostgreSQL and private Supabase Storage. Browser Server Actions are not an assumed Expo API contract. Mobile session validation, active-account/current-role/ownership checks and authorized temporary PDF access must be designed before integration; storing a token is not sufficient authorization.

Specialized Mobile/Desktop features remain design candidates. The professor's requirement does not itself select Electron or prohibit PWA. Evaluate Electron only if justified by separately approved desktop capabilities. Current browser JWT/HTTP-only-cookie/bcrypt authentication is implemented. Optional Stage 1 Student email verification is implemented locally; mandatory verification, real email and compatible future mobile API authentication remain deferred. See the latest Master Context for the approved Preview-first roadmap and separately recorded external audit risks.

------------------------------------------------------------------------

## 2. Technology Stack

-   Next.js 16.3.8 (verified package checkpoint)
-   React Server Components and Client Components
-   TypeScript
-   PostgreSQL
-   Drizzle ORM
-   Drizzle Kit
-   Zod
-   JWT authentication
-   Bcrypt password hashing
-   Supabase Storage
-   Owner-led manual acceptance; Playwright available for necessary focused, bounded sequential checks

The project uses the Next.js App Router.

------------------------------------------------------------------------

## 3. Module Organization

### `app/`

Contains the Next.js routes and dashboard UI.

Current protected dashboard areas include:

``` text
app/dashboard/
├── admin/
├── adviser/
├── student/
└── repository/
```

Only functionality actually present in the current checkout should be
treated as implemented.

### `lib/auth/`

Authentication and authorization utilities.

Key responsibilities:

-   JWT creation and verification
-   Session cookie handling
-   Password hashing
-   Role constants
-   `requireAuth()`
-   `requireRole()`
-   authorization helpers

Role IDs:

``` text
ADMIN   = 1
ADVISER = 2
STUDENT = 3
PANEL   = 4
```

Panel exists as a role but is not actively implemented.

### `lib/services/`

Business logic and workflow orchestration.

Representative services include:

-   `auth.service.ts`
-   `student-research.service.ts`
-   `adviser-feedback.service.ts`
-   `adviser-review.service.ts`
-   `adviser-submission.service.ts`
-   `submission.service.ts`
-   `submission-document.service.ts`
-   `storage.service.ts`
-   `notification.service.ts`
-   `activity-log.service.ts`
-   `group.service.ts`
-   `group-member.services.ts`
-   `paper.service.ts`
-   `user.service.ts`
-   `research-group.services.ts`

A service should:

-   validate the caller's authority;
-   verify ownership/scope;
-   enforce workflow rules;
-   coordinate repositories and external services;
-   return controlled results.

### `lib/repositories/`

Thin database-access layer using Drizzle ORM.

Repositories should:

-   execute database queries;
-   return data;
-   perform query-specific transformations where necessary.

Repositories should not become the primary location for business
authorization rules.

### `lib/actions/`

Next.js Server Actions are the server entry points used by forms and
client interactions.

Typical pattern:

``` typescript
export async function someAction(formData: FormData) {
  const session = await requireRole([ROLE_IDS.STUDENT]);

  const parsed = someSchema.safeParse({
    // normalized input
  });

  if (!parsed.success) return;

  const result = await someService.someMethod(
    parsed.data,
    session.userId
  );

  if (!result.success) return;

  revalidatePath("/dashboard/...");
}
```

### `lib/validations/`

Zod schemas for input validation and normalization.

Validation should occur before business operations.

### `lib/constants/`

Shared workflow constants and enums, including submission and research
statuses, notification/action values, and other domain constants.

### `lib/supabase/`

Supabase integration.

The secret Supabase key is server-only.

------------------------------------------------------------------------

## 4. Authentication & Authorization

### Session lifecycle

``` text
Registration
   ↓
Validate input
   ↓
Bcrypt password hash
   ↓
Create user
   ↓
Login
   ↓
Verify password
   ↓
Create JWT
   ↓
HTTP-only secure cookie
   ↓
Authenticated request
   ↓
Verify JWT
   ↓
Role / ownership authorization
```

JWT lifetime is seven days.

### Authorization rule

UI restrictions are not authorization.

Server-side code must verify:

1.  authentication;
2.  required role;
3.  resource ownership/scope.

For example, an Adviser may review submissions only for research groups
belonging to that Adviser.

Typical behavior:

``` text
requireAuth()
    ↓
No session → /login

requireRole(...)
    ↓
Wrong role → /dashboard

Service ownership check
    ↓
Not permitted → controlled Unauthorized/Forbidden result
```

------------------------------------------------------------------------

## 5. Research Workflow Architecture

### Group and research relationship

``` text
Adviser
   ↓
Research Group
   ↓
Student Membership
   ↓
Research Paper
   ↓
Submission Versions
   ↓
Adviser Review / Feedback
```

Students do not self-join groups.

### Submission workflow

The following diagram records the historical internal File service, retained for compatibility regression. The active public action is blocked and the Student interface now uses the Phase 10.2C.2 intent/finalization workflow below; its transactions do not hold locks during Storage transfers.

``` text
Student submits PDF
        ↓
Server Action
        ↓
Zod validation
        ↓
Submission service
        ├─ verify Student role
        ├─ verify group membership
        ├─ serialize eligibility/version allocation with a per-paper transaction-scoped advisory lock
        └─ upload document
        ↓
Submission repository
        ↓
Notification service
        ↓
Adviser notified
```

A later submission creates another version. Existing versions are
preserved.

The lock is held through upload and insert. The unique
`(paper_id, version)` constraint remains the final integrity backstop;
an insert failure triggers storage cleanup. Adviser feedback, the
conditional `Under Review` submission update, research status update,
and activity log insert commit in one transaction. Notifications are
attempted after commit and their failure does not fail the primary
operation.

### Adviser review workflow

``` text
Submitted
    ↓
Under Review
    ↓
┌──────────────────────┐
│                      │
▼                      ▼
Revision Required    Approved
│                      │
▼                      ▼
Student resubmits    Research approved
│
└──→ new submission version
```

The review workflow keeps submission and research status consistent.

Important verified Phase 4 behavior:

-   Adviser access is limited to own groups.
-   Adviser can start review.
-   Adviser can issue `Revision Required` or `Approved`.
-   Student receives decision notifications.
-   Adviser receives notification for new student submissions.
-   Activity logs record review decisions.
-   Version history remains preserved.
-   Cross-Adviser access isolation was verified.

------------------------------------------------------------------------

## 6. Document Storage Architecture

Research PDFs use a private Supabase Storage bucket:

``` text
research-submissions
```

Storage path pattern:

``` text
research/{paperId}/{version}/{sanitizedFileName}
```

Rules:

-   PDF only
-   Maximum size: 10 MB
-   Store the storage path in the database
-   Do not expose permanent public URLs
-   Generate temporary signed URLs server-side
-   Signed URL lifetime: 300 seconds / five minutes

### Upload flow

Historical transport only; superseded by the Phase 10.2C.2 architecture below.

``` text
PDF submitted
   ↓
Validate type/size
   ↓
Sanitize filename
   ↓
Generate storage path
   ↓
Server-side Supabase upload
   ↓
Persist storage metadata
```

### Submitted-document access flow

```text
UI document button
→ lib/actions/storage.action.ts (authenticated role gate)
→ lib/validations/submission-document.ts (Zod ID validation)
→ lib/services/submission-document.service.ts
→ existing user/submission/paper/group/membership repositories
→ lib/services/storage.service.ts (server-only Supabase signer)
→ controlled URL or null
```

Submitted-document access requires an authenticated Student/Adviser session, positive submission ID validation, current active-account/database-role verification, Student group membership or Adviser group ownership, persisted submission/file metadata verification, and a storage path bound to the submission paper/version. Admin and Panel are denied under the submitted-document rules. Only the persisted path is passed to the existing server-only signer for 300 seconds in private bucket `research-submissions`; no client-supplied paper, path, version, identity, or role is trusted.

The service derives the role from the current active DB account, traverses submission → paper → group, and reuses the existing `createResearchDocumentSignedUrl` helper with `300`. Valid paths must match `research/{paperId}/{version}/{safePdfName}` exactly; public URLs, cross-paper/version paths, traversal, extra segments, and invalid/missing metadata are rejected before signing. Student and Adviser buttons navigate the current tab to the short-lived URL. Unexpected DB/storage failures return null and generic error messages, without raw SDK details.

Already issued signed URLs may remain usable until their 300-second expiry after authorization is revoked. Legacy/nonconforming paths outside the established naming convention are intentionally rejected; do not weaken validation. Full submission/review regression evidence is service-level; browser acceptance specifically covered document access. These are known limitations, not blockers.

------------------------------------------------------------------------

### Repository publication (Phase 5.4)

Admin UI uses controlled action results and pending buttons. Publication actions validate IDs/state with Zod and derive user identity from the authenticated session. `repository-publication.service.ts` rechecks the active database Admin account before lookup and under the transaction lock; Student/Adviser/Panel cannot publish. `repository-publication.repository.ts` locks the account in shared mode and the paper for update, resolves approved submission metadata and existing publication state, and performs only data access/writes.

The service checks approved paper/submission state, exact persisted paper/version path, and actual private-object existence using the existing server-side 300-second signer; that verification URL is discarded server-side. Paper locks serialize duplicate requests, and `repositories_paper_id_unique` enforces one row per paper. Already-published requests return a controlled result without changing timestamps/counters. Hidden entries reuse the same row on republication. No submissions/feedback/objects are copied, overwritten, or made public. Database/storage errors return generic failures. Publication remains separate from repository document authorization, which is now secured in Phase 5.5.

Known non-blocking publication risks: private-object verification holds the transaction during a network request; objects can be deleted after publication; repository records dynamically resolve the paper's approved submission rather than an immutable submission snapshot. These do not invalidate accepted Phase 5.4 requirements.

### Repository document access (Phase 5.5)

Existing View PDF / Download PDF controls call the authenticated Server Action. Zod strictly validates numeric paper IDs and view/download mode; the session user ID goes to the server-only repository-document service. It rechecks an active database account with the established Student, Adviser, Admin or Panel role, then resolves a published repository row joined to an approved paper and approved submission. The latest approved submission is selected by submitted timestamp and ID as a deterministic tie-breaker. The shared Phase 5.3 PDF path validator binds the persisted path to its paper/version before the existing private-storage signer generates a 300-second URL. Group ownership is irrelevant to published repository access; Phase 5.3 submitted-document ownership remains unchanged. No client path/version/submission identity is accepted. Storage/database failures return generic results. Successful download requests increment the existing download counter; publication state/timestamps and submission history are untouched. No signed URL is rendered in initial HTML. Unpublished records are denied. Issued URLs may remain usable until their 300-second expiry after account revocation or repository unpublication; strict legacy/nonconforming paths remain rejected.

## 7. Database Architecture

-   PostgreSQL is the persistent data store.
-   Drizzle ORM is the application query layer.
-   Drizzle Kit manages migrations.
-   Schema definitions live under `db/schema/`.
-   Migration files live under `db/migrations/`.

Core entities include:

``` text
role
users
research_groups
group_members
research_papers
submissions
feedbacks
repositories
notifications
activity_logs
```

The exact schema, field definitions, relationships, constraints, and
migration state belong in `docs/DATABASE (1).md`.

Do not infer database state from application code alone.

------------------------------------------------------------------------

## 8. Error Handling

Expected business failures should be returned as controlled service
results.

Typical pattern:

``` typescript
return {
  success: false,
  message: "User not found",
};
```

Expected authorization failures should not expose sensitive reasons.

Examples:

-   unauthenticated → redirect to login;
-   wrong role → redirect to dashboard;
-   unauthorized resource operation → controlled failure.

### External service failures

Storage failures should return a user-safe failure result.

Notification failures are explicitly tolerated by the current design:

``` text
Primary operation
      ↓
Notification attempt
      ↓
Failure → log failure
      ↓
Primary operation remains successful
```

------------------------------------------------------------------------

## 9. Security Architecture

### Client

-   No secrets in client-accessible code.
-   UI restrictions are not security controls.

### Server

-   Server-side authorization
-   Ownership checks
-   Zod validation
-   Parameterized database queries through Drizzle
-   Server-only Supabase secret
-   Signed URLs for private documents

### Database

Important invariants are enforced with database constraints where
appropriate, including submission-version uniqueness.

### Secrets

Never commit:

``` text
JWT_SECRET
SUPABASE_SECRET_KEY
DATABASE_URL
```

Environment files remain outside source control.

------------------------------------------------------------------------

## 10. Performance and Data Access

-   Keep repository queries focused.
-   Avoid unnecessary N+1 queries.
-   Use SQL-level filtering/sorting/pagination where the feature
    requires it.
-   Use `revalidatePath()` after relevant mutations.
-   Do not proxy large private PDFs through application memory when a
    signed URL is appropriate.

------------------------------------------------------------------------

## 11. Testing Architecture

### Static/project checks

Relevant checks include:

``` bash
npm run lint
npx tsc --noEmit
npm run build
git diff --check
npx drizzle-kit check
```

### Browser acceptance

Playwright is the project's browser acceptance mechanism.

Phase 4 browser acceptance is part of the verified history. Phase 5.1
storage acceptance was runtime-verified separately. Phase 5.2 workflow,
concurrency, authorization, transaction, and notification-failure
acceptance was exercised through service-level runtime flows, not
browser-level acceptance. Do not describe the Phase 5.2 checks as
browser tests.

Phase 5.3 document access passed real Chromium Student/Adviser access and tampered/cross-group/anonymous/Admin/Panel denial. Runtime acceptance verified exact PDF bytes, real 300-second expiry, direct/public denial, process-local signing failure, service-level review/version regression, and independently checked cleanup. Detailed executed evidence is in `docs/MASTER_CONTEXT_UPDATED.md`.

### Test data

Acceptance data must be isolated from production data.

Never use real student/research data merely to make an automated test
pass.

------------------------------------------------------------------------

## 12. Implementation Rules for Agents

Before implementing:

1.  Read `docs/SOURCE_OF_TRUTH_UPDATED.md`.
2.  Read `docs/MASTER_CONTEXT_UPDATED.md`.
3.  Check Git branch, HEAD, and working tree.
4.  Read `docs/DATABASE (1).md` for database changes.
5.  Inspect the actual source files.
6.  Preserve existing architecture.
7.  Avoid unrelated refactors.
8.  Keep authorization server-side.
9.  Preserve submission history.
10. Inspect the current checkout; do not restore historical implementation blindly.
11. Do not claim browser/build/test success without evidence.
12. Do not commit unless the owner explicitly authorizes the commit.

------------------------------------------------------------------------

**End of Architecture Reference**

Phase 5.6 practical final verification and Phase 5.7 documentation closure passed: upload -> revision -> v2 -> approval -> Admin publication -> authenticated repository listing/detail/view/download, basic security, preserved history and independent synthetic cleanup. Phase 5.1 through 5.7 and Phase 5 overall are complete. No schema/migration changes in this final pass; existing 0009 remains development/test-only. Known limitations remain: issued URLs last until expiry; objects may be removed after publication; strict nonconforming paths are rejected; approved-document resolution is dynamic. This is capstone-level validation, not enterprise production hardening. Phase 6 is next; CI remains deferred.

## 2026-10-22 - Phase 10.2B database initialization boundary

Runtime `lib/db.ts` is server-only and validates explicit connection policy through `lib/db/config.ts` before constructing postgres-js. Local development/test retains its normal URL; hosted Preview/Production require approved distinct environment target mappings, matching endpoint/user, validated TLS, bounded pool/timeouts and explicit direct/session mode. Transaction pooling is refused; existing prepared statements, transactions and advisory-lock code are preserved. Physical isolation, aliases/provider routing and grants still need operator verification.

Privileged initialization is a separate Node command path, never a route, Server Action or startup/build/migration hook. `scripts/database-operator.ts` uses only dedicated operator credentials, checks live database/cluster identity and the complete source ledger, then requires a matching fingerprint and interactive terminal for writes. The service reuses account validation/bcrypt; its repository receives the verified database explicitly and enforces canonical roles and transaction/table-lock-backed single-Admin creation. It never imports the runtime database. Direct Drizzle Kit database commands are blocked; offline history/schema tooling remains. Supported migration replay is confined to a newly owned disposable database.

No authentication provider, JWT/cookie/limiter implementation, research rule, schema or private Storage integration changed. Future Expo can reuse existing backend services through a separately secured API; operator bootstrap/configuration are never mobile/client APIs. See Database/Master Context for configuration, command usage, real replay evidence and managed-provider/production-executor limitations.


## 2026-10-22 - Phase 10.2C.2 direct private PDF upload boundary

Historical C.2 implementation evidence: source replaces only the active Student upload transport. Migration 0014 was generated and unapplied during C.2; it was subsequently applied and verified under the separately approved local H checkpoint described above. This section's isolated validation is not live or hosted acceptance. Earlier File-through-Action diagrams and upload-held transaction descriptions are historical. The internal legacy service remains for compatibility regression; its public File action now authenticates and refuses upload.

Flow: Student dialog -> metadata-only submission-upload actions -> server-only service wiring -> upload workflow -> injected intent repository / bounded Storage adapter. Browser XMLHttpRequest sends the File directly to the exact private signed staging URL with the necessary publishable key, no application JWT or cookies. It reports transfer progress and best-effort cancellation. A separate Submit research click calls finalization with only the opaque intent UUID. Transfer success alone never refreshes academic history as a completed submission.

Initiation derives identity from the existing session/current-account guard, locks the account and paper scope, checks active Student/group/membership and current revision eligibility, validates strict metadata and durably creates the intent before minting. Per-Student account locking serializes quotas across papers. Limits are 15 minutes, two live per Student, one per Student/paper and ten new per rolling hour; failed capability issuance and cancelled rows still count. Request UUID retries freeze the initial metadata.

The Storage adapter uses installed storage-js 2.116.0 with an abort-aware fetch wrapper. Before capability issuance, it reads bucket settings and requires private research-submissions, an exact 10,485,760-byte limit and PDF-only MIME policy. It requires SUPABASE_PUBLISHABLE_KEY in modern publishable-key form; no env file was changed. The signed response must match the configured origin, exact staging route/path and sole token query. Only trusted provider-returned JWT expiry is decoded server-side (not a client assertion); it must be future and at most approximately two hours. The bound is committed before exposure. Capabilities are neither assumed single-use nor revocable; cancellation/expiry blocks server finalization, not an already-issued Storage capability.

Finalization uses Node runtime/maxDuration 60 at the active submissions page, a cooperative 55-second processing deadline, 20-second Storage request bounds and at most two expensive finalizations per process/workflow instance. SQL lock/statement bounds are three/five seconds. Actual provider metadata, response MIME/encoding/length when present and streamed bytes must agree with the declared nonzero size up to 10 MiB. A preallocated bounded buffer and actual byte counter enforce the limit; the existing %PDF- signature rule is retained. SHA-256 binds the validated bytes to a prepared final path before Storage writes. This is not full PDF parsing or malware scanning.

Short prepare/commit transactions share the existing per-paper advisory namespace. Account UPDATE lock -> group/membership SHARE locks -> existing submission SHARE locks -> paper SHARE lock -> intent UPDATE lock is used after the advisory lock. Submission-before-paper ordering matches Adviser decisions. No Storage I/O runs in those transactions. Authorization, expiry, latest version and immutable plan are checked again at commit; submission insert plus intent completion commit atomically, with existing paper/version uniqueness as backstop. Other research statuses and Adviser decision transactions are unchanged.

Final objects use research/<paper>/vN/<intent-id>-<safe-name>.pdf, compatible with existing document validators. Writes use upsert:false. An existing or uncertain write is reconciled by bounded read/size/hash; an uncertain DB acknowledgement triggers a fresh durable-state check. Completed retries return the original submission, never allocate another version, and never notify again. No final object is blindly removed after failure. A lost commit acknowledgement can omit the best-effort notification; no outbox or exactly-once delivery claim is made.

Status/renew/cancel remain self-only and reauthorize against current DB scope. The dialog keeps capabilities and Files only in memory; session storage retains only the opaque per-paper intent locator for explicit status/retry recovery. Pending/closed/error state never grants final-path access. Existing submitted/repository document access, publication and HTTP-only JWT authentication remain unchanged. Future secured APIs can reuse service/workflow boundaries with a separately approved actor adapter; these Server Actions are not a mobile API.

Cleanup is a separate operator command, read-only dry-run only, default maximum 25 intents and no public/scheduled hook. It verifies the complete 15-entry source ledger and target fingerprint, queries in a READ ONLY transaction, waits for max(intent expiry, recorded capability expiry)+10 minutes and protects committed references/canonical paths. Destructive execution is refused before configuration; provider late-upload behavior and a deletion recheck protocol require Phase 10.2C.3 acceptance. Tombstones are retained.

The 10 MiB boundary, installed SDK response handling and recovery races pass isolated doubles. Development bucket configuration metadata was subsequently verified in checkpoint I; actual Supabase CORS/raw PUT/publishable-key acceptance, expiry/non-overwrite semantics, real upload lock scheduling, pooled endpoint behavior and Vercel duration/memory remain unverified. DB pool waits, uncertain COMMIT and post-commit best-effort notification are not hard-cancel guarantees; the platform budget still needs measurement. See Master Context for exact files and checks. The fail-closed bucket/migration prerequisites are satisfied locally; this is not a live upload or hosted-readiness claim.


## 2026-10-23 - Phase 10.2D.2A hosted database boundary (implemented, not live-accepted)

The connection contract separates provider routing syntax from observed PG identity. Active hosted targets need independently approved database OID, native cluster or Supabase project ref, and distinct runtime/operator PG roles; all three environment mappings remain explicit. Future Production can be a strict non-connectable reservation without credentials. Same known physical identities or Supabase project refs cannot cross environments; distinct verified projects can share a session pooler address. `NODE_ENV=production` does not override the explicit Preview database stage.

`lib/db/identity.ts` verifies current/session role, database OID and available cluster evidence through authoritative catalogs, rejects elevated/member roles and runtime database/schema/object ownership or CREATE privileges, and implements only the documented canonical Supabase-route fallback when cluster access is unavailable. The owner must independently bind that route to the correct provider project first. `lib/db/guarded-client.ts` applies the checks lazily on the same transaction connection before hosted application SQL, preserving Drizzle row decoding, transaction settings, savepoints, prepared statements, advisory locks and single execution of pending queries. Imports/build do not connect. Local Development keeps its existing client path. Hosted TLS validation, bounds and transaction-pooling rejection remain; search path is fixed to pg_catalog/public.

The new operator-only Preview initializer pins the committed 0000-0014 source, refuses an existing application schema/ledger, and uses the supported Drizzle migrator under an outer transaction and bounded migration lock. Catalog/default/CHECK/index verification uses PostgreSQL's own canonical output from temporary probes. It checks full ledger, empty tables, sequences and a durable fingerprint; uncertainty stops after inspection without replay or destructive recovery. No public route, build/startup hook, role seed or account creation exists. Existing role/Admin commands retain explicit private-terminal confirmation and now distinguish the actual role from a pooler qualifier.

The exact metadata/CLI/privilege matrix and provider verification procedure are in the Database reference. No live database or provider settings were touched. Data API application-table isolation must be established separately before migration; the unused Data API is preferably disabled without changing Storage. Actual hosted identity/permissions/TLS/migration behavior, Preview configuration/deployment and direct-access security tests remain pending. JWT/bcrypt, shared auth limiter logic, research workflows/history, Storage, optional verification and hard-disabled Groq are unchanged.

## 2026-10-23 - R4A CA trust and Data API protection

Hosted runtime and operator clients share required `THESISHS_DATABASE_CA_PEM` validation in `lib/db/config.ts`: one in-date X.509 CA PEM up to 16,384 characters, passed only to driver SSL options with `rejectUnauthorized: true` and Node's default hostname verification. No global trust or Development behavior change. A source-configured, credential-free session-pooler handshake passed TLS 1.3 and hostname verification; authenticated driver identity remains unverified.

Application source uses direct PostgreSQL for data/custom authentication and separate Supabase Storage calls for PDFs; no required REST/RPC/GraphQL dependency was found. The approved project's Data API changed enabled -> disabled and remained disabled after reload. Bucket metadata access passed with identical before/after digest, private/PDF-only/10,485,760-byte settings; no object operations occurred. REST/RPC GET probes returned 401 and 503/PGRST002 without data, which is limited denial evidence, not definitive endpoint verification. Stop further provider probing pending review. The non-extension public RLS helper/enabled trigger and missing dedicated roles still block initialization. No RLS/grant/role/schema, application record, Vercel or deployment operation was performed.

## Phase M.3A - internal Student mobile authentication foundation (2026-10-29)

The main backend remains the sole user/password and authorization authority. At the M.3A foundation checkpoint there were **no mobile HTTP routes or native integration**. M.3C below adds local backend HTTP adapters; native integration remains unimplemented. Existing web JWTs, seven-day HttpOnly cookies, public registration and optional Student verification retain their previous contracts. See the [M.3A handoff](MASTER_CONTEXT_UPDATED.md#phase-m3a---shared-authentication-foundations-and-mobile-jwt-isolation-2026-10-29) for isolated evidence, exact files and limitations.

| Boundary | Implemented contract |
|---|---|
| Shared credentials | `validateCredentials(input, ROLE_IDS.STUDENT)` for future mobile use; one existing login admission before account lookup/bcrypt; safe server identity or typed failure. Web `loginUser` retains all-role login and its exact public messages. |
| Shared limiter | `checkAuthAttempt`: allowed/limited/unavailable; existing boolean `allowAuthAttempt` stays fail closed. No new operation or threshold. |
| Current authority | `resolveCurrentAccount(verifiedClaims)`: uncached active account/current-role match, safe user projection, invalid versus infrastructure-unavailable outcome. Call only after the appropriate JWT verifier. Existing cookie-facing `getCurrentAccount` remains compatible. |
| Mobile JWT | Dedicated independent server key, HS256, exact issuer, audience `thesishs-student-mobile`, header typ `thesishs-mobile+jwt`, Student role 3, fixed 86,400-second lifetime, no renewal. Issue only from trusted server credential/resolver outcomes, never request identity fields. |
| Future request flow | Login: Student credential validation -> server identity -> mobile issuance. Subsequent requests: mobile signature/profile -> fresh account resolver -> existing operation-specific role/ownership rules. JWT validation alone grants no research/document access. These HTTP flows are not yet implemented. |

Lazy configuration requires server-only `THESISHS_MOBILE_JWT_SECRET` and `THESISHS_MOBILE_JWT_ISSUER`, with existing `JWT_SECRET` present and independent. No fallback to the web key; equal/absent/invalid configuration fails closed. No configuration or real secret was changed. Web and mobile cross-token rejection is covered with synthetic keys; web's existing token format/verifier was not tightened or replaced. Environment-specific issuer/key selection remains future owner configuration.

Historical M.3A session-validation proposal: separate 15-minute budgets of 60 per verified account, 300 per trusted source and 1,200 global. M.3C below implements this approved policy locally; it is not deployed or native-integrated. Never use unverified actor claims as account-budget authority. Existing login budgets and database schema are untouched.

Local mobile logout is a future client cleanup operation, not server revocation. No refresh token, session table, per-device revocation or password-change invalidation exists. Deactivation/deletion/current-role mismatch blocks requests through fresh account checks; reactivation/role restoration can re-enable an unexpired token. Private document capabilities keep their separate lifetimes. No Preview access claim, hosted-security acceptance, authenticated native test or production readiness follows from isolated M.3A tests.

## Phase M.3C - local Student mobile authentication HTTP boundary (2026-10-29)

**Implemented and isolated-test accepted, not deployed or Expo-integrated.** Contract authority is the owner's reconciliation/amendment, checked against actual M.2 interfaces at Expo `8de9b15`; no standalone historical M.3B artifact was recovered. See the [M.3C handoff](MASTER_CONTEXT_UPDATED.md#phase-m3c---student-mobile-authentication-http-adapters-2026-10-29) for exact validation commands, file manifest and limitations.

| Route | Contract and authority |
|---|---|
| POST `/api/mobile/v1/auth/login` | Exactly two JSON string fields, `email` and `password`; bounded 4,096-byte UTF-8 stream with 10-second body deadline. Flat parser rejects duplicate decoded keys, unknown fields and malformed data without new dependencies. Calls shared Student credential validation once, retaining the existing login budget. HTTP 200 `{success:true,code:"AUTHENTICATED",message:"Login successful.",data:{user,token,expiresAt}}`. |
| GET `/api/mobile/v1/session` | One Bearer credential, maximum 8,192 token characters; dedicated mobile profile, ingress admission then verification then verified-account admission then fresh active Student resolution. HTTP 200 `{success:true,code:"SESSION_VALID",message:"Session valid.",data:{user,expiresAt}}`; original token expiry, no token replacement/extension. Cookies and client IDs are not authority. |

The safe user projection contains only id/roleId/firstName/lastName/email. Backend email/password behavior is retained; Expo's 254-character email restriction versus backend 255 is deferred to M.3D. Mobile JWT key/issuer configuration remains lazy and server-only, independent from the web key; fixed HS256, Student role 3, exact audience/type and 24-hour lifetime remain unchanged. No web session, authentication cookie, refresh or revocation is added.

The existing `auth_rate_limit_buckets` repository supports the new `mobileSession` namespace without schema changes: global 1,200/source 300 before token verification, then verified-account 60, each per DB-clock fixed 15 minutes. Each applicable bucket is consumed once, with a separate account-only atomic transaction and no repeated global/source charge. No new runtime configuration/override is needed; existing explicit local/test gating and production fail-closed behavior remain. Trusted source follows the existing opt-in Vercel-direct validation only. Web login/registration limits are untouched.

Generic error envelopes are `{success:false,code,message}`, without data or internal diagnostics: 400 INVALID_REQUEST, 401 INVALID_CREDENTIALS/SESSION_INVALID, 403 STUDENT_ACCESS_REQUIRED, 413 PAYLOAD_TOO_LARGE, 415 UNSUPPORTED_MEDIA_TYPE, 429 AUTH_RATE_LIMITED, 503 AUTH_UNAVAILABLE and 500 INTERNAL_ERROR. Ineligible login accounts map to generic 403 only after password comparison. Expected JWT rejection and unavailable configuration have structured classifications; unexpected verifier failures become generic 500. Responses are private/no-store, nosniff, no-referrer and noindex/noarchive; session responses vary on Authorization. App-visible combined duplicate Authorization values reject; upstream discarded headers cannot be detected through Web Headers and hosted ingress is unverified.

M.3C tests exercise actual handlers, jose, shared services and Drizzle SQL with synthetic repository/transport/driver boundaries only. They do not prove live PostgreSQL locking, hosted/native access, deployed configuration or Android behavior. Expo transport remains unavailable; no SecureStore/native lifecycle activation. The last M.3A automatic Preview deployment is UNVERIFIED, and this local M.3C work has no deployment READY claim. Earlier Phase 10 acceptance/deferred security gates remain intact. Owner review/commit authorization precedes any separately scoped M.3D work or hosted acceptance.

## Optional Student verification UX and Admin visibility (2026-10-30)

Registration still creates the existing web session and redirects to the dashboard without issuing a verification token or sending email. The Student dashboard now uses `getCurrentStudentVerificationStatus()` to show compact, nonblocking guidance for an unverified current Student, including the existing status/request link. Verified Students receive no reminder. A failed status read is displayed as unavailable, without blocking the workspace or labelling the account unverified.

The status page distinguishes optional verification, local Mailpit capture and unavailable hosted delivery. A successful request means accepted for delivery, not inbox receipt; existing 60-second cooldown, five requests per rolling hour and 60-minute link expiry remain unchanged. Verified Students have no request/resend form. The public page retains explicit confirmation and adds sign-in/status/new-link recovery guidance for invalid, expired or previously used links. Generic rejection and token handling are unchanged.

Only the Admin directory's safe server projection/`ManagedUser` DTO adds `emailVerifiedAt` from the existing migrated users table. The page passes a derived `Verified`, `Unverified` or `Not applicable` label to the client; verification request records, digests and timestamps are not sent to that component. Active/Inactive remains independent. Existing current-account Admin authorization, directory filters and management actions are preserved; no Admin resend, reset or manual verification action is introduced. Shared login/current-account projections remain unchanged.

Local Mailpit remains the only approved delivery adapter, with its existing development-only, loopback and synthetic-recipient restrictions. Hosted delivery/provider acceptance, mandatory enforcement and Admin recovery operations remain deferred. No schema/migration, web JWT/session, mobile HTTP contract, Expo M.3D or AI behavior changes. Focused offline rendering/projection/authorization checks and static validation are recorded in the [handoff](MASTER_CONTEXT_UPDATED.md#optional-student-verification-ux-and-admin-status-integration-2026-10-30); no new hosted or browser acceptance is claimed.

## Disabled Resend verification delivery preparation (2026-10-30)

Resend is selected as the intended future HTTPS email provider. `lib/email/resend-delivery.ts` prepares a server-only, SDK-free transport and a `VerificationDelivery`-compatible factory. The factory's availability check always throws a sanitized disabled error, and its send method checks availability before transport. It reads no environment variables, has no enable flag or ambient/default fetch, and is not wired into any application action. Providing an API key alone cannot activate it. Development, Preview and Production Resend delivery remain disabled; the existing local Mailpit adapter and production-mode request/confirmation refusal are unchanged.

The internal transport primitive requires an explicitly injected HTTP implementation for offline mocks; it is not an activation or authorization API. It validates supplied server configuration (header-safe key, sender email and fixed HTTPS origin), recipient and the existing token format. It constructs the fixed `/verify-email` fragment link and sends only sender, one recipient, subject and plain text to the fixed Resend endpoint. It refuses redirects, omits credentials/caching, bounds the entire request and acknowledgement read to five seconds and the response to 4,096 bytes, and performs one attempt without retries. A valid HTTP 200/JSON identifier acknowledgement means accepted, not inbox delivery. Explicit non-timeout 4xx rejection is failed; timeout, network errors, server errors and unusable acknowledgements are uncertain. Only safe outcome/reason enums leave the transport; response contents, provider identifiers, credentials and links are not logged or returned.

Contract references: [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email) and [API errors](https://resend.com/docs/api-reference/errors), reviewed as public documentation only. Configuration validation does not prove sender-domain ownership or provider authorization. No domain is available yet and no real Resend key was supplied/configured in this checkpoint. A separately approved activation design must establish environment scope, verified domain/sender, fixed HTTPS confirmation origin, private key handling, recipient restrictions, budget/outage handling and protected Preview access before wiring any live HTTP implementation. Real-inbox acceptance remains deferred. Existing quotas, token hashing/expiry/atomic consumption, optional verification and read-only Admin status are unchanged.

## C2 Collaborative Research Workspace backend foundation (2026-11-05)

Local backend source is implemented for Student-only project-scoped tasks and shared plain-text notes. The owner prioritizes this workspace before immediate P.4 work; C2 does not repurpose P.4 or start a UI checkpoint. There is no Group Workspace page/navigation entry yet, no generated/applied workspace migration and no deployment or database operation.

`lib/actions/collaborative-workspace.action.ts` delegates unknown input to strict Zod validation in `collaborative-workspace.service.ts`. Its single per-operation authorization path reads JWT-verified session identity, then transaction-scoped current account/Student role, active group, membership and paper/group consistency. `authorizeStudentWorkspace` returns only `{studentId,groupId,paperId}` after those checks. The injected repository in `lib/repositories/collaborative-workspace.repository.ts` implements locking and scoped persistence; `collaborative-workspace.runtime.ts` binds the existing session and guarded database. `lib/workspace/contract.ts` defines minimized workspace DTOs and results; clients cannot choose actor/group/creator identity. No prior page authorization is trusted and no persistent authorization cache is introduced.

Operations cover task list/create/details edit/assignment/status/hard deletion and note list/create/view/edit/link/unlink/soft deletion/restoration. The approved creator-departure recovery permits any current authorized member to reassign/unassign only when the original creator is no longer an active Student member. It grants no details-edit/delete permission. Note content/ownership is creator-controlled independently of the linked task's creator. Normal note lists exclude deleted notes; `deletedOnly:true` lists only the caller's deleted notes, and a deleted note is individually visible only to its current eligible creator.

Results distinguish `success`, `validation`, `unavailable` (including unauthorized resources), `conflict` and `infrastructure`. Task/note timestamps are serialized as ISO strings; content remains plain text. Atomic note updates match expected version, project, creator and deletion state, then increment the version in SQL. A scoped follow-up lookup classifies a verified stale version; zero affected rows alone never proves conflict. Failed or uncertain requests expose no SQL/driver details. The future UI must preserve unsaved text on conflict and render plain text safely. Successful mutations revalidate only `/dashboard/student/workspace`; a refresh failure retains the successful saved result with `refreshRequired:true`.

Task deletion and note unlinking share a transaction, including deleted notes and version increments. Task SHARE locks for linking conflict with the task UPDATE lock for deletion; involved users are locked in ascending ID order before group/membership/paper/task scope. No provider/network work runs within these transactions. Detailed types, constraints, SQL requirements, permission prerequisites and deferred migration-tooling work are in [the C2 database handoff](DATABASE%20%281%29.md#c2-collaborative-research-workspace-schema-source-2026-11-05).

The foundation imports no academic mutation, notification/Web Push, PDF/Storage or AI service. It neither changes official research progress nor widens submitter-only feedback/published repository access. Private workspace data must stay outside repository/PDF/AI responses and offline caches. No public API route, dependency, alternate membership mechanism, WebSocket, CRDT, persistent draft storage or Adviser/Admin/Panel participation is added. Real PostgreSQL constraints/concurrency and future UI/Preview acceptance remain separate gates.

## C2.1 Workspace migration source readiness (2026-11-05)

Drizzle Kit generated additive `0016_collaborative_research_workspace.sql`, its snapshot and the 17th source-journal entry. No database application or deployment occurred, and all C2 backend/schema files remain unchanged. The SQL/snapshot add only the two workspace tables and approved constraints/indexes; prior table definitions/history are preserved. See [the generated-artifact and grant review](DATABASE%20%281%29.md#c21-workspace-migration-preparation-2026-11-05).

Preview migration tooling now separates the verified legacy 16-entry contract from the generated 17-entry workspace source. Both exact digests are checked together. A complete known 16-entry target is recognized as pre-workspace rather than corrupt; a 17-entry ledger records migration identity only and is not proof of catalog/grant acceptance. The old initializer/0015 recovery and role/Admin operator remain bounded to legacy source. The initializer uses the same installed ORM dialect migration/session/savepoint path with the explicitly reviewed prefix, so the enlarged folder cannot expand an old approval into applying 0016.

Catalog verification has explicit populated `workspace-baseline` and post-upgrade `upgrade-0016` contracts alongside the unchanged legacy modes. No new workspace execution flag/CLI, runtime grant or provider change was added. Separate owner-approved operator preparation and focused PostgreSQL acceptance must establish application, least privileges, authorization/concurrency and existing-record preservation before this foundation is considered operational. UI/C3, Preview/Production release and broader milestones remain separately gated; P.3F.3 is not reopened.

## C3 Student Group Task Board UI and safe capability read (2026-11-05)

C3 adds the Student-only /dashboard/student/workspace route and Group Workspace navigation without changing Student submissions. Existing Student layout plus explicit requireRole/getDashboardAccount and C2 service scope checks remain the authorization boundary. The route reuses the authorized getStudentResearchProjects directory, sends only ID/title, orders newest-created then ID, and validates a single positive int32 project query against that directory. Missing selection defaults deterministically; foreign/invalid IDs do not reach the task read. URL selection and a project-keyed client subtree prevent cross-project form/data reuse.

The categorized list uses To Do, In Progress and Done, loaded counts, native expandable details and shared ResearchDialog forms. Existing C2 task Server Actions handle create/edit/assign/status/delete; no extra task-detail endpoint, ownership transfer, Notes UI, academic-status automation, provider or schema change. Confirmed changes refresh authoritative state. Structured failures preserve drafts; uncertain results pause mutation pending reload. Open forms/pending work lock the selector and capture the original paper ID. Shared dialog keyboard/focus conventions are retained with C3 focus restoration after pending transitions/deletion.

Minimal C2 additions: TaskBoard DTO/taskBoard service read and repository transaction taskDirectory. The existing service run/authorizeStudentWorkspace path authorizes before directory access. Choices query only active Student members of that group; historical display names are limited to creator/assignee IDs from its scoped task rows. The client receives names/IDs and current eligibility/capability booleans, never account credentials or an unfiltered Student list. Eligible creator has edit/delete/assign/status; eligible assignee has status; orphan recovery gives current eligible members assignment only. Existing mutation methods recheck all rules independently. Historical ineligible assignee attribution remains visible as Needs reassignment. Existing C2 note behavior is unchanged.

Styling uses current academic theme tokens and Student dialog styles with stacked mobile controls, labeled inputs, native details/dialogs, visible focus, safe plain-text descriptions and date-only due dates. No UI library, decorative assets, DnD, analytics, offline mutation queue or realtime transport. Private task data is not added to persistent/offline caches. Notes belong to separately scoped C4.

Validation boundary: 6 C3 unit/server/SQL-shape cases plus 20 relevant C2 regressions PASS; actual Chromium component interactions/permission UI/project isolation/empty-loading-error states, keyboard/focus, 360/1280 Light/Dark and text contrast PASS. TypeScript and targeted ESLint PASS. The separate local Next browser attempt was BLOCKED at server startup before any fixture or C3 route/action; owned process stopped and original database rows/catalog/17-entry ledger verified unchanged. Thus full HTTP authentication/Next Server Action/durable UI acceptance, installed-PWA/device behavior, restricted-runtime permissions and concurrent races remain unverified. C3 is implemented with partial full-app acceptance, not production readiness. Preview/Production unchanged; no C4 or deployment. See the latest Master Context C3 handoff for the exact file manifest and evidence.


## C4 Shared Research Notes and workspace tabs (2026-11-06)

The Student Group Workspace now composes a shared project selector with Tasks/Notes tabs. workspace-view.ts canonicalizes the tab/deleted view and builds bounded URL state. Existing authorized project resolution is unchanged; page.tsx reads only taskBoard or notesBoard for the active authorized selection, never an unselected/foreign paper. The project-keyed StudentGroupWorkspace resets project-specific child state. Notes' deleted view has its own key. Research Submissions is unchanged.

The narrow NotesBoard/NotesBoardNote DTO and notesBoard service read reuse the existing authorized transaction's listNotes, listTasks and attribution directory. Display data contains escaped plain text, timestamps, creator names, scoped task ID/title choices and creator edit/link/delete/restore capabilities. Active list excludes deleted notes; Recently Deleted passes the verified actor to the existing creator-filtered repository query. A linked task missing from the current scoped task map renders Unlinked. No new repository operation, identity input, schema, migration or permission model.

StudentResearchNotes reuses native details and ResearchDialog. Creation and title/content edits use existing note actions; task association is a separate version-checked action. Creator-only soft deletion and restoration preserve content/authorship. Every write independently rechecks C2 authorization and same-paper links. An opened note's expectedVersion remains fixed across list refreshes. Conditional failures preserve drafts; a conflict pauses saving until an explicit warned authorized latest-note read replaces the dialog source/draft/version. It never auto-retries a stale update or chains text/link saves. Deletion-state changes during reload keep writes blocked. Infrastructure or refresh uncertainty pauses mutations pending workspace verification.

Open forms/pending work lock shared navigation; synchronous submit locks prevent duplicates. Paper/note/task identifiers come from the bound project/dialog, with remounts on project changes. Dirty close/Cancel/Escape and document unload reuse existing confirmation guards. A feature-detected Navigation API listener adds cancellation for supported cancelable history events; actual Next routing/history and older-browser behavior remain unverified. Unsupported/noncancelable history or OS termination can lose an in-memory draft without that extra prompt. No persistent/global draft store, offline queue or realtime editing is introduced. Platform reference: [MDN Navigation navigate event](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/navigate_event).

Theme tokens, wrapping plain text, compact row separators, mobile stacked controls, 44px targets, manual keyboard tabs and dialog focus restoration preserve the academic UI. C4 scoped PASS covers five isolated C4 cases, six focused C3 regressions, twelve synthetic-boundary Chromium interaction groups, an existing C3 component regression, 1280/360 Light/Dark contrast/overflow/keyboard checks, TypeScript and targeted ESLint. Full authenticated C3+C4 browser/Next Server Action/durable-write acceptance is explicitly deferred to a separate owner-approved checkpoint; C4 starts no Next server and performs no PostgreSQL/provider/Preview/Production operation. Earlier C3 startup limitations are not declared resolved. See the latest Master Context C4 handoff for exact files, preservation and evidence boundaries.


## C5 authenticated local workspace acceptance boundary (2026-11-06)

C5 verifies the implemented C3/C4 workspace through the existing healthy normal Next.js development server, actual password Login form and HttpOnly cookies, real Server Action HTTP transport, unchanged service/repository authorization and committed local PostgreSQL writes/readback. This supersedes earlier component-only/pending application acceptance labels within the essential local C5 scope. No application, schema, migration, auth architecture or dependency correction was needed; test-harness origin/readiness, panel-scoping and canceled-reload assertions were corrected.

The new explicit tests/c5-workspace.browser.cjs verifies the pinned loopback thesishs_ai/OID 16387/cluster 7652422818440234372 and exact 17-entry source ledger before marked fixtures. It reuses existing database configuration/inspection/private-file guards and leaves the owner's port-3000 server untouched. Actual browser-established sessions also drive negative Server Action replays against only owned fixtures, proving external assignee, peer edit and outside-group denials independently of hidden UI controls. No cookie injection or mocked authentication is acceptance evidence.

Thirteen distinct groups passed across ten main-run groups and five focused follow-up groups, with setup/login common. Evidence covers project/tab URL/default/refresh/Back/Forward isolation, durable task categories/creator edit/assignment/assignee status, plain-text notes/edit/link/unlink, creator-scoped deleted listing/restoration, two creator-session sequential stale-version rejection with preserved draft and explicit warned reload, confirmed task deletion preserving/unlinking notes with version increments, and actual 360/1280 Light/Dark navigation/dialog/keyboard rendering. Real Chromium Back was a cancelable same-document traverse; canceled Back and standard beforeunload refresh preserved drafts. Unsupported/noncancelable history and OS termination retain C4's limitation. A single uninterrupted run of the corrected full harness was not repeated; focused post-correction evidence is explicit in Master Context.

Fixtures commit with unique C5 markers and private exact-ID ownership manifests before commit, then clean only owned notes/tasks/papers/memberships/group/users in dependency order after real logout. Each attempt verifies original row digests/counts across all 19 public tables, identity/catalog/ledger unchanged. Final independent read-only verification found every ID/marker from all committed C5 attempts absent, with the original one task and one note intact. Fixture sequences advance normally and are never reset. Web Push rows and submission metadata match; browser provider/push requests are blocked, no Storage mutation path is called and remote object inventory is not separately tested.

C5 is essential local browser acceptance PASS with recorded provenance, not restricted-runtime grant, protected Preview/Production, simultaneous-race/load, other browser/physical-device/PWA or reliability acceptance. The existing local postgres privileged runtime was used without role/grant changes. TypeScript, targeted harness ESLint, whitespace and incoming-file/index/document-prefix preservation pass; no broad C1-C4 suite/build or provider test. See the latest Master Context C5 handoff for exact results, fixture IDs, cleanup evidence and closure recommendation. Additional phases and Git/deployment publication remain separately authorized.


## C6 Collaborative Research Workspace local closure (2026-11-06)

Collaborative Research Workspace is complete for the approved local demonstration scope. Preview activation and production-readiness checks remain separately gated.

The closed Student-only implementation follows page/client UI -> existing Server Actions -> strict Zod -> current authenticated scope/service rules -> scoped Drizzle repository -> PostgreSQL. Shared project selection and Tasks/Notes views expose only the authorized paper. Task creator/assignee/recovery rules, creator-only version-checked note mutations, scoped deleted visibility and transactional note preservation remain as described in the C2-C5 sections. No academic/provider workflow or permission architecture was changed for closure.

Local 0016 application and seven PostgreSQL functional cases are completed evidence; C5 adds actual password login, cookies, Server Actions and committed UI persistence/denials with exact fixture cleanup. Its 13 acceptance groups combine a main run and focused follow-up; no uninterrupted corrected full-harness pass is claimed. C6 verifies source/import completeness, unchanged migration history and the pinned legacy/current source identities without database access or server lifecycle operations. [Master Context C6](MASTER_CONTEXT_UPDATED.md#c6-collaborative-research-workspace-local-closure-2026-11-06) records the complete scoped commit inventory and preservation boundary.

Deferred: Preview migration 0016 and minimum runtime privileges, Preview/Production deployment, restricted-runtime privilege verification, production concurrency/race testing, additional browsers/devices and an uninterrupted rerun of the corrected full C5 harness. No database/server/provider operation, push, merge or deployment is authorized by C6. This local closure does not activate hosted CRW, broaden signed-document access, notify participants or enable AI/offline/realtime editing.

## Research Supervision S3.1 — local configuration boundary

Admin User Management now reads a minimized Main Adviser configuration through `getMainAdviserConfiguration` and renders `AdminMainAdviser`. The panel lists active Role ID 2 accounts, displays the current designation or unconfigured state and captures the selected target/current revision in an explicit confirmation dialog. Stale/uncertain results pause further changes until an explicit refresh. The page preserves its existing user directory, role/status operations and eligibility controls. Existing tokens/themes, native controls and `ResearchDialog` retain ENERGY 1 / RHYTHM 2 / MOTION 1.

`designateMainAdviserAction` delegates unknown input to strict Zod/service validation. `getCurrentAccount` resolves the current active Admin; clients supply neither actor identity nor authoritative role. `replaceMainAdviserDesignation` rechecks/locks acting Admin and candidate user rows in ascending ID order, then locks the seeded singleton. It verifies active Adviser eligibility and expected revision, updates the designation and inserts an existing activity-log entry containing old/new user IDs and revisions in one transaction. An audit failure rolls back the designation. Identical targets do not create another revision/event. No provider/network work occurs in this transaction.

`updateManagedUserForAdmin` uses the same accounts-then-singleton lock order. It refuses deactivation or role-away-from-Adviser changes to the current Main, requiring replacement first. Competing designation/account changes therefore serialize: account revocation first makes a candidate ineligible; designation first protects that account. Missing singleton/table fails closed for configuration and managed role/status writes; the existing user directory can still render its own retrieval result. This source must not be deployed before its separately authorized migration is present.

The designation remains administrative configuration in S3.1. No existing group, official review, PDF, notification, publication, Student workspace or AI permission is switched to it yet. The Co-Adviser table has no runtime workflow/action/read surface. S3.2/S3.3 and focused integrated acceptance remain required before integrated deployment. Real PostgreSQL lock/constraint behavior is not verified by the offline transaction doubles; see the S3.1 Master Context handoff.


## Research Supervision S3.2 - current Main authorization (2026-11-08)

`lib/auth/main-adviser.ts` supplies uncached `getCurrentMainAdviser(expectedUserId?)`: resolve the current active database-backed account, require Role ID 2, reject a caller-ID mismatch, then match the S3.1 designation repository's current eligible Main. Missing/invalid designation or lookup failure denies Main-only operations. No role, JWT authority claim or persistent cache is introduced. `currentMainAdviserPredicate` enforces the same designation/active-role scope inside institution-wide dashboard, group/member/project, submission/version/feedback and count-only aggregate SQL. Page adapters recheck before returning their combined results. Historical group-owner filters no longer authorize these paths. Ordinary Advisers receive the existing unavailable/restricted presentation, with no Co projection.

`lockCurrentMainAdviser` extends the existing S3.1 repository without changing its Admin designation/read functions. Academic transactions lock involved accounts in ascending ID order, then hold a SHARE lock on the singleton before resource writes. This conflicts with S3.1 replacement's singleton UPDATE lock: replacement first denies the former Main; an already authorized operation commits before a waiting replacement. Existing account revocation uses the same accounts-then-singleton order. Group creation records the creating Main in the historical Adviser field and logs creation in the same transaction. Official decision transactions lock/check the exact submission/paper association and Under Review state before inserting feedback, then retain conditional status update, paper update and activity atomicity. Submission-before-paper ordering is preserved. No assignment closure is added before S3.3.

The directly necessary membership correction moves eligibility checks and add/remove into one transaction under the Main and Student user locks. It locks the target and existing membership groups in ID order, preserves archived memberships and rejects duplicate/current active-group assignments before inserting. Removal retains the existing archived-group/changed-account behavior. No schema or general membership framework is added. Existing Admin reactivation policy is unchanged; this checkpoint does not introduce a cross-group reactivation policy.

Private submission signing retains exact stored paper/version/path validation and current Student membership rules. Adviser access now requires current Main authority, including checks before signing and before returning the URL; Admin/Panel submission signing remains denied under the existing contract, while published-repository access is unchanged. No database lock is held across Storage signing. Existing signed capabilities cannot be retroactively revoked by designation replacement.

Direct upload finalization resolves a nullable current Main recipient only after a fresh acknowledged commit. The same resolved ID reaches the existing push callback and in-app notification; no designation/lookup failure reverses submission success or falls back to historical ownership. Replays/lost-ack paths retain their existing best-effort/no-duplicate behavior. The retired File-posting service's notification path also uses this resolver. No upload authorization/version/storage path behavior changes.

Adviser Research Assistant static actions and internal aggregate preparation now require current Main authority; aggregates remain count-only with existing k=5/complement suppression and pre/post authority checks. The internal interpretation path inherits these gates. The shared static system guide remains a role-based, research-data-free guide; institutional consent/eligibility governance is unchanged, and the CLI pilot uses synthetic payloads only. Groq remains hard-disabled. No Co AI access, provider, prompts or consent changes are added. S3.2 real PostgreSQL concurrency and authenticated runtime acceptance are pending; prior S3.1 PostgreSQL evidence is not proof of these new paths.


## Research Supervision S3.3 - exact-assignment workflow (2026-11-08)

The existing Adviser submission detail adds MainDelegationPanel without replacing the Desktop Review Workspace, PDF controls, version navigator, official decision dialogs or ReviewDraftBoundary. Its authorized read/mutation actions reload only panel data, preserving an official feedback draft. The existing submissions route selects either the Main directory or CoAdviserWorkspace; non-Main dashboard users get a link to that restricted route. Native selection/dialog/textarea controls, theme tokens, 44px controls and ENERGY 1 / RHYTHM 2 / MOTION 1 are retained.

Server Actions -> strict Zod and fresh current-account/Main service guards -> scoped co-adviser repository -> existing Drizzle schema. Co reads use one minimized own-assignment projection: assignment/submission IDs, title, version, state, availability and timestamps. No storage path, Student/group information, remarks, official feedback, other recommendation or version navigator is serialized. Main recommendation reads recheck current designation before returning.

Mutation order: ascending involved user rows -> singleton SHARE -> submission UPDATE -> assignment rows. Main delegation locks actor/candidates together through the S3.2 helper. Co completion locks its own account, then singleton and exact submission/owned assignment; it never locks the Main account after a submission. All four mutation paths serialize on the submission: creation/cancellation, recommendation completion and official finalization. Existing Admin replacement/lifecycle operations retain accounts -> singleton order. No network I/O occurs inside academic transactions.

The official feedback repository calls closeOpenDelegationsForDecision inside its existing transaction after authority/submission/status validation. Only exact-submission open assignments become closed, with closing Main/time/reason and activity entries. Completion leaves private text in the assignment table; it never writes official feedback or academic statuses. Conditional open-state updates reject stale/double writes. DB clock timestamps respect creation-time bounds. Rollback coverage includes a failure after assignment, feedback and status writes.

Delegated signing extends the existing document service with a separate exact-assignment entry point. Fresh active session account, own open assignment, eligible submission and exact persisted paper/version path are required; account/assignment/path are rechecked after signing. Fixed TTL is 300 seconds with no caller-supplied duration; terminal assignments cannot request new links. Previously issued URLs retain their expiration window. Main/Student/published repository policies remain unchanged.

Existing in-app notification infrastructure is reused after commit: assignment -> Co; completed recommendation -> current Main. Messages contain no private text or PDF URL. No new push/email/provider integration. Official decision notifications retain their existing path.

Research used existing S3.1/S3.2 and dialog/review patterns, installed Next.js Server Actions/revalidation documentation, [PostgreSQL 18 lock ordering](https://www.postgresql.org/docs/18/explicit-locking.html) and [Next.js action/data security](https://nextjs.org/docs/app/guides/data-security). No third-party implementation/dependency was needed or copied. Real PostgreSQL scheduling, browser/Server Action persistence, hosted grants/TLS/pooler/Storage and physical PWA acceptance remain separate gates.
