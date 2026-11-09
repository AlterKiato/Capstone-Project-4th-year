/* eslint-disable @typescript-eslint/no-require-imports */
// One synthetic Chromium component run; no Next server, database or hosted requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { chromium, expect } = require('@playwright/test');

async function main() {
    const bundle = await build({ write: false, outfile: 'ui.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
        stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `import React from 'react';import{createRoot}from'react-dom/client';import Panel from './components/dashboard/admin-main-adviser';const root=createRoot(document.getElementById('root'));window.renderPanel=(configuration,key=0)=>root.render(<main className="dashboard-page admin-surface"><Panel key={key} configuration={configuration}/></main>);` },
        plugins: [{ name: 'synthetic-boundaries', setup(builder) {
            builder.onResolve({ filter: /^@\/lib\/actions\// }, () => ({ path: 'actions', namespace: 'mock' }));
            builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'mock' }));
            builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ loader: 'js', contents: args.path === 'actions'
                ? `window.__state={calls:[],refreshes:0,delay:0,result:{success:true,kind:'success',message:'Main Research Adviser designation saved.'}};export async function designateMainAdviserAction(input){window.__state.calls.push(input);await new Promise(r=>setTimeout(r,window.__state.delay));return window.__state.result;}`
                : `export function useRouter(){return {refresh(){window.__state.refreshes++;}}}` }));
        } }],
    });
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 360, height: 720 } });
        const errors = [], requests = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
        await page.setContent('<html data-theme="light"><body><div id="root"></div></body></html>');
        await page.addStyleTag({ content: '@layer base {' + fs.readFileSync('node_modules/tailwindcss/preflight.css', 'utf8') + '}\n' + fs.readFileSync('app/globals.css', 'utf8') + '\n' + bundle.outputFiles.find(file => file.path.endsWith('.css')).text });
        await page.addScriptTag({ content: bundle.outputFiles.find(file => file.path.endsWith('.js')).text });
        const first = { id: 20, firstName: 'Synthetic', lastName: 'First', email: 'first@example.invalid' };
        const second = { id: 30, firstName: 'Synthetic', lastName: 'Second', email: 'second@example.invalid' };
        const empty = { revision: 0, current: null, eligibleAdvisers: [] };
        await page.evaluate(configuration => window.renderPanel(configuration), empty);
        await expect(page.getByText('No Main Research Adviser has been designated.')).toBeVisible();
        await expect(page.getByLabel('Eligible Adviser')).toBeDisabled();
        await page.evaluate(configuration => window.renderPanel(configuration, 1), { ...empty, eligibleAdvisers: [first, second] });
        await page.getByLabel('Eligible Adviser').selectOption('20');
        await page.getByRole('button', { name: 'Review designation' }).click();
        let dialog = page.getByRole('dialog', { name: 'Designate Main Research Adviser', exact: true });
        await expect(dialog).toBeVisible(); assert.equal(await page.evaluate(() => window.__state.calls.length), 0);
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Review designation' })).toBeFocused();
        await page.getByRole('button', { name: 'Review designation' }).click();
        await dialog.getByRole('button', { name: 'Confirm designation', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        assert.deepEqual(await page.evaluate(() => window.__state.calls), [{ mainAdviserId: 20, expectedRevision: 0, confirmed: true }]);
        const configured = { revision: 1, current: { ...first, eligible: true }, eligibleAdvisers: [first, second] };
        await page.evaluate(configuration => window.renderPanel(configuration, 2), configured);
        await page.getByLabel('Eligible Adviser').selectOption('20');
        await expect(page.getByRole('button', { name: 'Review designation' })).toBeDisabled();
        await page.getByLabel('Eligible Adviser').selectOption('30');
        await page.getByRole('button', { name: 'Review designation' }).click();
        dialog = page.getByRole('dialog', { name: 'Replace Main Research Adviser', exact: true });
        await expect(dialog).toContainText('Current: Synthetic First');
        await expect(dialog).toContainText('Replace with: Synthetic Second');
        await page.evaluate(() => { window.__state.result = { success: false, kind: 'stale', message: 'The designation changed. Refresh and review.' }; });
        await dialog.getByRole('button', { name: 'Confirm designation', exact: true }).click();
        await expect(dialog.getByRole('status')).toContainText('Refresh');
        await expect(dialog.getByRole('button', { name: 'Confirm designation', exact: true })).toBeDisabled();
        await dialog.getByRole('button', { name: 'Refresh designation', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(page.getByLabel('Eligible Adviser')).toHaveValue('');
        for (const [width, theme] of [[360, 'light'], [1280, 'dark']]) {
            await page.setViewportSize({ width, height: 800 });
            await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            await expect(page.getByRole('heading', { name: 'Main Research Adviser', exact: true })).toBeVisible();
            const overflow = await page.evaluate(() => [...document.querySelectorAll('main,section,select,label,button')].map(element => ({ tag: element.tagName, width: element.getBoundingClientRect().width, right: element.getBoundingClientRect().right })).filter(box => box.right > window.innerWidth));
            if (overflow.length) await page.screenshot({ path: 'test-results/s31/ui-overflow.png' });
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal page overflow: ' + JSON.stringify(overflow));
            await page.screenshot({ path: `test-results/s31/panel-${width}-${theme}.png` });
        }
        await page.evaluate(() => { window.__state.delay = 150; window.__state.result = { success: false, uncertain: true, kind: 'uncertain', message: 'Refresh and verify before retrying.' }; });
        await page.getByLabel('Eligible Adviser').selectOption('30');
        await page.getByRole('button', { name: 'Review designation' }).click();
        const before = await page.evaluate(() => window.__state.calls.length);
        await page.getByRole('dialog').locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
        await expect(page.getByRole('dialog').getByRole('status')).toContainText('Refresh and verify');
        assert.equal(await page.evaluate(() => window.__state.calls.length), before + 1);
        await expect(page.getByRole('button', { name: 'Confirm designation', exact: true })).toBeDisabled();
        assert.deepEqual(errors, []); assert.deepEqual(requests, []);
        console.log('PASS synthetic Chromium: empty/current state, eligible choices, explicit confirmation/cancel/focus, same-target denial, captured revision, stale refresh, uncertain replay prevention, duplicate submit guard and 360-Light/1280-Dark overflow. No runtime acceptance.');
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
