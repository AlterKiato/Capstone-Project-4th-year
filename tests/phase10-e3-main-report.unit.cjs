/* eslint-disable @typescript-eslint/no-require-imports */
// Actual authority helper, service, Drizzle query builder, renderers and route; synthetic session/SQL transport only.
// node --import tsx --test tests/phase10-e3-main-report.unit.cjs
const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const Module = require('node:module');
const fs = require('node:fs');
const { drizzle } = require('drizzle-orm/pg-proxy');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ExcelJS = require('exceljs');
require.extensions['.css'] = module => { module.exports = {}; };
let state;
const proxy = drizzle(async (sql, parameters) => {
    state.queries.push({ sql, parameters });
    if (state.failure) throw Error('PRIVATE_DATABASE_INFORMATION');
    const allowed = state.main !== null && state.active && state.accountRole === 2;
    if (/^select "users"\."id" from "main_adviser_designation" inner join "users"/.test(sql)) return { rows: allowed ? [[state.main]] : [] };
    if (/^select "id" from "main_adviser_designation" where/.test(sql)) {
        if (state.revokeOnGuard) return { rows: [] };
        return { rows: allowed && state.session?.userId === state.main ? [[1]] : [] };
    }
    if (state.empty) return { rows: [] };
    if (/group by "research_groups"/.test(sql)) return { rows: [['active', 4], ['archived', 1]] };
    if (/group by "research_papers"/.test(sql)) return { rows: [['Draft', 1], ['Approved', 1], ['Revision Required', 1]] };
    if (/group by "submissions"/.test(sql)) return { rows: [['Submitted', 1], ['Under Review', 2], ['Revision Required', 2], ['Approved', 1], ['Unexpected', 1]] };
    if (/from "research_groups"/.test(sql)) return { rows: [[1, 'active', 2, 2, 1], [2, 'archived', 1, 1, 1], [3, 'active', 0, 0, 0], [4, 'active', 0, 0, 0], [5, 'active', 0, 0, 0]] };
    throw Error('Unexpected SQL in focused fixture');
});
proxy.transaction = async (operation, options) => { state.transactions.push(options); return operation(proxy); };
const original = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (id === '@/lib/db') return { db: proxy };
    if (id === '@/lib/auth/session') return { getSession: async () => {
        state.authorityReads++;
        if (state.revokeAt && state.authorityReads >= state.revokeAt) state.main = 99;
        return state.active ? state.session : null;
    } };
    return original.call(this, id, ...args);
};
const data = require('../lib/reporting/main-adviser-report.ts');
const service = require('../lib/services/main-adviser-report.service.ts');
const repository = require('../lib/repositories/main-adviser-report.repository.ts');
const renderer = require('../lib/reporting/admin-report-export.ts');
const { POST } = require('../app/api/adviser/reports/route.ts');
const Tables = require('../components/dashboard/admin-report-tables.tsx').default;
const Page = require('../app/dashboard/adviser/reports/page.tsx').default;
const out = process.env.REPORT_TEST_OUTPUT || 'test-results/phase10-e3';
fs.mkdirSync(out, { recursive: true });
const request = (overrides = {}) => ({ reportType: 'current-supervision-summary', selection: 'all', sections: [], format: 'preview', ...overrides });
const http = body => new Request('https://report.example.invalid/api/adviser/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const aggregateQueries = () => state.queries.filter(item => /from "(?:research_groups|research_papers|submissions)"/.test(item.sql));
beforeEach(() => { state = { session: { userId: 2, roleId: 2, email: 'synthetic@example.invalid' }, main: 2, active: true, accountRole: 2, authorityReads: 0, queries: [], transactions: [] }; });

test('only current active institutional Main can access service, page and export; generic Adviser and delegated Co are denied', async () => {
    for (const session of [null, { userId: 1, roleId: 1 }, { userId: 3, roleId: 3 }, { userId: 4, roleId: 4 }, { userId: 9, roleId: 2 }, { userId: 4, roleId: 2 }]) {
        state.session = session; state.queries = [];
        const result = await POST(http(request({ format: 'xlsx' })));
        assert.equal(result.status, 403); assert.equal(aggregateQueries().length, 0);
        assert.match(result.headers.get('Cache-Control'), /private, no-store/);
        if (session?.roleId === 2) await assert.rejects(Page(), /NEXT_REDIRECT/);
    }
    state.session = { userId: 2, roleId: 2 }; state.active = false;
    assert.equal((await service.getMainAdviserReport(request())).status, 403);
    state.active = true; state.main = null;
    assert.equal((await service.getMainAdviserReport(request())).status, 403);
    state.main = 2; state.accountRole = 3;
    assert.equal((await service.getMainAdviserReport(request())).status, 403);
});

test('All expands server catalog; all archived/empty groups and version semantics use authorized complete read-only queries', async () => {
    const result = await service.getMainAdviserReport(request({ sections: ['groups'] }));
    assert.ok(result.ok);
    assert.deepEqual(result.report.sections.map(item => item.id), ['groups', 'papers', 'submissions', 'revisions', 'group-summary']);
    assert.deepEqual(result.report.sections.slice(0, 4).map(item => item.rows[0].value), [5, 3, 7, 2]);
    assert.deepEqual(result.report.sections[2].rows.map(item => item.value), [7, 3, 3, 1]);
    assert.deepEqual(result.report.sections[0].rows.map(item => item.value), [5, 4, 1, 0]);
    const groups = result.report.sections[4].groupRows;
    assert.equal(groups.length, 5); assert.equal(groups[1].status, 'Archived'); assert.equal(groups[4].projects, 0);
    assert.match(result.report.sections[2].note, /not actions personally performed/);
    assert.match(result.report.sections[3].note, /overlaps reviewed workload/);
    assert.deepEqual(state.transactions, [{ isolationLevel: 'repeatable read', accessMode: 'read only' }]);
    assert.ok(aggregateQueries().every(item => /main_adviser_designation/.test(item.sql) && /is_active/.test(item.sql)));
    assert.ok(state.queries.every(item => !/adviser_id" =|group_name|email|file_url|abstract|comments|recommendation|submitted_by|limit |insert |update |delete /i.test(item.sql)));
    const groupSql = aggregateQueries().find(item => /order by/.test(item.sql));
    assert.equal((groupSql.sql.match(/select count\(\*\)/g) || []).length, 3);
    assert.ok(groupSql.parameters.includes('Submitted') && groupSql.parameters.includes('Under Review') && groupSql.parameters.includes('Revision Required'));
    assert.equal(Object.hasOwn(result.report, 'period'), false);
    assert.match(result.report.scope, /including archived/);
    const page = await Page(); assert.ok(page);
    fs.writeFileSync(`${out}/dataset.json`, JSON.stringify(result.report));
});

test('custom queries only selected data, rejects empty/duplicate/foreign sections, identity injection and historical periods', async () => {
    const result = await service.getMainAdviserReport(request({ selection: 'custom', sections: ['group-summary'] }));
    assert.ok(result.ok); assert.deepEqual(result.report.sections.map(item => item.id), ['group-summary']);
    assert.equal(aggregateQueries().length, 1);
    for (const overrides of [{ selection: 'custom', sections: [] }, { sections: ['users'] }, { sections: ['repository'] }, { sections: ['groups', 'groups'] }, { actorId: 2 }, { reportType: 'current-summary' }, { format: 'csv' }, ...['weekly', 'monthly', 'yearly'].map(kind => ({ period: { kind, value: '2026' } }))]) {
        state.queries = [];
        assert.equal((await service.getMainAdviserReport(request(overrides))).status, 400);
        assert.equal(aggregateQueries().length, 0);
    }
});

test('repository independently denies changed designation; revocation after read and after rendering prevents delivery', async () => {
    state.revokeOnGuard = true;
    assert.equal(await repository.readMainAdviserReportSnapshot(2, ['groups']), null);
    assert.equal(aggregateQueries().length, 0);
    state.revokeOnGuard = false;
    for (const [revokeAt, format] of [[3, 'preview'], [4, 'preview'], [4, 'pdf'], [4, 'xlsx']]) {
        state.main = 2; state.authorityReads = 0; state.revokeAt = revokeAt;
        assert.equal((await POST(http(request({ format })))).status, 403);
    }
});

test('empty supervision is zero/empty data; missing designation denies; database failures never masquerade as zero', async () => {
    state.empty = true;
    const result = await service.getMainAdviserReport(request()); assert.ok(result.ok);
    assert.ok(result.report.sections.every(section => section.rows.every(row => row.value === 0)));
    assert.deepEqual(result.report.sections[4].groupRows, []);
    const html = renderToStaticMarkup(React.createElement(Tables, { report: result.report }));
    assert.match(html, /No records are currently available/);
    state.failure = true;
    const failed = await POST(http(request()));
    assert.ok([403, 503].includes(failed.status));
    assert.doesNotMatch(await failed.text(), /PRIVATE_DATABASE_INFORMATION/);
    state.failure = false; state.empty = false;
    assert.throws(() => data.buildMainAdviserReport(request(), {}, new Date()), /Missing/);
});

test('shared XLSX, table data and selected-only group worksheet preserve numeric values and truthful metadata', async () => {
    const result = await service.getMainAdviserReport(request()); assert.ok(result.ok);
    const workbook = new ExcelJS.Workbook();
    const bytes = await renderer.renderReportXlsx(result.report); await workbook.xlsx.load(Buffer.from(bytes));
    assert.deepEqual(workbook.worksheets.map(sheet => sheet.name), ['Report Information', ...result.report.sections.map(section => section.label)]);
    const info = workbook.getWorksheet('Report Information').getSheetValues().flat().filter(Boolean).join(' ');
    assert.match(info, /Current Research Supervision Summary/); assert.match(info, /Asia\/Manila/); assert.match(info, /Current snapshot at generation time/);
    assert.doesNotMatch(info, /Reporting period|Calendar selection|weekly:|monthly:|yearly:/);
    for (const section of result.report.sections) {
        const sheet = workbook.getWorksheet(section.label);
        if (section.groupRows) section.groupRows.forEach((group, index) => {
            assert.deepEqual(sheet.getRow(index + 5).values.slice(1), [group.label, group.status, group.projects, group.pending, group.revisionRequired]);
            assert.equal(sheet.getCell(index + 5, 3).type, ExcelJS.ValueType.Number);
        });
        else section.rows.forEach((row, index) => assert.deepEqual(sheet.getRow(index + 5).values.slice(1), [row.label, row.value]));
    }
    const html = renderToStaticMarkup(React.createElement(Tables, { report: result.report }));
    assert.match(html, /Group 5/); assert.match(html, /<caption>Group Summary<\/caption>/); assert.match(html, /Pending versions/);
    const custom = await service.getMainAdviserReport(request({ selection: 'custom', sections: ['group-summary'] }));
    const subset = new ExcelJS.Workbook(); await subset.xlsx.load(Buffer.from(await renderer.renderReportXlsx(custom.report)));
    assert.deepEqual(subset.worksheets.map(sheet => sheet.name), ['Report Information', 'Group Summary']);
    fs.writeFileSync(`${out}/report.xlsx`, bytes);
});

test('HTTP XLSX/PDF delivery has valid files and private safe headers; full group table paginates', async () => {
    for (const format of ['xlsx', 'pdf']) {
        state.authorityReads = 0;
        const response = await POST(http(request({ format })));
        assert.equal(response.status, 200);
        assert.match(response.headers.get('Content-Disposition'), new RegExp(`^attachment; filename="thesishs-current-research-supervision-summary-[0-9]{8}T[0-9]{9}Z\.${format}"$`));
        assert.match(response.headers.get('Cache-Control'), /private, no-store/); assert.equal(response.headers.get('Vary'), 'Cookie');
        assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff');
        const bytes = Buffer.from(await response.arrayBuffer());
        assert.equal(bytes.subarray(0, format === 'pdf' ? 5 : 2).toString(), format === 'pdf' ? '%PDF-' : 'PK');
        if (format === 'pdf') { assert.equal(response.headers.get('Content-Type'), 'application/pdf'); assert.match(bytes.toString('latin1'), /%%EOF/); }
        else assert.match(response.headers.get('Content-Type'), /spreadsheetml/);
        fs.writeFileSync(`${out}/download.${format}`, bytes);
    }
    assert.equal((await POST(http('{'))).status, 400);
    assert.equal((await POST(http(' '.repeat(5000)))).status, 413);
    const custom = await service.getMainAdviserReport(request({ selection: 'custom', sections: ['group-summary'] }));
    custom.report.sections[0].groupRows = Array.from({ length: 65 }, (_, index) => ({ id: `group-${index + 1}`, label: `Group ${index + 1}`, status: 'Archived', projects: index + 1, pending: index, revisionRequired: 0 }));
    fs.writeFileSync(`${out}/long-groups.pdf`, await renderer.renderReportPdf(custom.report));
});
