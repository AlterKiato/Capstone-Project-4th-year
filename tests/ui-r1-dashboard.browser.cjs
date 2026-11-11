/* eslint-disable @typescript-eslint/no-require-imports */
// One sequential Chromium context, actual Dashboard/Submissions components, isolated action/service boundaries.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { build } = require('esbuild'), { chromium, expect } = require('@playwright/test');

async function main() {
    const out = 'test-results/ui-s1/r1-regression'; fs.mkdirSync(out, { recursive: true });
    const bundle = await build({ write: false, outfile: 'widget.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' }, stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react'; import {createRoot} from 'react-dom/client';
import Dashboard from './app/dashboard/student/page'; import Submissions from './app/dashboard/student/submissions/page';
import {ThemeProvider} from './components/theme-provider'; import shell from './components/dashboard/dashboard-shell.module.css';
const root=createRoot(document.getElementById('root')); let generation=0;
window.render=async(project=new URLSearchParams(location.search).get('project')??undefined)=>{
 const query={project}; const Page=location.pathname.endsWith('/submissions')?Submissions:Dashboard;
 root.render(<ThemeProvider><div className={shell.shell}><div className={shell.content}><React.Fragment key={++generation}>{await Page({searchParams:Promise.resolve(query)})}</React.Fragment></div></div></ThemeProvider>);
}; window.render();
` }, plugins: [{ name: 'offline-dashboard-boundaries', setup(b) {
            b.onResolve({ filter: /^@\/lib\/actions\// }, () => ({ path: 'actions', namespace: 'fixture' }));
            b.onResolve({ filter: /^@\/lib\/services\// }, () => ({ path: 'services', namespace: 'fixture' }));
            b.onResolve({ filter: /^next\/(navigation|link)$/ }, a => ({ path: a.path, namespace: 'fixture' }));
            b.onResolve({ filter: /^\.\/notification-bell$/ }, () => ({ path: 'bell', namespace: 'fixture' }));
            b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ loader: 'tsx', resolveDir: process.cwd(), contents: a.path === 'next/link'
                ? `import React from 'react'; export default function Link({children,...props}){return <a {...props}>{children}</a>}`
                : a.path === 'next/navigation' ? `export const useRouter=()=>({refresh(){window.render()},replace(href){location.href=href}});`
                : a.path === 'bell' ? `export default function Bell(){return null}`
                : a.path === 'services' ? `export async function getStudentWorkspace(){return window.model.workspace} export async function getCurrentStudentVerificationStatus(){return {verified:true}}`
                : `
const row=(id,paperId,dueDate,patch={})=>({id,paperId,title:'Synthetic milestone '+id,dueDate,revision:0,submissionId:null,verifiedBy:null,verifiedAt:null,evidence:null,...patch});
window.model={delay:0,fail:false,throws:false,reads:[],mutations:[],today:'2026-11-11',
 rows:[row(1,10,'2026-11-01',{submissionId:1,verifiedBy:2,verifiedAt:'2026-11-01T01:00:00Z'}),row(2,10,'2026-11-10'),row(4,10,'2026-11-11'),row(3,10,'2026-11-11'),row(5,10,'2026-11-30'),row(6,20,'2026-12-01')],
 workspace:{email:'student@example.invalid',groups:[{id:1,groupName:'Synthetic group',members:[]}],projects:[{id:10,groupId:1,title:'Synthetic Paper A',status:'Revision Required',abstract:'Synthetic'},{id:20,groupId:1,title:'Synthetic Paper B',status:'Draft',abstract:'Synthetic'}],submissions:[]}};
export async function readResearchProgressAction({paperId}){
 const m=window.model, rows=structuredClone(m.rows.filter(r=>r.paperId===paperId)), fail=m.fail, throws=m.throws; m.reads.push(['progress',paperId]);
 if(m.delay)await new Promise(r=>setTimeout(r,m.delay)); if(throws)throw Error('Synthetic request failure');
 return fail?{success:false,message:'Research progress is unavailable for this account or paper.'}:{success:true,data:{canManage:false,today:m.today,milestones:rows,submissions:[]}};
}
export async function readRevisionsAction({paperId}){window.model.reads.push(['revisions',paperId]);return {success:true,data:{canManage:false,cycles:paperId===10?[{feedbackId:1,submissionId:1,version:'v1',createdAt:'2026-11-11T01:00:00Z',editable:true,items:[{id:1,correction:'Synthetic correction',pageReference:null,responses:[]}]}]:[]}};}
export async function listWorkspaceTasksAction(){return {success:true,kind:'success',message:'Loaded',data:[]};}
const forbidden=async()=>{window.model.mutations.push('unexpected');throw Error('Unexpected mutation')};
export const mutateResearchProgressAction=forbidden,respondToRevisionAction=forbidden,createStudentResearchAction=forbidden,getSubmissionDownloadUrlAction=forbidden,initiateSubmissionUploadAction=forbidden,renewSubmissionUploadAction=forbidden,getSubmissionUploadStatusAction=forbidden,cancelSubmissionUploadAction=forbidden,finalizeSubmissionUploadAction=forbidden;
` }));
        } }] });
    const css = '@layer base {' + fs.readFileSync('node_modules/tailwindcss/preflight.css', 'utf8') + '}\n'
        + fs.readFileSync('app/globals.css', 'utf8').replace(/^@import.*$/m, '') + '\n' + bundle.outputFiles.find(f => f.path.endsWith('.css')).text;
    const js = bundle.outputFiles.find(f => f.path.endsWith('.js')).text;
    const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
    const errors = [], unexpected = [], evidence = [];
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Los_Angeles', hasTouch: true });
        const page = await context.newPage();
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        await page.route('**/*', route => route.request().url().startsWith('http://ui-r1.invalid/')
            ? route.fulfill({ contentType: 'text/html', body: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>` })
            : (unexpected.push(route.request().url()), route.abort()));
        await page.goto('http://ui-r1.invalid/dashboard/student?project=10');
        const card = page.getByRole('region', { name: 'Research Progress', exact: true });
        const revisions = page.getByRole('region', { name: 'Revision Checklist', exact: true });
        await expect(card.getByText('1 / 5 completed', { exact: true })).toBeVisible();
        await expect(card.getByText('Synthetic milestone 3', { exact: true })).toBeVisible();
        await expect(card.locator('dd').last()).toHaveText('1');
        await expect(card.getByRole('progressbar')).toHaveAttribute('value', '1');
        await expect(revisions.getByText('0 / 1 Addressed', { exact: true })).toBeVisible();
        await expect(card.getByRole('link', { name: 'View progress' })).toHaveAttribute('href', '/dashboard/student/submissions?project=10#research-progress');
        evidence.push('Verified count, overdue excludes completion/today, deterministic next deadline and R2 counts PASS');

        // Shared selection, reset-on-switch, stale request cancellation and honest loading state.
        await page.evaluate(() => { window.model.delay = 200; });
        await page.getByLabel('Research project', { exact: true }).selectOption('20');
        await expect(card.getByText('Loading research progress...', { exact: true })).toBeVisible();
        await expect(card.getByText('1 / 5 completed', { exact: true })).toHaveCount(0);
        await expect(revisions.getByText('No revision items yet.', { exact: true })).toBeVisible();
        await page.getByLabel('Research project', { exact: true }).selectOption('10');
        await expect(card.getByText('1 / 5 completed', { exact: true })).toBeVisible();
        await page.evaluate(() => { window.model.delay = 0; });
        await page.getByLabel('Research project', { exact: true }).selectOption('20');
        await expect(card.getByText('0 / 1 completed', { exact: true })).toBeVisible();
        await expect(card.getByRole('heading', { name: 'Synthetic Paper B' })).toBeVisible();
        await expect(revisions.getByRole('heading', { name: 'Synthetic Paper B' })).toBeVisible();
        await expect(card.getByRole('link')).toHaveAttribute('href', '/dashboard/student/submissions?project=20#research-progress');
        evidence.push('One selector, both project titles/data/links aligned, loading and stale switch PASS');

        // Actual destination Page and existing panel mount on the project-specific URL.
        await card.getByRole('link', { name: 'View progress' }).click();
        await expect(page).toHaveURL('http://ui-r1.invalid/dashboard/student/submissions?project=20#research-progress');
        await expect(page.getByLabel('Research project', { exact: true })).toHaveValue('20');
        await expect(page.locator('#research-progress').getByRole('heading', { name: 'Research Progress' })).toBeVisible();
        await expect(page.locator('#research-progress').getByText('Synthetic milestone 6', { exact: true })).toBeVisible();
        assert.ok(await page.locator('#research-progress').evaluate(node => node.getBoundingClientRect().top < innerHeight));
        evidence.push('View progress navigates to actual Submissions Page, authorized project and existing progress anchor PASS');

        await page.goto('http://ui-r1.invalid/dashboard/student?project=20');
        await revisions.getByRole('link', { name: 'View revisions' }).click();
        await expect(page).toHaveURL('http://ui-r1.invalid/dashboard/student/submissions?project=20#revision-checklist');
        await expect(page.getByLabel('Research project', { exact: true })).toHaveValue('20');
        await expect(page.locator('#revision-checklist')).toBeVisible();
        evidence.push('Existing R2 View revisions navigation retains the same selected project PASS');

        await page.goto('http://ui-r1.invalid/dashboard/student?project=999');
        await expect(card.getByText('1 / 5 completed', { exact: true })).toBeVisible();
        assert.ok((await page.evaluate(() => window.model.reads)).every(([, id]) => id === 10));
        await page.evaluate(() => window.render('../20'));
        await expect(card.getByText('1 / 5 completed', { exact: true })).toBeVisible();
        assert.ok((await page.evaluate(() => window.model.reads)).every(([, id]) => id === 10));
        evidence.push('Foreign/malformed project identifiers fall back inside authorized directory; R1 server authorization covered separately PASS');

        // No misleading bar for empty data; fulfilled and rejected errors support a working retry.
        await page.evaluate(() => { window.model.rows = []; window.render('10'); });
        await expect(card.getByText('Milestones not configured.', { exact: true })).toBeVisible();
        await expect(card.getByRole('progressbar')).toHaveCount(0);
        await page.evaluate(() => { window.model.fail = true; window.render('10'); });
        await expect(card.getByRole('alert')).toHaveText('Research progress is unavailable for this account or paper.');
        await page.evaluate(() => { window.model.fail = false; window.model.throws = true; });
        await card.getByRole('button', { name: 'Retry progress' }).click();
        await expect(card.getByRole('alert')).toHaveText('Research progress could not be loaded.');
        await page.evaluate(() => { window.model.throws = false; });
        await card.getByRole('button', { name: 'Retry progress' }).click();
        await expect(card.getByText('Milestones not configured.', { exact: true })).toBeVisible();
        await page.evaluate(() => { window.model.workspace.projects = []; window.render(); });
        await expect(card.getByText('No active research project.', { exact: true })).toBeVisible();
        await expect(card.getByRole('link')).toHaveCount(0);
        evidence.push('Empty/no project, loading, denied/rejected read and retry states PASS');

        await page.goto('http://ui-r1.invalid/dashboard/student?project=10');
        await expect(card.getByText('1 / 5 completed', { exact: true })).toBeVisible();
        const help = card.getByRole('button', { name: 'About research progress' });
        const note = card.getByRole('note');
        await help.focus(); await page.keyboard.press('Enter');
        await expect(note).toBeVisible(); await expect(note).toContainText('Main Adviser verification');
        await page.keyboard.press('Escape'); await expect(note).toBeHidden(); await expect(help).toBeFocused();
        await help.tap(); await expect(note).toBeVisible(); await help.tap(); await expect(note).toBeHidden();
        await help.focus(); await page.keyboard.press('Shift+Tab'); await expect(page.getByLabel('Research project', { exact: true })).toBeFocused();
        await page.keyboard.press('Tab'); await expect(help).toBeFocused();
        await page.keyboard.press('Tab'); await expect(card.getByRole('link')).toBeFocused();
        evidence.push('Help keyboard Enter/Escape and touch toggle; selector/help/link Tab order PASS');

        for (const [width, theme] of [[1440, 'light'], [1440, 'dark'], [768, 'light'], [360, 'light'], [360, 'dark']]) {
            await page.setViewportSize({ width, height: 1000 });
            await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}/${theme}`);
            const a = await card.boundingBox(), b = await revisions.boundingBox();
            assert.ok(width <= 640 ? b.y > a.y + a.height : Math.abs(b.y - a.y) < 2);
            await help.click(); await expect(note).toBeVisible(); await page.keyboard.press('Escape');
            const target = await help.boundingBox(); assert.ok(target.width >= 44 && target.height >= 44);
            const contrast = await card.evaluate(node => {
                const luminance = color => {
                    const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
                        const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
                    });
                    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
                };
                const background = luminance(getComputedStyle(node).backgroundColor);
                return [...node.querySelectorAll('h2,h3,strong,dt,dd,time,a,button')].map(element => {
                    const foreground = luminance(getComputedStyle(element).color);
                    return (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05);
                });
            });
            assert.ok(contrast.every(ratio => ratio >= 4.5), `Text contrast at ${width}/${theme}`);
            await page.screenshot({ path: `${out}/dashboard-${width}-${theme}.png`, fullPage: true });
        }
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
        assert.equal(await card.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(24, 38, 56)');
        evidence.push('Side-by-side desktop/tablet; stacked 360px, Light/Dark/System, text contrast >=4.5:1, help target >=44px, no overflow PASS');

        // All verified and only-overdue states.
        await page.evaluate(() => { window.model.rows = window.model.rows.filter(r => r.paperId === 10).map(r => ({ ...r, submissionId: 1, verifiedBy: 2, verifiedAt: '2026-11-11T01:00:00Z' })); window.render('10'); });
        await expect(card.getByText('5 / 5 completed', { exact: true })).toBeVisible();
        await expect(card.getByText('No upcoming deadline', { exact: true })).toBeVisible();
        await expect(card.locator('dd').last()).toHaveText('0');
        await page.evaluate(() => { window.model.rows = [{ ...window.model.rows[0], verifiedBy: null, verifiedAt: null }]; window.render('10'); });
        await expect(card.getByText('0 / 1 completed', { exact: true })).toBeVisible();
        await expect(card.getByText('No upcoming deadline', { exact: true })).toBeVisible();
        await expect(card.locator('dd').last()).toHaveText('1');
        assert.deepEqual(await page.evaluate(() => window.model.mutations), []);
        assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
        evidence.push('All completed, none completed/only overdue, zero mutations/unexpected requests/console errors PASS');
        fs.writeFileSync(`${out}/browser-evidence.json`, JSON.stringify(evidence, null, 2));
        console.log(evidence.join('\n'));
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
