/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToString } = require('react-dom/server');
const { useDisplayMode } = require('../lib/pwa/use-display-mode.ts');
const { dashboardLinks } = require('../lib/constants/dashboard-navigation.ts');

// Render the actual shell without Next routing, logout actions or CSS imports.
const originalLoad = Module._load;
Module._load = function(id, ...args) {
    if (id.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
    if (id === 'next/navigation') return { usePathname: () => '/dashboard/adviser' };
    if (id === 'next/link') return ({ children, onNavigate, prefetch, ...props }) => {
        void onNavigate; void prefetch;
        return React.createElement('a', props, children);
    };
    if (id === '@/components/auth/logout-button') return () => React.createElement('button', null, 'Logout');
    return originalLoad.call(this, id, ...args);
};
let DashboardShell;
try { DashboardShell = require('../components/dashboard/dashboard-shell.tsx').default; }
finally { Module._load = originalLoad; }

const source = ts.transpileModule(readFileSync(resolve(__dirname, '../lib/pwa/display-mode.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function load(window) {
    const context = { exports: {}, ...(window ? { window } : {}) };
    vm.runInNewContext(source, context);
    return context.exports;
}

function query(legacy = false) {
    const listeners = new Set();
    const media = { matches: false };
    const add = callback => listeners.add(callback);
    const remove = callback => assert.ok(listeners.delete(callback), 'Remove the exact subscribed callback');
    if (legacy) Object.assign(media, { addListener: add, removeListener: remove });
    else Object.assign(media, {
        addEventListener: (name, callback) => { assert.equal(name, 'change'); add(callback); },
        removeEventListener: (name, callback) => { assert.equal(name, 'change'); remove(callback); },
    });
    return { media, listeners };
}

test('server and initial hydration snapshot stay unknown without reading browser APIs', () => {
    const mode = load();
    assert.equal(mode.getDisplayMode(), 'unknown');
    assert.equal(mode.getServerDisplayMode(), 'unknown');
    mode.subscribeDisplayMode(() => assert.fail('No server listener'))();
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { configurable: true, get() { throw new Error('SSR browser access'); } });
    try {
        function Probe() { return React.createElement('span', null, useDisplayMode()); }
        assert.equal(renderToString(React.createElement(Probe)), '<span>unknown</span>');
    } finally {
        if (descriptor) Object.defineProperty(globalThis, 'window', descriptor);
        else delete globalThis.window;
    }
});

test('actual shell SSR keeps shared content and every server-provided role link in unknown mode', () => {
    for (const role of [1, 2, 3]) {
        const links = dashboardLinks(role);
        const html = renderToString(React.createElement(DashboardShell, { links }, React.createElement('main', null, 'Authorized server content')));
        assert.match(html, /data-display-mode="unknown"/);
        assert.match(html, /Authorized server content/);
        assert.match(html, /aria-label="Open navigation menu"/);
        for (const { href } of links) assert.ok(html.includes(`href="${href}"`), 'Retain provided route ' + href);
        const otherRole = role === 1 ? '/dashboard/adviser/groups' : '/dashboard/admin/users';
        assert.ok(!html.includes(`href="${otherRole}"`), 'Do not invent links for another role');
    }
});

test('browser and standalone use only the exact standalone media signal', () => {
    const { media } = query();
    const mode = load({ navigator: {}, matchMedia: value => {
        assert.equal(value, '(display-mode: standalone)');
        return media;
    }, innerWidth: 400, location: { search: '?standalone=true' }, localStorage: { getItem() { assert.fail('No saved mode'); } } });
    assert.equal(mode.getDisplayMode(), 'browser');
    media.matches = true;
    assert.equal(mode.getDisplayMode(), 'standalone');
    assert.equal(mode.getServerDisplayMode(), 'unknown');
});

test('iOS standalone fallback is feature detected and requires boolean true', () => {
    for (const standalone of [undefined, false, true, 'true', 1]) {
        const mode = load({ navigator: { standalone }, matchMedia: () => ({ matches: false }) });
        assert.equal(mode.getDisplayMode(), standalone === true ? 'standalone' : 'browser');
    }
    assert.equal(load({ navigator: { standalone: true } }).getDisplayMode(), 'standalone');
});

test('missing, partial and throwing media APIs retain ordinary browser fallback', () => {
    for (const window of [{}, { matchMedia: null }, { matchMedia: () => null },
        { matchMedia() { throw new Error('Unsupported'); } },
        { matchMedia: () => ({ matches: false, addEventListener() { assert.fail('No unpaired listener'); } }) },
        { matchMedia: () => ({ matches: false, addListener() { assert.fail('No unpaired legacy listener'); } }) },
        { matchMedia: () => ({ matches: false }) }]) {
        const mode = load(window);
        assert.equal(mode.getDisplayMode(), 'browser');
        mode.subscribeDisplayMode(() => assert.fail('No change event'))();
    }
});

for (const legacy of [false, true]) test(`${legacy ? 'legacy' : 'modern'} changes and independent listener cleanup`, () => {
    const { media, listeners } = query(legacy);
    const mode = load({ matchMedia: () => media });
    const observed = [];
    const unsubscribe = mode.subscribeDisplayMode(() => observed.push(mode.getDisplayMode()));
    const unsubscribeOther = mode.subscribeDisplayMode(() => {});
    assert.equal(listeners.size, 2);
    for (const matches of [true, false]) {
        media.matches = matches;
        listeners.forEach(listener => listener());
    }
    assert.deepEqual(observed, ['standalone', 'browser']);
    unsubscribe();
    assert.equal(listeners.size, 1);
    listeners.forEach(listener => listener());
    assert.equal(observed.length, 2);
    unsubscribeOther();
    assert.equal(listeners.size, 0);
});
