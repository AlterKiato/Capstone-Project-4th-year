/* eslint-disable @typescript-eslint/no-require-imports */
// node --import tsx tests/phase8-ai-governance.unit.cjs
// Actual service/repository code against a synthetic transactional persistence double. No DB connection/migration.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
let outbound=0;
const block=()=>{outbound++;throw new Error('Network forbidden');};
global.fetch=block;
for(const name of ['node:http','node:https']){const api=require(name);api.request=block;api.get=block;}
require('node:net').Socket.prototype.connect=block;
let session, accounts, events, consents, queue=Promise.resolve(), failRead=false, failConsent=false;
const {getTableName}=require('drizzle-orm');
const stamp=new Date('2026-01-01T00:00:00Z');
const params=node=>{
    if(Array.isArray(node))return node.flatMap(params);
    if(!node||typeof node!=='object')return[];
    if(node.constructor?.name==='Param')return[node.value];
    return (node.queryChunks??[]).flatMap(params);
};
function select(fields){
    let table,condition;
    const result=()=>{
        if(failRead)throw new Error('PRIVATE_DATABASE_ERROR');
        const name=getTableName(table), ids=params(condition);
        const data=name==='users'?accounts:name==='ai_eligibility_events'?events:consents;
        const rows=data.filter(row=>ids.includes(name==='users'?row.id:row.userId));
        rows.sort((a,b)=>name==='users'?a.id-b.id:b.id-a.id);
        return rows.map(row=>fields?Object.fromEntries(Object.keys(fields).map(key=>[key,row[key]])):{...row});
    };
    const chain={from:t=>(table=t,chain),where:c=>(condition=c,chain),orderBy:()=>chain,
        limit:n=>Promise.resolve(result().slice(0,n)),for:mode=>{assert.equal(mode,'update');return Promise.resolve(result());},
        then:(yes,no)=>Promise.resolve().then(result).then(yes,no)};
    return chain;
}
function insert(table){return{values:data=>({returning:async()=>{
    const name=getTableName(table);if(name==='ai_consent_events'&&failConsent)throw new Error('PRIVATE_INSERT_ERROR');
    const target=name==='ai_eligibility_events'?events:consents;
    const row={id:Math.max(0,...target.map(event=>event.id))+1,recordedAt:new Date(),revoked:false,
        verifierUserId:null,verifierAuthorizationRef:null,externalAuthorityRef:null,decisionRoleId:null,
        accountUpdatedAt:null,eligibilityEventId:null,...data};target.push(row);return[{...row}];
}})};}
const syntheticDB={select,transaction:work=>{
    const run=queue.then(async()=>{
        const before=structuredClone({events,consents});
        try{return await work({select,insert});}catch(error){events=before.events;consents=before.consents;throw error;}
    });queue=run.catch(()=>{});return run;
}};
const original=Module._load;
Module._load=function(id,...args){
    if(id==='server-only')return{};
    if(id==='@/lib/db')return{db:syntheticDB};
    if(id==='@/lib/auth/session')return{getSession:async()=>session};
    assert.ok(!/dotenv|^postgres$|supabase|storage/.test(id),'No actual DB/config/storage access');
    return original.call(this,id,...args);
};
const services=require('../lib/services/ai-governance.service.ts');
const actions=require('../lib/actions/ai-governance.action.ts');
const repo=require('../lib/repositories/ai-governance.repository.ts');
const {getAIEntitlement,getAIProviderAccount}=require('../lib/auth/ai-entitlement.ts');
const {getAIInterpretationAuthorization}=require('../lib/auth/ai-authorization.ts');
const {getVerifierAuthorizationRef}=require('../lib/auth/ai-verifier-config.ts');
const {AI_TERMS_VERSION,AI_TERMS_DIGEST}=require('../lib/ai/consent-terms.ts');
const {getGroqAvailability}=require('../lib/ai/groq-provider.ts');
function actor(id=10){const account=accounts.find(item=>item.id===id);session={userId:id,roleId:account?.roleId??1,adultVerified:true};}
function reset(){
    accounts=[{id:10,roleId:1,isActive:true,updatedAt:stamp},{id:20,roleId:2,isActive:true,updatedAt:stamp},
        {id:30,roleId:1,isActive:true,updatedAt:stamp},{id:40,roleId:3,isActive:true,updatedAt:stamp},
        {id:50,roleId:4,isActive:true,updatedAt:stamp}];
    events=[{id:1,userId:10,decision:'Eligible',eventKind:'bootstrap',decisionRoleId:1,accountUpdatedAt:stamp,
        verifierUserId:null,verifierAuthorizationRef:null,externalAuthorityRef:'INSTITUTION-TEST',revoked:false,recordedAt:stamp}];
    consents=[];failRead=false;failConsent=false;actor();
    process.env.AI_INSTITUTIONAL_VERIFIERS_JSON=JSON.stringify([{userId:10,authorizationRef:'AUTH-TEST-10'},{userId:30,authorizationRef:'AUTH-TEST-30'}]);
}
const revision=id=>events.filter(event=>event.userId===id).at(-1)?.id??0;
const consentRevision=id=>consents.filter(event=>event.userId===id).at(-1)?.id??0;
const decision=(id=20,value='Eligible',revoke=false)=>({userId:id,decision:value,revoke,confirmation:true,expectedRevision:revision(id)});
const accept=()=>({action:'accept',termsVersion:AI_TERMS_VERSION,acceptance:true,expectedRevision:consentRevision(session.userId)});
const safe=result=>assert.ok(!/PRIVATE_|AUTH-TEST|INSTITUTION-TEST/.test(JSON.stringify(result)));
async function approveAndAccept(){actor();assert.equal((await actions.recordAIEligibilityAction(decision())).success,true);actor(20);assert.equal((await actions.recordAIConsentAction(accept())).success,true);}
async function main(){
    reset();assert.equal(await getAIEntitlement(2),null);
    for(const config of ['', 'bad', '{}', '[{"userId":10,"authorizationRef":"a","extra":true}]',
        '[{"userId":10,"authorizationRef":"a"},{"userId":10,"authorizationRef":"b"}]']){
        process.env.AI_INSTITUTIONAL_VERIFIERS_JSON=config;
        assert.equal(getVerifierAuthorizationRef(10),null);
        assert.equal((await services.recordAIEligibility(decision())).success,false);
    }
    reset();actor(30);assert.equal((await services.recordAIEligibility(decision())).success,false,'Configured but independently unverified verifier denied');
    actor(20);assert.equal((await services.recordAIEligibility(decision(30))).success,false,'Adviser is not a verifier');
    actor();assert.equal((await services.recordAIEligibility(decision(10))).success,false,'Self-certification denied');
    for(const id of [40,50])assert.equal((await services.recordAIEligibility(decision(id))).success,false,'Unsupported target role');
    for(const patch of [{confirmation:false},{externalAuthorityRef:'fake'},{verifierUserId:30},{recordedAt:'fake'},{decision:'Invalid'},
        {expectedRevision:99},{revoke:true,decision:'Eligible'}])assert.equal((await services.recordAIEligibility({...decision(),...patch})).success,false);
    accounts[0].isActive=false;assert.equal((await services.recordAIEligibility(decision())).success,false);accounts[0].isActive=true;
    session.roleId=2;assert.equal((await services.recordAIEligibility(decision())).success,false);actor();
    events[0].revoked=true;assert.equal((await services.recordAIEligibility(decision())).success,false);events[0].revoked=false;
    session=null;assert.equal((await services.recordAIEligibility(decision())).success,false);actor();
    console.log('PASS server-only config, independent verifier authority, active roles, self-approval and strict request denial');

    reset();const input=decision();const raced=await Promise.all([services.recordAIEligibility(input),services.recordAIEligibility(input)]);
    assert.equal(raced.filter(result=>result.success).length,1,'Stale concurrent certification denied');
    const stored=await repo.findLatestAIEligibility(20);assert.equal(stored.decision,'Eligible');
    assert.equal(stored.verifierUserId,10);assert.equal(stored.verifierAuthorizationRef,'AUTH-TEST-10');assert.ok(stored.recordedAt instanceof Date);
    actor(20);assert.equal(await getAIEntitlement(2),null,'Consent absent');
    for(const patch of [{acceptance:false},{termsVersion:'old'},{termsVersion:AI_TERMS_VERSION,userId:10},{expectedRevision:99}]){
        const result=await services.recordAIConsent({...accept(),...patch});assert.equal(result.success,false);safe(result);
    }
    assert.equal((await services.recordAIConsent(accept())).success,true);
    const entitlement=await getAIInterpretationAuthorization(2);assert.equal(entitlement.accountId,20);
    assert.equal(await getAIEntitlement(1),null,'Cross-role entitlement denied');
    const consent=await repo.findLatestAIConsent(20);assert.equal(consent.termsDigest,AI_TERMS_DIGEST);assert.equal(consent.eligibilityEventId,stored.id);
    assert.equal(await getAIProviderAccount(2),null,'Valid entitlement cannot enable Groq');
    assert.equal((await services.recordAIConsent({action:'withdraw',expectedRevision:consentRevision(20)})).success,true);
    assert.equal(await getAIEntitlement(2),null);assert.equal(consents.length,2,'Withdrawal preserves history');
    assert.equal((await services.recordAIConsent({...accept(),expectedRevision:consent.id})).success,false,'Stale acceptance cannot undo withdrawal');
    assert.equal((await services.recordAIConsent(accept())).success,true,'Explicit fresh reacceptance');
    consents.at(-1).termsVersion='old';assert.equal(await getAIEntitlement(2),null);consents.at(-1).termsVersion=AI_TERMS_VERSION;
    consents.at(-1).termsDigest='0'.repeat(64);assert.equal(await getAIEntitlement(2),null);consents.at(-1).termsDigest=AI_TERMS_DIGEST;
    assert.equal((await services.recordAIConsent({action:'decline',termsVersion:AI_TERMS_VERSION,expectedRevision:consentRevision(20)})).success,true);
    assert.equal(await getAIEntitlement(2),null);
    console.log('PASS repository persistence contract, version/digest checks, explicit consent, withdrawal/replay and reacceptance');

    reset();await approveAndAccept();const priorEvents=events.length,priorConsent=consents.length;
    actor();failConsent=true;const failed=await services.recordAIEligibility(decision(20,'Not Eligible',true));safe(failed);
    assert.equal(failed.success,false);assert.equal(events.length,priorEvents,'Certification and consent withdrawal roll back atomically');assert.equal(consents.length,priorConsent);failConsent=false;
    assert.equal((await services.recordAIEligibility(decision(20,'Not Eligible',true))).success,true);
    assert.equal(events.at(-1).revoked,true);assert.equal(consents.at(-1).eventKind,'withdrawn');actor(20);assert.equal(await getAIEntitlement(2),null);
    assert.equal((await services.recordAIConsent(accept())).success,false,'Revoked eligibility cannot accept consent');
    assert.equal((await services.recordAIConsent({action:'withdraw',expectedRevision:consentRevision(20)})).success,true,'Withdrawal independent of eligibility');
    actor();assert.equal((await services.recordAIEligibility(decision(20,'Pending Verification'))).success,true);assert.equal(events.at(-1).decision,'Pending Verification');
    actor(20);assert.equal(await getAIEntitlement(2),null);
    reset();await approveAndAccept();accounts[1].updatedAt=new Date(stamp.getTime()+1000);assert.equal(await getAIEntitlement(2),null,'Account-management revision invalidates eligibility');
    accounts[1].roleId=3;session.roleId=3;assert.equal(await getAIEntitlement(2),null);
    assert.equal((await services.recordAIConsent({action:'withdraw',expectedRevision:consentRevision(20)})).success,true,'Withdrawal after role loss');
    reset();actor(20);failRead=true;assert.equal(await getAIEntitlement(2),null);safe(await services.recordAIConsent(accept()));
    reset();await approveAndAccept();for(const flag of ['ADMIN_AI_REPORT_ENABLED','ADVISER_AI_WORKFLOW_ENABLED','AI_GUIDE_ENABLED'])process.env[flag]='true';
    assert.deepEqual(getGroqAvailability(),{enabled:false,available:false});assert.equal(await getAIProviderAccount(2),null);
    assert.equal(outbound,0);
    const sql=fs.readFileSync('db/migrations/0010_ai_eligibility_consent.sql','utf8');
    assert.equal((sql.match(/CREATE TABLE/g)??[]).length,2);assert.ok(!/^\s*(DROP|DELETE|UPDATE|INSERT)\b|ALTER TABLE "users"/im.test(sql));
    assert.match(sql,/coalesce/);assert.match(sql,/CHECK/);assert.match(sql,/ON DELETE restrict/);
    assert.ok(!/bootstrap/.test(fs.readFileSync('lib/actions/ai-governance.action.ts','utf8')),'No web bootstrap endpoint');
    console.log('PASS revocation/reset, atomic rollback, stale account/role/missing-registry denial, additive SQL review and zero provider calls');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
