/* eslint-disable @typescript-eslint/no-require-imports */
// Offline: real config/actions/account resolver/adapters/rendering; synthetic auth/SQL/fetch boundaries.
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
let outbound = 0;
const forbidden = () => { outbound++; throw Error('OUTBOUND_FORBIDDEN'); };
global.fetch = forbidden;
for (const name of ['node:http', 'node:https']) { const api = require(name); api.get = forbidden; api.request = forbidden; }
const net = require('node:net'); net.connect = forbidden; net.createConnection = forbidden; net.Socket.prototype.connect = forbidden;
require('node:tls').connect = forbidden;
function load(file, mocks = {}, globals = {}) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    vm.runInNewContext(code, { exports, Buffer, Date, JSON, URL, AbortController, Response, TextDecoder, setTimeout, clearTimeout,
        fetch: forbidden, console: new Proxy({}, { get() { throw Error('LOGGING_FORBIDDEN'); } }), process: { env: {} }, ...globals,
        require(id) {
            if (Object.hasOwn(mocks, id)) return mocks[id];
            if (id === 'server-only') return {};
            if (/repositories|services|lib\/db|supabase|dotenv/.test(id)) throw Error('UNAPPROVED_DEPENDENCY');
            return require(id.startsWith('@/') ? path.resolve(id.slice(2)) : id);
        } }, { filename: file });
    return exports;
}
const clone = value => JSON.parse(JSON.stringify(value));
const target = { projectId: 'prj_SYNTHETIC', commitSha: 'b'.repeat(40), branch: 'feature/development', protectionEvidenceRef: 'SYNTHETIC_ONLY' };
const instant = Date.parse('2026-11-15T04:00:00Z');
const manifest = () => ({ target: { ...target }, origin: 'https://thesishs-ai-git-feature-development-thesi-shs-ai.vercel.app', adminUserId: 10, adviserUserId: 20,
    startsAt: new Date(instant - 1000).toISOString(), endsAt: new Date(instant + 3600000).toISOString() });
const environment = () => ({ NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_TARGET_ENV: 'preview',
    VERCEL_DEPLOYMENT_ID: 'dpl_SYNTHETIC', VERCEL_PROJECT_ID: target.projectId, VERCEL_GIT_COMMIT_REF: target.branch,
    VERCEL_GIT_COMMIT_SHA: target.commitSha, GROQ_DEVELOPER_EVALUATION_ENABLED: '1',
    GROQ_DEVELOPER_EVALUATION_JSON: JSON.stringify(manifest()), GROQ_API_KEY: 'SYNTHETIC_NOT_A_CREDENTIAL' });
const identity = load('lib/ai/groq-research-pilot-config.ts');
const rest = load('lib/ai/groq-rest.ts', { '@/lib/ai/groq-key': { loadGroqConfiguration: forbidden },
    '@/lib/ai/groq-provider': { getGroqAvailability: () => ({ enabled: false }) } });
const research = load('lib/ai/groq-research-pilot.ts', { '@/lib/ai/groq-rest': rest });
const policy = load('lib/ai/aggregate-policy.ts');
const fixtures = load('lib/ai/pilot-fixtures.ts', { './aggregate-policy': policy });
const request = { feature: 'adviser', submissionId: 11, questionId: 'primary' };
const adminRequest = { feature: 'admin' };
const writing = { observation: 'The fictional text repeats wording.', explanation: 'Its claim exceeds the supplied evidence.',
    suggestion: 'Consider a narrower statement about planning habits.' };
const admin = { version: 1, overview: 'Coarse bands describe recorded volume, not exact counts.', explanations: [
    { metricId: 'totalUsers', text: 'This metric counts accounts.' }, { metricId: 'totalGroups', text: 'This metric counts research groups.' },
    { metricId: 'totalResearchPapers', text: 'This metric counts research papers.' }, { metricId: 'totalPublishedPapers', text: 'This metric counts published papers.' },
] };
const wire = value => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: {
    role: 'assistant', tool_calls: null, content: typeof value === 'string' ? value : JSON.stringify(value),
} }] }), { headers: { 'content-type': 'application/json' } });
function harness() {
    const state = { env: environment(), now: instant, actor: { userId: 20, roleId: 2 }, active: true, currentRole: 2,
        main: 20, scope: true, origin: manifest().origin, site: 'same-origin', rows: [], quotaFail: false, releaseFail: false,
        calls: 0, reserved: 0, usageReads: 0, response: null, afterReserve: null, afterFetch: null };
    class Clock extends Date { static now() { return state.now; } }
    const config = load('lib/ai/developer-evaluation-config.ts', { '@/lib/ai/groq-research-pilot-config': identity },
        { process: { env: state.env }, Date: Clock });
    const principal = load('lib/auth/account-principal.ts', { '@/lib/repositories/user.repository': { findUserById: async () =>
        ({ id: state.actor?.userId, roleId: state.currentRole, isActive: state.active }) } });
    const current = load('lib/auth/current-account.ts', { '@/lib/auth/session': { getSession: async () => state.actor },
        '@/lib/auth/account-principal': principal });
    const main = load('lib/auth/main-adviser.ts', { '@/lib/auth/current-account': current,
        '@/lib/repositories/research-supervision.repository': { findCurrentMainAdviserId: async () => state.main } });
    const repository = {
        async reservePilotAttempt(userId, window) {
            state.reserved++;
            assert.equal(window.startsAt.toISOString(), manifest().startsAt); assert.equal(window.endsAt.toISOString(), manifest().endsAt);
            if (state.quotaFail || state.rows.some(row => !row.released) || state.rows.length >= 2 ||
                state.rows.some(row => state.now - row.at < 120000)) return null;
            const id = String(state.rows.length + 1); state.rows.push({ id, userId, at: state.now, released: false });
            state.afterReserve?.(); return id;
        },
        async releasePilotAttempt(id) { if (state.releaseFail) throw Error('RELEASE_FAIL'); state.rows.find(row => row.id === id).released = true; },
        async getPilotWindowUsage() {
            state.usageReads++; if (state.quotaFail) throw Error('QUOTA_UNAVAILABLE');
            return { remaining: Math.max(0, 2 - state.rows.length), busy: state.rows.some(row => !row.released),
                waitSeconds: state.rows.length ? Math.max(0, Math.ceil((120000 - (state.now - state.rows.at(-1).at)) / 1000)) : 0 };
        },
    };
    const quota = load('lib/auth/ai-pilot-limits.ts', { '@/lib/repositories/ai-pilot-quota.repository': repository });
    const service = load('lib/services/developer-ai-evaluation.service.ts', {
        'next/headers': { headers: async () => ({ get: key => key === 'origin' ? state.origin : key === 'sec-fetch-site' ? state.site : null }) },
        '@/lib/ai/developer-evaluation-config': config, '@/lib/auth/current-account': current, '@/lib/auth/main-adviser': main,
        '@/lib/repositories/adviser-submission.repository': { canAccessResearchDemoSubmission: async (id, actor) => state.scope && id === 11 && actor === 20 },
        '@/lib/repositories/co-adviser.repository': { canAccessResearchDemoAssignment: async (actor, assignment, submission) => state.scope && actor === 20 && assignment === 41 && submission === 11 },
        '@/lib/auth/ai-pilot-limits': quota, '@/lib/repositories/ai-pilot-quota.repository': repository,
        '@/lib/ai/groq-research-pilot': research, '@/lib/ai/groq-rest': rest, '@/lib/ai/pilot-fixtures': fixtures,
    }, { process: { env: state.env }, fetch: async (url, init) => {
        state.calls++; assert.ok(state.rows.some(row => !row.released));
        assert.equal(url, rest.GROQ_ENDPOINT); const body = JSON.parse(init.body);
        assert.equal(body.model, 'openai/gpt-oss-20b'); assert.equal(body.max_completion_tokens, 1024);
        assert.equal(init.redirect, 'error'); assert.ok(!/accountId|submissionId|email|authorityRef|approvedPapers/.test(init.body));
        const payload = JSON.parse(body.messages[1].content);
        if (payload.feature === 'admin') assert.deepEqual(payload, clone(fixtures.getSyntheticPilotPayload('admin-overview-v1')));
        else { assert.equal(payload.task, 'writing'); assert.match(payload.excerpt, /FICTIONAL EXAMPLE/); assert.deepEqual(Object.keys(payload).sort(), ['excerpt', 'question', 'task']); }
        state.afterFetch?.();
        return state.response ? state.response() : wire(payload.feature === 'admin' ? admin : writing);
    } });
    const action = load('lib/actions/developer-ai-evaluation.action.ts', { '@/lib/services/developer-ai-evaluation.service': service });
    return { state, config: config.getDeveloperEvaluationConfiguration, run: action.runDeveloperEvaluationAction,
        availability: action.getDeveloperEvaluationAvailabilityAction };
}

test('only enabled exact protected Preview identity and active bounded window qualify', () => {
    assert.ok(harness().config());
    const changes = [ ['NODE_ENV','development'], ['NODE_ENV','test'], ['VERCEL','0'], ['VERCEL_ENV','production'],
        ['VERCEL_ENV','development'], ['VERCEL_TARGET_ENV','production'], ['CI','1'], ['VERCEL_PROJECT_ID','prj_OTHER'],
        ['VERCEL_GIT_COMMIT_REF','main'], ['VERCEL_GIT_COMMIT_SHA','c'.repeat(40)], ['VERCEL_DEPLOYMENT_ID',undefined],
        ['VERCEL_DEPLOYMENT_ID','spoofed'], ['GROQ_DEVELOPER_EVALUATION_ENABLED','0'], ['GROQ_DEVELOPER_EVALUATION_JSON','{}'] ];
    for (const [key,value] of changes) { const h = harness(); h.state.env[key] = value; assert.equal(h.config(), null, key); }
    for (const field of ['projectId','commitSha','branch','protectionEvidenceRef']) {
        const h = harness(), config = manifest(); delete config.target[field];
        h.state.env.GROQ_DEVELOPER_EVALUATION_JSON = JSON.stringify(config); assert.equal(h.config(), null, field);
    }
    for (const config of [{ ...manifest(), endsAt: new Date(instant - 1).toISOString() },
        { ...manifest(), endsAt: new Date(instant + 3 * 3600000).toISOString() }, { ...manifest(), origin: 'http://evaluation.example' },
        { ...manifest(), adminUserId: 20 }, { ...manifest(), extra: true }]) {
        const h = harness(); h.state.env.GROQ_DEVELOPER_EVALUATION_JSON = JSON.stringify(config); assert.equal(h.config(), null);
    }
});

test('disabled configuration does not read quota or dispatch; unauthenticated/unlisted/inactive/wrong-role deny', async () => {
    const changes = [ state => { state.env.GROQ_DEVELOPER_EVALUATION_ENABLED = '0'; }, state => { state.actor = null; },
        state => { state.actor.userId = 99; }, state => { state.active = false; }, state => { state.currentRole = 3; },
        state => { state.actor.roleId = 1; state.currentRole = 1; } ];
    for (const change of changes) {
        const h = harness(); change(h.state);
        assert.equal((await h.availability(request)).available, false); assert.equal((await h.run(request)).mode, 'unavailable');
        assert.equal(h.state.calls, 0); assert.equal(h.state.reserved, 0); assert.equal(h.state.usageReads, 0);
    }
});

test('same-origin requests are mandatory and cross-feature or unassigned access denies', async () => {
    for (const origin of [null, 'https://attacker.example', 'https://older-immutable-preview.vercel.app']) {
        const h = harness(); h.state.origin = origin; assert.equal((await h.run(request)).mode, 'unavailable'); assert.equal(h.state.calls, 0);
    }
    const crossSite = harness(); crossSite.state.site = 'cross-site'; assert.equal((await crossSite.run(request)).mode, 'unavailable');
    const adviser = harness(); assert.equal((await adviser.run(adminRequest)).mode, 'unavailable');
    const adminUser = harness(); adminUser.state.actor = { userId: 10, roleId: 1 }; adminUser.state.currentRole = 1;
    assert.equal((await adminUser.run(request)).mode, 'unavailable');
    const inaccessible = harness(); inaccessible.state.scope = false;
    assert.equal((await inaccessible.run(request)).mode, 'unavailable'); assert.equal(inaccessible.state.reserved, 0);
});

test('strict selectors reject arbitrary prompts/models/payloads and wrong task/question before reservation', async () => {
    for (const input of [{ ...request, prompt: 'arbitrary' }, { ...request, model: 'other' }, { ...request, questionId: 'arbitrary' },
        { ...request, task: 'methodology' }, { ...adminRequest, metrics: {} }, { ...adminRequest, submissionId: 11 },
        { feature: 'adviser', questionId: 'primary' }, null]) {
        const h = harness(); assert.equal((await h.run(input)).mode, 'unavailable'); assert.equal(h.state.reserved, 0); assert.equal(h.state.calls, 0);
    }
});

test('Main and exact assigned Co get validated fictional writing output; no academic or governance operations', async () => {
    for (const co of [false, true]) {
        const h = harness(); if (co) h.state.main = 30;
        const result = await h.run({ ...request, ...(co ? { assignmentId: 41 } : {}) });
        assert.equal(result.mode, 'generated'); assert.equal(result.feature, 'adviser'); assert.equal(result.answer.suggestion, writing.suggestion);
        assert.equal(h.state.calls, 1); assert.equal(h.state.rows.length, 1); assert.equal(h.state.rows[0].released, true);
    }
});

test('Admin fixed synthetic bands stay server-owned; suppressed values cannot be inferred', async () => {
    const h = harness(); h.state.actor = { userId: 10, roleId: 1 }; h.state.currentRole = 1;
    const available = await h.availability(adminRequest); assert.equal(available.available, true);
    assert.equal(Object.keys(available.syntheticBands).length, 4); assert.equal(h.state.calls, 0);
    const result = await h.run(adminRequest); assert.equal(result.mode, 'generated'); assert.equal(result.feature, 'admin');
    for (const item of result.output.explanations) assert.equal(item.band, available.syntheticBands[item.metricId]);
    const suppressed = policy.minimizeAdminAggregate({ totalUsers: 4, totalGroups: 5, totalResearchPapers: 10, approvedPapers: 5, totalPublishedPapers: 5 });
    assert.equal(suppressed.metrics.totalUsers, undefined); assert.equal(suppressed.metrics.totalPublishedPapers, undefined);
});

test('invalid generated claims/metrics/bands, malformed content, provider error and reflected credential fall back', async () => {
    for (const value of ['{bad json', { ...admin, overview: 'Administrators should prioritize growth.' },
        { ...admin, explanations: [{ metricId: 'totalUsers', text: 'There are 999 accounts.' }] },
        { ...admin, explanations: [{ metricId: 'other', text: 'Recorded volume.' }] },
        { ...admin, explanations: [{ ...admin.explanations[0], band: '5-9' }] },
        { ...admin, overview: 'SYNTHETIC_NOT_A_CREDENTIAL' }]) {
        const h = harness(); h.state.actor = { userId: 10, roleId: 1 }; h.state.currentRole = 1; h.state.response = () => wire(value);
        assert.equal((await h.run(adminRequest)).mode, 'unavailable'); assert.equal(h.state.calls, 1); assert.equal(h.state.rows.length, 1);
    }
    const error = harness(); error.state.response = () => new Response('', { status: 429 });
    assert.equal((await error.run(request)).mode, 'unavailable'); assert.equal(error.state.calls, 1);
});

test('configuration/role/assignment revocation or expiry before dispatch/delivery fails closed and consumes reserved attempt', async () => {
    for (const stage of ['afterReserve','afterFetch']) {
        for (const change of [state => { state.env.GROQ_DEVELOPER_EVALUATION_ENABLED = '0'; },
            state => { state.currentRole = 3; }, state => { state.scope = false; }, state => { state.now += 7200000; }]) {
            const h = harness(); h.state[stage] = () => change(h.state);
            assert.equal((await h.run(request)).mode, 'unavailable'); assert.equal(h.state.rows.length, 1);
            assert.equal(h.state.calls, stage === 'afterFetch' ? 1 : 0); assert.equal(h.state.rows[0].released, true);
        }
    }
});

test('service preserves shared window/cooldown/slot, failures count and no credential/quota outage can dispatch', async () => {
    const h = harness(); h.state.response = () => new Response('', { status: 503 });
    await h.run(request); assert.equal(h.state.rows.length, 1);
    h.state.actor = { userId: 10, roleId: 1 }; h.state.currentRole = 1;
    assert.equal((await h.run(adminRequest)).mode, 'unavailable'); assert.equal(h.state.calls, 1);
    h.state.now += 120000; await h.run(adminRequest); assert.equal(h.state.rows.length, 2);
    h.state.now += 120000; await h.run(adminRequest); assert.equal(h.state.calls, 2);
    assert.equal((await h.availability(adminRequest)).budget.remaining, 0);
    const failed = harness(); failed.state.quotaFail = true;
    assert.equal((await failed.availability(request)).available, false); await failed.run(request); assert.equal(failed.state.calls, 0);
    const key = harness(); key.state.env.GROQ_API_KEY = undefined; await key.run(request); assert.equal(key.state.reserved, 0);
    const held = harness(); let resolve;
    held.state.response = () => new Promise(done => { resolve = () => done(wire(writing)); });
    const first = held.run(request);
    while (!resolve) await new Promise(done => setTimeout(done, 0));
    held.state.now += 120000; assert.equal((await held.run(request)).mode, 'unavailable'); assert.equal(held.state.calls, 1);
    resolve(); await first;
});

test('durable quota status uses bounded parameterized SQL, exposes only counters, and rejects invalid rows', async () => {
    const { PgDialect } = require('drizzle-orm/pg-core'); const dialect = new PgDialect();
    let row = { attempts: 1, busy: false, wait_seconds: 34 };
    const repo = load('lib/repositories/ai-pilot-quota.repository.ts', { '@/lib/db': { db: { execute: async query => {
        const compiled = dialect.sqlToQuery(query); assert.ok(!/insert|update|delete/i.test(compiled.sql));
        assert.match(compiled.sql, /released_at is null/); assert.match(compiled.sql, /120 seconds/);
        assert.deepEqual(compiled.params, [manifest().startsAt, manifest().endsAt, manifest().startsAt, manifest().endsAt]); return [row];
    } } } });
    const window = { startsAt: new Date(manifest().startsAt), endsAt: new Date(manifest().endsAt) };
    assert.deepEqual(clone(await repo.getPilotWindowUsage(window)), { remaining: 1, busy: false, waitSeconds: 34 });
    for (const bad of [{ ...row, attempts: '1' }, { ...row, busy: 'false' }, { ...row, wait_seconds: -1 }]) {
        row = bad; await assert.rejects(repo.getPilotWindowUsage(window));
    }
});

test('minimal UI distinguishes generated output, fixed bands, unavailable and disabled states without persistence', () => {
    const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
    function render(result, feature, availability = { available: true, budget: { remaining: 1, busy: false, waitSeconds: 0 },
        syntheticBands: fixtures.getSyntheticPilotPayload('admin-overview-v1').metrics }) {
        const states = [availability, 0, 'primary', result, false]; let index = 0;
        const component = load('components/dashboard/developer-ai-evaluation.tsx', {
            react: { ...React, useEffect: () => {}, useRef: value => ({ current: value }), useState: () => [states[index++], () => {}] },
            '@/lib/actions/developer-ai-evaluation.action': { getDeveloperEvaluationAvailabilityAction: forbidden, runDeveloperEvaluationAction: forbidden },
        }).default;
        return renderToStaticMarkup(React.createElement(component, feature === 'admin' ? { feature } : { feature, submissionId: 11 }));
    }
    const generated = { mode: 'generated', feature: 'admin', output: { ...admin, explanations: admin.explanations.map(item => ({ ...item,
        band: fixtures.getSyntheticPilotPayload('admin-overview-v1').metrics[item.metricId] })) } };
    const html = render(generated, 'admin'); assert.match(html, /Developer Evaluation — Synthetic Data/);
    assert.match(html, /Groq-generated/); assert.match(html, /Accounts \(5-9\)/); assert.match(html, /Fixed synthetic count bands/);
    assert.equal(render(null, 'admin', { available: false }), '');
    assert.match(render({ mode: 'unavailable', message: 'Evaluation unavailable.' }, 'adviser'), /Evaluation unavailable/);
    assert.ok(!html.includes('SYNTHETIC_NOT_A_CREDENTIAL'));
});

test('no network, institutional aggregates or governance mutation modules were loaded', () => {
    assert.equal(outbound, 0);
    assert.ok(!Object.keys(require.cache).some(file => /admin-ai-aggregate\.repository|ai-governance\.repository|lib[\\/]db\./.test(file)));
});
