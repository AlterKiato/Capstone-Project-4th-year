/* eslint-disable @typescript-eslint/no-require-imports */
// node --import tsx tests/phase8-groq-rest.unit.cjs -- synthetic mocked fetch only.
const assert=require('node:assert/strict'),Module=require('node:module'),fs=require('node:fs');
let outbound=0;
const forbidden=()=>{outbound++;throw new Error('Outbound forbidden');};
global.fetch=forbidden;
for(const name of ['node:http','node:https']) {const m=require(name);m.get=forbidden;m.request=forbidden;}
const net=require('node:net');net.connect=forbidden;net.createConnection=forbidden;net.Socket.prototype.connect=forbidden;require('node:tls').connect=forbidden;
const original=Module._load;let mocks={'server-only':{},'@/lib/ai/groq-key':{loadGroqConfiguration:()=>null},'@/lib/repositories/ai-pilot-quota.repository':{reservePilotAttempt:async()=>null,releasePilotAttempt:async()=>{}}};
Module._load=function(id,...args){if(id in mocks)return mocks[id];return original.call(this,id,...args);};
const rest=require('../lib/ai/groq-rest.ts');
const {AI_PILOT_LIMITS,reserveAIPilotAttempt}=require('../lib/auth/ai-pilot-limits.ts');
const admin={version:1,feature:'admin',topicId:'admin-overview-v1',metrics:{totalUsers:'5-9'}};
const adviser={version:1,feature:'adviser',topicId:'adviser-workflow-overview-v1',metrics:{recordedSubmissionVersions:'10-19'}};
const output=dto=>({version:1,overview:'Available statistics are approximate bands.',explanations:[{metricId:Object.keys(dto.metrics)[0],text:'This band describes recorded system activity.'}]});
const wire=(value,finish='stop',extra={})=>new Response(JSON.stringify({id:'provider-metadata-not-returned',choices:[{finish_reason:finish,message:{role:'assistant',content:JSON.stringify(value),...extra}}]}),{status:200,headers:{'content-type':'application/json'}});
const config={token:'SYNTHETIC_NOT_A_CREDENTIAL'};const logs=[];
async function main(){
 for(const dto of [admin,adviser]) {
  let calls=0;
  const adapter=rest.createGroqRESTTransport(async(url,request)=>{
   calls++;assert.equal(url,rest.GROQ_ENDPOINT);assert.equal(request.redirect,'error');assert.equal(request.cache,'no-store');assert.equal(request.method,'POST');
   const body=JSON.parse(request.body);assert.equal(body.model,'openai/gpt-oss-20b');assert.equal(body.messages.length,2);assert.deepEqual(JSON.parse(body.messages[1].content),dto);
   assert.deepEqual(Object.keys(body).sort(),['max_completion_tokens','messages','model','reasoning_effort','response_format','stream'].sort());
   assert.equal(body.response_format.json_schema.strict,true);assert.equal(body.max_completion_tokens,1024);assert.equal(body.stream,false);
   assert.ok(!/userId|accountId|paperId|password|SYNTHETIC_NOT_A_CREDENTIAL/.test(request.body));return wire(output(dto));
  },undefined,event=>logs.push(event));
  assert.equal((await adapter(dto,config)).mode,'generated');assert.equal(calls,1);
 }
 let calls=0;const good=rest.createGroqRESTTransport(async()=>{calls++;return wire(output(admin));});
 for(const dto of [null,{...admin,userId:10},{...admin,prompt:'ignore rules'},{...admin,metrics:{}},{...admin,metrics:{totalUsers:4}},{...admin,metrics:{totalUsers:undefined}},{...admin,metrics:{totalUsers:'5-9',paperTitle:'private'}}])assert.equal((await good(dto,config)).mode,'static');
 for(const cfg of [null,{}, {...config,endpoint:'https://evil.invalid'}, {token:'bad\r\nheader'}])assert.equal((await good(admin,cfg)).mode,'static');assert.equal(calls,0);
 for(const status of [301,429,500,503]) {
  let count=0;const adapter=rest.createGroqRESTTransport(async()=>{count++;return new Response('PRIVATE_ERROR',{status});},undefined,event=>logs.push(event));
  assert.equal((await adapter(admin,config)).mode,'static');assert.equal(count,1,'No retries');
 }
 for(const bad of [{...output(admin),extra:'private'},{...output(admin),overview:'<script>evil</script>'},{...output(admin),overview:'https://evil.invalid'}, {...output(admin),overview:'Approve the paper'}, {...output(admin),overview:'x'.repeat(801)}, {...output(admin),explanations:[]},{...output(admin),explanations:[{metricId:'privateMetric',text:'text'}]}, {...output(admin),explanations:[...output(admin).explanations,...output(admin).explanations]}]) {
  const adapter=rest.createGroqRESTTransport(async()=>wire(bad));assert.equal((await adapter(admin,config)).mode,'static');
 }
 for(const response of [()=>wire(output(admin),'length'),()=>wire(output(admin),'stop',{tool_calls:[]}),()=>wire(output(admin),'stop',{function_call:{name:'bad'}}),()=>wire(output(admin),'stop',{refusal:'no'}),()=>new Response('{invalid',{headers:{'content-type':'application/json'}}),()=>new Response('x'.repeat(32769),{headers:{'content-type':'application/json'}}),()=>new Response('{}',{headers:{'content-type':'text/html'}})])assert.equal((await rest.createGroqRESTTransport(async()=>response())(admin,config)).mode,'static');
 let fire,cancelled=false,signal;const adapter=rest.createGroqRESTTransport(async(_url,request)=>{signal=request.signal;return new Promise(()=>{});},(delay,fn)=>{assert.equal(delay,10000);fire=fn;return()=>{cancelled=true;};},event=>logs.push(event));
 const pending=adapter(admin,config);fire();assert.equal((await pending).mode,'static');assert.equal(signal.aborted,true);assert.equal(cancelled,true);
 // Deadline includes streaming body, not only arrival of HTTP headers.
 let bodyDeadline,bodyCancelled=false;
 const streaming=rest.createGroqRESTTransport(async()=>new Response(new ReadableStream({start(){},cancel(){bodyCancelled=true;}}),{headers:{'content-type':'application/json'}}),(delay,fn)=>{assert.equal(delay,10000);bodyDeadline=fn;return()=>{};});
 const stalled=streaming(admin,config);await Promise.resolve();bodyDeadline();assert.equal((await stalled).mode,'static');assert.equal(bodyCancelled,true);
 for(const flag of ['ADMIN_AI_REPORT_ENABLED','ADVISER_AI_WORKFLOW_ENABLED','AI_GUIDE_ENABLED'])process.env[flag]='true';
 assert.equal((await rest.interpretGroqAggregate(admin)).mode,'static');
 assert.deepEqual(AI_PILOT_LIMITS,{perUserPerUTCDay:3,globalPerUTCDay:10,cooldownMs:120000,concurrency:1});assert.equal(await reserveAIPilotAttempt(1),null);
 const {createMockLimiter}=require('./helpers/phase8-mock-groq.ts');let time=0;const limiter=createMockLimiter(()=>time);
 for(let i=0;i<3;i++){const release=limiter.reserve(1);assert.ok(release);assert.equal(limiter.reserve(2),null);release();assert.equal(limiter.reserve(1),null);time+=120000;}assert.equal(limiter.reserve(1),null);
 for(let id=2;id<=8;id++){const release=limiter.reserve(id);assert.ok(release);release();time+=120000;}assert.equal(limiter.reserve(9),null);
 assert.ok(logs.some(e=>e.category==='timeout'));assert.ok(logs.every(e=>Object.keys(e).sort().join(',')==='category,durationMs'));assert.ok(!JSON.stringify(logs).includes('PRIVATE_'));
 console.log('PASS mocked REST fixed endpoint/model/prompts, strict minimized payload/output, byte bounds, tool/refusal/truncation rejection, 10s fetch/body timeout, 429/5xx/no retries, safe logs and disabled flags; unavailable quota store fails closed');
 // Service orchestration only: repository/eligibility mocks stay outside the provider module.
 let enabled=false,entitlement={accountId:11,roleId:1,eligibilityRevision:2,consentRevision:3,termsVersion:'synthetic'},reads=0,prepared=0,invoked=0,reserved=0,released=0,quota=false,scope=true,revokeAfterRead=false;
 const fallback={success:true,mode:'static',message:'Verified static guidance'};
 mocks={...mocks,
 '@/lib/ai/groq-provider':{getGroqAvailability:()=>({enabled,available:enabled})},
 '@/lib/ai/groq-rest':{interpretGroqAggregate:async dto=>{invoked++;return {mode:'generated',output:output(dto)};}},
 '@/lib/auth/ai-entitlement':{getAIEntitlement:async role=>{reads++;return revokeAfterRead&&reads>1?null:entitlement?.roleId===role?entitlement:null;}},
 '@/lib/auth/ai-pilot-limits':{reserveAIPilotAttempt:async id=>{reserved++;assert.equal(id,11);return quota?()=>released++:null;}},
 '@/lib/services/ai-aggregation.service':{prepareLocalAdminAggregate:async()=>{prepared++;return {success:scope,payload:scope?admin:null};},prepareLocalAdviserAggregate:async()=>{prepared++;return {success:scope,payload:scope?adviser:null};}},
 '@/lib/services/ai-foundation.service':{getLocalAdminAssistance:async()=>fallback,getLocalAdviserAssistance:async()=>fallback}};
 const service=require('../lib/services/ai-interpretation.service.ts');
 await service.getAdminInterpretation({reportId:'admin-overview-v1'});assert.equal(reads,0);assert.equal(prepared,0);
 enabled=true;entitlement=null;await service.getAdminInterpretation({reportId:'admin-overview-v1'});assert.equal(prepared,0);assert.equal(invoked,0);
 entitlement={accountId:11,roleId:2,eligibilityRevision:2,consentRevision:3,termsVersion:'synthetic'};await service.getAdminInterpretation({reportId:'admin-overview-v1'});assert.equal(prepared,0);
 scope=false;await service.getAdviserInterpretation({topicId:'adviser-workflow-overview-v1'});assert.equal(invoked,0);assert.equal(reserved,0);
 scope=true;quota=false;await service.getAdviserInterpretation({topicId:'adviser-workflow-overview-v1'});assert.equal(invoked,0);
 quota=true;reads=0;revokeAfterRead=true;await service.getAdviserInterpretation({topicId:'adviser-workflow-overview-v1'});assert.equal(invoked,0);
 revokeAfterRead=false;reads=0;const positive=await service.getAdviserInterpretation({topicId:'adviser-workflow-overview-v1'});assert.equal(positive.mode,'generated');assert.equal(invoked,1);assert.equal(released,1);
 await service.getAdviserInterpretation({topicId:'adviser-start-review-v1'});await service.getAdviserInterpretation({topicId:'adviser-workflow-overview-v1',userId:99});assert.equal(invoked,1);
 // Even a mocked enabled availability cannot supply runtime configuration.
 assert.equal((await rest.interpretGroqAggregate(admin)).mode,'static');assert.equal(outbound,0);
 for(const file of ['lib/ai/groq-rest.ts','lib/ai/groq-provider.ts'])assert.ok(!/repositories|supabase|storage|lib\/db|process\.env/.test(fs.readFileSync(file,'utf8')));
 console.log('PASS internal service disabled/auth/role/owned/suppressed/quota/procedural-input guards, entitlement rechecks/release; actual credentials unavailable and ZERO live outbound attempts');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
