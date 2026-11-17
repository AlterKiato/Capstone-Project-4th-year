# SEC-Next16-P1: Controlled Next.js security patch

Date: 2026-11-17 (Asia/Manila). **SEC-Next16-P1: PASS / CLOSED for the validated local scope. Next.js: 16.4.6.** The owner accepted the completed local validation and authorized exactly one scoped local commit, `fix(security): patch Next.js to 16.4.6`, containing only `package.json`, `package-lock.json` and this report. Resolve the closure commit SHA from Git; no self-referencing SHA is claimed here.

This closure reuses the completed TypeScript, ESLint, 42-test, isolated-build, synthetic auth/dashboard/PWA, anonymous-route and production-audit evidence below; those checks were not rerun for the closure. The full audit retains 14 development dependency entries (11 moderate, 3 high). Hosted deployment and authenticated database acceptance remain NOT TESTED; push, merge, publication and deployment remain separately gated.

## Patch implementation baseline and final Git state (before closure commit)

- Initial and final branch: `feature/development`.
- Initial and final HEAD: `811495d89bf2d50d1b37fb992bb14acb14c5a20c`.
- Initial and final index: empty.
- Initial tree: 12 modified tracked paths and 4 untracked paths (16 incoming pending paths).
- Final tree: those same 16 preserved paths, plus the two unstaged dependency changes and this untracked report (14 modified tracked paths and 5 untracked paths; 19 pending paths).
- No reset, stash, discard, staging, commit, push, merge or deployment. No Visual-V1.5D, application-code correction, AI/provider operation, database/Storage operation or environment/configuration change.

Read current AGENTS.md, relevant architecture/dependency/test sections of Master Context and Source of Truth, the Preview playbook/baseline for release boundaries, existing auth/PWA tests and V1.5B/C reports, and installed Next.js upgrading/version-16 and building guides. Historical dependency statements in protected documents were not rewritten. The current source retains UI -> Server Actions -> Zod -> services -> repositories -> Drizzle layering and server-side authorization.

The cancelled upgrade assistant left no visible pending package/lockfile changes: both files matched HEAD before installation. The manifest, lock and installed Next all reported 16.4.3; React/React DOM and eslint-config-next also matched their recorded versions. This establishes the observed baseline, not a reconstruction of the cancelled assistant's actions.

## Exact changes and compatibility

Only these nonignored files changed during this checkpoint:

| File | Change |
| --- | --- |
| `package.json` | Exactly `next: 16.4.3 -> 16.4.6`; exact pin retained. |
| `package-lock.json` | Root Next pin and 10 existing package entries updated; no packages added or removed. Lockfile version remains 3. |
| `docs/SEC_NEXT16_P1_PATCH.md` | This new report. |

The ten changed lock entries are `next`, `@next/env` and eight `@next/swc-*` platform packages (Darwin arm64/x64, Linux arm64/x64 GNU/musl, Windows arm64/x64), all 16.4.3 -> 16.4.6. Version/resolved/integrity fields changed; Next's matching env and optional compiler references changed. The installed Windows tree changed three packages: Next, @next/env and the Windows x64 compiler. No unrelated package metadata or versions changed in the lockfile.

| Item | Before | After |
| --- | --- | --- |
| Next manifest / lock / installed | 16.4.3 / 16.4.3 / 16.4.3 | 16.4.6 / 16.4.6 / 16.4.6 |
| React / React DOM | 19.2.4 / 19.2.4 | Unchanged |
| eslint-config-next | 16.4.3 | Unchanged; no coordinated update required by the verified dependency graph or checks |
| Node / npm | 24.18.0 / 11.16.0 | Unchanged |

Next 16.4.6 requires Node >=20.9.0 and accepts React/React DOM ^19.0.0; the installed versions satisfy those constraints. Optional peers retain their declared optional status. Full `npm ls --all --json` exited 0 with no invalid peer tree. TypeScript, ESLint, Tailwind, Drizzle, auth and AI dependencies were not independently upgraded. No force or legacy-peer-deps override was used.

## Patch implementation commands and validation (reused for closure)

Substantive commands, in addition to focused file reads, Git diffs and SHA-256 checks:

~~~text
node --version
npm.cmd --version
npm.cmd view next@16.4.6 version engines peerDependencies dependencies --json --fetch-retries=0 --fetch-timeout=20000
npm.cmd ls next react react-dom eslint-config-next --depth=0
npm.cmd audit --omit=dev --json --fetch-retries=0 --fetch-timeout=20000
npm.cmd install next@16.4.6 --save-exact --fetch-retries=0 --fetch-timeout=30000
npm.cmd ls --all --json
npm.cmd audit --omit=dev --json --fetch-retries=0 --fetch-timeout=20000
npm.cmd audit --json --fetch-retries=0 --fetch-timeout=20000
node test-results/sec-next16-p1/typecheck.cjs
node node_modules/eslint/bin/eslint.js <all 545 nonignored JS/TS source paths>
node --require tsx/cjs --test --test-concurrency=1 tests/phase10-email-otp-auth.unit.cjs tests/phase101d2-auth-security.unit.cjs tests/phaseP3-pwa.unit.cjs tests/pwa-settings.unit.cjs
node test-results/sec-next16-p1/build-run.cjs
node --require tsx/cjs test-results/sec-next16-p1/auth/build-fixture.cjs
node test-results/sec-next16-p1/auth/verify.cjs
node test-results/sec-next16-p1/visual-v15b/check.cjs
node test-results/sec-next16-p1/visual-v15c/check.cjs
node test-results/sec-next16-p1/runtime-smoke.cjs
git diff --check -- package.json package-lock.json
~~~

The ESLint command above represents the argument list generated from Git's nonignored source inventory; see the actual file count in the validation table. Scratch helpers and outputs are ignored under `test-results/sec-next16-p1/`. The build helper copies current source into an isolated snapshot, excludes .env files, uses an allowlisted environment with synthetic non-routable database/Storage settings, disables telemetry/push, and invokes the installed Next CLI as `next build --webpack` with one worker. Only the snapshot configuration adds the worker limit. Main checkout configuration/build output is preserved.

| Check executed during patch implementation | Result and limits |
| --- | --- |
| Current-source TypeScript | PASS: 394 nonignored TS/TSX/MTS roots, TypeScript 5.9.3, zero diagnostics, no emit or incremental cache. Historical ignored build snapshots excluded. |
| ESLint | PASS: 545 nonignored JS/TS source paths; no diagnostics. Existing eslint-config-next 16.4.3 remains usable. |
| Auth/OTP/security/PWA unit checks | PASS: 42/42 across the four listed test files. Actual service/component logic with synthetic account, database, mail and browser boundaries. |
| Isolated production build | PASS: Next 16.4.6 webpack, TypeScript completed, 27/27 page-generation tasks, build exit 0. Synthetic settings do not verify live resource configuration. |
| Auth UI Chromium | PASS: four Light/Dark x desktop/mobile registration views; independent password toggles, value/DOM/focus preservation, validation/payload/pending behavior, keyboard/touch and login/OTP smoke. Zero browser errors or unexpected external requests. Server Actions/session/config/status and Next presentation boundaries doubled. |
| Dashboard shell Chromium | PASS: 40 paired before/after cases (80 renders), four role presentations, Light/Dark and five browser/simulated-install modes. Actual shell/Next Image/navigation/Radix; synthetic routing/account boundaries. Zero errors or unexpected requests. This is presentation evidence, not authenticated role acceptance. |
| PWA identity/metadata Chromium | PASS: installed Next metadata helpers and generated favicon/manifest handlers, icon dimensions/bytes, Chromium manifest parsing and ICO data-URL decoding. Zero unexpected requests/errors. HTTP byte delivery and ICO decoding remain distinct from actual tab-chrome display. |
| Actual production-server smoke | PASS: anonymous GET-only checks on a temporary loopback Next 16.4.6 server using the isolated build. Login, registration and verification pages render HTTP 200; /dashboard and Student/Adviser/Admin dashboard paths redirect to /login. Manifest is served with the expected MIME, names/start path/colors/display; 192/512/180 icons match dimensions; favicon matches source bytes; service-worker nosniff/no-cache headers pass. No form submissions, real sign-in, authenticated records or provider calls. Owned server/browser terminated after checks. |
| Whitespace / dependency delta | PASS: focused diff checks; only intended dependency entries differ. Git emits its existing LF-to-CRLF conversion notice; no manual normalization performed. |

Initial sandbox npm requests failed with EACCES; network-enabled metadata/audit/install succeeded. An overlapping initial audit output file was locked; a separate successful audit supplied the baseline. The first sandboxed build failed fetching Google Fonts (EACCES); the network-enabled rerun compiled and completed successfully, so that failure is environmental. The build's multiple-lockfile/root-inference warning arises from the isolated snapshot. No application configuration was changed to suppress it. The auth fixture's initial sandboxed esbuild invocation was denied ancestor-directory access; the filesystem-enabled rerun passed. A duplicate declaration in the new ignored runtime harness was corrected before its successful run; no application source fix was needed.

npm also warned that five existing packages' install scripts are not covered by allowScripts (esbuild variants, bcrypt and unrs-resolver). No script approval/configuration was added. The focused checks and build passed with the resulting installation. No npm audit fix was run.

## Security findings

Before: production audit reported one moderate Next.js package entry, [GHSA-mfr8-8qww-v76h](https://github.com/advisories/GHSA-mfr8-8qww-v76h), information disclosure across root params when a use-cache function is called through unstable_cache. Reported affected range: >=16.3.0 <=16.4.4; npm recommended 16.4.6. This is dependency exposure evidence, not proof this application exercised the vulnerable path.

After: **production-only audit exit 0, zero vulnerabilities in all severities**. The full audit exits 1 and reports **14 affected development dependency entries: 11 moderate, 3 high, zero critical/low**. These are npm package-entry counts, not 14 distinct CVEs. Production omission was independently checked; the remaining entries were not silently remediated.

| Remaining full-audit package entry | Severity | Scope |
| --- | --- | --- |
| `@esbuild-kit/core-utils` | moderate | Development dependency chain |
| `@esbuild-kit/esm-loader` | moderate | Development dependency chain |
| `@typescript-eslint/eslint-plugin` | moderate | Development dependency chain |
| `@typescript-eslint/parser` | moderate | Development dependency chain |
| `@typescript-eslint/type-utils` | moderate | Development dependency chain |
| `@typescript-eslint/typescript-estree` | moderate | Development dependency chain |
| `@typescript-eslint/utils` | moderate | Development dependency chain |
| `brace-expansion` | high | Development dependency chain |
| `browserslist` | high | Development dependency chain |
| `drizzle-kit` | moderate | Direct development dependency |
| `esbuild` | moderate | Development dependency chain |
| `js-yaml` | high | Development dependency chain |
| `minimatch` | moderate | Development dependency chain |
| `typescript-eslint` | moderate | Development dependency chain |

The high findings concern brace-expansion denial-of-service paths, Browserslist memory/crash/prototype-write handling and js-yaml CPU/merge processing. Moderate chains include minimatch amplification and the older esbuild development-server advisory through Drizzle tooling. Some fixes are advertised as available, but changing these dependencies is outside this checkpoint; the Drizzle chain's suggested change is marked semver-major by npm. Full advisory titles, affected paths/ranges and fix metadata are retained in the ignored audit JSON.

The official [16.4.5 security release](https://github.com/vercel/next.js/releases/tag/v16.4.5) lists cache/response/image/Edge-cookie fixes; [16.4.6 release notes](https://github.com/vercel/next.js/releases/tag/v16.4.6) describe follow-up bug fixes, including route-response compression and Turbopack development GC. No Tailwind update from create-next-app release notes was applied to this application. Successful installation/audit/build does not establish comprehensive application security or deployed protection.

No credentials/secrets were added: dependency deltas contain package pins and public npm registry URLs/integrities, and this report contains no live credentials. No .env files were copied into the build or edited. Supabase Data API and all provider configuration were left untouched.

## Preservation evidence

SHA-256 captured before modification for **697 nonignored files**. Final comparison: **695 unchanged**, the two authorized dependency files changed, and this report is the sole new nonignored file. No incoming file was removed. All 16 incoming pending paths retain both their original status and exact content, including the five protected docs/developer-test paths and all V1.5B/C assets/source/reports.

| Protected pending path | Before = after SHA-256 | Verification |
| --- | --- | --- |
| `app/favicon.ico` | `a0b95a9824c230b125399ebff7790c58f0e2b9aff580c20c70992a91eb651525` | PASS |
| `app/layout.tsx` | `994b83adab885f77f04417aaa740de75797afca2338186554cea26e8c9af7b85` | PASS |
| `app/manifest.ts` | `ee81da22e99cea3af8383817e8e8deea56aeacb3ddd8835b3bc1c58f57bbbd6f` | PASS |
| `components/dashboard/dashboard-shell.module.css` | `d8a3c4225b8e4009fdfbf4482058ca5a76aa8a66853867308d1cdfbda1f08519` | PASS |
| `components/dashboard/dashboard-shell.tsx` | `5b9b06e2edf3b8e6c9534dbdcf6e825041c1466be22bdd9db558b2d5eaece916` | PASS |
| `docs/MASTER_CONTEXT_UPDATED.md` | `bb72b97e82a7c1dcd1df468218b2f58e9f974953291885e4c5ffc70773f736fe` | PASS |
| `docs/PHASE10_STUDENT_EMAIL_OTP.md` | `de6385df2cb27b491af0de4366e72ec7abcc9f2d57baf6d77118780d2e49a44d` | PASS |
| `docs/SOURCE_OF_TRUTH_UPDATED.md` | `827f92703f2b6bbc72ed2e6b577aa353890813f4e855edbae8f007d7f3ea135a` | PASS |
| `public/icons/thesishs-192.png` | `97b0f0024a54ec2f06d5f461216f4e0bc7cccd53dc515e997d18d736d9527111` | PASS |
| `public/icons/thesishs-512.png` | `06d4d96daaa994344b3a6cb4617c7bbb689daf6549712a2f646e393143de601f` | PASS |
| `public/icons/thesishs-apple-180.png` | `8ac0dbe411805d57023aaf3839c436eb5c7d4d4361ea6e02e14597f3606467c3` | PASS |
| `tests/phase9-pwa.browser.cjs` | `9946c074209e7ece658179f91a25a316d9f8a7f75a86ec1e6f53542dfaf5669f` | PASS |
| `docs/VISUAL_V15B_DASHBOARD_BRANDING.md` | `a07d8a622d71742d8173ba727a8d1984ae62e3d46eeaf69e67d39363c8efc2cc` | PASS |
| `docs/VISUAL_V15C_PWA_IDENTITY.md` | `70e6497606f41d53d1a49c4017664172a6e3435a7b9972db6d450d756d09df85` | PASS |
| `scripts/groq-developer-test.cjs` | `59f684334a9782b812351b41ad6c98f573e30acf6a366ba3e424f64bdb5f017c` | PASS |
| `tests/ai-p212-developer-groq.unit.cjs` | `cb9b4e2bd582dadbcab1049540b09e6d3a61fadd81ccf6de16324b0e59f63a35` | PASS |

| Authorized dependency path | Before SHA-256 | After SHA-256 |
| --- | --- | --- |
| `package-lock.json` | `8416829f77c10c75e90783c9165a9c78100c6730632a25a55cbdbe4d1aade07c` | `f4267caf97fd6d16baee90be31b4c70dfeb9d9f608cbedf5d0a4a16648fc35ae` |
| `package.json` | `9b942f624d289eb72b6866b897c347df5837168069ce6cac88cacdd631ff99a0` | `bab7dc360c7c21ab068355057fa28fe2cb42becadf7302fded146a94fc6b545d` |

Baseline inventory and final machine-readable comparison: `test-results/sec-next16-p1/baseline.json` and `preservation.json`. Existing V1.5B/C evidence directories remain intact; the browser fixtures were copied into this checkpoint's ignored folder before rerunning.

## Reused evidence, remaining limitations and closure

Existing build/fixture procedures and source snapshots were reused as procedures/fixtures, but every PASS in the validation table was executed on installed Next 16.4.6 during patch implementation and is reused for this closure. Earlier owner-reported local/hosted/device acceptances retain their original provenance and scope; none is reclassified as newly agent-verified. No previous Preview deployment status was refreshed or inferred from these local results.

The database-backed `tests/phase9-pwa.browser.cjs` was inspected and preserved, but not executed: it loads local database accounts and starts the main application. Authenticated real-account workflows, database/Storage integration, real email, AI providers, full Server Action transport with live accounts, physical/installed PWA behavior, Safari/Windows shell icon refresh, Turbopack runtime and hosted/Production acceptance remain **NOT TESTED in this checkpoint**. The webpack build follows the established isolated production-build procedure; default Turbopack production compilation was not separately run. Remaining development advisories require separately scoped review.

**Owner-accepted closure: SEC-Next16-P1 PASS / CLOSED for the validated local scope**, with the development-advisory and authenticated/device/hosted coverage limits above. The one authorized local security commit excludes all 16 protected pending files; closure SHA-256 evidence is retained in `test-results/sec-next16-p1/closure-before.json` and `closure-after.json`. This patch has not reached Preview or Production. A future publication needs separate explicit push/deployment authorization, reviewed exact file scope, pinned Git/target safeguards and focused protected-Preview acceptance under the two-prompt playbook. Existing pending V1.5B/C and other work stays unstaged and uncommitted; no automatic V1.5D or operational AI testing follows.
