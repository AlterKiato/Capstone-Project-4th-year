/* eslint-disable @typescript-eslint/no-require-imports */
// Real services, queries, renderers and HTTP handler. Only session/account/SQL transport are synthetic.
// node --import tsx --test tests/phase10-e2-admin-report.unit.cjs
const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const Module = require('node:module');
const fs = require('node:fs');
const { drizzle } = require('drizzle-orm/pg-proxy');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
require.extensions['.css'] = module => { module.exports = {}; };
let state;
const proxy = drizzle(async sql => {
    state.queries.push(sql);
    if (state.failure) throw Error('PRIVATE_DATABASE_INFORMATION');
    if (/group by.*role_id/.test(sql)) return { rows: state.empty ? [] : [[1, 1], [2, 1], [3, 5]] };
    if (/group by.*status/.test(sql)) return { rows: state.empty ? [] : [['Draft', 1], ['Approved', 2]] };
    return { rows: [[state.empty ? 0 : sql.includes('from "repositories"') ? 1 : sql.includes('from "users"') ? 7 : sql.includes('from "research_groups"') ? 2 : 3]] };
});
proxy.transaction = async (operation, options) => { state.transactions.push(options); return operation(proxy); };
const original = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (id === '@/lib/db') return { db: proxy };
    if (id === '@/lib/auth/session') return { getSession: async () => state.session };
    if (id === '@/lib/repositories/user.repository') return { findUserById: async () => {
        state.accountReads++;
        return state.revokeAt && state.accountReads >= state.revokeAt ? null : state.account;
    } };
    return original.call(this, id, ...args);
};
const data = require('../lib/reporting/admin-report.ts');
const service = require('../lib/services/admin-report.service.ts');
const renderer = require('../lib/reporting/admin-report-export.ts');
const { POST } = require('../app/api/admin/reports/route.ts');
const Tables = require('../components/dashboard/admin-report-tables.tsx').default;
const ExcelJS = require('exceljs');
const out = process.env.REPORT_TEST_OUTPUT || 'test-results/phase10-e2';
const request = (overrides = {}) => ({ reportType: 'current-summary', selection: 'all', sections: [], format: 'preview', ...overrides });
const http = body => new Request('https://report.example.invalid/api/admin/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
beforeEach(() => { state = { session: { userId: 1, roleId: 1 }, account: { id: 1, roleId: 1, isActive: true }, queries: [], transactions: [], accountReads: 0 }; });

test('Manila week/month/year boundaries, leap dates and ISO week-year transitions', () => {
    const cases = [
        ['weekly', '2026-W01', '2025-12-28T16:00:00.000Z', '2026-01-04T16:00:00.000Z'],
        ['weekly', '2026-W53', '2026-12-27T16:00:00.000Z', '2027-01-03T16:00:00.000Z'],
        ['monthly', '2024-02', '2024-01-31T16:00:00.000Z', '2024-02-29T16:00:00.000Z'],
        ['yearly', '2026', '2025-12-31T16:00:00.000Z', '2026-12-31T16:00:00.000Z'],
    ];
    for (const [kind, value, start, end] of cases) {
        const period = data.resolveReportPeriod({ kind, value });
        assert.equal(period.startInclusive, start); assert.equal(period.endExclusive, end);
        const inside = instant => instant >= Date.parse(start) && instant < Date.parse(end);
        assert.equal(inside(Date.parse(start) - 1), false); assert.equal(inside(Date.parse(start)), true);
        assert.equal(inside(Date.parse(end) - 1), true); assert.equal(inside(Date.parse(end)), false);
    }
    for (const value of ['2025-W53', '2026-W00', '2026-W54']) assert.throws(() => data.resolveReportPeriod({ kind: 'weekly', value }));
    assert.equal(data.defaultReportPeriod('monthly', new Date('2026-10-31T16:00:00Z')).value, '2026-11');
    assert.equal(data.defaultReportPeriod('weekly', new Date('2027-01-01T00:00:00Z')).value, '2026-W53');
});

test('strict selections reject unsupported activity, format, duplicate/empty sections and actor injection', async () => {
    for (const override of [
        { selection: 'custom', sections: [] }, { sections: ['submissions'] }, { sections: ['reviews'] },
        { sections: ['users', 'users'] }, { format: 'csv' }, { actorId: 1 },
        { reportType: 'activity' },
        { period: { kind: 'weekly', value: '2026-W01' } },
        { period: { kind: 'monthly', value: '2026-11' } },
        { period: { kind: 'yearly', value: '2026' } },
        { period: { kind: 'monthly', value: '2026-13' } }, { period: { kind: 'yearly', value: 'NaN' } },
    ]) {
        const result = await service.getAdminReport(request(override));
        assert.equal(result.status, 400); assert.equal(state.queries.length, 0);
    }
});

test('Export All expands server catalog, counts come from eligible queries in one consistent snapshot', async () => {
    const result = await service.getAdminReport(request({ sections: ['groups'] }));
    assert.ok(result.ok);
    assert.deepEqual(result.report.sections.map(section => section.id), ['users', 'groups', 'papers', 'repository']);
    assert.deepEqual(result.report.sections.map(section => section.rows[0].value), [7, 2, 3, 1]);
    assert.deepEqual(state.transactions, [{ isolationLevel: 'repeatable read', accessMode: 'read only' }]);
    assert.ok(state.queries.some(sql => /is_published/.test(sql) && /exists/.test(sql)));
    assert.ok(state.queries.every(sql => !/password|email|file_url|abstract|comments|recommendation|ip_address/.test(sql)));
    assert.match(result.report.notes[0], /activity reporting is unavailable/);
    assert.equal(result.report.reportType, 'current-summary');
    assert.equal(Object.hasOwn(result.report, 'period'), false);
    assert.ok(result.report.sections.every(section => section.semantics === 'snapshot'));
});

test('custom selection queries and returns only selected sections', async () => {
    const result = await service.getAdminReport(request({ selection: 'custom', sections: ['groups'] }));
    assert.ok(result.ok); assert.deepEqual(result.report.sections.map(section => section.id), ['groups']);
    assert.equal(state.queries.length, 1); assert.match(state.queries[0], /research_groups/);
});

test('anonymous, other roles, inactive/stale/missing accounts denied before aggregates; revocation denies delivery', async () => {
    for (const [session, account] of [[null, null], [{ userId: 2, roleId: 2 }, null], [{ userId: 3, roleId: 3 }, null],
        [{ userId: 4, roleId: 4 }, null], [{ userId: 1, roleId: 1 }, { id: 1, roleId: 1, isActive: false }],
        [{ userId: 1, roleId: 1 }, { id: 1, roleId: 2, isActive: true }], [{ userId: 1, roleId: 1 }, null]]) {
        state.session = session; state.account = account;
        const response = await POST(http(request())); assert.equal(response.status, 403);
        assert.equal(state.queries.length, 0); assert.match(response.headers.get('Cache-Control'), /private, no-store/);
    }
    state.session = { userId: 1, roleId: 1 }; state.account = { id: 1, roleId: 1, isActive: true };
    state.accountReads = 0; state.revokeAt = 2;
    assert.equal((await service.getAdminReport(request())).status, 403);
});

test('database failures remain generic errors; empty data is successful zero snapshot, never fabricated activity', async () => {
    state.failure = true;
    const response = await POST(http(request())); assert.equal(response.status, 503);
    assert.doesNotMatch(await response.text(), /PRIVATE_DATABASE_INFORMATION/);
    state.failure = false; state.empty = true;
    const result = await service.getAdminReport(request()); assert.ok(result.ok);
    assert.ok(result.report.sections.every(section => section.rows.every(row => row.value === 0)));
    const html = renderToStaticMarkup(React.createElement(Tables, { report: result.report }));
    assert.match(html, /No records are currently available/); assert.match(html, /Current snapshot at generation time/);
});

test('preview and XLSX use the same numeric dataset; literal strings and selected-only worksheets', async () => {
    const result = await service.getAdminReport(request()); assert.ok(result.ok);
    const bytes = await renderer.renderReportXlsx(result.report);
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(Buffer.from(bytes));
    const metadata = workbook.getWorksheet('Report Information').getSheetValues().flat().filter(Boolean).join(' ');
    assert.match(metadata, /Current Research Summary/);
    assert.match(metadata, /Report type/);
    assert.match(metadata, /Asia\/Manila/);
    assert.match(metadata, /Current snapshot at generation time/);
    assert.doesNotMatch(metadata, /Reporting period|Calendar selection|weekly:|monthly:|yearly:/);
    assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Report Information', ...result.report.sections.map(section => section.label)]);
    for (const section of result.report.sections) for (const [index, row] of section.rows.entries()) {
        const sheet = workbook.getWorksheet(section.label);
        assert.equal(sheet.getCell(index + 5, 1).value, row.label);
        assert.equal(sheet.getCell(index + 5, 2).value, row.value);
        assert.equal(sheet.getCell(index + 5, 2).type, ExcelJS.ValueType.Number);
    }
    const html = renderToStaticMarkup(React.createElement(Tables, { report: result.report }));
    assert.match(html, /<caption>Research Papers<\/caption>/); assert.match(html, /scope="row"/);
    const custom = await service.getAdminReport(request({ selection: 'custom', sections: ['groups'] }));
    custom.report.sections[0].rows[0].label = '=HYPERLINK("https://example.invalid")';
    const literal = new ExcelJS.Workbook(); await literal.xlsx.load(Buffer.from(await renderer.renderReportXlsx(custom.report)));
    assert.equal(literal.getWorksheet('Research Groups').getCell('A5').type, ExcelJS.ValueType.String);
    assert.equal(literal.worksheets.length, 2);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(`${out}/report.xlsx`, bytes);
    fs.writeFileSync(`${out}/dataset.json`, JSON.stringify(result.report));
});

test('real HTTP download handler emits valid XLSX/PDF, safe filenames and private headers; malformed/large bodies rejected', async () => {
    for (const format of ['xlsx', 'pdf']) {
        const response = await POST(http(request({ format })));
        assert.equal(response.status, 200); assert.match(response.headers.get('Content-Disposition'), new RegExp(`^attachment; filename="thesishs-current-research-summary-[0-9]{8}T[0-9]{9}Z\\.${format}"$`));
        assert.match(response.headers.get('Cache-Control'), /private, no-store/);
        assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
        const bytes = Buffer.from(await response.arrayBuffer());
        if (format === 'pdf') {
            assert.equal(response.headers.get('Content-Type'), 'application/pdf'); assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
            assert.match(bytes.toString('latin1'), /%%EOF/);
        } else assert.equal(bytes.subarray(0, 2).toString(), 'PK');
        fs.writeFileSync(`${out}/download.${format}`, bytes);
    }
    assert.equal((await POST(http('{'))).status, 400);
    assert.equal((await POST(http(' '.repeat(5000)))).status, 413);
    state.accountReads = 0; state.revokeAt = 4;
    assert.equal((await POST(http(request({ format: 'pdf' })))).status, 403, 'revocation after renderer denies download');
});
