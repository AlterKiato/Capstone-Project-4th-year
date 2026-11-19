/* eslint-disable @typescript-eslint/no-require-imports */
// Actual route and controls, isolated in memory. No database, auth credentials, provider or HTTP server.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { build } = require('esbuild'), { chromium, expect } = require('@playwright/test');

async function main() {
    const out = 'test-results/e1b'; fs.mkdirSync(out, { recursive: true });
    const bundle = await build({ write: false, outfile: 'e1b.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' }, stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';import{createRoot}from'react-dom/client';import Page from './app/dashboard/adviser/submissions/page';
import shell from './components/dashboard/dashboard-shell.module.css';
import{ThemeProvider}from'./components/theme-provider';
const root=createRoot(document.getElementById('root'));let generation=0;
window.render=async(view='templates')=>{const page=await Page({searchParams:Promise.resolve({view})});root.render(<ThemeProvider><div className={shell.shell}><React.Fragment key={++generation}>{page}</React.Fragment></div></ThemeProvider>)};
window.render();` }, plugins: [{ name: 'e1b-offline', setup(b) {
            b.onResolve({ filter: /^@\/lib\/actions\/evaluation-template.action$/ }, () => ({ path: 'actions', namespace: 'mock' }));
            b.onResolve({ filter: /^@\/lib\/(services\/|auth\/main-adviser)/ }, () => ({ path: 'services', namespace: 'mock' }));
            b.onResolve({ filter: /^next\/(link|navigation)$/ }, args => ({ path: args.path, namespace: 'mock' }));
            b.onResolve({ filter: /(?:local-ai-assistance|notification-bell|co-adviser-workspace)$/ }, () => ({ path: 'empty', namespace: 'mock' }));
            b.onResolve({ filter: /^(?:server-only|postgres|dotenv|@\/lib\/db)$/ }, () => { throw Error('Live adapter forbidden in E1B browser harness'); });
            b.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents:
                args.path === 'next/link' ? 'export default function Link({children,prefetch,onNavigate,...props}){return <a {...props}>{children}</a>}'
                    : args.path === 'next/navigation' ? 'export const useRouter=()=>({refresh(){}});'
                        : args.path === 'empty' ? 'export default function Empty(){return null;}'
                            : args.path === 'services' ? `
window.model??={templates:[],calls:[],role:'main',fail:false};
export async function getCurrentMainAdviser(){return window.model.role==='main'?{userId:1,roleId:2,email:'synthetic@example.invalid'}:null;}
export async function listEvaluationTemplates(){return{success:!window.model.fail,message:'Templates unavailable.',data:structuredClone(window.model.templates)}}
export async function getAdviserSubmissionsDirectory(){return window.model.role==='main'?{email:'synthetic@example.invalid',submissions:[]}:null;}
export async function getCoAdviserWorkspace(){return{success:true,data:{email:'co@example.invalid',assignments:[]}}}` : `
import{templateMutationSchema}from'./lib/validations/evaluation-template';
export async function listEvaluationTemplatesAction(){return{success:true,message:'Loaded',data:structuredClone(window.model.templates)}}
export async function readEvaluationTemplateAction({templateId}){return{success:true,data:structuredClone(window.model.templates.find(r=>r.id===templateId))}}
export async function mutateEvaluationTemplateAction(input){
const m=window.model;m.calls.push(input.operation);if(m.fail)return{success:false,kind:'unavailable',message:'Synthetic save uncertain. Reload before retrying.'};
const parsed=templateMutationSchema.safeParse(input);if(!parsed.success)return{success:false,kind:'validation',message:'Invalid template'};
const d=parsed.data;let row=m.templates.find(r=>r.id===d.templateId);if(row&&row.revision!==d.expectedRevision)return{success:false,kind:'stale',message:'Template changed. Reload.'};
if(d.operation==='create'||d.operation==='duplicate'){const draft=d.operation==='create'?d.draft:{...structuredClone(row),name:row.name+' (copy)',criteria:row.criteria.map(c=>({...c,key:crypto.randomUUID()}))};row={...draft,id:m.templates.length+1,revision:0,archivedAt:null,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};m.templates.unshift(row)}
else if(d.operation==='update'){Object.assign(row,structuredClone(d.draft));row.revision++}
else{row.archivedAt=new Date().toISOString();row.revision++}
return{success:true,message:d.operation==='archive'?'Template archived.':d.operation==='duplicate'?'Independent template copy created.':'Template saved.',data:structuredClone(row)}}` }));
        } }] });
    const css = '@layer base {' + fs.readFileSync('node_modules/tailwindcss/preflight.css', 'utf8') + '}\n'
        + fs.readFileSync('app/globals.css', 'utf8').replace(/^@import.*$/m, '') + '\n' + bundle.outputFiles.find(f => f.path.endsWith('.css')).text;
    const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
    const checks = [], errors = [], unexpected = [];
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        page.on('dialog', dialog => dialog.accept());
        await page.route('**/*', route => {
            if (route.request().url() === 'https://e1b.invalid/') return route.fulfill({ contentType: 'text/html', body: '<html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' });
            unexpected.push(route.request().url()); return route.abort();
        });
        await page.goto('https://e1b.invalid/');
        await page.addStyleTag({ content: css }); await page.addScriptTag({ content: bundle.outputFiles.find(f => f.path.endsWith('.js')).text });
        try { await expect(page.getByText('No active templates.', { exact: false })).toBeVisible(); }
        catch (error) { throw Error(`${error}\nBrowser errors: ${JSON.stringify(errors)}\nBody: ${await page.locator('body').innerText()}`); }
        await page.getByRole('button', { name: 'Create template', exact: true }).click();
        await page.getByLabel('Template name', { exact: true }).fill('Synthetic research criteria');
        await page.getByLabel('Criterion 1', { exact: true }).fill('Method');
        await page.getByRole('button', { name: 'Add criterion', exact: true }).click();
        await page.getByLabel('Criterion 2', { exact: true }).fill('Evidence');
        await page.getByRole('button', { name: 'Move criterion 2 up', exact: true }).focus(); await page.keyboard.press('Enter');
        await expect(page.getByLabel('Criterion 1', { exact: true })).toHaveValue('Evidence');
        await page.getByText('Criterion 1 options', { exact: true }).click();
        await page.getByLabel('Allow N/A for this criterion', { exact: true }).first().check();
        await page.getByText('Customize scale', { exact: true }).click();
        await page.getByLabel('Number of rating levels', { exact: true }).selectOption('3');
        await page.getByLabel('3 points: label', { exact: true }).fill('Strong');
        await page.getByRole('button', { name: 'Save template', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Synthetic research criteria', exact: true })).toBeVisible();
        assert.equal(await page.evaluate(() => window.model.templates[0].scale.levels.length), 3);
        assert.equal(await page.evaluate(() => window.model.templates[0].criteria[0].allowsNa), true);
        checks.push('create, custom scale, N/A and keyboard order');
        await page.getByRole('button', { name: 'Duplicate template: Synthetic research criteria', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Synthetic research criteria (copy)', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Archive template: Synthetic research criteria (copy)', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.getByRole('dialog').getByRole('button', { name: 'Archive template', exact: true }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(page.getByRole('heading', { name: 'Synthetic research criteria (copy)', exact: true })).toHaveCount(0);
        await page.getByLabel('Show archived', { exact: true }).check();
        await expect(page.getByRole('heading', { name: 'Synthetic research criteria (copy)', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Edit template: Synthetic research criteria (copy)', exact: true })).toHaveCount(0);
        checks.push('independent duplicate and archive disclosure');
        await page.getByRole('button', { name: 'Edit template: Synthetic research criteria', exact: true }).click();
        await page.getByLabel('Template name', { exact: true }).fill(' ');
        await page.getByRole('button', { name: 'Save template', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('Enter a name');
        await page.getByLabel('Template name', { exact: true }).fill('Updated template');
        await page.getByRole('button', { name: 'Back to templates', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Synthetic research criteria', exact: true })).toBeVisible();
        checks.push('inline validation and discard confirmation');
        // Long/many-row state is held only in this browser and never reaches a backend.
        await page.evaluate(async () => {
            const row = window.model.templates.find(t => !t.archivedAt); row.name = 'Long research evaluation template '.repeat(6).slice(0, 200);
            row.criteria = Array.from({ length: 30 }, (_, position) => ({ key: crypto.randomUUID(), position, name: 'Criterion '+(position+1)+' '+('Detailed research requirement '.repeat(4)), description: 'Optional guidance', allowsNa: false }));
            await window.render();
        });
        const title = await page.evaluate(() => window.model.templates.find(t => !t.archivedAt).name);
        for (const theme of ['light', 'dark']) for (const width of [1440, 360]) {
            await page.setViewportSize({ width, height: 1000 }); await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
            await page.screenshot({ path: `${out}/list-${theme}-${width}.png`, fullPage: true });
            await page.getByRole('button', { name: `Edit template: ${title}`, exact: true }).click();
            await expect(page.getByLabel('Criterion 30', { exact: true })).toHaveCount(1);
            await expect(page.getByRole('button', { name: 'Add criterion', exact: true })).toBeDisabled();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
            await page.getByLabel('Criterion 1', { exact: true }).focus();
            assert.ok(await page.getByLabel('Criterion 1', { exact: true }).evaluate(el => getComputedStyle(el).outlineStyle !== 'none'));
            await page.screenshot({ path: `${out}/editor-${theme}-${width}.png` });
            await page.getByRole('button', { name: 'Back to templates', exact: true }).click();
            checks.push(`${theme} ${width}px list/editor, long names, 30 criteria, focus and no overflow`);
        }
        await page.getByRole('button', { name: `Edit template: ${title}`, exact: true }).click();
        await page.getByLabel('Template name', { exact: true }).fill('Uncertain save');
        await page.evaluate(() => window.model.fail = true);
        await page.getByRole('button', { name: 'Save template', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('uncertain');
        await expect(page.getByRole('button', { name: 'Save template', exact: true })).toBeDisabled();
        await page.getByRole('button', { name: 'Back to templates', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Create template', exact: true })).toBeDisabled();
        await page.evaluate(() => window.model.fail = false); await page.getByRole('button', { name: 'Reload templates', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Create template', exact: true })).toBeEnabled();
        checks.push('uncertain save blocks blind retries until explicit reload');
        // Explicit non-template query exercises the original directory branch.
        await page.evaluate(() => window.render('all'));
        await expect(page.getByRole('heading', { name: 'Research Submissions', exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Evaluation templates', exact: true })).toHaveAttribute('href', '/dashboard/adviser/submissions?view=templates');
        await expect(page.getByLabel('Status filter', { exact: true })).toBeVisible();
        await page.getByLabel('Status filter', { exact: true }).selectOption('pending');
        await page.evaluate(async () => { window.model.role = 'co'; await window.render('templates'); });
        await expect(page.getByRole('alert')).toContainText('Main Adviser authority');
        await expect(page.getByRole('button', { name: 'Create template', exact: true })).toHaveCount(0);
        checks.push('existing directory/filter and non-Main template denial');
        assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
        fs.writeFileSync(`${out}/evidence.json`, JSON.stringify({ checks, errors, unexpected, boundary: 'synthetic actions only; not authenticated runtime or PostgreSQL acceptance' }, null, 2));
        process.stdout.write(JSON.stringify({ pass: checks.length, checks, errors, unexpected })+'\n');
    } finally { await browser.close(); }
}
main().catch(error => { process.stderr.write(String(error.stack || error)+'\n'); process.exitCode = 1; });
