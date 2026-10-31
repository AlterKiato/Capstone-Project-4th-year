/* eslint-disable @typescript-eslint/no-require-imports */
// One isolated synthetic UI run. No application server, credentials, database or Storage access.
const assert = require('node:assert/strict');
const { build } = require('esbuild');
const { chromium, expect } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const toolbarChecks = require('./phaseP2C-toolbar.browser.cjs');
const toastChecks = require('./phaseP2C-toast.browser.cjs');

async function main() {
    const bundle = await build({ write: false, outfile: 'workspace.js', bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
        define: { 'process.env.NODE_ENV': '"production"' },
        stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
import React from 'react';import{createRoot}from'react-dom/client';
import Page from './app/dashboard/adviser/submissions/[submissionId]/page';
import StudentResearch from './components/dashboard/student-research';
import StudentPage from './app/dashboard/student/page';
import * as feedbackCodec from './lib/utils/feedback-content';
import {readFeedbackEditor} from './lib/utils/feedback-editor-dom';
window.__feedbackCodec=feedbackCodec;window.__readEditor=readFeedbackEditor;
import {ThemeProvider} from './components/theme-provider';
import shell from './components/dashboard/dashboard-shell.module.css';
const root=createRoot(document.getElementById('root'));window.__logout=0;window.__refreshes=0;
let generation=0;
function draw(hidden=false){root.render(<ThemeProvider><div className={shell.shell} data-display-mode={window.__current.mode}>
<aside className={shell.sidebar}><button className={shell.logout} aria-label='Logout' onClick={()=>window.__logout++}><span className={shell.label}>Logout</span></button></aside>
<div className={shell.content}><React.Activity mode={hidden?'hidden':'visible'}>{window.__node}</React.Activity></div></div></ThemeProvider>)}
window.render=async(id=1,status='Under Review',mode='standalone')=>{const current=++generation;window.__current={id,status,mode};const node=await Page({params:Promise.resolve({submissionId:String(id)})});if(current!==generation)return;window.__node=node;draw()};
window.hide=()=>draw(true);
window.showUnrelated=()=>{window.__node=<main className='dashboard-page'>Unrelated page width check</main>;draw()};
window.__refresh=()=>{window.__refreshes++;const saved=window.__feedbackCalls.at(-1);window.__storedFeedback=saved?.comments;window.render(window.__current.id,'Approved',window.__current.mode)};
window.showStudentFeedback=()=>{const comments=window.__storedFeedback;window.__studentFixture={email:'synthetic@example.invalid',groups:[{id:100,groupName:'Synthetic test group',members:[]}],projects:[{id:10,groupId:100,title:'Synthetic research',abstract:'Synthetic',status:'Approved'}],submissions:[{id:1,paperId:10,version:'v1',status:'Approved',submittedAt:'2026-10-31T00:00:00Z',feedback:[{id:1,comments,decision:'Approved',createdAt:'2026-10-31T00:00:00Z'}]}]};window.__node=<StudentResearch workspace={window.__studentFixture} target={{project:'10',submission:'1'}}/>;draw()};
window.showStudentOverview=async()=>{window.__node=await StudentPage();draw()};window.render();
` },
        plugins: [{ name: 'synthetic-actions', setup(b) {
            b.onResolve({ filter: /^@\/lib\/actions\// }, () => ({ path: 'actions', namespace: 'test' }));
            b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'test' }));
            b.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'test' }));
            b.onResolve({ filter: /^@\/lib\/services\// }, () => ({ path: 'details', namespace: 'test' }));
            b.onResolve({ filter: /^\.\/notification-bell$/ }, () => ({ path: 'bell', namespace: 'test' }));
            b.onLoad({ filter: /.*/, namespace: 'test' }, args => ({ contents: args.path === 'navigation' ?
                'export function notFound(){throw Error("Unknown synthetic route")} export function useRouter(){return {push(href){window.__navigation=href},refresh(){window.__refresh()}}}' : args.path === 'link' ?
                `import React from 'react';export default function Link(props){return <a {...props} onClick={e=>{e.preventDefault();window.__navigation='directory'}}/>}` : args.path === 'bell' ?
                `import React from 'react';export default function Bell(){return <a href='/dashboard/adviser/notifications'>Notifications</a>}` : args.path === 'details' ?
                `export async function getStudentWorkspace(){return window.__studentFixture}export async function getCurrentStudentVerificationStatus(){return null}
export async function getAdviserReviewDetails(id){const status=window.__current.status;return {email:'synthetic@example.invalid',submission:{id,paperId:10,researchTitle:'Synthetic workspace test research',groupName:'Synthetic test group',version:'v'+id,status,studentFirstName:'Synthetic',studentLastName:'Student',submittedAt:new Date('2026-10-31T00:00:00Z'),remarks:'Synthetic remarks only.'},versions:[{id:1,version:'v1',status:id===1?status:'Under Review'},{id:2,version:'v2',status:id===2?status:'Approved'}],feedback:status==='Approved'&&window.__storedFeedback?[{id:1,comments:window.__storedFeedback,decision:'Approved',createdAt:new Date('2026-10-31T00:00:00Z')}]:[]}}` : `
window.__signCalls=[];window.__feedbackCalls=[];window.__deferSigning=false;window.__deferFeedback=false;
export async function createStudentResearchAction(){throw Error('Unexpected mutation')}
export async function initiateSubmissionUploadAction(){throw Error('Unexpected mutation')}
export async function renewSubmissionUploadAction(){throw Error('Unexpected mutation')}
export async function getSubmissionUploadStatusAction(){throw Error('Unexpected mutation')}
export async function cancelSubmissionUploadAction(){throw Error('Unexpected mutation')}
export async function finalizeSubmissionUploadAction(){throw Error('Unexpected mutation')}
export async function startSubmissionReviewAction(){return {success:false,message:'Synthetic review not started'}}
export async function getSubmissionDownloadUrlAction(id,purpose){if(purpose!=='adviser-review')throw Error('Expected fixed Adviser review purpose');window.__signCalls.push(id);if(window.__signThrows)throw Error('Synthetic signing failure');if(window.__signDenied)return null;if(window.__deferSigning)return new Promise(r=>window.__resolveSigning=r);return 'https://pdf.invalid/synthetic-'+id+'.pdf'}
export async function createAdviserFeedbackAction(data){window.__feedbackCalls.push({id:data.get('submissionId'),comments:data.get('comments'),decision:data.get('decision')});if(window.__feedbackThrows)throw Error('Synthetic feedback exception');if(window.__deferFeedback)return new Promise(r=>window.__resolveFeedback=r);return {success:!!window.__feedbackSuccess,message:window.__feedbackSuccess?'Synthetic saved':'Synthetic safe failure'}}`, loader: 'tsx', resolveDir: process.cwd() }));
        } }],
    });
    const edge = process.env.THESISHS_P2C_EDGE === '1';
    const browser = await chromium.launch({ headless: true, ...(edge ? {executablePath:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'} : {}) });
    try {
        const context = await browser.newContext({ viewport: { width: 1920, height: 1000 }, acceptDownloads: false });
        let page = await context.newPage();
        const errors = [], unexpected = [];
        const watchErrors = target => {
            target.on('pageerror', error => errors.push(error.name));
            target.on('console', message => { if (message.type() === 'error') errors.push('console-error'); });
        };
        watchErrors(page);
        const syntheticRoute = route => {
            const host = new URL(route.request().url()).hostname;
            if (host === 'workspace.invalid') return route.fulfill({ contentType: 'text/html', body: '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' });
            if (host === 'pdf.invalid') return route.fulfill({ contentType: 'text/html', body: '<p>Synthetic viewer response. Native PDF compatibility is owner-reported separately.</p>' });
            unexpected.push('unexpected request'); return route.abort();
        };
        await context.route('**/*', syntheticRoute);
        async function loadApp(fakeClock) {
            await page.goto('http://workspace.invalid');
            if (fakeClock) { await page.clock.install(); await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now() + 100))); }
            // Assert token propagation without downloading or impersonating real Manrope assets.
            await page.addStyleTag({ content: `*{box-sizing:border-box}:root{--font-manrope:"Manrope test fallback",Arial}body,h1,h2,h3,p,dl,dd{margin:0}button,input,textarea,select{font:inherit}label{display:block}` + readFileSync('app/globals.css', 'utf8').replace(/^@import.*$/m, '') + bundle.outputFiles.find(f => f.path.endsWith('.css')).text });
            await page.addScriptTag({ content: bundle.outputFiles.find(f => f.path.endsWith('.js')).text });
        }
        await loadApp(false);
        if (process.env.THESISHS_P2C_TOAST_ONLY === '1') {
            await page.close(); page = await context.newPage(); watchErrors(page); await loadApp(true);
            await expect(page.getByRole('button', { name: 'Preview PDF', exact: true })).toBeVisible();
            await toastChecks.desktop(page);
            assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
            console.log(`PASS focused toast fixture in ${browser.version()}`);
            return;
        }
        await expect(page.getByRole('button', { name: 'Preview PDF', exact: true })).toBeVisible();
        assert.deepEqual(await page.evaluate(() => window.__signCalls), []);
        await expect(page.locator('iframe')).toHaveCount(0);

        await toolbarChecks.desktop(page);

        // Rich-text behavior on native browser editing/undo, never a live research record.
        const editor = page.getByRole('textbox', {name:'Feedback Comments',exact:true});
        await editor.fill('Synthetic formatting');
        await editor.press('ControlOrMeta+a');
        for (const label of ['Bold','Italic','Underline']) {
            await page.getByRole('button',{name:label,exact:true}).click();
            await expect(page.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','true');
        }
        const formatted = await editor.evaluate(root => window.__feedbackCodec.encodeFeedback(window.__readEditor(root)));
        assert.equal(await page.evaluate(value => window.__feedbackCodec.validateFeedback(value),formatted),null);
        await page.getByRole('button',{name:'Review & Confirm Decision',exact:true}).click();
        const confirmation = page.getByRole('region',{name:'Confirm decision: Revision Required',exact:true});
        await expect(confirmation.locator('strong em u')).toHaveText('Synthetic formatting');
        assert.equal(await page.evaluate(()=>window.__feedbackCalls.length),0);
        await page.getByRole('button',{name:'Back to Edit',exact:true}).click();
        assert.equal(await editor.evaluate(root=>window.__feedbackCodec.encodeFeedback(window.__readEditor(root))),formatted);
        await editor.press('ControlOrMeta+a');
        for (const label of ['Bold','Italic','Underline']) await page.getByRole('button',{name:label,exact:true}).click();
        assert.equal(await editor.evaluate(root=>window.__feedbackCodec.encodeFeedback(window.__readEditor(root))),'Synthetic formatting');
        // Keyboard-only command, toolbar focus and undo/redo retain the selection and draft.
        await editor.press('ControlOrMeta+a'); await editor.press('ControlOrMeta+b');
        await expect(page.getByRole('button',{name:'Bold',exact:true})).toHaveAttribute('aria-pressed','true');
        await editor.press('ControlOrMeta+z'); await expect(editor.locator('b,strong')).toHaveCount(0);
        await editor.press('ControlOrMeta+Shift+z'); await expect(editor.locator('b,strong')).toHaveCount(1);
        await editor.press('ControlOrMeta+a');
        await page.getByRole('button',{name:'Underline',exact:true}).focus();
        await page.keyboard.press('Space');
        await expect(editor.locator('u')).toHaveText('Synthetic formatting');
        await editor.fill('First item'); await editor.press('ControlOrMeta+End');
        await page.getByRole('button',{name:'Bulleted list',exact:true}).click();
        await expect(page.getByRole('button',{name:'Bulleted list',exact:true})).toHaveAttribute('aria-pressed','true');
        await page.getByRole('button',{name:'Bulleted list',exact:true}).click();
        await expect(editor.locator('ul')).toHaveCount(0);
        await page.getByRole('button',{name:'Bulleted list',exact:true}).click();
        await editor.press('End'); await editor.press('Enter'); await page.keyboard.type('Second item');
        await expect(editor.locator('ul > li')).toHaveCount(2);
        await editor.press('Enter'); await editor.press('Enter'); await page.keyboard.type('Final paragraph');
        await expect(editor).toContainText('Final paragraph');
        assert.equal(await editor.evaluate(root=>window.__readEditor(root).blocks.some(block=>block.type==='paragraph')),true);
        await editor.fill('Number one'); await editor.press('ControlOrMeta+End');
        await page.getByRole('button',{name:'Numbered list',exact:true}).click();
        await expect(page.getByRole('button',{name:'Numbered list',exact:true})).toHaveAttribute('aria-pressed','true');
        await page.getByRole('button',{name:'Numbered list',exact:true}).click();
        await expect(editor.locator('ol')).toHaveCount(0);
        await page.getByRole('button',{name:'Numbered list',exact:true}).click();
        await editor.press('End'); await editor.press('Enter'); await page.keyboard.type('Number two');
        await expect(editor.locator('ol > li')).toHaveCount(2);
        await editor.press('Home'); await editor.press('Backspace');
        await expect(editor).toContainText('Number two');
        // External rich HTML and media never enter the DOM; readable plain text survives.
        await editor.fill('');
        await editor.evaluate(root=>{const data=new DataTransfer();data.setData('text/plain','Safe pasted text');data.setData('text/html','<img src="https://evil.invalid/x" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">Safe pasted text</a>');root.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));});
        await expect(editor).toHaveText('Safe pasted text');
        await expect(editor.locator('img,script,a,iframe,table')).toHaveCount(0);
        await editor.fill(' '.repeat(10)); await page.getByRole('button',{name:'Review & Confirm Decision',exact:true}).click();
        await expect(page.getByRole('button',{name:'Confirm & Submit',exact:true})).toHaveCount(0);
        await editor.fill('x'.repeat(5001)); await page.getByRole('button',{name:'Review & Confirm Decision',exact:true}).click();
        await expect(page.getByRole('button',{name:'Confirm & Submit',exact:true})).toHaveCount(0);
        await editor.fill('Synthetic saved formatting'); await editor.press('ControlOrMeta+a');
        if (!await editor.evaluate(()=>document.queryCommandState('bold'))) await page.getByRole('button',{name:'Bold',exact:true}).click();
        await page.getByRole('button',{name:'Bulleted list',exact:true}).click();
        await editor.press('End'); await editor.press('Enter'); await page.keyboard.type('Second saved item');
        await page.getByLabel('Review Decision',{exact:true}).selectOption('Approved');
        const savedDraft = await editor.evaluate(root=>window.__feedbackCodec.encodeFeedback(window.__readEditor(root)));
        assert.ok(await editor.evaluate(root=>window.__readEditor(root).blocks.some(block=>block.type==='bulletList')), await editor.evaluate(root=>root.innerHTML));
        await page.getByRole('button',{name:'Review & Confirm Decision',exact:true}).click();
        await expect(page.getByRole('region',{name:'Confirm decision: Approved',exact:true}).locator('ul > li')).toHaveCount(2);
        await page.setViewportSize({width:390,height:844});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.screenshot({path:join(tmpdir(),'thesishs-p2c3b-confirmation.png'),fullPage:true});
        await page.getByRole('button',{name:'Back to Edit',exact:true}).click();
        assert.equal(await editor.evaluate(root=>window.__feedbackCodec.encodeFeedback(window.__readEditor(root))),savedDraft);
        await page.getByRole('button',{name:'Review & Confirm Decision',exact:true}).click();
        // A formatting-only change must invalidate the snapshot too.
        await editor.press('ControlOrMeta+a'); await page.getByRole('button',{name:'Italic',exact:true}).click();
        await expect(page.getByRole('button',{name:'Confirm & Submit',exact:true})).toHaveCount(0);
        await page.getByRole('button',{name:'Review & Confirm Decision',exact:true}).click();
        const finalDraft = await editor.evaluate(root=>window.__feedbackCodec.encodeFeedback(window.__readEditor(root)));
        await page.getByRole('button',{name:'Confirm & Submit',exact:true}).click();
        await expect(page.getByText('Synthetic safe failure',{exact:true})).toBeVisible();
        assert.equal(await editor.evaluate(root=>window.__feedbackCodec.encodeFeedback(window.__readEditor(root))),finalDraft);
        await page.evaluate(()=>window.__feedbackSuccess=true);
        await page.getByRole('button',{name:'Review & Confirm Decision',exact:true}).click();
        await page.getByRole('button',{name:'Confirm & Submit',exact:true}).evaluate(button=>{button.click();button.click()});
        await expect(page.getByRole('region',{name:'Recorded feedback for v1',exact:true}).locator('ul > li')).toHaveCount(2);
        assert.equal(await page.evaluate(()=>window.__feedbackCalls.length),2);
        assert.equal(await page.evaluate(()=>window.__storedFeedback),finalDraft);
        await expect(editor).toHaveCount(0);
        await page.evaluate(()=>window.showStudentFeedback());
        await expect(page.getByRole('region',{name:'Submission History',exact:true}).locator('ul > li')).toHaveCount(2);
        await expect(page.locator('#feedback-1 strong')).toContainText(['Synthetic saved formatting','Second saved item']);
        await page.evaluate(()=>window.showStudentOverview());
        await expect(page.getByRole('heading',{name:'Latest Feedback',exact:true})).toBeVisible();
        await expect(page.locator('ul > li')).toHaveCount(2);
        await page.evaluate(()=>{window.__storedFeedback='**Legacy** <script>alert(1)</script>';window.showStudentFeedback()});
        await expect(page.locator('#feedback-1')).toContainText('**Legacy** <script>alert(1)</script>');
        await expect(page.locator('#feedback-1 script')).toHaveCount(0);
        await page.evaluate(()=>{window.__storedFeedback=window.__feedbackCodec.encodeFeedback({version:1,blocks:[{type:'paragraph',content:[{text:'<img src=x onerror=alert(1)> javascript:alert(1)',bold:true}]}]});window.showStudentFeedback()});
        await expect(page.locator('#feedback-1 strong')).toContainText(['<img src=x onerror=alert(1)>']);
        await expect(page.locator('#feedback-1 img,#feedback-1 script,#feedback-1 a')).toHaveCount(0);
        await page.evaluate(()=>{window.__feedbackSuccess=false;window.__feedbackCalls=[];window.render(2)});
        await expect(page.getByLabel('Feedback Comments',{exact:true})).toBeVisible();
        await page.evaluate(()=>window.render(1));
        await expect(page.getByLabel('Submission version',{exact:true})).toHaveValue('1');
        await page.setViewportSize({width:1920,height:1000});

        await page.getByLabel('Feedback Comments', { exact: true }).fill('Synthetic two-phase review');
        await page.getByRole('button', { name: 'Review & Confirm Decision', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Back to Edit', exact: true })).toBeFocused();
        await page.getByRole('button', { name: 'Back to Edit', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Review & Confirm Decision', exact: true })).toBeFocused();
        await expect(page.getByLabel('Feedback Comments', { exact: true })).toHaveText('Synthetic two-phase review');
        assert.equal(await page.evaluate(() => window.__feedbackCalls.length), 0);
        await page.getByLabel('Feedback Comments', { exact: true }).fill('');

        // Exercise real browser timers in a page that never installs a fake clock.
        const nativePopupPromise = context.waitForEvent('page');
        await page.getByRole('button', { name: 'Open PDF Separately', exact: true }).click();
        const nativePopup = await nativePopupPromise;
        await nativePopup.waitForURL('https://pdf.invalid/synthetic-1.pdf');
        assert.equal(await nativePopup.evaluate(() => window.opener), null);
        await nativePopup.close();
        await expect(page.getByText('Temporary PDF access is ready.', { exact: false })).toBeVisible();
        await page.evaluate(() => window.render(2));
        await expect(page.getByText('Choose preview or separate view.', { exact: true })).toBeVisible();
        await page.close();
        page = await context.newPage(); watchErrors(page);
        // React's scheduler must initialize with the same clock used throughout a page.
        await loadApp(true);
        await expect(page.getByRole('button', { name: 'Preview PDF', exact: true })).toBeVisible();
        assert.deepEqual(await page.evaluate(() => window.__signCalls), []);
        await toastChecks.desktop(page);

        const rects = () => page.evaluate(() => {
            const a = document.querySelector('section[aria-labelledby="document-heading"]').getBoundingClientRect(), b = document.querySelector('section[aria-labelledby="review-heading"]').getBoundingClientRect();
            return { document: { x: a.x, y: a.y, width: a.width }, review: { x: b.x, y: b.y, width: b.width }, mainWidth:document.querySelector('main').getBoundingClientRect().width, fits: document.documentElement.scrollWidth <= innerWidth };
        });
        let layout = await rects(); assert.ok(Math.abs(layout.document.y - layout.review.y) < 2);
        assert.ok(Math.abs(layout.document.width / (layout.document.width + layout.review.width) - .58) < .005);
        assert.ok(layout.mainWidth > 1280); assert.ok(layout.fits);
        await expect(page.getByRole('heading', { name: 'Synthetic workspace test research' })).toBeVisible();
        await expect(page.getByText('Synthetic Student', { exact: true })).toBeVisible();
        await expect(page.getByText('Synthetic remarks only.', { exact: true })).toBeVisible();
        const criteria = page.getByRole('region', { name: 'Assessment Criteria', exact: true });
        await expect(criteria).toBeVisible();
        await expect(criteria).toContainText('planned and is not yet available');
        await expect(criteria.locator('button,input,select,textarea,[role="checkbox"]')).toHaveCount(0);
        assert.equal(await page.locator('time').first().getAttribute('datetime'), '2026-10-31T00:00:00.000Z');
        await page.getByLabel('Feedback Comments', { exact: true }).fill('Synthetic retained feedback');
        await page.getByLabel('Review Decision', { exact: true }).selectOption('Approved');
        await page.setViewportSize({ width: 740, height: 900 }); layout = await rects();
        assert.ok(layout.review.y > layout.document.y); assert.ok(layout.fits);
        await expect(page.getByLabel('Feedback Comments', { exact: true })).toHaveText('Synthetic retained feedback');
        await page.setViewportSize({ width: 390, height: 844 }); layout = await rects();
        assert.ok(layout.review.y > layout.document.y); assert.ok(layout.fits);
        await expect(page.getByLabel('Feedback Comments', { exact: true })).toHaveText('Synthetic retained feedback');
        await page.screenshot({ path: join(tmpdir(), 'thesishs-p2c3a-mobile.png'), fullPage: true });

        await page.evaluate(() => window.hide());
        await expect(page.getByLabel('Feedback Comments', { exact: true })).not.toBeVisible();
        await page.evaluate(() => window.render(1, 'Under Review', 'standalone'));
        await expect(page.getByLabel('Feedback Comments', { exact: true })).toHaveText('Synthetic retained feedback');
        await expect.poll(() => page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; })).toBe(true);
        await expect(page.getByLabel('Review Decision', { exact: true })).toHaveValue('Approved');
        await page.setViewportSize({ width: 1500, height: 900 });
        await page.evaluate(() => window.render(1, 'Under Review', 'browser'));
        await expect.poll(async () => (await rects()).review.y > (await rects()).document.y).toBe(true);
        assert.ok((await rects()).mainWidth <= 1100);
        await expect(page.getByLabel('Feedback Comments', { exact: true })).toHaveText('Synthetic retained feedback');

        page.once('dialog', dialog => dialog.dismiss()); await page.getByLabel('Submission version', { exact: true }).selectOption('2');
        await expect(page.getByLabel('Submission version', { exact: true })).toHaveValue('1');
        assert.equal(await page.evaluate(() => window.__navigation), undefined);
        page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('link', { name: 'Back to Submissions' }).click();
        assert.equal(await page.evaluate(() => window.__navigation), undefined);
        page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Logout', exact: true }).click();
        assert.equal(await page.evaluate(() => window.__logout), 0);
        assert.equal(await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; }), true);
        page.once('dialog', dialog => dialog.accept()); await page.getByLabel('Submission version', { exact: true }).selectOption('2');
        assert.equal(await page.evaluate(() => window.__navigation), '/dashboard/adviser/submissions/2');

        await page.evaluate(() => window.__deferFeedback = true);
        await page.getByLabel('Feedback Comments', { exact: true }).fill('');
        await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
        await expect(page.getByRole('button', { name: 'Confirm & Submit', exact: true })).toHaveCount(0);
        await page.getByLabel('Feedback Comments', { exact: true }).fill('Synthetic retained feedback');
        await page.getByRole('button', { name: 'Review & Confirm Decision', exact: true }).click();
        await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
        assert.equal(await page.evaluate(() => window.__feedbackCalls.length), 0);
        await expect(page.getByRole('heading', { name: 'Confirm decision: Approved', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Back to Edit', exact: true })).toBeFocused();
        await expect(page.getByRole('region', { name: 'Confirm decision: Approved', exact: true })).toContainText('Synthetic retained feedback');
        await page.setViewportSize({ width: 390, height: 844 });
        assert.ok((await rects()).fits);
        await page.screenshot({ path: join(tmpdir(), 'thesishs-p2c3a-confirmation.png'), fullPage: true });
        await page.setViewportSize({ width: 1500, height: 900 });
        await page.clock.fastForward(60_000);
        assert.equal(await page.evaluate(() => window.__feedbackCalls.length), 0);
        await expect(page.getByRole('button', { name: 'Confirm & Submit', exact: true })).toBeEnabled();
        await page.getByRole('button', { name: 'Back to Edit', exact: true }).click();
        assert.equal(await page.evaluate(() => window.__feedbackCalls.length), 0);
        await expect(page.getByLabel('Feedback Comments', { exact: true })).toHaveText('Synthetic retained feedback');
        await expect(page.getByLabel('Review Decision', { exact: true })).toHaveValue('Approved');

        for (const change of ['comments', 'decision', 'navigation', 'unload', 'activity', 'unmount']) {
            await page.getByRole('button', { name: 'Review & Confirm Decision', exact: true }).click();
            await expect(page.getByRole('button', { name: 'Confirm & Submit', exact: true })).toBeVisible();
            if (change === 'comments') await page.getByLabel('Feedback Comments', { exact: true }).fill('Synthetic changed feedback');
            if (change === 'decision') await page.getByLabel('Review Decision', { exact: true }).selectOption('Revision Required');
            if (change === 'navigation') {
                page.once('dialog', dialog => dialog.accept());
                await page.getByLabel('Submission version', { exact: true }).selectOption('2');
                assert.equal(await page.evaluate(() => window.__navigation), '/dashboard/adviser/submissions/2');
            }
            if (change === 'activity') {
                await page.evaluate(() => window.hide());
                await expect(page.getByLabel('Feedback Comments', { exact: true })).not.toBeVisible();
            }
            if (change === 'unmount') await page.evaluate(() => window.render(2));
            if (change === 'unload') await page.evaluate(() => window.dispatchEvent(new Event('beforeunload', { cancelable: true })));
            assert.equal(await page.evaluate(() => window.__feedbackCalls.length), 0, change + ' must invalidate confirmation');
            if (change === 'activity' || change === 'unmount') await page.evaluate(() => window.render(1));
            await expect(page.getByRole('button', { name: 'Review & Confirm Decision', exact: true })).toBeEnabled();
            await expect(page.getByRole('button', { name: 'Confirm & Submit', exact: true })).toHaveCount(0);
            await page.getByLabel('Feedback Comments', { exact: true }).fill('Synthetic retained feedback');
        }
        await page.getByLabel('Review Decision', { exact: true }).selectOption('Approved');
        await page.getByRole('button', { name: 'Review & Confirm Decision', exact: true }).click();
        assert.equal(await page.evaluate(() => window.__feedbackCalls.length), 0);
        // Two synchronous activation attempts must consume this snapshot only once.
        await page.getByRole('button', { name: 'Confirm & Submit', exact: true }).evaluate(button => { button.click(); button.click(); });
        assert.equal(await page.evaluate(() => window.__feedbackCalls.length), 1);
        assert.deepEqual(await page.evaluate(() => window.__feedbackCalls[0]), {id:'1',comments:'Synthetic retained feedback',decision:'Approved'});
        await expect(page.getByRole('button', { name: 'Back to Edit', exact: true })).toHaveCount(0);
        await expect(page.getByLabel('Feedback Comments', { exact: true })).toBeDisabled();
        await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
        assert.equal(await page.evaluate(() => window.__feedbackCalls.length), 1);
        page.once('dialog', dialog => dialog.dismiss());
        await page.getByLabel('Submission version', { exact: true }).selectOption('2');
        await expect(page.getByLabel('Submission version', { exact: true })).toHaveValue('1');
        await page.evaluate(() => window.__resolveFeedback({ success: false, message: 'Synthetic safe failure' }));
        await expect(page.getByLabel('Feedback Comments', { exact: true })).toHaveText('Synthetic retained feedback');
        await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Review & Confirm Decision', exact: true })).toBeEnabled();
        await page.evaluate(() => window.__feedbackThrows = true);
        await page.getByRole('button', { name: 'Review & Confirm Decision', exact: true }).click();
        await page.getByRole('button', { name: 'Confirm & Submit', exact: true }).click();
        await expect(page.getByText('The feedback could not be submitted.', { exact: true })).toBeVisible();
        await expect(page.getByLabel('Feedback Comments', { exact: true })).toHaveText('Synthetic retained feedback');
        await page.evaluate(() => window.__feedbackThrows = false);
        await page.getByRole('button', { name: 'Review & Confirm Decision', exact: true }).click();
        await page.getByRole('button', { name: 'Confirm & Submit', exact: true }).click();
        assert.equal(await page.evaluate(() => window.__feedbackCalls.length), 3);
        await page.evaluate(() => window.__resolveFeedback({ success: true, message: 'Synthetic saved' }));
        await expect(page.getByText('The recorded decision is read-only.', { exact: false })).toBeVisible();
        await expect(page.getByLabel('Feedback Comments', { exact: true })).toHaveCount(0);
        await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0);
        await expect(page.getByRole('region', { name: 'Assessment Criteria', exact: true })).toHaveCount(0);
        assert.equal(await page.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; }), false);

        await page.evaluate(() => { window.render(1, 'Under Review', 'standalone'); window.__deferSigning = true; });
        await page.getByRole('button', { name: 'Preview PDF', exact: true }).click();
        await page.evaluate(() => window.render(2, 'Under Review', 'standalone'));
        await expect(page.getByRole('button', { name: 'Preview PDF', exact: true })).toBeEnabled();
        await expect(page.getByLabel('Feedback Comments', { exact: true })).toHaveText('');
        await page.evaluate(() => { window.__resolveSigning('https://pdf.invalid/stale.pdf'); window.__deferSigning = false; });
        await expect(page.locator('iframe')).toHaveCount(0);
        await page.getByRole('button', { name: 'Preview PDF', exact: true }).click();
        await expect(page.locator('iframe')).toHaveAttribute('src', 'https://pdf.invalid/synthetic-2.pdf');
        await expect(page.locator('iframe')).toHaveAttribute('referrerpolicy', 'no-referrer');
        await expect(page.locator('iframe')).toHaveAttribute('title', 'Research submission 2, v2 PDF');
        await expect(page.locator('iframe')).not.toHaveAttribute('sandbox', /.*/);
        await expect(page.getByText('If the PDF is not visible above, open it separately.', { exact: true })).toBeVisible();
        await page.setViewportSize({ width: 1920, height: 1000 });
        await page.evaluate(() => window.render(2, 'Under Review', 'standalone'));
        await expect.poll(async () => (await rects()).mainWidth > 1280).toBe(true);
        const frameHeight = await page.locator('iframe').evaluate(frame => frame.getBoundingClientRect().height);
        assert.ok(frameHeight >= 815 && frameHeight <= 825, 'Wide standalone viewer should use 82dvh');
        const alignment = await page.evaluate(() => ({
            pdf: document.querySelector('iframe').getBoundingClientRect().top,
            review: document.querySelector('section[aria-labelledby="review-heading"] form').getBoundingClientRect().top,
            headings: [document.querySelector('#document-heading').getBoundingClientRect().top, document.querySelector('#review-heading').getBoundingClientRect().top]
        }));
        assert.ok(Math.abs(alignment.pdf - alignment.review) < 2, 'Reading surface and review working body must share a grid row');
        assert.ok(Math.abs(alignment.headings[0] - alignment.headings[1]) < 2, 'Panel headings must align');
        assert.ok(await page.getByRole('button', { name: 'Preview PDF', exact: true }).evaluate(button => button.getBoundingClientRect().height >= 36));
        const typography = await page.evaluate(() => {
            const probe = document.createElement('input'); document.querySelector('main').append(probe);
            const families = ['body','h1','button','input','select','[role="textbox"]'].map(selector => getComputedStyle(document.querySelector(selector)).fontFamily);
            probe.remove(); return families;
        });
        assert.ok(typography.every(family => family === typography[0] && family.includes('Manrope test fallback')));
        await page.getByLabel('Submission version', { exact: true }).focus();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('button', { name: 'Preview PDF', exact: true })).toBeFocused();
        assert.equal(await page.locator(':focus').evaluate(element => getComputedStyle(element).outlineStyle), 'solid');
        const themeSignCalls = await page.evaluate(() => window.__signCalls.length);
        await page.getByLabel('Feedback Comments', { exact: true }).fill('Synthetic theme-retained draft');
        for (const theme of ['Light', 'Dark', 'System']) {
            if (theme === 'System') await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
            await page.getByRole('button', { name: 'Change theme', exact: true }).click();
            await page.getByRole('menuitemradio', { name: theme, exact: true }).click();
            await expect(page.locator('html')).toHaveAttribute('data-theme', theme === 'Light' ? 'light' : 'dark');
            await expect(page.getByLabel('Feedback Comments', { exact: true })).toHaveText('Synthetic theme-retained draft');
            assert.equal(await page.locator('iframe').evaluate(frame => frame.getBoundingClientRect().height), frameHeight);
            const ratios = await page.evaluate(() => {
                const style = getComputedStyle(document.documentElement);
                const luminance = token => {
                    const hex = style.getPropertyValue(token).trim().slice(1);
                    const rgb = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
                        .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
                    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
                };
                const ratio = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
                return [ratio('--foreground', '--surface'), ratio('--muted', '--surface'), ratio('--on-action', '--action')];
            });
            assert.ok(ratios.every(ratio => ratio >= 4.5), 'Reused text tokens must retain AA contrast in each theme');
            await page.screenshot({ path: join(tmpdir(), 'thesishs-p2c3a-' + theme.toLowerCase() + '.png'), fullPage: true });
        }
        assert.equal(await page.evaluate(() => window.__signCalls.length), themeSignCalls, 'Theme changes must not sign or remount access');
        await page.evaluate(() => localStorage.clear());
        const calls = await page.evaluate(() => window.__signCalls.length);
        await page.clock.fastForward(240_001);
        await expect(page.locator('iframe')).toHaveCount(1);
        assert.equal(await page.evaluate(() => window.__signCalls.length), calls);
        await page.clock.fastForward(1_440_000);
        await expect(page.locator('iframe')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Renew PDF Access', exact: true })).toBeVisible();
        assert.equal(await page.evaluate(() => window.__signCalls.length), calls);
        await page.getByRole('button', { name: 'Renew PDF Access', exact: true }).click();
        await expect(page.locator('iframe')).toHaveCount(1);
        const popupPromise = context.waitForEvent('page');
        await page.getByRole('button', { name: 'Open PDF Separately', exact: true }).click();
        const popup = await popupPromise; await popup.waitForURL('https://pdf.invalid/synthetic-2.pdf');
        assert.equal(await popup.evaluate(() => window.opener), null); await popup.close();
        await page.clock.setSystemTime(new Date(await page.evaluate(() => Date.now() + 1_680_001)));
        await page.evaluate(() => window.dispatchEvent(new Event('focus')));
        await expect(page.locator('iframe')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Renew PDF Access', exact: true })).toBeVisible();
        await page.evaluate(() => { window.render(1, 'Approved', 'browser'); window.__signDenied = true; });
        await expect(page.getByRole('button', { name: 'Preview PDF', exact: true })).toBeEnabled();
        await page.getByRole('button', { name: 'Preview PDF', exact: true }).click();
        await expect(page.getByText('PDF access is unavailable. Try again or open the PDF separately.', { exact: true })).toBeVisible();
        await page.evaluate(() => { window.render(2, 'Approved', 'browser'); window.__signDenied = false; });
        await expect(page.getByRole('button', { name: 'Preview PDF', exact: true })).toBeEnabled();
        const freshPopupPromise = context.waitForEvent('page');
        await page.getByRole('button', { name: 'Open PDF Separately', exact: true }).click();
        const freshPopup = await freshPopupPromise;
        await freshPopup.waitForURL('https://pdf.invalid/synthetic-2.pdf');
        assert.equal(await freshPopup.evaluate(() => window.opener), null);
        await expect(page.locator('iframe')).toHaveCount(0);
        await freshPopup.close();

        // Each failure uses a fresh controller and must close only its own placeholder.
        for (const failure of ['denied', 'throw', 'timer']) {
            await page.evaluate(kind => {
                window.render(window.__current.id === 1 ? 2 : 1, 'Approved', 'browser');
                window.__signDenied = kind === 'denied'; window.__signThrows = kind === 'throw';
                if (kind === 'timer') {
                    window.__savedTimer = window.setTimeout;
                    window.setTimeout = function(fn, delay, ...args) {
                        if (delay > 1_600_000 && delay <= 1_680_000) throw new TypeError('Synthetic timer initialization failure');
                        return window.__savedTimer(fn, delay, ...args);
                    };
                }
            }, failure);
            await expect(page.getByText('Choose preview or separate view.', { exact: true })).toBeVisible();
            const failedPopupPromise = context.waitForEvent('page');
            await page.getByRole('button', { name: 'Open PDF Separately', exact: true }).click();
            const failedPopup = await failedPopupPromise;
            await expect.poll(() => failedPopup.isClosed()).toBe(true);
            await expect(page.getByText('PDF access is unavailable.', { exact: false })).toBeVisible();
            await expect(page.getByRole('alert')).toHaveText('PDF access could not be opened. Try again or use Preview PDF.');
            await expect(page.getByRole('button', { name: 'Preview PDF', exact: true })).toBeEnabled();
            await page.evaluate(() => {
                window.__signDenied = false; window.__signThrows = false;
                if (window.__savedTimer) { window.setTimeout = window.__savedTimer; delete window.__savedTimer; }
            });
        }

        const signsBeforeBlock = await page.evaluate(() => window.__signCalls.length);
        await page.evaluate(() => { window.__savedOpen = window.open; window.open = () => null; });
        await page.getByRole('button', { name: 'Open PDF Separately', exact: true }).click();
        await expect(page.getByRole('alert')).toContainText('The new tab was blocked.');
        assert.equal(await page.evaluate(() => window.__signCalls.length), signsBeforeBlock);
        await page.evaluate(() => { window.open = window.__savedOpen; delete window.__savedOpen; window.__deferSigning = true; });

        const disposedPopupPromise = context.waitForEvent('page');
        await page.getByRole('button', { name: 'Open PDF Separately', exact: true }).click();
        const disposedPopup = await disposedPopupPromise;
        await expect(page.getByRole('button', { name: 'Requesting PDF...', exact: true })).toBeDisabled();
        await page.evaluate(() => window.render(window.__current.id === 1 ? 2 : 1, 'Approved', 'browser'));
        await expect.poll(() => disposedPopup.isClosed()).toBe(true);
        await page.evaluate(() => { window.__resolveSigning('https://pdf.invalid/stale.pdf'); window.__deferSigning = false; });
        await expect(page.getByText('Choose preview or separate view.', { exact: true })).toBeVisible();
        await expect(page.getByRole('alert')).toHaveCount(0);
        await expect(page.locator('iframe')).toHaveCount(0);
        assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
        await page.evaluate(() => window.render(1));
        await expect(page.getByLabel('Feedback Comments', { exact: true })).toBeEnabled();
        await page.getByLabel('Feedback Comments', { exact: true }).fill('Synthetic late-response test');
        await page.getByRole('button', { name: 'Review & Confirm Decision', exact: true }).click();
        await page.getByRole('button', { name: 'Confirm & Submit', exact: true }).click();
        const refreshes = await page.evaluate(() => window.__refreshes);
        await page.evaluate(() => window.render(2));
        await expect(page.getByLabel('Feedback Comments', { exact: true })).toHaveText('');
        await page.evaluate(() => window.__resolveFeedback({success:true,message:'Synthetic old success'}));
        assert.equal(await page.evaluate(() => window.__refreshes), refreshes);
        await expect(page.getByLabel('Feedback Comments', { exact: true })).toHaveText('');
        await page.getByLabel('Feedback Comments', { exact: true }).fill('Synthetic pending Activity test');
        await page.getByRole('button', { name: 'Review & Confirm Decision', exact: true }).click();
        await page.getByRole('button', { name: 'Confirm & Submit', exact: true }).click();
        const pendingCalls = await page.evaluate(() => window.__feedbackCalls.length);
        await page.evaluate(() => window.hide());
        await expect(page.getByLabel('Feedback Comments', { exact: true })).not.toBeVisible();
        await page.evaluate(() => window.render(2));
        await expect(page.getByRole('button', { name: 'Review outcome unknown', exact: true })).toBeDisabled();
        await expect(page.getByText('The previous request may have been sent. Reload this submission to check its status.', { exact: true })).toBeVisible();
        await expect(page.getByLabel('Feedback Comments', { exact: true })).toHaveText('Synthetic pending Activity test');
        await expect(page.getByLabel('Feedback Comments', { exact: true })).toBeDisabled();
        await page.evaluate(() => window.__resolveFeedback({success:true,message:'Synthetic hidden success'}));
        await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
        assert.equal(await page.evaluate(() => window.__feedbackCalls.length), pendingCalls);
        assert.equal(await page.evaluate(() => window.__refreshes), refreshes);
        await page.evaluate(() => { window.__current.mode = 'standalone'; window.showUnrelated(); });
        await expect(page.getByText('Unrelated page width check', { exact: true })).toBeVisible();
        assert.equal(await page.locator('main').evaluate(element => element.getBoundingClientRect().width), 1280, 'Other routes keep the P.1 width');
        const touchContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,acceptDownloads:false});
        await touchContext.route('**/*',syntheticRoute);
        page=await touchContext.newPage();watchErrors(page);await loadApp(false);
        await expect(page.getByRole('button',{name:'Bold',exact:true})).toBeVisible();
        await toolbarChecks.touch(page,touchContext);await toastChecks.touch(page,touchContext);await touchContext.close();
        await toolbarChecks.hydration(context);
        assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
        console.log(`Browser engine: ${edge?'Microsoft Edge':'Playwright Chromium'} ${browser.version()}; isolated synthetic route/services, native browser editing, emulated touch; no authenticated live application coverage.`);
        console.log('PASS official Warm Tooltip group/shortcuts/keyboard/collision/reduced-motion/theme checks, compact targets, native wheel/keyboard/emulated-touch scrolling, touch long-press safety, server rendering and React hydration.');
        console.log('PASS isolated synthetic UI: five rich-text controls/toggles, selection/keyboard/undo/redo, list Enter/Backspace and mixed blocks, safe paste/text rendering, visible-length/blank validation, formatted confirmation/Back/edit invalidation, exact-once mocked save and Adviser/Student history/dashboard read-back; retained PDF, two-phase, read-only, 58/42 alignment, themes/font/responsive regressions. Zero database/Storage access; native PDF, actual Manrope assets and non-Chromium editing remain owner-led checks. Screenshots in ' + tmpdir() + '/thesishs-p2c3*.png');
    } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
