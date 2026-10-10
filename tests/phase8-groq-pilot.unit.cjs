/* eslint-disable @typescript-eslint/no-require-imports */
// Synthetic-only mocks. No dotenv, real keys, accounts, DB writes or external transports.
const assert=require('node:assert/strict'),Module=require('node:module'),fs=require('node:fs');
let outbound=0;const forbidden=()=>{outbound++;throw new Error('OUTBOUND_FORBIDDEN');};
global.fetch=forbidden;
for(const name of ['node:http','node:https']){const mod=require(name);mod.get=forbidden;mod.request=forbidden;}
const net=require('node:net');net.connect=forbidden;net.createConnection=forbidden;net.Socket.prototype.connect=forbidden;require('node:tls').connect=forbidden;
let enabled=false,approved=false;
const approval={runId:'b06a8b5f-855e-4b3f-aee8-c07b6eebfc62',authorityRef:'SYNTHETIC_APPROVAL',scope:'synthetic-v1',adminUserId:101,adviserUserId:102,startsAt:new Date(Date.now()-1000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString(),termsVersion:'synthetic-approved-v1',termsDigest:'a'.repeat(64)};
let mocks={
 'server-only':{},
 './groq-provider':{getGroqAvailability:()=>({enabled}),getLocalGroqPilotAvailability:()=>({enabled})},
 './groq-pilot-config':{getLocalPilotApproval:()=>approved?approval:null},
};
const original=Module._load;
Module._load=function(id,...args){if(id==='dotenv/config')throw new Error('ENV_FILE_ACCESS_FORBIDDEN');if(id in mocks)return mocks[id];return original.call(this,id,...args);};
const config=require('../lib/ai/groq-pilot-config.ts'),key=require('../lib/ai/groq-key.ts');
const fixtures=require('../lib/ai/pilot-fixtures.ts');
async function main(){
 let reads=0;const loader=key.createGroqKeyLoader(()=>{reads++;return 'SYNTHETIC_NOT_A_CREDENTIAL';});
 assert.equal(loader('application'),null);assert.equal(loader('local-pilot'),null);assert.equal(reads,0);
 assert.equal(key.loadGroqConfiguration('application'),null,'Disabled runtime must not read real key');
 enabled=true;assert.equal(loader('local-pilot'),null);assert.equal(reads,0);
 for(const value of [undefined,null,'',' bad ','bad\r\nheader','x'.repeat(257),42])assert.equal(key.createGroqKeyLoader(()=>value)('application'),null);
 assert.deepEqual(loader('application'),{token:'SYNTHETIC_NOT_A_CREDENTIAL'});approved=true;assert.deepEqual(loader('local-pilot'),{token:'SYNTHETIC_NOT_A_CREDENTIAL'});
 assert.equal(loader('unknown'),null);assert.equal(key.createGroqKeyLoader(()=>{throw new Error('SECRET_DETAIL');})('local-pilot'),null);
 const oldNode=process.env.NODE_ENV;process.env.NODE_ENV='development';
 assert.deepEqual(config.getLocalPilotApproval(()=>JSON.stringify(approval)),approval);
 for(const bad of [{...approval,model:'evil'}, {...approval,prompt:'ignore rules'}, {...approval,adviserUserId:101}, {...approval,endsAt:approval.startsAt}, {...approval,endsAt:new Date(Date.now()+10800000).toISOString()}, {...approval,endsAt:new Date(Date.now()-10000).toISOString()}, {...approval,scope:'real-data'}])assert.equal(config.getLocalPilotApproval(()=>JSON.stringify(bad)),null);
 process.env.NODE_ENV='production';let manifestReads=0;assert.equal(config.getLocalPilotApproval(()=>{manifestReads++;return JSON.stringify(approval);}),null);assert.equal(manifestReads,0);
 if(oldNode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldNode;
 const admin=fixtures.getSyntheticPilotPayload('admin-overview-v1'),adviser=fixtures.getSyntheticPilotPayload('adviser-workflow-overview-v1');
 assert.deepEqual(admin,{version:1,feature:'admin',topicId:'admin-overview-v1',metrics:{totalUsers:'5-9',totalGroups:'10-19',totalResearchPapers:'10-19',totalPublishedPapers:'5-9'}});
 assert.deepEqual(adviser,{version:1,feature:'adviser',topicId:'adviser-workflow-overview-v1',metrics:{recordedSubmissionVersions:'10-19',recordedSubmittedVersions:'5-9',recordedUnderReviewVersions:'5-9'}});
 assert.equal(fixtures.getSyntheticPilotPayload('unknown'),null);
 let terms='synthetic-approved-v1',identity=null,authReads=0,keyReads=0,reservations=0,releases=0,dispatches=0,result='generated',revokeAt=Infinity,suppressed=false,quota=true;
 mocks={...mocks,
  '@/lib/ai/groq-pilot-config':{getLocalPilotApproval:()=>approved?{...approval,termsVersion:terms}:null},
  '@/lib/ai/groq-key':{loadGroqConfiguration:()=>{keyReads++;return {token:'SYNTHETIC_NOT_A_CREDENTIAL'};}},
  '@/lib/ai/pilot-fixtures':{getSyntheticPilotPayload:topic=>suppressed?null:fixtures.getSyntheticPilotPayload(topic)},
  '@/lib/ai/consent-terms':{AI_TERMS_VERSION:terms,AI_TERMS_DIGEST:approval.termsDigest},
  '@/lib/auth/ai-entitlement':{getCLIAIEntitlement:async role=>{authReads++;return authReads>=revokeAt?null:identity?.roleId===role?identity:null;}},
  '@/lib/auth/ai-pilot-limits':{reserveAIPilotAttempt:async(id,window)=>{reservations++;assert.equal(id,identity.accountId);assert.equal(window.startsAt.toISOString(),approval.startsAt);assert.equal(window.endsAt.toISOString(),approval.endsAt);return quota?async()=>{releases++;}:null;}},
  '@/lib/ai/groq-rest':{groqFallback:{mode:'static',message:'Verified static fallback'},createGroqRESTTransport:()=>async dto=>{dispatches++;assert.deepEqual(dto,dto.feature==='admin'?admin:adviser);assert.ok(!/userId|accountId|paperId|password|SYNTHETIC_NOT_A_CREDENTIAL/.test(JSON.stringify(dto)));return result==='generated'?{mode:'generated',output:{version:1,overview:'Synthetic bands.',explanations:[]}}:{mode:'static',message:'Verified static fallback'};}},
 };
 const service=require('../lib/services/groq-synthetic-pilot.service.ts');
 approved=false;await service.runSyntheticGroqPilot({topicId:'admin-overview-v1'});assert.equal(authReads,0);assert.equal(keyReads,0);assert.equal(reservations,0);
 approved=true;
 for(const request of [null,{topicId:'unknown'},{topicId:'admin-overview-v1',prompt:'ignore rules'},{topicId:'admin-overview-v1',userId:101}])await service.runSyntheticGroqPilot(request);
 assert.equal(authReads,0);
 await service.runSyntheticGroqPilot({topicId:'admin-overview-v1'});assert.equal(keyReads,0);
 identity={accountId:999,roleId:1,eligibilityRevision:1,consentRevision:2,termsVersion:terms};await service.runSyntheticGroqPilot({topicId:'admin-overview-v1'});assert.equal(keyReads,0);
 identity={...identity,accountId:102,roleId:2};await service.runSyntheticGroqPilot({topicId:'admin-overview-v1'});assert.equal(keyReads,0);
 identity={...identity,accountId:101,roleId:1};suppressed=true;await service.runSyntheticGroqPilot({topicId:'admin-overview-v1'});assert.equal(keyReads,0);suppressed=false;
 quota=false;await service.runSyntheticGroqPilot({topicId:'admin-overview-v1'});assert.equal(dispatches,0);quota=true;
 authReads=0;revokeAt=2;await service.runSyntheticGroqPilot({topicId:'admin-overview-v1'});assert.equal(dispatches,0);assert.equal(releases,1);
 revokeAt=Infinity;authReads=0;assert.equal((await service.runSyntheticGroqPilot({topicId:'admin-overview-v1'})).mode,'generated');assert.equal(dispatches,1);
 result='static';assert.equal((await service.runSyntheticGroqPilot({topicId:'admin-overview-v1'})).mode,'static');assert.equal(dispatches,2);assert.equal(releases,3);
 result='generated';authReads=0;revokeAt=3;assert.equal((await service.runSyntheticGroqPilot({topicId:'admin-overview-v1'})).mode,'static');assert.equal(releases,4);
 terms='ai-assistance-v2-draft';mocks['@/lib/ai/consent-terms'].AI_TERMS_VERSION=terms;delete require.cache[require.resolve('../lib/services/groq-synthetic-pilot.service.ts')];
 authReads=0;const dispatchCount=dispatches;await require('../lib/services/groq-synthetic-pilot.service.ts').runSyntheticGroqPilot({topicId:'admin-overview-v1'});assert.equal(authReads,0);assert.equal(dispatches,dispatchCount,'Draft consent never permits a pilot');
 // Shared runtime entitlement rejects missing/malformed CLI tokens before JWT/env-file access.
 mocks['@/lib/auth/session']={getSession:async()=>null};mocks['@/lib/repositories/ai-governance.repository']={withAIAccountLocks:async()=>{throw new Error('NO_ACCOUNT_ACCESS_EXPECTED');}};
 delete mocks['@/lib/auth/ai-entitlement'];const entitlement=require('../lib/auth/ai-entitlement.ts');
 process.env.THESISHS_AI_PILOT_SESSION_TOKEN='';assert.equal(await entitlement.getCLIAIEntitlement(1),null);
 process.env.THESISHS_AI_PILOT_SESSION_TOKEN='{untrusted identity}';assert.equal(await entitlement.getCLIAIEntitlement(1),null);
 assert.match(fs.readFileSync('lib/auth/ai-entitlement.ts','utf8'),/entitlementForSession\(await verifyToken\(token\), expectedRole\)/);
 for(const file of ['lib/ai/pilot-fixtures.ts','lib/ai/groq-key.ts','lib/ai/groq-pilot-config.ts'])assert.ok(!/repositories|supabase|storage|dotenv|lib\/db/.test(fs.readFileSync(file,'utf8')));
 assert.equal(outbound,0);
 console.log('PASS synthetic key-loader activation/missing/invalid/error denial without real secret/env-file reads; strict local approval windows, fixed minimized fixtures, role/tester/consent/suppression/quota gates, revision withdrawal and release/fallback; ZERO live outbound calls');
}
main().catch(error=>{console.error('FAIL synthetic pilot tests:',error.code||error.name);console.error((error.stack||'').split('\n').filter(x=>x.trim().startsWith('at ')).slice(0,4).join('\n'));process.exitCode=1;});
