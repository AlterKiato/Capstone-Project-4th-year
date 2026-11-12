/* eslint-disable @typescript-eslint/no-require-imports */
// Actual four-tab review, feedback editor/guards and AI component; synthetic action responses only.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { build } = require('esbuild'), { chromium, expect } = require('@playwright/test');
async function main() {
    const out = 'test-results/ai-a11'; fs.mkdirSync(out, { recursive: true });
    const bundle = await build({ write: false, outfile: 'assistant.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' }, stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';import{createRoot}from'react-dom/client';
import Tabs from './app/dashboard/adviser/submissions/ReviewTabs';import Form from './app/dashboard/adviser/submissions/FeedbackForm';
import Guard from './app/dashboard/adviser/submissions/ReviewDraftBoundary';import Draft from './app/dashboard/adviser/submissions/OfficialFeedbackDraft';
import Revisions from './app/dashboard/adviser/submissions/RevisionDraft';import Layout from './app/dashboard/adviser/submissions/ReviewWorkspace';
import Assistant from './components/dashboard/adviser-research-assistant';
const root=createRoot(document.getElementById('root'));
window.show=(id=11,standalone=false)=>root.render(standalone?<Assistant submissionId={id}/>:<Guard key={id}><Draft><Revisions><main className='dashboard-page'><a href='/elsewhere'>Leave workspace</a><Layout version='v1' document={<p>Synthetic PDF pane — no document fetched</p>}><Tabs submissionId={id} paperId={7} editable={true}><Form submissionId={id}/></Tabs></Layout></main></Revisions></Draft></Guard>);
window.show();` }, plugins: [{ name: 'isolated-actions', setup(b) {
            b.onResolve({ filter: /^@\/lib\/actions\// }, () => ({ path: 'actions', namespace: 'fixture' }));
            b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
            b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'tsx', resolveDir: process.cwd(), contents: args.path === 'navigation' ? `export const useRouter=()=>({refresh(){window.model.refreshes++}});`
                : `import{getResearchDemoAnswer,RESEARCH_DEMO_EXCERPT}from'./lib/ai/adviser-research-demo';
window.model={calls:[],access:true,delay:0,error:false,denied:false,refreshes:0};
const wait=()=>new Promise(resolve=>setTimeout(resolve,window.model.delay));
export async function getResearchDemoAvailabilityAction(input){window.model.calls.push(['availability',input]);await wait();return window.model.access?{success:true,mode:'synthetic-only',liveResearchEnabled:false}:{success:false,mode:'denied',message:'Synthetic access denied'};}
export async function analyzeResearchDemoAction(input){window.model.calls.push(['analyze',input]);const result=window.model.denied?{success:false,mode:'denied',message:'Current Main access changed'}:input.excerpt!==RESEARCH_DEMO_EXCERPT||!getResearchDemoAnswer(input.task,input.question)?{success:false,mode:'unsupported',message:'Edited text has not been analyzed or verified as synthetic. Load the fictional example.'}:{success:true,mode:'mock',answer:getResearchDemoAnswer(input.task,input.question)};const fail=window.model.error;await wait();if(fail)throw Error('Synthetic action failure');return result;}
export async function getMainDelegationPanelAction(id){window.model.calls.push(['delegations',id]);return{success:true,message:'Assignments loaded.',data:{eligible:true,advisers:[],assignments:[]}};}
export async function readRevisionsAction(){return{success:true,data:{canManage:true,cycles:[]}};}
const forbidden=async()=>{window.model.calls.push(['UNEXPECTED WRITE']);throw Error('Academic writes forbidden in AI test');};
export const createAdviserFeedbackAction=forbidden,respondToRevisionAction=forbidden,cancelCoAdviserAssignmentAction=forbidden,delegateCoAdvisersAction=forbidden,getRecommendationForOfficialDraftAction=forbidden;` }));
        } }] });
    const css = '@layer base {' + fs.readFileSync('node_modules/tailwindcss/preflight.css', 'utf8') + '}\n'
        + fs.readFileSync('app/globals.css', 'utf8').replace(/^@import.*$/m, '') + '\n' + bundle.outputFiles.find(f => f.path.endsWith('.css')).text;
    const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] });
    const passed = [], errors = [], requests = [];
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
        page.setDefaultTimeout(10000);
        page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
        await page.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
        await page.setContent('<html data-theme="light"><head><base href="http://ai-a11.invalid/"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>');
        await page.addStyleTag({ content: css }); await page.addScriptTag({ content: bundle.outputFiles.find(f => f.path.endsWith('.js')).text });
        const tab = name => page.getByRole('tab', { name, exact: true });
        const ai = page.getByRole('region', { name: 'Research assistance demonstration' });
        const excerpt = page.getByLabel('Synthetic research excerpt', { exact: true }), question = page.getByLabel('Question', { exact: true });
        const analyze = page.getByRole('button', { name: 'Analyze fictional example', exact: true });
        const conversation = page.locator('[aria-label="Synthetic conversation"]');
        await expect(page.getByRole('tab')).toHaveCount(4);
        await expect(ai).toHaveCount(0); assert.equal((await page.evaluate(() => window.model.calls)).length, 0);
        const editor = page.getByRole('textbox', { name: 'Feedback Comments', exact: true });
        await editor.fill('Preserved official feedback draft');
        await tab('Review').focus(); await page.keyboard.press('End'); await expect(tab('AI Assistant')).toBeFocused();
        await expect(tab('AI Assistant')).toHaveAttribute('aria-selected', 'true'); await expect(excerpt).toBeEnabled();
        await page.keyboard.press('ArrowRight'); await expect(tab('Review')).toBeFocused();
        await page.keyboard.press('ArrowLeft'); await expect(tab('AI Assistant')).toBeFocused();
        await page.keyboard.press('Home'); await expect(tab('Review')).toBeFocused();
        await expect(editor).toHaveText('Preserved official feedback draft');
        await tab('Revisions').click(); await page.getByRole('button', { name: 'Add correction', exact: true }).click();
        await page.getByLabel('Correction 1', { exact: true }).fill('Preserved correction');
        await tab('Co-Adviser').click(); await expect(page.getByRole('button', { name: 'Reload assignments', exact: true })).toBeVisible();
        await tab('AI Assistant').click(); await expect(excerpt).toHaveValue('');
        passed.push('four accessible tabs, Home/End and arrow wrap, lazy AI mount, existing revision/delegation controls');

        await expect(ai.getByRole('combobox')).toHaveText(/Academic Writing Review.*Research Consistency Review.*Research Methodology Guidance/);
        await expect(analyze).toBeDisabled(); await page.getByRole('button', { name: 'Load fictional example', exact: true }).click();
        await page.evaluate(() => { window.model.delay = 120; }); await analyze.click();
        await expect(page.getByRole('button', { name: 'Preparing demonstration…', exact: true })).toBeDisabled();
        await expect(conversation.locator('article')).toHaveCount(1); await expect(conversation).toContainText('aims to compare');
        await expect(conversation).toContainText('SYNTHETIC DEMONSTRATION — NOT LIVE AI ANALYSIS');
        await expect(ai).toContainText('No citations or sources are verified');
        for (let i = 0; i < 5; i++) { await page.getByRole('button', { name: i % 2 ? 'What to verify' : 'Explain suggestion', exact: true }).click(); await analyze.click(); await expect(question).toHaveValue(''); await expect(analyze).toBeDisabled(); }
        await expect(conversation.locator('article')).toHaveCount(4);
        const calls = await page.evaluate(() => window.model.calls.filter(c => c[0] === 'analyze'));
        assert.equal(calls.length, 6); assert.equal(calls.at(-1)[1].history.length, 8);
        passed.push('three tasks, explicit example, labelled useful writing response, pending state and four-exchange bounded follow-ups');

        await tab('Review').click(); await expect(editor).toHaveText('Preserved official feedback draft');
        await tab('Revisions').click(); await expect(page.getByLabel('Correction 1', { exact: true })).toHaveValue('Preserved correction');
        await tab('AI Assistant').click(); await expect(excerpt).toBeEnabled(); await expect(conversation.locator('article')).toHaveCount(4);
        for (const [task, text] of [['consistency', 'never collected'], ['methodology', 'not verified institutional requirements']]) {
            await ai.getByRole('combobox').selectOption(task); await expect(conversation.locator('article')).toHaveCount(0); await analyze.click(); await expect(conversation).toContainText(text);
        }
        await question.fill('An arbitrary question has no semantic analysis'); await analyze.click();
        await expect(ai.getByRole('status')).toContainText('not been analyzed'); await expect(conversation.locator('article')).toHaveCount(1);
        await excerpt.fill('<script>throw new Error("Never execute")</script>'); await page.getByRole('button', { name: 'Use suggested question', exact: true }).click();
        await analyze.click(); await expect(ai.getByRole('status')).toContainText('not been analyzed'); await expect(conversation.locator('article')).toHaveCount(0);
        passed.push('AI state retained across tabs; official feedback/revision drafts untouched; task changes reset history; arbitrary text receives no analysis');

        await page.getByRole('button', { name: 'Load fictional example', exact: true }).click();
        await page.evaluate(() => { window.model.delay = 350; }); await analyze.click(); await page.getByRole('button', { name: 'Clear conversation', exact: true }).click();
        await page.waitForTimeout(450); await expect(excerpt).toHaveValue(''); await expect(question).toHaveValue(''); await expect(conversation.locator('article')).toHaveCount(0);
        await page.evaluate(() => { window.model.delay = 0; window.show(22); }); await tab('AI Assistant').click(); await expect(excerpt).toBeEnabled(); await expect(excerpt).toHaveValue('');
        await page.getByRole('button', { name: 'Load fictional example', exact: true }).click(); await analyze.click(); await expect(conversation.locator('article')).toHaveCount(1);
        await page.evaluate(() => { window.model.denied = true; }); await page.getByRole('button', { name: 'Explain suggestion', exact: true }).click(); await analyze.click();
        await expect(excerpt).toBeDisabled(); await expect(excerpt).toHaveValue(''); await expect(conversation.locator('article')).toHaveCount(0);
        passed.push('clear cancels late result, submission change resets context, direct action denial clears and disables temporary input/history');

        await page.evaluate(() => { window.model.denied = false; window.show(33, true); }); await expect(excerpt).toBeEnabled();
        await page.getByRole('button', { name: 'Load fictional example', exact: true }).click(); await analyze.click(); await expect(conversation.locator('article')).toHaveCount(1);
        await page.evaluate(() => { window.show(44, true); }); await expect(excerpt).toBeEnabled(); await expect(excerpt).toHaveValue(''); await expect(conversation.locator('article')).toHaveCount(0);
        await page.getByRole('button', { name: 'Load fictional example', exact: true }).click(); await page.evaluate(() => { window.model.error = true; }); await analyze.click();
        await expect(excerpt).toBeDisabled(); await expect(ai.getByRole('status')).toContainText('could not be confirmed'); await expect(excerpt).toHaveValue('');
        await page.evaluate(() => { window.model.error = false; window.show(55, true); }); await expect(excerpt).toBeEnabled(); await page.getByRole('button', { name: 'Load fictional example', exact: true }).click();
        await page.evaluate(() => { window.model.access = false; window.dispatchEvent(new Event('focus')); }); await expect(excerpt).toBeDisabled(); await expect(excerpt).toHaveValue('');
        passed.push('component reused with new submission resets state; transport error and access loss on focus fail closed without stale content');

        await page.evaluate(() => { window.model.access = true; window.show(66); }); await tab('AI Assistant').click(); await expect(excerpt).toBeEnabled();
        await page.getByRole('button', { name: 'Load fictional example', exact: true }).click(); await analyze.click(); await expect(conversation.locator('article')).toHaveCount(1);
        for (const width of [360, 768, 1440]) for (const theme of ['light', 'dark']) {
            await page.setViewportSize({ width, height: 900 }); await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow');
            assert.ok(await page.getByRole('tab').evaluateAll(nodes => nodes.every(node => {
                const range = document.createRange(); range.selectNodeContents(node);
                return range.getClientRects().length === 1;
            })), 'Review tab labels stay readable on one line');
            for (const button of await ai.getByRole('button').all()) assert.ok((await button.boundingBox()).height >= 43, '44px controls');
            assert.ok(await ai.evaluate(root => {
                const rgb = value => value.match(/[\d.]+/g).map(Number);
                const luminance = color => color.slice(0, 3).map(value => { const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
                return [...root.querySelectorAll('p, label, dt, dd, button:not(:disabled), select, textarea')].every(node => {
                    let background = node;
                    while (background.parentElement && (rgb(getComputedStyle(background).backgroundColor)[3] ?? 1) === 0) background = background.parentElement;
                    const a = luminance(rgb(getComputedStyle(node).color)), b = luminance(rgb(getComputedStyle(background).backgroundColor));
                    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 4.5;
                });
            }), 'Enabled text/control contrast meets 4.5:1');
            await page.screenshot({ path: `${out}/assistant-${width}-${theme}.png`, fullPage: true });
        }
        await tab('Review').click(); await editor.fill('Unsaved navigation guard stays active');
        let dialogCount = 0; page.on('dialog', dialog => { dialogCount++; void dialog.dismiss(); });
        await page.getByRole('link', { name: 'Leave workspace' }).click(); assert.equal(dialogCount, 1); await expect(editor).toHaveText('Unsaved navigation guard stays active');
        assert.equal((await page.evaluate(() => window.model.calls.filter(c => c[0] === 'UNEXPECTED WRITE'))).length, 0);
        assert.deepEqual(errors, []); assert.deepEqual(requests, []);
        passed.push('360/768/1440 Light/Dark, 44px controls, unchanged leave-confirmation guard; zero academic writes/browser network/errors');
        fs.writeFileSync(`${out}/browser-results.json`, JSON.stringify({ PASS: passed.length, FAIL: 0, passed, scope: 'Synthetic component boundaries only; no authenticated Next Server Actions, database, Storage, provider, hosted or device acceptance' }, null, 2));
        console.log(JSON.stringify({ PASS: passed.length, FAIL: 0, passed }));
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
