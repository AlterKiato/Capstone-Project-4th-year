/* eslint-disable @typescript-eslint/no-require-imports */
// Existing esbuild/Chromium/VM fixture pattern. Real Action/service validators; synthetic auth and persistence.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const {build}=require('esbuild');
const {chromium,expect}=require('@playwright/test');
require('tsx/cjs');
const codec=require('../lib/utils/feedback-content.ts');
const beforeMode=process.argv.includes('--reproduce-before');
const output='test-results/s34-formatting-20261109';
function load(file,mocks={},source=fs.readFileSync(file,'utf8')){
 const exports={};const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,console,require(id){if(Object.hasOwn(mocks,id))return mocks[id];if(id==='server-only')return {};if(/lib\/(db|supabase)|^postgres$|dotenv|storage.service|push\/|notification.service/.test(id))throw Error('Live adapter forbidden: '+id);return require(id.startsWith('@/')?path.resolve(id.slice(2)):id);}}, {filename:file});return exports;
}
function submissionBoundary(){
 let validation=require('../lib/validations/feedback.ts'),content=codec;
 if(beforeMode){const b=JSON.parse(fs.readFileSync(output+'/baseline.json'));const bytes=fs.readFileSync(output+'/incoming/'+b.all.indexOf('lib/utils/feedback-content.ts')+'.source','utf8');content=load('lib/utils/feedback-content.ts',{},bytes);validation=load('lib/validations/feedback.ts',{'@/lib/utils/feedback-content':content});}
 let state;const reset=()=>{state={status:'Under Review',paperStatus:'In Review',feedback:[],activity:[],serviceCalls:0,persistCalls:0,revalidations:0,notifications:0,push:0};};reset();
 const service=load('lib/services/adviser-feedback.service.ts',{
  '@/lib/auth/main-adviser':{getCurrentMainAdviser:async id=>id===20?{userId:20,roleId:2}:null},
  '@/lib/utils/feedback-content':content,
  '@/lib/repositories/research-group.repository':{findResearchGroupsForMainAdviser:async()=>[{id:1}]},
  '@/lib/repositories/adviser-submission.repository':{findSubmissionForAdviser:async()=>({id:1,paperId:2,status:state.status,submittedBy:30,version:'v1',researchTitle:'Synthetic research'})},
  '@/lib/repositories/feedback.repository':{persistAdviserDecision:async row=>{assert.equal(state.status,'Under Review');state.persistCalls++;const saved={id:1,...row};state.feedback.push(saved);state.status=row.decision;state.paperStatus=row.researchStatus;state.activity.push(row.activityAction);return saved;}},
  '@/lib/services/notification.service':{notifyStudentSubmissionApproved:async()=>{state.notifications++;return {success:true};},notifyStudentSubmissionRevisionRequired:async()=>{state.notifications++;return {success:true};}},
 });
 const action=load('lib/actions/adviser-feedback.action.ts',{
  '@/lib/push/request':{requestResearchPush:()=>()=>{state.push++;}},'next/cache':{revalidatePath:()=>{state.revalidations++;}},
  '@/lib/auth/authorization':{requireRole:async()=>({userId:20,roleId:2})},
  '@/lib/validations/feedback':validation,
  '@/lib/services/adviser-feedback.service':{createAdviserFeedback:async(...args)=>{state.serviceCalls++;return service.createAdviserFeedback(...args);}},
 });
 return {reset,snapshot:()=>structuredClone(state),run:entries=>{const form=new FormData();for(const [k,v]of entries)form.set(k,v);return action.createAdviserFeedbackAction(form);},service:comments=>service.createAdviserFeedback(1,20,comments,'Approved')};
}
async function main(){
 fs.mkdirSync(output,{recursive:true});const boundary=submissionBoundary(),passed=[],matrix=[];
 const bundle=await build({write:false,outfile:'formatting.js',bundle:true,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},
  stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
   import React from'react';import{createRoot}from'react-dom/client';import Form from './app/dashboard/adviser/submissions/FeedbackForm';import Draft from './app/dashboard/adviser/submissions/OfficialFeedbackDraft';import Guard from './app/dashboard/adviser/submissions/ReviewDraftBoundary';import Panel from './components/dashboard/main-delegation-panel';import Content from './components/feedback-content';import{encodeFeedback}from'./lib/utils/feedback-content';import{readFeedbackEditor}from'./lib/utils/feedback-editor-dom';
   const root=createRoot(document.getElementById('root'));window.renderForm=key=>root.render(<Guard key={key}><Draft><main className='dashboard-page'><Form submissionId={1}/><Panel submissionId={1}/></main></Draft></Guard>);window.renderSaved=value=>root.render(<main className='dashboard-page'><h1>Recorded official feedback</h1><Content value={value}/></main>);window.readDraft=()=>encodeFeedback(readFeedbackEditor(document.querySelector('[role=textbox]')));
  `},plugins:[{name:'isolated-actions',setup(b){
   b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'mock'}));b.onResolve({filter:/^@\/lib\/actions\//},()=>({path:'actions',namespace:'mock'}));
   b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'js',resolveDir:process.cwd(),contents:a.path==='navigation'?`export const useRouter=()=>({refresh(){}});`:`
    window.model={panel:{eligible:true,advisers:[],assignments:[{id:8,name:'Synthetic Co',coAdviserId:40,state:'completed',recommendation:'Private <b>literal</b> & recommendation',createdAt:'2026-11-09T00:00:00Z',completedAt:'2026-11-09T00:00:00Z'},{id:9,name:'Second Co',coAdviserId:41,state:'completed',recommendation:'Second private recommendation',createdAt:'2026-11-09T00:00:00Z',completedAt:'2026-11-09T00:00:00Z'}]},wire:null,corruptNext:false};
    export async function getMainDelegationPanelAction(){return {success:true,message:'Assignments loaded.',data:window.model.panel};}
    export async function getRecommendationForOfficialDraftAction(input){const row=window.model.panel.assignments.find(r=>r.id===input.assignmentId);return {success:true,data:{...input,text:row.recommendation,author:row.name}};}
    export async function delegateCoAdvisersAction(){throw Error('Not exercised');}export async function cancelCoAdviserAssignmentAction(){throw Error('Not exercised');}
    export async function createAdviserFeedbackAction(data){
     // Exercise the browser's multipart encoding/decoding without sending a request.
     const received=await new Request('http://formatting.invalid/never-sent',{method:'POST',body:data}).formData();
     window.model.wire=received.get('comments');if(window.model.corruptNext){received.set('comments','\\u001eTHESISHS_FEEDBACK:1\\r\\n'+JSON.stringify({version:1,blocks:[{type:'paragraph',content:[{text:'Synthetic invalid',html:'<script>unsafe</script>'}]}]}));window.model.corruptNext=false;}
     return window.runOfficialBoundary([...received.entries()]);
    }
   `}));
  }}]});
 const browser=await chromium.launch({headless:true});const errors=[],unexpected=[];
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.exposeFunction('runOfficialBoundary',entries=>boundary.run(entries));
  await page.route('**/*',route=>{if(route.request().url()==='http://formatting.invalid/fixture')return route.fulfill({contentType:'text/html',body:'<html data-theme="light"><body><div id="root"></div></body></html>'});unexpected.push(route.request().url());return route.abort();});
  async function boot(){await page.addStyleTag({content:'@layer base {'+fs.readFileSync('node_modules/tailwindcss/preflight.css','utf8')+'}\n'+fs.readFileSync('app/globals.css','utf8')+'\n'+bundle.outputFiles.find(f=>f.path.endsWith('.css')).text});await page.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js')).text});}
  await page.goto('http://formatting.invalid/fixture');await boot();
  const cases=[{name:'A_plain',paragraphs:true},{name:'B_bold',marks:['Bold']},{name:'B_italic',marks:['Italic']},{name:'B_underline',marks:['Underline']},{name:'B_bullet_list',list:'Bulleted list'},{name:'B_number_list',list:'Numbered list'},{name:'B_mixed_paragraphs',marks:['Bold','Italic','Underline'],paragraphs:true},{name:'C_plain_single_import',imports:1},{name:'D_formatted_single_import',marks:['Bold','Italic','Underline'],imports:1},{name:'E_plain_multiple_imports',imports:2},{name:'E_formatted_multiple_imports',marks:['Bold'],list:'Numbered list',imports:2}];
  for(const [index,scenario]of cases.entries()){
   boundary.reset();await page.evaluate(key=>window.renderForm(key),index);
   const editor=page.getByRole('textbox',{name:'Feedback Comments',exact:true});await editor.fill('Synthetic existing feedback');
   if(scenario.paragraphs){await editor.press('End');await editor.press('Enter');await page.keyboard.insertText('Second paragraph');}
   if(scenario.marks||scenario.list){await editor.press('ControlOrMeta+a');for(const label of scenario.marks??[])await page.getByRole('button',{name:label,exact:true}).click();if(scenario.list)await page.getByRole('button',{name:scenario.list,exact:true}).click();}
   const originals=await page.evaluate(()=>window.model.panel.assignments.map(r=>r.recommendation));
   for(let i=0;i<(scenario.imports??0);i++){await page.getByRole('button',{name:'Use in Official Feedback',exact:true}).first().click();await expect(page.getByRole('button',{name:'Added to Official Feedback',exact:true})).toHaveCount(i+1);}
   if(scenario.name==='D_formatted_single_import'){await editor.click();await editor.press('ControlOrMeta+End');await page.keyboard.insertText(' — edited by Main');}
   if(index%2)await page.getByLabel('Review Decision',{exact:true}).selectOption('Approved');
   const expected=await page.evaluate(()=>window.readDraft());assert.equal(codec.validateFeedback(expected),null);
   await page.getByRole('button',{name:'Review & Confirm Decision',exact:true}).click();assert.equal(boundary.snapshot().persistCalls,0,'No write before explicit confirmation');
   await page.getByRole('button',{name:'Confirm & Submit',exact:true}).click();
   const shouldReject=beforeMode&&expected.startsWith(codec.FEEDBACK_PREFIX);
   if(shouldReject){await expect(page.getByText('Feedback formatting is invalid or unsupported.',{exact:true})).toBeVisible();assert.equal(await page.evaluate(()=>window.readDraft()),expected);assert.equal(boundary.snapshot().serviceCalls,0);assert.equal(boundary.snapshot().persistCalls,0);assert.equal(boundary.snapshot().status,'Under Review');}
   else{await expect(page.getByRole('button',{name:'Feedback submitted',exact:true})).toBeDisabled();const state=boundary.snapshot();assert.equal(state.persistCalls,1);assert.equal(state.feedback.length,1);assert.equal(state.activity.length,1);assert.equal(state.serviceCalls,1);assert.equal(state.revalidations,3);assert.equal(state.status,index%2?'Approved':'Revision Required');assert.equal(state.feedback[0].teacherId,20);
    const saved=state.feedback[0].comments;
    if(expected.startsWith(codec.FEEDBACK_PREFIX))assert.deepEqual(codec.decodeFeedback(saved),codec.decodeFeedback(expected));else assert.equal(codec.feedbackPlainText(saved).replace(/\r\n/g,'\n'),codec.feedbackPlainText(expected).trim());
   }
   assert.deepEqual(await page.evaluate(()=>window.model.panel.assignments.map(r=>r.recommendation)),originals);
   const wire=await page.evaluate(()=>window.model.wire);matrix.push({scenario:scenario.name,clientValidation:'PASS',wireHeader:wire.startsWith('\u001eTHESISHS_FEEDBACK:')?'U+001E THESISHS_FEEDBACK:1 CRLF':'plain text',serverOutcome:shouldReject?'REPRODUCED_ACTION_REJECTION':'PASS',serviceCalls:boundary.snapshot().serviceCalls,persistCalls:boundary.snapshot().persistCalls});
   if(!shouldReject){const saved=boundary.snapshot().feedback[0].comments;await page.reload();await boot();await page.evaluate(value=>window.renderSaved(value),saved);await expect(page.getByRole('heading',{name:'Recorded official feedback'})).toBeVisible();
    const document=codec.decodeFeedback(saved),runs=document.blocks.flatMap(block=>block.type==='paragraph'?block.content:block.items.flat());
    for(const [mark,selector]of [['bold','strong'],['italic','em'],['underline','u']])await expect(page.locator('main '+selector)).toHaveCount(runs.filter(run=>run[mark]).length);
    if(scenario.list)await expect(page.locator(scenario.list==='Bulleted list'?'main ul li':'main ol li')).toHaveCount(1);
    if(scenario.paragraphs)await expect(page.locator('main')).toContainText('Second paragraph');if(scenario.imports)await expect(page.locator('main')).toContainText('Private <b>literal</b> & recommendation');await expect(page.locator('main script, main img, main a')).toHaveCount(0);
    if(scenario.name==='E_formatted_multiple_imports')await page.screenshot({path:output+'/reloaded-official-feedback.png',fullPage:true});
   }
   passed.push(scenario.name);
  }
  if(!beforeMode){
   boundary.reset();await page.evaluate(()=>window.renderForm(100));let editor=page.getByRole('textbox',{name:'Feedback Comments',exact:true});await editor.fill('Preserved formatted import draft');await editor.press('ControlOrMeta+a');await page.getByRole('button',{name:'Bold',exact:true}).click();await page.getByRole('button',{name:'Use in Official Feedback',exact:true}).first().click();await expect(page.getByRole('button',{name:'Added to Official Feedback',exact:true})).toHaveCount(1);const draft=await page.evaluate(()=>window.readDraft());await page.getByLabel('Review Decision').selectOption('Approved');await page.evaluate(()=>window.model.corruptNext=true);
   await page.getByRole('button',{name:'Review & Confirm Decision',exact:true}).click();await page.getByRole('button',{name:'Confirm & Submit',exact:true}).click();await expect(page.getByText(/Your draft has not changed\. Use the supported toolbar/)).toBeVisible();assert.equal(await page.evaluate(()=>window.readDraft()),draft);await expect(page.getByLabel('Review Decision')).toHaveValue('Approved');assert.equal(boundary.snapshot().status,'Under Review');assert.equal(boundary.snapshot().persistCalls,0);assert.equal(boundary.snapshot().feedback.length,0);assert.equal(boundary.snapshot().activity.length,0);assert.equal(boundary.snapshot().push,0);assert.equal(boundary.snapshot().notifications,0);assert.equal(boundary.snapshot().revalidations,0);await page.screenshot({path:output+'/invalid-payload-preserved-draft.png',fullPage:true});passed.push('invalid Action payload preserves draft/decision; zero academic, audit, notification or cache writes');
   await page.getByRole('button',{name:'Review & Confirm Decision',exact:true}).click();assert.equal(boundary.snapshot().persistCalls,0);await page.getByRole('button',{name:'Confirm & Submit',exact:true}).click();await expect(page.getByRole('button',{name:'Feedback submitted',exact:true})).toBeDisabled();assert.equal(boundary.snapshot().persistCalls,1);assert.equal(boundary.snapshot().status,'Approved');passed.push('corrected retry still requires explicit Main confirmation');
   for(const invalid of ['\u001eTHESISHS_FEEDBACK:2\r\n{}','\u001eTHESISHS_FEEDBACK:1\r\n{','\u001eTHESISHS_FEEDBACK:1\r\n'+JSON.stringify({version:1,blocks:[{type:'script',content:[]} ]})]){boundary.reset();const result=await boundary.run([['submissionId','1'],['decision','Approved'],['comments',invalid]]);assert.equal(result.success,false);assert.equal(boundary.snapshot().serviceCalls,0);assert.equal(boundary.snapshot().persistCalls,0);assert.equal(boundary.snapshot().status,'Under Review');}passed.push('unknown version, malformed JSON and unsupported markup deny before service/persistence');
   boundary.reset();const invalid=codec.FEEDBACK_PREFIX+JSON.stringify({version:1,blocks:[{type:'paragraph',content:[{text:'Invalid',href:'javascript:unsafe'}]}]});assert.equal((await boundary.service(invalid)).success,false);assert.equal(boundary.snapshot().persistCalls,0);assert.equal(boundary.snapshot().status,'Under Review');passed.push('service independently rejects unsafe document attributes without persistence');
   boundary.reset();await page.evaluate(()=>window.renderForm(101));editor=page.getByRole('textbox',{name:'Feedback Comments',exact:true});await editor.fill('<img src=x onerror=alert(1)><script>literal</script>');await page.getByRole('button',{name:'Review & Confirm Decision',exact:true}).click();await page.getByRole('button',{name:'Confirm & Submit',exact:true}).click();await expect(page.getByRole('button',{name:'Feedback submitted',exact:true})).toBeDisabled();await page.evaluate(value=>window.renderSaved(value),boundary.snapshot().feedback[0].comments);await expect(page.locator('main')).toContainText('<script>literal</script>');await expect(page.locator('main img, main script')).toHaveCount(0);passed.push('legacy HTML-looking text renders literally and never executes');
   const wire=codec.encodeFeedback({version:1,blocks:[{type:'paragraph',content:[{text:'Synthetic wire-rendered text',bold:true}]}]}).replace(codec.FEEDBACK_PREFIX,codec.FEEDBACK_PREFIX.replace('\n','\r\n'));await page.evaluate(value=>window.renderSaved(value),wire);await expect(page.locator('main strong')).toHaveText('Synthetic wire-rendered text');passed.push('known CRLF envelope renders through the same safe semantic renderer');
  }
  assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
  const result={mode:beforeMode?'BEFORE_CAPTURED_CODEC':'AFTER_FIX',PASS:passed.length,FAIL:0,reproducedFailures:matrix.filter(r=>r.serverOutcome==='REPRODUCED_ACTION_REJECTION').length,matrix,passed,boundary:'Native browser multipart encode/decode plus real Action/service validators; synthetic session, in-memory persistence, notifications/push/cache doubles; no app server/database/provider'};fs.writeFileSync(output+'/'+(beforeMode?'before-browser-results.json':'browser-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
