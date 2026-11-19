/* eslint-disable @typescript-eslint/no-require-imports */
// Render actual shell/routes/manager with synthetic auth/data/routing. No DB or authenticated Next server.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { build } = require('esbuild'), { chromium, expect } = require('@playwright/test');
async function main() {
    const out = 'test-results/e1bn'; fs.mkdirSync(out, { recursive: true });
    const bundle = await build({ write: false, outfile: 'e1bn.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' }, stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from'react';import{createRoot}from'react-dom/client';import Shell from'./components/dashboard/dashboard-shell';
import Criteria from'./app/dashboard/adviser/evaluation-criteria/page';import Directory from'./app/dashboard/adviser/submissions/page';
import{dashboardLinks,EVALUATION_CRITERIA_HREF}from'./lib/constants/dashboard-navigation';import{ThemeProvider}from'./components/theme-provider';
window.model={role:'main',roleId:2,lists:0,mode:'browser',platform:'desktop'};const root=createRoot(document.getElementById('root'));let generation=0;
window.navigate=async(href,replace=false)=>{history[replace?'replaceState':'pushState']({},'',href);await window.render();};
window.render=async()=>{const url=new URL(location.href);let page;try{
if(url.pathname===EVALUATION_CRITERIA_HREF)page=await Criteria();
else if(url.pathname==='/dashboard/adviser/submissions')page=await Directory({searchParams:Promise.resolve({view:url.searchParams.getAll('view').length>1?url.searchParams.getAll('view'):url.searchParams.get('view')??undefined})});
else page=<main className="dashboard-page"><h1>Fixture dashboard</h1></main>;
}catch(error){if(error.href){await window.navigate(error.href,true);return;}throw error;}
root.render(<ThemeProvider><Shell links={dashboardLinks(window.model.roleId)}><React.Fragment key={++generation}>{page}</React.Fragment></Shell></ThemeProvider>);window.ready=true;};
addEventListener('popstate',()=>void window.render());void window.render();` }, plugins: [{ name: 'e1bn-offline', setup(b) {
        b.onResolve({ filter: /^next\/(navigation|link|image)$|^@\/lib\/(auth\/(authorization|main-adviser)|services\/|actions\/evaluation-template.action|pwa\/use-display-mode)/ }, args => ({ path: args.path, namespace: 'fixture' }));
        b.onResolve({ filter: /(?:local-ai-assistance|notification-bell|co-adviser-workspace|components\/auth\/logout-button)$/ }, () => ({ path: 'empty', namespace: 'fixture' }));
        b.onResolve({ filter: /^(?:server-only|postgres|dotenv|@\/lib\/db)$/ }, () => { throw Error('Live adapter forbidden'); });
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => {
            let contents;
            if (path === 'next/link') contents = `export default function Link({children,prefetch,onNavigate,...props}){return <a {...props} onClick={e=>{if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();onNavigate?.();void window.navigate(props.href);}}>{children}</a>;}`;
            else if (path === 'next/image') contents = 'export default function Image(props){return <img {...props}/>;}';
            else if (path === 'next/navigation') contents = `export const usePathname=()=>location.pathname;export const useRouter=()=>({refresh(){void window.render();}});export function redirect(href){throw{href};}`;
            else if (path.endsWith('use-display-mode')) contents = `export const useDisplayMode=()=>window.model.mode;export const usePwaPlatform=()=>window.model.platform;`;
            else if (path.endsWith('authorization')) contents = `export async function requireRole(allowed){if(!allowed.includes(window.model.roleId))throw{href:'/dashboard'};return{userId:1,roleId:window.model.roleId,email:'fixture@example.invalid'};}`;
            else if (path.endsWith('main-adviser')) contents = `export async function getCurrentMainAdviser(){return window.model.role==='main'&&window.model.roleId===2?{userId:1,email:'fixture@example.invalid'}:null;}`;
            else if (path.endsWith('adviser-submissions-ui.service')) contents = `export async function getAdviserSubmissionsDirectory(){return window.model.role==='main'?{email:'fixture@example.invalid',submissions:[]}:null;}`;
            else if (path.endsWith('co-adviser.service')) contents = `export async function getCoAdviserWorkspace(){return{success:true,data:{email:'fixture@example.invalid',assignments:[]}};}`;
            else if (path.endsWith('evaluation-template.service')) contents = `export async function listEvaluationTemplates(){window.model.lists++;return{success:true,data:[]};}`;
            else if (path.endsWith('evaluation-template.action')) contents = `export async function listEvaluationTemplatesAction(){window.model.lists++;return{success:true,data:[]}};export async function readEvaluationTemplateAction(){throw Error('Read outside navigation scope');}export async function mutateEvaluationTemplateAction(){throw Error('CRUD outside navigation scope');}`;
            else if (path === 'empty') contents = 'export default function Empty(){return null;}';
            else throw Error('Unmocked boundary '+path);
            return { loader: 'tsx', resolveDir: process.cwd(), contents };
        });
    } }] });
    const css = '@layer base {'+fs.readFileSync('node_modules/tailwindcss/preflight.css','utf8')+'}\n'+fs.readFileSync('app/globals.css','utf8').replace(/^@import.*$/m,'')+'\n'+bundle.outputFiles.find(file=>file.path.endsWith('.css')).text;
    const html = '<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="root"></div><script>'+bundle.outputFiles.find(file=>file.path.endsWith('.js')).text+'</script></body></html>';
    const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] }), errors = [], unexpected = [], checks = [];
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin === 'http://e1bn.invalid' && route.request().isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: html });
            if (url.origin === 'http://e1bn.invalid' && url.pathname === '/branding/thesishs-mark.svg') return route.fulfill({ contentType: 'image/svg+xml', body: fs.readFileSync('public/branding/thesishs-mark.svg') });
            unexpected.push(url.href); return route.abort();
        });
        await page.goto('http://e1bn.invalid/dashboard/adviser/submissions');
        const sidebar = page.getByRole('complementary', { name: 'Workspace sidebar' });
        await expect(page.getByRole('heading', { name: 'Research Submissions', exact: true })).toBeVisible();
        await expect(page.getByLabel('Status filter', { exact: true })).toBeVisible();
        await expect(sidebar.getByRole('link', { name: 'Evaluation Criteria', exact: true })).toHaveCount(1);
        await expect(page.getByRole('link', { name: 'Evaluation templates', exact: true })).toHaveCount(0);
        await sidebar.getByRole('link', { name: 'Evaluation Criteria', exact: true }).focus(); await page.keyboard.press('Enter');
        await expect(page.getByRole('heading', { name: 'Saved templates', exact: true })).toBeVisible();
        await expect(sidebar.locator('[aria-current="page"]')).toHaveText('Evaluation Criteria');
        await expect(page.getByRole('button', { name: 'Create template', exact: true })).toBeVisible();
        checks.push('Main sidebar entry, keyboard navigation, existing manager and one correct active link; redundant directory link removed');
        await sidebar.getByRole('link', { name: 'Review Submissions', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Research Submissions', exact: true })).toBeVisible();
        await expect(sidebar.locator('[aria-current="page"]')).toHaveText('Review Submissions');
        await page.goBack(); await expect(page.getByRole('heading', { name: 'Saved templates', exact: true })).toBeVisible();
        await page.reload(); await expect(page.getByRole('heading', { name: 'Saved templates', exact: true })).toBeVisible();
        await page.goto('http://e1bn.invalid/dashboard/adviser/submissions?view=templates');
        await expect(page).toHaveURL('http://e1bn.invalid/dashboard/adviser/evaluation-criteria');
        await expect(page.getByRole('heading', { name: 'Saved templates', exact: true })).toBeVisible();
        checks.push('Submissions remains usable; browser Back/refresh/deep link and legacy alias resolve with the canonical active state (synthetic router)');
        for (const theme of ['light','dark']) {
            await page.evaluate(value => document.documentElement.dataset.theme=value, theme);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1), true);
            await page.screenshot({ path: out+'/sidebar-'+theme+'-1440.png', fullPage: true });
        }
        await sidebar.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
        await expect(sidebar.getByRole('link', { name: 'Evaluation Criteria', exact: true })).toHaveAttribute('title', 'Evaluation Criteria');
        await sidebar.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
        checks.push('1440 Light/Dark, expanded/compact labels and existing styles; no horizontal overflow');
        await page.setViewportSize({ width: 360, height: 900 });
        const menu = page.getByRole('button', { name: 'Open navigation menu', exact: true });
        for (const theme of ['light','dark']) {
            await page.evaluate(value => document.documentElement.dataset.theme=value, theme);
            await menu.click(); const drawer = page.getByRole('dialog', { name: 'Navigation' });
            await expect(drawer.getByRole('link', { name: 'Evaluation Criteria', exact: true })).toBeVisible();
            await expect(drawer.locator('[aria-current="page"]')).toHaveText('Evaluation Criteria');
            await drawer.getByRole('link', { name: 'Evaluation Criteria', exact: true }).focus();
            await page.screenshot({ path: out+'/drawer-'+theme+'-360.png', fullPage: true });
            await page.keyboard.press('Escape'); await expect(drawer).toHaveCount(0); await expect(menu).toBeFocused();
        }
        await menu.click(); await page.getByRole('dialog').getByRole('link', { name: 'Review Submissions', exact: true }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('heading', { name: 'Research Submissions', exact: true })).toBeVisible();
        await menu.click(); await page.getByRole('dialog').getByRole('link', { name: 'Evaluation Criteria', exact: true }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('heading', { name: 'Saved templates', exact: true })).toBeVisible();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1), true);
        await page.evaluate(async () => { window.model.mode='standalone';window.model.platform='android';await window.render(); });
        const bottom = page.getByRole('navigation', { name: 'Primary dashboard pages' });
        await expect(bottom.getByRole('button', { name: 'More navigation', exact: true })).toHaveAttribute('data-active','true');
        await bottom.getByRole('button', { name: 'More navigation', exact: true }).click();
        await expect(page.getByRole('dialog').getByRole('link', { name: 'Evaluation Criteria', exact: true })).toBeVisible();
        await page.keyboard.press('Escape');
        checks.push('360 Light/Dark drawer, keyboard Escape/focus restoration and route-close; simulated installed-mobile More includes criteria without adding a bottom tab');
        const lists = await page.evaluate(() => window.model.lists);
        await page.evaluate(async () => { window.model.role='co';await window.render(); });
        await expect(page.getByText('Assigned criteria will appear', { exact: false })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Create template', exact: true })).toHaveCount(0);
        assert.equal(await page.evaluate(() => window.model.lists), lists);
        await page.screenshot({ path: out+'/co-adviser-360.png', fullPage: true });
        for (const roleId of [1,3,4]) {
            await page.evaluate(async id => { window.model.roleId=id;await window.render(); }, roleId);
            await expect(page.getByRole('link', { name: 'Evaluation Criteria', exact: true })).toHaveCount(0);
            assert.equal(await page.evaluate(() => window.model.lists), lists);
        }
        checks.push('Co compact informational state without private template list/CRUD; Admin/Student/Panel unchanged navigation and direct-route role guard');
        assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
        fs.writeFileSync(out+'/browser-result.json',JSON.stringify({ result:'PASS',checks,errors,unexpected,boundary:'Synthetic auth/data/router; actual components rendered; no PostgreSQL/authenticated Next acceptance; font fallback' },null,2));
        console.log('PASS '+checks.length+' focused synthetic browser groups; no page errors or unexpected requests.');
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error);process.exitCode=1; });
