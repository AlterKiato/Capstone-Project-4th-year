/* eslint-disable @typescript-eslint/no-require-imports */
// Actual React/task-dialog/CSS in Chromium; synthetic in-memory actions/router, no DB or HTTP auth.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { build } = require('esbuild');
const { chromium, expect } = require('@playwright/test');
const task = (id, title, status, permissions, rest = {}) => ({ id, title, status, paperId: 11, description: 'Synthetic task description', dueDate: '2026-11-06', createdBy: 1, assignedStudentId: 2,
    createdAt: '2026-11-05T00:00:00Z', updatedAt: '2026-11-05T00:00:00Z', creator: { name: 'Synthetic Actor', eligible: true }, assignee: { name: 'Synthetic Member', eligible: true }, permissions, ...rest });
function fixture() {
    return { projectId: 11, scene: 0, mode: 'normal', calls: [], refreshes: 0, delay: 0, next: null,
        projects: [{ id: 11, title: 'Synthetic Research A' }, { id: 22, title: 'Synthetic Research B' }],
        members: [{ id: 1, name: 'Synthetic Actor' }, { id: 2, name: 'Synthetic Member' }],
        boards: { 11: [task(101, 'Prepare literature outline', 'To Do', { edit: true, assign: true, status: true, delete: true, recovery: false }),
            task(102, 'Check citations', 'In Progress', { edit: false, assign: false, status: true, delete: false, recovery: false }, { createdBy: 2, assignedStudentId: 1 }),
            task(103, 'Recover source list', 'To Do', { edit: false, assign: true, status: false, delete: false, recovery: true }, { createdBy: 4, assignedStudentId: 5, creator: { name: 'Former Creator', eligible: false }, assignee: { name: 'Former Assignee', eligible: false } }),
            task(104, 'Confirm research question', 'Done', { edit: false, assign: false, status: false, delete: false, recovery: false }, { createdBy: 2 })], 22: [] } };
}
const mocks = `
async function mutate(kind,input){const s=window.__c3;s.calls.push({kind,input});if(s.delay)await new Promise(r=>setTimeout(r,s.delay));if(s.next){const r=s.next;s.next=null;return r;}
const rows=s.boards[input.paperId];let row=rows.find(t=>t.id===input.taskId);
if(kind==='create'){row={...input,id:200+s.calls.length,status:'To Do',createdBy:1,createdAt:'2026-11-05T00:00:00Z',updatedAt:'2026-11-05T00:00:00Z',creator:{name:'Synthetic Actor',eligible:true},permissions:{edit:true,assign:true,status:true,delete:true,recovery:false}};rows.push(row);}
if(kind==='edit'){Object.assign(row,{title:input.title,description:input.description,dueDate:input.dueDate});}
if(kind==='assign')row.assignedStudentId=input.assignedStudentId;
if(kind==='status')row.status=input.status;
if(kind==='create'||kind==='assign'){const member=s.members.find(m=>m.id===row.assignedStudentId);row.assignee=member?{name:member.name,eligible:true}:null;}
if(kind==='delete')s.boards[input.paperId]=rows.filter(t=>t.id!==input.taskId);
return {success:true,kind:'success',message:'Synthetic save confirmed.',data:row||{id:input.taskId}};}
export const createWorkspaceTaskAction=input=>mutate('create',input);
export const editWorkspaceTaskAction=input=>mutate('edit',input);
export const assignWorkspaceTaskAction=input=>mutate('assign',input);
export const updateWorkspaceTaskStatusAction=input=>mutate('status',input);
export const deleteWorkspaceTaskAction=input=>mutate('delete',input);
`;
async function main() {
    const bundle = await build({ write: false, outfile: 'c3.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
        stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `import React from 'react';import{createRoot}from'react-dom/client';import Board from './components/dashboard/student-task-board';import Loading from './app/dashboard/student/workspace/loading';const root=createRoot(document.getElementById('root'));window.renderBoard=()=>{const s=window.__c3,p=s.projects.find(p=>p.id===s.projectId)||null;const board=s.mode==='error'?{success:false,kind:'unavailable',message:'Denied'}:p?{success:true,kind:'success',message:'OK',data:{tasks:s.boards[p.id],members:s.members}}:null;root.render(s.mode==='loading'?<Loading/>:<main className="dashboard-page"><Board key={s.scene+':'+s.projectId} projects={s.projects} project={p} invalidProject={s.mode==='invalid'} board={board}/></main>);};window.renderBoard();` },
        plugins: [{ name: 'synthetic-boundaries', setup(b) {
            b.onResolve({ filter: /^@\/lib\/actions\// }, () => ({ path: 'actions', namespace: 'synthetic' }));
            b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'synthetic' }));
            b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'synthetic' }));
            b.onLoad({ filter: /.*/, namespace: 'synthetic' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'actions' ? mocks : args.path === 'link' ? 'export default function Link(p){return <a {...p}/>;}' :
                `export function useRouter(){return {refresh(){window.__c3.refreshes++;window.renderBoard();},push(href){window.__c3.href=href;window.__c3.projectId=Number(new URL(href,'http://localhost').searchParams.get('project'));window.renderBoard();}};}` }));
        } }] });
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/New_York' }), errors = [];
        page.on('pageerror', e => errors.push(e.message)); page.on('dialog', dialog => dialog.accept());
        await page.route('**/*', route => route.abort());
        await page.setContent('<html data-theme="light"><body><div id="root"></div></body></html>');
        await page.evaluate(state => { window.__c3 = state; }, fixture());
        await page.addStyleTag({ content: '@layer base {' + fs.readFileSync('node_modules/tailwindcss/preflight.css', 'utf8') + '}\n' + fs.readFileSync('app/globals.css', 'utf8') + '\n' + bundle.outputFiles.find(f => f.path.endsWith('.css')).text });
        await page.addScriptTag({ content: bundle.outputFiles.find(f => f.path.endsWith('.js')).text });
        const details = title => page.locator('details').filter({ has: page.getByLabel(`Details: ${title}`, { exact: true }) });
        const open = async title => { const d = details(title); if (await d.getAttribute('open') === null) await d.locator('summary').click(); return d; };
        const select = page.getByLabel('Research project', { exact: true });
        async function contrast() {
            const failures = await page.locator('main').evaluate(root => {
                const luminance = color => {
                    const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
                    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
                };
                return [...root.querySelectorAll('h2,h3,p,label,button,summary,span,dt,dd')].flatMap(el => {
                    if (!el.getClientRects().length || el.matches(':disabled') || !el.textContent.trim()) return [];
                    const style = getComputedStyle(el); let ancestor = el, bg = style.backgroundColor;
                    while (bg === 'rgba(0, 0, 0, 0)' && ancestor.parentElement) { ancestor = ancestor.parentElement; bg = getComputedStyle(ancestor).backgroundColor; }
                    const [high, low] = [luminance(style.color), luminance(bg)].sort((a, b) => b - a);
                    const large = parseFloat(style.fontSize) >= 24 || parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700;
                    return (high + .05) / (low + .05) < (large ? 3 : 4.5) ? [el.tagName + ':' + el.textContent.slice(0, 30)] : [];
                });
            });
            assert.deepEqual(failures, []);
        }
        await expect(page.getByRole('region', { name: 'To Do', exact: true })).toContainText('Prepare literature outline');
        await expect(page.getByRole('region', { name: 'In Progress', exact: true })).toContainText('Check citations');
        await expect(page.getByRole('region', { name: 'Done', exact: true })).toContainText('Confirm research question');
        let own = await open('Prepare literature outline'); await own.getByRole('button', { name: 'Edit', exact: true }).click();
        let modal = page.getByRole('dialog', { name: 'Edit Task', exact: true });
        await expect(select).toBeDisabled(); assert.ok(await modal.evaluate(d => d.contains(document.activeElement)));
        await modal.getByLabel('Title', { exact: true }).fill('Prepare annotated outline');
        await page.evaluate(() => { window.__c3.next = { success: false, kind: 'validation', message: 'Check the task title.' }; });
        await modal.getByRole('button', { name: 'Save changes', exact: true }).click();
        await expect(modal.getByRole('status')).toHaveText('Check the task title.'); await expect(modal.getByLabel('Title', { exact: true })).toHaveValue('Prepare annotated outline');
        assert.equal(await page.evaluate(() => window.__c3.refreshes), 0);
        await modal.getByRole('button', { name: 'Save changes', exact: true }).click(); await expect(modal).toHaveCount(0);
        own = await open('Prepare annotated outline'); await expect(own.getByRole('button', { name: 'Edit', exact: true })).toBeFocused();
        await page.getByRole('button', { name: 'New Task', exact: true }).click(); modal = page.getByRole('dialog', { name: 'New Task', exact: true });
        await expect(modal.getByLabel('Assigned Student (optional)')).toHaveCount(1);
        await expect(modal.locator('select option')).toHaveCount(3);
        await modal.getByLabel('Title', { exact: true }).fill('Write methods checklist');
        await modal.getByLabel('Description (optional)').fill('Keep literal <script>text</script> as text.');
        await modal.getByLabel('Due date (optional)').fill('2026-11-06');
        await modal.getByLabel('Assigned Student (optional)').selectOption('2');
        await page.evaluate(() => { window.__c3.delay = 150; });
        await modal.getByRole('button', { name: 'Create task', exact: true }).evaluate(b => { b.click(); b.click(); });
        await expect(modal).toHaveCount(0); assert.equal(await page.evaluate(() => window.__c3.calls.filter(c => c.kind === 'create').length), 1);
        await page.evaluate(() => { window.__c3.delay = 0; });
        await expect(page.getByRole('region', { name: 'To Do', exact: true })).toContainText('Write methods checklist');
        own = await open('Prepare annotated outline'); await own.getByRole('button', { name: 'Assign', exact: true }).click();
        modal = page.getByRole('dialog', { name: 'Assign Task', exact: true }); await modal.getByLabel('Assigned Student (optional)').selectOption('');
        await modal.getByRole('button', { name: 'Save changes', exact: true }).click(); await expect(modal).toHaveCount(0); await expect(own).toContainText('Unassigned');
        let orphan = await open('Recover source list'); await expect(orphan).toContainText('Former Assignee · Needs reassignment');
        await expect(orphan.getByRole('button', { name: /^(Edit|Delete|Change status)$/ })).toHaveCount(0);
        await orphan.getByRole('button', { name: 'Recover assignment', exact: true }).click(); modal = page.getByRole('dialog', { name: 'Recover Assignment', exact: true });
        await expect(modal.locator('option[value="5"]')).toBeDisabled(); await modal.getByLabel('Assigned Student (optional)').selectOption('2');
        await modal.getByRole('button', { name: 'Save changes', exact: true }).click(); await expect(modal).toHaveCount(0); await expect(orphan).toContainText('Synthetic Member');
        const assigned = await open('Check citations'); await expect(assigned.getByRole('button', { name: /^(Edit|Assign|Delete)$/ })).toHaveCount(0);
        await assigned.getByRole('button', { name: 'Change status', exact: true }).click(); modal = page.getByRole('dialog', { name: 'Change Task Status', exact: true });
        await modal.getByLabel('Task status', { exact: true }).selectOption('Done'); await modal.getByRole('button', { name: 'Save changes', exact: true }).click(); await expect(modal).toHaveCount(0);
        await expect(page.getByRole('region', { name: 'Done', exact: true })).toContainText('Check citations');
        await (await open('Check citations')).getByRole('button', { name: 'Change status', exact: true }).click(); modal = page.getByRole('dialog', { name: 'Change Task Status', exact: true });
        await modal.getByLabel('Task status', { exact: true }).selectOption('To Do'); await page.evaluate(() => { window.__c3.next = { success: false, kind: 'unavailable', message: 'This task is unavailable.' }; });
        await modal.getByRole('button', { name: 'Save changes', exact: true }).click(); await expect(modal.getByRole('status')).toHaveText('This task is unavailable.');
        assert.equal(await page.evaluate(() => window.__c3.boards[11].find(t => t.id === 102).status), 'Done'); await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0);
        own = await open('Prepare annotated outline'); await own.getByRole('button', { name: 'Delete', exact: true }).click(); modal = page.getByRole('dialog', { name: 'Delete Task', exact: true });
        await expect(modal).toContainText('preserved and unlinked'); await modal.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(modal).toHaveCount(0); await expect(own).toBeVisible();
        await own.getByRole('button', { name: 'Delete', exact: true }).click(); modal = page.getByRole('dialog', { name: 'Delete Task', exact: true });
        await modal.getByRole('button', { name: 'Permanently delete task', exact: true }).click(); await expect(modal).toHaveCount(0); await expect(details('Prepare annotated outline')).toHaveCount(0);
        const readOnly = await open('Confirm research question'); await expect(readOnly.getByRole('button')).toHaveCount(0);
        await select.selectOption('22'); await expect(page.getByRole('heading', { name: 'Synthetic Research B', exact: true })).toBeVisible(); await expect(page.locator('details')).toHaveCount(0);
        assert.equal(await page.evaluate(() => window.__c3.href), '/dashboard/student/workspace?project=22');
        await page.getByRole('button', { name: 'New Task', exact: true }).click(); modal = page.getByRole('dialog', { name: 'New Task', exact: true }); await expect(select).toBeDisabled();
        await modal.getByLabel('Title', { exact: true }).fill('Bound to paper B'); await page.evaluate(() => { window.__c3.delay = 150; });
        await modal.getByRole('button', { name: 'Create task', exact: true }).click();
        // Simulate browser-history navigation during the in-flight action: the old form must retain paper B.
        await page.evaluate(() => { window.__c3.projectId = 11; window.renderBoard(); });
        await expect(page.getByRole('heading', { name: 'Synthetic Research A', exact: true })).toBeVisible();
        await expect(page.getByLabel('Details: Bound to paper B', { exact: true })).toHaveCount(0);
        await expect.poll(() => page.evaluate(() => window.__c3.boards[22].length)).toBe(1);
        assert.equal(await page.evaluate(() => window.__c3.calls.at(-1).input.paperId), 22);
        await page.evaluate(() => { window.__c3.delay = 0; });
        for (const width of [1280, 360]) for (const theme of ['light', 'dark']) {
            await page.setViewportSize({ width, height: 820 }); await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
                elements: [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(el => [el.tagName, el.className]) }));
            assert.ok(overflow.scroll <= overflow.width, JSON.stringify({ theme, ...overflow }));
            await page.getByRole('button', { name: 'New Task', exact: true }).click(); modal = page.getByRole('dialog', { name: 'New Task', exact: true });
            await contrast();
            assert.ok(await modal.evaluate(d => d.getBoundingClientRect().width <= window.innerWidth));
            await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); assert.ok(await modal.evaluate(d => d.contains(document.activeElement)));
            await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0);
            if (theme === 'light') await page.screenshot({ path: join(tmpdir(), `thesishs-c3-${width}.png`), fullPage: true });
        }
        await page.getByRole('button', { name: 'New Task', exact: true }).click(); modal = page.getByRole('dialog', { name: 'New Task', exact: true });
        await modal.getByLabel('Title', { exact: true }).fill('Preserve uncertain draft');
        await page.evaluate(() => { window.__c3.next = { success: false, kind: 'infrastructure', message: 'Reload and verify before retrying.' }; });
        await modal.getByRole('button', { name: 'Create task', exact: true }).click(); await expect(modal.getByRole('button', { name: 'Create task', exact: true })).toBeDisabled();
        await expect(modal.getByLabel('Title', { exact: true })).toHaveValue('Preserve uncertain draft'); await expect(modal.getByRole('button', { name: 'Reload workspace', exact: true })).toBeVisible();
        for (const mode of ['invalid', 'error', 'empty', 'loading']) {
            await page.evaluate(mode => { window.__c3.scene++; window.__c3.mode = mode; if (mode === 'empty') { window.__c3.projectId = null; window.__c3.projects = []; } window.renderBoard(); }, mode);
            await expect(page.getByRole(mode === 'error' ? 'alert' : mode === 'loading' ? 'status' : 'heading', { ...(mode === 'invalid' ? { name: 'Project unavailable', exact: true } : mode === 'empty' ? { name: 'No research projects yet', exact: true } : {}) })).toBeVisible();
        }
        assert.deepEqual(errors, []);
        console.log('PASS C3 Chromium: categories; all task interactions; permission controls; error/uncertain states; project navigation/in-flight isolation; focus/keyboard; 1280/360 light/dark; empty/invalid/loading; no DB/auth acceptance claim.');
    } finally { await browser.close(); }
}
main().catch(error => { console.error('C3 browser assertion failed (synthetic UI only):', error.message); process.exitCode = 1; });
