/* eslint-disable @typescript-eslint/no-require-imports */
// node --import tsx tests/phase8-ai-governance.acceptance.cjs
// Development-only real SQL; all fixtures and service writes roll back together.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const Module = require('node:module');
require('dotenv').config({quiet:true});
const postgres = require('postgres');
const {drizzle} = require('drizzle-orm/postgres-js');
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname,'localhost');
assert.equal(target.port || '5432','5432');
assert.equal(target.pathname,'/thesishs_ai');
const client = postgres(target.toString(),{max:1,connect_timeout:5,onnotice:()=>{},connection:{statement_timeout:'15000',application_name:'phase8_rollback_acceptance'}});
const marker = 'PHASE8_GOVERNANCE_'+crypto.randomUUID();
const rollback = new Error('EXPECTED_TEST_ROLLBACK');
const originalLoad = Module._load;
const originalConfig = process.env.AI_INSTITUTIONAL_VERIFIERS_JSON;
let rootDB, session, outbound = 0, finished = false;
Module._load = function(id,...args) {
    if(id==='server-only') return {};
    if(id==='@/lib/db') return {db:rootDB};
    if(id==='@/lib/auth/session') return {getSession:async()=>session};
    return originalLoad.call(this,id,...args);
};
const originalFetch = global.fetch;
global.fetch = ()=>{outbound++;throw new Error('OUTBOUND_FORBIDDEN');};
const networkOriginals = [];
for(const name of ['node:http','node:https']) {
    const mod = require(name);
    for(const method of ['get','request']) {
        networkOriginals.push([mod,method,mod[method]]);
        mod[method] = ()=>{outbound++;throw new Error('OUTBOUND_FORBIDDEN');};
    }
}
// postgres.js returns Result arrays with metadata/prototype. Normalize both sides.
const plainRows = result => Array.from(result,row=>({...row}));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function verifyLedger(sql) {
    const actual = plainRows(await sql`SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`);
    const entries = JSON.parse(fs.readFileSync('db/migrations/meta/_journal.json','utf8')).entries;
    assert.equal(entries.length,11);
    const expected = entries.map(e=>({hash:sha(fs.readFileSync('db/migrations/'+e.tag+'.sql')),created_at:String(e.when)}));
    assert.deepEqual(actual,expected);
    assert.deepEqual(actual.slice(0,10),expected.slice(0,10));
    const objects = await sql`SELECT c.relname,p.contype,count(*)::int AS n FROM pg_constraint p JOIN pg_class c ON c.oid=p.conrelid JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relname IN ('ai_eligibility_events','ai_consent_events') AND p.contype IN ('c','f','p') GROUP BY c.relname,p.contype`;
    assert.equal(objects.reduce((n,r)=>n+(r.contype==='f'?r.n:0),0),5);
    assert.equal(objects.reduce((n,r)=>n+(r.contype==='c'?r.n:0),0),4);
    assert.equal(objects.reduce((n,r)=>n+(r.contype==='p'?r.n:0),0),2);
    const indexes = await sql`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN ('ai_eligibility_user_event_idx','ai_consent_user_event_idx')`;
    assert.equal(indexes.length,2);
}
async function eventCounts(sql) {
    const [counts] = await sql`SELECT (SELECT count(*)::int FROM ai_eligibility_events) AS eligibility,(SELECT count(*)::int FROM ai_consent_events) AS consent`;
    return {...counts};
}
async function main() {
    await verifyLedger(client);
    const before = await eventCounts(client);
    assert.deepEqual(before,{eligibility:0,consent:0},'Expected pristine governance tables before fixture tests');
    try {
        const schema = require("../db/schema/index.ts");
        await drizzle(client,{schema}).transaction(async transaction=>{
            rootDB = transaction; // Existing repositories use actual Drizzle nested savepoints.
            const tx = transaction.session.client; // Installed postgres-js transaction client, test-only SQL.
            const {createManagedAccount} = require('../lib/services/user.service.ts');
            const {getEligibilityUI,getConsentUI} = require('../lib/services/ai-governance-ui.service.ts');
            const {recordAIEligibility,recordAIConsent} = require('../lib/services/ai-governance.service.ts');
            const {findLatestAIEligibility,findLatestAIConsent} = require('../lib/repositories/ai-governance.repository.ts');
            const {getAIEntitlement,getAIProviderAccount} = require('../lib/auth/ai-entitlement.ts');
            const {AI_TERMS_VERSION,AI_TERMS_DIGEST} = require('../lib/ai/consent-terms.ts');
            const ids = [];
            for(const role of [1,2,1,3,4]) {
                const [user] = await rootDB.insert(schema.users).values({firstName:'Synthetic',lastName:marker,email:marker+'-'+ids.length+'@example.invalid',password:'NOT_A_LOGIN_HASH',roleId:role}).returning();
                ids.push(user.id);
            }
            const [verifier,adviser,unverified,student,panel] = ids;
            const actor = (id,roleId)=>{session={userId:id,roleId};};
            const revision = async id=>(await findLatestAIEligibility(id))?.id??0;
            const consentRevision = async id=>(await findLatestAIConsent(id))?.id??0;
            const decision = async (id,value='Eligible',revoke=false)=>({userId:id,decision:value,revoke,confirmation:true,expectedRevision:await revision(id)});
            const accept = async ()=>({action:'accept',termsVersion:AI_TERMS_VERSION,acceptance:true,expectedRevision:await consentRevision(session.userId)});
            const certify = async (value='Eligible',revoke=false)=>{actor(verifier,1);assert.equal((await recordAIEligibility(await decision(adviser,value,revoke))).success,true);};
            const accountInput = {firstName:'Synthetic',lastName:marker,email:marker+'-created@example.invalid',password:'Synthetic-password-only',confirmPassword:'Synthetic-password-only',roleId:2};
            actor(student,3);assert.equal((await createManagedAccount(accountInput)).success,false);
            actor(student,1);assert.equal((await createManagedAccount(accountInput)).success,false,'Stale Admin claim denied');
            actor(verifier,1);assert.equal((await createManagedAccount({...accountInput,roleId:3})).success,false);
            assert.equal((await createManagedAccount({...accountInput,verifierUserId:verifier})).success,false);
            assert.equal((await createManagedAccount({...accountInput,confirmPassword:'different'})).success,false);
            await tx`UPDATE users SET is_active=false WHERE id=${verifier}`;
            assert.equal((await createManagedAccount(accountInput)).success,false);
            await tx`UPDATE users SET is_active=true WHERE id=${verifier}`;
            for(const roleId of [1,2]) {
                const created = await createManagedAccount({...accountInput,email:marker+'-created-'+roleId+'@example.invalid',roleId});
                assert.equal(created.success,true);assert.deepEqual(Object.keys(created.data),['id']);
                const [stored] = await tx`SELECT role_id,password FROM users WHERE id=${created.data.id}`;
                assert.equal(stored.role_id,roleId);assert.notEqual(stored.password,accountInput.password);
                assert.equal(await findLatestAIEligibility(created.data.id),null,'Creation defaults Pending without registry writes');
            }
            assert.equal((await createManagedAccount({...accountInput,email:marker+'-created-1@example.invalid'})).success,false,'Duplicate account denied');
            actor(adviser,2);assert.equal((await getEligibilityUI({userId:verifier})).available,false);
            actor(verifier,1);assert.equal((await getEligibilityUI({userId:adviser})).canDecide,false);
            assert.equal((await getEligibilityUI({userId:adviser,verifierUserId:verifier})).available,false);
            actor(adviser,2);assert.equal(await getAIEntitlement(2),null);
            assert.equal((await recordAIConsent(await accept())).success,false);
            // Explicitly synthetic, rollback-only institutional evidence; no real verifier approval.
            const [account] = await tx`SELECT updated_at FROM users WHERE id=${verifier}`;
            await tx`INSERT INTO ai_eligibility_events(user_id,decision,event_kind,decision_role_id,account_updated_at,external_authority_ref) VALUES (${verifier},'Eligible','bootstrap',1,${account.updated_at},'SYNTHETIC_ROLLBACK_ONLY')`;
            process.env.AI_INSTITUTIONAL_VERIFIERS_JSON = '[]';actor(verifier,1);
            assert.equal((await recordAIEligibility(await decision(adviser))).success,false);
            process.env.AI_INSTITUTIONAL_VERIFIERS_JSON = JSON.stringify([{userId:verifier,authorizationRef:'SYNTHETIC_ONLY'},{userId:unverified,authorizationRef:'UNVERIFIED_TEST'}]);
            actor(verifier,1);assert.equal((await getEligibilityUI({userId:adviser})).canDecide,true);assert.equal((await getEligibilityUI({userId:verifier})).canDecide,false);
            actor(unverified,1);assert.equal((await recordAIEligibility(await decision(adviser))).success,false);
            actor(verifier,1);assert.equal((await recordAIEligibility(await decision(verifier))).success,false);
            for(const id of [student,panel]) assert.equal((await recordAIEligibility(await decision(id))).success,false);
            actor(adviser,2);assert.equal((await recordAIEligibility(await decision(unverified))).success,false);
            await certify('Not Eligible');actor(adviser,2);assert.equal(await getAIEntitlement(2),null);
            await certify('Pending Verification');assert.equal((await findLatestAIEligibility(adviser)).decision,'Pending Verification');
            await certify();actor(adviser,2);assert.equal(await getAIEntitlement(2),null);
            assert.equal((await recordAIConsent({action:'decline',termsVersion:AI_TERMS_VERSION,expectedRevision:await consentRevision(adviser)})).success,true);
            assert.equal(await getAIEntitlement(2),null);
            assert.equal((await recordAIConsent({...await accept(),acceptance:false})).success,false);
            assert.equal((await recordAIConsent({...await accept(),termsVersion:'obsolete'})).success,false);
            assert.equal((await recordAIConsent(await accept())).success,true);
            assert.ok(await getAIEntitlement(2));assert.equal(await getAIEntitlement(1),null);
            const ui = await getConsentUI();assert.equal(ui.accepted,true);assert.equal(ui.eligible,true);assert.ok(!JSON.stringify(ui).includes('SYNTHETIC_ONLY'));
            assert.equal(await getAIProviderAccount(2),null);
            assert.equal((await recordAIConsent({...await accept(),expectedRevision:0})).success,false,'Replay denied');
            assert.equal((await recordAIConsent({action:'withdraw',expectedRevision:await consentRevision(adviser)})).success,true);
            assert.equal(await getAIEntitlement(2),null);
            assert.equal((await recordAIConsent(await accept())).success,true);
            await certify('Not Eligible',true);
            assert.equal((await findLatestAIEligibility(adviser)).revoked,true);
            assert.equal((await findLatestAIConsent(adviser)).eventKind,'withdrawn');

            actor(adviser,2);assert.equal(await getAIEntitlement(2),null);
            await certify();actor(adviser,2);assert.equal(await getAIEntitlement(2),null);
            assert.equal((await recordAIConsent(await accept())).success,true);
            const eligibilityId = await revision(adviser);
            await tx`INSERT INTO ai_consent_events(user_id,eligibility_event_id,terms_version,terms_digest,event_kind) VALUES (${adviser},${eligibilityId},'obsolete',${AI_TERMS_DIGEST},'accepted')`;
            assert.equal(await getAIEntitlement(2),null,'Persisted outdated terms deny');
            assert.equal((await recordAIConsent(await accept())).success,true);
            await tx`INSERT INTO ai_consent_events(user_id,eligibility_event_id,terms_version,terms_digest,event_kind) VALUES (${adviser},${eligibilityId},${AI_TERMS_VERSION},${'0'.repeat(64)},'accepted')`;
            assert.equal(await getAIEntitlement(2),null,'Digest mismatch denies');
            assert.equal((await recordAIConsent(await accept())).success,true);
            await tx`UPDATE users SET is_active=false WHERE id=${adviser}`;
            assert.equal(await getAIEntitlement(2),null);
            await tx`UPDATE users SET is_active=true,updated_at=updated_at+interval '1 second' WHERE id=${adviser}`;
            assert.equal(await getAIEntitlement(2),null,'Account revision invalidates eligibility');
            await certify();actor(adviser,2);assert.equal((await recordAIConsent(await accept())).success,true);
            await tx`UPDATE users SET role_id=3 WHERE id=${adviser}`;
            assert.equal(await getAIEntitlement(2),null,'Current DB role rejects stale session');
            actor(adviser,3);assert.equal((await recordAIConsent({action:'withdraw',expectedRevision:await consentRevision(adviser)})).success,true);
            session=null;assert.equal(await getAIEntitlement(1),null);
            console.log('PASS account creation/UI authorization and actual PostgreSQL services: decisions/reset/revocation, independent verifier/self/role denial, consent acceptance/withdrawal/version/digest/replay, account revision and fail-closed entitlement');
            // Expected constraint failures stay inside savepoints, preserving the outer rollback.
            async function rejectsSQL(work,code) {await assert.rejects(tx.savepoint(work),error=>error.code===code);}
            await rejectsSQL(t=>t`INSERT INTO ai_eligibility_events(user_id,decision,event_kind) VALUES (${adviser},'Eligible','certification')`,'23514');
            await rejectsSQL(t=>t`INSERT INTO ai_eligibility_events(user_id,decision,event_kind,decision_role_id,account_updated_at,verifier_user_id,verifier_authorization_ref) VALUES (${adviser},'Eligible','certification',2,now(),${adviser},'SYNTHETIC')`,'23514');
            await rejectsSQL(t=>t`INSERT INTO ai_consent_events(user_id,terms_version,terms_digest,event_kind) VALUES (${adviser},${AI_TERMS_VERSION},${AI_TERMS_DIGEST},'accepted')`,'23514');
            await rejectsSQL(t=>t`INSERT INTO ai_consent_events(user_id,terms_version,terms_digest,event_kind) VALUES (${adviser},${AI_TERMS_VERSION},'bad','declined')`,'23514');
            await rejectsSQL(t=>t`INSERT INTO ai_consent_events(user_id,terms_version,terms_digest,event_kind) VALUES (-1,${AI_TERMS_VERSION},${AI_TERMS_DIGEST},'declined')`,'23503');
            assert.equal(outbound,0);
            finished=true;
            throw rollback;
        });
    } catch(error) {if(error!==rollback)throw error;}
    assert.equal(finished,true);
    assert.deepEqual(await eventCounts(client),before);
    assert.equal((await client`SELECT count(*)::int AS n FROM users WHERE last_name=${marker}`)[0].n,0);
    await verifyLedger(client);
    console.log('PASS real CHECK/FK failures, normalized migration ledger, rollback cleanup: zero eligibility/consent/fixture records; zero HTTP/provider calls');
}
main().catch(error=>{console.error('FAIL PostgreSQL acceptance: '+(error.code??error.name)); console.error(error.stack.split('\n').filter(line=>line.trim().startsWith('at ')).slice(0,5).join('\n'));process.exitCode=1;}).finally(async()=>{
    Module._load=originalLoad;global.fetch=originalFetch;
    for(const [mod,method,original] of networkOriginals)mod[method]=original;
    if(originalConfig===undefined)delete process.env.AI_INSTITUTIONAL_VERIFIERS_JSON;else process.env.AI_INSTITUTIONAL_VERIFIERS_JSON=originalConfig;
    await client.end({timeout:2});
});
