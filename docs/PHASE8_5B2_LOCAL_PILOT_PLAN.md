# Phase 8.5B.2A - Groq Local Pilot Security Preparation

Date: 2026-10-09. **Status: documentation/test plan complete; pilot not implemented or authorized to run live.** This plan does not enable eligibility or Groq. Vercel activation requires a later, separate gate.

## Verified checkpoint

Read AGENTS.md, Source of Truth, Master Context, Phase 8.3/8.4 designs and Phase 8.5B readiness audit. Source of Truth section 11 governs: adult Admin/Adviser aggregate assistance only, Student static guide, Panel excluded. Git: feature/development at ca95fd3; existing changes unstaged/uncommitted, no staged files.

Actual Phase 8.5A source confirms:

- getActiveAIAccount validates session-derived identity, expected session role and active/current database role. Strict request schemas accept only admin-overview-v1 or the four known Adviser topic IDs, rejecting extra fields.
- adult-eligibility.ts denies everyone; groq-provider.ts returns enabled=false/available=false with no flags, credentials, network transport, repositories or storage. UI actions return static/unsupported/unavailable guidance, never aggregate or invoke a provider. UI clears prior output on selection/failure.
- Internal preparation services reauthorize after aggregation but do not establish adult/provider eligibility. Admin uses existing report counts in a read-only repeatable-read snapshot. Adviser SQL binds current group ownership to authenticated Adviser ID, including historical versions/archived owned groups. Role recheck alone does not detect cohort reassignment.
- aggregate-policy.ts validates count relationships, withholds 0-4, bands allowed counts, checks Admin publication complements and Adviser distinct-contributor/paper subset/complement/residual guards. DTO keys are strict and contain no raw identities/research. The DTO schema alone permits empty metrics; the gateway must independently reject empty payloads.
- Existing unit tests cover authorization/strict input/bands/suppression/adult denial/zero fetches; existing SQL acceptance uses the ordinary local development database. **Do not reuse that database or existing user records for this pilot.** Prior test passes are historical; none rerun here. Eligibility, live output contracts, pilot limits, daily cache and ownership invalidation are not implemented.

## Test environment and architecture (proposed)

Default to a standalone, single-process test harness: synthetic session/user repository doubles, literal aggregate fixtures, injected clock and in-process mock transport. No database, Supabase, PDFs, credentials or network required. Test adapters remain under tests and cannot replace application modules via feature flags. Application eligibility/provider stubs remain unchanged and hard-disabled under every flag value.

Preserve the architecture in contract tests: fixed action -> strict Zod -> trusted authorization/eligibility/ownership -> synthetic aggregate repository -> existing minimizer -> strict DTO -> isolated mock gateway -> strict output validation -> role/eligibility/scope recheck -> safe response. Static procedural topics bypass mock generation. Gate failures yield zero aggregate/gateway calls where authorization fails, and zero gateway calls for any failed provider precondition.

A later SQL isolation test may use a dedicated disposable loopback database containing only synthetic records, using the existing schema without migrations. Abort unless the explicit database name and loopback host match the pilot target; reject the normal thesishs_ai database. No seed/cleanup runs are authorized now. Seed no storage objects/PDFs; any required schema metadata is synthetic and never opened. Verify ownership with two synthetic Advisers and foreign/empty/archived scopes. Do not use existing account emails, titles, passwords, dumps or production copies. A future browser pilot binds loopback only, without tunnels or shared hosting.

## Local adult tester approvals (proposed, requires owner approval)

Keep real human approval separate from synthetic age-policy fixtures. A synthetic eligible fixture exercises a branch; it does not verify a human or permit live traffic.

Designate an institution-authorized verifier independent of each tester. The verifier checks 18+ against trusted institutional records outside the app; no role inference, self-attestation, JWT/client age or identity-document/DOB copies. Bind approval to a designated synthetic pilot account, expected Admin/Adviser role, specific local run and policy version. Minimal private manifest: account binding, adult-approved boolean, verifier/provenance reference, issuedAt, expiresAt and revoked status. Nothing from the manifest reaches the gateway.

Use an offline-signed manifest with a trusted verifier public key and verifier-controlled signing key outside the app; owner approves custody. Store it in a private local directory outside version control and browser access, with verifier write permission/test harness read permission. Never create a signing key or approval in this phase. Reject malformed/signature-invalid/missing/unreadable/expired/revoked entries, wrong account/role/run/policy and future issue times. Proposed approval duration: at most 24 hours, stricter than the earlier 90-day institutional proposal; exact governance remains pending.

Read and validate current approval on every request and before response, without positive caching. Verifier revokes through an atomic signed manifest replacement; cancel queued work, discard results and clear output after revocation. Emergency stop is immediate process termination. Host owner/system administrator is trusted; file permissions/signatures do not defend against a malicious administrator modifying the harness or clock. If independent custody or timely revocation cannot be assured, keep all provider eligibility denied. No schema changes or new application registry are proposed.

## Synthetic fixtures and expected privacy results

These are **prepared specifications**, not seeded data/files. Use only fictitious contributor/paper tokens in a future test factory, never send tokens downstream. Derive complementary cohorts from partitions rather than inventing inconsistent distinct counts. For disjoint fixtures below, C(n) = (versions=n, contributors=n, papers=n); Submitted S, Under Review R and other O are disjoint sets, total C(S+R+O), notSubmitted C(R+O), notReview C(S+O), neither C(O).

| Fixture | Synthetic input | Expected minimized result |
|---|---|---|
| Admin permitted | users=5, groups=10, papers=15, approved=10, published=5 | Four bands: 5-9 / 10-19 / 10-19 / 5-9; approved omitted |
| Admin publication complement | Same, approved=9 | Published omitted; three other bands retained |
| Admin all small | All five counts 0, then all 4 | null; no gateway call |
| Adviser permitted | S=5, R=5, O=5 | Total 10-19, Submitted 5-9, Under Review 5-9 |
| Adviser k boundary | S=0, R=0, O=4; then O=5 | null at 4; total 5-9 only at 5 |
| Adviser complement small | S=5, R=0, O=4 | Total 5-9 only; subsets withheld |
| Adviser combined residual | S=5, R=5, O=4 | Total 10-19 only; both subsets withheld |
| Repeated versions | Five versions from one contributor/paper, all S | null; versions alone cannot meet k |
| Independent distinct guards | Five versions from four contributors/five papers; then five contributors/four papers | null in both cases |
| Invalid/impossible | Negative/fractional/unsafe/nonfinite counts, published>approved, approved>papers, subset>total, complement/residual version sums wrong, extra private keys | Validation error caught -> generic fallback; zero gateway calls |

Add boundary pairs 4/5, 9/10, 19/20, 49/50, 99/100, 199/200, 499/500 and 999/1000. For Adviser bands use all-other partitions to release total only. Add contributor overlap/repeated-paper factories: distinct unions are not summed; withholding must remain conservative. Use harmless private-field sentinel strings to assert they never appear in DTOs/responses/logs. No real student records, research content or files. Synthetic invalid aggregates belong in unit fixtures, not illegal database inserts.

## Mock gateway contract and test cases (proposed)

Prefer an injected function returning predefined responses; **no HTTP mock server or real fetch fallback**. Trap fetch/http/https/socket attempts and fail tests; run the harness with external egress denied. Import/dependency checks prohibit DB/storage/PDF/session/user registry clients, tools and browsing inside the gateway. Only the trusted orchestration layer sees those test dependencies.

Fixed test configuration: model literal openai/gpt-oss-20b and endpoint literal https://api.groq.com/openai/v1/chat/completions, used only as asserted contract metadata, never contacted. This candidate comes from the dated readiness audit, not fresh model verification or activation approval. No client override, redirects, tools/function calls, arbitrary messages, URLs, history or model fallback. Reviewed server prompt/definitions are versioned constants.

Input: reuse current strict minimizedAIDtoSchema (version=1, feature=admin/adviser, exact overview topic, allowed metric keys/bands), additionally require nonempty metrics, correct feature/topic binding and serialized payload <=4 KiB. Build from scratch; omit identities, guards, source counts, eligibility, timestamps and scope metadata. The final fixed prompt/envelope also needs an explicit size/token budget; DTO bytes alone are insufficient.

Proposed strict output: version=1; overview plain text <=800 characters; explanations array of {metricId, text<=300 characters}, maximum four Admin/three Adviser entries, unique IDs drawn only from supplied metrics; reject all extra fields. No links, HTML, actions, tools or executable content. Bound serialized mock response to 8 KiB; reject malformed JSON/truncation/oversize before rendering. Escape text, append local supplementary/coarsened labels and canonical links, clear old output on failure. A schema cannot prove factual safety: manually review claims; prohibited recommendations/fabricated counts in adversarial fixtures must fail the review gate, never be described as solved by length validation.

Contract matrix: valid Admin/Adviser bands; every role/account/adult denial; forged/injected IDs/keys; foreign ownership; expiry/revocation during delay; changed scope before delivery; withheld/empty metrics; incorrect metric references/duplicates; provider-like prompt injection, grades/decisions/official feedback/links; timeout/429/5xx/redirect/invalid/oversized output. All failures return reviewed static fallback without raw errors. A simulated 10-second abort uses a fake clock, discards late responses, and performs no retry. Application flag permutations must still produce static responses and **zero real provider calls**, independently of successful mock contracts.

## Local limits, logging and rollback

For a later approved single-process pilot: 3 attempts/tester/UTC day across both features, 10/run environment/day, 120-second tester cooldown, one active request/tester and one globally. Reserve atomically before the mock/live-test dispatch; failures consume quota, static answers do not. Serialize reservations; use a private locked local budget ledger to survive restart, bound to the approved run, and fail closed on corrupt/missing continuity. Stop if another process runs; process memory is not deployment quota infrastructure. Contract tests use an isolated fake clock/ledger, never consume/reset live budgets. No automatic retries or polling. Output target 400 tokens is provisional pending model reasoning/token-accounting review.

Log only category, duration and aggregate success/fallback totals; no account IDs, approval records, payloads, outputs, headers, raw exceptions, credentials or document metadata. Keep necessary quota keys private, distinct from logs; delete the run ledger/manifest after owner-approved closure and preserve only sanitized evidence. Review console/browser traces too. Rollback: stop harness, revoke run approval, discard pending/cached output and synthetic state; confirm application stubs remain hard-disabled and static guide/reports/review flows work. Never reset a quota ledger mid-approved run to bypass limits.

## Approval gates and objective criteria

1. **Next approval: mock-only preparation/execution.** Owner approves fixtures, test-only eligibility governance and single-process limits, then separately authorizes test harness/files. Exit: all listed contract/privacy/role/revocation cases pass; zero real network calls, no real records, no credentials, provider stubs unchanged under flags, sanitized evidence and fixture cleanup verified. No live permission follows automatically.
2. **Separately authorized live local test entry:** mock exit evidence complete; actual independent adult tester approvals valid; unresolved readiness-audit service terms/privacy/DPA/transfers/ZDR/Free plan/model/license/token accounting resolved; loopback synthetic-only environment and outbound restriction demonstrated; budget/kill switch/revocation verified; owner explicitly approves bounded live calls and a test-only transport. No authorization to enable deployed application flags. Live exit: permitted synthetic bands only, limits/no-retry enforced, human-reviewed factual output, no decisions/private data, safe failure/revocation, sanitized request-count evidence and rollback/cleanup confirmed. Mock success does not establish live fidelity or provider compliance.
3. **Vercel handoff entry:** completed local evidence plus explicit separate deployment review authorization. Verify actual project/plan/region, institutional registry with timely revocation, shared atomic counters/leases across instances/restarts, scoped daily minimized cache with ownership invalidation/no same-day cohort regeneration, secret isolation, configured privacy/billing and demonstrable egress controls. Local manifest/ledger/memory is not acceptable deployment infrastructure. Exit requires concurrent-instance security evidence, failure/kill-switch and Student/static/manual-workflow regression, owner acceptance of residual inference/ownership race and a separate activation decision. Until then deployed Groq stays disabled.

Blockers remain: no approved tester/verifier or protected registry, no mock harness/fixtures executed, live terms/settings/model approval unresolved, and Vercel shared infrastructure/egress unverified. This task changes only this plan and the two handoffs. Validation: git diff --check PASS; no tests, builds, DB writes, credentials, network/provider calls, schema changes, staging or commits.
