/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {appendRecommendation}=require('../lib/utils/recommendation-import.ts');
const {encodeFeedback,decodeFeedback,feedbackPlainText}=require('../lib/utils/feedback-content.ts');
const {coAssignmentSummary,delegatedGroups,coReviewHref}=require('../lib/utils/co-adviser-workspace.ts');
const {recommendationSchema}=require('../lib/validations/co-adviser.ts');
const {SubmissionPdfAccess,CO_ADVISER_PDF_WINDOW_MS,PDF_ACCESS_WINDOW_MS}=require('../lib/utils/submission-pdf-access.ts');
const source={assignmentId:8,submissionId:1,author:'Synthetic Co',text:'Literal <script>alert(1)</script> & **text**\nSecond paragraph'};
test('append preserves formatted draft, literal recommendation and a clear separator',()=>{
 const doc={version:1,blocks:[{type:'paragraph',content:[{text:'Existing bold draft',bold:true,italic:true,underline:true}]},{type:'bulletList',items:[[{text:'Existing bullet'}]]},{type:'numberList',items:[[{text:'Existing numbered item'}]]}]};
 const result=appendRecommendation(encodeFeedback(doc),source);assert.equal(result.success,true);
 assert.deepEqual(decodeFeedback(result.value).blocks.slice(0,doc.blocks.length),doc.blocks);
 assert.match(feedbackPlainText(result.value),/Existing numbered item\n\n— Co-Adviser recommendation: Synthetic Co —\nLiteral <script>/);
 assert.ok(feedbackPlainText(result.value).includes('& **text**'));
});
test('multiple distinct recommendations append; malformed or oversized draft leaves content unchanged',()=>{
 const first=appendRecommendation('Existing draft',source);const second=appendRecommendation(first.value,{...source,assignmentId:9,text:'Second Co'});
 assert.ok(feedbackPlainText(second.value).includes('Existing draft'));assert.ok(feedbackPlainText(second.value).endsWith('Second Co'));
 assert.equal(appendRecommendation('x'.repeat(4990),source).success,false);
 assert.equal(appendRecommendation('\u001eTHESISHS_FEEDBACK:8\n{}',source).success,false);
});
test('recommendation persistence remains the immutable plain-text contract',()=>{
 assert.equal(recommendationSchema.safeParse({assignmentId:1,submissionId:1,recommendation:'Plain <b>literal</b>'}).success,true);
 assert.equal(recommendationSchema.safeParse({assignmentId:1,submissionId:1,recommendation:encodeFeedback({version:1,blocks:[{type:'paragraph',content:[{text:'Formatted',bold:true}]}]})}).success,false);
});
test('summaries and groups contain only supplied assignment scope and exact version links',()=>{
 const rows=[{id:1,submissionId:3,groupId:7,state:'open',reviewAvailable:true},{id:2,submissionId:4,groupId:7,state:'completed',reviewAvailable:false},{id:3,submissionId:5,groupId:8,state:'closed',reviewAvailable:false}];
 assert.deepEqual(coAssignmentSummary(rows),{total:3,open:1,completed:1});assert.deepEqual(delegatedGroups(rows).map(g=>[g.id,g.assignments.length]),[[7,2],[8,1]]);
 assert.equal(coReviewHref(rows[0]),'/dashboard/adviser/submissions/3?assignment=1');
});
test('shared PDF controller retains Main window and bounds delegated renewal below 300 seconds',async()=>{
 const sign=async()=> 'https://document.example.invalid/test';let now=0;
 const main=new SubmissionPdfAccess(1,sign,()=>now,()=>0,()=>{}),co=new SubmissionPdfAccess(1,sign,()=>now,()=>0,()=>{},CO_ADVISER_PDF_WINDOW_MS);
 await main.request();await co.request();assert.equal(main.snapshot().deadline,1680000);assert.equal(PDF_ACCESS_WINDOW_MS,1680000);assert.equal(co.snapshot().deadline,240000);
 now=240000;co.reassess();assert.equal(co.snapshot().url,null);assert.equal(main.validUrl(),'https://document.example.invalid/test');main.dispose();co.dispose();
});
