/* eslint-disable @typescript-eslint/no-require-imports */
// Offline integration checks only; all account/service boundaries are explicit doubles.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { execFileSync } = require('node:child_process'), { test } = require('node:test');
const ts = require('typescript'), React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const roles = { ROLE_IDS: { ADMIN: 1, ADVISER: 2, STUDENT: 3, PANEL: 4 } };
function load(source, mocks) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
        { exports, require: id => { if (id in mocks) return mocks[id]; if (id === 'react/jsx-runtime') return require(id); throw Error('Unexpected dependency '+id); } });
    return exports;
}
const nav = load(fs.readFileSync('lib/constants/dashboard-navigation.ts', 'utf8'), { '@/lib/auth/roles': roles });
test('one Adviser-only criteria entry preserves other roles, bottom navigation and path matching', () => {
    const before = load(execFileSync('git', ['show', 'HEAD:lib/constants/dashboard-navigation.ts'], { encoding: 'utf8' }), { '@/lib/auth/roles': roles });
    for (const id of [1, 3, 4, 99]) assert.equal(JSON.stringify(nav.dashboardLinks(id)), JSON.stringify(before.dashboardLinks(id)));
    const links = nav.dashboardLinks(2), index = links.findIndex(link => link.label === 'Review Submissions');
    assert.equal(links.filter(link => link.label === 'Evaluation Criteria').length, 1);
    assert.equal(links[index+1].href, nav.EVALUATION_CRITERIA_HREF);
    assert.equal(JSON.stringify(nav.mobileNavigation(links).primary), JSON.stringify(before.mobileNavigation(before.dashboardLinks(2)).primary));
    assert.equal(nav.mobileNavigation(links).secondary.some(link => link.href === nav.EVALUATION_CRITERIA_HREF), true);
    for (const route of [nav.EVALUATION_CRITERIA_HREF, '/dashboard/adviser/submissions', '/dashboard/adviser/submissions/123']) {
        const active = links.filter(link => nav.isDashboardLinkActive(route, link));
        assert.equal(active.length, 1); assert.equal(active[0].href, route === nav.EVALUATION_CRITERIA_HREF ? route : '/dashboard/adviser/submissions');
    }
});
test('canonical route guards role and Main designation before importing/querying private templates', async () => {
    let role = 2, main = true, lists = 0;
    const component = label => ({ default: props => React.createElement('section', null, props.title || label, props.children) });
    const page = load(fs.readFileSync('app/dashboard/adviser/evaluation-criteria/page.tsx', 'utf8'), {
        'next/link': { default: props => React.createElement('a', { href: props.href }, props.children) },
        '@/components/dashboard/dashboard-header': component('Header'), '@/components/dashboard/evaluation-template-manager': component('Saved templates'),
        '@/components/dashboard/adviser-submissions.module.css': { default: {} }, '@/lib/auth/roles': roles,
        '@/lib/auth/authorization': { requireRole: async allowed => { if (!allowed.includes(role)) throw Error('ROLE_REDIRECT'); return { userId: 1, roleId: role, email: 'fixture@example.invalid' }; } },
        '@/lib/auth/main-adviser': { getCurrentMainAdviser: async id => main ? { userId: id, email: 'fixture@example.invalid' } : null },
        '@/lib/services/evaluation-template.service': { listEvaluationTemplates: async () => { lists++; return { success: true, data: [] }; } },
    }).default;
    assert.match(renderToStaticMarkup(await page()), /Saved templates/); assert.equal(lists, 1);
    main = false;
    const co = renderToStaticMarkup(await page()); assert.match(co, /when template assignment becomes available/); assert.doesNotMatch(co, /Saved templates/); assert.equal(lists, 1);
    for (role of [1, 3, 4, 99]) await assert.rejects(page(), /ROLE_REDIRECT/);
    assert.equal(lists, 1);
});
test('legacy exact scalar query redirects; all other views preserve the directory without duplicate links', async () => {
    let directories = 0;
    const empty = { default: () => null };
    const page = load(fs.readFileSync('app/dashboard/adviser/submissions/page.tsx', 'utf8'), {
        '@/components/dashboard/local-ai-assistance': empty, '@/components/dashboard/dashboard-header': empty,
        '@/components/dashboard/adviser-submissions': empty, '@/components/dashboard/co-adviser-workspace': empty,
        '@/components/dashboard/adviser-submissions.module.css': { default: {} }, '@/lib/constants/dashboard-navigation': nav,
        '@/lib/evaluation-templates': { isTemplateView: value => value === 'templates' },
        'next/navigation': { redirect: href => { throw Error('REDIRECT:'+href); } },
        '@/lib/services/adviser-submissions-ui.service': { getAdviserSubmissionsDirectory: async () => { directories++; return { email: '', submissions: [] }; } },
        '@/lib/services/co-adviser.service': { getCoAdviserWorkspace: async () => { throw Error('Unexpected delegated query'); } },
    }).default;
    await assert.rejects(page({ searchParams: Promise.resolve({ view: 'templates' }) }), /REDIRECT:\/dashboard\/adviser\/evaluation-criteria/); assert.equal(directories, 0);
    for (const view of [undefined, 'all', ['templates'], 'Templates']) assert.doesNotMatch(renderToStaticMarkup(await page({ searchParams: Promise.resolve({ view }) })), /Evaluation templates|evaluation-criteria/);
    assert.equal(directories, 4);
});
test('successful actions invalidate canonical and legacy paths without changing mutation payloads', async () => {
    const paths = [], input = { operation: 'archive', templateId: 1, expectedRevision: 0 };
    const result = { success: true, message: 'Saved.' };
    const actions = load(fs.readFileSync('lib/actions/evaluation-template.action.ts', 'utf8'), {
        'next/cache': { revalidatePath: path => paths.push(path) }, '@/lib/constants/dashboard-navigation': nav,
        '@/lib/services/evaluation-template.service': { mutateEvaluationTemplate: async value => { assert.equal(value, input); return result; } },
    });
    assert.equal(await actions.mutateEvaluationTemplateAction(input), result);
    assert.deepEqual(paths, [nav.EVALUATION_CRITERIA_HREF, '/dashboard/adviser/submissions']);
});
