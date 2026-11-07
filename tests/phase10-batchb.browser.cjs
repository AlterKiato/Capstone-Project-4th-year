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
export async function getDashboardAccount(){return {id:1,roleId:window.__role,email:'synthetic@example.invalid'}}
export async function getCurrentStudentVerificationStatus(){return {verified:false}}
export async function getStudentWorkspace(){return {email:'synthetic@example.invalid',groups:[{id:1,groupName:'Synthetic group',strand:'STEM',section:'A',schoolYear:'2026',members:[]}],projects:[{id:1,groupId:1,title:'Synthetic research',status:'Revision Required'}],submissions:[{id:1,paperId:1,version:'v1',status:'Revision Required',submittedAt:'2026-01-01',feedback:[{id:1,comments:'Synthetic feedback',decision:'Revision Required',createdAt:'2026-01-02'}]}]}}
export async function getAdviserDashboard(){return {email:'synthetic@example.invalid',totalGroups:3,pending:window.__pending??2,reviewed:1,attention:window.__pending===0?[]:[{id:1,researchTitle:'Synthetic research',groupName:'Synthetic group',version:'v1',status:'Under Review',submittedAt:new Date('2026-01-01')}],groups:[{id:1,groupName:'Synthetic group',strand:'STEM',section:'A',memberCount:3,projectCount:1}]}}
export async function getAdminDashboardStats(){return {success:true,data:{totalUsers:12,totalGroups:3,totalResearchPapers:5,totalPublishedPapers:2,totalStudents:8,totalAdvisers:3,usersByRole:[{role:'Student',count:8}],papersByStatus:[{status:'Approved',count:2}]}}}
export async function getAdminRecentActivities(){return {success:true,data:[]}}
export async function getPublishedResearch(){return {items:[{paperId:1,title:window.__title,groupName:'Synthetic group',strand:'STEM',schoolYear:'2026',abstract:'Synthetic abstract'}],total:1,page:1,pageCount:1}}
export async function getPublishedResearchFilterOptions(){return {categories:[],schoolYears:[],strands:[]}}
export async function getRepositoryManagementResult(){return window.__management}
export async function getGuideQuestions(){return {success:true,questions:[{id:'synthetic',question:'Synthetic guide question'}]}}
`;
const actions = `
const refuse=async()=>{window.__writes++;return {success:false,message:'Synthetic denied action'}};
export const changeUserRoleAction=refuse,changeUserStatusAction=refuse,createManagedAccountAction=refuse,changeResearchGroupStatusAction=refuse;
export const recordAIEligibilityAction=refuse,recordAIConsentAction=refuse,createAdviserFeedbackAction=refuse,startSubmissionReviewAction=refuse,createStudentResearchAction=refuse;
export const initiateSubmissionUploadAction=refuse,renewSubmissionUploadAction=refuse,getSubmissionUploadStatusAction=refuse,cancelSubmissionUploadAction=refuse,finalizeSubmissionUploadAction=refuse;
export const getRepositoryDocumentUrlAction=refuse,logoutAction=refuse;
async function publication(data){window.__writes++;window.__publicationCalls.push(Object.fromEntries(data));return new Promise(resolve=>{window.__resolvePublication=resolve})}
export async function publishRepositoryPaperAction(previous,data){return publication(data)}
export async function updateRepositoryPublicationAction(previous,data){return publication(data)}
export const markNotificationAsReadAction=refuse,markAllNotificationsAsReadAction=refuse;
export async function getNotificationPreviewAction(){return {success:true,data:{unreadCount:0,recent:[]}}}
export async function getEligibilityUIAction(){return {available:false}}
export async function getConsentUIAction(){return {available:false}}
export async function getSubmissionDownloadUrlAction(id,purpose){window.__signs.push({id,purpose});return 'https://pdf.invalid/synthetic'}
export const getLocalAdminAssistanceAction=refuse,getLocalAdviserAssistanceAction=refuse;
export const assignWorkspaceTaskAction=refuse,createWorkspaceTaskAction=refuse,deleteWorkspaceTaskAction=refuse,editWorkspaceTaskAction=refuse,updateWorkspaceTaskStatusAction=refuse;
export const createWorkspaceNoteAction=refuse,deleteWorkspaceNoteAction=refuse,editWorkspaceNoteAction=refuse,getWorkspaceNoteAction=refuse,linkWorkspaceNoteAction=refuse,restoreWorkspaceNoteAction=refuse;
export async function getGuideAnswerAction(){return {success:true,message:'Synthetic static answer',topic:{question:'Synthetic guide question',answer:'Synthetic workflow guidance',links:[{href:'/dashboard/repository?search=synthetic#results',label:'Browse synthetic research'}]}}}
`;

async function main() {
    const artifacts = fs.mkdtempSync(join(tmpdir(), 'thesishs-batchb-'));
    const bundle = await build({ write: false, outfile: 'batchb.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
        stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';import{createRoot}from'react-dom/client';
import Repository from './app/dashboard/repository/[paperId]/page';
import Review from './app/dashboard/adviser/submissions/[submissionId]/page';
import StudentDashboard from './app/dashboard/student/page';import AdviserDashboard from './app/dashboard/adviser/page';import AdminDashboard from './app/dashboard/admin/page';
import RepositoryList from './app/dashboard/repository/page';import Guide from './app/dashboard/guide/page';import Settings from './app/dashboard/settings/page';import Reports from './app/dashboard/admin/reports/page';
import Publication from './app/dashboard/admin/repository/page';
import AdviserSubmissions from './components/dashboard/adviser-submissions';import DashboardHeader from './components/dashboard/dashboard-header';
import Users from './components/dashboard/admin-users';import Groups from './components/dashboard/admin-groups';
import StudentResearch from './components/dashboard/student-research';
import StudentGroupWorkspace from './components/dashboard/student-group-workspace';
import Shell from './components/dashboard/dashboard-shell';import{dashboardLinks}from'./lib/constants/dashboard-navigation';
import NotificationProvider from './components/dashboard/notification-provider';import{ThemeProvider}from'./components/theme-provider';
const root=createRoot(document.getElementById('root'));let generation=0;
window.__views=0;window.__writes=0;window.__signs=[];window.__path='/dashboard/repository/1';window.__profile='browser';
window.__title='Synthetic research '+('Long research title examining student research accessibility ').repeat(3);
function WorkspaceFixture(){
const [selection,setSelection]=React.useState({id:1,tab:'tasks'});
React.useEffect(()=>{window.__workspaceNavigate=href=>{const url=new URL(href,location.origin);setSelection({id:Number(url.searchParams.get('project')??1),tab:url.searchParams.get('tab')??'tasks'})};return()=>{window.__workspaceNavigate=null}},[]);
const projects=[{id:1,title:'Synthetic project Alpha'},{id:2,title:'Synthetic project Beta'}];
return <main><DashboardHeader title='Group Workspace' email='synthetic@example.invalid'/><StudentGroupWorkspace projects={projects} project={projects.find(p=>p.id===selection.id)} invalidProject={false} tab={selection.tab} deletedOnly={false} board={{success:true,kind:'success',data:{tasks:[],members:[]}}} notes={{success:true,kind:'success',data:{notes:[],tasks:[]}}}/></main>
}
window.render=async(kind,data={},profile='browser',preserve=false)=>{
window.__role=['admin-dashboard','users','groups','settings','reports','publication'].includes(kind)?1:['adviser-dashboard','review','adviser-submissions'].includes(kind)?2:3;
window.__profile=profile;window.__path=({'student-dashboard':'/dashboard/student','adviser-dashboard':'/dashboard/adviser','admin-dashboard':'/dashboard/admin',users:'/dashboard/admin/users',groups:'/dashboard/admin/groups',settings:'/dashboard/settings',reports:'/dashboard/admin/reports',guide:'/dashboard/guide','repository-list':'/dashboard/repository',publication:'/dashboard/admin/repository','adviser-submissions':'/dashboard/adviser/submissions',review:'/dashboard/adviser/submissions/1',student:'/dashboard/student/submissions',workspace:'/dashboard/student/workspace'})[kind]??'/dashboard/repository/1';
let node;
if(kind==='publication'){window.__management=data;node=await Publication();window.__refreshPublication=()=>window.render('publication',window.__management,window.__profile,true)}
else if(kind==='student-dashboard')node=await StudentDashboard();
else if(kind==='adviser-dashboard'||kind==='admin-dashboard'){const boundary=await (kind==='adviser-dashboard'?AdviserDashboard():AdminDashboard());node=await boundary.props.children.type(boundary.props.children.props)}
else if(kind==='repository-list')node=await RepositoryList({searchParams:Promise.resolve({})});
else if(kind==='guide')node=await Guide();
else if(kind==='settings')node=await Settings();
else if(kind==='reports')node=await Reports();
else if(kind==='workspace')node=<WorkspaceFixture/>;
else if(kind==='adviser-submissions')node=<main><DashboardHeader title='Research Submissions' email='synthetic@example.invalid'/><AdviserSubmissions submissions={data.submissions??[{id:1,paperId:1,researchTitle:'Synthetic research',groupName:'Synthetic group',version:'v1',status:'Submitted',submittedAt:'2026-01-01'}]}/></main>;
else node=kind==='repository'?await Repository({params:Promise.resolve({paperId:'1'})}):kind==='review'?await Review({params:Promise.resolve({submissionId:'1'})}):kind==='users'?<main><DashboardHeader title='User Management' email='synthetic@example.invalid'/><Users users={data.users} actorId={1}/></main>:kind==='groups'?<main><DashboardHeader title='Research Groups' email='synthetic@example.invalid'/><Groups groups={data.groups}/></main>:<main><StudentResearch workspace={{email:'synthetic@example.invalid',groups:[{id:1,groupName:'Synthetic group'}],projects:[{id:1,groupId:1,title:window.__title,abstract:'Synthetic abstract',status:'Revision Required'}],submissions:[{id:1,paperId:1,version:'v1',status:'Revision Required',submittedAt:'2026-01-01',remarks:'Synthetic remarks',feedback:[]}]}} target={{}}/></main>;
root.render(<ThemeProvider key={preserve?generation:++generation}><NotificationProvider historyHref='/dashboard/student/notifications'><Shell links={dashboardLinks(window.__role)}>{node}</Shell></NotificationProvider></ThemeProvider>);
};` },
        plugins: [{ name: 'batchb-fixtures', setup(b) {
            b.onResolve({ filter: /^@\/lib\/actions\// }, () => ({ path: 'actions', namespace: 'fixture' }));
            b.onResolve({ filter: /^@\/lib\/(?:services\/|auth\/authorization$)/ }, () => ({ path: 'services', namespace: 'fixture' }));
            b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
            b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'fixture' }));
            b.onResolve({ filter: /(?:^@\/lib\/pwa\/|^\.\/)use-display-mode$/ }, () => ({ path: 'display', namespace: 'fixture' }));
            b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ resolveDir: process.cwd(), loader: 'tsx', contents: args.path === 'actions' ? actions : args.path === 'services' ? services : args.path === 'navigation' ?
                `export function usePathname(){return window.__path} export function useRouter(){return {async refresh(){window.__refreshes=(window.__refreshes??0)+1;if(window.__holdRefresh)await new Promise(resolve=>{window.__resolveRefresh=resolve});await window.__refreshPublication?.()},push(href){window.__navigation=href;window.__workspaceNavigate?.(href)},replace(href){window.__navigation=href}}}export function notFound(){throw Error('Synthetic missing route')}export function redirect(){throw Error('Unexpected synthetic redirect')}` : args.path === 'display' ?
                    `export function useDisplayMode(){return window.__profile==='unknown'?'unknown':['mobile','desktop','standalone-unknown'].includes(window.__profile)?'standalone':'browser'}export function usePwaPlatform(){return ['unknown','standalone-unknown'].includes(window.__profile)?'unknown':window.__profile==='mobile'?'android':'desktop'}` :
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
        if (process.argv.includes('--publication')) {
            await publicationChecks(page, render, theme, artifacts, visualChecks);
            assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
            console.log(JSON.stringify({ result: 'PASS', scope: 'P4B synthetic publication UI only', artifacts, limits: 'Mocked display signals, services, actions and refresh; no real account, database, Storage, hosted or installed-device acceptance' }));
            return;
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
            await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: join(artifacts, `repository-${width}-${appearance}.png`), fullPage: true });
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
        async function visualChecks() {
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No horizontal page overflow');
            const contrastFailures = await page.locator('main').evaluate(root => {
                const lum = color => { const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => (v /= 255) <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; };
                return [...root.querySelectorAll('h1,h2,a[class*="context-"],.academic-status,.dashboard-metrics dt,.dashboard-metrics dd,#publication-details h3,#publication-details p,#publication-details dt,#publication-details dd,#publication-details button,#repository-directory h3,#repository-directory p,#repository-directory button')].flatMap(el => {
                    if (!el.getClientRects().length || el.closest('[hidden]') || !el.textContent.trim()) return [];
                    const style = getComputedStyle(el); let parent = el, bg = style.backgroundColor;
                    while (bg === 'rgba(0, 0, 0, 0)' && parent.parentElement) { parent = parent.parentElement; bg = getComputedStyle(parent).backgroundColor; }
                    const [high, low] = [lum(style.color), lum(bg)].sort((a, b) => b - a);
                    const required = parseFloat(style.fontSize) >= 24 || parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700 ? 3 : 4.5;
                    return (high + .05) / (low + .05) < required ? [el.textContent.slice(0, 70)] : [];
                });
            });
            assert.deepEqual(contrastFailures, []);
            const contentLinks = page.locator('main a[class*="context-"]');
            for (let i = 0; i < await contentLinks.count(); i++) {
                const link = contentLinks.nth(i); await link.scrollIntoViewIfNeeded();
                assert.ok((await link.boundingBox()).height >= 43, 'Contextual link retains a 44px hit area');
                await page.keyboard.press('Tab'); await link.focus();
                assert.ok(await link.evaluate(el => el.matches(':focus-visible') && parseFloat(getComputedStyle(el).outlineWidth) >= 3));
                const prior = await link.evaluate(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor, decoration: getComputedStyle(el).textDecorationLine }));
                await link.hover();
                assert.ok(await link.evaluate((el, prior) => { const current = getComputedStyle(el); return current.color !== prior.color || current.backgroundColor !== prior.background || current.textDecorationLine !== prior.decoration; }, prior), 'Hover affordance is visible');
            }
        }
        for (const kind of ['student-dashboard', 'adviser-dashboard', 'admin-dashboard']) for (const width of [360, 390, 1280]) for (const appearance of ['Light', 'Dark']) {
            await page.setViewportSize({ width, height: 800 }); await render(kind); await theme(appearance); await visualChecks();
            if (kind === 'student-dashboard') {
                const banner = await page.getByRole('complementary', { name: 'Optional email verification' }).boundingBox();
                const card = await page.locator('main section.dashboard-panel').first().boundingBox();
                assert.ok(card.y - banner.y - banner.height >= 16 && card.y - banner.y - banner.height <= 24, 'Verification notice has 16–24px separation');
                await expect(page.getByRole('link', { name: 'View Full Feedback', exact: true })).toHaveAttribute('href', '/dashboard/student/submissions?project=1&submission=1&feedback=1#feedback-1');
                assert.equal(await page.getByRole('link', { name: 'Check email verification' }).evaluate(el => getComputedStyle(el).textDecorationLine), 'underline');
            } else {
                const expected = kind === 'adviser-dashboard' ? ['3', '2', '1'] : ['12', '3', '5', '2'];
                assert.deepEqual(await page.locator('.dashboard-metrics > div > dd:first-of-type').allTextContents(), expected);
                assert.ok(await page.locator('.dashboard-metrics dd').first().evaluate(el => getComputedStyle(el).fontVariantNumeric.includes('tabular-nums')));
            }
            if (width === 1280) {
                const toggle = page.getByRole('button', { name: 'Collapse sidebar', exact: true }); await toggle.click(); await expect(page.locator('[data-sidebar-mode="compact"]')).toHaveCount(1);
                await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
            } else {
                const menu = page.getByRole('button', { name: 'Open navigation menu', exact: true }); await menu.click(); await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).toBeVisible(); await page.keyboard.press('Escape'); await expect(menu).toBeFocused();
            }
            if (width === 390 && appearance === 'Dark' || width === 1280 && appearance === 'Light') { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: join(artifacts, `${kind}-${width}-${appearance}.png`), fullPage: true }); }
        }
        for (const kind of ['repository-list', 'guide', 'settings', 'reports', 'adviser-submissions']) for (const [width, appearance] of [[390, 'Light'], [1280, 'Dark']]) {
            await page.setViewportSize({ width, height: 800 }); await render(kind); await theme(appearance);
            if (kind === 'guide') { await page.getByRole('button', { name: 'Synthetic guide question', exact: true }).click(); await expect(page.getByRole('link', { name: 'Browse synthetic research' })).toHaveAttribute('href', '/dashboard/repository?search=synthetic#results'); }
            if (kind === 'settings') { await expect(page.getByRole('heading', { name: 'App Installation', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: /Enable.*notification/i })).toHaveCount(0); }
            if (kind === 'adviser-submissions') await expect(page.getByRole('link', { name: 'View Details: Synthetic research, v1' })).toHaveAttribute('href', '/dashboard/adviser/submissions/1');
            await visualChecks();
        }
        // Targeted B.4 corrections: role-specific positive priority and measured local spacing.
        for (const width of [360, 390]) for (const appearance of ['Light', 'Dark']) {
            await page.setViewportSize({ width, height: 800 });
            for (const pending of [0, 1]) {
                await page.evaluate(value => { window.__pending = value; }, pending); await render('adviser-dashboard'); await theme(appearance);
                const priority = page.locator('.dashboard-metrics > div').filter({ has: page.getByText('Pending Reviews', { exact: true }) });
                const ordinary = page.locator('.dashboard-metrics > div').filter({ has: page.getByText('My Research Groups', { exact: true }) });
                assert.equal(await priority.getAttribute('data-priority'), pending ? 'pending' : null); assert.equal(await ordinary.getAttribute('data-priority'), null);
                const colors = await priority.evaluate(el => { const style = getComputedStyle(el); return [style.borderTopColor, style.backgroundColor]; });
                const neutral = await ordinary.evaluate(el => { const style = getComputedStyle(el); return [style.borderTopColor, style.backgroundColor]; });
                if (pending === 0) assert.deepEqual(colors, neutral); else assert.notDeepEqual(colors, neutral);
                await expect(priority.locator('dd').first()).toHaveText(String(pending)); await visualChecks();
            }
            await page.evaluate(() => { delete window.__pending; });
            for (const statuses of [[], ['Submitted', 'Under Review', 'Approved']]) {
                const submissions = statuses.map((status, index) => ({ id: index + 1, paperId: index + 1, researchTitle: `Synthetic ${status}`, groupName: 'Synthetic group', version: 'v1', status, submittedAt: '2026-01-01' }));
                await render('adviser-submissions', { submissions }); await theme(appearance);
                assert.equal(await page.locator('[data-priority="pending"]').count(), statuses.length ? 2 : 0);
                const reviewed = page.locator('.dashboard-metrics > div').filter({ has: page.getByText('Reviewed', { exact: true }) });
                assert.equal(await reviewed.getAttribute('data-priority'), null); await visualChecks();
            }
            await render('workspace', {}, 'mobile'); await theme(appearance);
            const select = page.getByLabel('Research project', { exact: true });
            const label = page.locator('label[for="workspace-project"]'), tabs = page.getByRole('tablist', { name: 'Group workspace' });
            const task = page.getByRole('button', { name: 'New Task', exact: true });
            const lb = await label.boundingBox(), sb = await select.boundingBox(), tb = await tabs.boundingBox(), ab = await task.boundingBox();
            const gaps = { labelToSelector: sb.y - lb.y - lb.height, selectorToTabs: tb.y - sb.y - sb.height, tabsToAction: ab.y - tb.y - tb.height };
            assert.ok(gaps.labelToSelector >= 8 && gaps.labelToSelector <= 12); assert.ok(gaps.selectorToTabs >= 12 && gaps.selectorToTabs <= 16); assert.ok(gaps.tabsToAction >= 16 && gaps.tabsToAction <= 20);
            await select.selectOption('2'); await expect(select).toHaveValue('2'); await expect(page.getByRole('tab', { name: 'Tasks', exact: true })).toHaveAttribute('aria-selected', 'true');
            await task.click(); await expect(page.getByRole('dialog', { name: 'New Task', exact: true })).toBeVisible(); await page.keyboard.press('Escape'); await expect(task).toBeFocused();
            const notes = page.getByRole('tab', { name: 'Notes', exact: true }); await notes.click(); await expect(notes).toHaveAttribute('aria-selected', 'true'); await expect(notes).toBeFocused();
            await select.selectOption('1'); await expect(select).toHaveValue('1'); await expect(notes).toHaveAttribute('aria-selected', 'true'); await expect(page.getByRole('button', { name: 'New Note', exact: true })).toBeVisible();
            await notes.focus(); await page.keyboard.press('ArrowLeft'); const tasks = page.getByRole('tab', { name: 'Tasks', exact: true }); await expect(tasks).toBeFocused(); await page.keyboard.press('Enter'); await expect(tasks).toHaveAttribute('aria-selected', 'true');
            await task.scrollIntoViewIfNeeded(); await task.click(); await page.keyboard.press('Escape'); await expect(task).toBeFocused(); await visualChecks();
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            const lastTaskText = await page.getByText('No tasks completed yet.', { exact: true }).boundingBox();
            const bottomNav = await page.getByRole('navigation', { name: 'Primary dashboard pages', exact: true }).boundingBox();
            assert.ok(lastTaskText.y + lastTaskText.height <= bottomNav.y, 'End of workspace content clears fixed mobile navigation');
            await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: join(artifacts, `workspace-${width}-${appearance}.png`), fullPage: true });
            observations.push({ check: 'B.4 spacing/priority', width, appearance, gaps, result: 'Zero neutral; positive Adviser review counts accented; ordinary counts neutral; project/tab/New Task/focus preserved' });
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
            page.once('dialog', d => d.accept()); await page.getByRole('link', { name: 'Back to Submissions' }).click(); assert.equal(await page.evaluate(() => window.__navigation), '/dashboard/adviser/submissions');
            observations.push({ check: 'B.3', width, height, profile, frameHeight, result: 'No blocked access: page scroll reaches PDF actions and feedback' });
            await page.screenshot({ path: join(artifacts, `review-${width}-${height}.png`), fullPage: true });
        }
        // Actual Student upload and long project dialogs, with no file transfers or action calls.
        for (const [width, height] of [[360, 560], [390, 340]]) {
            await page.setViewportSize({ width, height }); await render('student', {}, 'mobile');
            await visualChecks();
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
        console.log(JSON.stringify({ result: 'PASS', visualCoverage: 'Three role dashboards at 360/390/1280 Light/Dark; Repository/Guide/Settings/Reports/Adviser submissions at 390 Light and 1280 Dark; AA contrast, 44px links, focus/hover, sidebar/drawer, exact destinations and statistics; preserved repository heading and Admin live regions', observations, artifacts, limits: 'Synthetic Chromium; no real PDF, hosted calls, screen-reader speech, physical safe area or software keyboard' }));
    } finally { await browser.close(); }
}
async function publicationChecks(page, render, theme, artifacts, visualChecks) {
    const ready = { paperId: 101, title: 'Synthetic ready research', groupName: 'Synthetic Alpha', createdAt: '2026-11-01' };
    const published = { id: 202, paperId: 102, title: 'Synthetic published research', groupName: 'Synthetic Beta', isPublished: true, publishedAt: '2026-11-02' };
    const hidden = { id: 203, paperId: 103, title: 'Synthetic hidden research', groupName: 'Synthetic Gamma', isPublished: false, publishedAt: null };
    const data = { success: true, data: { eligiblePapers: [ready], repositoryEntries: [published, hidden] } };
    const details = page.getByRole('region', { name: 'Publication details', exact: true });
    const inspect = title => page.getByRole('button', { name: `Inspect ${title}`, exact: true });
    const action = label => details.getByRole('button', { name: label, exact: true });
    async function fits() {
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        for (const selector of ['#repository-directory', '#publication-details']) {
            assert.ok(await page.locator(selector).evaluate(el => el.scrollWidth <= el.clientWidth + 1));
        }
    }
    await page.evaluate(() => { window.__publicationCalls = []; });
    // Desktop gate and unchanged browser/mobile/unknown controls.
    for (const [profile, width] of [['browser', 1280], ['mobile', 360], ['unknown', 1280], ['standalone-unknown', 1280]]) {
        await page.setViewportSize({ width, height: 800 }); await render('publication', data, profile);
        await expect(details).toHaveCount(0); await expect(inspect(ready.title)).toHaveCount(0);
        await page.getByRole('button', { name: `Publish ${ready.title}`, exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: `Publish ${ready.title}`, exact: true })).toBeFocused();
        assert.equal(await page.evaluate(() => window.__writes), 0);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    for (const [width, appearance] of [[1440, 'Light'], [760, 'Dark'], [360, 'Dark']]) {
        await page.setViewportSize({ width, height: 800 }); await render('publication', data, 'desktop'); await theme(appearance);
        await expect(details).toBeVisible(); await expect(details).toContainText('Select Inspect');
        await inspect(ready.title).focus(); await page.keyboard.press('Space');
        await expect(inspect(ready.title)).toHaveAttribute('aria-pressed', 'true'); await expect(inspect(ready.title)).toBeFocused();
        assert.ok(await inspect(ready.title).evaluate(el => el.matches(':focus-visible') && getComputedStyle(el).outlineStyle !== 'none'));
        await expect(page.getByRole('dialog')).toHaveCount(0); await expect(details).toContainText(ready.groupName);
        await expect(details.locator('dd')).toHaveText([ready.groupName, 'Ready', 'Nov 1, 2026']);
        await expect(action(`Publish ${ready.title}`)).toBeEnabled();
        const directoryBox = await page.locator('#repository-directory').boundingBox(), detailBox = await details.boundingBox();
        assert.equal(detailBox.x > directoryBox.x + directoryBox.width, width === 1440);
        if (width === 1440) {
            await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click(); await fits();
            await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
        }
        await fits(); await visualChecks(); await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: join(artifacts, `publication-${width}-${appearance}.png`), fullPage: true });
    }
    assert.equal(await page.evaluate(() => window.__writes), 0);
    await page.getByRole('button', { name: 'Repository Entries', exact: true }).click(); await expect(details).toContainText('Select Inspect');
    await inspect(published.title).click(); await expect(details.locator('dd')).toHaveText([published.groupName, 'Published', 'Nov 2, 2026']);
    await expect(action(`Unpublish ${published.title}`)).toBeEnabled();
    await page.getByLabel('Repository visibility', { exact: true }).selectOption('hidden');
    await expect(details).toContainText('Select Inspect'); await expect(action(`Unpublish ${published.title}`)).toHaveCount(0);
    await inspect(hidden.title).click(); await expect(details.locator('dd')).toHaveText([hidden.groupName, 'Hidden']);
    await expect(action(`Republish ${hidden.title}`)).toBeEnabled();
    // Refreshed props remove a selected row without retaining actionable details.
    await page.evaluate(value => window.render('publication', value, 'desktop', true), { success: true, data: { eligiblePapers: [], repositoryEntries: [] } });
    await expect(details).toContainText('no longer available'); await expect(details.getByRole('button')).toHaveCount(0);
    await expect(page.getByText('No repository entries have been created.')).toBeVisible();
    await page.getByRole('button', { name: 'Ready to Publish', exact: true }).click();
    await expect(page.getByText('No eligible research is ready to publish.')).toBeVisible();
    // Exact ID contracts, mandatory confirmation, pending lock, successful refresh and focus.
    for (const [record, label, expected] of [[ready, 'Publish', { paperId: '101' }], [published, 'Unpublish', { repositoryId: '202', publish: 'false' }], [hidden, 'Republish', { repositoryId: '203', publish: 'true' }]]) {
        await render('publication', data, 'desktop');
        if (label !== 'Publish') await page.getByRole('button', { name: 'Repository Entries', exact: true }).click();
        await inspect(record.title).click(); await action(`${label} ${record.title}`).click();
        const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(action(`${label} ${record.title}`)).toBeFocused();
        await action(`${label} ${record.title}`).click();
        await dialog.getByRole('button', { name: `Confirm ${label.toLowerCase()}`, exact: true }).click();
        await expect(dialog.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
        await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
        assert.deepEqual(await page.evaluate(() => window.__publicationCalls.at(-1)), expected);
        // No real writes: the fixture supplies a changed server payload and delayed refresh.
        await page.evaluate(() => { window.__holdRefresh = true; window.__management = { success: true, data: { eligiblePapers: [], repositoryEntries: [] } }; window.__resolvePublication({ success: true, message: 'Synthetic publication saved.' }); });
        await expect(dialog).toHaveCount(0); await expect(page.getByText('Updating repository management...')).toBeVisible();
        await expect(page.locator('#repository-directory')).toHaveAttribute('aria-busy', 'true');
        await expect(page.locator('#repository-directory-heading')).toBeFocused();
        await inspect(record.title).click(); await expect(action(`${label} ${record.title}`)).toBeDisabled();
        await page.evaluate(() => { window.__holdRefresh = false; window.__resolveRefresh(); });
        await expect(details).toContainText('no longer available'); await expect(details.getByRole('button')).toHaveCount(0);
        await expect(page.getByText('Synthetic publication saved.', { exact: true })).toBeVisible();
    }
    // Controlled failure stays retryable; uncertainty locks dialog and all publication controls.
    await render('publication', data, 'desktop'); await inspect(ready.title).click(); await action(`Publish ${ready.title}`).click();
    await page.getByRole('button', { name: 'Confirm publish', exact: true }).click();
    await page.evaluate(() => window.__resolvePublication({ success: false, message: 'Synthetic unavailable document.' }));
    await expect(page.getByText('Synthetic unavailable document.')).toBeVisible(); await expect(page.getByRole('button', { name: 'Confirm publish', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Confirm publish', exact: true }).click();
    await page.evaluate(() => window.__resolvePublication({ success: false, uncertain: true, message: 'Synthetic uncertain result.' }));
    await expect(page.getByRole('button', { name: 'Confirm publish', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(action(`Publish ${ready.title}`)).toBeDisabled();
    await expect(page.getByRole('alert').filter({ hasText: 'Changes are paused' })).toBeVisible();
    await render('publication', { success: false, message: 'Synthetic management unavailable.' }, 'desktop');
    await expect(page.getByRole('alert')).toHaveText('Synthetic management unavailable.'); await expect(details).toHaveCount(0);
    assert.equal(await page.evaluate(() => window.__refreshes), 3);
    assert.equal(await page.evaluate(() => window.__writes), 5);
    assert.equal(await page.evaluate(() => window.__views), 0);
    assert.equal(await page.evaluate(() => window.__navigation ?? null), null);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
