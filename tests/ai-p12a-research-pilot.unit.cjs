/* eslint-disable @typescript-eslint/no-require-imports */
// Offline only: actual validators, transport, entitlement and orchestration; account/SQL boundaries are doubles.
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
let outbound = 0;
const forbidden = () => { outbound++; throw Error('OUTBOUND_FORBIDDEN'); };
global.fetch = forbidden;
for (const name of ['node:http', 'node:https']) { const api = require(name); api.request = forbidden; api.get = forbidden; }
const net = require('node:net'); net.connect = forbidden; net.createConnection = forbidden; net.Socket.prototype.connect = forbidden;
require('node:tls').connect = forbidden;
function load(file, mocks = {}, globals = {}, transform = value => value) {
    const exports = {};
    const code = ts.transpileModule(transform(fs.readFileSync(file, 'utf8')), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, Buffer, Date, JSON, AbortController, TextDecoder, Response, setTimeout, clearTimeout,
        fetch: forbidden, console: new Proxy({}, { get() { throw Error('LOGGING_FORBIDDEN'); } }),
        process: { get env() { throw Error('ENV_READ_FORBIDDEN'); } }, ...globals, require(id) {
            if (Object.hasOwn(mocks, id)) return mocks[id];
            if (id === 'server-only') return {};
            if (/dotenv|lib\/db|repositories|supabase|storage|notification|feedback/.test(id)) throw Error('UNAPPROVED_DEPENDENCY');
            return require(id.startsWith('@/') ? path.resolve(id.slice(2)) : id);
        } }, { filename: file });
    return exports;
}
const schemas = require('../lib/validations/groq-research-pilot.ts');
const fixtures = require('../lib/ai/adviser-research-demo.ts');
const config = load('lib/ai/groq-research-pilot-config.ts');
const rest = load('lib/ai/groq-rest.ts', {
    '@/lib/ai/groq-key': { loadGroqConfiguration: () => null },
    '@/lib/ai/groq-provider': { getGroqAvailability: () => ({ enabled: false }) },
});
const adapter = load('lib/ai/groq-research-pilot.ts', { '@/lib/ai/groq-rest': rest });
const terms = { finalized: true, version: 'ai-p1-fictional-v1', digest: 'a'.repeat(64) }; // Synthetic authorization evidence only.
const now = Date.parse('2026-11-12T04:00:00Z');
const approval = () => ({ runId: 'b06a8b5f-855e-4b3f-aee8-c07b6eebfc62', authorityRef: 'SYNTHETIC_TEST_ONLY', scope: 'research-fictional-v1',
    participantIds: [20, 30], startsAt: new Date(now - 1000).toISOString(), endsAt: new Date(now + 3600000).toISOString(), terms: { ...terms } });
const request = (task = 'writing', questionId = 'primary') => ({ submissionId: 11, fixtureId: 'bundled-fictional-v1', task, questionId });
const key = { token: 'SYNTHETIC_NOT_A_CREDENTIAL' };
const output = { observation: 'The fictional survey omits a comparison measure.', explanation: 'Its method cannot answer its stated question.', suggestion: 'Consider defining and measuring planning habits.' };
const wire = (value = output, extra = {}, finish = 'stop') => new Response(JSON.stringify({ choices: [{ finish_reason: finish,
    message: { role: 'assistant', content: JSON.stringify(value), ...extra } }] }), { headers: { 'content-type': 'application/json' } });

function harness() {
    const updatedAt = new Date('2026-11-01T00:00:00Z');
    const state = { enabled: true, time: now, approval: approval(), actor: { userId: 20, roleId: 2 }, main: 20, active: true, scope: true,
        eligibility: { id: 1, userId: 20, decision: 'Eligible', eventKind: 'certification', decisionRoleId: 2, accountUpdatedAt: updatedAt,
            verifierUserId: 10, verifierAuthorizationRef: 'SYNTHETIC_VERIFIER', revoked: false },
        consent: { id: 2, eventKind: 'accepted', termsVersion: terms.version, termsDigest: terms.digest, eligibilityEventId: 1 },
        quota: true, credentials: true, held: false, authReads: 0, keyReads: 0, reservations: 0, releases: 0, dispatches: 0, afterDispatch: null, afterReservation: null };
    const account = { getCurrentAccount: async () => state.active ? { ...state.actor } : null };
    const adult = load('lib/auth/adult-eligibility.ts');
    const entitlement = load('lib/auth/ai-entitlement.ts', {
        '@/lib/auth/session': { getSession: async () => state.actor },
        '@/lib/auth/adult-eligibility': adult,
        '@/lib/ai/consent-terms': { AI_TERMS_VERSION: 'ai-assistance-v2-draft', AI_TERMS_DIGEST: 'b'.repeat(64) },
        '@/lib/ai/groq-provider': { getGroqAvailability: () => ({ enabled: false }) },
        '@/lib/repositories/ai-governance.repository': { withAIAccountLocks: async (_ids, work) => {
            state.authReads++;
            return work({ accounts: [{ id: state.actor.userId, roleId: state.actor.roleId, isActive: state.active, updatedAt }],
                latestEligibility: async () => state.eligibility, latestConsent: async () => state.consent });
        } },
    });
    const service = load('lib/services/groq-research-pilot.service.ts', {
        '@/lib/ai/groq-research-pilot-config': { getResearchPilotConfiguration: () => state.enabled ? config.parseResearchPilotApproval(state.approval, terms, state.time) : null },
        '@/lib/ai/groq-research-pilot': adapter,
        '@/lib/ai/groq-key': { loadGroqConfiguration: scope => { assert.equal(scope, 'research-pilot'); state.keyReads++; return state.credentials ? key : null; } },
        '@/lib/auth/ai-entitlement': entitlement, '@/lib/auth/current-account': account,
        '@/lib/auth/main-adviser': { getCurrentMainAdviser: async id => state.main === id },
        '@/lib/repositories/adviser-submission.repository': { canAccessResearchDemoSubmission: async (id, actor) => state.scope && id === 11 && actor === state.main },
        '@/lib/repositories/co-adviser.repository': { canAccessResearchDemoAssignment: async (actor, assignment, submission) => state.scope && state.main === 20 && actor === 30 && assignment === 41 && submission === 11 },
        '@/lib/auth/ai-pilot-limits': { reserveAIPilotAttempt: async (id, window) => {
            state.reservations++; assert.equal(id, state.actor.userId);
            assert.equal(window.startsAt.toISOString(), state.approval.startsAt); assert.equal(window.endsAt.toISOString(), state.approval.endsAt);
            if (!state.quota || state.held) return null;
            state.held = true;
            state.afterReservation?.();
            return async () => { state.releases++; state.held = false; };
        } },
    }, { fetch: async (url, init) => { state.dispatches++; assert.equal(url, rest.GROQ_ENDPOINT); assert.equal(state.held, true);
        const payload = JSON.parse(JSON.parse(init.body).messages[1].content);
        assert.deepEqual(Object.keys(payload).sort(), ['excerpt', 'question', 'task']);
        state.afterDispatch?.(); return wire(); } });
    const action = load('lib/actions/groq-research-pilot.action.ts', { '@/lib/services/groq-research-pilot.service': service });
    return { state, entitlement, run: action.runGroqResearchPilotAction };
}

test('runtime is hard-disabled in every environment without reading approval, credentials, accounts or quotas', async () => {
    assert.equal(config.GROQ_RESEARCH_PILOT_ENABLED, false); assert.equal(config.FINALIZED_RESEARCH_PILOT_TERMS, null);
    assert.equal(config.getResearchPilotConfiguration(), null);
    const keyModule = load('lib/ai/groq-key.ts', { './groq-provider': { getGroqAvailability: () => ({ enabled: false }) },
        './groq-pilot-config': { getLocalPilotApproval: () => null }, './groq-research-pilot-config': config });
    let keyReads = 0;
    assert.equal(keyModule.createGroqKeyLoader(() => { keyReads++; throw Error('SECRET'); })('research-pilot'), null);
    assert.equal(keyReads, 0);
    const approvedKeyModule = load('lib/ai/groq-key.ts', { './groq-provider': { getGroqAvailability: () => ({ enabled: false }) },
        './groq-pilot-config': { getLocalPilotApproval: () => null }, './groq-research-pilot-config': { getResearchPilotConfiguration: () => approval() } });
    assert.equal(approvedKeyModule.createGroqKeyLoader(() => key.token)('research-pilot').token, key.token);
    for (const value of [undefined, '', 'bad\r\nheader', 42]) assert.equal(approvedKeyModule.createGroqKeyLoader(() => value)('research-pilot'), null);
    assert.equal(approvedKeyModule.createGroqKeyLoader(() => { throw Error('SECRET'); })('research-pilot'), null);
    const { state, run } = harness(); state.enabled = false;
    assert.equal((await run(request())).success, false);
    assert.deepEqual([state.authReads, state.keyReads, state.reservations, state.dispatches], [0, 0, 0, 0]);
});
test('configuration rejects drafts/proposals, mismatched terms, invalid windows, duplicate participants and unknown keys', () => {
    assert.ok(config.parseResearchPilotApproval(approval(), terms, now));
    for (const invalid of [null, { ...terms, finalized: false }, { ...terms, version: 'ai-assistance-v2-draft' }, { ...terms, version: 'ai-p1-fictional-v1-proposal' }])
        assert.equal(config.parseResearchPilotApproval(approval(), invalid, now), null);
    for (const patch of [{ terms: { ...terms, digest: 'b'.repeat(64) } }, { participantIds: [20, 20] }, { participantIds: [] },
        { startsAt: new Date(now + 1).toISOString() }, { endsAt: new Date(now).toISOString() },
        { endsAt: new Date(now + 7200000).toISOString() }, { scope: 'real-manuscript' }, { enabled: true }])
        assert.equal(config.parseResearchPilotApproval({ ...approval(), ...patch }, terms, now), null);
    assert.equal(config.parseResearchPilotApproval(approval(), terms, NaN), null);
});
test('even a synthetic enabled code gate rejects development, test, CI and Preview without a manifest read', () => {
    const transform = code => code.replace('GROQ_RESEARCH_PILOT_ENABLED = false', 'GROQ_RESEARCH_PILOT_ENABLED = true')
        .replace('FINALIZED_RESEARCH_PILOT_TERMS: ResearchPilotTerms | null = null', 'FINALIZED_RESEARCH_PILOT_TERMS: ResearchPilotTerms | null = ' + JSON.stringify(terms));
    for (const env of [{ NODE_ENV: 'development' }, { NODE_ENV: 'test' }, { NODE_ENV: 'production' },
        { NODE_ENV: 'production', VERCEL_ENV: 'development' }, { NODE_ENV: 'production', VERCEL_ENV: 'preview' }, { NODE_ENV: 'production', VERCEL_ENV: 'production', CI: '1' }]) {
        Object.defineProperty(env, 'GROQ_RESEARCH_PILOT_APPROVAL_JSON', { get() { throw Error('MANIFEST_READ_FORBIDDEN'); } });
        assert.equal(load('lib/ai/groq-research-pilot-config.ts', {}, { process: { env } }, transform).getResearchPilotConfiguration(), null);
    }
    assert.equal(load('lib/ai/groq-research-pilot-config.ts', {}, { process: { env: { NODE_ENV: 'production', VERCEL_ENV: 'production', GROQ_RESEARCH_PILOT_APPROVAL_JSON: '{invalid' } } }, transform).getResearchPilotConfiguration(), null);
});
test('Main and exact assigned Co pass actual adult/consent checks and mocked transport for all three tasks', async () => {
    for (const co of [false, true]) for (const task of fixtures.RESEARCH_DEMO_TASKS) {
        const { state, run } = harness();
        if (co) { state.actor.userId = 30; state.eligibility.userId = 30; }
        const result = await run({ ...request(task), ...(co ? { assignmentId: 41 } : {}) });
        assert.equal(result.mode, 'generated'); assert.equal(result.answer.label, schemas.RESEARCH_PILOT_LABEL);
        assert.notEqual(result.answer.label, fixtures.RESEARCH_DEMO_LABEL);
        assert.deepEqual([state.dispatches, state.reservations, state.releases, state.held], [1, 1, 1, false]);
        assert.ok(!JSON.stringify(result).includes(key.token));
    }
});
test('missing/pending/revoked/stale eligibility and wrong/withdrawn/draft consent deny before credentials or quota', async () => {
    const changes = [s => { s.eligibility = null; }, s => { s.eligibility.decision = 'Pending Verification'; }, s => { s.eligibility.revoked = true; },
        s => { s.eligibility.accountUpdatedAt = new Date(0); }, s => { s.eligibility.verifierUserId = s.actor.userId; },
        s => { s.consent = null; }, s => { s.consent.eventKind = 'withdrawn'; }, s => { s.consent.termsVersion = 'ai-assistance-v2-draft'; },
        s => { s.consent.termsVersion = 'ai-p1-fictional-v1-proposal'; }, s => { s.consent.termsDigest = 'b'.repeat(64); }, s => { s.consent.eligibilityEventId = 99; }];
    for (const change of changes) {
        const { state, run } = harness(); change(state); assert.equal((await run(request())).success, false);
        assert.deepEqual([state.keyReads, state.reservations, state.dispatches], [0, 0, 0]);
    }
});
test('missing account, inactive/wrong role, unlisted participant, expiry and wrong submission/assignment deny', async () => {
    for (const change of [s => { s.active = false; }, s => { s.actor.roleId = 1; }, s => { s.approval.participantIds = [99]; },
        s => { s.time = Date.parse(s.approval.endsAt); }, s => { s.scope = false; }]) {
        const { state, run } = harness(); change(state); assert.equal((await run(request())).success, false); assert.equal(state.dispatches, 0);
    }
    for (const patch of [{ submissionId: 99 }, { assignmentId: 41 }]) assert.equal((await harness().run({ ...request(), ...patch })).success, false);
    const { state, run } = harness(); state.actor.userId = 30; state.eligibility.userId = 30;
    for (const patch of [{}, { assignmentId: 42 }, { assignmentId: 41, submissionId: 99 }]) assert.equal((await run({ ...request(), ...patch })).success, false);
    assert.equal(state.dispatches, 0);
});
test('strict selectors reject arbitrary text, history, PDF/title/feedback, forged identity and unknown IDs', async () => {
    for (const input of [null, {}, { ...request(), fixtureId: 'other' }, { ...request(), task: 'approve' }, { ...request(), questionId: 'custom' },
        ...['excerpt', 'history', 'pdf', 'title', 'abstract', 'feedback', 'userId', 'system', 'tools', 'url', 'model'].map(name => ({ ...request(), [name]: 'PRIVATE_TEXT' }))]) {
        const { state, run } = harness(); assert.equal((await run(input)).success, false);
        assert.deepEqual([state.authReads, state.keyReads, state.reservations, state.dispatches], [0, 0, 0, 0]);
        assert.equal(adapter.prepareResearchPilotBody(input), null);
    }
});
test('all nine task/question combinations resolve only trusted fictional payloads with independent byte/token budgets', async () => {
    for (const task of fixtures.RESEARCH_DEMO_TASKS) for (const questionId of ['primary', 'explain-improvement', 'verify-next']) {
        const prepared = adapter.prepareResearchPilotBody({ ...request(task, questionId), assignmentId: 41 }); assert.ok(prepared);
        const body = JSON.parse(prepared.body), payload = JSON.parse(body.messages[1].content);
        assert.deepEqual(payload, { task, excerpt: fixtures.RESEARCH_DEMO_EXCERPT, question: questionId === 'primary'
            ? fixtures.RESEARCH_DEMO_QUESTIONS[task] : fixtures.RESEARCH_DEMO_FOLLOWUPS[questionId === 'explain-improvement' ? 0 : 1] });
        assert.equal(body.max_completion_tokens, 1024); assert.equal(body.stream, false); assert.equal(body.response_format.json_schema.strict, true);
        assert.ok(Buffer.byteLength(prepared.body) <= adapter.RESEARCH_PILOT_BUDGET.requestBytes);
        assert.ok(adapter.researchPilotInputWithinBudget(body.messages));
        assert.ok(!/submissionId|assignmentId|accountId|groupId|history|SYNTHETIC_NOT_A_CREDENTIAL/.test(prepared.body));
    }
    assert.equal(adapter.researchPilotInputWithinBudget('x'.repeat(2048)), false);
    assert.equal(adapter.researchPilotInputWithinBudget('é'.repeat(1000)), false);
});
test('missing credentials and quota exhaustion/in-flight slot deny dispatch; reserved attempts release after revocation', async () => {
    for (const change of [s => { s.credentials = false; }, s => { s.quota = false; }, s => { s.held = true; }]) {
        const { state, run } = harness(); change(state); assert.equal((await run(request())).success, false); assert.equal(state.dispatches, 0);
    }
    for (const revoke of [s => { s.enabled = false; }, s => { s.scope = false; }, s => { s.consent.id++; }]) {
        const { state, run } = harness(); state.afterReservation = () => revoke(state);
        assert.equal((await run(request())).success, false); assert.equal(state.dispatches, 0); assert.equal(state.releases, 1);
    }
    for (const revoke of [s => { s.active = false; }, s => { s.scope = false; }, s => { s.main = 99; }, s => { s.eligibility.revoked = true; },
        s => { s.consent.id++; }, s => { s.consent.eventKind = 'withdrawn'; }, s => { s.enabled = false; }, s => { s.time = Date.parse(s.approval.endsAt); }]) {
        const { state, run } = harness(); state.afterDispatch = () => revoke(state);
        assert.equal((await run(request())).success, false); assert.equal(state.dispatches, 1); assert.equal(state.releases, 1); assert.equal(state.held, false);
    }
});
test('fixed endpoint, bearer handling, no retries and controlled provider/schema failures disclose no private errors', async () => {
    let calls = 0;
    assert.equal((await adapter.createGroqResearchPilotTransport(async (url, init) => {
        calls++; assert.equal(url, rest.GROQ_ENDPOINT); assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store');
        assert.equal(init.headers.Authorization, 'Bearer ' + key.token); return wire();
    })(request(), key)).mode, 'generated'); assert.equal(calls, 1);
    for (const response of [() => new Response('PRIVATE_ERROR', { status: 429 }), () => new Response(key.token, { status: 503 }),
        () => wire({ ...output, extra: 'PRIVATE' }), () => wire({ ...output, observation: '<b>unsafe</b>' }),
        () => wire({ ...output, observation: key.token }), () => wire({ ...output, suggestion: 'Approve the submission' }),
        () => wire(output, { tool_calls: [] }), () => wire(output, { refusal: 'PRIVATE' }), () => wire(output, {}, 'length'),
        () => new Response('x'.repeat(32769), { headers: { 'content-type': 'application/json' } }),
        () => new Response('{broken', { headers: { 'content-type': 'application/json' } }), () => new Response('{}', { headers: { 'content-type': 'text/html' } }),
        () => { throw Error('PRIVATE_EXCEPTION:' + key.token); }]) {
        calls = 0;
        const result = await adapter.createGroqResearchPilotTransport(async () => { calls++; return response(); })(request(), key);
        assert.equal(result.success, false); assert.equal(calls, 1); assert.ok(!JSON.stringify(result).includes(key.token));
        assert.ok(!JSON.stringify(result).includes('PRIVATE'));
    }
    calls = 0;
    assert.equal((await adapter.createGroqResearchPilotTransport(async () => { calls++; return wire(); })(request(), { token: 'bad\r\nheader' })).success, false);
    assert.equal(calls, 0);
});
test('10-second deadline covers fetch and stalled streaming body; aborts and never retries', async () => {
    for (const streaming of [false, true]) {
        let fire, signal, cancelled = false, calls = 0;
        const transport = adapter.createGroqResearchPilotTransport(async (_url, init) => {
            calls++; signal = init.signal;
            return streaming ? new Response(new ReadableStream({ start() {}, cancel() { cancelled = true; } }), { headers: { 'content-type': 'application/json' } }) : new Promise(() => {});
        }, (delay, callback) => { assert.equal(delay, 10000); fire = callback; return () => {}; });
        const pending = transport(request(), key); await Promise.resolve(); fire();
        assert.equal((await pending).success, false); assert.equal(signal.aborted, true); assert.equal(calls, 1);
        if (streaming) assert.equal(cancelled, true);
    }
});
test('no academic/transcript write dependencies; proposal/draft terms never authorize entitlement; zero network', async () => {
    const { state, entitlement } = harness();
    assert.equal(await entitlement.getResearchPilotEntitlement({ ...terms, version: 'ai-assistance-v2-draft' }), null);
    assert.equal(await entitlement.getResearchPilotEntitlement({ ...terms, version: 'ai-p1-fictional-v1-proposal' }), null);
    assert.equal(state.authReads, 0);
    for (const file of ['lib/services/groq-research-pilot.service.ts', 'lib/ai/groq-research-pilot.ts']) {
        const source = fs.readFileSync(file, 'utf8');
        assert.ok(!/console\.|appendConsent|appendEligibility|feedback\.repository|localStorage|sessionStorage|writeFile|\.insert\(/.test(source));
    }
    assert.equal(outbound, 0);
});
