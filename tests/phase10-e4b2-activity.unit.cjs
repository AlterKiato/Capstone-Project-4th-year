/* eslint-disable @typescript-eslint/no-require-imports */
// node --import tsx --test tests/phase10-e4b2-activity.unit.cjs
// node --import tsx tests/phase10-e4b2-activity.unit.cjs --local-postgres adds SELECT-only loopback verification.
const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const Module = require('node:module');
const fs = require('node:fs');
const { inflateSync } = require('node:zlib');
const { drizzle } = require('drizzle-orm/pg-proxy');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ExcelJS = require('exceljs');
const data = require('../lib/reporting/period-activity.ts');
const calendar = require('../lib/reporting/admin-report.ts');
const policy = { status: 'verified', cutoverUtc: '2026-12-31T16:30:00.000Z', legacySubmissionMaxId: 100, legacyFeedbackMaxId: 50 };
const fixtures = {
    submissions: [[10, '2027-01-01T00:00:00Z'], // Ambiguous old row numerically after cutover, excluded by legacy ceiling.
        [101, '2026-12-31T15:59:59.999Z'], [102, '2026-12-31T16:00:00Z'], [103, '2026-12-31T16:29:59.999Z'],
        [104, policy.cutoverUtc], [105, '2026-12-31T16:30:01Z'], [106, '2027-01-31T16:00:00Z']],
    feedbacks: [[3, '2027-01-01T00:00:00Z', 'Approved'], [51, policy.cutoverUtc, 'Approved'],
        [52, '2027-01-31T15:59:59.999Z', 'Revision Required'], [53, policy.cutoverUtc, 'Under Review'],
        [54, '2026-12-31T16:29:59.999Z', 'Approved'], [55, '2027-01-31T16:00:00Z', 'Approved'],
        [56, policy.cutoverUtc, 'Recommendation']],
};
let state;
function eligible(query, params, table) {
    const lower = [...query.matchAll(/>= \$(\d+)::timestamptz/g)].map(m => Date.parse(params[Number(m[1]) - 1]));
    const end = Date.parse(params[Number(query.match(/< \$(\d+)::timestamptz/)[1]) - 1]);
    const floor = params[Number(query.match(/\."id" > \$(\d+)/)[1]) - 1];
    return state.empty ? [] : fixtures[table].filter(([id, at]) => id > floor && lower.every(start => Date.parse(at) >= start) && Date.parse(at) < end);
}
const db = drizzle(async (query, params) => {
    state.queries.push({ query, params });
    if (query.includes('from "submissions"')) {
        if (state.failure) throw Error('PRIVATE_DATABASE_INFORMATION');
        return { rows: [[eligible(query, params, 'submissions').length]] };
    }
    if (query.includes('from "feedbacks"')) {
        const rows = eligible(query, params, 'feedbacks');
        return { rows: ['Approved', 'Revision Required'].map(value => [value, rows.filter(row => row[2] === value).length]) };
    }
    if (query.includes('from "main_adviser_designation"') && !query.includes('from "users" where')) return { rows: state.active && state.main ? [[state.main]] : [] };
    if (query.includes('from "users"')) return { rows: !state.guardDenied && state.active ? [[state.session.userId]] : [] };
    throw Error('Unexpected query in bounded activity fixture');
});
db.transaction = async (work, options) => { state.transactions.push(options); return work(db); };
function account() {
    state.reads++;
    if (state.revokeAt && state.reads >= state.revokeAt) { state.active = false; state.main = null; }
    return state.active && state.session ? { ...state.session, roleId: state.accountRole ?? state.session.roleId } : null;
}
const original = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (id === '@/lib/db') return { db };
    if (id === '@/lib/auth/session') return { getSession: async () => state.session };
    if (id === '@/lib/auth/current-account') return { getCurrentAccount: async () => account() };
    if (id === '@/lib/repositories/user.repository') return { findUserById: async () => { const user = account(); return user && { id: user.userId, roleId: user.roleId, isActive: state.active }; } };
    if (id === '@/lib/reporting/activity-coverage') return { get ACTIVITY_ACTIVATION() { return state.activation; }, currentActivityAvailability: () => data.activityAvailability(state.activation) };
    return original.call(this, id, ...args);
};
require.extensions['.css'] = module => { module.exports = {}; };
const initialActivation = require('../lib/reporting/activity-coverage.ts').ACTIVITY_ACTIVATION;
const service = require('../lib/services/period-activity.service.ts');
const repository = require('../lib/repositories/period-activity.repository.ts');
const renderer = require('../lib/reporting/admin-report-export.ts');
const adminRoute = require('../app/api/admin/reports/activity/route.ts').POST;
const mainRoute = require('../app/api/adviser/reports/activity/route.ts').POST;
const Controls = require('../components/dashboard/period-activity-controls.tsx').default;
const Snapshots = require('../components/dashboard/admin-report-controls.tsx').default;
const out = 'test-results/phase10-e4b2';
const request = (extra = {}) => ({ reportType: 'period-activity', period: { kind: 'monthly', value: '2027-01' }, format: 'preview', ...extra });
const http = body => new Request('https://report.example.invalid/api/admin/reports/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const aggregates = () => state.queries.filter(entry => /from "(?:submissions|feedbacks)"/.test(entry.query));
beforeEach(() => { state = { activation: { ...policy }, session: { userId: 1, roleId: 1 }, main: 2, active: true, queries: [], transactions: [], reads: 0 }; });

test('cutover accepts only canonical millisecond-exact UTC and preserves the exact boundary', async () => {
    for (const [cutoverUtc, year] of [[policy.cutoverUtc, '2027'], ['2028-02-29T16:30:00.123Z', '2028'], ['2027-01-01T00:00:00.999Z', '2027']]) {
        const activation = { ...policy, cutoverUtc };
        assert.ok(data.activityActivationSchema.safeParse(activation).success);
        const period = calendar.resolveReportPeriod({ kind: 'yearly', value: year });
        const result = data.resolveActivityWindow(period, activation);
        assert.ok(result.ok); assert.equal(result.window.cutoverUtc, cutoverUtc);
        assert.equal(result.window.effectiveStartInclusive, cutoverUtc);
    }
    for (const cutoverUtc of [
        '2026-11-21T16:30:00.000999Z', '2026-11-21T16:30:00.0000Z',
        '2026-11-21T16:30:00Z', '2026-11-21T16:30:00.0Z', '2026-11-21T16:30:00.00Z',
        '2026-11-21T16:30:00.000+00:00', '2026-11-22T00:30:00.000+08:00',
        '2026-11-21T16:30:00.000', '2026-11-21t16:30:00.000z',
        '2026-11-21 16:30:00.000Z', '2026-1-21T16:30:00.000Z',
        '2026-11-21T16:30:00.000Z\n', ' 2026-11-21T16:30:00.000Z',
        '2027-02-29T16:30:00.000Z', '2026-04-31T16:30:00.000Z',
        '2026-13-21T16:30:00.000Z', '2026-11-21T24:00:00.000Z',
        '2026-11-21T16:60:00.000Z', '2026-11-21T16:30:60.000Z',
        undefined, null, '', 123,
    ]) {
        state.activation = { ...policy, cutoverUtc };
        assert.equal(data.activityActivationSchema.safeParse(state.activation).success, false, String(cutoverUtc));
        assert.equal(data.activityAvailability(state.activation), 'invalid');
        for (const [route, roleId] of [[adminRoute, 1], [mainRoute, 2]]) {
            state.session = { userId: roleId, roleId };
            for (const format of ['preview', 'xlsx', 'pdf']) {
                const response = await route(http(request({ format })));
                assert.equal(response.status, 503);
                const body = await response.json(); assert.equal(body.coverageStatus, 'invalid');
                assert.ok(!Object.hasOwn(body, 'totals')); assert.equal(aggregates().length, 0);
            }
        }
    }
});

test('legacy ID ceilings retain independent nonnegative PostgreSQL integer validation', () => {
    for (const field of ['legacySubmissionMaxId', 'legacyFeedbackMaxId']) {
        for (const value of [0, 2_147_483_647])
            assert.ok(data.activityActivationSchema.safeParse({ ...policy, [field]: value }).success);
        for (const value of [-1, 0.5, 2_147_483_648, undefined, null, '100'])
            assert.equal(data.activityActivationSchema.safeParse({ ...policy, [field]: value }).success, false);
    }
});

test('production cutover is unconfigured; absent/malformed policies fail closed, without queries, zeros or downloads', async () => {
    assert.deepEqual(initialActivation, { status: 'unconfigured' });
    for (const activation of [initialActivation, undefined, null, { ...policy, cutoverUtc: '2027-01-01' }, { ...policy, legacyFeedbackMaxId: undefined }, { ...policy, cutoverUtc: '2027-01-01T08:00:00+08:00' }]) {
        state.activation = activation;
        for (const format of ['preview', 'xlsx', 'pdf']) {
            const response = await adminRoute(http(request({ format })));
            assert.equal(response.status, 503);
            const body = await response.json(); assert.ok(['unconfigured', 'invalid'].includes(body.coverageStatus));
            assert.ok(!Object.hasOwn(body, 'totals')); assert.equal(aggregates().length, 0);
        }
    }
    state.activation = initialActivation;
    for (const bypass of [{ cutoverUtc: policy.cutoverUtc }, { activation: policy }, { coverage: policy }, { role: 'admin' }])
        assert.equal((await adminRoute(http(request(bypass)))).status, 400);
});

test('Manila ISO week/year, midnight and coverage boundaries are shared and half-open', async () => {
    const week = calendar.resolveReportPeriod({ kind: 'weekly', value: '2026-W53' });
    assert.equal(week.startInclusive, '2026-12-27T16:00:00.000Z'); assert.equal(week.endExclusive, '2027-01-03T16:00:00.000Z');
    const month = calendar.resolveReportPeriod({ kind: 'monthly', value: '2027-01' });
    assert.equal(month.startInclusive, '2026-12-31T16:00:00.000Z'); assert.equal(month.endExclusive, '2027-01-31T16:00:00.000Z');
    for (const period of [month, week, calendar.resolveReportPeriod({ kind: 'yearly', value: '2027' })]) {
        assert.equal(data.resolveActivityWindow(period, { ...policy, cutoverUtc: period.startInclusive }).window.status, 'full');
        assert.equal(data.resolveActivityWindow(period, { ...policy, cutoverUtc: period.endExclusive }).status, 'before-cutover');
    }
    const partial = data.resolveActivityWindow(month, policy).window;
    assert.equal(partial.status, 'partial'); assert.equal(partial.effectiveStartInclusive, policy.cutoverUtc);
    assert.equal((await service.getPeriodActivityReport(request({ period: { kind: 'weekly', value: '2027-W53' } }), 'admin')).status, 400);
    const prior = await adminRoute(http(request({ period: { kind: 'monthly', value: '2026-12' } })));
    assert.equal(prior.status, 422); assert.equal((await prior.json()).coverageStatus, 'before-cutover'); assert.equal(aggregates().length, 0);
});

test('initial plus revised version count twice; official decisions independently count once without joins or evaluation substitution', async () => {
    const admin = await service.getPeriodActivityReport(request(), 'admin'); assert.ok(admin.ok);
    assert.deepEqual(admin.report.totals, { submissions: 2, approved: 1, revisionRequired: 1 });
    assert.equal(admin.report.coverage.status, 'partial');
    assert.deepEqual(admin.report.sections[0].rows.map(row => row.value), [2, 1, 1]);
    assert.deepEqual(state.transactions, [{ isolationLevel: 'repeatable read', accessMode: 'read only' }]);
    for (const { query, params } of aggregates()) {
        assert.ok(query.includes("at time zone 'UTC'")); assert.equal((query.match(/::timestamptz/g) || []).length, 3);
        assert.doesNotMatch(query, /join|activity_logs|updated_at|submission_evaluations|co_adviser_review_assignments/i);
        assert.ok(params.includes(policy.cutoverUtc));
    }
    state.session = { userId: 2, roleId: 2 }; state.queries = [];
    const main = await service.getPeriodActivityReport(request(), 'main'); assert.ok(main.ok);
    assert.deepEqual(main.report.totals, admin.report.totals);
    assert.ok(aggregates().every(entry => entry.query.includes('main_adviser_designation')));
});

test('Admin and designated active Main only; other roles, generic/Co Adviser and revoked designation are denied', async () => {
    for (const [route, allowed] of [[adminRoute, 1], [mainRoute, 2]]) {
        for (const session of [null, { userId: 3, roleId: 3 }, { userId: 4, roleId: 4 }, { userId: 9, roleId: 2 }, { userId: allowed === 1 ? 2 : 1, roleId: allowed === 1 ? 2 : 1 }]) {
            state.session = session; state.queries = []; state.reads = 0;
            assert.equal((await route(http(request()))).status, 403); assert.equal(aggregates().length, 0);
        }
    }
    state.session = { userId: 2, roleId: 2 }; state.main = null;
    assert.equal((await mainRoute(http(request()))).status, 403);
    state.main = 2; state.active = false;
    assert.equal((await mainRoute(http(request()))).status, 403);
    state.active = true; state.guardDenied = true; state.queries = [];
    const window = data.resolveActivityWindow(calendar.resolveReportPeriod(request().period), policy).window;
    assert.equal(await repository.readPeriodActivity({ id: 2, role: 'main' }, window), null); assert.equal(aggregates().length, 0);
});

test('private response bounds, post-read/render revocation and changed totals prevent unsafe delivery', async () => {
    assert.equal((await adminRoute(http('{'))).status, 400);
    assert.equal((await adminRoute(http(' '.repeat(5000)))).status, 413);
    assert.equal((await adminRoute(http(request({ format: 'xlsx' })))).status, 400);
    assert.equal((await adminRoute(http(request({ format: 'xlsx', expectedTotals: { submissions: 99, approved: 1, revisionRequired: 1 } })))).status, 409);
    for (const [route, session] of [[adminRoute, { userId: 1, roleId: 1 }], [mainRoute, { userId: 2, roleId: 2 }]]) {
        for (const revokeAt of [3, 4]) {
            state.session = session; state.active = true; state.main = 2; state.reads = 0; state.revokeAt = revokeAt;
            const response = await route(http(request({ format: 'pdf', expectedTotals: { submissions: 2, approved: 1, revisionRequired: 1 } })));
            assert.equal(response.status, 403); assert.match(response.headers.get('Cache-Control'), /private, no-store/);
        }
    }
});

function pdfText(bytes) {
    const source = Buffer.from(bytes).toString('latin1'); let result = '';
    for (const match of source.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
        let stream; try { stream = inflateSync(Buffer.from(match[1], 'latin1')).toString(); } catch { continue; }
        for (const hex of stream.matchAll(/<([0-9a-f]+)>/gi)) result += Buffer.from(hex[1], 'hex').toString('latin1');
    }
    return result;
}
test('real XLSX/PDF contain activity metadata and exactly the displayed totals for each authorized role', async () => {
    fs.mkdirSync(out, { recursive: true });
    for (const [route, role] of [[adminRoute, 1], [mainRoute, 2]]) {
        state.session = { userId: role, roleId: role }; state.reads = 0;
        const preview = await (await route(http(request()))).json();
        assert.deepEqual(preview.totals, { submissions: 2, approved: 1, revisionRequired: 1 });
        for (const format of ['xlsx', 'pdf']) {
            const response = await route(http(request({ format, expectedTotals: preview.totals })));
            assert.equal(response.status, 200); assert.match(response.headers.get('Content-Disposition'), /period-activity-2027-01/);
            assert.match(response.headers.get('Cache-Control'), /private, no-store/); assert.equal(response.headers.get('Vary'), 'Cookie');
            const bytes = Buffer.from(await response.arrayBuffer()); fs.writeFileSync(`${out}/${role}.${format}`, bytes);
            if (format === 'xlsx') {
                const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
                assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Report Information', 'Activity totals']);
                const info = workbook.getWorksheet('Report Information').getSheetValues().flat().filter(Boolean).join(' ');
                for (const value of ['Period Activity', 'monthly: 2027-01', 'Asia/Manila', 'PARTIAL COVERAGE', policy.cutoverUtc, preview.period.startInclusive, preview.period.endExclusive]) assert.ok(info.includes(value));
                assert.ok(!info.includes('Current snapshot'));
                preview.sections[0].rows.forEach((row, index) => assert.deepEqual(workbook.getWorksheet('Activity totals').getRow(index + 5).values.slice(1), [row.label, row.value]));
            } else {
                const text = pdfText(bytes);
                assert.match(text, /Period Activity/); assert.match(text, /PARTIAL COVERAGE/); assert.ok(text.includes(policy.cutoverUtc));
                assert.match(text, /Submission versions2Approved decisions1Revision Required decisions1/); assert.doesNotMatch(text, /Current snapshot/);
            }
        }
        fs.writeFileSync(`${out}/dataset.json`, JSON.stringify(preview));
    }
});

test('unconfigured UI has no fabricated totals; snapshot controls remain usable; zero and failure are distinct', async () => {
    const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
        React.createElement(Snapshots, { initialReport: null }), React.createElement(Controls, { kind: 'admin', availability: 'unconfigured', defaults: data.defaultActivityPeriods(new Date('2027-01-01T00:00:00Z')) })));
    assert.match(html, /Generate and Download/); assert.match(html, /awaits verified activation/); assert.match(html, /UNAVAILABLE/);
    assert.equal((html.match(/disabled=""/g) || []).length, 2); assert.doesNotMatch(html, /<td/);
    state.empty = true;
    const empty = await service.getPeriodActivityReport(request(), 'admin'); assert.ok(empty.ok);
    assert.deepEqual(empty.report.totals, { submissions: 0, approved: 0, revisionRequired: 0 });
    state.failure = true;
    const failed = await adminRoute(http(request())); assert.equal(failed.status, 503);
    assert.doesNotMatch(await failed.text(), /PRIVATE_DATABASE_INFORMATION|"totals"/);
});

test('full-coverage weekly and yearly exports retain their selected period and numeric dataset', async () => {
    for (const period of [{ kind: 'weekly', value: '2026-W53' }, { kind: 'yearly', value: '2027' }]) {
        const resolved = calendar.resolveReportPeriod(period);
        const window = data.resolveActivityWindow(resolved, { ...policy, cutoverUtc: resolved.startInclusive }).window;
        const report = data.buildActivityReport('admin', window, { submissions: 7, approved: 2, revisionRequired: 3 }, new Date('2027-01-01T00:00:00Z'));
        const book = new ExcelJS.Workbook(); await book.xlsx.load(Buffer.from(await renderer.renderReportXlsx(report)));
        const info = book.getWorksheet('Report Information').getSheetValues().flat().filter(Boolean).join(' ');
        assert.ok(info.includes(`${period.kind}: ${period.value}`)); assert.ok(info.includes('FULL COVERAGE'));
        const text = pdfText(await renderer.renderReportPdf(report));
        assert.ok(text.includes(period.value)); assert.match(text, /FULL COVERAGE/);
        assert.match(text, /Submission versions7Approved decisions2Revision Required decisions3/);
    }
});

test('PostgreSQL evaluates emitted event predicates under unchanged local timezone with SELECT-only CTE fixtures', { skip: !process.argv.includes('--local-postgres') }, async () => {
    assert.notEqual(process.env.NODE_ENV, 'production'); assert.ok(!['preview', 'production'].includes(process.env.VERCEL_ENV));
    const saved = require('dotenv').parse(fs.readFileSync('.env'));
    const config = require('../lib/db/config.ts').databaseConfiguration({ ...saved, ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' });
    assert.equal(config.environment, 'development'); assert.ok(['localhost', '127.0.0.1', '::1', '[::1]'].includes(config.endpoint.host));
    const client = require('postgres')(config.url, { ...config.options, max: 1, onnotice() {} });
    const values = (table) => fixtures[table].map(([id, at, decision]) => `(${id}, '${at}'::timestamp${decision ? `, '${decision}'` : ''})`).join(',');
    const cte = `with users(id,role_id,is_active) as (values (1,1,true),(2,2,true)),
        main_adviser_designation(id,main_adviser_id) as (values(1,2)),
        submissions(id,submitted_at) as (values ${values('submissions')}),
        feedbacks(id,created_at,decision) as (values ${values('feedbacks')}) `;
    let checked = 0;
    try {
        await client.begin('isolation level repeatable read read only', async tx => {
            const [identity] = await tx`select current_database() = ${config.endpoint.database} as database_matches,
                current_user = ${config.endpoint.user} as role_matches, inet_server_port() = ${config.endpoint.port} as port_matches,
                current_setting('transaction_read_only') = 'on' as read_only, current_setting('TimeZone') as timezone`;
            assert.ok(identity.database_matches && identity.role_matches && identity.port_matches && identity.read_only);
            for (const role of ['admin', 'main']) for (const [kind, value, cutover] of [['monthly', '2027-01'], ['monthly', '2027-01', '2026-12-31T16:00:00.000Z'], ['weekly', '2026-W53'], ['yearly', '2027']]) {
                state.activation = { ...policy, cutoverUtc: cutover ?? policy.cutoverUtc };
                state.session = { userId: role === 'admin' ? 1 : 2, roleId: role === 'admin' ? 1 : 2 }; state.queries = [];
                const result = await service.getPeriodActivityReport(request({ period: { kind, value } }), role); assert.ok(result.ok);
                const resultCounts = { submissions: 0, approved: 0, revisionRequired: 0 };
                for (const { query, params } of aggregates()) {
                    const rows = await tx.unsafe(cte + query, params).values(); checked++;
                    if (query.includes('from "submissions"')) resultCounts.submissions = Number(rows[0][0]);
                    else for (const [decision, count] of rows) resultCounts[decision === 'Approved' ? 'approved' : 'revisionRequired'] = Number(count);
                }
                assert.deepEqual(resultCounts, result.report.totals);
            }
            assert.equal((await tx`select current_setting('TimeZone') as timezone`)[0].timezone, identity.timezone);
            console.log(`Local SELECT-only PostgreSQL PASS: ${checked} emitted count queries, both roles/all periods; timezone unchanged (${identity.timezone}); no records/schema/settings written.`);
        });
    } finally { await client.end({ timeout: 2 }); }
});
