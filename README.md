# ThesiSHS AI

ThesiSHS AI is a Senior High School research management and repository system. It organizes groups and papers, preserves submission/revision history, supports Adviser review and feedback, and provides authenticated access to approved research. Admin tools support account, group, publication and reporting workflows.

## Platform and architecture

Next.js App Router, React and TypeScript provide the online-first PWA for Web, Mobile browsers and initial Desktop use. PostgreSQL and Drizzle store academic records; private Supabase Storage holds PDFs. Custom bcrypt/JWT authentication uses HTTP-only cookies and server-side checks of current account status, role and ownership.

The layers are UI/pages -> Server Actions -> Zod validation -> services -> repositories -> Drizzle -> PostgreSQL. Business rules and authorization belong in services; hiding controls does not authorize an operation.

The implemented direct-upload flow transfers the PDF from the browser to private Supabase staging, then separately asks the server to validate and finalize a submission. Migration 0014 is applied and verified on the approved local test database. The development/test bucket is private, PDF-only and limited to exactly 10 MiB; live PDF/Storage acceptance remains pending. Protected Vercel Preview is online with owner-reported Admin acceptance; production is not deployed. Expo integration is deferred; Electron needs separately justified capabilities and authorization. Physical PWA installation remains unverified, and private documents are not cached offline.

## Roles and implemented functionality

- **Student:** registration/login, assigned-group access, multiple research projects per group, project selection, PDF submissions/revisions, version/feedback history and in-app notifications. A Student belongs to at most one active group.
- **Adviser:** own-group management, manual Student assignment/removal, submission review, revision/approval decisions, feedback and in-app notifications.
- **Admin:** account/role/status management, group oversight, approved-research publication, dashboards and read-only reporting.
- **Published repository:** authenticated search/filter/pagination, approved research details, authorized PDF view/download. Private signed document links last 300 seconds and can outlive revocation until expiry.
- **Role-aware assistance:** static Student guidance and local/static Admin/Adviser foundations; fictional mock aggregate interpretation is historical test evidence only.

Panel exists as a role and may access eligible published repository documents; Panel Evaluation is excluded unless reopened by the owner. Existing versions and feedback are preserved. The new direct-upload transport is implemented but pending live validation; earlier core workflow acceptance does not establish its hosted readiness.

## AI status

The official project name remains **ThesiSHS AI**. Groq is hard-disabled; no operational generative provider integration is deployed. Student guidance stays static. Adult eligibility, consent and privacy safeguards remain required for any separately approved provider activation. Generative guidance and research summarization are retired from active scope; AI does not make academic decisions.

## Development progress

Phase 10.2E.3 (2026-10-27): `feature/development`, base HEAD `ea096be44f8a74882787591de444f5423ec14683`. Protected Preview is online for Vercel project `thesishs-ai`; `main` remains reserved for Production. Vercel Authentication is configured according to the owner. Functions now run in Singapore (`sin1`) alongside the regional Supabase PostgreSQL target, using the Session Pooler on port 5432 with verified TLS. Detailed evidence and limitations are in the [current handoff](docs/MASTER_CONTEXT_UPDATED.md#phase-102e3---hosted-preview-admin-acceptance-2026-10-27).

| Phase | Status |
|---|---|
| 0-7: foundation, auth, research, review, repository, discovery, administration | Completed for documented scope |
| 8: assistance | Provisionally complete for static/mock-only scope; provider disabled |
| 9: UI/PWA | PASS WITH DOCUMENTED LIMITATIONS; owner manual 11 PASS, 0 FAIL, not rerun by Codex |
| 10.1: authentication/security preparation | Implemented and locally validated; production gates remain |
| 10.2A: production preflight | Read-only preflight completed; infrastructure not provisioned |
| 10.2B: database foundation / secure Admin bootstrap | Implemented and locally validated; production execution pending |
| 10.2C: direct private PDF upload | Implemented, isolated checks passed; live validation pending |
| 0014 / 10.2C.3: minimal environment preparation | Local 0014 applied/verified; distinct operator and private recovery PASS; development bucket private, PDF-only, exactly 10 MiB; live acceptance pending |
| 10.2D / 10.2E: Preview preparation / deployment | Hosted database preparation verified; protected Preview online, Admin acceptance owner-reported PASS |
| 10.4: owner-led Preview manual acceptance | Admin subset PASS (owner-reported); Student/Adviser and PDF/Storage checks pending |
| Production readiness / release | Pending; release requires separate authorization |
| Native Mobile / Electron | Deferred; no integration implemented |

Earlier isolated PASS results remain evidence of those specific checks. They do not establish live upload or the remaining manual Preview workflows. CI remains deferred.

## Local development

Use a Node.js version supported by the installed Next.js release and the checked-in npm lockfile. Read [AGENTS.md](AGENTS.md) before contributing and the relevant installed Next.js guides before code changes.

```sh
git status --short
git branch --show-current
git log -1 --oneline
npm ci
npm run dev
```

Installation is a developer setup instruction, not an action performed in this documentation checkpoint. Configure only an approved isolated development target. Relevant variable names include `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY` and `THESISHS_AUTH_LIMIT_SECRET`. Hosted/shared-limiter configuration also requires database stage, connection mode and target mappings; see the [database reference](docs/DATABASE%20%281%29.md). Never commit environment files, credentials, connection strings or signed capabilities. Supabase privileged credentials remain server-only.

Local verification email can use the existing development-only Mailpit integration (`npm run mailpit:local`); follow its guarded local configuration. Verification is optional during Stage 1; mandatory Student verification and real outbound email are deferred for initial deployment.

Available validation and serving commands, to use as appropriate for an authorized change:

```sh
npm run lint
npx tsc --noEmit
npm run build
npm run start
npx drizzle-kit check
git diff --check
```

`start` serves an already-built application. Drizzle `check` validates migration history offline; it does not apply schema changes. There is no `npm test` script; use relevant existing focused tests.

Database setup is privileged, not an automatic step after installation. `npm run db:seed:roles`, `npm run db:bootstrap:admin` and `npm run db:uploads:cleanup` require their documented operator safeguards; cleanup currently supports read-only dry-run only. Do not run migrations or seeds blindly against an existing database. Direct Drizzle database commands are disabled. Reuse the guarded 0014 runner only after separate approval, a distinct operator, verified target and private recovery evidence; see the [operator preflight](docs/DATABASE%20%281%29.md#minimal-operator-preflight-and-next-action-2026-10-22).

Hosted Preview uses a separate operator-only initializer for a newly verified empty application database; the existing 0014 runner remains local-only. Read the [hosted identity, reservation, privilege and initialization procedure](docs/DATABASE%20%281%29.md#hosted-preview-initialization-and-identity-contract-phase-102d2a-2026-10-23) before setup. No migrations run during build/startup, and no cloud execution is authorized by this implementation.

Hosted runtime and operator connections require server-only `THESISHS_DATABASE_CA_PEM`: one valid, currently in-date CA certificate as multiline PEM, at most 16,384 characters. Obtain approved trust material from the provider; the public test fixture is not an automatic runtime fallback. Certificate/hostname verification stays enabled; local Development behavior is unchanged. See the [R4A trust and provider checkpoint](docs/DATABASE%20%281%29.md#r4a-postgresql-ca-trust-and-data-api-checkpoint-2026-10-23).

## Approved roadmap and testing

**Minimal environment preparation -> Vercel Preview configuration -> Preview deployment -> Owner-led manual acceptance -> Focused corrections -> Production readiness -> Separately approved production release.**

Local preparation completed the private backup/disposable recovery verification, separately approved migration 0014, record-preservation checks and development private PDF-only bucket limited to **10 MiB (10,485,760 bytes)**. Do not repeat these operations automatically. Preview and production database/Storage resources and secrets must remain separate. Reuse explicitly approved synthetic accounts where safe; avoid unnecessary fixtures.

The owner approved existing test Supabase project reuse: local Development PostgreSQL remains separate; hosted PostgreSQL in `cbkplqkkjuoglpimwmib` is the initialized Preview target; Development and Preview share its test Storage trust boundary. Production will receive separate clean resources. R4A disabled the unused Data API and verified persisted configuration and unchanged bucket metadata. REST/RPC probes denied access (401/503), but definitive endpoint-denial verification remains unresolved. Subsequent owner-operated R4B/R4C/R4D checkpoints removed the optional auto-RLS pair and verified dedicated identities, 15 migrations, runtime grants, four canonical roles and one synthetic Admin with password comparison PASS. The owner subsequently configured protected Preview and corrected its runtime connection value after Session Pooler password authentication failed. Private runtime verification passed, and synthetic Admin login succeeded after redeployment; the exact original entry/encoding mistake was not proven. No authentication safeguard was bypassed. Fresh local production-build verification remains separate from this hosted deployment evidence; see the latest Master Context. Do not replay initialization.

The owner reports PASS for synthetic Admin login, expected initial dashboard data, session persistence after refresh, logout, unauthenticated application access protection and Admin navigation/responsiveness. These browser checks were not independently rerun by Codex. Five limited manual request samples averaged about 5.99 seconds before region alignment and 122 milliseconds afterward; this is not load-test or production-performance evidence. Hosted Student/Adviser authentication and workflows, PDF/private-Storage checks and physical PWA behavior remain pending.

Prefer focused security/regression checks and appropriate lint, TypeScript, build and migration-integrity checks. Necessary browser automation should be sequential, bounded and limited in concurrency; stop after significant infrastructure failure. Extensive Playwright matrices, repeated full-system runs, large fixtures, parallel browser sessions, demo-stage load testing and new generalized frameworks are deferred. Preserve useful tests/tools. Extensive concurrency, reliability and load validation may still be required before genuine production use.

The authoritative sequence/gates are in the [Master Context roadmap](docs/MASTER_CONTEXT_UPDATED.md#approved-phase-10-roadmap-2026-10-22), with durable decisions in the [Source of Truth](docs/SOURCE_OF_TRUTH_UPDATED.md#approved-preview-first-deployment-and-testing-decision-2026-10-22).

## Current limitations

Protected Preview is online; production is not deployed and Phase 10 remains open. Local migration 0014 and development bucket metadata are verified; direct upload is IMPLEMENTED, pending live/hosted acceptance. Storage policy catalog audit is NOT VERIFIED and is required before production approval; bucket metadata does not prove policies unchanged. Live signed-upload behavior, anonymous document-access denial and capability isolation from unrelated paths are NOT VERIFIED; independently check the latter two before Preview testing. Broader hosted role/ownership acceptance, CORS, upload duration/memory and concurrency/load reliability remain open. Vercel Authentication configuration and Admin application access checks do not prove every authorization or deployment-protection boundary. Mandatory verification, real email, AI activation and native Mobile integration are deferred. Pending capabilities and validation limits are distinct from confirmed defects.

## Documentation and handoff

- [Source of Truth](docs/SOURCE_OF_TRUTH_UPDATED.md): durable scope, product and security rules.
- [Master Context](docs/MASTER_CONTEXT_UPDATED.md): current status, evidence, blockers and next checkpoint.
- [Architecture](docs/ARCHITECTURE_UPDATED.md): layers and authentication/Storage boundaries.
- [Database reference](docs/DATABASE%20%281%29.md): schema, migration history and guarded operations.
- [AGENTS.md](AGENTS.md): contributor instructions and handoff precedence.
- [Research Before Implementation Policy](docs/SOURCE_OF_TRUTH_UPDATED.md#research-before-implementation-policy-owner-decision-2026-10-27): proportional research, source priority, GitHub/license evaluation and evidence reporting for future development.
- [DESIGN.md](DESIGN.md) and [ANTISLOP.md](ANTISLOP.md): approved UI direction and design filter; attribution remains in [ANTISLOP.LICENSE](ANTISLOP.LICENSE).

Read current handoffs and actual source before relying on historical phase labels. Preserve academic history, ownership rules, multiple projects per group and private Storage. No roadmap entry alone authorizes database/Storage mutations, email/AI activation, deployment, staging, commits or pushes.
