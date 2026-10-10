# Phase 8.3 - Admin AI Administrative Report Interpretation Design

Date: 2026-10-09. Status: design proposal complete; owner decisions pending.
Scope: documentation only. Groq API Free tier is the approved candidate provider, not authorized for activation. No provider implementation, calls, credentials, dependencies or migrations.

## Verified reporting and smallest scope

An optional Interpret overview button at /dashboard/admin/reports explains approximate system-wide volume, not individual people, academic quality or performance. Existing exact reports and the Phase 8.2 static guide remain unchanged and usable without AI.

Inspected app/dashboard/admin/reports/page.tsx, lib/services/dashboard.service.ts, lib/repositories/dashboard.repository.ts and countPublishedResearch in lib/repositories/repository.repository.ts:

| Existing metric | Verified meaning | Initial provider allowlist |
|---|---|---|
| totalUsers | All accounts, including inactive | Coarsened band only |
| totalGroups | All research groups, including archived | Coarsened band only |
| totalResearchPapers | All research papers, not submission versions | Coarsened band only |
| totalPublishedPapers | Distinct published papers with Approved paper status and an approved submission, using existing discovery eligibility | Coarsened band only, additional suppression below |
| usersByRole, totalStudents, totalAdvisers | Admin/Adviser/Student/Panel/Other counts; scalar counts duplicate the breakdown | Withheld entirely in initial scope |
| papersByStatus | Draft/In Review/Revision Required/Approved/Other paper counts | Withheld entirely in initial scope; Approved count may be used locally for suppression |
| Recent activities | Latest five event IDs, action strings and timestamps; incomplete audit stream | Excluded entirely, including derived event counts |

No new active-user, submission-workload, category, strand, school-year, time-range, trend, turnaround-time or quality metrics. Separate current reads are not a historical or transaction-consistent snapshot. Explain only available bands and these fixed definitions.

## Independent Admin and adult eligibility gate

On each action, derive identity from getSession; require a positive safe user ID and Admin session role. Independently call existing findUserById and require active account and current Admin database role matching the session. Deny Student, Adviser, Panel, unknown roles, stale claims, missing/inactive accounts and verification failures before aggregation/provider work. requireRole is only the page gate.

There is no adult verification mechanism in db/schema/users.ts or inspected auth/guide code. Proposed pilot: an institution-controlled server-only eligibility registry, maintained through a restricted deployment process by a designated verifier independent of the requesting Admin. Verify adulthood from trusted institutional records outside the app; no self-attestation, role inference, browser flags, JWT age claims or client DOB. Recommend 18+ as a proposed minimum plus any higher applicable provider/institution requirement; owner must verify the actual terms.

Registry entries contain internal account binding, verified-adult/approved status, trusted verification provenance, expiry and revocation state; no DOB or identity-document copies in this app. Proposed reapproval interval: 90 days. Accounts not explicitly approved fail closed. Reviewer cannot self-approve eligibility. Read current eligibility server-side before every request and recheck active role/eligibility before delivering results. Registry integrity, restricted write access and revocation propagation are mandatory. Registry/user identifiers never reach Groq.

No database schema change is proposed for this pilot. If the registry cannot be securely governed or larger-scale verification needs persistence, design a separately approved eligibility mechanism before activation; do not silently add a table or assume adult status.

## Privacy-safe aggregation and small counts

A trusted server service obtains existing report aggregates through reporting services/repositories. It never spreads a dashboard result into a provider request: construct a new allowlisted DTO with Zod-validated nonnegative safe integers locally, then suppress and coarsen. No raw user/paper/submission/activity rows are queried for this feature. Authorization-user rows stay solely inside the auth boundary.

Proposed threshold k=5: values 0-4 are withheld, including zero. Values >=5 become fixed bands 5-9, 10-19, 20-49, 50-99, 100-199, 200-499, 500-999, 1000+. Never send exact counts, percentages, denominators, group labels or underlying IDs. Provider metrics have only known metric keys and an allowlisted band; absent keys mean withheld/unavailable without revealing the suppression reason.

For published papers, use existing local Approved-paper count and paper total to also withhold the published band when approved-but-not-published or all-papers-minus-published is below five (including zero). Reject inconsistent totals, such as published > Approved or Approved > total papers. These differences are privacy checks only; neither they nor Approved counts are transmitted. No inferred subgroup breakdown is permitted. If a needed check fails, withhold the affected family; if report reads fail or no bands survive, return local fallback without Groq.

Avoid complementary reconstruction by excluding role/status partitions and exact totals together. No arbitrary filters or cohort selection. Share one minimized payload per deployment per UTC day (TTL <=24 hours), reused across eligible Admins; replace only at the next scheduled day, with no user-controlled refresh. Cache only minimized bands, not source counts or identifiers; show collection time locally, never send it to Groq. Initial generation should use a read-only consistent aggregate snapshot through existing repository queries, without changing the existing report page semantics; if unavailable/inconsistent, fail closed.

Bands, suppression and reduced refresh frequency mitigate disclosure, but do not provide formal anonymization or differential privacy. Day-to-day changes and outside knowledge can still reveal information. Owner must accept this risk for school aggregates; if unacceptable, retain local-only interpretation.

## Fixed request and provider boundary

Client request: strict object { reportId: "admin-overview-v1" }; reject all extra keys. No client metrics, prompts, history, identity, eligibility assertions, dates, filters, URLs or model choice.

Server payload: versioned strict object containing only reportKind, known metric-band entries and fixed metric definitions. It contains no names, emails, account/paper/group IDs, school/deployment identity, titles, abstracts, feedback, PDF text, activity strings/timestamps, secrets, signed URLs or source records. No suppression-specific reasons or raw exceptions.

A server-only Groq gateway accepts only this validated DTO, never database/storage clients or authenticated user context. Use a fixed server prompt: explain provided bands and definitions; state that withheld data is unavailable; no trends, causes, rankings or decisions. No conversation memory, file attachments, browsing, arbitrary URL retrieval, tools or function calling.

Use only an owner-approved official Groq API endpoint/model allowlist; fixed endpoint, reject redirects, bounded response and 10-second timeout, no automatic retry. A future server-only GROQ_API_KEY must never use NEXT_PUBLIC_ or appear in URLs/logs. No keys or SDK are configured now. ADMIN_AI_REPORT_ENABLED defaults false, independently of the existing guide flag; absent configuration/approval/eligibility/quotas keeps AI disabled in every environment. Deployment egress controls should restrict the gateway to the approved endpoint where supported; app-level allowlists are not a network firewall.

Groq Free tier selection does not verify current age/privacy/retention/training terms, supported model, token quotas, availability or billing behavior. Verify these before integration and avoid automatic paid upgrade or provider switching.

## Outputs, fallback and limits

Permit plain-language explanations of current approximate volume and definitions only. Prohibit academic grading, approval/rejection, official feedback, staffing/account/group actions, publication decisions, user rankings, predictions, trend claims and causal explanations. Do not interpret missing/suppressed values as zero or inactivity.

Strict output contract: bounded overview text (<=800 characters), up to four short explanations referencing only provided metric keys (<=300 characters each), and an optional insufficient-data signal. Validate schema and references; render escaped plain text only. No generated links, HTML, markdown actions or database writes. Locally append fixed labels: AI-generated, supplementary, coarsened snapshot, and no historical trends. Show the reviewed metric definitions alongside the output. Structure checks cannot guarantee factual fidelity; adversarial/manual review is required before enablement.

Disabled, ineligible, quota exceeded, suppression, timeout/429/5xx/network errors or malformed output: no auto-retry; retain the exact Admin Reports and show reviewed static metric definitions with an unavailable message. Failure output contains no provider/raw database details. Clear any previous generated explanation when a new request fails; never substitute stale output silently. No generated-response persistence or browser storage.

Proposed ceilings: 3 attempts per eligible Admin/day, 10 total/day per deployment, 120-second cooldown, one active request per Admin and one active provider request per deployment. Reserve counters atomically before calls; failures consume attempts. Bound outgoing payload to 4 KiB and configure a small supported output-token cap (target 400; validate total model token accounting). These are application ceilings, not claims about Groq's actual free-tier allowance.

Shared TTL counters/locks and minimized daily payload cache are required for multi-instance production. Reuse approved shared infrastructure if available; none is confirmed. In-memory controls are local-pilot only and cannot enforce production quotas. Fail closed on limiter failure. Safe logs: error category, duration, success/fallback counts only; no identities, snapshots, prompts, generated text, headers, keys or raw provider errors.

## Proposed architecture (files not created)

Next.js Admin Reports UI -> Server Action -> strict Zod -> trusted Admin authorization/eligibility/aggregation service -> existing repositories -> Drizzle; service -> minimized DTO -> isolated Groq gateway. Provider has no repository imports or tools.

- app/dashboard/admin/reports/AdminReportInterpretation.tsx: optional button, pending state, reviewed definitions, labels and fallback.
- lib/actions/admin-ai-report.action.ts; lib/validations/admin-ai-report.ts; types/admin-ai-report.ts: fixed action and strict request/payload/output contracts.
- lib/services/admin-ai-report.service.ts: gates, aggregate snapshot, suppression, quotas and safe results.
- lib/auth/adult-eligibility.ts: trusted server-only registry adapter; independent of role claims.
- lib/repositories/dashboard.repository.ts: reuse only existing aggregate queries in a read-only consistent snapshot if needed; repository countPublishedResearch preserves existing eligibility. No raw-record repository for AI.
- lib/ai/admin-report-policy.ts, groq-provider.ts, admin-report-usage.ts: metric policy, isolated gateway, approved shared limiter/cache boundary.

This is future implementation planning only. Leave Phase 7 and Phase 8.2 code unchanged. Read installed Next.js guides before coding. No schema/migration/dependency required by this design; any eligibility/shared-store change requires separate approval.

## Proposed security tests and unresolved decisions

Before activation, test direct action calls for anonymous/non-Admin/inactive/stale/missing accounts; valid Admin without adult verification, self-attestation, expired/revoked/untrusted/mismatched registry entries; assert zero aggregation/provider calls on denial. Test extra keys, injected prompts/URLs/metrics, invalid counts and exact outgoing allowlist.

Cover k-1/k boundaries, zero, subset/complement suppression, inconsistent snapshots, all-withheld fallback, no raw/identifying payload/log output, and daily cache reuse/no refresh bypass. Test disabled flag and missing config, shared counter concurrency/restart across instances, limiter failure, timeout/429/5xx/redirect/oversized/malformed response, unknown metric references and unsafe generated text. Browser-test eligible/ineligible Admin controls and local fallback; confirm Student guide remains static and no workflow changes. Verify gateway cannot import DB/storage or expose tools. Live-provider fidelity/terms checks require later explicit approval.

Owner decisions: approve this four-metric band-only allowlist; k=5, bands/complement rules and daily cadence; institutional adult verifier/registry/expiry/revocation governance; Groq current endpoint/model/age/data processing and Free-tier quotas/billing controls; shared infrastructure/egress support; accept residual inference/hallucination risk; authorize implementation separately.

Evidence: source/Git inspection only; feature/development at ca95fd3. Existing Phase 8 edits and SOURCE_OF_TRUTH_UPDATED.md changes preserved. No application tests/build/provider requests run. Only git diff --check is run for this design checkpoint.
