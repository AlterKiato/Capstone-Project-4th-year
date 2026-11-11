/* eslint-disable @typescript-eslint/no-require-imports */
// Actual Student UI with synthetic service/action boundaries. No server, database, Storage or hosted requests.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { build } = require('esbuild'), { chromium, expect } = require('@playwright/test');
async function main() {
    const out = 'test-results/ui-s1.1'; fs.mkdirSync(out, { recursive: true });
    const formatted = '\u001eTHESISHS_FEEDBACK:1\n' + JSON.stringify({ version: 1, blocks: [
        { type: 'paragraph', content: [{ text: 'Synthetic complete feedback. ', bold: true, italic: true, underline: true }] },
        ...Array.from({ length: 30 }, (_, i) => ({ type: 'paragraph', content: [{ text: `Paragraph ${i}: explain the research method and preserve the complete official comments. <img src=x onerror=alert(1)>` }] })),
        { type: 'bulletList', items: [[{ text: 'Preserved bullet' }]] }, { type: 'numberList', items: [[{ text: 'FINAL_PRESERVED_MARKER' }]] },
    ] });
    const bundle = await build({ write: false, outfile: 'student.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
        stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';import{createRoot}from'react-dom/client';import Dashboard from './app/dashboard/student/page';import Submissions from './app/dashboard/student/submissions/page';import Workspace from './components/dashboard/student-group-workspace';import{ThemeProvider}from './components/theme-provider';import shell from './components/dashboard/dashboard-shell.module.css';
const root=createRoot(document.getElementById('root'));let generation=0;
window.render=async()=>{const m=window.model,q=Object.fromEntries(new URLSearchParams(location.search)),p=m.workspace.projects.find(p=>p.id===Number(q.project))??m.workspace.projects[0];
 const content=location.pathname.endsWith('/workspace')?<main className='dashboard-page'><h1>Group Workspace</h1><Workspace projects={m.workspace.projects} project={p??null} invalidProject={false} tab={q.tab==='notes'?'notes':'tasks'} deletedOnly={false} board={{success:true,kind:'success',data:{tasks:m.tasks.filter(t=>t.paperId===p?.id),members:[]}}} notes={{success:true,kind:'success',data:{notes:[],tasks:[]}}}/></main>:await(location.pathname.endsWith('/submissions')?Submissions:Dashboard)({searchParams:Promise.resolve(q)});
 root.render(<ThemeProvider><div className={shell.shell}><div className={shell.content}><React.Fragment key={++generation}>{content}</React.Fragment></div></div></ThemeProvider>);};window.render();
` }, plugins: [{ name: 'isolated-student-ui', setup(b) {
            b.onResolve({ filter: /^@\/lib\/actions\// }, () => ({ path: 'actions', namespace: 'fixture' }));
            b.onResolve({ filter: /^@\/lib\/services\// }, () => ({ path: 'services', namespace: 'fixture' }));
            b.onResolve({ filter: /^next\/(navigation|link)$/ }, a => ({ path: a.path, namespace: 'fixture' }));
            b.onResolve({ filter: /^\.\/notification-bell$/ }, () => ({ path: 'bell', namespace: 'fixture' }));
            b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ loader: 'tsx', resolveDir: process.cwd(), contents: a.path === 'next/link'
                ? `import React from'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`
                : a.path === 'next/navigation' ? `export const useRouter=()=>({refresh(){window.render()},push(href){location.href=href},replace(href){location.href=href}});`
                : a.path === 'bell' ? `export default function Bell(){return null}`
                : a.path === 'services' ? `export async function getStudentWorkspace(){return window.model.workspace}export async function getCurrentStudentVerificationStatus(){return {verified:true}}`
                : `
const date='2026-11-11T01:00:00Z',rich=${JSON.stringify(formatted)};
const task=(id,paperId,status)=>({id,paperId,title:'Synthetic task '+id,description:'Short task description with additional details.',status,dueDate:'2026-11-30',createdBy:3,assignedStudentId:3,createdAt:date,updatedAt:date,creator:{name:'Synthetic creator',eligible:true},assignee:{name:'Synthetic assignee',eligible:true},permissions:{edit:false,assign:false,status:false,delete:false,recovery:false}});
window.model={calls:[],reads:[],delay:0,failTasks:false,tasks:[task(1,10,'To Do'),task(2,10,'To Do'),task(3,10,'Done'),task(4,20,'In Progress')],workspace:{email:'student@example.invalid',groups:[{id:1,groupName:'Synthetic group',members:[]}],projects:[{id:10,groupId:1,title:'Synthetic research A',abstract:'Preserved project abstract.',keywords:'Research',category:'Qualitative',status:'Revision Required'},{id:20,groupId:1,title:'Synthetic research B',abstract:'Second project',status:'Draft'}],submissions:Array.from({length:5},(_,i)=>({id:i+1,paperId:10,version:'v'+(i+1),submittedAt:date,status:i===4?'Under Review':'Revision Required',remarks:'Preserved version remarks '+(i+1),feedbackRestricted:i===1,feedbackUnavailable:i===2,feedback:i===3?[{id:44,comments:rich,decision:'Revision Required',createdAt:date}]:[]}))}};
window.model.workspace.submissions.reverse();
export async function listWorkspaceTasksAction({paperId}){const m=window.model,rows=structuredClone(m.tasks.filter(t=>t.paperId===paperId)),fail=m.failTasks;m.reads.push(['tasks',paperId]);if(m.delay)await new Promise(r=>setTimeout(r,m.delay));return fail?{success:false,kind:'unavailable',message:'Workspace access unavailable.'}:{success:true,kind:'success',message:'Loaded',data:rows};}
export async function readResearchProgressAction({paperId}){window.model.reads.push(['progress',paperId]);if(window.model.delay)await new Promise(r=>setTimeout(r,window.model.delay));return {success:true,data:{canManage:false,today:'2026-11-11',submissions:[],milestones:paperId===10?[{id:1,paperId,title:'Synthetic milestone',dueDate:'2026-11-30',submissionId:4,verifiedBy:null,verifiedAt:null,revision:0,evidence:{id:4,version:'v4',status:'Revision Required'}}]:[]}};}
export async function readRevisionsAction({paperId}){window.model.reads.push(['revisions',paperId]);if(window.model.delay)await new Promise(r=>setTimeout(r,window.model.delay));return {success:true,data:{canManage:false,cycles:paperId===10?[{feedbackId:44,submissionId:4,version:'v4',editable:true,items:[{id:1,position:0,correction:'Synthetic correction',responses:[]}]}]:[]}};}
export async function getSubmissionDownloadUrlAction(id){window.model.calls.push(['pdf',id]);return null;}
const forbidden=async()=>{window.model.calls.push(['unexpected mutation']);throw Error('Unexpected mutation')};
export const createStudentResearchAction=forbidden,respondToRevisionAction=forbidden,mutateResearchProgressAction=forbidden,createWorkspaceTaskAction=forbidden,editWorkspaceTaskAction=forbidden,assignWorkspaceTaskAction=forbidden,updateWorkspaceTaskStatusAction=forbidden,deleteWorkspaceTaskAction=forbidden,createWorkspaceNoteAction=forbidden,editWorkspaceNoteAction=forbidden,linkWorkspaceNoteAction=forbidden,deleteWorkspaceNoteAction=forbidden,restoreWorkspaceNoteAction=forbidden,getWorkspaceNoteAction=forbidden,initiateSubmissionUploadAction=forbidden,renewSubmissionUploadAction=forbidden,getSubmissionUploadStatusAction=forbidden,cancelSubmissionUploadAction=forbidden,finalizeSubmissionUploadAction=forbidden;
` }));
        } }] });
    const css = '@layer base {' + fs.readFileSync('node_modules/tailwindcss/preflight.css', 'utf8') + '}\n' + fs.readFileSync('app/globals.css', 'utf8').replace(/^@import.*$/m, '') + '\n' + bundle.outputFiles.find(f => f.path.endsWith('.css')).text;
    const js = bundle.outputFiles.find(f => f.path.endsWith('.js')).text;
    const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] }), errors = [], unexpected = [], evidence = [];
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: true });
        const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        await page.route('**/*', route => route.request().url().startsWith('http://ui-s1.invalid/') ? route.fulfill({ contentType: 'text/html', body: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>` }) : (unexpected.push(route.request().url()), route.abort()));
        await page.goto('http://ui-s1.invalid/dashboard/student?project=10');
        const workspace = page.getByRole('region', { name: 'Group Workspace', exact: true });
        await expect(workspace.getByText('To Do', { exact: true })).toBeVisible();
        await expect(workspace.locator('dd')).toHaveText(['2', '0', '1']);
        await expect(page.getByText('0 / 1 completed', { exact: true })).toBeVisible();
        await expect(page.getByText('0 / 1 Addressed', { exact: true })).toBeVisible();
        for (const label of ['Research Group', 'Latest Feedback', 'Research Progress', 'Revision Checklist', 'Group Workspace']) {
            const heading = page.getByRole('heading', { name: label, exact: true });
            await expect(heading.locator('svg')).toHaveAttribute('width', '18');
            await expect(heading.locator('svg')).toHaveAttribute('aria-hidden', 'true');
        }
        await page.getByLabel('Research project', { exact: true }).selectOption('20');
        await expect(workspace.locator('dd')).toHaveText(['0', '1', '0']);
        await expect(page.getByRole('region', { name: 'Research Progress', exact: true }).getByText('Milestones not configured.', { exact: true })).toBeVisible();
        await expect(page.getByRole('region', { name: 'Revision Checklist', exact: true }).getByText('No revision items yet.', { exact: true })).toBeVisible();
        await expect(workspace.getByRole('link')).toHaveAttribute('href', '/dashboard/student/workspace?project=20&tab=tasks');
        await page.evaluate(() => { window.model.delay = 150; });
        await page.getByLabel('Research project', { exact: true }).selectOption('10');
        await expect(workspace.getByRole('status')).toHaveText('Loading workspace...');
        await page.getByLabel('Research project', { exact: true }).selectOption('20');
        await expect(workspace.locator('dd')).toHaveText(['0', '1', '0']);
        await page.evaluate(() => { window.model.delay = 0; window.model.failTasks = true; window.render(); });
        await expect(workspace.getByRole('alert')).toHaveText('Workspace access unavailable.');
        await page.evaluate(() => { window.model.failTasks = false; window.model.tasks = []; });
        await workspace.getByRole('button', { name: 'Retry workspace' }).click();
        await expect(workspace.getByText('No tasks yet.', { exact: true })).toBeVisible();
        await page.evaluate(() => { window.model.workspace.projects = []; window.render(); });
        await expect(workspace.getByText('No active research project.', { exact: true })).toBeVisible();
        evidence.push('Dashboard: R1/R2 figures, workspace counts/loading/error/retry/empty/no-project, shared selection and stale reads PASS');

        await page.goto('http://ui-s1.invalid/dashboard/student?project=10');
        const help = page.getByRole('button', { name: 'About research progress', exact: true });
        await page.evaluate(() => { const spacer = document.createElement('div'); spacer.style.height = '1600px'; document.body.appendChild(spacer); });
        await help.click(); const note = page.getByRole('note').filter({ hasText: 'Completion requires Main' }); await expect(note).toBeVisible();
        assert.equal(await help.evaluate(node => getComputedStyle(node).borderTopWidth), '0px');
        let trigger = await help.boundingBox(), popup = await note.boundingBox(); assert.ok(popup.y + popup.height <= trigger.y + 1);
        await page.evaluate(() => window.scrollBy(0, 80));
        await expect.poll(async () => { trigger = await help.boundingBox(); popup = await note.boundingBox(); return Math.abs(popup.y + popup.height + 8 - trigger.y); }).toBeLessThan(2);
        await page.evaluate(() => { const button = document.querySelector('[aria-label="About research progress"]'); window.scrollBy(0, button.getBoundingClientRect().top - 15); });
        await expect.poll(async () => { trigger = await help.boundingBox(); popup = await note.boundingBox(); return popup.y >= trigger.y + trigger.height; }).toBe(true);
        await page.keyboard.press('Escape'); await expect(note).toBeHidden(); await expect(help).toBeFocused();
        await help.tap(); await expect(note).toBeVisible(); await page.getByRole('heading', { name: 'Research Progress', exact: true }).click(); await expect(note).toBeHidden();
        evidence.push('Shared Help: borderless named/tooltip control, above alignment, scroll following, top-edge reposition, Escape/focus, outside click and touch PASS');

        await page.goto('http://ui-s1.invalid/dashboard/student/submissions?project=10');
        await expect(page.getByRole('tab', { name: 'History', exact: true })).toHaveAttribute('aria-selected', 'true');
        assert.ok((await page.evaluate(() => window.model.reads)).length === 0, 'Inactive panels must not read data');
        await page.getByRole('button', { name: 'View Details', exact: true }).click(); await expect(page.getByText('Preserved project abstract.', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Hide Details', exact: true }).click();
        await page.getByRole('button', { name: 'Create Project', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Submit PDF', exact: true }).click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
        const row = page.locator('button[aria-controls="version-4"]'); await row.click();
        await expect(page.getByText('Preserved version remarks 4', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'View Full Feedback', exact: true }).click();
        const dialog = page.getByRole('dialog'), scroll = dialog.getByLabel('Full adviser feedback');
        await expect(dialog).toHaveAccessibleName('Adviser feedback · v4'); await expect(dialog.locator('strong em u')).toContainText('Synthetic complete feedback');
        await expect(dialog.locator('ul li')).toHaveText('Preserved bullet'); await expect(dialog.locator('ol li')).toHaveText('FINAL_PRESERVED_MARKER');
        await expect(dialog.locator('img,script')).toHaveCount(0);
        assert.equal(await page.evaluate(() => document.body.style.overflow), 'hidden');
        assert.ok(await scroll.evaluate(node => node.scrollHeight > node.clientHeight)); await scroll.evaluate(node => node.scrollTop = node.scrollHeight);
        await expect(dialog.getByText('FINAL_PRESERVED_MARKER', { exact: true })).toBeVisible();
        await page.screenshot({ path: `${out}/feedback-dialog-1440-light.png`, fullPage: true });
        await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(page.getByRole('button', { name: 'View Full Feedback', exact: true })).toBeFocused();
        assert.equal(await page.evaluate(() => document.body.style.overflow), '');
        await page.getByRole('button', { name: 'View / Download PDF', exact: true }).click();
        await expect(page.getByText('The research document could not be accessed.', { exact: true })).toBeVisible();
        assert.deepEqual(await page.evaluate(() => window.model.calls), [['pdf', 4]]);
        await row.click(); await expect(page.getByText('Preserved version remarks 4', { exact: true })).toBeHidden();
        evidence.push('Compact History: project disclosure, Create/Submit dialogs, version expand/collapse, complete safe rich feedback modal/scroll/Escape/focus and unchanged PDF action contract PASS');

        await page.getByRole('tab', { name: 'Progress', exact: true }).focus(); await page.keyboard.press('ArrowRight'); await expect(page.getByRole('tab', { name: 'Revisions', exact: true })).toBeFocused(); await page.keyboard.press('Enter');
        await page.getByLabel('Action Taken', { exact: true }).fill('Unsaved local response');
        await page.getByRole('tab', { name: 'History', exact: true }).click(); await page.getByRole('tab', { name: 'Revisions', exact: true }).click();
        await expect(page.getByLabel('Action Taken', { exact: true })).toHaveValue('Unsaved local response');
        await page.evaluate(() => { window.model.delay = 150; });
        const reload = page.getByRole('button', { name: 'Reload revisions', exact: true }); await reload.click(); await expect(reload).toBeDisabled();
        await expect(page.getByText('Loading revisions...', { exact: true })).toBeVisible(); await expect(reload).toBeEnabled();
        await page.getByRole('tab', { name: 'Progress', exact: true }).click(); await expect(page.getByRole('button', { name: 'Reload progress', exact: true })).toBeEnabled();
        await page.getByRole('button', { name: 'Reload progress', exact: true }).click(); await expect(page.getByText('Loading research progress...', { exact: true })).toBeVisible();
        await expect(page.getByText('0 of 1 milestones completed', { exact: true })).toBeVisible();
        await page.goto('http://ui-s1.invalid/dashboard/student/submissions?project=10&submission=4&feedback=44#feedback-44');
        await expect(page.getByRole('dialog')).toHaveAccessibleName('Adviser feedback · v4'); await page.getByRole('button', { name: 'Close full feedback' }).click();
        await page.goto('http://ui-s1.invalid/dashboard/student/submissions?project=20&submission=4&feedback=44#feedback-44'); await expect(page.getByRole('tab', { name: 'History', exact: true })).toBeVisible(); await expect(page.getByRole('dialog')).toHaveCount(0);
        for (const [hash, tab] of [['research-progress', 'Progress'], ['revision-checklist', 'Revisions']]) { await page.goto('http://ui-s1.invalid/dashboard/student/submissions?project=10#' + hash); await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute('aria-selected', 'true'); }
        evidence.push('Submissions tabs: keyboard, no inactive reads, local draft retention, icon reload loading/disabled, correct hash panels and feedback deep links/private scope PASS');

        for (const [width, theme] of [[1440, 'light'], [1440, 'dark'], [768, 'light'], [640, 'light'], [360, 'light'], [360, 'dark']]) {
            await page.setViewportSize({ width, height: 900 });
            for (const route of ['student?project=10', 'student/submissions?project=10', 'student/workspace?project=10&tab=tasks']) {
                await page.goto('http://ui-s1.invalid/dashboard/' + route); await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
                await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                if (route === 'student?project=10') {
                    await page.getByRole('button', { name: 'About research progress', exact: true }).click();
                    const bounds = await page.getByRole('note').filter({ hasText: 'Completion requires Main' }).boundingBox();
                    assert.ok(bounds.x >= 11 && bounds.x + bounds.width <= width - 11); await page.keyboard.press('Escape');
                }
                if (route.includes('workspace')) { const cols = await Promise.all(['To Do', 'In Progress', 'Done'].map(name => page.getByRole('region', { name, exact: true }).boundingBox())); assert.ok(width > 800 ? Math.abs(cols[0].y - cols[2].y) < 2 : cols[1].y > cols[0].y); }
                if (route.includes('submissions')) {
                    const title = theme === 'dark' ? 'PREVIEW_E4A_SYNTHETIC_' + 'X'.repeat(60) : 'PREVIEW_E4A_SYNTHETIC research on student collaboration and manuscript revision';
                    await page.evaluate(title => { window.model.workspace.projects[0].title = title; window.render(); }, title);
                    const card = page.getByRole('region', { name: title, exact: true });
                    await expect(card.getByRole('heading')).toHaveText(title);
                    const container = await card.boundingBox(), titleRow = await card.getByRole('heading').locator('..').boundingBox();
                    const control = await card.getByRole('button', { name: 'View Details', exact: true }).boundingBox();
                    if (width <= 640) {
                        assert.ok(titleRow.width >= container.width - 35, 'Mobile title gets the whole content row');
                        assert.ok(control.y >= titleRow.y + titleRow.height, 'Details stays below the title');
                    }
                    assert.ok(await card.getByRole('heading').evaluate(el => el.scrollWidth <= el.clientWidth));
                    await expect(page.getByRole('heading', { name: 'Submission History', exact: true }).locator('svg')).toHaveAttribute('width', '18');
                    await card.getByRole('button', { name: 'View Details', exact: true }).click();
                    await expect(card.getByText('Preserved project abstract.', { exact: true })).toBeVisible();
                    await card.getByRole('button', { name: 'Hide Details', exact: true }).click();
                    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                }
                await page.screenshot({ path: `${out}/${route.includes('workspace') ? 'workspace' : route.includes('submissions') ? 'submissions' : 'dashboard'}-${width}-${theme}.png`, fullPage: true });
                if (route.includes('submissions') && width === 360 && theme === 'dark') {
                    await page.locator('button[aria-controls="version-4"]').click(); await page.getByRole('button', { name: 'View Full Feedback', exact: true }).click();
                    await expect(page.getByRole('dialog')).toBeVisible(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                    await page.screenshot({ path: `${out}/feedback-dialog-360-dark.png`, fullPage: true }); await page.getByRole('button', { name: 'Close full feedback' }).click();
                }
            }
        }
        await page.getByLabel('Details: Synthetic task 1', { exact: true }).click(); await expect(page.locator('details[open]').getByText('Synthetic creator', { exact: true })).toBeVisible();
        await page.getByRole('tab', { name: 'Notes', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Shared Research Notes', exact: true })).toBeVisible();
        await page.getByRole('tab', { name: 'Tasks', exact: true }).click(); await expect(page.getByRole('region', { name: 'To Do', exact: true })).toBeVisible();
        await page.goto('http://ui-s1.invalid/dashboard/student?project=20'); await workspace.getByRole('link', { name: 'Open workspace', exact: true }).click(); await expect(page).toHaveURL(/workspace\?project=20&tab=tasks$/); await expect(page.getByLabel('Research project', { exact: true })).toHaveValue('20');
        assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
        evidence.push('Desktop/tablet/mobile Light/Dark layout/screenshots, three-column/stacked taskboard, task disclosure, Tasks/Notes tabs, scoped Open workspace navigation, zero console/unexpected network errors PASS');
        fs.writeFileSync(`${out}/browser-evidence.json`, JSON.stringify(evidence, null, 2)); console.log(evidence.join('\n'));
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
