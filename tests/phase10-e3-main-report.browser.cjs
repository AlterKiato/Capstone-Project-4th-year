/* eslint-disable @typescript-eslint/no-require-imports */
// Actual shared controls/tables/styles and real generated files; synthetic HTTP/session-free UI harness.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { chromium, expect } = require('@playwright/test');

async function main() {
    const out = 'test-results/phase10-e3';
    const fixture = JSON.parse(fs.readFileSync(`${out}/dataset.json`, 'utf8'));
    const downloadName = format => `thesishs-current-research-supervision-summary-${fixture.generatedAt.replace(/[-:.]/g, '')}.${format}`;
    const bundle = await build({ write: false, outfile: 'report.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' }, stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';import{createRoot}from'react-dom/client';
import Controls from './components/dashboard/admin-report-controls';
createRoot(document.getElementById('root')).render(<main className="dashboard-page"><h1>Research Supervision Reports</h1><Controls kind="main" initialReport={${JSON.stringify(fixture)}}/></main>);` } });
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
            assert.equal(route.request().url(), 'https://report.example.invalid/api/adviser/reports');
            const input = route.request().postDataJSON(); requests.push(input);
            assert.equal(input.reportType, 'current-supervision-summary'); assert.equal(Object.hasOwn(input, 'period'), false);
            if (mode === 'slow') await new Promise(resolve => { release = resolve; });
            if (mode === 'failure') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Supervision reporting is unavailable. Please try again.' }) });
            if (input.format !== 'preview') return route.fulfill({ contentType: input.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                headers: { 'Content-Disposition': `attachment; filename="${downloadName(input.format)}"` }, body: fs.readFileSync(`${out}/download.${input.format}`) });
            const report = structuredClone(fixture);
            if (input.selection === 'custom') report.sections = report.sections.filter(section => input.sections.includes(section.id));
            if (mode === 'empty') report.sections.forEach(section => { section.rows.forEach(row => { row.value = 0; }); if (section.groupRows) section.groupRows = []; });
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify(report) });
        });
        await page.goto('https://report.example.invalid/');
        await page.addStyleTag({ content: css }); await page.addScriptTag({ content: bundle.outputFiles.find(file => file.path.endsWith('.js')).text });
        await expect(page.getByRole('heading', { name: 'Current Research Supervision Summary', exact: true })).toBeVisible();
        await expect(page.locator('table')).toHaveCount(5); await expect(page.getByRole('rowheader', { name: 'Group 5', exact: true })).toBeVisible();
        await expect(page.locator('input[type="week"],input[type="month"],input[type="number"]')).toHaveCount(0);
        assert.deepEqual(await page.locator('table').first().locator('tbody td').allTextContents(), ['5', '4', '1', '0']);
        await expect(page.getByText('Reviewed versions are not actions personally performed', { exact: false })).toBeVisible();
        results.push('Main title, five complete snapshot sections, archived/empty groups, numeric table values, no period controls or personal review attribution');

        await page.getByLabel('Data selection').selectOption('custom');
        for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.uncheck();
        const before = requests.length;
        await page.getByRole('button', { name: 'Generate and Download' }).click();
        await expect(page.getByRole('alert')).toHaveText('Select at least one report section.'); assert.equal(requests.length, before);
        await page.getByRole('checkbox', { name: 'Group Summary', exact: true }).check();
        await expect(page.getByText('Selections changed.', { exact: false })).toBeVisible();
        await page.getByRole('button', { name: 'Update tables', exact: true }).click();
        await expect(page.locator('table')).toHaveCount(1); await expect(page.locator('caption')).toHaveText('Group Summary');
        results.push('Custom selection, empty selection validation, dirty notice and selected-only update');

        mode = 'empty'; await page.getByRole('button', { name: 'Update tables', exact: true }).click();
        await expect(page.getByText('No records are currently available for this section.')).toBeVisible();
        mode = 'failure'; await page.getByRole('button', { name: 'Update tables', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('Supervision reporting is unavailable.');
        mode = 'slow'; await page.getByRole('button', { name: 'Update tables', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Updating tables...' })).toBeDisabled();
        await expect(page.getByRole('status')).toContainText('in progress'); mode = 'normal'; release();
        await expect(page.getByRole('status')).toContainText('Reporting tables updated.');
        results.push('Empty, error, retry and pending/disabled controls');

        await page.getByLabel('Data selection').selectOption('all');
        await page.getByRole('button', { name: 'Update tables', exact: true }).click(); await expect(page.locator('table')).toHaveCount(5);
        for (const format of ['xlsx', 'pdf']) {
            await page.getByLabel('File format').selectOption(format);
            const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Generate and Download' }).click();
            const download = await pending; await download.saveAs(`${out}/browser-download.${format}`);
            assert.deepEqual(fs.readFileSync(`${out}/browser-download.${format}`), fs.readFileSync(`${out}/download.${format}`));
            await expect(page.getByRole('status')).toContainText('Download requested');
            await expect(page.getByRole('link', { name: /Download thesishs-current-research-supervision-summary/ })).toHaveAttribute('download', downloadName(format));
        }
        results.push('Actual XLSX/PDF blob downloads and fallback links with supervision filenames');

        for (const width of [360, 768, 1280]) for (const theme of ['light', 'dark']) {
            await page.setViewportSize({ width, height: 900 }); await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow');
            for (const button of await page.getByRole('button').all()) assert.ok((await button.boundingBox()).height >= 44);
            const lowContrast = await page.locator('p,th,td,label,button,a,select').evaluateAll(nodes => {
                const rgb = color => color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
                const luminance = color => rgb(color).map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
                return nodes.filter(node => node.getBoundingClientRect().height && !node.disabled).flatMap(node => {
                    let ancestor = node, background = 'rgba(0, 0, 0, 0)';
                    while (ancestor) { background = getComputedStyle(ancestor).backgroundColor; if (!background.endsWith(', 0)') && background !== 'transparent') break; ancestor = ancestor.parentElement; }
                    const a = luminance(getComputedStyle(node).color), b = luminance(background), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
                    return ratio < 4.5 ? [{ text: node.textContent.slice(0, 40), ratio }] : [];
                });
            });
            assert.deepEqual(lowContrast, [], 'Text/control contrast >=4.5:1');
            const groupRegion = page.getByRole('region', { name: 'Group Summary table' });
            await groupRegion.focus(); await page.keyboard.press('End');
            assert.ok(await groupRegion.evaluate(node => getComputedStyle(node).overflowX === 'auto'));
            await page.screenshot({ path: `${out}/reports-${width}-${theme}.png`, fullPage: true });
        }
        await page.getByLabel('Data selection').focus();
        await page.keyboard.press('Tab');
        await expect(page.getByLabel('File format')).toBeFocused();
        assert.ok(await page.evaluate(() => document.activeElement !== document.body && getComputedStyle(document.activeElement).outlineStyle !== 'none'));
        assert.deepEqual(errors, []);
        results.push('360/768/1280 Light/Dark layout, contained group-table scrolling, 44px buttons, contrast >=4.5:1, visible keyboard focus and zero browser errors');
        fs.writeFileSync(`${out}/browser-results.json`, JSON.stringify(results, null, 2));
        console.log(results.map(result => `PASS ${result}`).join('\n'));
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
