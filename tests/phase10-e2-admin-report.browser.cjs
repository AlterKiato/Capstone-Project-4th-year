/* eslint-disable @typescript-eslint/no-require-imports */
// Actual controls/tables/styles; synthetic HTTP transport, previously verified real export bytes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { chromium, expect } = require('@playwright/test');

async function main() {
    const delta = process.argv.includes('--delta');
    const out = process.env.REPORT_TEST_OUTPUT || (delta ? 'test-results/phase10-e21' : 'test-results/phase10-e2');
    const fixture = JSON.parse(fs.readFileSync(`${out}/dataset.json`, 'utf8'));
    const downloadName = format => `thesishs-current-research-summary-${fixture.generatedAt.replace(/[-:.]/g, '')}.${format}`;
    const bundle = await build({ write: false, outfile: 'report.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' }, stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';import{createRoot}from'react-dom/client';
import Controls from './components/dashboard/admin-report-controls';
const root=createRoot(document.getElementById('root'));
root.render(<main className="dashboard-page"><h1>Admin Reports</h1><Controls initialReport={${JSON.stringify(fixture)}}/></main>);` } });
    const css = '@layer base {' + fs.readFileSync('node_modules/tailwindcss/preflight.css', 'utf8') + '}\n'
        + fs.readFileSync('app/globals.css', 'utf8').replace(/^@import.*$/m, '') + '\n' + bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
    const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
    const results = [];
    try {
        const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 }, timezoneId: 'America/New_York' });
        const page = await context.newPage(), errors = [], requests = [];
        page.setDefaultTimeout(10000);
        let mode = 'normal', release;
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', async route => {
            if (route.request().url() === 'https://report.example.invalid/') return route.fulfill({ contentType: 'text/html', body: '<html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' });
            assert.equal(route.request().url(), 'https://report.example.invalid/api/admin/reports');
            const input = route.request().postDataJSON(); requests.push(input);
            assert.equal(input.reportType, 'current-summary');
            assert.equal(Object.hasOwn(input, 'period'), false, 'No period input is sent by current summary controls');
            if (mode === 'slow') await new Promise(resolve => { release = resolve; });
            if (mode === 'failure') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Admin reporting is unavailable. Please try again.' }) });
            if (input.format !== 'preview') return route.fulfill({ contentType: input.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                headers: { 'Content-Disposition': `attachment; filename="${downloadName(input.format)}"` }, body: fs.readFileSync(`${out}/download.${input.format}`) });
            const report = structuredClone(fixture);
            if (input.selection === 'custom') report.sections = report.sections.filter(section => input.sections.includes(section.id));
            if (mode === 'empty') report.sections.forEach(section => section.rows.forEach(row => { row.value = 0; }));
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify(report) });
        });
        await page.goto('https://report.example.invalid/');
        await page.addStyleTag({ content: css }); await page.addScriptTag({ content: bundle.outputFiles.find(file => file.path.endsWith('.js')).text });
        await expect(page.getByRole('heading', { name: 'Current Research Summary', exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Research Activity Report', exact: true })).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'Reporting period', exact: true })).toHaveCount(0);
        await expect(page.locator('input[type="week"],input[type="month"],input[type="number"]')).toHaveCount(0);
        await expect(page.getByLabel('Data selection')).toHaveValue('all'); await expect(page.getByLabel('File format')).toHaveValue('xlsx');
        await expect(page.locator('table')).toHaveCount(4); await expect(page.getByText('Weekly, monthly and yearly activity reporting is unavailable', { exact: false })).toBeVisible();
        assert.deepEqual(await page.locator('table tbody tr:first-child td').allTextContents(), ['7', '2', '3', '1']);
        results.push('Current Research Summary defaults/four tables; unavailable activity separated; period controls absent');

        await page.getByLabel('Data selection').selectOption('custom');
        for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.uncheck();
        const before = requests.length;
        await page.getByRole('button', { name: 'Generate and Download' }).click();
        await expect(page.getByRole('alert')).toHaveText('Select at least one report section.'); assert.equal(requests.length, before);
        await page.getByRole('checkbox', { name: 'Research Groups', exact: true }).check();
        await page.getByRole('button', { name: 'Update tables', exact: true }).click();
        await expect(page.locator('table')).toHaveCount(1); await expect(page.locator('caption')).toHaveText('Research Groups');
        results.push('Custom selection validation and selected-only preview without page reload');

        if (!delta) {
        mode = 'empty'; await page.getByRole('button', { name: 'Update tables', exact: true }).click();
        await expect(page.getByText('No records are currently available for this section.')).toBeVisible();
        mode = 'failure'; await page.getByRole('button', { name: 'Update tables', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('Admin reporting is unavailable.');
        mode = 'slow'; await page.getByRole('button', { name: 'Update tables', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Updating tables...' })).toBeDisabled();
        await expect(page.getByRole('status')).toContainText('in progress'); mode = 'normal'; release();
        await expect(page.getByRole('status')).toContainText('Reporting tables updated.');
        results.push('Empty, failure, retry, pending and disabled-control states');
        }

        await page.getByLabel('Data selection').selectOption('all');
        await page.getByRole('button', { name: 'Update tables', exact: true }).click(); await expect(page.locator('table')).toHaveCount(4);
        for (const format of ['xlsx', 'pdf']) {
            await page.getByLabel('File format').selectOption(format);
            const pending = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Generate and Download' }).click();
            const download = await pending;
            await download.saveAs(`${out}/browser-download.${format}`);
            assert.deepEqual(fs.readFileSync(`${out}/browser-download.${format}`), fs.readFileSync(`${out}/download.${format}`));
            await expect(page.getByRole('status')).toContainText('Download requested');
            await expect(page.getByRole('link', { name: /Download thesishs-current-research-summary/ })).toHaveAttribute('download', downloadName(format));
        }
        results.push('Actual browser XLSX/PDF blob downloads match verified export bytes; fallback link works');

        for (const width of (delta ? [360, 1280] : [360, 768, 1280])) for (const theme of ['light', 'dark']) {
            await page.setViewportSize({ width, height: 900 }); await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow');
            for (const button of await page.getByRole('button').all()) assert.ok((await button.boundingBox()).height >= 44);
            const lowContrast = await page.locator('p,th,td,label,button,a,select,input').evaluateAll(nodes => {
                const rgb = color => color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
                const luminance = color => rgb(color).map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
                return nodes.filter(node => node.getBoundingClientRect().height && !node.disabled).flatMap(node => {
                    let ancestor = node, background = 'rgba(0, 0, 0, 0)';
                    while (ancestor) { background = getComputedStyle(ancestor).backgroundColor; if (!background.endsWith(', 0)') && background !== 'transparent') break; ancestor = ancestor.parentElement; }
                    const a = luminance(getComputedStyle(node).color), b = luminance(background);
                    const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
                    return ratio < 4.5 ? [{ text: node.textContent.slice(0, 40), ratio }] : [];
                });
            });
            assert.deepEqual(lowContrast, [], 'Normal text/control contrast >=4.5:1');
            await page.screenshot({ path: `${out}/reports-${width}-${theme}.png`, fullPage: true });
        }
        await page.keyboard.press('Tab');
        assert.ok(await page.evaluate(() => document.activeElement !== document.body && getComputedStyle(document.activeElement).outlineStyle !== 'none'));
        assert.deepEqual(errors, []);
        results.push(`${delta ? '360/1280' : '360/768/1280'} Light/Dark, text/control contrast >=4.5:1, 44px buttons, visible keyboard focus, zero browser errors`);
        fs.writeFileSync(`${out}/browser-results.json`, JSON.stringify(results, null, 2));
        console.log(results.map(result => `PASS ${result}`).join('\n'));
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
