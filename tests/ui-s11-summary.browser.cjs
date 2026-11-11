/* eslint-disable @typescript-eslint/no-require-imports */
// Actual Main/Co-Adviser and Admin summary markup. Every service and route is synthetic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { chromium, expect } = require('@playwright/test');

async function main() {
    const out = 'test-results/ui-s1.1'; fs.mkdirSync(out, { recursive: true });
    const bundle = await build({ write: false, outfile: 'summaries.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' }, stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';import{createRoot}from'react-dom/client';
import Adviser from './app/dashboard/adviser/page';import{AdminMetrics}from './components/dashboard/admin-overview';
import{ThemeProvider}from './components/theme-provider';
const root=createRoot(document.getElementById('root'));
window.show=async kind=>{window.summaryKind=kind;let node;
if(kind.startsWith('admin'))node=<main className='dashboard-page'><h1>Admin summary fixture</h1><AdminMetrics reports={kind==='admin-reports'} stats={{totalUsers:12,totalGroups:3,totalResearchPapers:5,totalPublishedPapers:2}}/></main>;
else{const boundary=await Adviser();node=await boundary.props.children.type(boundary.props.children.props);}
root.render(<ThemeProvider>{node}</ThemeProvider>);};` }, plugins: [{ name: 'summary-fixture', setup(b) {
            b.onResolve({ filter: /^@\/lib\/services\// }, () => ({ path: 'services', namespace: 'fixture' }));
            b.onResolve({ filter: /^next\/(link|navigation)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
            b.onResolve({ filter: /^\.\/notification-bell$/ }, () => ({ path: 'bell', namespace: 'fixture' }));
            b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'bell' ? 'export default function Bell(){return null;}'
                : args.path === 'next/link' ? 'export default function Link({children,prefetch,onNavigate,...props}){return <a {...props}>{children}</a>;}'
                : args.path === 'next/navigation' ? 'export function redirect(){throw Error("Unexpected role redirect");}'
                : `export async function getDashboardAccount(){return{id:2,roleId:2,email:'adviser@example.invalid'}}
export async function getAdviserDashboard(){return window.summaryKind==='co-adviser'?null:{email:'adviser@example.invalid',totalGroups:3,pending:2,reviewed:1,attention:[],groups:[]}}
export async function getCoAdviserWorkspace(){return{success:true,data:{email:'co-adviser@example.invalid',assignments:[]}}}` }));
        } }] });
    const css = '@layer base {' + fs.readFileSync('node_modules/tailwindcss/preflight.css', 'utf8') + '}\n'
        + fs.readFileSync('app/globals.css', 'utf8').replace(/^@import.*$/m, '') + '\n' + bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
    const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
    try {
        const page = await browser.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => route.abort());
        await page.setContent('<html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>');
        await page.addStyleTag({ content: css }); await page.addScriptTag({ content: bundle.outputFiles.find(file => file.path.endsWith('.js')).text });
        for (const [kind, values] of [['main-adviser', ['3', '2', '1']], ['co-adviser', ['0', '0', '0']], ['admin', ['12', '3', '5', '2']], ['admin-reports', ['12', '3', '5', '2']]]) {
            await page.evaluate(kind => window.show(kind), kind);
            const labels = page.locator('dl.dashboard-metrics dt');
            await expect(labels).toHaveCount(values.length);
            await expect(page.locator('dl.dashboard-metrics dd:first-of-type')).toHaveText(values);
            for (const label of await labels.all()) {
                await expect(label.locator('svg')).toHaveAttribute('width', '18');
                await expect(label.locator('svg')).toHaveAttribute('aria-hidden', 'true');
                assert.ok((await label.innerText()).trim().length > 0, 'Text labels remain present');
            }
            assert.deepEqual(await page.locator('dl.dashboard-metrics > div').evaluateAll(nodes => nodes.map(node => [...node.children].map(child => child.tagName))), values.map(() => kind.startsWith('admin') || kind === 'main-adviser' ? ['DT', 'DD', 'DD'] : ['DT', 'DD']));
            for (const width of [1280, 360]) for (const theme of ['light', 'dark']) {
                await page.setViewportSize({ width, height: 800 }); await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), kind + ' has no icon-induced overflow');
                await page.screenshot({ path: `${out}/${kind}-${width}-${theme}.png`, fullPage: true });
            }
        }
        assert.deepEqual(errors, []);
        console.log('PASS Main/Co-Adviser, Admin and Reports: semantic 18px decorative icons, visible labels, unchanged counts/metric structure, 360/1280px Light/Dark layouts');
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
