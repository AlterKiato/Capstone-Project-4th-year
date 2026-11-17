/* eslint-disable @typescript-eslint/no-require-imports */
// Existing esbuild/Playwright fixture pattern; all server and navigation boundaries are synthetic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { chromium, expect } = require('@playwright/test');

async function main() {
    const out = 'test-results/visual-v15eb'; fs.mkdirSync(out, { recursive: true });
    const actions = `
const count=name=>window.calls[name]=(window.calls[name]??0)+1;
export async function getAdminInterpretationAvailabilityAction(){count('institutionalAvailability');return{available:false}}
export async function getAdminInterpretationAction(){throw Error('Institutional dispatch forbidden')}
export async function getLocalAdminAssistanceAction(input){count('static');if(JSON.stringify(input)!==JSON.stringify({reportId:'admin-overview-v1'}))throw Error('Invalid request');
if(window.cfg.staticMode==='hold')await new Promise(resolve=>window.releaseStatic=resolve);
if(window.cfg.staticMode==='throw')throw Error('Synthetic failure');
return window.cfg.staticMode==='error'?{success:false,mode:'unavailable',message:'Synthetic static guidance unavailable.'}:{success:true,mode:'static',message:'AI interpretation is disabled. Verified static guidance is available.',guidance:window.cfg.staticMode==='long'?'Synthetic long guidance. '.repeat(120)+'X'.repeat(180):'Reports count all accounts and groups, research papers by their project status, and eligible published papers. Publication requires an Approved paper and approved submission. Counts are separate live reads, not a historical snapshot. Recent activity includes only the latest five recorded actions. No trends, rankings or academic decisions are inferred.'}}
export async function getLocalAdviserAssistanceAction(){count('adviser');return{success:true,mode:'static',message:'Verified static procedural guidance. No AI provider is used.',guidance:'Synthetic Adviser workflow guidance.'}}
export async function getConsentUIAction(){count('consent');return{available:true,eligible:true,accepted:window.accepted??true,consentRevision:1,termsVersion:'synthetic-draft',termsText:'SYNTHETIC DRAFT: optional preparation only. Accepting does not enable institutional AI.'}}
export async function recordAIConsentAction(input){count('consentWrites');window.accepted=input.action==='accept';return{success:true,message:'Synthetic consent updated.'}}
export async function getEligibilityUIAction(){throw Error('Unexpected eligibility request')}
export async function recordAIEligibilityAction(){throw Error('Eligibility mutation forbidden')}
export async function getDeveloperEvaluationAvailabilityAction(){count('evaluationAvailability');const mode=window.cfg.evalMode;if(mode==='hidden')return{available:false};
return{available:true,message:'Groq configuration is unavailable. Generate is disabled.',syntheticBands:{totalUsers:'5-9',totalGroups:'10-19',totalResearchPapers:'10-19',totalPublishedPapers:'5-9'},budget:mode==='missing'?null:{accountRemaining:mode==='quota'?0:3,globalRemaining:10,remaining:mode==='quota'?0:3,busy:mode==='busy',waitSeconds:mode==='cooldown'?119:0}}}
export async function runDeveloperEvaluationAction(input){count('evaluation');if(JSON.stringify(input)!==JSON.stringify({feature:'admin'}))throw Error('Invalid evaluation input');
return window.cfg.evalResult==='error'?{mode:'unavailable',message:'Synthetic provider unavailable. No automatic retry.'}:{mode:'generated',feature:'admin',output:{overview:'SYNTHETIC generated overview; not current institutional data.',explanations:[{metricId:'totalUsers',band:'5-9',text:'Synthetic account-band explanation.'}]}}}
`;
    const services = `export async function requireRole(roles){if(!roles.includes(window.cfg.role))throw Error('Synthetic role denied');return{email:'admin@example.invalid'}}
export async function getAdminDashboardStats(){window.calls.stats=(window.calls.stats??0)+1;return{success:true,data:{totalUsers:12,totalGroups:3,totalResearchPapers:5,totalPublishedPapers:2,totalStudents:8,totalAdvisers:3,usersByRole:[{role:'Student',count:8},{role:'Adviser',count:3},{role:'Admin',count:1}],papersByStatus:[{status:'Approved',count:2},{status:'Under Review',count:3}]}}}
export async function getAdminRecentActivities(){return{success:true,data:[]}}`;
    const bundle = await build({ write: false, outfile: 'admin-ai.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' }, stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';import{createRoot}from'react-dom/client';import Dashboard from './app/dashboard/admin/page';import Reports from './app/dashboard/admin/reports/page';
import Assistance from './components/dashboard/local-ai-assistance';import Shell from './components/dashboard/dashboard-shell';import{dashboardLinks}from'./lib/constants/dashboard-navigation';import{ThemeProvider}from'./components/theme-provider';
const root=createRoot(document.getElementById('root'));let generation=0;
window.show=async(kind,cfg={})=>{window.cfg={role:1,evalMode:'hidden',...cfg};window.calls={};window.accepted=true;window.path=kind==='dashboard'?'/dashboard/admin':'/dashboard/admin/reports';
let node;if(kind==='dashboard'){const boundary=await Dashboard();node=await boundary.props.children.type(boundary.props.children.props)}else node=kind==='adviser'?<main className='dashboard-page'><Assistance feature='adviser'/></main>:await Reports();
root.render(<ThemeProvider key={++generation}><Shell links={dashboardLinks(1)}>{node}</Shell></ThemeProvider>)};
window.navigate=async href=>{window.lastHref=href;history.pushState({},'',href);await window.show('reports',window.cfg);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const target=document.getElementById('admin-report-assistance');target?.scrollIntoView();target?.focus()};
` }, plugins: [{ name: 'admin-ai-fixtures', setup(b) {
            b.onResolve({ filter: /^@\/lib\/actions\// }, () => ({ path: 'actions', namespace: 'fixture' }));
            b.onResolve({ filter: /^@\/lib\/(services\/|auth\/authorization$)/ }, () => ({ path: 'services', namespace: 'fixture' }));
            b.onResolve({ filter: /^next\/(link|navigation|image)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
            b.onResolve({ filter: /(?:notification-bell|logout-button)$/ }, () => ({ path: 'empty', namespace: 'fixture' }));
            b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents:
                args.path === 'actions' ? actions : args.path === 'services' ? services : args.path === 'empty' ? 'export default function Empty(){return null}' :
                    args.path === 'next/navigation' ? 'export function usePathname(){return window.path}export function useRouter(){return{push(){},refresh(){}}}' :
                        args.path === 'next/image' ? 'export default function Image({priority,unoptimized,fill,...props}){return <img {...props}/>}' :
                            'export default function Link({prefetch,onNavigate,children,...props}){return <a {...props} onClick={event=>{event.preventDefault();onNavigate?.(event);void window.navigate(props.href)}}>{children}</a>}' }));
        } }] });
    const css = '@layer base {' + fs.readFileSync('node_modules/tailwindcss/preflight.css', 'utf8') + '}\n'
        + fs.readFileSync('app/globals.css', 'utf8').replace(/^@import.*$/m, '') + '\n' + bundle.outputFiles.find(f => f.path.endsWith('.css')).text;
    const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
    const checks = [], errors = [], unexpected = [], contrast = [];
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
        const page = await context.newPage(); page.setDefaultTimeout(6000);
        page.on('pageerror', e => errors.push(e.message));
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.hostname !== 'visual-v15eb.invalid') { unexpected.push(url.hostname); return route.abort(); }
            if (url.pathname === '/branding/thesishs-mark.svg') return route.fulfill({ contentType: 'image/svg+xml', body: fs.readFileSync('public/branding/thesishs-mark.svg') });
            return route.fulfill({ contentType: 'text/html', body: '<html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' });
        });
        await page.goto('https://visual-v15eb.invalid'); await page.addStyleTag({ content: css });
        await page.addScriptTag({ content: bundle.outputFiles.find(f => f.path.endsWith('.js')).text });
        const render = async (kind = 'reports', cfg = {}) => { await page.evaluate(({ kind, cfg }) => window.show(kind, cfg), { kind, cfg }); await expect(page.locator('main')).toBeVisible(); };
        const panel = page.locator('#admin-report-assistance');
        const explain = page.getByRole('button', { name: 'Explain report metrics', exact: true });
        const evaluation = page.getByText('AI Evaluation — Synthetic Data', { exact: true });
        const screenshot = async name => { await page.screenshot({ path: `${out}/${name}.png`, fullPage: true }); };
        const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal overflow');
        await render('dashboard');
        await expect(page.getByRole('heading', { name: 'Admin Report Assistance', exact: true })).toBeVisible();
        assert.deepEqual(await page.evaluate(() => window.calls), { stats: 1 });
        const card = page.getByRole('link', { name: 'Open report assistance' });
        await expect(card).toHaveAttribute('href', '/dashboard/admin/reports#admin-report-assistance');
        await expect(page.locator('dl.dashboard-metrics dd:first-of-type')).toHaveText(['12', '3', '5', '2']);
        await screenshot('dashboard-light'); await card.click();
        await expect(panel).toBeFocused(); assert.ok((await panel.boundingBox()).y >= 80, 'Fragment heading clears fixed UI');
        assert.equal(await page.evaluate(() => window.lastHref), '/dashboard/admin/reports#admin-report-assistance'); checks.push('Dashboard entry, unchanged metrics, zero AI/consent requests, fragment destination/arrival');
        await expect(panel.getByText('Unavailable', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Interpret count bands with Live AI' })).toBeDisabled();
        await expect(page.getByRole('heading', { name: 'Synthetic AI Evaluation' })).toBeHidden();
        await screenshot('reports-default-light'); checks.push('Institutional unavailable and evaluation hidden');
        const help = page.getByText('About report assistance', { exact: true });
        await help.focus(); await page.keyboard.press('Enter');
        await expect(panel.getByText(/Static explanations remain available/)).toBeVisible();
        assert.notEqual(await help.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
        assert.ok((await help.boundingBox()).height >= 44); await page.keyboard.press('Space'); checks.push('Keyboard disclosure, visible focus and 44px target');
        await explain.click(); await expect(panel.getByRole('heading', { name: 'Report metric explanations' })).toBeVisible();
        await expect(panel.getByText(/Reports count all accounts/)).toBeVisible();
        assert.equal(await page.evaluate(() => window.calls.static), 1); await screenshot('static-light'); checks.push('Reviewed static action/result');
        const consent = page.getByRole('button', { name: 'AI Terms & Consent', exact: true });
        await consent.click(); const dialog = page.getByRole('dialog', { name: 'AI Terms & Consent' }); await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'Accept terms' })).toBeDisabled();
        await dialog.getByRole('checkbox').check(); await expect(dialog.getByRole('button', { name: 'Accept terms' })).toBeEnabled();
        await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(consent).toBeFocused();
        await consent.click(); await dialog.getByRole('button', { name: 'Withdraw consent' }).click();
        await expect(dialog.getByRole('status')).toHaveText('Synthetic consent updated.'); await dialog.getByRole('button', { name: 'Close', exact: true }).click();
        await expect(consent).toBeFocused(); await expect(page.getByRole('button', { name: 'Interpret count bands with Live AI' })).toBeDisabled(); checks.push('Actual consent dialog confirmation, Escape/Close focus and synthetic withdrawal');
        await render('reports', { staticMode: 'hold' }); await explain.click(); await expect(panel.getByRole('status')).toHaveAttribute('aria-busy', 'true');
        await expect(explain).toBeDisabled(); await expect(panel.getByText('Loading static guidance...')).toBeVisible();
        await page.evaluate(() => window.releaseStatic()); await expect(panel.getByRole('status')).toHaveAttribute('aria-busy', 'false');
        for (const mode of ['error', 'throw']) { await render('reports', { staticMode: mode }); await explain.click(); await expect(panel.getByRole('heading', { name: 'Assistance unavailable' })).toBeVisible(); }
        checks.push('Loading, disabled actions and error/exception fallback');
        await render('reports', { evalMode: 'ready' }); await evaluation.click();
        await expect(page.getByRole('heading', { name: 'Synthetic AI Evaluation' })).toBeVisible();
        await expect(page.getByLabel('Fixed synthetic count bands')).toContainText('Accounts: 5-9');
        await screenshot('synthetic-evaluation-light'); await page.getByRole('button', { name: 'Generate AI evaluation', exact: true }).click();
        await expect(page.getByText('Groq-generated AI evaluation — synthetic data. This is not Demo output.')).toBeVisible();
        await expect(page.getByText('Synthetic account-band explanation.')).toBeVisible(); assert.equal(await page.evaluate(() => window.calls.static ?? 0), 0);
        await render('reports', { evalMode: 'ready', evalResult: 'error' }); await evaluation.click(); await page.getByRole('button', { name: 'Generate AI evaluation', exact: true }).click();
        await expect(page.getByText('Synthetic provider unavailable. No automatic retry.')).toBeVisible();
        for (const mode of ['quota', 'missing', 'cooldown', 'busy']) { await render('reports', { evalMode: mode }); await evaluation.click(); await expect(page.getByRole('button', { name: 'Generate AI evaluation', exact: true })).toBeDisabled(); }
        checks.push('Separate actual evaluation component: synthetic output/error, quota/configuration/cooldown/concurrency blocks');
        for (const width of [1280, 360]) for (const theme of ['light', 'dark']) {
            await page.setViewportSize({ width, height: 850 });
            await render('dashboard'); await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme); await noOverflow(); await screenshot(`dashboard-${width}-${theme}`);
            await render('reports'); await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            await panel.screenshot({ path: `${out}/assistance-default-${width}-${theme}.png` });
            await explain.click(); await panel.screenshot({ path: `${out}/assistance-static-${width}-${theme}.png` });
            const ratios = await panel.evaluate(root => {
                const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
                const luminance = color => rgb(color).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
                return [...root.querySelectorAll('h2,h3,p,summary,button:not(:disabled)')].filter(el => el.getBoundingClientRect().height && !el.closest('dialog')).map(el => {
                    let parent = el, bg = 'rgb(255,255,255)';
                    while (parent) { const value = getComputedStyle(parent).backgroundColor; if (value.startsWith('rgb(')) { bg = value; break; } parent = parent.parentElement; }
                    const a = luminance(getComputedStyle(el).color), b = luminance(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
                });
            });
            const minimum = Math.min(...ratios); assert.ok(minimum >= 4.5, `${theme} text contrast ${minimum}`); contrast.push({ width, theme, minimum });
            await render('reports', { evalMode: 'ready', staticMode: 'long' }); await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            await explain.click(); await evaluation.click(); await noOverflow();
            for (const button of await panel.getByRole('button').all()) if (await button.isVisible()) assert.ok((await button.boundingBox()).height >= 44);
            await screenshot(`reports-long-${width}-${theme}`);
        }
        checks.push('Desktop/mobile Light/Dark, long output, wrapping and button targets');
        await render('adviser'); await expect(page.getByRole('heading', { name: 'Adviser workflow assistance' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'How do I start review?' })).toBeVisible();
        await expect(panel).toHaveCount(0); await expect(page.getByRole('heading', { name: 'Synthetic AI Evaluation' })).toHaveCount(0);
        await page.getByRole('button', { name: 'How do I start review?' }).click(); await expect(page.getByText('Synthetic Adviser workflow guidance.')).toBeVisible();
        checks.push('Adviser branch original controls, action and result');
        const denied = await page.evaluate(async () => { try { await window.show('reports', { role: 3 }); return false; } catch { return true; } }); assert.ok(denied); checks.push('Actual route invokes role gate (synthetic denial)');
        const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        // Reuse the same bounded synthetic document, with no real service connection.
        await touch.route('**/*', route => route.fulfill({ contentType: 'text/html', body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' }));
        const mobile = await touch.newPage(); await mobile.goto('https://visual-v15eb.invalid'); await mobile.addStyleTag({ content: css }); await mobile.addScriptTag({ content: bundle.outputFiles.find(f => f.path.endsWith('.js')).text });
        await mobile.evaluate(() => window.show('reports')); await mobile.getByText('About report assistance', { exact: true }).tap();
        await expect(mobile.getByText(/Static explanations remain available/)).toBeVisible(); await mobile.getByRole('button', { name: 'Explain report metrics', exact: true }).tap();
        await expect(mobile.getByRole('heading', { name: 'Report metric explanations' })).toBeVisible(); await touch.close(); checks.push('Touch disclosure and static action');
        assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
        fs.writeFileSync(`${out}/browser-results.json`, JSON.stringify({ result: 'PASS', checks, contrast, errors, unexpected, limits: 'Synthetic actions/services/navigation; CSS font fallback (Next font loader absent). No Next router runtime, real authentication, database, provider or physical-device acceptance.' }, null, 2));
        const pictures = fs.readdirSync(out).filter(name => name.endsWith('.png') && !name.includes('long-'));
        fs.writeFileSync(`${out}/index.html`, '<!doctype html><meta charset="utf-8"><title>V1.5E-B owner gallery</title><style>body{font:16px system-ui;background:#eee;margin:24px}figure{margin:32px 0}img{max-width:100%;border:1px solid #aaa}figcaption{margin:8px 0}</style><h1>V1.5E-B — synthetic visual acceptance</h1><p>Local component fixtures. These screenshots do not establish operational AI readiness.</p>' + pictures.map(name => `<figure><figcaption>${name}</figcaption><a href="${name}"><img src="${name}" loading="lazy"></a></figure>`).join(''));
        console.log(JSON.stringify({ result: 'PASS', groups: checks.length, gallery: `${out}/index.html` }));
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
