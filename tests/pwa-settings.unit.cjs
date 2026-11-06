/* eslint-disable @typescript-eslint/no-require-imports */
// Actual layout/Settings components with synthetic account/browser boundaries only.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { detectPwaPlatform } = require('../lib/pwa/platform.ts');
function load(path, mocks) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText, { exports, require: id => {
        if (Object.hasOwn(mocks, id)) return mocks[id];
        if (id.endsWith('.module.css')) return { default: {} };
        if (['react', 'react/jsx-runtime', '@/lib/pwa/platform', '@/lib/pwa/research-push-client', '@/lib/pwa/research-push-navigation'].includes(id)) return require(id);
        throw Error('Unexpected runtime dependency: ' + id);
    } });
    return exports;
}
test('platform hints distinguish mobile/desktop conservatively, including desktop-style iPad', () => {
    for (const [userAgent, touch, expected] of [['Mozilla Android Chrome', 1, 'android'], ['Mozilla iPhone Safari', 1, 'ios'],
        ['Mozilla Macintosh Safari', 5, 'ios'], ['Mozilla Macintosh Safari', 0, 'desktop'], ['Mozilla Windows NT Chrome', 1, 'desktop'],
        ['Mozilla X11 Linux', 0, 'desktop'], ['', 0, 'unknown']]) {
        assert.equal(detectPwaPlatform({ userAgent, maxTouchPoints: touch }), expected);
    }
});
test('App Installation gives browser-specific guidance and no redundant standalone prompts', () => {
    let mode = 'browser', platform = 'android';
    const Component = load('components/dashboard/app-installation.tsx', {
        '@/lib/pwa/use-display-mode': { useDisplayMode: () => mode, usePwaPlatform: () => platform },
    }).default;
    const markup = () => renderToStaticMarkup(React.createElement(Component));
    for (const [kind, text] of [['android', 'In Chrome'], ['ios', 'In Safari'], ['desktop', 'In Chrome or Edge'], ['unknown', 'Look in your browser menu']]) {
        platform = kind; const html = markup(); assert.match(html, /App Installation/); assert.ok(html.includes(text));
        assert.match(html, /continue using your browser/); assert.match(html, /<details>/);
        assert.doesNotMatch(html, /<button|Research Notifications/);
    }
    mode = 'standalone';
    for (const kind of ['android', 'ios', 'desktop', 'unknown']) {
        platform = kind; const html = markup(); assert.match(html, /Running in installed app mode/);
        assert.doesNotMatch(html, /Installation instructions|<details>|<button/);
    }
    mode = 'unknown'; assert.match(markup(), /role="status"/);
});
test('push controls are a single consumer, visible only to installed mobile Students/Advisers', () => {
    let mode, platform, installed;
    const view = { phase: 'ready', canEnable: true, canDisable: false, message: 'Synthetic ready state' };
    class Client {
        constructor(context) { installed = context.installed; }
        subscribe = () => () => {}; snapshot = () => view; serverSnapshot = () => view;
    }
    const { default: Controls, ResearchPushProvider } = load('components/dashboard/research-push-enrollment.tsx', {
        'next/navigation': { useRouter: () => ({ push() {} }) },
        '@/lib/pwa/use-display-mode': { useDisplayMode: () => mode, usePwaPlatform: () => platform },
        '@/lib/pwa/research-push-client': { ResearchPushClient: Client },
        '@/lib/pwa/research-push-browser': { browserPushEnvironment: () => ({}) },
    });
    assert.equal(renderToStaticMarkup(React.createElement(Controls)), '');
    for (const roleId of [1, 2, 3, 4]) for (mode of ['unknown', 'browser', 'standalone']) for (platform of ['unknown', 'desktop', 'android', 'ios']) {
        const html = renderToStaticMarkup(React.createElement(ResearchPushProvider, {
            roleId, userId: 7, configured: true, expiresAt: 2000000000000,
        }, React.createElement(Controls)));
        const mobile = mode === 'standalone' && ['android', 'ios'].includes(platform);
        assert.equal(installed, mobile);
        assert.equal(html.includes('Enable Notifications'), mobile && [2, 3].includes(roleId));
        assert.equal(html.includes('Research Notifications'), mobile && [2, 3].includes(roleId));
    }
});
test('shared layout has no installation/footer region and keeps exactly one eligible push owner', async () => {
    let roleId = 3, available = true, owners = [], configurations = 0;
    const Wrapper = ({ children }) => React.createElement(React.Fragment, null, children);
    const Layout = load('app/dashboard/layout.tsx', {
        '@/components/auth/logout-button': { default: () => React.createElement('button', null, 'Logout') },
        '@/components/dashboard/dashboard-shell': { default: Wrapper }, '@/components/dashboard/notification-provider': { default: Wrapper },
        '@/lib/constants/dashboard-navigation': { dashboardLinks: () => [] }, '@/lib/constants/notification': { notificationHistoryHref: () => null },
        '@/lib/services/dashboard-account.service': { getDashboardAccount: async () => available ? { id: 7, roleId, expiresAt: 2000000000000 } : null },
        '@/lib/auth/roles': { ROLE_IDS: { STUDENT: 3, ADVISER: 2 } },
        '@/lib/push/config': { pushConfiguration: () => { configurations++; return { available: true }; } },
        '@/components/dashboard/research-push-enrollment': { ResearchPushProvider: props => { owners.push(props); return React.createElement(Wrapper, props); } },
    }).default;
    for (roleId of [1, 2, 3, 4]) {
        owners = []; configurations = 0;
        const html = renderToStaticMarkup(await Layout({ children: React.createElement('main', null, 'Research content') }));
        assert.equal(html, '<main>Research content</main>');
        assert.equal(owners.length, [2, 3].includes(roleId) ? 1 : 0);
        assert.equal(configurations, owners.length);
        if (owners.length) { assert.equal(owners[0].userId, 7); assert.equal(owners[0].roleId, roleId); }
    }
    available = false; assert.match(renderToStaticMarkup(await Layout({})), /Workspace unavailable/);
});
