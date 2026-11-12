/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const drafts = require('../lib/ai/research-demo-draft.ts');
const fixture = require('../lib/ai/adviser-research-demo.ts');
const scope = (patch = {}) => ({ accountId: 20, submissionId: 11, version: 'v1', mode: 'synthetic', authority: 'main', ...patch });
const now = Date.parse('2026-11-12T05:00:00Z');
function browser() {
    const map = new Map(), events = [];
    const storage = { get length() { return map.size; }, key: index => [...map.keys()][index] ?? null,
        getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) };
    global.window = { sessionStorage: storage, dispatchEvent: event => events.push(event) };
    global.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail; } };
    drafts.activateResearchDemoDraftAccount(20);
    return { map, storage, events };
}
const exchange = (task = 'writing', question = fixture.RESEARCH_DEMO_QUESTIONS[task]) => ({ question, answer: fixture.getResearchDemoAnswer(task, question) });
test('small versioned records persist only canonical selectors and reconstruct all tasks/follow-ups', () => {
    const { map } = browser();
    for (const task of fixture.RESEARCH_DEMO_TASKS) {
        const exchanges = [exchange(task), ...fixture.RESEARCH_DEMO_FOLLOWUPS.map(question => exchange(task, question))];
        assert.equal(drafts.saveResearchDemoDraft(scope(), task, exchanges, now), true);
        const raw = map.get(drafts.researchDemoDraftKey(scope()));
        assert.ok(Buffer.byteLength(raw) < 1024);
        assert.deepEqual(Object.keys(JSON.parse(raw)), ['schemaVersion', 'context', 'updatedAt', 'task', 'questions']);
        assert.deepEqual(JSON.parse(raw).questions, ['primary', 'explain', 'verify']);
        for (const text of [fixture.RESEARCH_DEMO_EXCERPT, exchanges[0].answer.observation, exchanges[0].question, 'feedback', 'fileUrl']) assert.ok(!raw.includes(text));
        assert.deepEqual(drafts.readResearchDemoDraft(scope(), now + 1), { task, exchanges });
    }
});
test('account/submission/version/Main/Co/assignment keys are isolated and context mismatch is rejected', () => {
    const { map } = browser(), original = scope(), key = drafts.researchDemoDraftKey(original);
    drafts.saveResearchDemoDraft(original, 'writing', [exchange()], now);
    const raw = map.get(key);
    for (const target of [scope({ accountId: 30 }), scope({ submissionId: 22 }), scope({ version: 'v2' }),
        scope({ authority: 'co', assignmentId: 41 }), scope({ authority: 'co', assignmentId: 42 })]) {
        assert.notEqual(drafts.researchDemoDraftKey(target), key);
        map.set(drafts.researchDemoDraftKey(target), raw);
        assert.equal(drafts.readResearchDemoDraft(target, now), null);
    }
    assert.ok(map.has(key));
});
test('four exchanges are retained; five exchanges and unknown tasks/questions are never stored', () => {
    const { map } = browser(), key = drafts.researchDemoDraftKey(scope());
    assert.equal(drafts.saveResearchDemoDraft(scope(), 'writing', Array(4).fill(exchange()), now), true);
    assert.equal(drafts.readResearchDemoDraft(scope(), now).exchanges.length, 4);
    for (const exchanges of [Array(5).fill(exchange()), [{ question: 'PRIVATE_MANUSCRIPT', answer: exchange().answer }], []]) {
        drafts.saveResearchDemoDraft(scope(), 'writing', exchanges, now); assert.equal(map.has(key), false);
    }
    drafts.saveResearchDemoDraft(scope(), 'unknown', [exchange()], now); assert.equal(map.has(key), false);
});
test('arbitrary answer text and generated-provider labels cannot enter storage', () => {
    const { map } = browser(), key = drafts.researchDemoDraftKey(scope());
    for (const patch of [{ observation: 'PRIVATE_CONTENT' }, { label: 'AI-GENERATED' }, { task: 'methodology' }, { feedback: 'PRIVATE_FEEDBACK' }]) {
        drafts.saveResearchDemoDraft(scope(), 'writing', [{ ...exchange(), answer: { ...exchange().answer, ...patch } }], now);
        assert.equal(map.has(key), false);
    }
});
test('malformed, oversized, old schema, unknown selectors and extra message bodies are removed', () => {
    const { map } = browser(), key = drafts.researchDemoDraftKey(scope());
    drafts.saveResearchDemoDraft(scope(), 'writing', [exchange()], now); const good = JSON.parse(map.get(key));
    for (const bad of ['{broken', 'x'.repeat(1025), 'é'.repeat(600), ...[
        { ...good, schemaVersion: 0 }, { ...good, questions: ['unknown'] }, { ...good, questions: Array(5).fill('primary') },
        { ...good, task: 'unknown' }, { ...good, body: 'PRIVATE' }, { ...good, context: { ...good.context, mode: 'generated' } },
    ].map(value => JSON.stringify(value))]) {
        map.set(key, bad); assert.equal(drafts.readResearchDemoDraft(scope(), now), null); assert.equal(map.has(key), false);
    }
});
test('future timestamps and two-hour stale drafts are removed without affecting another submission', () => {
    const { map } = browser(), other = scope({ submissionId: 22 });
    for (const time of [now - 1, now + drafts.RESEARCH_DEMO_DRAFT_TTL]) {
        drafts.saveResearchDemoDraft(scope(), 'writing', [exchange()], now);
        drafts.saveResearchDemoDraft(other, 'writing', [exchange()], now);
        assert.equal(drafts.readResearchDemoDraft(scope(), time), null);
        assert.ok(map.has(drafts.researchDemoDraftKey(other)));
    }
});
test('selected Reset/Finish cleanup preserves other submission and authority drafts', () => {
    const { map } = browser(), other = scope({ submissionId: 22 }), co = scope({ authority: 'co', assignmentId: 41 });
    for (const context of [scope(), other, co]) drafts.saveResearchDemoDraft(context, 'writing', [exchange()], now);
    drafts.removeResearchDemoDraft(scope());
    assert.equal(map.has(drafts.researchDemoDraftKey(scope())), false);
    for (const context of [other, co]) assert.ok(drafts.readResearchDemoDraft(context, now));
});
test('account switch clears this feature namespace, and old-account writers cannot recreate a draft', () => {
    const { map } = browser(); drafts.saveResearchDemoDraft(scope(), 'writing', [exchange()], now); map.set('unrelated:session', 'preserved');
    assert.equal(drafts.activateResearchDemoDraftAccount(30), true);
    assert.equal(map.has(drafts.researchDemoDraftKey(scope())), false);
    assert.equal(drafts.saveResearchDemoDraft(scope(), 'writing', [exchange()], now), false);
    assert.equal(map.get('unrelated:session'), 'preserved');
});
test('explicit logout clears only feature drafts and emits memory invalidation', () => {
    const { map, events } = browser();
    for (const context of [scope(), scope({ submissionId: 22 })]) drafts.saveResearchDemoDraft(context, 'writing', [exchange()], now);
    map.set('unrelated:session', 'preserved'); drafts.clearResearchDemoDrafts();
    assert.deepEqual([...map.entries()], [['unrelated:session', 'preserved']]);
    assert.equal(events.at(-1).type, drafts.RESEARCH_DEMO_DRAFT_CLEAR_EVENT); assert.equal(events.at(-1).detail, undefined);
});
test('storage failures and SSR fail safely and never prevent logout', () => {
    browser(); Object.defineProperty(window, 'sessionStorage', { get() { throw Error('STORAGE_BLOCKED'); } });
    assert.equal(drafts.readResearchDemoDraft(scope(), now), undefined); assert.equal(drafts.saveResearchDemoDraft(scope(), 'writing', [exchange()], now), false);
    assert.doesNotThrow(() => drafts.clearResearchDemoDrafts()); delete global.window;
    assert.equal(drafts.readResearchDemoDraft(scope(), now), undefined); assert.doesNotThrow(() => drafts.clearResearchDemoDrafts());
});
test('no persistent storage, provider or academic-writing dependencies', () => {
    const source = fs.readFileSync('lib/ai/research-demo-draft.ts', 'utf8');
    assert.doesNotMatch(source, /localStorage|indexedDB|fetch\(|repositories|process\.env|console\.|\.clear\(/);
    assert.match(fs.readFileSync('components/auth/logout-button.tsx', 'utf8'), /clearResearchDemoDrafts\(\);\s*await logoutWithResearchPushCleanup/);
});
