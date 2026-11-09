/* eslint-disable @typescript-eslint/no-require-imports */
// Bounded extension of the existing synthetic component fixture pattern. All actions and network are isolated.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { build } = require('esbuild');
const { chromium, expect } = require('@playwright/test');
async function main() {
    const bundle=await build({write:false,outfile:'ui.js',bundle:true,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},
        stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`import React from 'react';import{createRoot}from'react-dom/client';import Main from './components/dashboard/main-delegation-panel';import Co from './components/dashboard/co-adviser-workspace';const root=createRoot(document.getElementById('root'));window.renderMain=(key=0)=>root.render(<main className="dashboard-page"><Main key={key} submissionId={1}/></main>);window.renderCo=(initial,key=0)=>root.render(<main className="dashboard-page"><Co key={key} initial={initial}/></main>);`},
        plugins:[{name:'synthetic-actions',setup(builder){builder.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'mock-link'}));builder.onLoad({filter:/.*/,namespace:'mock-link'},()=>({loader:'js',resolveDir:process.cwd(),contents:`import React from 'react';export default function Link({children,...props}){return React.createElement('a',props,children);}`}));builder.onResolve({filter:/^@\/lib\/actions\//},()=>({path:'actions',namespace:'mock'}));builder.onLoad({filter:/.*/,namespace:'mock'},()=>({loader:'js',contents:`
            window.__s33={calls:[],delay:0,fail:false,main:null,co:null};
            export async function getMainDelegationPanelAction(){if(window.__s33.delay)await new Promise(r=>setTimeout(r,window.__s33.delay));return {success:true,message:'Assignments loaded.',data:window.__s33.main};}
            export async function getCoAdviserWorkspaceAction(){return {success:true,message:'Assignments loaded.',data:window.__s33.co};}
            export async function getRecommendationForOfficialDraftAction(){return {success:false,message:'No editable draft in this fixture.'};}
            export async function delegateCoAdvisersAction(input){window.__s33.calls.push(['delegate',input]);await new Promise(r=>setTimeout(r,window.__s33.delay));if(window.__s33.fail)return {success:false,message:'Assignment changed. Reload before retrying.'};return {success:true,message:'Assigned.'};}
            export async function cancelCoAdviserAssignmentAction(input){window.__s33.calls.push(['cancel',input]);return {success:true,message:'Cancelled.'};}
            export async function submitCoAdviserRecommendationAction(input){window.__s33.calls.push(['recommend',input]);window.__s33.co.assignments=window.__s33.co.assignments.map(a=>a.id===input.assignmentId?{...a,state:'completed',reviewAvailable:false}:a);return {success:true,message:'Completed.'};}
            export async function getDelegatedDocumentUrlAction(input){window.__s33.calls.push(['pdf',input]);return null;}
        `}));}}]});
    const browser=await chromium.launch({headless:true});let groups=0;
    try {
        const page=await browser.newPage({viewport:{width:360,height:800}}),errors=[],requests=[];
        page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
        await page.setContent('<html data-theme="light"><body><div id="root"></div></body></html>');
        await page.addStyleTag({content:'@layer base {'+fs.readFileSync('node_modules/tailwindcss/preflight.css','utf8')+'}\n'+fs.readFileSync('app/globals.css','utf8')+'\n'+bundle.outputFiles.find(f=>f.path.endsWith('.css')).text});
        await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js')).text});
        const panel={eligible:true,advisers:[{id:30,name:'Synthetic Co',email:'co@example.invalid'},{id:31,name:'Synthetic Second',email:'second@example.invalid'}],assignments:[]};
        await page.evaluate(data=>{window.__s33.main=data;window.__s33.delay=200;window.renderMain();},panel);
        await expect(page.getByRole('status')).toHaveText('Loading assignments…');await expect(page.getByText('No Co-Adviser assignments for this version.')).toBeVisible();groups++;
        await page.getByRole('button',{name:'Delegate this version',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Delegate submission version',exact:true});
        await dialog.getByLabel('Eligible Co-Advisers').selectOption(['30','31']);await dialog.getByRole('button',{name:'Assign selected Advisers'}).click();
        await expect(dialog.getByRole('button',{name:'Saving…'})).toBeDisabled();await expect(dialog).toHaveCount(0);
        assert.deepEqual(await page.evaluate(()=>window.__s33.calls),[['delegate',{submissionId:1,coAdviserIds:[30,31]}]]);groups++;
        const assignment={id:5,coAdviserId:30,name:'Synthetic Co',state:'open',recommendation:null,createdAt:'2026-11-08T00:00:00.000Z',completedAt:null,closedAt:null,closureReason:null};
        await page.evaluate(({panel,assignment})=>{window.__s33.main={...panel,assignments:[assignment,{...assignment,id:6,coAdviserId:31,name:'Synthetic Second',state:'completed',recommendation:'Private <script>literal text</script>'}]};window.__s33.delay=0;window.renderMain(1);},{panel,assignment});
        await expect(page.getByText('Private <script>literal text</script>',{exact:true})).toBeVisible();
        await page.getByRole('button',{name:'Cancel assignment for Synthetic Co'}).click();dialog=page.getByRole('dialog',{name:'Cancel Co-Adviser assignment',exact:true});
        await expect(dialog).toContainText('previously issued link');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('button',{name:'Cancel assignment for Synthetic Co'})).toBeFocused();groups++;
        await page.getByRole('button',{name:'Cancel assignment for Synthetic Co'}).click();await dialog.getByRole('button',{name:'Confirm cancellation'}).click();await expect(dialog).toHaveCount(0);
        assert.deepEqual((await page.evaluate(()=>window.__s33.calls)).at(-1),['cancel',{submissionId:1,assignmentId:5,confirmed:true}]);groups++;
        await page.evaluate(panel=>{window.__s33.main=panel;window.__s33.fail=true;window.renderMain(2);},panel);
        await page.getByRole('button',{name:'Delegate this version',exact:true}).click();dialog=page.getByRole('dialog',{name:'Delegate submission version',exact:true});await dialog.getByLabel('Eligible Co-Advisers').selectOption('30');await dialog.getByRole('button',{name:'Assign selected Advisers'}).click();
        await expect(dialog.getByRole('status')).toContainText('Reload');await expect(dialog.getByRole('button',{name:'Assign selected Advisers'})).toBeDisabled();await dialog.getByRole('button',{name:'Reload assignments before retrying'}).click();await expect(dialog).toHaveCount(0);groups++;
        const co={email:'co@example.invalid',assignments:[{id:5,submissionId:1,title:'Synthetic manuscript',version:'v1',state:'open',reviewAvailable:true,createdAt:'2026-11-08T00:00:00.000Z',completedAt:null,closedAt:null},{id:7,submissionId:2,title:'Historical manuscript',version:'v2',state:'closed',reviewAvailable:false,createdAt:'2026-11-08T00:00:00.000Z',completedAt:null,closedAt:'2026-11-08T01:00:00.000Z'}]};
        await page.evaluate(data=>{window.__s33.co=data;window.renderCo(data);},co);
        await expect(page.getByRole('heading',{name:'Your Co-Adviser assignments'})).toBeVisible();await expect(page.getByRole('button',{name:'Open PDF (v1)',exact:true})).toHaveCount(1);await expect(page.getByRole('button',{name:'Open PDF (v2)',exact:true})).toHaveCount(0);
        await expect(page.getByText('Private <script>literal text</script>',{exact:true})).toHaveCount(0);groups++;
        await page.getByRole('button',{name:'Open PDF (v1)',exact:true}).click();await expect(page.getByText(/PDF access is unavailable/)).toBeVisible();assert.deepEqual((await page.evaluate(()=>window.__s33.calls)).at(-1),['pdf',{assignmentId:5,submissionId:1}]);groups++;
        await page.getByRole('button',{name:'Write recommendation for v1'}).focus();await page.keyboard.press('Enter');dialog=page.getByRole('dialog',{name:'Submit private recommendation',exact:true});
        await dialog.getByLabel('Plain-text recommendation').fill('Synthetic private recommendation');await expect(dialog.getByLabel('Plain-text recommendation')).toHaveAttribute('maxlength','20000');
        let confirmCount=0;const dismiss=async prompt=>{confirmCount++;await prompt.dismiss();};page.on('dialog',dismiss);await page.keyboard.press('Escape');await expect(dialog).toBeVisible();assert.equal(confirmCount,1);page.off('dialog',dismiss);groups++;
        await dialog.getByRole('button',{name:'Submit recommendation',exact:true}).click();await expect(dialog).toHaveCount(0);await expect(page.getByText('You have no open assignments available for review.')).toBeVisible();
        assert.deepEqual((await page.evaluate(()=>window.__s33.calls)).at(-1),['recommend',{assignmentId:5,submissionId:1,recommendation:'Synthetic private recommendation'}]);await expect(page.getByRole('button',{name:'Open PDF (v1)',exact:true})).toHaveCount(0);groups++;
        for(const [width,theme]of [[360,'light'],[1280,'dark']]){
            await page.setViewportSize({width,height:800});await page.evaluate(({co,theme,width})=>{document.documentElement.dataset.theme=theme;window.renderCo(co,width);},{co,theme,width});
            await expect(page.getByRole('heading',{name:'Your Co-Adviser assignments'})).toBeVisible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Co layout overflow');
            await page.screenshot({path:`test-results/s33/co-${width}-${theme}.png`});
            await page.evaluate(({panel,width})=>{window.__s33.main=panel;window.renderMain(width);},{panel,width});await expect(page.getByRole('button',{name:'Delegate this version',exact:true})).toBeVisible();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Main layout overflow');await page.screenshot({path:`test-results/s33/main-${width}-${theme}.png`});
        }groups++;
        assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);groups++;
        fs.writeFileSync('test-results/s33/browser-results.json',JSON.stringify({PASS:groups,FAIL:0,boundary:'Synthetic Chromium component rendering; actions mocked, all external requests blocked; no server/database/Storage'},null,2));
        console.log(`PASS ${groups} synthetic Chromium groups: Main delegation/cancellation/error states; restricted Co list/history/PDF denial; keyboard/draft/recommendation completion; responsive Light/Dark; zero external requests.`);
    } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
