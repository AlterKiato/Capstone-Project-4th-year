/* eslint-disable @typescript-eslint/no-require-imports */
// Real components and dialogs; synthetic action boundary. No application server or live resources.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {build}=require('esbuild');const {chromium,expect}=require('@playwright/test');
async function main(){
 const out='test-results/r1';fs.mkdirSync(out,{recursive:true});
 const bundle=await build({write:false,outfile:'r1.js',bundle:true,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
 import React from'react';import{createRoot}from'react-dom/client';import Progress from './components/dashboard/research-progress';
 const root=createRoot(document.getElementById('root'));let gen=0;window.render=paperId=>root.render(<main className='dashboard-page'><h1>Synthetic Research Progress Fixture</h1><Progress key={++gen} paperId={paperId}/></main>);
 `},plugins:[{name:'synthetic-action',setup(b){b.onResolve({filter:/^@\/lib\/actions\/research-progress.action$/},()=>({path:'actions',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:`
 window.model={canManage:true,denied:false,delay:0,calls:[],rows:[],submissions:[{id:1,version:'v1',status:'Revision Required'},{id:2,version:'v2',status:'Approved'}]};
 export async function readResearchProgressAction({paperId}){if(window.model.delay)await new Promise(r=>setTimeout(r,window.model.delay));return window.model.denied?{success:false,message:'Research progress is unavailable for this account or paper.'}:{success:true,data:{canManage:window.model.canManage,today:'2026-11-11',milestones:window.model.rows.filter(r=>r.paperId===paperId),submissions:paperId===1?window.model.submissions:[]}};}
 export async function mutateResearchProgressAction(input){window.model.calls.push(input);let row=window.model.rows.find(r=>r.id===input.milestoneId);if(input.operation==='create')window.model.rows.push({id:window.model.rows.length+1,paperId:input.paperId,title:input.title,dueDate:input.dueDate,submissionId:null,verifiedBy:null,verifiedAt:null,revision:0,evidence:null});
 else if(input.operation==='edit'){Object.assign(row,{title:input.title,dueDate:input.dueDate,verifiedBy:null,verifiedAt:null,revision:row.revision+1});}
 else if(input.operation==='link'){row.submissionId=input.submissionId;row.evidence=window.model.submissions.find(r=>r.id===input.submissionId);row.verifiedAt=null;row.verifiedBy=null;row.revision++;}
 else {row.verifiedAt='2026-11-11T01:00:00Z';row.verifiedBy=20;row.revision++;}return {success:true,message:'Saved'};}
 `}));}}]});
 const browser=await chromium.launch({headless:true,args:['--disable-gpu'],});let page;const errors=[],blocked=[];
 try{
 page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.request().url()==='http://r1.invalid/'?route.fulfill({contentType:'text/html',body:'<html data-theme="light"><body><div id="root"></div></body></html>'}):(blocked.push(route.request().url()),route.abort()));
 await page.goto('http://r1.invalid/');await page.addStyleTag({content:'@layer base {'+fs.readFileSync('node_modules/tailwindcss/preflight.css','utf8')+'}\n'+fs.readFileSync('app/globals.css','utf8')+'\n'+bundle.outputFiles.find(f=>f.path.endsWith('.css')).text});await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js')).text});
 await page.evaluate(()=>window.render(1));await expect(page.getByText('Milestones not configured.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Create milestone',exact:true}).click();await page.getByLabel('Milestone title',{exact:true}).fill('Synthetic manuscript requirement');await page.getByLabel('Deadline (Asia/Manila)').fill('2026-11-01');await page.getByRole('button',{name:'Save milestone',exact:true}).click();await expect(page.getByText('0 of 1 milestones completed',{exact:true})).toBeVisible();await expect(page.getByText('No evidence linked',{exact:true})).toBeVisible();await expect(page.getByText('· Overdue',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Edit milestone:/}).click();await page.getByLabel('Milestone title',{exact:true}).fill('Synthetic final manuscript');await page.getByLabel('Deadline (Asia/Manila)').fill('2026-11-02');await page.getByRole('button',{name:'Save milestone',exact:true}).click();await expect(page.getByRole('heading',{name:'Synthetic final manuscript',exact:true})).toBeVisible();
 await page.evaluate(()=>{window.model.canManage=false;window.render(1);});await expect(page.getByRole('button',{name:'Create milestone',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:/Verify completion:/})).toHaveCount(0);
 await page.getByRole('button',{name:/Link submission:/}).click();await page.getByLabel('Existing submission version').selectOption('1');await page.getByRole('button',{name:'Save milestone',exact:true}).click();await expect(page.getByText('Evidence: v1 · Revision Required',{exact:true})).toBeVisible();
 await page.evaluate(()=>{window.model.canManage=true;window.render(1);});await expect(page.getByRole('button',{name:/Verify completion:/})).toBeDisabled();
 await page.evaluate(()=>{window.model.canManage=false;window.render(1);});await page.getByRole('button',{name:/Link submission:/}).click();await page.getByLabel('Existing submission version').selectOption('2');await page.getByRole('button',{name:'Save milestone',exact:true}).click();await expect(page.getByText('Awaiting verification',{exact:true})).toBeVisible();
 await page.evaluate(()=>{window.model.canManage=true;window.render(1);});await page.getByRole('button',{name:/Verify completion:/}).click();await expect(page.getByText(/Confirm completion using v2/)).toBeVisible();await page.getByRole('button',{name:'Confirm completion',exact:true}).click();await expect(page.getByText('1 of 1 milestones completed',{exact:true})).toBeVisible();await expect(page.getByText('· Overdue',{exact:true})).toHaveCount(0);
 for(const [width,theme]of [[1280,'light'],[360,'dark']]){
  await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/progress-${width}-${theme}.png`,fullPage:true});
  await page.getByRole('button',{name:/Edit milestone:/}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)));await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 }
 await page.evaluate(()=>{window.model.canManage=false;window.render(1);});await page.getByRole('button',{name:/Link submission:/}).click();await page.getByLabel('Existing submission version').selectOption('1');await page.getByRole('button',{name:'Save milestone',exact:true}).click();await expect(page.getByText('0 of 1 milestones completed',{exact:true})).toBeVisible();
 await page.evaluate(()=>window.render(2));await expect(page.getByText('Milestones not configured.',{exact:true})).toBeVisible();await expect(page.getByText('Submit a PDF through Submission History before linking evidence.',{exact:true})).toBeVisible();
 await page.evaluate(()=>{window.model.denied=true;window.render(1);});await expect(page.getByText('Research progress is unavailable for this account or paper.',{exact:true})).toBeVisible();await expect(page.getByText('Synthetic final manuscript',{exact:true})).toHaveCount(0);
 await page.evaluate(()=>{window.model.denied=false;window.model.delay=100;});await page.getByRole('button',{name:'Reload progress',exact:true}).click();await expect(page.getByText('Loading research progress...',{exact:true})).toBeVisible();await expect(page.getByText('Evidence: v1 · Revision Required',{exact:true})).toBeVisible();
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(blocked.length,0,blocked.join('\n'));assert.deepEqual(await page.evaluate(()=>[...new Set(window.model.calls.map(r=>r.operation))].sort()),['create','edit','link','verify']);
 console.log('PASS R1 synthetic Chromium: create/edit/link/verify/relink, empty/loading/error, project switching, keyboard dialogs, 360px dark and 1280px light, zero unexpected requests/errors.');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
