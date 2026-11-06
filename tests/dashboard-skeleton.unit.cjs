/* eslint-disable @typescript-eslint/no-require-imports */
// Actual route/component JSX with synthetic server boundaries; no database or network.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(path, mocks = {}) {
    const sandboxModule = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText;
    vm.runInNewContext(code, { module: sandboxModule, exports: sandboxModule.exports, require: id => {
        if (Object.hasOwn(mocks, id)) return mocks[id];
        if (id.endsWith('.module.css')) return { default: new Proxy({}, { get: (_target, key) => String(key) }) };
        throwUnlessSafe(id); return require(id);
    } });
    return sandboxModule.exports.default;
}
function throwUnlessSafe(id) {
    assert.ok(['react', 'react/jsx-runtime'].includes(id), 'Unexpected runtime dependency: ' + id);
}
const Skeleton = load('components/dashboard/dashboard-skeleton.tsx');
const skeletonModule = { default: Skeleton };
const pages = ['student', 'submissions', 'workspace', 'adviser', 'groups', 'admin'];
test('six distinct static skeletons expose one loading message and no records or controls', () => {
    const layouts = new Set();
    for (const page of pages) {
        const html = renderToStaticMarkup(React.createElement(Skeleton, { page }));
        assert.match(html, /aria-busy="true"/); assert.match(html, /aria-hidden="true"/);
        assert.equal((html.match(/role="status"/g) || []).length, 1);
        assert.doesNotMatch(html, /<(button|input|select|textarea|a)\b|tabindex|\d+%|<h[1-6]/i);
        assert.match(html.replace(/<[^>]+>/g, ''), /^Loading [a-z ]+…$/);
        layouts.add(html.replace(/data-skeleton="[^"]+"|aria-label="[^"]+"|Loading [^<]+/g, ''));
    }
    assert.equal(layouts.size, 6);
});
test('Student ancestor selects the current page and preserves unrelated neutral fallbacks', () => {
    let pathname;
    const Loading = load('app/dashboard/student/loading.tsx', {
        'next/navigation': { usePathname: () => pathname }, '@/components/dashboard/dashboard-skeleton': skeletonModule,
    });
    for (const [path, page] of [['', 'student'], ['/submissions', 'submissions'], ['/workspace', 'workspace']]) {
        pathname = '/dashboard/student' + path;
        assert.match(renderToStaticMarkup(React.createElement(Loading)), new RegExp(`data-skeleton="${page}"`));
    }
    for (const path of ['/notifications', '/verify-email']) {
        pathname = '/dashboard/student' + path;
        const html = renderToStaticMarkup(React.createElement(Loading));
        assert.doesNotMatch(html, /data-skeleton/); assert.match(html, /Loading research information/);
    }
    for (const [path, page] of [['submissions', 'submissions'], ['workspace', 'workspace']]) {
        const Nested = load(`app/dashboard/student/${path}/loading.tsx`, { '@/components/dashboard/dashboard-skeleton': skeletonModule });
        assert.match(renderToStaticMarkup(React.createElement(Nested)), new RegExp(`data-skeleton="${page}"`));
    }
    assert.equal(fs.existsSync('app/dashboard/admin/loading.tsx'), false, 'Admin fallback must not cover management routes');
});
const Header = ({ title }) => React.createElement('h1', null, title);
test('Admin guard finishes before its page-local fallback; original independent reads run once', async () => {
    let authorized = false, reads = 0, release;
    const guard = new Promise(resolve => { release = resolve; });
    const Page = load('app/dashboard/admin/page.tsx', {
        '@/lib/auth/authorization': { requireRole: async roles => {
            assert.equal(roles[0], 1); await guard; if (!authorized) throw Error('REDIRECT'); return { email: 'synthetic@example.invalid' };
        } }, '@/lib/auth/roles': { ROLE_IDS: { ADMIN: 1 } },
        '@/components/dashboard/dashboard-header': { default: Header },
        '@/components/dashboard/admin-overview': { AdminMetrics: () => null, AdminActivity: () => null },
        '@/components/dashboard/dashboard-skeleton': skeletonModule,
        '@/lib/services/dashboard.service': {
            getAdminDashboardStats: async () => { reads++; return { success: true, data: { totalStudents: 1, totalAdvisers: 1 } }; },
            getAdminRecentActivities: async () => { reads++; return { success: true, data: [] }; },
        },
    });
    const pending = Page(); assert.equal(reads, 0); authorized = true; release();
    const boundary = await pending; assert.equal(boundary.type, React.Suspense); assert.equal(reads, 0);
    assert.match(renderToStaticMarkup(boundary.props.fallback), /data-skeleton="admin"/);
    const body = await boundary.props.children.type(boundary.props.children.props);
    assert.match(renderToStaticMarkup(body), /Admin Dashboard/); assert.equal(reads, 2);
    authorized = false; await assert.rejects(Page, /REDIRECT/); assert.equal(reads, 2);
});
test('Adviser overview preserves its pre-fallback account/role guard and data child', async () => {
    let roleId = 2, reads = 0;
    const Page = load('app/dashboard/adviser/page.tsx', {
        'next/link': { default: props => React.createElement('a', props) },
        'next/navigation': { redirect: () => { throw Error('REDIRECT'); } },
        '@/lib/auth/roles': { ROLE_IDS: { ADVISER: 2 } },
        '@/lib/services/dashboard-account.service': { getDashboardAccount: async () => roleId ? { roleId } : null },
        '@/components/dashboard/dashboard-header': { default: Header },
        '@/components/dashboard/dashboard-skeleton': skeletonModule,
        '@/lib/services/adviser-dashboard.service': { getAdviserDashboard: async () => {
            reads++; return { totalGroups: 0, pending: 0, reviewed: 0, attention: [], groups: [] };
        } },
    });
    const boundary = await Page(); assert.equal(reads, 0);
    assert.match(renderToStaticMarkup(boundary.props.fallback), /data-skeleton="adviser"/);
    assert.match(renderToStaticMarkup(await boundary.props.children.type()), /Needs Your Attention/); assert.equal(reads, 1);
    roleId = 3; await assert.rejects(Page, /REDIRECT/); assert.equal(reads, 1);
    roleId = null; assert.equal(await Page(), null);
});
test('Adviser groups retains its existing Suspense/service boundary with only the fallback changed', async () => {
    let reads = 0;
    const Page = load('app/dashboard/adviser/groups/page.tsx', {
        '@/components/dashboard/dashboard-header': { default: Header },
        '@/components/dashboard/dashboard-skeleton': skeletonModule,
        '@/components/dashboard/adviser-groups': { default: () => null },
        '@/lib/services/adviser-groups.service': { getAdviserGroupsDirectory: async () => { reads++; return { email: '', groups: [] }; } },
    });
    const boundary = Page(); assert.equal(reads, 0);
    assert.match(renderToStaticMarkup(boundary.props.fallback), /data-skeleton="groups"/);
    assert.match(renderToStaticMarkup(await boundary.props.children.type()), /Research Groups/); assert.equal(reads, 1);
});
