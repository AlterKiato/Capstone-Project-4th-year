# Phase 8.4 - Adviser AI Workflow Assistant Design

Date: 2026-10-09. Status: design proposal complete; owner decisions pending.
Documentation only. Groq API Free tier is the approved candidate; integration and activation remain disabled. Preserve existing Adviser review workflows and Student static guidance.

## Verified source and metric definitions

Inspected Adviser submissions page, adviser-submission.service.ts/repository.ts, adviser-review.service.ts, adviser-feedback.service.ts, research-group.repository.ts and submission-status constants.

There is **no existing Adviser aggregate-count API**. The page uses getAdviserSubmissions and a submission-version list, including private names, titles, remarks and storage paths. Do not pass that list to the assistant or count private records in a provider module. A future aggregate-only repository query can count the same authorized rows using existing schema/statuses; it is proposed, not implemented or runtime-verified.

findResearchGroupsByAdviserId scopes by current group owner and does not exclude archived groups. Listing includes all submission versions; no latest-version-per-paper restriction exists. Match that scope without introducing filters.

| Proposed minimal metric | Exact local definition from existing fields | Provider representation |
|---|---|---|
| recordedSubmissionVersions | Number of submission rows whose paper belongs to a currently Adviser-owned group | Coarsened band, only if privacy checks pass |
| recordedSubmittedVersions | Same scope, submission.status = Submitted | Coarsened band, subject to subset/complement checks |
| recordedUnderReviewVersions | Same scope, submission.status = Under Review | Coarsened band, subject to subset/complement checks |

These describe recorded version states, not distinct papers, Students, active projects, latest-version backlog, review speed or academic outcomes. Do not infer workload priority from them. Never transmit Revision Required/Approved breakdowns, approval rates, individual/group counts, group names, notifications, feedback, dates, turnaround times, comparisons, trends or rankings. Unknown status values remain in total/complement locally, with no free-text status labels sent.

## Authorization and trusted aggregation

Each action derives the verified session user ID; independently findUserById must confirm an active Adviser account and current database role matching the session. Reject anonymous, Admin, Student, Panel, missing/inactive/stale accounts before aggregate/provider work. Existing Adviser submission/review services verify role but do not establish adult eligibility or consistently check isActive; do not treat them as the complete AI authorization gate and do not modify them in this task.

Reuse Phase 8.3's proposed institution-controlled, server-only adult eligibility registry: independent trusted verifier, account binding, approval/provenance, expiry/revocation, no self-approval or client/JWT age assertions. Proposed minimum 18+ plus applicable institution/provider requirements, with 90-day reapproval; exact terms/governance await approval. Registry integrity/write restrictions and timely revocation are activation gates. No DOB/identity-document copies or registry identifiers go to Groq.

Ownership is a server-side SQL predicate on researchGroups.adviserId = verified session user ID, through submissions -> researchPapers -> researchGroups. Preserve existing listing join semantics where necessary, but select only aggregates; no names or raw records. Never accept adviserId, groupId, paperId or group-ID lists from the client. No owner groups means static procedural guidance only. Use one read-only consistent snapshot for counts and privacy guards; do not obtain counts through an unscoped query then filter after retrieval.

Recheck active role/adult eligibility and scope before provider invocation and before returning an interpretation. Daily cache keys must be privately Adviser-scoped; never share another Adviser's payload/output. Ownership/group-paper membership changes invalidate the cached cohort immediately. A future repository can return an internal keyed fingerprint of the authorized group/paper membership (aggregated, not raw identifiers) for comparison; it never reaches Groq. If reliable scope validation/invalidation is unavailable or fails, deny AI and retain static guidance. On scope change, do not regenerate multiple cohorts in one day; wait for the next scheduled snapshot. A later ownership change cannot retract information already sent to the provider; this residual race must be acknowledged.

## k=5 privacy policy and small groups

Trusted aggregation produces only counts and local privacy guards; SQL COUNT DISTINCT on submitter/paper IDs yields guard counts without returning the IDs. Schema identifiers stay inside trusted authorization/aggregation and are never included in the provider DTO.

Require at least five distinct submitting accounts AND five distinct papers in the entire scoped cohort before any metric can be sent. Five versions from one Student/paper do not qualify; several Students collaborating on one paper do not qualify either. Each transmitted status subset must independently satisfy both guards. Its complementary cohort must also have at least five distinct submitters and papers; assess the residual after both Submitted and Under Review if both are candidates. If that residual fails, withhold both subset metrics rather than revealing a small complement. Never disclose exact totals alongside partitions.

Withhold counts 0-4, including zero. Eligible counts become Phase 8.3 bands only: 5-9, 10-19, 20-49, 50-99, 100-199, 200-499, 500-999, 1000+. No exact values, percentages, cohort labels, IDs, timestamps or detailed suppression reasons. Validate all local counts as nonnegative safe integers, subsets <= total and disjoint subset sum <= total; invalid snapshot or guard failure means fallback/withholding.

Combine all owned groups without per-group, per-Student, school-year, strand, date or other arbitrary slicing. Store only one minimized daily payload per Adviser per UTC day (<=24-hour TTL); no user refresh or history. Private scope-validation metadata stays server-side and contains no exported raw records. Small/no cohorts or all-withheld metrics produce static fallback with **zero Groq calls**. Procedural questions always use canonical static answers, even for large cohorts; no need to send an empty-data prompt.

This conservative policy may leave many capstone Advisers with static guidance only. k=5 and bands mitigate disclosure but do not provide formal anonymization: overlapping contributors, repeated snapshots and outside knowledge can still support inference. If residual risk is unacceptable, keep interpretation entirely local.

## Fixed interactions, payload and procedural limits

Proposed optional panel on /dashboard/adviser/submissions with four predefined buttons:

- adviser-workflow-overview-v1: optional interpretation of the three eligible aggregate bands.
- adviser-start-review-v1: static steps for selecting an owned Submitted version and starting review; the submission becomes Under Review.
- adviser-record-decision-v1: static steps for opening an owned Under Review submission and manually entering feedback with Revision Required or Approved.
- adviser-revision-history-v1: static explanation of version-specific feedback, preserved history and next-version submission after Revision Required.

Strict Zod request: { topicId: one of the four exact IDs }; reject every extra key. No free-text field, prompts, history, record selection, filters, URLs, model choice or client metrics. Server-created links only: /dashboard/adviser/submissions, /dashboard/adviser/groups, /dashboard/adviser/notifications and /dashboard/guide. No model-generated URLs or guessed submission IDs.

Static procedural answers require existing active-account/role authorization, but no adult-provider entitlement; never invoke Groq for them. Only optional aggregate AI interpretation requires independent adult approval. Keep Student /dashboard/guide provider-independent.

Provider DTO: strict version/reportKind/topicId constants, up to three known metric keys with allowlisted bands, fixed semantic definitions and reviewed interpretive constraints. No Adviser/school/group/student identifiers, names, research titles/abstracts/text, remarks, feedback, PDFs, paths/signed URLs, dates, raw rows or adult verification metadata. Construct the DTO from scratch; never spread an application result. The provider cannot query PostgreSQL, Supabase or the application.

AI may explain approximate recorded version volume and the distinction between Submitted and Under Review using only supplied facts. It may not suggest academic decisions, produce official feedback, grade/assess content, rank Students/Advisers, infer performance/causes/trends, select cases, set deadlines or mutate research/notifications. Human review remains entirely in existing forms/services.

Output: strict bounded overview text (<=800 characters), up to three explanations keyed only to supplied metrics (<=300 characters each), optional insufficient-data signal. Render escaped plain text; no HTML, markdown actions, generated links or executable instructions. Locally append AI-generated/supplementary/coarsened snapshot labels and canonical procedural steps. Missing metrics never mean zero. Validate shape/references and manually evaluate fidelity; schema/prompt checks cannot prove absence of hallucinations.

## Shared disabled provider boundary, limits and fallback

Reuse Phase 8.3's planned server-only Groq gateway: fixed approved endpoint/model, no tools/function calling/browsing, no DB/storage imports/clients, no arbitrary URLs, reject redirects, 10-second timeout, bounded payload (<=4 KiB)/response, target output-token cap 400 after model accounting review, no retry or alternative-provider/paid-tier fallback. No implementation, credentials, SDK or network calls now.

ADVISER_AI_WORKFLOW_ENABLED defaults false independently of Admin and guide flags. Provider, adult eligibility, privacy policy and operational approvals must all be satisfied before enabling. Verify current Groq age/privacy/retention/training/model/Free-tier quota/billing terms; candidate approval is not activation permission. Apply deployment egress restrictions where supported; application allowlists alone are not a firewall.

Share usage controls across future Admin and Adviser AI: 3 attempts per eligible account/day across AI features, 10 total/day per deployment across both roles, 120-second per-account cooldown, one active request/account and one provider request/deployment. Atomic shared TTL counters/locks reserve before calls and count failures. Static answers do not consume provider quota. In-memory controls are local-pilot only, never sufficient for Vercel multi-instance production. This extends the Admin design's deployment ceiling to include Adviser calls; owner must approve the combined budget.

On disabled/ineligible/no groups/suppression/cache or limiter failure/timeout/429/5xx/malformed output, return canonical procedural guidance and a neutral unavailable message; zero provider calls when a precondition fails. Clear prior generated output on failed requests. No response persistence/localStorage or auto-refresh/retry. Log only safe status category, duration and aggregate success/fallback totals; never identities, payloads, answers, raw errors or secrets. Ordinary submission lists and manual reviews continue unchanged.

## Proposed architecture and security tests

Next.js panel -> Server Action -> strict Zod -> trusted authorization/eligibility/aggregation service -> aggregate-only repository -> Drizzle; service -> minimized DTO -> shared isolated Groq gateway. Repository accesses authorized data; provider modules never do.

Proposed files, not created: AdviserWorkflowAssistant.tsx beside the Adviser submissions page; lib/actions/adviser-ai-workflow.action.ts; lib/validations/adviser-ai-workflow.ts; lib/services/adviser-ai-workflow.service.ts; types/adviser-ai-workflow.ts; an aggregate-only method in lib/repositories/adviser-submission.repository.ts; reviewed policy/static topics in lib/ai/adviser-workflow-policy.ts. Reuse proposed adult-eligibility, Groq and shared usage boundaries from Phase 8.3 rather than implement parallel gateways. No schema/dependency needed by this proposal; eligibility/shared infrastructure require separate approval. Read installed Next.js guidance before any coding.

Future tests:

- All role/account/adult gate denials, expired/revoked/self-asserted/mismatched verification; no aggregate/provider calls before required authorization.
- Two Advisers with overlapping-looking fixtures: exact owner predicate, no foreign groups, empty scope, archived groups, group/paper reassignment and cache isolation/invalidation; reauthorization before response.
- Counts match the existing authorized submission-version list, including historical versions; never silently claim latest-paper backlog. No private row projections or feedback/document dependencies.
- k-1/k boundaries, zero, repeated versions from one contributor, multi-author single paper, subset/complement/residual suppression, inconsistent counts, all-withheld fallback and daily-cache no-refresh behavior.
- Strict IDs and extra-field injection, forged identities/URLs/filters/metrics; outgoing DTO allowlist, disabled flags, combined Admin/Adviser quotas and concurrent reservations across instances.
- Provider failure/redirect/oversized/malformed output, wrong metric references, fabricated decisions/links, safe logs/rendering. Static topics and small cohorts make no provider call.
- Browser preserves Student static guide and Adviser manual review/version/feedback behavior. Generated interpretation remains optional; no write actions or external tools. Live fidelity/provider checks require explicit later approval.

Owner decisions: three proposed version-state metrics and historical semantics; five-distinct-contributor AND five-distinct-paper guards/complements and bands; expected prevalence of static fallback; adult verifier/registry governance and revocation; cache scope validation; combined quotas/shared infrastructure/egress; actual Groq terms/model; acceptance of residual inference/hallucination risk. Provider integration is a separate start/activation gate.

Evidence: source inspection only; feature/development at ca95fd3. Existing Phase 8.2 work, Admin design and owner-updated Source of Truth preserved. No counts executed or tests/build/provider requests run. Validation for this documentation checkpoint: git diff --check only.
