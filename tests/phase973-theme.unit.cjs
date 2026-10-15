/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { themePreference, effectiveTheme, THEME_INITIALIZATION, THEME_STORAGE_KEY } = require('../lib/theme.ts');

for (const stored of [null, '', 'invalid', 'SYSTEM', 'light', 'dark', 'system']) {
    for (const systemDark of [false, true]) {
        const preference = stored === 'light' || stored === 'dark' ? stored : 'system';
        assert.equal(themePreference(stored), preference);
        const document = { documentElement: { dataset: {} } };
        vm.runInNewContext(THEME_INITIALIZATION, {
            document,
            localStorage: { getItem(key) { assert.equal(key, THEME_STORAGE_KEY); return stored; } },
            matchMedia(query) { assert.equal(query, '(prefers-color-scheme: dark)'); return { matches: systemDark }; },
        });
        assert.equal(document.documentElement.dataset.theme, effectiveTheme(preference, systemDark));
    }
}
for (const systemDark of [false, true]) {
    const document = { documentElement: { dataset: {} } };
    vm.runInNewContext(THEME_INITIALIZATION, {
        document,
        get localStorage() { throw new Error('Storage blocked'); },
        matchMedia: () => ({ matches: systemDark }),
    });
    assert.equal(document.documentElement.dataset.theme, systemDark ? 'dark' : 'light');
}
console.log('PASS theme normalization, effective resolution and pre-paint script including unavailable storage');
