/* eslint-disable @typescript-eslint/no-require-imports */
// node --import tsx --test tests/phase10-e4b1-timestamps.unit.cjs
// node --import tsx tests/phase10-e4b1-timestamps.unit.cjs --local-postgres also checks rollback-only temporary fixtures.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const { getTableColumns, desc } = require('drizzle-orm');
const { drizzle } = require('drizzle-orm/pg-proxy');
const { pgSchema, integer, timestamp } = require('drizzle-orm/pg-core');
const schema = require('../db/schema/index.ts');
const instant = '2026-11-21T16:30:00.000Z'; // A boundary fixture, never a reporting cutover.
const wireTime = '2026-11-21 16:30:00';
const expression = "(clock_timestamp() at time zone 'UTC')";
const local = process.argv.includes('--local-postgres');

function load(file, mocks) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports, Date, require(id) {
        if (Object.hasOwn(mocks, id)) return mocks[id];
        if (/lib\/db|postgres|dotenv/.test(id)) throw Error('Live adapter forbidden in offline fixture');
        return require(id.startsWith('@/') ? path.resolve(id.slice(2)) : id);
    } });
    return exports;
}

function fixture() {
    const state = { queries: [], transactions: [], freezes: [], main: true, stale: false, fail: false };
    const row = (table, data) => Object.keys(getTableColumns(table)).map(key => data[key] ?? null);
    const db = drizzle(async (query, params) => {
        state.queries.push({ query, params });
        if (query.startsWith('insert into "submissions"')) return { rows: [row(schema.submissions,
            { id: 9, paperId: 4, submittedBy: 3, version: params[2], fileUrl: 'synthetic.pdf', status: 'Submitted', submittedAt: wireTime })] };
        if (query.startsWith('insert into "feedbacks"')) return { rows: [row(schema.feedbacks,
            { id: 7, submissionId: 9, teacherId: 1, comments: 'Synthetic', decision: params[3], createdAt: wireTime })] };
        if (query.startsWith('insert into "activity_logs"') && state.fail) throw Error('Injected audit failure');
        if (query.startsWith('update "submissions"')) return { rows: [[9]] };
        if (query.startsWith('update "research_papers"')) return { rows: [[4]] };
        if (query.includes('from "users"')) return { rows: [[3, true]] };
        if (query.includes('from "research_groups"')) return { rows: [[2, 'active', 1]] };
        if (query.includes('from "group_members"')) return { rows: [[1]] };
        if (query.includes('from "research_papers"')) return { rows: query.includes('"title"') ? [[4, 2, 'Synthetic']] : [[2]] };
        if (query.includes('from "submissions"') && query.includes('"status"') && !query.includes('"submitted_at"'))
            return { rows: [[4, state.stale ? 'Approved' : 'Under Review']] };
        return { rows: [] };
    });
    db.transaction = async work => {
        state.transactions.push('begin');
        try { const result = await work(Object.create(db)); state.transactions.push('commit'); return result; }
        catch (error) { state.transactions.push('rollback'); throw error; }
    };
    const mocks = {
        '@/lib/db': { db }, '@/db/schema': schema,
        './research-supervision.repository': { lockCurrentMainAdviser: async () => state.main },
        './revision.repository': { freezeRevisionResponses: async (_tx, paperId, id) => { state.freezes.push([paperId, id]); } },
        './co-adviser.repository': { closeOpenDelegationsForDecision: async () => {} },
        './submission-evaluation.repository': { prepareOfficialEvaluation: async () => null, insertOfficialEvaluation: async () => {} },
    };
    const submissions = load('lib/repositories/submission.repository.ts', mocks);
    const feedback = load('lib/repositories/feedback.repository.ts', mocks);
    const uploads = load('lib/repositories/submission-upload.repository.ts', mocks).createSubmissionUploadRepository(db);
    return { state, submissions, feedback, uploads };
}

const submission = version => ({ paperId: 4, submittedBy: 3, version, fileUrl: 'synthetic.pdf', status: 'Submitted', submittedAt: new Date(0) });
const decision = value => ({ submissionId: 9, paperId: 4, teacherId: 1, comments: 'Synthetic', decision: value,
    expectedSubmissionStatus: 'Under Review', researchStatus: value, activityAction: 'Review', activityDescription: 'Synthetic' });
const cases = [
    ...['v1', 'v2'].map(version => ({ name: `legacy submission ${version}`, table: 'submissions', field: 'submittedAt', run: f => f.submissions.createSubmission(submission(version)) })),
    ...['v1', 'v2'].map(version => ({ name: `upload finalization ${version}`, table: 'submissions', field: 'submittedAt', run: f =>
        f.uploads.locked(3, 4, tx => tx.submit({ finalPath: 'synthetic.pdf', remarks: null }, version)) })),
    ...['Approved', 'Revision Required'].map(value => ({ name: `official ${value}`, table: 'feedbacks', field: 'createdAt', run: f => f.feedback.persistAdviserDecision(decision(value)) })),
    ...['Approved', 'Revision Required'].map(value => ({ name: `legacy feedback ${value}`, table: 'feedbacks', field: 'createdAt', run: f =>
        f.feedback.createFeedback({ submissionId: 9, teacherId: 1, comments: 'Synthetic', decision: value, createdAt: new Date(0) }) })),
];

for (const item of cases) test(`${item.name} emits an explicit UTC database clock and reads as the same instant`, async () => {
    const f = fixture(), result = await item.run(f);
    assert.equal(result[item.field].toISOString(), instant);
    const insert = f.state.queries.find(entry => entry.query.startsWith(`insert into "${item.table}"`));
    assert.ok(insert.query.includes(expression), 'UTC normalization must be inside the INSERT');
    assert.ok(!insert.params.includes('1970-01-01T00:00:00.000Z'), 'A caller cannot replace the event clock');
    if (item.table === 'submissions') assert.deepEqual(f.state.freezes, [[4, 9]]);
    if (!item.name.startsWith('legacy feedback')) assert.deepEqual(f.state.transactions, ['begin', 'commit']);
});

test('Main authority, stale decision rejection, review-start and late-failure rollback stay in their existing transactions', async () => {
    const denied = fixture(); denied.state.main = false;
    assert.equal(await denied.feedback.persistAdviserDecision(decision('Approved')), null);
    assert.ok(!denied.state.queries.some(entry => entry.query.startsWith('insert')));
    const stale = fixture(); stale.state.stale = true;
    await assert.rejects(stale.feedback.persistAdviserDecision(decision('Revision Required')), /status changed/);
    assert.deepEqual(stale.state.transactions, ['begin', 'rollback']);
    const late = fixture(); late.state.fail = true;
    await assert.rejects(late.feedback.persistAdviserDecision(decision('Approved')), error => error.cause?.message === 'Injected audit failure');
    assert.deepEqual(late.state.transactions, ['begin', 'rollback']);
    const review = fixture(); await review.submissions.updateSubmissionStatusForAdviser(9, 'Under Review', 1);
    assert.ok(!review.state.queries.some(entry => entry.query.includes(expression)));
});

test('UTC reader and Manila midnight presentation preserve existing decoding without reinterpreting historical strings', () => {
    for (const column of [schema.submissions.submittedAt, schema.feedbacks.createdAt]) {
        assert.equal(column.getSQLType(), 'timestamp');
        assert.equal(column.mapToDriverValue(new Date(instant)), instant);
        assert.equal(column.mapFromDriverValue(wireTime).toISOString(), instant);
        assert.equal(column.mapFromDriverValue('2020-01-02 03:04:05').toISOString(), '2020-01-02T03:04:05.000Z');
    }
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(new Date(instant));
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    assert.equal(`${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}`, '2026-11-22 00:30');
});

test('local PostgreSQL stores emitted UTC writes and reads them through Drizzle using rollback-only temporary fixtures', { skip: !local }, async () => {
    assert.notEqual(process.env.NODE_ENV, 'production');
    assert.ok(!['preview', 'production'].includes(process.env.VERCEL_ENV));
    // Parse existing local configuration without exporting/changing process environment or using the runtime adapter.
    const saved = require('dotenv').parse(fs.readFileSync('.env'));
    const { databaseConfiguration } = require('../lib/db/config.ts');
    const config = databaseConfiguration({ ...saved, ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' });
    assert.equal(config.environment, 'development');
    assert.ok(['localhost', '127.0.0.1', '::1', '[::1]'].includes(config.endpoint.host));
    const client = require('postgres')(config.url, { ...config.options, max: 1, onnotice() {} });
    const rollback = new Error('E4B1 isolated fixture rollback');
    let timezone, writes = 0;
    try {
        await assert.rejects(client.begin(async tx => {
            const [identity] = await tx`select current_database() = ${config.endpoint.database} as database_matches,
                current_user = ${config.endpoint.user} as role_matches, inet_server_port() = ${config.endpoint.port} as port_matches,
                current_setting('TimeZone') as timezone`;
            assert.ok(identity.database_matches && identity.role_matches && identity.port_matches);
            timezone = identity.timezone;
            // Postgres.js's transaction handle omits .options; supply its parent's parser/serializer options.
            const actual = require('drizzle-orm/postgres-js').drizzle(Object.assign(tx, { options: client.options }));
            const fixtures = {};
            for (const name of ['submissions', 'feedbacks']) {
                const columns = Object.values(getTableColumns(schema[name])).map(col => `"${col.name}" ${col.name === 'id' ? 'integer default 1' : col.getSQLType()}`);
                // No LIKE/default copying, FKs, triggers or public sequences; only session-local fixture objects.
                await tx.unsafe(`create temporary table "e4b1_${name}" (${columns.join(', ')}, fixture_row integer generated always as identity) on commit drop`);
                const column = name === 'submissions' ? 'submitted_at' : 'created_at';
                fixtures[name] = pgSchema('pg_temp').table(`e4b1_${name}`, { at: timestamp(column), row: integer('fixture_row') });
                await tx.unsafe(`insert into pg_temp."e4b1_${name}" ("${column}") values ('2020-01-02 03:04:05'::timestamp)`);
            }
            for (const item of cases) {
                const f = fixture(); await item.run(f);
                const emitted = f.state.queries.find(entry => entry.query.startsWith(`insert into "${item.table}"`));
                const target = fixtures[item.table];
                const query = emitted.query.replace(`insert into "${item.table}"`, `insert into pg_temp."e4b1_${item.table}"`);
                assert.ok(query.startsWith('insert into pg_temp.'), 'Never replay against application tables');
                const read = async () => (await actual.select({ at: target.at }).from(target).orderBy(desc(target.row)).limit(1))[0].at;
                const [before] = await tx`select clock_timestamp() as now`;
                await tx.unsafe(query, emitted.params); writes++;
                const stored = await read(), [after] = await tx`select clock_timestamp() as now`;
                assert.ok(stored >= new Date(before.now) && stored <= new Date(after.now), 'Stored naive value must decode to the actual UTC clock instant');
                // Substitute only the volatile clock for a known instant. SQL normalization, typed storage and the real reader are unchanged.
                for (const bound of ['2026-11-21T16:30:00Z', '2026-11-22T00:30:00+08:00', '2026-11-21T11:30:00-05:00']) {
                    const controlled = query.replace('clock_timestamp()', `cast($${emitted.params.length + 1} as timestamptz)`);
                    await tx.unsafe(controlled, [...emitted.params, bound]); writes++;
                    assert.equal((await read()).toISOString(), instant);
                }
            }
            for (const target of Object.values(fixtures)) {
                const [historical] = await actual.select({ at: target.at }).from(target).orderBy(target.row).limit(1);
                assert.equal(historical.at.toISOString(), '2020-01-02T03:04:05.000Z');
            }
            assert.equal((await tx`select current_setting('TimeZone') as timezone`)[0].timezone, timezone);
            throw rollback;
        }), error => error === rollback);
        const [cleanup] = await client`select to_regclass('pg_temp.e4b1_submissions') is null as submissions_gone,
            to_regclass('pg_temp.e4b1_feedbacks') is null as feedbacks_gone`;
        assert.ok(cleanup.submissions_gone && cleanup.feedbacks_gone);
        console.log(`Local PostgreSQL PASS: ${writes} isolated event INSERTs, UTC readback, unchanged session timezone (${timezone}), rollback/temporary-object cleanup verified; no application records written.`);
    } finally { await client.end({ timeout: 2 }); }
});
