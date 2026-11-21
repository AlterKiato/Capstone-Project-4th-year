/* eslint-disable @typescript-eslint/no-require-imports */
// Focused isolated component verification: synthetic HTTP only, no Next server, accounts or database.
// Run after the E4.B2 unit suite: node --import tsx tests/phase10-e4b2-activity.browser.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { chromium, expect } = require('@playwright/test');
const data = require('../lib/reporting/period-activity.ts');
const calendar = require('../lib/reporting/admin-report.ts');

async function main() {
    const out = 'test-results/phase10-e4b2';
    const fixture = JSON.parse(fs.readFileSync(`${out}/dataset.json`, 'utf8'));
    const policy = { status: 'verified', cutoverUtc: fixture.coverage.cutoverUtc, legacySubmissionMaxId: 100, legacyFeedbackMaxId: 50 };
    const defaults = data.defaultActivityPeriods(new Date('2027-01-01T00:00:00Z'));
    const bundle = await build({ write: false, outfile: 'activity.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' }, stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';import{createRoot}from'react-dom/client';
import Controls from './components/dashboard/period-activity-controls';
const root=createRoot(document.getElementById('root'));
window.show=(availability='unconfigured',kind='admin')=>root.render(<main className="dashboard-page"><h1>Synthetic activity component verification</h1><Controls key={availability+kind} kind={kind} availability={availability} defaults={${JSON.stringify(defaults)}}/></main>);
window.show();` } });
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
            const url = route.request().url();
            if (url === 'https://report.example.invalid/') return route.fulfill({ contentType: 'text/html', body: '<html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' });
            assert.match(url, /^https:\/\/report\.example\.invalid\/api\/(admin|adviser)\/reports\/activity$/);
            const input = route.request().postDataJSON(); requests.push({ url, input });
            assert.ok(data.activityRequestSchema.safeParse(input).success);
            if (mode === 'slow') await new Promise(resolve => { release = resolve; });
            if (mode === 'before') return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ message: 'This period is entirely before the verified cutover.', coverageStatus: 'before-cutover' }) });
            if (mode === 'failure') return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Activity reporting is unavailable.' }) });
            if (mode === 'changed' && input.format !== 'preview') return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ message: 'Activity changed. Update activity tables before downloading.' }) });
            if (input.format !== 'preview') {
                assert.deepEqual(input.expectedTotals, fixture.totals);
                return route.fulfill({ contentType: input.format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    headers: { 'Content-Disposition': `attachment; filename="thesishs-period-activity-${input.period.value}.${input.format}"` }, body: fs.readFileSync(`${out}/${url.includes('/adviser/') ? 2 : 1}.${input.format}`) });
            }
            const window = data.resolveActivityWindow(calendar.resolveReportPeriod(input.period), policy);
            assert.ok(window.ok);
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify(data.buildActivityReport(url.includes('/adviser/') ? 'main' : 'admin', window.window,
                mode === 'empty' ? { submissions: 0, approved: 0, revisionRequired: 0 } : fixture.totals, new Date(fixture.generatedAt))) });
        });
        await page.goto('https://report.example.invalid/'); await page.addStyleTag({ content: css });
        await page.addScriptTag({ content: bundle.outputFiles.find(file => file.path.endsWith('.js')).text });
        const update = page.getByRole('button', { name: 'Update activity tables' });
        const download = page.getByRole('button', { name: 'Download activity report' });
        await expect(update).toBeDisabled(); await expect(download).toBeDisabled();
        await expect(page.getByText(/awaits verified activation/)).toBeVisible();
        assert.equal(await page.locator('td').count(), 0); assert.equal(requests.length, 0);
        await page.getByLabel('Period type').selectOption('weekly'); await expect(page.getByLabel('ISO week')).toHaveValue('2026-W53');
        await page.getByLabel('Period type').selectOption('yearly'); await expect(page.getByLabel('Calendar year')).toHaveValue('2027');
        assert.equal(requests.length, 0);
        results.push('unconfigured: all period selectors work, no fabricated totals/network queries, both activity actions disabled');

        for (const kind of ['admin', 'main']) {
            await page.evaluate(kind => window.show('configured', kind), kind);
            await expect(update).toBeEnabled(); await update.click();
            await expect(page.getByRole('cell', { name: '2', exact: true })).toBeVisible();
            await expect(page.getByText('PARTIAL COVERAGE', { exact: false }).first()).toBeVisible();
            assert.ok(requests.at(-1).url.includes(kind === 'main' ? '/adviser/' : '/admin/'));
            for (const format of ['xlsx', 'pdf']) {
                await page.getByLabel('Activity file format').selectOption(format);
                const pending = page.waitForEvent('download'); await download.click();
                assert.match((await pending).suggestedFilename(), new RegExp(`period-activity-2027-01\\.${format}$`));
                const fallback = page.getByRole('link', { name: /^Download thesishs/ });
                await expect(fallback).toBeVisible();
                const retry = page.waitForEvent('download'); await fallback.click();
                assert.match((await retry).suggestedFilename(), new RegExp(`\\.${format}$`));
            }
        }
        results.push('Admin/Main configured fixtures: matching displayed counts, role-specific URLs, actual XLSX/PDF blob downloads');

        for (const period of ['weekly', 'yearly', 'monthly']) {
            await page.getByLabel('Period type').selectOption(period);
            await expect(download).toBeDisabled(); assert.equal(await page.locator('td').count(), 0);
            if (period === 'weekly') {
                await page.getByLabel('ISO week').fill('2027-W53');
                const previous = requests.length; await update.click();
                await expect(page.getByRole('alert')).toHaveText('Choose a valid week, month or year.');
                assert.equal(requests.length, previous);
                await page.getByLabel('ISO week').fill('2026-W53');
            } else if (period === 'yearly') await page.getByLabel('Calendar year').fill('2027');
            else await page.getByLabel('Calendar month').fill('2027-01');
            await update.click(); await expect(page.locator('td')).toHaveCount(3);
            assert.equal(requests.at(-1).input.period.kind, period);
        }
        mode = 'slow'; await update.click(); await expect(page.getByText('Activity report request in progress.')).toBeVisible();
        await expect(page.getByLabel('Period type')).toBeDisabled();
        await expect.poll(() => typeof release).toBe('function'); release(); await expect(update).toBeEnabled(); mode = 'normal';
        mode = 'empty'; await update.click(); await expect(page.getByRole('cell', { name: '0', exact: true })).toHaveCount(3);
        mode = 'failure'; await update.click(); await expect(page.getByRole('alert')).toHaveText('Activity reporting is unavailable.');
        assert.equal(await page.locator('td').count(), 0); await expect(download).toBeDisabled();
        mode = 'before'; await update.click(); await expect(page.getByText(/BEFORE CUTOVER: no activity coverage/)).toBeVisible();
        assert.equal(await page.locator('td').count(), 0); await expect(download).toBeDisabled();
        mode = 'normal'; await update.click(); await expect(download).toBeEnabled();
        mode = 'changed'; await download.click(); await expect(page.getByRole('alert')).toHaveText(/Activity changed/); await expect(download).toBeDisabled();
        mode = 'normal'; await update.click(); await expect(download).toBeEnabled();
        results.push('period changes invalidate prior totals/downloads; loading, genuine zero, errors, pre-cutover and changed-data states behave correctly');

        for (const width of [360, 1280]) for (const theme of ['light', 'dark']) {
            await page.setViewportSize({ width, height: 900 }); await page.locator('html').evaluate((node, theme) => node.dataset.theme = theme, theme);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
            for (const button of await page.getByRole('button').all()) assert.ok((await button.boundingBox()).height >= 44);
            const lowContrast = await page.locator('p,th,td,label,button,a,input,select').evaluateAll(nodes => {
                const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number)
                    .map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; })
                    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
                return nodes.filter(node => node.getBoundingClientRect().height && !node.disabled).flatMap(node => {
                    let ancestor = node, background = 'rgba(0, 0, 0, 0)';
                    while (ancestor) { background = getComputedStyle(ancestor).backgroundColor; if (!background.endsWith(', 0)') && background !== 'transparent') break; ancestor = ancestor.parentElement; }
                    const a = luminance(getComputedStyle(node).color), b = luminance(background), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
                    return ratio < 4.5 ? [{ text: node.textContent.slice(0, 40), ratio }] : [];
                });
            });
            assert.deepEqual(lowContrast, [], 'Text and controls meet 4.5:1 contrast');
            await page.screenshot({ path: `${out}/activity-${width}-${theme}.png`, fullPage: true });
        }
        await page.getByLabel('Period type').focus(); await page.keyboard.press('Tab'); await expect(page.getByLabel('Calendar month')).toBeFocused();
        assert.ok(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none'));
        assert.deepEqual(errors, []);
        results.push('360/1280 Light/Dark: no page overflow, 44px actions, contrast >=4.5:1, keyboard focus, zero browser errors');
        fs.writeFileSync(`${out}/browser-results.json`, JSON.stringify(results, null, 2));
        console.log(results.map(result => `PASS ${result}`).join('\n'));
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
