/* eslint-disable @typescript-eslint/no-require-imports */
// Offline: real action/service/auth/minimization/REST; synthetic session, SQL and fetch boundaries.
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
    const code = ts.transpileModule(transform(fs.readFileSync(file, 'utf8')), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    vm.runInNewContext(code, { exports, Buffer, Date, JSON, AbortController, TextDecoder, Response, setTimeout, clearTimeout,
        fetch: forbidden, console: new Proxy({}, { get() { throw Error('LOGGING_FORBIDDEN'); } }),
        process: { get env() { throw Error('ENV_READ_FORBIDDEN'); } }, ...globals, require(id) {
            if (Object.hasOwn(mocks, id)) return mocks[id];
            if (id === 'server-only') return {};
            if (/dotenv|lib\/db|repositories|supabase|storage/.test(id)) throw Error('UNAPPROVED_DEPENDENCY');
            return require(id.startsWith('@/') ? path.resolve(id.slice(2)) : id);
        } }, { filename: file });
    return exports;
}
const clone = value => JSON.parse(JSON.stringify(value));
const legacy = { getGroqAvailability: () => ({ enabled: false }) };
const terms = { finalized: true, version: 'ai-assistance-v3', digest: 'a'.repeat(64) }; // Test fixture, not approved terms.
const consentTerms = { AI_TERMS_VERSION: terms.version, AI_TERMS_DIGEST: terms.digest };
const preview = load('lib/ai/groq-research-pilot-config.ts');
const target = { projectId: 'prj_SYNTHETIC', branch: 'feature/development', commitSha: 'b'.repeat(40), protectionEvidenceRef: 'SYNTHETIC_ONLY' };
const now = Date.parse('2026-11-14T04:00:00Z');
const approval = () => ({ runId: 'b06a8b5f-855e-4b3f-aee8-c07b6eebfc62', authorityRef: 'SYNTHETIC_ONLY',
    scope: 'admin-count-bands-v1', participantIds: [20], startsAt: new Date(now - 1000).toISOString(),
    endsAt: new Date(now + 3600000).toISOString(), terms: { ...terms } });
const env = () => ({ NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview',
    VERCEL_PROJECT_ID: target.projectId, VERCEL_GIT_COMMIT_REF: target.branch, VERCEL_GIT_COMMIT_SHA: target.commitSha,
    VERCEL_DEPLOYMENT_ID: 'dpl_SYNTHETIC', GROQ_ADMIN_REPORT_TARGET_JSON: JSON.stringify(target),
    GROQ_ADMIN_REPORT_APPROVAL_JSON: JSON.stringify(approval()) });
const configMocks = { '@/lib/ai/consent-terms': consentTerms, '@/lib/ai/groq-research-pilot-config': preview };
const enableFixture = source => source.replace('GROQ_ADMIN_REPORT_ENABLED = false', 'GROQ_ADMIN_REPORT_ENABLED = true')
    .replace(/(export const FINALIZED_ADMIN_REPORT_TERMS:[^\n]+) = null;/, `$1 = ${JSON.stringify(terms)};`);
class Clock extends Date { static now() { return now; } }
const readConfig = (environment = env(), transform = enableFixture, termValues = consentTerms) =>
    load('lib/ai/groq-admin-report-config.ts', { ...configMocks, '@/lib/ai/consent-terms': termValues },
        { process: { env: environment }, Date: Clock }, transform).getAdminReportConfiguration();
const rest = load('lib/ai/groq-rest.ts', { '@/lib/ai/groq-key': { loadGroqConfiguration: () => null }, '@/lib/ai/groq-provider': legacy });
const policy = load('lib/ai/aggregate-policy.ts');
const request = { reportId: 'admin-overview-v1' };
const totals = () => ({ totalUsers: 55, totalGroups: 6, totalResearchPapers: 25, totalPublishedPapers: 7, approvedPapers: 15 });
const goodOutput = () => ({ version: 1, overview: 'These coarse bands describe recorded volumes, not exact counts.',
    explanations: [{ metricId: 'totalUsers', text: 'The recorded account total is in the 50-99 band.' }] });
const wire = value => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: {
    role: 'assistant', content: typeof value === 'string' ? value : JSON.stringify(value), tool_calls: null,
} }] }), { headers: { 'content-type': 'application/json' } });
function harness() {
    const updatedAt = new Date('2026-11-01T00:00:00Z');
    const state = { enabled: true, actor: { userId: 20, roleId: 1 }, accountRole: 1, active: true, approval: approval(),
        eligibility: { id: 1, userId: 20, decision: 'Eligible', eventKind: 'certification', decisionRoleId: 1,
            accountUpdatedAt: updatedAt, verifierUserId: 10, verifierAuthorizationRef: 'SYNTHETIC_ONLY', revoked: false },
        consent: { id: 2, eventKind: 'accepted', termsVersion: terms.version, termsDigest: terms.digest, eligibilityEventId: 1 },
        totals: totals(), quota: true, credentials: true, aggregates: 0, reservations: 0, releases: 0, keyReads: 0,
        dispatches: 0, held: false, output: goodOutput(), afterReservation: null, afterDispatch: null };
    const account = () => ({ id: 20, roleId: state.accountRole, isActive: state.active, updatedAt });
    const auth = load('lib/auth/ai-authorization.ts', {
        '@/lib/auth/session': { getSession: async () => state.actor },
        '@/lib/repositories/user.repository': { findUserById: async () => account() },
    });
    const entitlement = load('lib/auth/ai-entitlement.ts', {
        '@/lib/auth/session': { getSession: async () => state.actor }, '@/lib/ai/consent-terms': consentTerms,
        '@/lib/ai/groq-provider': legacy, '@/lib/auth/adult-eligibility': load('lib/auth/adult-eligibility.ts'),
        '@/lib/repositories/ai-governance.repository': { withAIAccountLocks: async (_ids, work) => work({ accounts: [account()],
            latestEligibility: async () => state.eligibility, latestConsent: async () => state.consent }) },
    });
    const local = load('lib/services/ai-foundation.service.ts', { '@/lib/auth/ai-authorization': auth,
        '@/lib/auth/main-adviser': { getCurrentMainAdviser: async () => null }, '@/lib/ai/groq-provider': legacy });
    const aggregation = load('lib/services/ai-aggregation.service.ts', { '@/lib/auth/ai-authorization': auth,
        '@/lib/auth/main-adviser': { getCurrentMainAdviser: async () => null }, '@/lib/ai/aggregate-policy': policy,
        '@/lib/repositories/admin-ai-aggregate.repository': { getAdminAIOverviewAggregate: async () => { state.aggregates++; return state.totals; } },
        '@/lib/repositories/adviser-submission.repository': { getAdviserAIWorkflowAggregate: forbidden } });
    const configuration = { getAdminReportConfiguration: () => state.enabled ? readConfig({ ...env(), GROQ_ADMIN_REPORT_APPROVAL_JSON: JSON.stringify(state.approval) }) : null };
    const keys = load('lib/ai/groq-key.ts', { './groq-provider': legacy, './groq-pilot-config': { getLocalPilotApproval: () => null },
        './groq-research-pilot-config': preview, './groq-admin-report-config': configuration });
    const service = load('lib/services/ai-interpretation.service.ts', {
        '@/lib/ai/groq-provider': legacy, '@/lib/ai/groq-rest': rest, '@/lib/ai/groq-admin-report-config': configuration,
        '@/lib/ai/groq-key': { loadGroqConfiguration: keys.createGroqKeyLoader(() => { state.keyReads++; return state.credentials ? 'SYNTHETIC_NOT_A_CREDENTIAL' : null; }) },
        '@/lib/auth/ai-entitlement': entitlement, '@/lib/services/ai-foundation.service': local, '@/lib/services/ai-aggregation.service': aggregation,
        '@/lib/auth/ai-pilot-limits': { reserveAIPilotAttempt: async (id, window) => {
            state.reservations++; assert.equal(id, 20); assert.equal(window.startsAt.toISOString(), state.approval.startsAt);
            assert.equal(window.endsAt.toISOString(), state.approval.endsAt);
            if (!state.quota) return null;
            state.held = true; state.afterReservation?.(); return async () => { state.releases++; state.held = false; };
        } },
    }, { fetch: async (url, init) => {
        state.dispatches++; assert.equal(state.held, true); assert.equal(url, rest.GROQ_ENDPOINT);
        const body = JSON.parse(init.body); assert.equal(body.model, 'openai/gpt-oss-20b');
        assert.deepEqual(JSON.parse(body.messages[1].content), clone(policy.minimizeAdminAggregate(state.totals)));
        assert.ok(!/accountId|participantIds|authorityRef|eligibility|approvedPapers|email|password/.test(init.body));
        state.afterDispatch?.(); return wire(state.output);
    } });
    const actions = load('lib/actions/admin-ai-report.action.ts', { '@/lib/services/ai-interpretation.service': service });
    return { state, actions, local, service };
}

test('real compiled Admin gate is disabled and finalized terms null; no environment or secret access', async () => {
    const config = load('lib/ai/groq-admin-report-config.ts', configMocks);
    assert.equal(config.GROQ_ADMIN_REPORT_ENABLED, false); assert.equal(config.FINALIZED_ADMIN_REPORT_TERMS, null);
    assert.equal(config.getAdminReportConfiguration(), null);
    const h = harness(); h.state.enabled = false;
    assert.equal((await h.actions.getAdminInterpretationAvailabilityAction()).available, false);
    assert.equal((await h.actions.getAdminInterpretationAction(request)).mode, 'unavailable');
    assert.deepEqual([h.state.aggregates, h.state.keyReads, h.state.reservations, h.state.dispatches], [0, 0, 0, 0]);
    assert.equal((await h.local.getLocalAdminAssistance(request)).mode, 'static');
});
test('Preview identity, protection evidence, exact consent registration and approved window fail closed', () => {
    assert.ok(readConfig());
    for (const delta of [{ NODE_ENV: 'development' }, { NODE_ENV: 'test' }, { VERCEL_ENV: 'production' },
        { VERCEL_TARGET_ENV: 'development' }, { CI: 'true' }, { VERCEL: undefined }, { VERCEL_DEPLOYMENT_ID: '' },
        { VERCEL_DEPLOYMENT_ID: 'spoofed' }, { VERCEL_PROJECT_ID: 'prj_OTHER' }, { VERCEL_GIT_COMMIT_SHA: 'c'.repeat(40) },
        { VERCEL_GIT_COMMIT_REF: 'main' }, { GROQ_ADMIN_REPORT_TARGET_JSON: JSON.stringify({ ...target, protectionEvidenceRef: '' }) },
        { GROQ_ADMIN_REPORT_TARGET_JSON: JSON.stringify({ ...target, deploymentId: 'dpl_OLD' }) }, { GROQ_ADMIN_REPORT_APPROVAL_JSON: '{}' }])
        assert.equal(readConfig({ ...env(), ...delta }), null);
    for (const delta of [{ scope: 'research-fictional-v1' }, { authorityRef: '' }, { participantIds: [] },
        { endsAt: new Date(now).toISOString() }, { endsAt: new Date(now + 7200000).toISOString() },
        { terms: { ...terms, digest: 'b'.repeat(64) } }])
        assert.equal(readConfig({ ...env(), GROQ_ADMIN_REPORT_APPROVAL_JSON: JSON.stringify({ ...approval(), ...delta }) }), null);
    assert.equal(readConfig(env(), enableFixture, { ...consentTerms, AI_TERMS_VERSION: 'ai-assistance-v2-draft' }), null);
    assert.equal(readConfig(env(), source => source.replace('GROQ_ADMIN_REPORT_ENABLED = false', 'GROQ_ADMIN_REPORT_ENABLED = true')), null);
});
test('real action rejects anonymous/non-Admin/inactive/current-role mismatch and client metrics or identity', async () => {
    for (const actor of [null, { userId: 20, roleId: 2 }, { userId: 20, roleId: 3 }, { userId: 20, roleId: 4 }]) {
        const h = harness(); h.state.actor = actor;
        assert.equal((await h.actions.getAdminInterpretationAction(request)).mode, 'denied');
        assert.equal((await h.actions.getAdminInterpretationAvailabilityAction()).available, false);
        assert.equal(h.state.dispatches, 0); assert.equal(h.state.aggregates, 0);
    }
    for (const delta of [{ active: false }, { accountRole: 2 }]) {
        const h = harness(); Object.assign(h.state, delta);
        assert.equal((await h.actions.getAdminInterpretationAction(request)).mode, 'denied'); assert.equal(h.state.dispatches, 0);
    }
    for (const input of [{ ...request, userId: 20 }, { ...request, metrics: { totalUsers: '50-99' } }, {}]) {
        const h = harness(); assert.equal((await h.actions.getAdminInterpretationAction(input)).mode, 'denied'); assert.equal(h.state.aggregates, 0);
    }
});
test('adult verification, latest consent, explicit roster and revision binding remain required', async () => {
    for (const change of [s => { s.eligibility = null; }, s => { s.eligibility.revoked = true; },
        s => { s.eligibility.verifierUserId = 20; }, s => { s.eligibility.accountUpdatedAt = new Date(0); },
        s => { s.consent = null; }, s => { s.consent.eventKind = 'withdrawn'; },
        s => { s.consent.termsVersion = 'ai-assistance-v2-draft'; }, s => { s.consent.termsDigest = 'b'.repeat(64); },
        s => { s.consent.eligibilityEventId = 99; }, s => { s.approval.participantIds = [21]; }]) {
        const h = harness(); change(h.state);
        assert.equal((await h.actions.getAdminInterpretationAvailabilityAction()).available, false);
        assert.equal((await h.actions.getAdminInterpretationAction(request)).mode, 'denied');
        assert.deepEqual([h.state.aggregates, h.state.keyReads, h.state.dispatches], [0, 0, 0]);
        assert.equal((await h.local.getLocalAdminAssistance(request)).mode, 'static');
    }
});
test('only minimized four-band DTO reaches shared REST; generated response is typed and metadata-free', async () => {
    const h = harness(); assert.equal((await h.actions.getAdminInterpretationAvailabilityAction()).available, true);
    assert.deepEqual([h.state.aggregates, h.state.keyReads, h.state.reservations], [0, 0, 0]);
    const result = await h.actions.getAdminInterpretationAction(request);
    assert.equal(result.mode, 'generated'); assert.equal(result.success, true); assert.deepEqual(clone(result.output), goodOutput());
    assert.deepEqual(Object.keys(result).sort(), ['message', 'mode', 'output', 'success']);
    assert.equal(h.state.dispatches, 1); assert.equal(h.state.aggregates, 3); assert.equal(h.state.releases, 1);
    assert.equal(h.state.held, false); assert.equal(outbound, 0);
    const small = policy.minimizeAdminAggregate({ totalUsers: 4, totalGroups: 0, totalResearchPapers: 9, totalPublishedPapers: 5, approvedPapers: 9 });
    assert.deepEqual(clone(small.metrics), { totalResearchPapers: '5-9' });
    const suppressed = harness(); suppressed.state.totals = { totalUsers: 4, totalGroups: 0, totalResearchPapers: 4, totalPublishedPapers: 0, approvedPapers: 0 };
    assert.equal((await suppressed.actions.getAdminInterpretationAction(request)).mode, 'unavailable'); assert.equal(suppressed.state.dispatches, 0);
});
test('quota denial, missing credential and mid-request consent/approval/count changes prevent delivery', async () => {
    for (const change of [s => { s.quota = false; }, s => { s.credentials = false; },
        s => { s.afterReservation = () => { s.consent.eventKind = 'withdrawn'; }; },
        s => { s.afterReservation = () => { s.enabled = false; }; }]) {
        const h = harness(); change(h.state);
        assert.equal((await h.actions.getAdminInterpretationAction(request)).mode, 'unavailable'); assert.equal(h.state.dispatches, 0);
    }
    for (const change of [s => { s.enabled = false; }, s => { s.consent.eventKind = 'withdrawn'; },
        s => { s.totals.totalUsers = 200; }]) {
        const h = harness(); h.state.afterDispatch = () => change(h.state);
        assert.equal((await h.actions.getAdminInterpretationAction(request)).mode, 'unavailable'); assert.equal(h.state.dispatches, 1);
        assert.equal(h.state.releases, 1);
    }
});
test('malformed/unsafe/invented/trend/recommendation output falls back without retry', async () => {
    for (const value of ['', '{malformed', {}, { ...goodOutput(), extra: 'unapproved' },
        { ...goodOutput(), overview: '<script>bad</script>' }, { ...goodOutput(), overview: 'x'.repeat(801) },
        { ...goodOutput(), overview: 'Counts will increase tomorrow.' },
        { ...goodOutput(), overview: 'There are 73 accounts.' },
        { ...goodOutput(), explanations: [{ metricId: 'totalUsers', text: 'There are 75 accounts.' }] },
        { ...goodOutput(), explanations: [{ metricId: 'totalUsers', text: 'There are 50-9950-99 accounts.' }] },
        { ...goodOutput(), explanations: [{ metricId: 'totalUsers', text: 'Accounts comprise 50-99% of the total.' }] },
        { ...goodOutput(), explanations: [{ metricId: 'totalUsers', text: 'You should recruit more users.' }] },
        { ...goodOutput(), explanations: [{ metricId: 'privateMetric', text: 'Private content.' }] }]) {
        const h = harness(); h.state.output = value;
        assert.equal((await h.actions.getAdminInterpretationAction(request)).mode, 'unavailable');
        assert.equal(h.state.dispatches, 1); assert.equal(h.state.releases, 1);
    }
});
test('Admin UI initially renders honest unavailable/static controls; Adviser has no Admin Live control', () => {
    const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
    const component = load('components/dashboard/local-ai-assistance.tsx', {
        '@/components/dashboard/ai-governance-dialogs': { ConsentDialog: () => React.createElement('button', null, 'AI consent') },
        '@/lib/actions/ai-foundation.action': {}, '@/lib/actions/admin-ai-report.action': {},
    }).default;
    const admin = renderToStaticMarkup(React.createElement(component, { feature: 'admin' }));
    assert.match(admin, /Live AI is unavailable/); assert.match(admin, /Explain report metrics/);
    assert.match(admin, /disabled=""[^>]*>Interpret count bands with Live AI/);
    assert.match(admin, /human review/); assert.ok(!admin.includes('AI-generated count-band interpretation'));
    const adviser = renderToStaticMarkup(React.createElement(component, { feature: 'adviser' }));
    assert.ok(!adviser.includes('Interpret count bands with Live AI')); assert.match(adviser, /How do I start review/);
    assert.equal(preview.GROQ_RESEARCH_PILOT_ENABLED, false); assert.equal(preview.FINALIZED_RESEARCH_PILOT_TERMS, null);
    assert.equal(outbound, 0);
});
