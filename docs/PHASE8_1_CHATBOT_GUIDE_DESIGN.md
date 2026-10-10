# Phase 8.1 - AI Chatbot Guide scope and technical design

Date: 2026-10-08. Status: design proposal complete; owner approval pending.
No chatbot/provider implementation, dependencies, environment edits, schema changes, migrations, staging or commits.

## Recommended scope

A small supplementary, role-aware system guide on /dashboard/guide. Start with suggested questions/topic selection and authoritative static answers. AI optionally explains the selected answer in plain language. It cannot act on the application or inspect research. This intentionally limits conversational flexibility to reduce privacy risk and unsupported advice.

Optional short typed questions (maximum 500 characters) are matched locally to an explicit, role-filtered topic/alias list. Ambiguous or unmatched questions ask the user to choose a topic; they never go to the provider. Do not implement a general-purpose question classifier or rely on regex redaction to make arbitrary private text safe.

## Verified knowledge and allowed topics

Use approximately 12-18 small curated topic cards, each with ID, allowed roles, canonical answer, approved facts, fixed route links and source-file references. Source code is authoritative; existing documentation is an editorial aid, not runtime provider context. Do not upload AGENTS.md, handoff logs, database records or the whole repository. No RAG, embeddings or vector database.

| Role | Allowed guidance and verified destinations |
|---|---|
| Student | Active group and project creation at /dashboard/student; PDF submission, version history and received feedback at /dashboard/student/submissions; own notifications at /dashboard/student/notifications. Explain Adviser assignment, one active group rule, PDF limit of 10 MiB, and next-version submission only after Revision Required. |
| Adviser | Own groups and manual Student membership management at /dashboard/adviser/groups; own submissions at /dashboard/adviser/submissions; starting review and using the existing human feedback/decision form; own notifications at /dashboard/adviser/notifications. No advice on what academic decision to make. |
| Admin | User roles and activation at /dashboard/admin/users; group monitoring/archive/reactivate at /dashboard/admin/groups; publication and visibility at /dashboard/admin/repository; read-only counts and latest recorded activities at /dashboard/admin/reports; own notifications at /dashboard/admin/notifications. |
| Shared | Role dashboard navigation, own notification read/delete, repository search by title/abstract/keywords, category/school-year/strand filters, newest-first listing, 10 results/page, Clear filters, published detail and View PDF/download at /dashboard/repository. |

Distinguish submission statuses Submitted -> Under Review -> Revision Required or Approved from research statuses Draft, In Review, Revision Required, Approved. No Resubmitted status. Approval does not automatically publish: Admin publication is separate. Submitted-document access follows Student membership/Adviser ownership; published repository access differs and includes authenticated Panel users. Panel chatbot access remains excluded from this initial three-role scope.

Do not promise older sorting modes, charts, exports, email delivery, automatic review, deadlines or features absent from current code. Generic troubleshooting may explain known format, status and access rules; it cannot diagnose a user's actual record.

## Prohibited topics and role controls

Reject grading, approval/rejection recommendations, official Adviser feedback generation, research-content assessment, summarization, academic judgment, access bypasses, secrets and private/user-specific data requests. Refer academic questions to the assigned Adviser and account/access issues to Admin.

Every request derives identity from getSession and verifies a positive safe user ID, an active database account and database role matching the session claim. Reuse findUserById strictly for authorization; never send the returned row to AI. requireRole alone checks session claims and is insufficient for stale/inactive accounts.

Server-filter topic IDs and facts by the verified role. Reject cross-role topics before any provider call. Explain only the boundary (for example, publication requires Admin); do not provide that role's operational instructions or links. Never trust a client-supplied role, user ID, prompt, history or route. Existing feature services remain the authorization authority; the guide neither calls nor changes them.

## Provider recommendation (provisional)

Recommend Google's Gemini Developer API with an owner-approved low-cost stable Flash-family text model, using server-side fetch in one isolated adapter. A short non-streaming HTTPS request fits the existing Next.js Server Action architecture without installing an SDK or AI framework. This is a limited rewriting task; a larger model is unnecessary unless acceptance shows a need.

No live provider comparison or web browsing was performed. Exact current model ID, pricing, free-tier availability, quotas, retention/training terms and regional availability are unverified. Do not assume free access or a free tier is suitable for school data. Prefer approved paid usage if its verified terms meet the owner's requirements; otherwise keep the static guide available with AI disabled. Owner approves provider, model, data terms and a small spending ceiling before implementation/live calls.

## Prompt and response strategy

One independent request per selected topic; no chat memory or provider conversation IDs. Send only trusted instructions, verified role name, selected curated topic facts and their knowledge-version identifier. No raw user question is sent. Prompt: explain only these facts briefly; preserve workflow terms; make no decisions; invent no permissions/features; return an unsupported signal if these facts cannot support an answer. No tools, agents, browsing, uploads or retrieval.

Validate provider output shape and bounded plain text (target <=200 words; output token cap around 350, adjusted for model accounting). Render escaped text, no HTML or provider-generated links. Fixed role-authorized links and canonical steps come from local topic cards. Label any generated explanation AI-generated and supplementary. Missing/invalid/unsupported responses fall back to the canonical answer. Prompting and output shape checks do not prove factual accuracy: manually test every card and disable generated explanations if fidelity is inadequate.

## Privacy, security and logging

Provider payload contains no identifiers, names, emails, cookies/JWTs, credentials, database records, paper titles/abstracts/keywords, feedback, notification text, PDFs, storage paths or signed URLs. Local typed input is ephemeral, never persisted or logged. UI warns against entering private research or personal data. Display transcript stays in component memory; clear on leaving/reloading and do not use localStorage.

Use server-only adapter/service modules and server environment variables GEMINI_API_KEY, AI_GUIDE_MODEL and AI_GUIDE_ENABLED (off by default). Never NEXT_PUBLIC_ secrets or committed env files. No browser-to-provider requests. Prefer key headers over URL parameters; never log request headers or raw provider errors. Log only bounded error category, topic/version, latency and success/fallback counts; omit user identifiers, input, output and raw payloads. Configure timeout and no automatic retries.

## Fallback and usage controls

Always retain local role-authorized canonical guidance. On missing configuration, timeout (10 seconds), network/429/5xx errors, malformed/empty output, usage exhaustion or unsupported signal: show 'AI guidance is unavailable. Here are the verified system steps.' No workflow changes or retry loop.

Unknown questions: 'I can help with ThesiSHS AI navigation and workflows. Choose a supported topic.' Human judgment: 'I cannot evaluate research or make review decisions. Please consult your Adviser.' Authorization/database failure denies personalized guide access before provider work.

Pilot limits: 5 provider attempts per minute and 20 per rolling hour per verified user ID; one active provider request per user; reserve attempts before calling, count failures, bound input/output, and leave static topics usable after exhaustion. Deduplicate repeated topic requests in the current UI. No billing or transcript infrastructure.

An in-memory limiter is acceptable only for a single-process local pilot; restarts reset counts and Vercel instances do not share them. Public/serverless enablement requires a small shared TTL counter store with atomic reservations via a managed KV/Redis REST API, plus verified provider-side spend controls or an application global request ceiling in that store. Fail closed to static guidance if the shared limiter fails. Do not claim local counters enforce production quotas. Choose limiter deployment mode before Phase 8.2; no additional database schema is justified.

## Proposed files (not created application modules)

| File | Purpose |
|---|---|
| app/dashboard/guide/page.tsx | Protected shared guide page; minimal dashboard entry link |
| app/dashboard/guide/ChatbotGuide.tsx | Suggested questions, optional local matching, ephemeral display and fallback |
| lib/actions/chatbot-guide.action.ts | Thin authenticated Server Action; strict request validation |
| lib/validations/chatbot-guide.ts | Topic allowlist/input limits and output schema; reject extra context fields |
| lib/services/chatbot-guide.service.ts | Active-account/role check, role-filtered knowledge, usage reservation, provider/fallback orchestration |
| lib/ai/guide-knowledge.ts | Reviewed topic cards and fixed routes/source references |
| lib/ai/guide-provider.ts | Server-only fetch adapter, fixed model/config, timeout and safe errors |
| lib/ai/guide-usage.ts | Server-only bounded pilot limiter or approved shared counter adapter |
| types/chatbot-guide.ts | Explicit guided/static/unsupported/unavailable result types |
| tests/phase8-chatbot-guide.unit.cjs and tests/phase8-chatbot-guide.browser.cjs | Focused isolated and browser acceptance following existing test style |

Flow: UI -> Server Action -> Zod -> guide service -> existing user repository -> Drizzle for authorization only; service -> curated knowledge/usage limiter/provider adapter. No chat repository, route handler, streaming, workflow writes or new dependencies required for the local pilot. Read installed Next.js 16.2.9 guidance again before coding; direct Server Action POST requests must enforce auth as documented.

## Phase 8.2 plan and owner decisions

1. Obtain approval for this topic-driven scope, provider/model/data terms and spending ceiling, and local-pilot versus shared-limiter deployment. Default interface language: English.
2. Create reviewed knowledge cards first; implement static guide, server authorization and validation with a mocked provider.
3. Implement the isolated adapter and approved limiter behind a disabled-by-default flag; no changes to research workflows or storage services.
4. Unit-test role filtering, anonymous/Panel/stale-role/inactive/missing-account denial with zero provider calls; forged fields, unknown topics, limits/concurrent calls; timeout/429/5xx/malformed output; safe logging and exact allowlisted outgoing payloads. Test shared-counter failure if selected.
5. Check each topic's facts/routes against source; include prompt-injection, cross-role operations, private-content input, grading/feedback/summarization and unsupported-feature questions. Recognized topic must never forward arbitrary text.
6. Browser-test all three roles, fixed links, AI label, static fallback, exhausted limits and safe rendering; make a small approved live-provider fidelity check for every supported card. Verify secrets absent from browser payloads/bundles and no research/notification/storage writes.
7. Run lint, TypeScript, build and diff check; focused repository-document regression if shared auth/navigation changes warrant it. Record actual evidence and limitations; do not mark implemented until those checks pass.

Inspection checkpoint: feature/development at 435dc36; pre-existing Phase 7 modifications remain unstaged/uncommitted. Installed package/auth/status/navigation/workflow sources and Next.js mutating-data guide inspected. No runtime feature tests/build were run for this documentation-only phase.
