/* eslint-disable @typescript-eslint/no-require-imports */
// Bounded component fixtures; all server actions/services and PDF responses are synthetic.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { build } = require('esbuild');
const { chromium, expect } = require('@playwright/test');

const services = `
export async function requireRole(){return {email:'synthetic@example.invalid'}}
export async function getPublishedResearchDetails(){return {id:1,paperId:1,title:window.__title,groupName:'Synthetic group',strand:'STEM',section:'Test',schoolYear:'2026',abstract:'Synthetic abstract',publishedAt:new Date('2026-01-01')}}
export async function recordResearchRepositoryView(){window.__views++}
export async function getAdviserReviewDetails(){return {email:'synthetic@example.invalid',submission:{id:1,paperId:1,version:'v1',status:'Under Review',researchTitle:'Synthetic review',groupName:'Synthetic group',studentFirstName:'Synthetic',studentLastName:'Student',submittedAt:new Date('2026-01-01'),remarks:'Synthetic remarks'},feedback:[],versions:[{id:1,version:'v1',status:'Under Review'}]}}
`;
const actions = `
const refuse=async()=>{window.__writes++;return {success:false,message:'Synthetic denied action'}};
export const changeUserRoleAction=refuse,changeUserStatusAction=refuse,createManagedAccountAction=refuse,changeResearchGroupStatusAction=refuse;
export const recordAIEligibilityAction=refuse,recordAIConsentAction=refuse,createAdviserFeedbackAction=refuse,startSubmissionReviewAction=refuse,createStudentResearchAction=refuse;
export const initiateSubmissionUploadAction=refuse,renewSubmissionUploadAction=refuse,getSubmissionUploadStatusAction=refuse,cancelSubmissionUploadAction=refuse,finalizeSubmissionUploadAction=refuse;
export const getRepositoryDocumentUrlAction=refuse,logoutAction=refuse;
export const markNotificationAsReadAction=refuse,markAllNotificationsAsReadAction=refuse;
export async function getNotificationPreviewAction(){return {success:true,data:{unreadCount:0,recent:[]}}}
export async function getEligibilityUIAction(){return {available:false}}
export async function getConsentUIAction(){return {available:false}}
export async function getSubmissionDownloadUrlAction(id,purpose){window.__signs.push({id,purpose});return 'https://pdf.invalid/synthetic'}
`;

async function main() {
    const artifacts = fs.mkdtempSync(join(tmpdir(), 'thesishs-batchb-'));
    const bundle = await build({ write: false, outfile: 'batchb.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
        stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';import{createRoot}from'react-dom/client';
import Repository from './app/dashboard/repository/[paperId]/page';
import Review from './app/dashboard/adviser/submissions/[submissionId]/page';
import Users from './components/dashboard/admin-users';import Groups from './components/dashboard/admin-groups';
import StudentResearch from './components/dashboard/student-research';
import Shell from './components/dashboard/dashboard-shell';import{dashboardLinks}from'./lib/constants/dashboard-navigation';
import NotificationProvider from './components/dashboard/notification-provider';import{ThemeProvider}from'./components/theme-provider';
const root=createRoot(document.getElementById('root'));let generation=0;
window.__views=0;window.__writes=0;window.__signs=[];window.__path='/dashboard/repository/1';window.__profile='browser';
window.__title='Synthetic research '+('Long research title examining student research accessibility ').repeat(3);
window.render=async(kind,data={},profile='browser')=>{
window.__profile=profile;window.__path=kind==='review'?'/dashboard/adviser/submissions/1':'/dashboard/repository/1';
const node=kind==='repository'?await Repository({params:Promise.resolve({paperId:'1'})}):kind==='review'?await Review({params:Promise.resolve({submissionId:'1'})}):kind==='users'?<main><Users users={data.users} actorId={1}/></main>:kind==='groups'?<main><Groups groups={data.groups}/></main>:<main><StudentResearch workspace={{email:'synthetic@example.invalid',groups:[{id:1,groupName:'Synthetic group'}],projects:[{id:1,groupId:1,title:window.__title,abstract:'Synthetic abstract',status:'Draft'}],submissions:[]}} target={{}}/></main>;
root.render(<ThemeProvider key={++generation}><NotificationProvider historyHref='/dashboard/student/notifications'><Shell links={dashboardLinks(kind==='review'?2:3)}>{node}</Shell></NotificationProvider></ThemeProvider>);
};` },
        plugins: [{ name: 'batchb-fixtures', setup(b) {
            b.onResolve({ filter: /^@\/lib\/actions\// }, () => ({ path: 'actions', namespace: 'fixture' }));
            b.onResolve({ filter: /^@\/lib\/(?:services\/|auth\/authorization$)/ }, () => ({ path: 'services', namespace: 'fixture' }));
            b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
            b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
            b.onResolve({ filter: /(?:^@\/lib\/pwa\/|^\.\/)use-display-mode$/ }, () => ({ path: 'display', namespace: 'fixture' }));
            b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ resolveDir: process.cwd(), loader: 'tsx', contents: args.path === 'actions' ? actions : args.path === 'services' ? services : args.path === 'navigation' ?
                `export function usePathname(){return window.__path} export function useRouter(){return {refresh(){},push(href){window.__navigation=href},replace(href){window.__navigation=href}}}export function notFound(){throw Error('Synthetic missing route')}` : args.path === 'display' ?
                    `export function useDisplayMode(){return window.__profile==='mobile'?'standalone':'browser'}export function usePwaPlatform(){return window.__profile==='mobile'?'android':'desktop'}` :
                    `import React from 'react';export default function Link({href,children,...props}){return <a {...props} href={href} onClick={event=>{props.onClick?.(event);if(!event.defaultPrevented){event.preventDefault();window.__navigation=href}}}>{children}</a>}` }));
        } }],
    });
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 360, height: 640 } });
        page.setDefaultTimeout(6000);
        const errors = [], unexpected = [], observations = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', route => {
            const host = new URL(route.request().url()).hostname;
            if (host === 'batchb.invalid') return route.fulfill({ contentType: 'text/html', body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' });
            if (host === 'pdf.invalid') return route.fulfill({ contentType: 'text/html', body: '<p>Synthetic PDF surface; native viewer not tested.</p>' });
            unexpected.push(host); return route.abort();
        });
        await page.goto('https://batchb.invalid');
        await page.addStyleTag({ content: '@layer base {' + fs.readFileSync('node_modules/tailwindcss/preflight.css', 'utf8') + '}\n' + fs.readFileSync('app/globals.css', 'utf8') + '\n' + bundle.outputFiles.find(f => f.path.endsWith('.css')).text });
        await page.addScriptTag({ content: bundle.outputFiles.find(f => f.path.endsWith('.js')).text });
        async function render(kind, data = {}, profile = 'browser') {
            await page.evaluate(async ({ kind, data, profile }) => { await window.render(kind, data, profile); }, { kind, data, profile });
            await expect(page.locator('main')).toBeVisible();
        }
        async function theme(value) {
            await page.getByRole('button', { name: 'Change theme', exact: true }).click();
            await page.getByRole('menuitemradio', { name: value, exact: true }).click();
            await expect(page.locator('html')).toHaveAttribute('data-theme', value.toLowerCase());
        }
        for (const width of [360, 1280]) for (const appearance of ['Light', 'Dark']) {
            await page.setViewportSize({ width, height: 800 });
            await render('repository'); await theme(appearance);
            const heading = page.getByRole('heading', { level: 1 });
            await expect(heading).toHaveText(await page.evaluate(() => window.__title));
            const boxes = await page.evaluate(() => {
                const h = document.querySelector('h1').getBoundingClientRect(), main = document.querySelector('main'), button = document.querySelector('button[aria-label="Change theme"]').getBoundingClientRect();
                const style = getComputedStyle(main);
                return { titleWidth: h.width, contentWidth: main.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), titleTop: h.top, controlBottom: button.bottom, overflow: document.documentElement.scrollWidth > innerWidth };
            });
            assert.equal(boxes.overflow, false);
            if (width === 360) { assert.ok(Math.abs(boxes.titleWidth - boxes.contentWidth) < 2); assert.ok(boxes.titleTop >= boxes.controlBottom); }
            else {
                const before = await heading.boundingBox();
                await page.locator('main').evaluate(el => { el.dataset.originalClass = el.className; el.className = 'dashboard-page discovery-page'; });
                assert.deepEqual(await heading.boundingBox(), before, 'Route class does not alter desktop heading geometry');
                await page.locator('main').evaluate(el => { el.className = el.dataset.originalClass; });
            }
            const bell = page.getByRole('button', { name: /Notifications/ }).first();
            await bell.click(); await expect(page.getByText("You're all caught up.")).toBeVisible(); await page.keyboard.press('Escape'); await expect(bell).toBeFocused();
            const back = page.getByRole('link', { name: 'Back to Repository', exact: true });
            await back.focus(); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => window.__navigation), '/dashboard/repository');
            await page.screenshot({ path: join(artifacts, `repository-${width}-${appearance}.png`), fullPage: true });
        }
        const users = [{ id: 2, firstName: 'Synthetic', lastName: 'Alpha', email: 'alpha@example.invalid', roleId: 3, isActive: true, createdAt: '2026-01-01', emailVerification: 'Unverified' },
            { id: 3, firstName: 'Synthetic', lastName: 'Beta', email: 'beta@example.invalid', roleId: 2, isActive: false, createdAt: '2026-01-01', emailVerification: 'Not applicable' }];
        const groups = [{ id: 1, groupName: 'Synthetic Alpha', strand: 'STEM', section: 'A', schoolYear: '2026', adviserId: 2, status: 'active' },
            { id: 2, groupName: 'Synthetic Beta', strand: 'ICT', section: 'B', schoolYear: '2026', adviserId: 2, status: 'archived' }];
        for (const appearance of ['light', 'dark']) for (const kind of ['users', 'groups']) {
            await page.setViewportSize({ width: 360, height: 560 }); await render(kind, { [kind]: kind === 'users' ? users : groups });
            await page.evaluate(appearance => { document.documentElement.dataset.theme = appearance; }, appearance);
            const count = page.getByRole('status').filter({ hasText: /^Showing/ });
            await expect(count).toHaveText(`Showing 2 of 2 ${kind}.`); await expect(count).toHaveAttribute('aria-atomic', 'true');
            await expect(count).toHaveCount(1);
            const search = page.getByLabel(`Search ${kind}`, { exact: true });
            await search.fill('Alpha'); await expect(count).toHaveText(`Showing 1 of 2 ${kind}.`);
            // A stable live-region node receives no mutation when search changes but the count does not.
            await count.evaluate(el => { window.__countObserver = new MutationObserver(records => { window.__countMutations += records.length; }); window.__countMutations = 0; window.__countObserver.observe(el, { childList: true, subtree: true, characterData: true }); });
            await search.fill('ALPHA'); await page.evaluate(() => new Promise(requestAnimationFrame)); assert.equal(await page.evaluate(() => window.__countMutations), 0);
            if (kind === 'users') await page.getByLabel('Role filter').selectOption('3');
            await page.getByRole('combobox', { name: kind === 'users' ? /^Status filter/ : 'Group status' }).selectOption(kind === 'users' ? 'inactive' : 'archived');
            await expect(count).toHaveText(`Showing 0 of 2 ${kind}.`); await expect(page.getByText(new RegExp(`^No ${kind} match`))).toBeVisible();
            await page.getByRole('button', { name: 'Clear filters', exact: true }).click(); await expect(count).toHaveText(`Showing 2 of 2 ${kind}.`); await expect(search).toHaveValue('');
            await search.focus(); await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => document.activeElement.tagName === 'SELECT'));
            if (kind === 'users') { await page.getByRole('button', { name: /^Manage Synthetic Alpha/ }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape'); }
            else { await page.getByRole('button', { name: 'Archive Synthetic Alpha' }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); }
            await expect(count).toHaveText(`Showing 2 of 2 ${kind}.`); assert.equal(await page.evaluate(() => window.__writes), 0);
            await render(kind, { [kind]: [] }); await expect(page.getByRole('status').filter({ hasText: /^Showing/ })).toHaveText(`Showing 0 of 0 ${kind}.`);
        }
        // Verify the unchanged PDF workspace at short browser and simulated installed-mobile sizes.
        for (const [width, height, profile] of [[360, 480, 'browser'], [390, 340, 'mobile']]) {
            await page.setViewportSize({ width, height }); await render('review', {}, profile);
            await page.getByRole('button', { name: 'Preview PDF', exact: true }).click(); await expect(page.locator('iframe')).toBeVisible();
            const frameHeight = (await page.locator('iframe').boundingBox()).height;
            const editor = page.getByRole('textbox', { name: /Feedback/ }); await editor.click(); await editor.fill('Synthetic unsaved feedback'); await expect(editor).toBeFocused();
            const preview = page.getByRole('button', { name: 'Preview PDF', exact: true }); await preview.scrollIntoViewIfNeeded(); await expect(preview).toBeInViewport();
            await editor.scrollIntoViewIfNeeded(); await expect(editor).toBeInViewport();
            page.once('dialog', d => d.dismiss()); await page.getByRole('link', { name: 'Back to Submissions' }).click(); await expect(editor).toHaveText('Synthetic unsaved feedback');
            observations.push({ check: 'B.3', width, height, profile, frameHeight, result: 'No blocked access: page scroll reaches PDF actions and feedback' });
            await page.screenshot({ path: join(artifacts, `review-${width}-${height}.png`), fullPage: true });
        }
        // Actual Student upload and long project dialogs, with no file transfers or action calls.
        for (const [width, height] of [[360, 560], [390, 340]]) {
            await page.setViewportSize({ width, height }); await render('student', {}, 'mobile');
            for (const kind of ['Submit PDF', 'Create Project']) {
                const trigger = page.getByRole('button', { name: kind, exact: true }); await trigger.click();
                const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
                await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused(); await trigger.click(); await expect(dialog).toBeVisible();
                const controls = dialog.locator('button:enabled,input:enabled,textarea:enabled,select:enabled');
                for (let i = 0; i < await controls.count(); i++) { await controls.nth(i).focus(); await expect(controls.nth(i)).toBeInViewport(); }
                const close = dialog.getByRole('button', { name: /^Close / }); await controls.last().focus(); await page.keyboard.press('Tab'); await expect(close).toBeFocused(); await page.keyboard.press('Shift+Tab'); await expect(controls.last()).toBeFocused();
                const input = dialog.getByLabel(kind === 'Submit PDF' ? 'Remarks (optional)' : 'Research Title', { exact: true }); await input.fill('Synthetic draft');
                page.once('dialog', d => d.dismiss()); await page.keyboard.press('Escape'); await expect(dialog).toBeVisible(); await expect(input).toHaveValue('Synthetic draft');
                await page.screenshot({ path: join(artifacts, `dialog-${kind.replaceAll(' ', '-')}-${width}-${height}.png`), fullPage: true });
                assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.clientHeight <= innerHeight));
                page.once('dialog', d => d.accept()); await close.click(); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
                observations.push({ check: 'B.4', width, height, kind, result: 'Controls scroll into view; focus loops; dirty Escape cancels; confirmed Close restores focus' });
            }
        }
        assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
        assert.equal(await page.evaluate(() => window.__writes), 0);
        console.log(JSON.stringify({ result: 'PASS', observations, artifacts, limits: 'Synthetic Chromium; no real PDF, hosted calls, screen-reader speech, physical safe area or software keyboard' }));
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
