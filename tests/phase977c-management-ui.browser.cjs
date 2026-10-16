/* eslint-disable @typescript-eslint/no-require-imports */
// Actual components, explicit in-memory action results and authoritative prop refresh.
// No database, storage, institutional approval, or provider requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { build } = require('esbuild');
const { chromium, expect } = require('@playwright/test');
const mocks = `
const s=window.__state={calls:[],result:{success:false,message:'Synthetic authorization denied.'},delay:0};
const wait=()=>new Promise(r=>setTimeout(r,s.delay));
export async function changeResearchGroupStatusAction(id,status){s.calls.push({kind:'group',id,status});await wait();if(s.result.success)window.__data.groups.find(g=>g.id===id).status=status;return s.result;}
export async function publishRepositoryPaperAction(previous,data){const id=Number(data.get('paperId'));s.calls.push({kind:'publish',id});await wait();if(s.result.success){const p=window.__data.repo.eligiblePapers.find(p=>p.paperId===id);window.__data.repo.eligiblePapers=window.__data.repo.eligiblePapers.filter(p=>p.paperId!==id);window.__data.repo.repositoryEntries.push({id:90,paperId:id,title:p.title,groupName:p.groupName,isPublished:true,publishedAt:new Date().toISOString()});}return s.result;}
export async function updateRepositoryPublicationAction(previous,data){const id=Number(data.get('repositoryId')),published=data.get('publish')==='true';s.calls.push({kind:'visibility',id,published});await wait();if(s.result.success)window.__data.repo.repositoryEntries.find(p=>p.id===id).isPublished=published;return s.result;}
`;
async function main() {
    const bundle = await build({ write: false, outfile: 'ui.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' },
        stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `import React from 'react';import{createRoot}from'react-dom/client';import Groups from './components/dashboard/admin-groups';import Repository from './app/dashboard/admin/repository/RepositoryManagement';const root=createRoot(document.getElementById('root'));let key=0;window.render=(kind,data,reset=true)=>{window.__kind=kind;if(reset)key++;window.__data=data;root.render(<main className="dashboard-page" key={key}>{kind==='groups'?<Groups groups={[...data.groups]}/>:<Repository eligiblePapers={[...data.repo.eligiblePapers]} repositoryEntries={[...data.repo.repositoryEntries]}/>}</main>);};window.refresh=()=>{window.__refreshes=(window.__refreshes||0)+1;window.render(window.__kind,window.__data,false);};` },
        plugins: [{ name: 'synthetic-actions', setup(b) {
            b.onResolve({ filter: /^@\/lib\/actions\// }, () => ({ path: 'actions', namespace: 'mock' }));
            b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'mock' }));
            b.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: args.path === 'actions' ? mocks : 'export function useRouter(){return {refresh(){window.refresh();}}}', loader: 'js' }));
        } }],
    });
    const browser = await chromium.launch();
    try {
        const page = await browser.newPage({ viewport: { width: 360, height: 560 } }), errors = [], external = [];
        page.on('pageerror', error => errors.push(error.message)); await page.route('**/*', route => { external.push('request'); return route.abort(); });
        await page.setContent('<html data-theme="light" style="--font-geist-sans:Arial;--font-geist-mono:monospace"><body><div id="root"></div></body></html>');
        const compiledCss = fs.readdirSync('.next/static/chunks').filter(name => name.endsWith('.css')).map(name => fs.readFileSync(join('.next/static/chunks', name), 'utf8')).join('\n');
        await page.addStyleTag({ content: compiledCss + '\n' + bundle.outputFiles.find(f => f.path.endsWith('.css')).text });
        await page.addScriptTag({ content: bundle.outputFiles.find(f => f.path.endsWith('.js')).text });
        const render = (kind, data) => page.evaluate(({ kind, data }) => window.render(kind, data), { kind, data });
        const fixture = { groups: [{ id: 1, groupName: 'Synthetic   Alpha', strand: 'STEM', section: 'One', schoolYear: '2026-2027', adviserId: 12, status: 'active' }, { id: 2, groupName: 'Synthetic Beta', strand: 'ICT', section: 'Two', schoolYear: '2026-2027', adviserId: 13, status: 'archived' }] };
        await render('groups', { groups: [] }); await expect(page.getByText('No registered research groups.', { exact: true })).toBeVisible();
        await render('groups', { groups: [{ ...fixture.groups[0], status: 'legacy' }] }); await expect(page.getByText(/1 groups have other recorded statuses/)).toBeVisible(); await expect(page.getByRole('button', { name: /^Archive|^Reactivate/ })).toHaveCount(0);
        await render('groups', fixture);
        await expect(page.getByText('Adviser ID: 12', { exact: true })).toBeVisible();
        await page.getByLabel('Search groups', { exact: true }).fill('  sYnThEtIc    aLpHa '); await expect(page.locator('section > ul > li')).toHaveCount(1);
        await page.getByLabel('Group status', { exact: true }).selectOption('archived'); await expect(page.getByText(/^No groups match/)).toBeVisible(); await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
        const archive = page.getByRole('button', { name: 'Archive Synthetic Alpha', exact: true }); await archive.click();
        let modal = page.getByRole('dialog'); await expect(modal).toHaveAccessibleName('Archive Synthetic Alpha?');
        await modal.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(archive).toBeFocused();
        await archive.click(); await modal.getByRole('button', { name: 'Confirm archive', exact: true }).click(); await expect(modal.getByRole('status')).toHaveText('Synthetic authorization denied.'); assert.equal(await page.evaluate(() => window.__refreshes || 0), 0);
        await page.evaluate(() => { window.__state.result = { success: true, message: 'Synthetic group saved.' }; window.__state.delay = 700; });
        await modal.getByRole('button', { name: 'Confirm archive', exact: true }).click(); await expect(modal.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
        await page.keyboard.press('Escape'); await page.mouse.click(1, 1); await expect(modal).toBeVisible();
        await modal.locator('form').evaluate(form => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
        await expect(modal).not.toBeVisible(); assert.equal(await page.evaluate(() => window.__state.calls.length), 2); // One denied and one success.
        await expect(page.getByRole('button', { name: 'Reactivate Synthetic Alpha', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Reactivate Synthetic Alpha', exact: true }).click(); await modal.getByRole('button', { name: 'Confirm reactivate', exact: true }).click(); await expect(modal).not.toBeVisible();
        await page.evaluate(() => { window.__state.result = { success: false, uncertain: true, message: 'Refresh and verify group status.' }; window.__state.delay = 0; });
        await archive.click(); await modal.getByRole('button', { name: 'Confirm archive', exact: true }).click(); await expect(modal.getByRole('button', { name: 'Confirm archive', exact: true })).toBeDisabled();
        await expect(modal.getByRole('alert')).toContainText('Further changes are paused'); await page.keyboard.press('Escape'); await expect(archive).toBeDisabled();
        const repo = { repo: { eligiblePapers: [{ paperId: 20, title: 'Synthetic Ready', groupName: 'Synthetic Group', createdAt: '2026-01-01' }], repositoryEntries: [{ id: 30, paperId: 21, title: 'Synthetic Published', groupName: 'Synthetic Group', isPublished: true, publishedAt: '2026-01-01' }, { id: 31, paperId: 22, title: 'Synthetic Hidden', groupName: 'Synthetic Group', isPublished: false, publishedAt: null }] } };
        await render('repository', { repo: { eligiblePapers: [], repositoryEntries: [] } }); await expect(page.getByText('No eligible research is ready to publish.', { exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Repository Entries', exact: true }).click(); await expect(page.getByText('No repository entries have been created.', { exact: true })).toBeVisible();
        await render('repository', repo); await expect(page.getByRole('button', { name: 'Ready to Publish', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByRole('heading', { name: 'Synthetic Hidden', exact: true })).toHaveCount(0);
        await page.getByRole('button', { name: 'Repository Entries', exact: true }).click();
        for (const [value, title] of [['published', 'Synthetic Published'], ['hidden', 'Synthetic Hidden']]) { await page.getByLabel('Repository visibility').selectOption(value); await expect(page.locator('section > ul > li')).toHaveCount(1); await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible(); }
        await page.getByRole('button', { name: 'Ready to Publish', exact: true }).click(); await page.getByRole('button', { name: 'Repository Entries', exact: true }).click(); await expect(page.getByLabel('Repository visibility')).toHaveValue('hidden');
        await page.evaluate(() => { window.__state.result = { success: true, message: 'Synthetic publication saved.' }; });
        await page.getByRole('button', { name: 'Republish Synthetic Hidden', exact: true }).click(); await expect(modal).toHaveAccessibleName('Republish Synthetic Hidden?');
        await modal.getByRole('button', { name: 'Confirm republish', exact: true }).click(); await expect(modal).not.toBeVisible(); await expect(page.getByLabel('Repository visibility')).toHaveValue('hidden'); await expect(page.getByText('No Hidden entries.', { exact: true })).toBeVisible();
        await page.getByLabel('Repository visibility').selectOption('published'); await page.getByRole('button', { name: 'Unpublish Synthetic Published', exact: true }).click();
        await expect(modal).toHaveAccessibleName('Unpublish Synthetic Published?'); await modal.getByRole('button', { name: 'Confirm unpublish', exact: true }).click(); await expect(modal).not.toBeVisible();
        await page.getByRole('button', { name: 'Ready to Publish', exact: true }).click(); await expect(page.locator('section > ul > li')).toHaveCount(1);
        await page.getByRole('button', { name: 'Publish Synthetic Ready', exact: true }).click(); await expect(modal).toHaveAccessibleName('Publish Synthetic Ready to the repository?'); await modal.getByRole('button', { name: 'Confirm publish', exact: true }).click(); await expect(modal).not.toBeVisible(); await expect(page.getByText('No eligible research is ready to publish.', { exact: true })).toBeVisible();
        // Empty Published filter is distinct from an empty repository.
        await render('repository', { repo: { eligiblePapers: [], repositoryEntries: [repo.repo.repositoryEntries[1]] } }); await page.getByRole('button', { name: 'Repository Entries', exact: true }).click(); await page.getByLabel('Repository visibility').selectOption('published'); await expect(page.getByText('No Published entries.', { exact: true })).toBeVisible();
        await page.getByLabel('Repository visibility').selectOption('hidden'); await page.getByRole('button', { name: 'Republish Synthetic Hidden', exact: true }).click();
        await page.evaluate(() => { window.__state.result = { success: false, message: 'Synthetic document unavailable.' }; });
        await modal.getByRole('button', { name: 'Confirm republish', exact: true }).click(); await expect(modal.getByRole('status')).toHaveText('Synthetic document unavailable.');
        await page.evaluate(() => { window.__state.result = { success: false, uncertain: true, message: 'Refresh and verify repository visibility.' }; });
        await modal.getByRole('button', { name: 'Confirm republish', exact: true }).click(); await expect(modal.getByRole('button', { name: 'Confirm republish', exact: true })).toBeDisabled(); await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'Republish Synthetic Hidden', exact: true })).toBeDisabled();
        for (const width of [360, 1280]) for (const theme of ['light', 'dark']) {
            await page.setViewportSize({ width, height: width === 360 ? 560 : 900 }); await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
            const longGroup = { ...fixture.groups[0], groupName: 'Synthetic ' + 'LongGroup'.repeat(9) };
            const longPaper = { ...repo.repo.eligiblePapers[0], title: 'Synthetic ' + 'LongResearchTitle'.repeat(10) };
            for (const [kind, data] of [['groups', { groups: [longGroup] }], ['repository', { repo: { eligiblePapers: [longPaper], repositoryEntries: [] } }]]) {
                await render(kind, data); await expect(page.locator('section > ul > li')).toHaveCount(1);
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                assert.ok(await page.locator('section > ul > li').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
                const trigger = page.getByRole('button', { name: new RegExp(kind === 'groups' ? '^Archive ' : '^Publish Synthetic') });
                if (kind === 'repository') assert.ok((await trigger.boundingBox()).height <= 60, 'Publish remains a compact unbroken button beside long titles');
                await page.screenshot({ path: join(tmpdir(), `phase977c-isolated-${kind}-${width}-${theme}.png`), fullPage: true });
                await trigger.click(); modal = page.getByRole('dialog'); const close = modal.getByRole('button', { name: /^Close / }), cancel = modal.getByRole('button', { name: 'Cancel', exact: true });
                await expect(close).toBeFocused(); await cancel.focus(); await page.keyboard.press('Tab'); await expect(close).toBeFocused(); await page.keyboard.press('Shift+Tab'); await expect(cancel).toBeFocused();
                assert.ok(await modal.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && el.clientHeight <= innerHeight));
                assert.ok(await cancel.evaluate(el => el.matches(':focus-visible') && parseFloat(getComputedStyle(el).outlineWidth) >= 3));
                const failures = await page.locator('main').evaluate(root => {
                    const lum = c => { const v = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => (x /= 255) <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4); return v[0] * .2126 + v[1] * .7152 + v[2] * .0722; };
                    return [...root.querySelectorAll('h2,h3,p,button,label,select,span,dt,dd')].flatMap(el => {
                        if (!el.getClientRects().length || !el.textContent.trim() || el.disabled) return [];
                        const style = getComputedStyle(el); let parent = el, bg = style.backgroundColor;
                        while (bg === 'rgba(0, 0, 0, 0)' && parent.parentElement) { parent = parent.parentElement; bg = getComputedStyle(parent).backgroundColor; }
                        const [hi, lo] = [lum(style.color), lum(bg)].sort((a, b) => b - a), required = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
                        return (hi + .05) / (lo + .05) < required ? [el.textContent.slice(0, 60)] : [];
                    });
                }); assert.deepEqual(failures, []);
                await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
            }
        }
        assert.deepEqual(errors, []); assert.deepEqual(external, []);
        console.log('PASS actual client components: group metrics/unknown status/empty/search/combined filter, ID display, Cancel/focus, denied result/no false refresh, pending Escape/backdrop/duplicate guard, authoritative Archive/Reactivate refresh; repository two views, all/Published/Hidden and empty states, preserved view/filter, all three named confirmations, action payloads, success partition refresh, document failure, uncertain retry lock after dismissal. 360/1280 Light/Dark long-title wrapping, compact Publish sizing, computed AA text contrast, short-screen dialogs, keyboard loop/visible focus/restoration. In-memory fixtures only, zero network/DB.');
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
