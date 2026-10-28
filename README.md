# ThesiSHS AI

ThesiSHS AI is a Senior High School research management and repository system. It organizes groups and papers, preserves submission/revision history, supports Adviser review and feedback, and provides authenticated access to approved research. Admin tools support account, group, publication and reporting workflows.

## Platform and architecture

Next.js App Router, React and TypeScript provide the online-first PWA for Web, Mobile browsers and initial Desktop use. PostgreSQL and Drizzle store academic records; private Supabase Storage holds PDFs. Custom bcrypt/JWT authentication uses HTTP-only cookies and server-side checks of current account status, role and ownership.

The layers are UI/pages -> Server Actions -> Zod validation -> services -> repositories -> Drizzle -> PostgreSQL. Business rules and authorization belong in services; hiding controls does not authorize an operation.

The implemented direct-upload flow transfers PDFs from the browser to private Supabase staging, then separately validates and finalizes submissions server-side. Migration 0014 and approved environment preparation are verified; the bucket is private, PDF-only and exactly 10 MiB. Hosted synthetic Student/Adviser acceptance is owner-reported PASS (19/19), and the four-request read-only Storage check passed its tested methods. Protected Preview is accepted for controlled synthetic testing with deferred hosted security gates; production is not deployed. Expo/Electron remain deferred. Physical PWA installation remains unverified, and private documents are not cached offline.

## Roles and implemented functionality

- **Student:** registration/login, assigned-group access, multiple research projects per group, project selection, PDF submissions/revisions, version/feedback history and in-app notifications. A Student belongs to at most one active group.
- **Adviser:** own-group management, manual Student assignment/removal, submission review, revision/approval decisions, feedback and in-app notifications.
- **Admin:** account/role/status management, group oversight, approved-research publication, dashboards and read-only reporting.
- **Published repository:** authenticated search/filter/pagination, approved research details, authorized PDF view/download. Requested signed-download TTL is 300 seconds; issued capabilities can outlive application access revocation, and hosted expiry enforcement remains unverified.
- **Role-aware assistance:** static Student guidance and local/static Admin/Adviser foundations; fictional mock aggregate interpretation is historical test evidence only.

Panel exists as a role and may access eligible published repository documents; Panel Evaluation is excluded unless reopened by the owner. Existing versions and feedback are preserved. The direct-upload workflow has owner-reported hosted synthetic acceptance; this does not establish every provider capability, authorization or expiry boundary.

## AI status

The official project name remains **ThesiSHS AI**. Groq is hard-disabled; no operational generative provider integration is deployed. Student guidance stays static. Adult eligibility, consent and privacy safeguards remain required for any separately approved provider activation. Generative guidance and research summarization are retired from active scope; AI does not make academic decisions.

## Development progress

Phase 10.2E closure (2026-10-28), `feature/development`, base HEAD `977f785fe9c39519ec81a1321c3cf1fbc681e78e`: **PHASE 10.2E — ACCEPTED FOR CONTROLLED PREVIEW TESTING, WITH DEFERRED HOSTED SECURITY GATES.** Protected Vercel project `thesishs-ai` remains Preview; `main` is reserved for undeployed Production. Existing evidence records Vercel Authentication, Singapore functions (`sin1`) and verified-TLS Session Pooler configuration. Actual synthetic fixture: `PreviewGroup` (group ID 1), research project ID 1. See the [closure and retained gates](docs/MASTER_CONTEXT_UPDATED.md#phase-102e-closure-and-handoff-2026-10-28).

| Phase | Status |
|---|---|
| 0-7: foundation, auth, research, review, repository, discovery, administration | Completed for documented scope |
| 8: assistance | Provisionally complete for static/mock-only scope; provider disabled |
| 9: UI/PWA | PASS WITH DOCUMENTED LIMITATIONS; owner manual 11 PASS, 0 FAIL, not rerun by Codex |
| 10.1: authentication/security preparation | Implemented and locally validated; production gates remain |
| 10.2A: production preflight | Read-only preflight completed; infrastructure not provisioned |
| 10.2B: database foundation / secure Admin bootstrap | Implemented and locally validated; production execution pending |
| 10.2C: direct private PDF upload | Implemented; isolated tests retained; hosted synthetic workflow owner-reported PASS; provider security gates deferred |
| 0014 / 10.2C.3: minimal environment preparation | Local 0014, distinct operator/private recovery and private PDF-only exact-10-MiB bucket preparation verified; do not replay |
| 10.2D / 10.2E: Preview preparation / deployment | Accepted for controlled Preview testing with deferred hosted security gates |
| 10.4: owner-led Preview manual acceptance | Admin PASS and Student/Adviser 19/19 PASS (owner-reported); four Storage GETs PASS; physical PWA and other unexecuted checks remain open |
| Production readiness / release | Pending; release requires separate authorization |
| Native Mobile / Electron | Deferred; no integration implemented |

Retained local PASS results and owner-reported hosted workflows have distinct scopes. The four hosted Storage GETs do not prove application authorization, signed-upload isolation or expiry enforcement. CI remains deferred.

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

The owner reports PASS for synthetic Admin login/session/navigation and 19/19 Student/Adviser workflow checks: project creation, PDF v1 submission, Adviser document access/revision feedback, PDF v2 resubmission and preserved earlier version/feedback. Codex did not independently run those browser checks. 10.2E.5F reused the existing PDF: signed 206, unsigned public/authenticated-variant/ordinary 400, four GETs, zero writes or database connections. The authenticated variant carried no credentials; it was not a signed-in Storage-user test. Historical timing samples are not load-test evidence. The recommended next activity is separately approved, owner-led physical PWA installation/standalone/session validation on protected Preview using existing synthetic accounts.

Prefer focused security/regression checks and appropriate lint, TypeScript, build and migration-integrity checks. Necessary browser automation should be sequential, bounded and limited in concurrency; stop after significant infrastructure failure. Extensive Playwright matrices, repeated full-system runs, large fixtures, parallel browser sessions, demo-stage load testing and new generalized frameworks are deferred. Preserve useful tests/tools. Extensive concurrency, reliability and load validation may still be required before genuine production use.

The authoritative sequence/gates are in the [Master Context roadmap](docs/MASTER_CONTEXT_UPDATED.md#approved-phase-10-roadmap-2026-10-22), with durable decisions in the [Source of Truth](docs/SOURCE_OF_TRUTH_UPDATED.md#approved-preview-first-deployment-and-testing-decision-2026-10-22).

## Current limitations

Controlled Preview acceptance is limited to approved synthetic accounts/documents; Phase 10 remains open. It does not permit public production release, real Student research data, unrestricted users or comprehensive hosted-security claims. Hosted anonymous document-action denial, cross-group isolation, signed-upload path isolation, capability expiry and Storage policy review remain NOT VERIFIED, deferred by the owner to production readiness. 10.2E.5H was blocked before any hosted POST: no verified current-deployment action template, Vercel protection ahead of the application, and no established submission ID. This was not failed application authorization. Application upload intents expire after 15 minutes; provider upload capabilities last approximately two hours under the documented contract and can outlive cancellation/intent expiry; finalization rechecks authorization/validity. Requested download TTL is 300 seconds. Physical PWA, broader reliability and other unexecuted acceptance remain open. Stage 1 verification is implemented and optional; mandatory verification, real email, AI activation and native integration remain deferred. Groq stays hard-disabled.

## Documentation and handoff

- [Source of Truth](docs/SOURCE_OF_TRUTH_UPDATED.md): durable scope, product and security rules.
- [Master Context](docs/MASTER_CONTEXT_UPDATED.md): current status, evidence, blockers and next checkpoint.
- [Architecture](docs/ARCHITECTURE_UPDATED.md): layers and authentication/Storage boundaries.
- [Database reference](docs/DATABASE%20%281%29.md): schema, migration history and guarded operations.
- [AGENTS.md](AGENTS.md): contributor instructions and handoff precedence.
- [Research Before Implementation Policy](docs/SOURCE_OF_TRUTH_UPDATED.md#research-before-implementation-policy-owner-decision-2026-10-27): proportional research, source priority, GitHub/license evaluation and evidence reporting for future development.
- [DESIGN.md](DESIGN.md) and [ANTISLOP.md](ANTISLOP.md): approved UI direction and design filter; attribution remains in [ANTISLOP.LICENSE](ANTISLOP.LICENSE).

Read current handoffs and actual source before relying on historical phase labels. Preserve academic history, ownership rules, multiple projects per group and private Storage. No roadmap entry alone authorizes database/Storage mutations, email/AI activation, deployment, staging, commits or pushes.
