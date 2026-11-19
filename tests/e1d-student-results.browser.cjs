/* eslint-disable @typescript-eslint/no-require-imports */
// Actual Student history/dialog with synthetic action responses; no network or credentials.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {build}=require('esbuild'),{chromium,expect}=require('@playwright/test');
async function main(){
 const out='test-results/e1d';fs.mkdirSync(out,{recursive:true});
 const fixture=JSON.parse(fs.readFileSync(out+'/official-result-fixture.json','utf8'));
 const bundle=await build({write:false,outfile:'e1d.js',bundle:true,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`
import React from'react';import{createRoot}from'react-dom/client';import Research from'./components/dashboard/student-research';
window.fixture={calls:[],mode:'ok',result:${JSON.stringify(fixture)}};
const dates={createdAt:'2026-11-18T00:00:00Z',updatedAt:'2026-11-18T00:00:00Z'};
window.workspace={email:'synthetic@example.invalid',groups:[{id:1,groupName:'Synthetic group'}],projects:[1,2].map(id=>({id,groupId:1,title:'Project '+id,abstract:'Synthetic',category:'STEM',keywords:'',status:'Under Review',...dates})),submissions:[
{id:11,paperId:1,version:'v1',status:'Revision Required',submittedAt:dates.createdAt,remarks:'First version',feedbackRestricted:false,feedbackUnavailable:false,feedback:[{id:21,comments:'Existing narrative for version one.',decision:'Revision Required',createdAt:dates.createdAt,evaluationState:'available'}]},
{id:12,paperId:1,version:'v2',status:'Approved',submittedAt:dates.createdAt,remarks:'Second version',feedbackRestricted:false,feedbackUnavailable:false,feedback:[{id:22,comments:'Existing narrative without rubric.',decision:'Approved',createdAt:dates.createdAt,evaluationState:'none'}]},
{id:13,paperId:1,version:'v3',status:'Under Review',submittedAt:dates.createdAt,remarks:'Pending version',feedbackRestricted:false,feedbackUnavailable:false,feedback:[]},
{id:14,paperId:1,version:'v4',status:'Approved',submittedAt:dates.createdAt,remarks:'Another member',feedbackRestricted:true,feedbackUnavailable:false,feedback:[]},
{id:15,paperId:2,version:'v1',status:'Approved',submittedAt:dates.createdAt,remarks:'Other project',feedbackRestricted:false,feedbackUnavailable:false,feedback:[{id:23,comments:'Project two narrative',decision:'Approved',createdAt:dates.createdAt,evaluationState:'available'}]}
]};const root=createRoot(document.getElementById('root'));root.render(<main className="dashboard-page"><Research workspace={window.workspace} target={{project:'1',submission:'11'}}/></main>);`},plugins:[{name:'isolated-ui',setup(b){
 b.onResolve({filter:/^next\/|^@\/lib\/actions\//},a=>({path:a.path,namespace:'fixture'}));
 b.onResolve({filter:/submission-upload-dialog$|research-dialog$|DownloadSubmissionButton$|research-progress$|revision-checklist$/},a=>({path:a.path,namespace:'fixture'}));
 b.onResolve({filter:/^(server-only|postgres|dotenv|@\/lib\/db)$/},()=>{throw Error('Live adapter forbidden')});
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>{
 let contents;
 if(path==='next/navigation')contents=`export const useRouter=()=>({refresh(){},replace(){}});`;
 else if(path.endsWith('student-evaluation.action'))contents=`export async function getStudentEvaluationAction(input){window.fixture.calls.push(structuredClone(input));if(window.fixture.mode==='reject')return{success:false,message:'Evaluation unavailable. Reload this submission and try again.'};if(window.fixture.mode==='throw')throw Error('Synthetic transport failure');if(window.fixture.mode==='none')return{success:true,data:null};if(window.fixture.mode==='slow')await new Promise(r=>setTimeout(r,150));return{success:true,data:{...structuredClone(window.fixture.result),version:input.version,submissionId:input.submissionId,feedbackId:input.feedbackId}}}`;
 else if(path.endsWith('student-research.action'))contents=`export async function createStudentResearchAction(){throw Error('Mutation forbidden')}`;
 else if(path.endsWith('DownloadSubmissionButton'))contents=`export default function Download(){return <button>Download PDF</button>}`;
 else if(path.endsWith('research-progress'))contents=`export default function Progress(){return <p>Existing progress boundary</p>}`;
 else if(path.endsWith('revision-checklist'))contents=`export default function Revisions(){return <p>Existing revisions boundary</p>}`;
 else if(path.endsWith('research-dialog'))contents=`export default function Dialog(){return <dialog open>Create project boundary</dialog>}`;
 else if(path.endsWith('submission-upload-dialog'))contents=`export default function Upload(){return <dialog open>Submit PDF boundary</dialog>}`;
 else throw Error('Unmocked adapter '+path);
 return{contents,loader:'tsx',resolveDir:process.cwd()};
 });}}]});
 const css='@layer base {'+fs.readFileSync('node_modules/tailwindcss/preflight.css','utf8')+'}\n'+fs.readFileSync('app/globals.css','utf8').replace(/^@import.*$/m,'')+'\n'+bundle.outputFiles.find(f=>f.path.endsWith('.css')).text;
 const html='<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="root"></div><script>'+bundle.outputFiles.find(f=>f.path.endsWith('.js')).text+'</script></body></html>';
 const browser=await chromium.launch({headless:true,args:['--disable-gpu']}),checks=[],errors=[],unexpected=[];
 try{
 const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/*',route=>{if(route.request().url()==='http://e1d.invalid/submissions')return route.fulfill({contentType:'text/html',body:html});unexpected.push(route.request().url());return route.abort()});
 await page.goto('http://e1d.invalid/submissions');
 const open=()=>page.getByRole('button',{name:'View Evaluation',exact:true}),dialog=()=>page.getByRole('dialog');
 await expect(open()).toHaveCount(1);await open().click();await expect(dialog().getByText('Frozen rubric 2',{exact:true})).toBeVisible();
 await expect(dialog().getByText('2 / 2 points',{exact:true})).toBeVisible();await expect(dialog().locator('ol').getByText('2: Frozen level 2',{exact:true})).toBeVisible();await expect(dialog().getByText('N/A',{exact:true})).toBeVisible();await expect(dialog().getByText('N/A reason: Not used by this method',{exact:true})).toBeVisible();await expect(dialog().getByText('Comment: Official criterion comment',{exact:true})).toBeVisible();assert.equal(await dialog().locator('input,textarea,select').count(),0);
 assert.deepEqual(await page.evaluate(()=>window.fixture.calls[0]),{paperId:1,submissionId:11,version:'v1',feedbackId:21});
 checks.push('Contextual exact-version request; official frozen ratings/meanings/N/A/comments; no editing controls');
 await dialog().getByText('Rating scale',{exact:false}).click();await expect(dialog().getByText('1: Frozen level 1',{exact:true})).toBeVisible();
 for(const width of[1440,360]){await page.setViewportSize({width,height:800});for(const theme of['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await expect(dialog()).toBeVisible();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const rect=await dialog().boundingBox();assert(rect.x>=0&&rect.x+rect.width<=width+1);assert(await dialog().evaluate(el=>el.scrollWidth<=el.clientWidth+1));await expect(dialog().getByRole('button',{name:'Close evaluation'})).toBeInViewport();await page.screenshot({path:out+'/student-results-'+theme+'-'+width+'.png',fullPage:true});}}
 checks.push('1440/360 Light/Dark: no document/dialog horizontal overflow, readable result, reachable close');
 for(const theme of['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);const contrasts=await dialog().evaluate(el=>{
  const luminance=value=>{const rgb=value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  const background=luminance(getComputedStyle(el).backgroundColor);
  return [...el.querySelectorAll('h2, h3, h4, p, summary, button')].filter(node=>node.getClientRects().length).map(node=>{const color=luminance(getComputedStyle(node).color);return(Math.max(color,background)+.05)/(Math.min(color,background)+.05);});
 });assert(contrasts.every(ratio=>ratio>=4.5),'Dialog text contrast must meet AA in '+theme);}
 checks.push('Light/Dark dialog text, muted copy, scale control and Close meet measured 4.5:1 contrast');
 await dialog().getByRole('button',{name:'Close evaluation'}).focus();await page.keyboard.press('Shift+Tab');assert(await dialog().evaluate(el=>el.contains(document.activeElement)));await page.keyboard.press('Escape');await expect(dialog()).toHaveCount(0);await expect(open()).toBeFocused();
 checks.push('Native modal focus containment, Escape close and opener focus restoration');
 await page.getByRole('button',{name:/^v2/}).click();await expect(open()).toHaveCount(0);await expect(page.getByText('No criteria-based evaluation for this review.')).toBeVisible();await page.getByRole('button',{name:'View Full Feedback'}).click();await expect(dialog().getByText('Existing narrative without rubric.')).toBeVisible();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:/^v3/}).click();await expect(open()).toHaveCount(0);await expect(page.getByText('No feedback recorded for this version yet.')).toBeVisible();await page.getByRole('button',{name:/^v4/}).click();await expect(open()).toHaveCount(0);await expect(page.getByText('Feedback for this version is available to the Student who submitted it.')).toBeVisible();
 checks.push('No-rubric neutral state preserves full narrative; pending and restricted histories have no result action');
 await page.getByLabel('Research project',{exact:true}).selectOption('2');await expect(open()).toHaveCount(1);await open().click();await expect(dialog()).toBeVisible();assert.deepEqual(await page.evaluate(()=>window.fixture.calls.at(-1)),{paperId:2,submissionId:15,version:'v1',feedbackId:23});await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:/^v2/})).toHaveCount(0);
 checks.push('Multiple-project selection resets history/result scope and requests the selected project only');
 for(const mode of['reject','throw','none']){await page.evaluate(mode=>window.fixture.mode=mode,mode);await open().click();if(mode==='none')await expect(dialog().getByText('No criteria-based evaluation for this review.')).toBeVisible();else await expect(dialog().getByRole('alert')).toContainText('Evaluation unavailable');await page.keyboard.press('Escape');}
 checks.push('Denied/transport failures reveal no scores; authorized narrative-only response remains neutral');
 await page.evaluate(()=>{window.fixture.mode='slow';window.fixture.result.templateName='Long frozen title '.repeat(12);window.fixture.result.criteria=Array.from({length:30},(_,i)=>({...window.fixture.result.criteria[0],name:'Criterion '+(i+1),comment:'Unbroken'+('x'.repeat(2000))}));});
 await open().click();await expect(dialog().getByRole('status')).toHaveText('Loading evaluation…');await expect(dialog().getByText('Criterion 30',{exact:true})).toBeAttached();const scroll=dialog().getByLabel('Official evaluation results');assert(await scroll.evaluate(el=>el.scrollHeight>el.clientHeight));await scroll.evaluate(el=>el.scrollTop=el.scrollHeight);await dialog().getByText('Criterion 30',{exact:true}).scrollIntoViewIfNeeded();await expect(dialog().getByText('Criterion 30',{exact:true})).toBeInViewport();await expect(dialog().getByRole('button',{name:'Close evaluation'})).toBeInViewport();assert(await dialog().evaluate(el=>el.scrollWidth<=el.clientWidth+1));await page.screenshot({path:out+'/student-results-long-dark-360.png',fullPage:true});await page.keyboard.press('Escape');
 checks.push('Loading state and 30-criterion mobile scrolling, long title/unbroken comments; close stays reachable');
 await page.getByRole('tab',{name:'Progress',exact:true}).click();await expect(page.getByText('Existing progress boundary')).toBeVisible();await page.getByRole('tab',{name:'Revisions',exact:true}).click();await expect(page.getByText('Existing revisions boundary')).toBeVisible();await page.getByRole('tab',{name:'History',exact:true}).click();await expect(page.getByRole('button',{name:'Download PDF'})).toBeVisible();await page.getByRole('button',{name:'Submit PDF',exact:true}).click();await expect(page.getByText('Submit PDF boundary')).toBeVisible();
 checks.push('Existing history/download, progress/revisions tabs and Submit PDF entry remain reachable (mutation boundaries stubbed)');
 assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);fs.writeFileSync(out+'/browser-results.json',JSON.stringify({boundary:'Actual Student history/dialog, synthetic Server Action and upload/progress boundaries; no authenticated Next runtime or Storage claim',checks,errors,unexpected},null,2));console.log(JSON.stringify({pass:checks.length,checks},null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
