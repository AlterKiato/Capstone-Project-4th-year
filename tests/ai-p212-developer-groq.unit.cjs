/* eslint-disable @typescript-eslint/no-require-imports */
// Offline only: actual application adapters/fixtures, forbidden network and DB boundaries.
const { test } = require('node:test'), assert = require('node:assert/strict');
const Module = require('node:module');
let outbound = 0;
const forbidden = () => { outbound++; throw Error('OUTBOUND_FORBIDDEN'); };
global.fetch = forbidden;
for (const name of ['node:http', 'node:https']) { const api = require(name); api.request = forbidden; api.get = forbidden; }
const net = require('node:net'); net.connect = forbidden; net.createConnection = forbidden; net.Socket.prototype.connect = forbidden;
require('node:tls').connect = forbidden;
const cli = require('../scripts/groq-developer-test.cjs');
const originalLoad = Module._load;
let adapters;
try {
    Module._load = function(id, ...args) {
        if (/repositories|services|actions|(?:^|\/)db(?:\.|\/)|dotenv|supabase/.test(id)) throw Error('APP_BOUNDARY_FORBIDDEN');
        return originalLoad.call(this, id, ...args);
    };
    adapters = cli.loadAdapters();
} finally { Module._load = originalLoad; }
const key = 'SYNTHETIC_NOT_A_CREDENTIAL';
const writing = { observation: 'The fictional example repeats wording.', explanation: 'The claim exceeds the supplied evidence.',
    suggestion: 'Consider a narrower statement about planning habits.' };
const admin = { version: 1, overview: 'These bands describe coarse recorded volumes, not exact counts.', explanations: [
    { metricId: 'totalUsers', text: 'This metric counts registered accounts.' },
    { metricId: 'totalGroups', text: 'This metric counts research groups.' },
    { metricId: 'totalResearchPapers', text: 'This metric counts research papers.' },
    { metricId: 'totalPublishedPapers', text: 'This metric counts published papers.' },
] };
const wire = value => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: {
    role: 'assistant', content: typeof value === 'string' ? value : JSON.stringify(value), tool_calls: null,
} }] }), { headers: { 'content-type': 'application/json' } });
function harness(transport = async (_url, init) => wire(JSON.parse(init.body).response_format.json_schema.name === 'aggregate_interpretation' ? admin : writing), overrides = {}) {
    let clock = 0, calls = 0, keyReads = 0;
    const session = cli.createSession({ adapters, transport: async (...args) => { calls++; return transport(...args); },
        readKey: () => { keyReads++; return key; }, allowed: () => true, now: () => clock, ...overrides });
    return { session, advance: ms => { clock += ms; }, calls: () => calls, keyReads: () => keyReads };
}

test('explicit local native terminal only; hosted, CI, SSH, missing enablement and non-TTY deny', () => {
    const local = { NODE_ENV: 'development', THESISHS_DEVELOPER_GROQ_TEST: '1' }, tty = { input: true, output: true };
    assert.equal(cli.localTerminalAllowed(local, tty), true);
    for (const NODE_ENV of ['production', 'test', undefined]) assert.equal(cli.localTerminalAllowed({ ...local, NODE_ENV }, tty), false);
    for (const flag of ['CI', 'VERCEL', 'VERCEL_ENV', 'VERCEL_TARGET_ENV', 'VERCEL_PROJECT_ID', 'VERCEL_DEPLOYMENT_ID', 'NEXT_RUNTIME', 'SSH_CONNECTION', 'SSH_CLIENT', 'SSH_TTY'])
        assert.equal(cli.localTerminalAllowed({ ...local, [flag]: 'present' }, tty), false, flag);
    for (const enable of [undefined, '0', 'true']) assert.equal(cli.localTerminalAllowed({ ...local, THESISHS_DEVELOPER_GROQ_TEST: enable }, tty), false);
    assert.equal(cli.localTerminalAllowed(local, { input: false, output: true }), false);
    assert.equal(cli.localTerminalAllowed(local, { input: true, output: false }), false);
});

test('native CLI refuses piped execution before reading a credential or loading adapters', () => {
    const { spawnSync } = require('node:child_process');
    const result = spawnSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', 'scripts/groq-developer-test.cjs'], { encoding: 'utf8', env: {
        SystemRoot: process.env.SystemRoot, PATH: process.env.PATH, NODE_ENV: 'development', THESISHS_DEVELOPER_GROQ_TEST: '1',
    } });
    assert.equal(result.status, 1); assert.match(result.stdout, /Denied/); assert.equal(result.stderr, '');
});

test('arbitrary input and disallowed execution fail before key lookup, reservation or dispatch', async () => {
    const h = harness();
    for (const input of [null, {}, { feature: 'admin', prompt: 'arbitrary' }, 'admin?model=other', 'writing', 1])
        assert.equal((await h.session.generate(input)).mode, 'unavailable');
    assert.equal(h.keyReads(), 0); assert.equal(h.calls(), 0); assert.equal(h.session.status().remaining, 2);
    const denied = harness(undefined, { allowed: () => false });
    assert.equal((await denied.session.generate('admin')).mode, 'unavailable'); assert.equal(denied.keyReads(), 0);
    const missing = harness(undefined, { readKey: () => undefined });
    assert.equal((await missing.session.generate('admin')).mode, 'unavailable'); assert.equal(missing.calls(), 0);
    assert.equal(missing.session.status().remaining, 2);
});

test('Adviser selectors use only the existing fictional writing prompt and reviewed questions', async () => {
    for (const [selection, question] of [
        ['adviser-primary', adapters.questions.RESEARCH_DEMO_QUESTIONS.writing],
        ['adviser-explain-improvement', adapters.questions.RESEARCH_DEMO_FOLLOWUPS[0]],
        ['adviser-verify-next', adapters.questions.RESEARCH_DEMO_FOLLOWUPS[1]],
    ]) {
        const h = harness(async (url, init) => {
            assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
            const body = JSON.parse(init.body);
            assert.equal(body.model, 'openai/gpt-oss-20b'); assert.equal(body.max_completion_tokens, 1024);
            assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store');
            assert.deepEqual(JSON.parse(body.messages[1].content), { task: 'writing', excerpt: adapters.questions.RESEARCH_DEMO_EXCERPT, question });
            assert.ok(!/submissionId|accountId|participantId/.test(init.body)); return wire(writing);
        });
        const result = await h.session.generate(selection);
        assert.equal(result.mode, 'generated'); assert.equal(result.answer.observation, writing.observation); assert.equal(h.calls(), 1);
    }
});

test('Admin reuses the fixed minimized fixture and binds canonical bands on the application side', async () => {
    const payload = adapters.fixtures.getSyntheticPilotPayload('admin-overview-v1');
    assert.deepEqual(payload.metrics, { totalUsers: '5-9', totalGroups: '10-19', totalResearchPapers: '10-19', totalPublishedPapers: '5-9' });
    const h = harness(async (_url, init) => {
        const body = JSON.parse(init.body);
        assert.deepEqual(JSON.parse(body.messages[1].content), payload);
        assert.ok(!/approvedPapers|accountId/.test(init.body)); return wire(admin);
    });
    const result = await h.session.generate('admin');
    assert.equal(result.mode, 'generated');
    for (const item of result.output.explanations) assert.equal(item.band, payload.metrics[item.metricId]);
});

test('Admin invalid metrics, invented values, trends, recommendations and model-owned bands fall back', async () => {
    const invalid = [
        { ...admin, explanations: [{ metricId: 'unapprovedMetric', text: 'Recorded volume.' }] },
        { ...admin, explanations: [{ metricId: 'totalUsers', text: 'Recorded volume is 999.' }] },
        { ...admin, overview: 'Historical trends show growth.' },
        { ...admin, overview: 'Administrators should prioritize action.' },
        { ...admin, explanations: [{ ...admin.explanations[0], band: '5-9' }] },
        '{invalid json', { wrong: true },
    ];
    for (const output of invalid) {
        const h = harness(async () => wire(output));
        assert.notEqual((await h.session.generate('admin')).mode, 'generated'); assert.equal(h.calls(), 1);
        assert.equal(h.session.status().remaining, 1);
    }
});

test('one global slot, shared two-attempt budget and 120-second cooldown across both features', async () => {
    let release;
    const h = harness(() => new Promise(resolve => { release = () => resolve(wire(writing)); }));
    const first = h.session.generate('adviser-primary');
    assert.equal(h.session.status().busy, true); h.advance(120000);
    assert.equal((await h.session.generate('admin')).mode, 'unavailable'); assert.equal(h.calls(), 1);
    release(); assert.equal((await first).mode, 'generated');
    const second = h.session.generate('adviser-primary'); release(); await second;
    h.advance(120000); assert.equal((await h.session.generate('admin')).mode, 'unavailable');
    assert.equal(h.calls(), 2); assert.equal(h.session.status().remaining, 0);
    const cooldown = harness(); await cooldown.session.generate('adviser-primary'); cooldown.advance(119999);
    assert.equal((await cooldown.session.generate('admin')).mode, 'unavailable'); assert.equal(cooldown.calls(), 1);
    cooldown.advance(1); assert.equal((await cooldown.session.generate('admin')).mode, 'generated'); assert.equal(cooldown.calls(), 2);
});

test('provider and timeout failures consume attempts, release the slot and never retry', async () => {
    for (const transport of [async () => { throw Error('private provider failure'); }, async () => new Response('', { status: 429 })]) {
        const h = harness(transport); assert.notEqual((await h.session.generate('admin')).mode, 'generated');
        assert.equal(h.calls(), 1); assert.equal(h.session.status().remaining, 1); assert.equal(h.session.status().busy, false);
        assert.equal((await h.session.generate('adviser-primary')).mode, 'unavailable'); assert.equal(h.calls(), 1);
    }
    const fastDeadline = (ms, callback) => { assert.equal(ms, 10000); const id = setTimeout(callback, 1); return () => clearTimeout(id); };
    const timed = harness(async () => new Promise(() => {}), { adapters: { ...adapters, rest: { ...adapters.rest,
        createGroqRESTTransport: transport => adapters.rest.createGroqRESTTransport(transport, fastDeadline) } } });
    assert.notEqual((await timed.session.generate('admin')).mode, 'generated'); assert.equal(timed.calls(), 1);
    assert.equal(timed.session.status().remaining, 1); assert.equal(timed.session.status().busy, false);
});

test('credential reflection and terminal control sequences cannot be displayed', async () => {
    const h = harness(async () => wire({ ...admin, overview: key }));
    const result = await h.session.generate('admin'); assert.equal(result.mode, 'unavailable');
    const lines = []; cli.present(result, value => lines.push(value)); assert.ok(!lines.join('\n').includes(key));
    assert.equal(cli.terminalText('\x1b[2Jhello\x9bbye'), '[2Jhellobye');
    const generated = []; cli.present(await harness().session.generate('admin'), value => generated.push(value));
    assert.match(generated.join('\n'), /ACTUAL GROQ OUTPUT/); assert.match(generated.join('\n'), /totalUsers \(5-9\)/);
});

test('no real network or application database dependency was used', () => {
    assert.equal(outbound, 0);
    assert.ok(!Object.keys(require.cache).some(file => /[\\/]lib[\\/](?:db\.|repositories[\\/]|actions[\\/])/.test(file)));
});
