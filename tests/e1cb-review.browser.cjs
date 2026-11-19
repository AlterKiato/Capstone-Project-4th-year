/* eslint-disable @typescript-eslint/no-require-imports */
// Actual changed UI and Main review form, synthetic actions/data only; all network requests intercepted.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {build}=require('esbuild'),{chromium,expect}=require('@playwright/test');
async function main(){
 const out='test-results/e1cb';fs.mkdirSync(out,{recursive:true});
 const bundle=await build({write:false,outfile:'e1cb.js',bundle:true,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from'react';import{createRoot}from'react-dom/client';
import CoReview from'./components/dashboard/co-adviser-review';import Panel from'./components/dashboard/main-delegation-panel';
import Feedback from'./app/dashboard/adviser/submissions/FeedbackForm';import Boundary from'./app/dashboard/adviser/submissions/ReviewDraftBoundary';
import Official from'./app/dashboard/adviser/submissions/OfficialFeedbackDraft';import Revision from'./app/dashboard/adviser/submissions/RevisionDraft';
window.fixture={calls:[],generation:0,reject:false,history:[]};
window.definition={name:'Delegated method rubric',sourceTemplateId:8,sourceRevision:2,sourceOwnerId:1,scale:{version:1,levels:[1,2,3].map(points=>({points,label:'Custom '+points,description:'Descriptor '+points}))},criteria:[{key:'e91d32bf-e79c-44d9-8914-78f6d29feb82',position:0,name:'Method',description:'Check the method.',allowsNa:false},{key:'129284bf-0659-48fb-89d9-93c0b4389171',position:1,name:'Evidence',description:'Check the evidence.',allowsNa:true}]};
const root=createRoot(document.getElementById('root'));
window.mount=(options={})=>{window.fixture.generation++;window.fixture.reject=!!options.reject;window.fixture.assignment={revision:options.none?0:1,snapshot:options.none?null:structuredClone(window.definition)};window.fixture.co={id:window.fixture.generation,submissionId:9,title:'Synthetic delegated research',groupId:1,version:'v1',state:'open',reviewAvailable:true,recommendation:null,createdAt:'2026-11-18T00:00:00Z',completedAt:null,closedAt:null};root.render(<CoReview key={window.fixture.generation} initial={window.fixture.co} email="co@example.invalid"/>)};
window.main=()=>root.render(<Boundary key="main"><Official><Revision><main className="dashboard-page"><h1>Synthetic Main review</h1><Feedback submissionId={9}/><Panel submissionId={9}/></main></Revision></Official></Boundary>);
window.mount();`},plugins:[{name:'isolated-ui',setup(b){
 b.onResolve({filter:/^next\/|^@\/lib\/actions\//},a=>({path:a.path,namespace:'fixture'}));
 b.onResolve({filter:/AuthorizedPdfPreview$|dashboard-header$|adviser-research-assistant$/},a=>({path:a.path,namespace:'fixture'}));
 b.onResolve({filter:/^(server-only|postgres|dotenv|@\/lib\/db)$/},()=>{throw Error('Live adapter forbidden')});
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>{
 let contents;
 if(path==='next/link')contents=`export default function Link({children,...props}){return <a {...props}>{children}</a>}`;
 else if(path==='next/navigation')contents=`export const useRouter=()=>({refresh(){}});`;
 else if(path.endsWith('AuthorizedPdfPreview'))contents=`export default function Pdf(){return <p>Synthetic PDF boundary; no Storage request.</p>}`;
 else if(path.endsWith('dashboard-header'))contents=`export default function Header({title}){return <header><h1>{title}</h1></header>}`;
 else if(path.endsWith('adviser-research-assistant'))contents=`export default function Assistant({children}){return children}`;
 else if(path.endsWith('co-adviser.action'))contents=`
import{assessEvaluation}from'./lib/submission-evaluation';
export async function getCoAdviserEvaluationAction(ids){window.fixture.calls.push({kind:'criteria',ids});return{success:true,message:'Loaded',data:structuredClone(window.fixture.assignment)}};
export async function getCoAdviserAssignmentAction(){return{success:true,message:'Reloaded',data:{email:'co@example.invalid',assignment:structuredClone(window.fixture.co)}}};
export async function submitCoAdviserRecommendationAction(input){window.fixture.calls.push({kind:'submit',input:structuredClone(input)});if(window.fixture.reject)return{success:false,message:'Synthetic stale generation rejection'};const a=structuredClone(window.fixture.assignment);let assessment=null;if(input.evaluation){const p=assessEvaluation(a,input.evaluation);assessment={assignment:a,draft:input.evaluation,earned:p.earned,possible:p.possible,stale:false}};window.fixture.co={...window.fixture.co,state:'completed',reviewAvailable:false,recommendation:input.recommendation,assessment};window.fixture.history.push(structuredClone(window.fixture.co));return{success:true,message:'Private recommendation submitted.',data:{assessment}}};
export async function getMainDelegationPanelAction(){return{success:true,message:'Loaded',data:{eligible:true,advisers:[],assignments:window.fixture.history.map(x=>({...x,coAdviserId:2,name:'Synthetic Co-Adviser',closureReason:null,assessment:x.assessment?{...x.assessment,stale:x.assessment.assignment.revision!==window.fixture.assignment.revision}:null}))}}};
export async function getRecommendationForOfficialDraftAction(ids){const row=window.fixture.history.find(x=>x.id===ids.assignmentId);const data={...ids,text:row.recommendation,author:'Synthetic Co-Adviser'};window.fixture.calls.push({kind:'import',data});return{success:true,message:'Imported narrative',data}};
export async function delegateCoAdvisersAction(){throw Error('Out of UI scope')};export async function cancelCoAdviserAssignmentAction(){throw Error('Out of UI scope')};`;
 else if(path.endsWith('submission-evaluation.action'))contents=`export async function readSubmissionEvaluationAction(){return{success:true,message:'Loaded',data:structuredClone(window.fixture.assignment)}};export async function changeSubmissionEvaluationAction(){throw Error('Unexpected assignment mutation')};`;
 else if(path.endsWith('evaluation-template.action'))contents=`export async function listEvaluationTemplatesAction(){throw Error('Co library enumeration forbidden')};`;
 else if(path.endsWith('adviser-feedback.action'))contents=`export async function createAdviserFeedbackAction(){throw Error('Official finalization outside synthetic UI scope')};`;
 else throw Error('Unmocked adapter '+path);
 return{contents,loader:'tsx',resolveDir:process.cwd()};
 });}}]});
 const css='@layer base {'+fs.readFileSync('node_modules/tailwindcss/preflight.css','utf8')+'}\n'+fs.readFileSync('app/globals.css','utf8').replace(/^@import.*$/m,'')+'\n'+bundle.outputFiles.find(f=>f.path.endsWith('.css')).text;
 const html='<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="root"></div><script>'+bundle.outputFiles.find(f=>f.path.endsWith('.js')).text+'</script></body></html>';
 const browser=await chromium.launch({headless:true,args:['--disable-gpu']}),checks=[],errors=[],unexpected=[];
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 let accept=false;page.on('dialog',d=>accept?d.accept():d.dismiss());
 await page.route('**/*',route=>{if(new URL(route.request().url()).origin==='http://e1cb.invalid'&&route.request().isNavigationRequest())return route.fulfill({contentType:'text/html',body:html});unexpected.push(route.request().url());return route.abort()});
 await page.goto('http://e1cb.invalid/review');
 const open=()=>page.getByRole('button',{name:'Open Evaluation',exact:true});
 const narrative=()=>page.getByRole('textbox',{name:'Plain-text recommendation'});
 const review=()=>page.getByRole('button',{name:'Review recommendation',exact:true});
 await expect(open()).toBeEnabled();await expect(page.getByRole('dialog')).toHaveCount(0);
 assert.equal(await page.getByRole('button',{name:/Choose Template|Change Template|Archive|Duplicate|Clear Assignment/}).count(),0);
 assert.equal(await open().count(),1);assert.equal(await review().count(),1);await expect(page.getByLabel('Include ratings')).not.toBeChecked();
 checks.push('Existing recommendation form with one compact criteria entry, optional unchecked ratings, no template management or duplicate submit');
 await open().focus();await page.keyboard.press('Enter');let panel=page.getByRole('dialog');await expect(panel).toBeVisible();
 await expect(panel.getByLabel('Rating',{exact:true}).first()).toHaveValue('');assert.equal(await panel.getByLabel('Rating',{exact:true}).first().locator('option').filter({hasText:'N/A'}).count(),0);
 await panel.getByLabel('Rating',{exact:true}).first().selectOption('2');await panel.getByLabel('Rating',{exact:true}).nth(1).selectOption('na');await panel.getByLabel('N/A reason (required)').fill('  Method does not use this evidence  ');
 await panel.getByText('Criterion comment (optional)',{exact:true}).first().click();await panel.getByLabel('Comment for Method').fill('  Check this method  ');await expect(panel.getByText('2 / 3 points',{exact:true})).toBeVisible();
 const handle=panel.getByLabel('Move evaluation window with arrow keys');const before=await panel.boundingBox();await handle.focus();await page.keyboard.press('ArrowLeft');assert((await panel.boundingBox()).x<before.x);
 const box=await handle.boundingBox();await page.mouse.move(box.x+10,box.y+10);await page.mouse.down();await page.mouse.move(-100,-100,{steps:8});await page.mouse.up();assert((await panel.boundingBox()).x>=11);
 await panel.getByRole('button',{name:'Minimize',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByLabel('Include ratings')).toBeChecked();
 await open().click();await expect(page.getByRole('dialog').getByLabel('Rating',{exact:true}).first()).toHaveValue('2');
 await page.getByRole('dialog').getByRole('button',{name:'Done / Return to Recommendation'}).click();
 await page.getByRole('link',{name:'Back to Assignments'}).click();assert.equal(new URL(page.url()).pathname,'/review');
 checks.push('Explicit custom ratings, permitted N/A reason/comments, automatic opt-in, bounded keyboard/pointer drag, minimize/restore and ratings-only dirty navigation guard');
 await narrative().fill('Private narrative with criteria.');await review().click();panel=page.getByRole('dialog');await expect(panel.getByRole('heading',{name:'Submit private recommendation',exact:true})).toBeVisible();assert.equal(await panel.getByLabel('Rating',{exact:true}).count(),0);
 await expect(panel.getByText(/template revision 2.*assignment revision 1/)).toBeVisible();await expect(panel.getByText('Check this method')).toBeVisible();await expect(open()).toBeDisabled();
 await panel.getByRole('button',{name:'Cancel',exact:true}).click();await open().click();await page.getByRole('dialog').getByLabel('Rating',{exact:true}).first().selectOption('1');await page.getByRole('dialog').getByRole('button',{name:'Done / Return to Recommendation'}).click();
 await review().click();await expect(page.getByRole('dialog').getByText(/1 \/ 3 points/)).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Submit recommendation',exact:true}).click();await expect(page.getByText('This assignment is completed.',{exact:false})).toBeVisible();
 const sent=await page.evaluate(()=>window.fixture.calls.filter(x=>x.kind==='submit').at(-1).input);const method=sent.evaluation.assessments.find(x=>x.criterionKey==='e91d32bf-e79c-44d9-8914-78f6d29feb82'),evidence=sent.evaluation.assessments.find(x=>x.criterionKey==='129284bf-0659-48fb-89d9-93c0b4389171');assert.equal(method.rating,1);assert.equal(method.comment,'Check this method');assert.equal(evidence.reason,'Method does not use this evidence');assert.equal(sent.evaluation.assignmentRevision,1);
 await page.getByText('Criteria recommendation: 1 / 3 points',{exact:false}).click();await expect(page.getByText('Check this method')).toBeVisible();assert.equal(await review().count(),0);
 checks.push('Confirmation binds latest edited scores, trims validated text, hides working window; single existing submit records own read-only narrative and server-returned ratings');
 await page.evaluate(()=>window.mount({none:true}));await expect(narrative()).toBeVisible();assert.equal(await open().count(),0);await narrative().fill('Narrative-only without assigned rubric.');await review().click();assert.equal(await page.getByRole('dialog').getByText(/points/).count(),0);await page.getByRole('dialog').getByRole('button',{name:'Submit recommendation',exact:true}).click();await expect(page.getByText('This assignment is completed.',{exact:false})).toBeVisible();assert.equal(await page.evaluate(()=>window.fixture.calls.filter(x=>x.kind==='submit').at(-1).input.evaluation),null);
 checks.push('No assignment preserves original narrative-only confirmation/completion');
 await page.evaluate(()=>window.mount());await expect(open()).toBeEnabled();await page.getByLabel('Include ratings').check();await narrative().fill('Incomplete included ratings.');await review().click();await expect(page.getByText('Assess every assigned criterion exactly once.')).toBeVisible();assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByLabel('Include ratings').uncheck();await review().click();await page.getByRole('dialog').getByRole('button',{name:'Submit recommendation',exact:true}).click();await expect(page.getByText('This assignment is completed.',{exact:false})).toBeVisible();assert.equal(await page.evaluate(()=>window.fixture.calls.filter(x=>x.kind==='submit').at(-1).input.evaluation),null);
 checks.push('Optional opt-out retains narrative-only validity; incomplete included assessment cannot reach confirmation');
 await page.evaluate(()=>window.mount({reject:true}));await expect(open()).toBeEnabled();await narrative().fill('Keep this draft on rejection.');await open().click();await page.getByRole('dialog').getByLabel('Rating',{exact:true}).first().selectOption('3');await page.getByRole('dialog').getByLabel('Rating',{exact:true}).nth(1).selectOption('2');await page.getByRole('dialog').getByRole('button',{name:'Done / Return to Recommendation'}).click();await review().click();await page.getByRole('dialog').getByRole('button',{name:'Submit recommendation',exact:true}).click();await expect(page.getByText(/outcome could not be confirmed/)).toBeVisible();await expect(narrative()).toHaveValue('Keep this draft on rejection.');await expect(review()).toBeDisabled();
 await page.getByRole('button',{name:'Reload assignment',exact:true}).click();await expect(narrative()).toHaveValue('Keep this draft on rejection.');accept=true;await page.getByRole('button',{name:'Reload assignment',exact:true}).click();accept=false;await expect(narrative()).toHaveValue('');await expect(open()).toBeEnabled();await open().click();await expect(page.getByRole('dialog').getByLabel('Rating',{exact:true}).first()).toHaveValue('');
 checks.push('Server rejection preserves draft and blocks duplicate retry; explicit reload/discard resets scores and narrative after confirmation');
 for(const width of[1440,360]){await page.setViewportSize({width,height:900});for(const theme of['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);panel=page.getByRole('dialog');await expect(panel).toBeVisible();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);const rect=await panel.boundingBox();assert(rect.x>=0&&rect.x+rect.width<=width+1);await expect(panel.getByRole('button',{name:'Done / Return to Recommendation'})).toBeInViewport();if(width===360){await expect(panel).toHaveAttribute('aria-modal','true');await page.keyboard.press('Shift+Tab');assert(await panel.evaluate(el=>el.contains(document.activeElement)));}await page.screenshot({path:out+'/co-evaluation-'+theme+'-'+width+'.png',fullPage:true});}}
 checks.push('1440/360 Light/Dark changed Co workspace: no overflow, reachable footer, mobile modal focus containment');
 await page.getByRole('dialog').getByRole('button',{name:'Close evaluation window'}).click();
 await page.getByLabel('Include ratings').scrollIntoViewIfNeeded();assert(await page.getByText('Evaluation Criteria',{exact:true}).locator('..').boundingBox().then(r=>r.width>=150));await page.screenshot({path:out+'/co-compact-dark-360.png',fullPage:true});
 await page.evaluate(()=>{window.fixture.assignment={revision:2,snapshot:{...structuredClone(window.definition),name:'Replacement rubric'}};window.main()});await page.setViewportSize({width:1440,height:1000});
 await expect(page.getByText('Criteria recommendation: 1 / 3 points',{exact:false})).toBeVisible();await page.getByText('Criteria recommendation: 1 / 3 points',{exact:false}).click();await expect(page.getByText('Assignment changed. These ratings retain their historical meaning.')).toBeVisible();await expect(page.getByText(/Delegated method rubric.*assignment revision 1/)).toBeVisible();await expect(page.getByText('Check this method')).toBeVisible();
 await page.getByRole('button',{name:'Use in Official Feedback',exact:true}).first().click();await expect(page.getByRole('textbox',{name:'Feedback Comments'})).toContainText('Private narrative with criteria.');
 await open().click();await expect(page.getByRole('dialog').getByLabel('Rating',{exact:true}).first()).toHaveValue('');await expect(page.getByRole('dialog').getByRole('heading',{name:'Replacement rubric',exact:true})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Done / Return to Review'}).click();assert.deepEqual(await page.evaluate(()=>Object.keys(window.fixture.calls.find(x=>x.kind==='import').data).sort()),['assignmentId','author','submissionId','text']);
 await page.screenshot({path:out+'/main-stale-recommendation-dark-1440.png',fullPage:true});
 checks.push('Actual Main recommendation panel shows original frozen scale/comments/generation/stale indicator; narrative import leaves actual Main assessment ratings blank');
 await open().click();await page.getByRole('dialog').getByLabel('Rating',{exact:true}).first().selectOption('1');await page.getByRole('dialog').getByLabel('Rating',{exact:true}).nth(1).selectOption('2');await page.getByRole('dialog').getByRole('button',{name:'Done / Return to Review'}).click();await page.getByRole('button',{name:'Review & Confirm Decision',exact:true}).click();await expect(page.getByRole('heading',{name:'Confirm decision: Revision Required'})).toBeVisible();await expect(page.getByText(/Replacement rubric.*assignment revision 2/)).toBeVisible();await expect(page.getByText('3 / 6 points.',{exact:false})).toBeVisible();assert.equal(await page.getByRole('dialog').count(),0);checks.push('Shared-component extraction preserves actual Main working ratings and existing official confirmation with its own generation/points');
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);
 fs.writeFileSync(out+'/browser-results.json',JSON.stringify({boundary:'Actual changed Co UI/shared workspace/Main review and recommendation panel; synthetic Server Actions, request identity, PDF shell and assistant boundary. No credential-auth/runtime/Storage claim.',checks,errors,unexpected},null,2));console.log(JSON.stringify({pass:checks.length,checks},null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
