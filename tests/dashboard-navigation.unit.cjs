/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { dashboardLinks, mobileNavigation, isDashboardLinkActive } = require('../lib/constants/dashboard-navigation.ts');
const { navigationProfile, sidebarPreference } = require('../lib/pwa/navigation-preferences.ts');

test('Settings sidebar preference exposes only applicable modes and routes selection to the shared store', () => {
    let displayMode = 'browser', platform = 'desktop';
    const calls = [], exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/dashboard/sidebar-preferences.tsx', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, { exports, require: id => {
        if (id === 'react/jsx-runtime') return require(id);
        if (id.endsWith('.css')) return { default: {} };
        if (id.endsWith('use-display-mode')) return { useDisplayMode: () => displayMode, usePwaPlatform: () => platform };
        if (id.endsWith('navigation-preferences')) return { useSidebarPreference: profile => profile === 'desktop' ? 'hidden' : 'compact',
            selectSidebarMode: (...args) => calls.push(args) };
        throw Error('Unexpected component dependency ' + id);
    } });
    const Component = exports.default, html = () => renderToStaticMarkup(React.createElement(Component));
    assert.match(html(), /Sidebar mode/); assert.match(html(), /1024px/); assert.doesNotMatch(html(), /value="hidden"/);
    const select = Component().props.children.at(-1).props.children[1];
    select.props.onChange({ target: { value: 'expanded' } }); assert.deepEqual(calls.pop(), ['browser', 'expanded']);
    displayMode = 'standalone';
    assert.match(html(), /value="hidden" selected=""/);
    const desktopSelect = Component().props.children.at(-1).props.children[1];
    desktopSelect.props.onChange({ target: { value: 'compact' } }); assert.deepEqual(calls.pop(), ['desktop', 'compact']);
    for (platform of ['android', 'ios', 'unknown']) assert.equal(html(), '');
    displayMode = 'unknown'; platform = 'desktop'; assert.equal(html(), '');
    displayMode = 'browser'; platform = 'android'; assert.match(html(), /Sidebar mode/);
});

for (const [role, labels] of [[3, ['Dashboard', 'Submissions', 'Workspace']], [2, ['Dashboard', 'Submissions', 'Groups']],
    [1, ['Dashboard', 'Users', 'Groups', 'Repository']]]) {
    test(`role ${role}: approved primary routes plus secondary preserve every existing destination`, () => {
        const links = dashboardLinks(role), { primary, secondary } = mobileNavigation(links);
        assert.deepEqual(primary.map(link => link.bottomLabel), labels);
        assert.deepEqual([...primary, ...secondary].map(link => link.href).sort(), links.map(link => link.href).sort());
        assert.equal(new Set(links.map(link => link.href)).size, links.length);
        assert.equal(primary.some(link => link.href === '/dashboard/settings'), false);
        assert.ok(secondary.some(link => link.href === '/dashboard/settings'));
        assert.ok(!links.some(link => link.href.includes('/notifications')), 'Existing bell/history stays separate');
        if (role === 1) {
            assert.equal(primary.at(-1).href, '/dashboard/admin/repository');
            assert.ok(secondary.some(link => link.href === '/dashboard/repository'));
            assert.ok(secondary.some(link => link.href === '/dashboard/admin/reports'));
        }
    });
}
test('Panel and unknown roles gain no invented bottom destinations', () => {
    assert.deepEqual(mobileNavigation(dashboardLinks(4)).primary, []);
    assert.deepEqual(dashboardLinks(4).map(link => link.href), ['/dashboard', '/dashboard/repository', '/dashboard/settings']);
    assert.deepEqual(mobileNavigation(dashboardLinks(99)), { primary: [], secondary: [] });
});
test('active routes match nested destinations without prefix collisions or duplicate home', () => {
    const links = dashboardLinks(3);
    assert.deepEqual(links.filter(link => isDashboardLinkActive('/dashboard/student/submissions/8', link)).map(link => link.bottomLabel), ['Submissions']);
    assert.equal(links.some(link => isDashboardLinkActive('/dashboard/student/submissions-elsewhere', link)), false);
    assert.equal(isDashboardLinkActive('/dashboard/settings/elsewhere', links.at(-1)), false);
});
test('platform hints affect presentation only, with conservative unknown/Panel fallback', () => {
    for (const platform of ['android', 'ios', 'desktop', 'unknown']) {
        assert.equal(navigationProfile('browser', platform, true), 'browser');
        assert.equal(navigationProfile('unknown', platform, true), 'browser');
    }
    assert.equal(navigationProfile('standalone', 'desktop', true), 'desktop');
    for (const platform of ['android', 'ios']) {
        assert.equal(navigationProfile('standalone', platform, true), 'mobile');
        assert.equal(navigationProfile('standalone', platform, false), 'browser');
    }
    assert.equal(navigationProfile('standalone', 'unknown', true), 'browser');
});
test('stored values are validated independently for browser and desktop', () => {
    for (const invalid of [null, '', 'anything', 'EXPANDED', '"compact"']) {
        assert.equal(sidebarPreference(invalid, 'browser'), 'expanded');
        assert.equal(sidebarPreference(invalid, 'desktop'), 'compact');
    }
    assert.equal(sidebarPreference('hidden', 'browser'), 'expanded');
    assert.equal(sidebarPreference('hidden', 'desktop'), 'hidden');
    for (const mode of ['expanded', 'compact']) for (const profile of ['browser', 'desktop']) assert.equal(sidebarPreference(mode, profile), mode);
});

function storeFixture(blocked = false) {
    const events = new Map(), values = new Map(), writes = [], subscribers = [], snapshots = [];
    const storage = { getItem: key => { if (blocked) throw Error('Blocked'); return values.get(key) ?? null; },
        setItem: (key, value) => { if (blocked) throw Error('Blocked'); values.set(key, value); writes.push([key, value]); } };
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/pwa/navigation-preferences.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports, localStorage: storage,
        window: { addEventListener: (name, cb) => events.set(name, cb), removeEventListener: name => events.delete(name) },
        require: id => { assert.equal(id, 'react'); return { useSyncExternalStore(subscribe, snapshot, server) {
            assert.equal(server(), null); snapshots.push(snapshot); subscribers.push(subscribe(() => {})); return snapshot();
        } }; },
    });
    return { api: exports, events, storage, writes, subscribers, values, snapshots };
}
test('blocked storage retains explicit choices in memory and subscribes once', () => {
    const f = storeFixture(true);
    assert.equal(f.api.useSidebarPreference('browser'), 'expanded');
    assert.equal(f.api.useSidebarPreference('desktop'), 'compact');
    f.api.selectSidebarMode('desktop', 'hidden');
    assert.equal(f.api.useSidebarPreference('desktop'), 'hidden');
    assert.equal(f.api.useSidebarPreference('browser'), 'expanded');
    assert.equal(f.events.size, 1);
    f.subscribers.forEach(unsubscribe => unsubscribe());
    assert.equal(f.events.size, 0);
});
test('storage events synchronize only matching local preferences, including clear and invalid values', () => {
    const f = storeFixture(), keys = f.api.NAVIGATION_STORAGE_KEYS;
    f.api.useSidebarPreference('browser'); f.api.useSidebarPreference('desktop');
    f.api.selectSidebarMode('desktop', 'hidden');
    assert.equal(f.writes.length, 1);
    const event = (key, newValue, storageArea = f.storage) => f.events.get('storage')({ key, newValue, storageArea });
    event(keys.browser, 'compact', {});
    assert.equal(f.snapshots[0](), 'expanded');
    event(keys.browser, 'compact');
    assert.equal(f.snapshots[0](), 'compact'); assert.equal(f.snapshots[1](), 'hidden');
    event(keys.desktop, 'invalid'); assert.equal(f.snapshots[1](), 'compact');
    event(null, null); assert.equal(f.snapshots[0](), 'expanded'); assert.equal(f.snapshots[1](), 'compact');
    assert.equal(f.writes.length, 1, 'Responsive reads and cross-tab updates do not write preferences');
    f.subscribers.forEach(unsubscribe => unsubscribe());
});
