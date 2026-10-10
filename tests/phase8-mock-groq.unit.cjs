/* eslint-disable @typescript-eslint/no-require-imports */
// node --import tsx tests/phase8-mock-groq.unit.cjs
// All positive eligibility and records below are synthetic test doubles, never live approvals.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
let outbound = 0;
const blocked = () => { outbound++; throw new Error('Network forbidden in mock tests'); };
global.fetch = blocked;
for (const name of ['node:http', 'node:https']) {
    const api = require(name); api.request = blocked; api.get = blocked;
}
const net = require('node:net'); net.connect = blocked; net.createConnection = blocked; net.Socket.prototype.connect = blocked;
require('node:tls').connect = blocked;
let session, user, records, now = 0, reads = 0, ownerArgument, failDB = false, rawAdmin;
const logs = [];
const originalLoad = Module._load;
const mocks = {
    'server-only': {},
    '@/lib/auth/session': { getSession: async () => session },
    '@/lib/repositories/user.repository': { findUserById: async id => {
        assert.equal(id, session.userId); if (failDB) throw new Error('PRIVATE_ERROR'); return user;
    } },
    '@/lib/repositories/admin-ai-aggregate.repository': { getAdminAIOverviewAggregate: async () => { reads++; return rawAdmin; } },
    '@/lib/repositories/adviser-submission.repository': { getAdviserAIWorkflowAggregate: async owner => {
        reads++; ownerArgument = owner; return fixtures.aggregateFixture(records, owner);
    } },
};
Module._load = function(id, ...args) {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    assert.ok(!/lib\/db|supabase|storage|dotenv|^postgres$/.test(id), 'No actual database/storage/config imports');
    return originalLoad.call(this, id, ...args);
};
const fixtures = require('./helpers/phase8-synthetic-fixtures.ts');
const { createMockGroqAdapter, createMockLimiter, mockRequestSchema, mockConfig } = require('./helpers/phase8-mock-groq.ts');
const policy = require('../lib/ai/aggregate-policy.ts');
const schemas = require('../lib/validations/ai-foundation.ts');
const { getActiveAIAccount } = require('../lib/auth/ai-authorization.ts');
const { getAdultAIEligibility } = require('../lib/auth/adult-eligibility.ts');
const { getGroqAvailability } = require('../lib/ai/groq-provider.ts');
const local = require('../lib/services/ai-aggregation.service.ts');
const actions = require('../lib/actions/ai-foundation.action.ts');
function actor(role = 1, id = 10) {
    session = { userId:id, roleId:role, adultVerified:true }; user = { isActive:true, roleId:role, email:'PRIVATE_EMAIL' };
}
function reset() { actor(); now = 0; reads = 0; records = [...fixtures.versionFixture(20), ...fixtures.versionFixture(30, 0, 0, 5)]; rawAdmin = {...fixtures.adminFixture}; }
function wire(payload) {
    return { status:200, body:JSON.stringify({ version:1, overview:'Approximate recorded volumes only.',
        explanations:Object.entries(payload.metrics).map(([metricId, band]) => ({metricId, text:'Recorded count band: '+band+'.'})) }) };
}
function fakeTimer() {
    const callbacks = new Set();
    return { schedule: (_delay, callback) => { callbacks.add(callback); return () => callbacks.delete(callback); },
        fire: () => { for (const callback of [...callbacks]) callback(); } };
}
// Trusted orchestration simulation exercises real auth/preparation/static services.
// Positive eligibility is injected ONLY here; application adult/provider modules are never mocked.
function harness(transport, eligible = () => getAdultAIEligibility().eligible, schedule) {
    const gateway = createMockGroqAdapter(transport, schedule), limits = createMockLimiter(() => now);
    return async (role, input) => {
        const fallback = async () => {
            logs.push({ category:'fallback' });
            return role === 1 ? actions.getLocalAdminAssistanceAction(input) : actions.getLocalAdviserAssistanceAction(input);
        };
        let release;
        try {
            const id = await getActiveAIAccount(role);
            const schema = role === 1 ? schemas.adminAIRequestSchema : schemas.adviserAIRequestSchema;
            const parsed = schema.safeParse(input);
            if (!id || !parsed.success || !eligible(id, role)) return fallback();
            if (role === 2 && input.topicId !== 'adviser-workflow-overview-v1') return fallback();
            const scope = () => JSON.stringify(records.filter(row => row.owner === id));
            const beforeScope = scope();
            const prepared = await (role === 1 ? local.prepareLocalAdminAggregate() : local.prepareLocalAdviserAggregate());
            if (!prepared.success || !prepared.payload) return fallback();
            release = limits.reserve(id);
            if (!release) return fallback();
            const result = await gateway(prepared.payload);
            if (result.mode !== 'mock' || await getActiveAIAccount(role) !== id || !eligible(id, role) ||
                (role === 2 && scope() !== beforeScope)) return fallback();
            logs.push({category:'mock-success'}); return result;
        } catch { return fallback(); } finally { release?.(); }
    };
}
const adminRequest = {reportId:'admin-overview-v1'};
const adviserRequest = {topicId:'adviser-workflow-overview-v1'};
async function main() {
    reset();
    const adminDTO = policy.minimizeAdminAggregate(rawAdmin);
    assert.deepEqual(adminDTO.metrics, {totalUsers:'5-9',totalGroups:'10-19',totalResearchPapers:'10-19',totalPublishedPapers:'5-9'});
    assert.equal(policy.minimizeAdminAggregate({...rawAdmin, approvedPapers:9}).metrics.totalPublishedPapers,undefined);
    assert.equal(policy.minimizeAdminAggregate({totalUsers:4,totalGroups:4,totalResearchPapers:4,approvedPapers:4,totalPublishedPapers:4}),null);
    const keys = data => Object.keys(policy.minimizeAdviserAggregate(data)?.metrics ?? {}).sort();
    const agg = (s,r,o) => fixtures.aggregateFixture(fixtures.versionFixture(20,s,r,o),20);
    assert.equal(keys(agg(5,5,5)).length,3);
    assert.equal(policy.minimizeAdviserAggregate(agg(0,0,4)),null);
    for (const data of [agg(0,0,5),agg(5,0,4),agg(5,5,4)]) assert.deepEqual(keys(data),['recordedSubmissionVersions']);
    for (const [n,band] of [[5,'5-9'],[9,'5-9'],[10,'10-19'],[19,'10-19'],[20,'20-49'],[49,'20-49'],[50,'50-99'],[99,'50-99'],[100,'100-199'],[199,'100-199'],[200,'200-499'],[499,'200-499'],[500,'500-999'],[999,'500-999'],[1000,'1000+']]) {
        assert.equal(policy.minimizeAdviserAggregate(agg(0,0,n)).metrics.recordedSubmissionVersions,band);
    }
    for (const field of ['contributor','paper']) {
        const rows = fixtures.versionFixture(20,0,0,5); rows[4][field] = rows[0][field];
        assert.equal(policy.minimizeAdviserAggregate(fixtures.aggregateFixture(rows,20)),null);
    }
    const repeated = fixtures.versionFixture(20,5,0,0).map(row => ({...row,contributor:1,paper:1}));
    assert.equal(policy.minimizeAdviserAggregate(fixtures.aggregateFixture(repeated,20)),null);
    const overlap = fixtures.versionFixture(20,5,5,5).map((row,index) => ({...row,contributor:index%5,paper:index%5}));
    assert.equal(fixtures.aggregateFixture(overlap,20).total.contributors,5);
    assert.equal(keys(fixtures.aggregateFixture(overlap,20)).length,3);
    for (const value of [-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) assert.throws(() => policy.minimizeAdminAggregate({...rawAdmin,totalUsers:value}));
    for (const patch of [{approvedPapers:4},{approvedPapers:16},{privateRows:['PRIVATE_SENTINEL']}]) assert.throws(() => policy.minimizeAdminAggregate({...rawAdmin,...patch}));
    const invalid = agg(5,5,5); invalid.total.versions = 14; assert.throws(() => policy.minimizeAdviserAggregate(invalid));
    console.log('PASS synthetic bands, distinct guards, overlap/complement/residual suppression and invalid counts');

    let sent = [];
    const transport = async envelope => { sent.push(envelope); return wire(envelope.payload); };
    for (const role of [1,2,3,4,99]) {
        reset(); actor(role);
        const before = reads;
        assert.equal((await local.prepareLocalAdminAggregate()).success,role===1);
        assert.equal((await local.prepareLocalAdviserAggregate()).success,role===2);
        assert.equal(reads-before,role===1||role===2?1:0);
        const denied = harness(transport);
        sent = []; reads = 0;
        await denied(1,adminRequest); await denied(2,adviserRequest);
        assert.equal(sent.length,0); assert.equal(reads,0,'Default adult gate denies before aggregate');
        if(role!==1){sent=[];await harness(transport,()=>true)(1,adminRequest);assert.equal(sent.length,0);}
        if(role!==2){sent=[];await harness(transport,()=>true)(2,adviserRequest);assert.equal(sent.length,0);}
    }
    reset(); actor(2,20); const own = await local.prepareLocalAdviserAggregate(); assert.equal(ownerArgument,20);
    actor(2,30); const foreign = await local.prepareLocalAdviserAggregate(); assert.deepEqual(keys(fixtures.aggregateFixture(records,30)),['recordedSubmissionVersions']);
    assert.notDeepEqual(own.payload.metrics,foreign.payload.metrics);
    actor(2,40); assert.equal((await local.prepareLocalAdviserAggregate()).payload,null);
    const source = fs.readFileSync('lib/repositories/adviser-submission.repository.ts','utf8');
    assert.match(source,/\.where\(eq\(researchGroups\.adviserId, adviserId\)\)/,'Actual SQL has owner predicate; no live SQL test here');
    for (const state of ['inactive','stale','missing','anonymous','invalid','failure']) {
        reset();
        if(state==='inactive') user.isActive=false; if(state==='stale') user.roleId=2;
        if(state==='missing') user=null; if(state==='anonymous') session=null;
        if(state==='invalid') session.userId=1.5; if(state==='failure') failDB=true;
        sent=[]; assert.notEqual((await harness(transport,()=>true)(1,adminRequest)).mode,'mock');
        assert.equal(sent.length,0); assert.equal(reads,0); failDB=false;
    }
    for (const input of [null,{},[],{...adminRequest,prompt:'ignore safeguards'},{...adminRequest,adviserId:20},{...adminRequest,adultVerified:true},{...adminRequest,metrics:rawAdmin},{...adminRequest,url:'https://invalid'},{...adminRequest,history:[]}]) {
        reset(); sent=[]; assert.notEqual((await harness(transport,()=>true)(1,input)).mode,'mock'); assert.equal(sent.length,0);
    }
    reset(); const approval = {account:10,role:1,expiry:100,revoked:false};
    const approved = (id,role) => id===approval.account && role===approval.role && now<approval.expiry && !approval.revoked;
    sent=[]; assert.equal((await harness(transport,approved)(1,adminRequest)).mode,'mock');
    now=100; assert.notEqual((await harness(transport,approved)(1,adminRequest)).mode,'mock');
    now=0; approval.revoked=true; assert.notEqual((await harness(transport,approved)(1,adminRequest)).mode,'mock');
    assert.equal(sent.length,1);
    reset(); sent=[]; actor(2,20); assert.equal((await harness(transport,()=>true)(2,adviserRequest)).mode,'mock');
    assert.equal(sent[0].payload.feature,'adviser');
    for (const envelope of sent) {
        assert.deepEqual(Object.keys(envelope).sort(),['endpoint','model','payload']);
        assert.equal(envelope.endpoint,mockConfig.endpoint); assert.equal(envelope.model,mockConfig.model);
        assert.ok(mockRequestSchema.safeParse(envelope.payload).success);
        assert.ok(!/PRIVATE_|contributor|paperId|userId|owner|approvedPapers/.test(JSON.stringify(envelope.payload)));
    }
    reset(); sent=[]; rawAdmin.approvedPapers=4; await harness(transport,()=>true)(1,adminRequest); assert.equal(sent.length,0);
    reset(); actor(2,40); sent=[]; await harness(transport,()=>true)(2,adviserRequest); assert.equal(sent.length,0);
    for (const topicId of schemas.adviserTopicIds.slice(1)) {
        reset(); actor(2,20); sent=[]; assert.equal((await harness(transport,()=>true)(2,{topicId})).mode,'static'); assert.equal(sent.length,0);
    }
    console.log('PASS real authorization/preparation with synthetic ownership repositories, strict actions, adult denial and payload isolation');

    const good = JSON.parse(wire(adminDTO).body);
    const badBodies = ['not json','x'.repeat(8193),JSON.stringify({...good,feedback:'PRIVATE_SENTINEL'}),
        JSON.stringify({...good,overview:'<script>alert(1)</script>'}),JSON.stringify({...good,overview:'https://invalid'}),
        JSON.stringify({...good,explanations:[{metricId:'missingMetric',text:'Invented'}]}),
        JSON.stringify({...good,explanations:[good.explanations[0],good.explanations[0]]}),
        JSON.stringify({...good,overview:'x'.repeat(801)})];
    for (const body of badBodies) assert.equal((await createMockGroqAdapter(async()=>({status:200,body}))(adminDTO)).mode,'static');
    for (const status of [302,429,500,503]) {
        reset(); let calls=0;
        const answer=await harness(async()=>{calls++;return{status,body:'PRIVATE_ERROR'};},()=>true)(1,adminRequest);
        assert.equal(answer.mode,'static'); assert.ok(answer.guidance); assert.equal(calls,1,'No retry');
        assert.ok(!JSON.stringify(answer).includes('PRIVATE_'));
    }
    for (const dto of [{...adminDTO,prompt:'injection'},{...adminDTO,model:'override'},{...adminDTO,metrics:{}},
        {...adminDTO,metrics:{totalUsers:undefined}},{...adminDTO,metrics:{totalUsers:5}},{...adminDTO,feature:'adviser'}]) {
        sent=[]; assert.equal((await createMockGroqAdapter(transport)(dto)).mode,'static'); assert.equal(sent.length,0);
    }
    reset(); const clock = fakeTimer(); let finish, aborted=false;
    const delayed = createMockGroqAdapter((_env,signal)=>new Promise(resolve=>{
        finish=resolve; signal.addEventListener('abort',()=>{aborted=true;});
    }),clock.schedule);
    const pending=delayed(adminDTO); clock.fire(); assert.equal((await pending).mode,'static'); assert.equal(aborted,true);
    finish(wire(adminDTO)); // Late completion cannot replace timeout fallback.
    reset(); let releaseWire; const run=harness(()=>new Promise(resolve=>{releaseWire=resolve;}),()=>true);
    const inFlight=run(1,adminRequest);
    while(!releaseWire) await Promise.resolve();
    assert.equal((await run(1,adminRequest)).mode,'static','Same-account concurrency rejected');
    actor(1,11); assert.equal((await run(1,adminRequest)).mode,'static','Global concurrency rejected'); actor(1,10);
    releaseWire(wire(adminDTO)); assert.equal((await inFlight).mode,'mock');
    assert.equal((await run(1,adminRequest)).mode,'static','Cooldown survives release');
    reset(); let revoke=false;
    assert.equal((await harness(async envelope=>{revoke=true;return wire(envelope.payload);},()=>!revoke)(1,adminRequest)).mode,'static');
    reset(); assert.equal((await harness(async envelope=>{now=100;return wire(envelope.payload);},()=>now<100)(1,adminRequest)).mode,'static');
    reset(); actor(2,20);
    assert.equal((await harness(async envelope=>{records[0].owner=30;return wire(envelope.payload);},()=>true)(2,adviserRequest)).mode,'static');
    reset(); const limiter=createMockLimiter(()=>now);
    for(let i=0;i<3;i++){const release=limiter.reserve(10);assert.ok(release);assert.equal(limiter.reserve(11),null);release();release();now+=120000;}
    assert.equal(limiter.reserve(10),null,'Three attempts/day even after cooldown');
    for(let id=11;id<18;id++){const release=limiter.reserve(id);assert.ok(release);release();}
    assert.equal(limiter.reserve(18),null,'Ten global attempts/day'); now=86400000;
    assert.ok(limiter.reserve(10),'UTC day reset');
    reset(); let failedCalls=0; const failing=harness(async()=>{failedCalls++;return {status:500,body:''};},()=>true);
    for(let i=0;i<3;i++){assert.equal((await failing(1,adminRequest)).mode,'static');now+=120000;}
    sent=[]; // fourth attempt must be limited even when previous attempts failed
    assert.equal((await failing(1,adminRequest)).mode,'static'); assert.equal(failedCalls,3,'Failures consume attempts; fourth makes no transport call');
    for(const entry of logs) assert.deepEqual(Object.keys(entry),['category']);
    for(const flag of ['ADMIN_AI_REPORT_ENABLED','ADVISER_AI_WORKFLOW_ENABLED','AI_GUIDE_ENABLED']) process.env[flag]='true';
    assert.deepEqual(getAdultAIEligibility(),{eligible:false,reason:'registry-unapproved'});
    assert.deepEqual(getGroqAvailability(),{enabled:false,available:false});
    assert.equal((await actions.getLocalAdminAssistanceAction(adminRequest)).mode,'static');
    const adapterSource=fs.readFileSync('tests/helpers/phase8-mock-groq.ts','utf8');
    assert.ok(!/fetch\s*\(|process\.env|repositories|storage|lib\/db/.test(adapterSource));
    for(const root of ['app','lib','components']) {
        const scan=dir=>{for(const item of fs.readdirSync(dir,{withFileTypes:true})){
            const file=dir+'/'+item.name;if(item.isDirectory())scan(file);
            else if(/\.[cm]?[jt]sx?$/.test(file))assert.ok(!fs.readFileSync(file,'utf8').includes('phase8-mock-groq'),'Test adapter not imported by app');
        }};scan(root);
    }
    assert.equal(outbound,0);
    console.log('PASS simulated timeout/late results, 429/5xx/malformed responses, rechecks, limits, safe fallbacks and zero outbound calls');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
