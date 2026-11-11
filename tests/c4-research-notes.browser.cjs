/* eslint-disable @typescript-eslint/no-require-imports */
// Actual workspace/notes/dialog/CSS in Chromium. Synthetic actions/router only; no server, DB or auth.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { build } = require('esbuild');
const { chromium, expect } = require('@playwright/test');
function fixture() {
    const at = '2026-11-05T00:00:00Z';
    const note = (id, title, createdBy, deletedAt = null) => ({ id, title, content: 'Literal <script>not executable</script>\nShared research text.', paperId: 11,
        createdBy, taskId: 101, version: 3, createdAt: at, updatedAt: at, deletedAt });
    return { projectId: 11, tab: 'tasks', deletedOnly: false, scene: 0, mode: 'normal', calls: [], reads: [], refreshes: 0, delay: 0, next: null, readNext: null,
        projects: [{ id: 11, title: 'Synthetic Research A' }, { id: 22, title: 'Synthetic Research B' }], tasks: { 11: [{ id: 101, title: 'Literature outline' }], 22: [{ id: 201, title: 'Paper B task' }] },
        notes: { 11: [note(1, 'Research observations', 1), note(2, 'Peer research note', 2), note(3, 'Deleted by me', 1, at), note(4, 'Deleted by peer', 2, at)], 22: [] } };
}
const actions = `
async function mutate(kind,input){const s=window.__c4;s.calls.push({kind,input});if(s.delay)await new Promise(r=>setTimeout(r,s.delay));if(s.next){const result=s.next;s.next=null;return result;}
const rows=s.notes[input.paperId];let row=rows.find(n=>n.id===input.noteId);
if(kind!=='create'&&row.version!==input.expectedVersion)return {success:false,kind:'conflict',message:'Stale version.'};
if(kind==='create'){row={...input,id:100+s.calls.length,createdBy:1,version:1,deletedAt:null,createdAt:'2026-11-05T00:00:00Z',updatedAt:'2026-11-05T00:00:00Z'};rows.push(row);}
else{row.version++;if(kind==='edit'){row.title=input.title;row.content=input.content;}if(kind==='link')row.taskId=input.taskId;if(kind==='delete')row.deletedAt='2026-11-05T00:00:00Z';if(kind==='restore')row.deletedAt=null;}
return {success:true,kind:'success',message:'Synthetic save confirmed.',data:{...row}};}
export const createWorkspaceNoteAction=input=>mutate('create',input);
export const editWorkspaceNoteAction=input=>mutate('edit',input);
export const linkWorkspaceNoteAction=input=>mutate('link',input);
export const deleteWorkspaceNoteAction=input=>mutate('delete',input);
export const restoreWorkspaceNoteAction=input=>mutate('restore',input);
export async function getWorkspaceNoteAction(input){const s=window.__c4;s.reads.push(input);if(s.readNext){const result=s.readNext;s.readNext=null;return result;}const n=s.notes[input.paperId].find(n=>n.id===input.noteId);return n?{success:true,kind:'success',message:'OK',data:{...n}}:{success:false,kind:'unavailable',message:'Note unavailable.'};}
export const createWorkspaceTaskAction=async()=>{throw Error('Outside C4 test scope');};
export const editWorkspaceTaskAction=createWorkspaceTaskAction,assignWorkspaceTaskAction=createWorkspaceTaskAction,updateWorkspaceTaskStatusAction=createWorkspaceTaskAction,deleteWorkspaceTaskAction=createWorkspaceTaskAction;
`;
async function main() {
    const bundle = await build({ write: false, outfile: 'c4.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
        stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `import React from 'react';import{createRoot}from'react-dom/client';import Workspace from './components/dashboard/student-group-workspace';import Loading from './app/dashboard/student/workspace/loading';const root=createRoot(document.getElementById('root'));window.renderWorkspace=()=>{const s=window.__c4,p=s.projects.find(p=>p.id===s.projectId)||null;
const rows=p?s.notes[p.id].filter(n=>s.deletedOnly?n.createdBy===1&&n.deletedAt:!n.deletedAt).map(n=>({...n,creatorName:n.createdBy===1?'Synthetic Creator':'Synthetic Peer',linkedTask:s.tasks[p.id].find(t=>t.id===n.taskId)||null,permissions:{edit:n.createdBy===1&&!n.deletedAt,link:n.createdBy===1&&!n.deletedAt,delete:n.createdBy===1&&!n.deletedAt,restore:n.createdBy===1&&!!n.deletedAt}})):[];
const notes=s.mode==='error'?{success:false,kind:'unavailable',message:'Denied'}:{success:true,kind:'success',message:'OK',data:{notes:rows,tasks:p?s.tasks[p.id]:[]}};root.render(s.mode==='loading'?<Loading/>:<main className="dashboard-page research-workspace"><Workspace key={s.scene+':'+s.projectId} projects={s.projects} project={p} invalidProject={s.mode==='invalid'} tab={s.tab} deletedOnly={s.deletedOnly} board={{success:true,kind:'success',message:'OK',data:{tasks:[],members:[]}}} notes={notes}/></main>);};window.renderWorkspace();` },
        plugins: [{ name: 'synthetic-boundaries', setup(b) {
            b.onResolve({ filter: /^@\/lib\/actions\// }, () => ({ path: 'actions', namespace: 'synthetic' }));
            b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'synthetic' }));
            b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'synthetic' }));
            b.onLoad({ filter: /.*/, namespace: 'synthetic' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'actions' ? actions : args.path === 'link' ? 'export default function Link(p){return <a {...p}/>;}' :
                `export function useRouter(){return {refresh(){window.__c4.refreshes++;window.renderWorkspace();},push(href){const s=window.__c4,q=new URL(href,'http://localhost').searchParams;s.href=href;s.projectId=Number(q.get('project'))||s.projects[0]?.id;s.tab=q.get('tab')==='notes'?'notes':'tasks';s.deletedOnly=s.tab==='notes'&&q.get('deleted')==='1';window.renderWorkspace();}};}` }));
        } }] });
    const browser = await chromium.launch();
    let groups = 0;
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/New_York' }), errors = [];
        let confirmAnswer = true, confirms = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('dialog', async dialog => { confirms.push(dialog.message()); if (confirmAnswer) await dialog.accept(); else await dialog.dismiss(); });
        await page.route('**/*', route => route.abort());
        await page.setContent('<html data-theme="light"><body><div id="root"></div></body></html>');
        await page.evaluate(state => { window.__c4 = state; Object.defineProperty(window, 'navigation', { configurable: true, value: new EventTarget() }); }, fixture());
        await page.addStyleTag({ content: '@layer base {' + fs.readFileSync('node_modules/tailwindcss/preflight.css', 'utf8') + '}\n' + fs.readFileSync('app/globals.css', 'utf8') + '\n' + bundle.outputFiles.find(f => f.path.endsWith('.css')).text });
        await page.addScriptTag({ content: bundle.outputFiles.find(f => f.path.endsWith('.js')).text });
        const select = page.getByLabel('Research project', { exact: true });
        const details = title => page.locator('details').filter({ has: page.getByLabel(`Read note: ${title}`, { exact: true }) });
        const open = async title => { const d = details(title); if (await d.getAttribute('open') === null) await d.locator('summary').click(); return d; };
        const lastCall = () => page.evaluate(() => window.__c4.calls.at(-1));
        const modal = () => page.getByRole('dialog');
        const save = () => modal().getByRole('button', { name: 'Save changes', exact: true }).click();
        const reset = async (patch = {}) => { await page.evaluate(patch => { const s = window.__c4; Object.assign(s, patch); s.scene++; window.renderWorkspace(); }, patch); };
        // Manual activation tabs: arrows move focus, Enter activates, selected project is retained.
        await expect(page.getByRole('tab', { name: 'Tasks', exact: true })).toHaveAttribute('aria-selected', 'true');
        await page.getByRole('tab', { name: 'Tasks', exact: true }).focus(); await page.keyboard.press('ArrowRight');
        await expect(page.getByRole('tab', { name: 'Notes', exact: true })).toBeFocused();
        await expect(page.getByRole('tab', { name: 'Tasks', exact: true })).toHaveAttribute('aria-selected', 'true');
        await page.keyboard.press('Enter'); await expect(page.getByRole('heading', { name: 'Shared Research Notes', exact: true })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Notes', exact: true })).toBeFocused();
        await page.keyboard.press('Home'); await expect(page.getByRole('tab', { name: 'Tasks', exact: true })).toBeFocused();
        await page.keyboard.press('End'); await expect(page.getByRole('tab', { name: 'Notes', exact: true })).toBeFocused();
        assert.equal(await page.evaluate(() => window.__c4.href), '/dashboard/student/workspace?project=11&tab=notes');
        await select.selectOption('22'); await expect(page.getByText('No notes yet.', { exact: false })).toBeVisible();
        assert.equal(await page.evaluate(() => window.__c4.href), '/dashboard/student/workspace?project=22&tab=notes');
        await expect(page.getByLabel('Read note: Research observations')).toHaveCount(0);
        await select.selectOption('11'); groups++;
        // Plain text, author metadata and creator-only controls. Deleted peer content never appears.
        let own = await open('Research observations'), peer = await open('Peer research note');
        await expect(own).toContainText('Literal <script>not executable</script>'); await expect(own).toContainText('Literature outline');
        await expect(own).toContainText('UTC'); await expect(peer.getByRole('button')).toHaveCount(0); await expect(peer).toContainText('Read only');
        await expect(page.getByText('Deleted by peer', { exact: true })).toHaveCount(0); assert.equal(await page.locator('main script').count(), 0); groups++;
        assert.ok(await own.evaluate(el => parseFloat(getComputedStyle(el.closest('li')).borderRadius) > 0), 'Notes use bordered cards');
        assert.equal(await own.locator('summary').evaluate(el => getComputedStyle(el.querySelector('span:nth-child(2)')).webkitLineClamp), '2');
        // Create: required limits/options, failed save preserves draft, double click yields one mutation.
        await page.getByRole('button', { name: 'New Note', exact: true }).click();
        await expect(select).toBeDisabled(); await expect(page.getByRole('tab', { name: 'Tasks', exact: true })).toBeDisabled();
        await expect(modal().getByLabel('Title', { exact: true })).toHaveAttribute('maxlength', '200');
        await expect(modal().getByLabel('Content', { exact: true })).toHaveAttribute('maxlength', '20000');
        await expect(modal().getByLabel('Linked task (optional)').locator('option')).toHaveCount(2);
        await expect(modal().getByLabel('Linked task (optional)').locator('option[value="201"]')).toHaveCount(0);
        await modal().getByLabel('Title', { exact: true }).fill('My new note'); await modal().getByLabel('Content', { exact: true }).fill('Preserve this draft.');
        await page.evaluate(() => { window.__c4.next = { success: false, kind: 'validation', message: 'Check note fields.' }; });
        await modal().getByRole('button', { name: 'Create note', exact: true }).click();
        await expect(modal().getByLabel('Content', { exact: true })).toHaveValue('Preserve this draft.'); await expect(modal()).toContainText('Check note fields.');
        assert.equal(await page.evaluate(() => window.__c4.refreshes), 0);
        await modal().getByLabel('Linked task (optional)').selectOption('101');
        await page.evaluate(() => { window.__c4.delay = 150; });
        const beforeCreate = await page.evaluate(() => window.__c4.calls.length);
        await modal().getByRole('button', { name: 'Create note', exact: true }).evaluate(b => { b.click(); b.click(); });
        await expect(modal()).toHaveCount(0); assert.equal(await page.evaluate(() => window.__c4.calls.length), beforeCreate + 1);
        assert.deepEqual((await lastCall()).input, { paperId: 11, title: 'My new note', content: 'Preserve this draft.', taskId: 101 });
        await page.evaluate(() => { window.__c4.delay = 0; }); await expect(details('My new note')).toBeVisible(); groups++;
        // Draft discard warning preserves all fields when dismissed; Navigation API cancellation too.
        own = await open('Research observations'); await own.getByRole('button', { name: 'Edit', exact: true }).click();
        await modal().getByLabel('Title', { exact: true }).fill('Draft title'); await modal().getByLabel('Content', { exact: true }).fill('Draft content');
        confirmAnswer = false; await page.keyboard.press('Escape'); await expect(modal()).toBeVisible();
        assert.ok(confirms.at(-1).includes('Discard'));
        const canceled = await page.evaluate(() => !window.navigation.dispatchEvent(new Event('navigate', { cancelable: true })));
        assert.equal(canceled, true); await expect(modal().getByLabel('Content', { exact: true })).toHaveValue('Draft content');
        confirmAnswer = true; await modal().getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(modal()).toHaveCount(0);
        await expect(own.getByRole('button', { name: 'Edit', exact: true })).toBeFocused(); groups++;
        // Conflict: frozen expectedVersion, unchanged draft, no automatic retry/read, warned explicit reload.
        await own.getByRole('button', { name: 'Edit', exact: true }).click(); await modal().getByLabel('Content', { exact: true }).fill('Keep my unsaved draft');
        await page.evaluate(() => { const n = window.__c4.notes[11][0]; n.version = 4; n.content = 'Concurrent server content'; window.renderWorkspace(); });
        await save(); await expect(modal()).toContainText('Your draft is still here');
        await expect(modal().getByLabel('Content', { exact: true })).toHaveValue('Keep my unsaved draft');
        await expect(modal().getByRole('button', { name: 'Save changes', exact: true })).toBeDisabled();
        assert.equal((await lastCall()).input.expectedVersion, 3); assert.equal(await page.evaluate(() => window.__c4.reads.length), 0);
        const atConflict = await page.evaluate(() => window.__c4.calls.length);
        confirmAnswer = false; await modal().getByRole('button', { name: 'Reload latest version', exact: true }).click();
        assert.ok(confirms.at(-1).includes('replaces the current draft')); assert.equal(await page.evaluate(() => window.__c4.reads.length), 0);
        confirmAnswer = true;
        await page.evaluate(() => { window.__c4.readNext = { success: false, kind: 'unavailable', message: 'Latest read unavailable.' }; });
        await modal().getByRole('button', { name: 'Reload latest version', exact: true }).click(); await expect(modal()).toContainText('Latest read unavailable.');
        await expect(modal().getByLabel('Content', { exact: true })).toHaveValue('Keep my unsaved draft');
        await modal().getByRole('button', { name: 'Reload latest version', exact: true }).click();
        await expect(modal().getByLabel('Content', { exact: true })).toHaveValue('Concurrent server content');
        assert.equal(await page.evaluate(() => window.__c4.calls.length), atConflict);
        await modal().getByLabel('Content', { exact: true }).fill('Reviewed latest content'); await save(); await expect(modal()).toHaveCount(0);
        assert.equal((await lastCall()).input.expectedVersion, 4); groups++;
        // Linking/unlinking submits captured versions; concurrent task deletion increments note version.
        own = await open('Research observations'); await own.getByRole('button', { name: 'Link / unlink task', exact: true }).click();
        await modal().getByLabel('Linked task (optional)').selectOption(''); await save(); await expect(modal()).toHaveCount(0);
        assert.deepEqual((await lastCall()).input, { paperId: 11, noteId: 1, expectedVersion: 5, taskId: null }); await expect(own).toContainText('Unlinked');
        await own.getByRole('button', { name: 'Link / unlink task', exact: true }).click(); await modal().getByLabel('Linked task (optional)').selectOption('101');
        await save(); await expect(modal()).toHaveCount(0); assert.equal((await lastCall()).input.expectedVersion, 6);
        await own.getByRole('button', { name: 'Link / unlink task', exact: true }).click();
        await page.evaluate(() => { window.__c4.tasks[11] = []; for (const n of window.__c4.notes[11]) if (n.taskId === 101) { n.taskId = null; n.version++; } });
        await modal().getByLabel('Linked task (optional)').selectOption(''); await save(); await expect(modal()).toContainText('Your draft is still here');
        assert.equal((await lastCall()).input.expectedVersion, 7);
        await modal().getByRole('button', { name: 'Reload latest version', exact: true }).click(); await expect(modal().getByLabel('Linked task (optional)')).toHaveValue('');
        await save(); await expect(modal()).toHaveCount(0); assert.equal((await lastCall()).input.expectedVersion, 8); groups++;
        // Delete confirmation and restore use expectedVersion; creator-only deleted listing.
        own = await open('Research observations'); await own.getByRole('button', { name: 'Delete', exact: true }).click();
        await expect(modal()).toContainText('stored content is preserved'); await modal().getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(own).toBeVisible(); await own.getByRole('button', { name: 'Delete', exact: true }).click();
        await modal().getByRole('button', { name: 'Move to Recently Deleted', exact: true }).click(); await expect(modal()).toHaveCount(0);
        assert.equal((await lastCall()).input.expectedVersion, 9); await expect(details('Research observations')).toHaveCount(0);
        await page.getByRole('button', { name: 'Recently Deleted', exact: true }).click();
        await expect(details('Deleted by me')).toBeVisible(); await expect(details('Deleted by peer')).toHaveCount(0);
        own = await open('Research observations'); await expect(own.getByRole('button', { name: /^(Edit|Delete)$/ })).toHaveCount(0);
        await own.getByRole('button', { name: 'Restore', exact: true }).click();
        // Another process changed this deleted row: restore has the same explicit conflict path.
        await page.evaluate(() => { window.__c4.notes[11][0].version++; });
        await modal().getByRole('button', { name: 'Restore note', exact: true }).click(); await expect(modal()).toContainText('Your draft is still here');
        assert.equal((await lastCall()).input.expectedVersion, 10);
        await modal().getByRole('button', { name: 'Reload latest version', exact: true }).click();
        await modal().getByRole('button', { name: 'Restore note', exact: true }).click(); await expect(modal()).toHaveCount(0);
        assert.equal((await lastCall()).input.expectedVersion, 11); await expect(details('Research observations')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Recently Deleted', exact: true })).toBeVisible(); groups++;
        // Deletion-state change during conflict reload cannot reopen writes against the wrong state.
        own = await open('Research observations'); await own.getByRole('button', { name: 'Delete', exact: true }).click();
        await page.evaluate(() => { window.__c4.notes[11][0].version++; });
        await modal().getByRole('button', { name: 'Move to Recently Deleted', exact: true }).click();
        await page.evaluate(() => { window.__c4.notes[11][0].deletedAt = '2026-11-05T00:00:00Z'; });
        await modal().getByRole('button', { name: 'Reload latest version', exact: true }).click();
        await expect(modal()).toContainText('already deleted or restored'); await expect(modal().getByRole('button', { name: 'Move to Recently Deleted', exact: true })).toBeDisabled();
        await modal().getByRole('button', { name: 'Cancel', exact: true }).click(); groups++;
        // Project-scoped reset and creation never retain paper A note/task state in paper B.
        await select.selectOption('22'); await page.getByRole('button', { name: 'New Note', exact: true }).click();
        await expect(modal().getByLabel('Title', { exact: true })).toHaveValue('');
        await expect(modal().getByLabel('Linked task (optional)').locator('option[value="101"]')).toHaveCount(0);
        await modal().getByLabel('Title', { exact: true }).fill('Paper B note'); await modal().getByLabel('Content', { exact: true }).fill('Only paper B');
        await modal().getByLabel('Linked task (optional)').selectOption('201');
        await modal().getByRole('button', { name: 'Create note', exact: true }).click(); await expect(modal()).toHaveCount(0);
        assert.deepEqual((await lastCall()).input, { paperId: 22, title: 'Paper B note', content: 'Only paper B', taskId: 201 }); groups++;
        // Viewport/theme, long plain text, dialog keyboard trap and minimum tap target checks.
        await page.evaluate(() => { window.__c4.notes[22][0].content = 'longword'.repeat(2500); window.renderWorkspace(); });
        await open('Paper B note');
        for (const width of [1280, 360]) for (const theme of ['light', 'dark']) {
            await page.setViewportSize({ width, height: 820 }); await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            const expanded = page.locator('details[open]').first();
            assert.ok(await expanded.evaluate(el => el.querySelector('p').textContent.length > 1000), 'Full long content remains available');
            await page.screenshot({ path: join(tmpdir(), `thesishs-ui-s11-notes-${width}-${theme}.png`), fullPage: true });
            await page.getByRole('button', { name: 'New Note', exact: true }).click();
            await expect(modal()).toBeVisible(); assert.ok(await modal().evaluate(d => d.getBoundingClientRect().width <= innerWidth));
            const contrastFailures = await page.locator('main').evaluate(root => {
                const luminance = color => {
                    const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => { const s = v / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
                    return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
                };
                return [...root.querySelectorAll('h2,p,label,button,summary,span,dt,dd')].flatMap(el => {
                    if (!el.getClientRects().length || el.matches(':disabled') || !el.textContent.trim()) return [];
                    const style = getComputedStyle(el); let ancestor = el, bg = style.backgroundColor;
                    while (bg === 'rgba(0, 0, 0, 0)' && ancestor.parentElement) { ancestor = ancestor.parentElement; bg = getComputedStyle(ancestor).backgroundColor; }
                    const [high, low] = [luminance(style.color), luminance(bg)].sort((a, b) => b - a);
                    return (high + .05) / (low + .05) < 4.5 ? [el.tagName + ':' + el.textContent.slice(0, 30)] : [];
                });
            });
            assert.deepEqual(contrastFailures, []);
            assert.ok(await modal().evaluate(d => d.contains(document.activeElement)));
            await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); assert.ok(await modal().evaluate(d => d.contains(document.activeElement)));
            const undersized = await page.locator('dialog button, dialog input, dialog select').evaluateAll(els => els.filter(e => e.getClientRects().length && e.getBoundingClientRect().height < 44).map(e => e.outerHTML));
            assert.deepEqual(undersized, []);
            await page.keyboard.press('Escape'); await expect(modal()).toHaveCount(0);
            if (theme === 'light') {
                await page.evaluate(() => { const n = window.__c4.notes[22][0]; n.content = 'Shared fieldwork observations.\nReview sources and prepare the next research meeting.'; window.renderWorkspace(); });
                await page.screenshot({ path: join(tmpdir(), `thesishs-c4-${width}.png`), fullPage: true });
                await page.getByRole('button', { name: 'New Note', exact: true }).click();
                await page.screenshot({ path: join(tmpdir(), `thesishs-c4-dialog-${width}.png`), fullPage: true });
                await page.keyboard.press('Escape'); await expect(modal()).toHaveCount(0);
                await page.evaluate(() => { window.__c4.notes[22][0].content = 'longword'.repeat(2500); window.renderWorkspace(); });
            }
        }
        groups++;
        // Infrastructure or refresh uncertainty never closes/resets the draft or permits blind retry.
        for (const next of [{ success: false, kind: 'infrastructure', message: 'Unconfirmed write.' }, { success: true, kind: 'success', message: 'Saved', refreshRequired: true, data: {} }]) {
            await reset(); await page.getByRole('button', { name: 'New Note', exact: true }).click();
            await modal().getByLabel('Title', { exact: true }).fill('Uncertain draft'); await modal().getByLabel('Content', { exact: true }).fill('Keep me');
            await page.evaluate(next => { window.__c4.next = next; }, next);
            await modal().getByRole('button', { name: 'Create note', exact: true }).click();
            await expect(modal().getByRole('button', { name: 'Create note', exact: true })).toBeDisabled();
            await expect(modal().getByLabel('Content', { exact: true })).toHaveValue('Keep me');
            await expect(modal().getByRole('button', { name: 'Reload workspace', exact: true })).toBeVisible();
        }
        groups++;
        // Loading, unauthorized/invalid project, changed access and no-project states.
        for (const mode of ['invalid', 'error', 'empty', 'loading']) {
            await reset({ mode, ...(mode === 'empty' ? { projectId: null, projects: [] } : {}) });
            if (mode === 'invalid') await expect(page.getByRole('heading', { name: 'Project unavailable', exact: true })).toBeVisible();
            if (mode === 'error') await expect(page.getByRole('alert')).toContainText('Notes are unavailable');
            if (mode === 'empty') await expect(page.getByRole('heading', { name: 'No research projects yet', exact: true })).toBeVisible();
            if (mode === 'loading') await expect(page.getByRole('status')).toBeVisible();
        }
        groups++; assert.deepEqual(errors, []);
        console.log('PASS C4 Chromium: ' + groups + ' interaction groups; tabs/project scopes; note create/read/edit/link/delete/restore; creator controls; captured versions/conflicts/explicit reload; draft safeguards; uncertainty; 1280/360 light/dark keyboard/long text; empty/error/loading. Synthetic boundaries only.');
    } finally { await browser.close(); }
}
main().catch(error => { console.error('C4 component assertion failed (synthetic UI only):', error.stack); process.exitCode = 1; });
