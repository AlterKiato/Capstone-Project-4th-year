/* eslint-disable @typescript-eslint/no-require-imports */
// Actual TS services/repositories with deterministic transaction doubles, not PostgreSQL evidence.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const { getTableName, SQL } = require('drizzle-orm');
const { PgDialect } = require('drizzle-orm/pg-core');
const dialect = new PgDialect();
function load(file, mocks = {}) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, console, Date, require(id) {
        if (Object.hasOwn(mocks,id)) return mocks[id];
        if (id === 'server-only') return {};
        if (/lib\/(db|supabase)|^postgres$|dotenv|storage.service|notification.service/.test(id)) throw Error('Live adapter forbidden: '+id);
        return require(id.startsWith('@/') ? path.resolve(id.slice(2)) : id);
    } }, { filename:file });
    return exports;
}
let state, session, notifications, events, failLog, replaceAtLock, revokeOnSign, onEnqueue;
const account = (id,roleId=2) => ({ id,roleId,isActive:true,firstName:'Synthetic',lastName:String(id),email:id+'@example.invalid' });
function reset() {
    state = { users:[account(10,1),account(20),account(30),account(31),account(40,3)],main_adviser_designation:[{id:1,mainAdviserId:20,revision:1}],
        submissions:[{id:1,paperId:1,submittedBy:40,version:'v1',status:'Under Review',fileUrl:'research/1/v1/test.pdf'},
            {id:2,paperId:1,submittedBy:40,version:'v2',status:'Under Review',fileUrl:'research/1/v2/test.pdf'}],
        research_papers:[{id:1,groupId:1,title:'Synthetic Manuscript',status:'In Review'}], co_adviser_review_assignments:[],feedbacks:[],activity_logs:[] };
    session={userId:20,roleId:2,email:'20@example.invalid'}; notifications=[];events=[];failLog=false;replaceAtLock=null;revokeOnSign=null;onEnqueue=null;
}
const current = () => state.main_adviser_designation[0]?.mainAdviserId ?? null;
const principal = async () => { const row=state.users.find(u=>u.id===session?.userId);return row?.isActive && row.roleId===session.roleId ? {...session} : null; };
const main = async expected => { const actor=await principal();return actor?.roleId===2 && actor.userId===current() && (expected===undefined || expected===actor.userId) ? actor : null; };
const camel = s => s.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
function executor(draft) {
    const rows = table => draft[getTableName(table)];
    function related(base,table,row) {
        const name=getTableName(table);
        if(name===base)return row;
        if(name==='users')return draft.users.find(u=>u.id===row.coAdviserId);
        if(name==='submissions')return draft.submissions.find(s=>s.id===row.submissionId);
        if(name==='research_papers')return draft.research_papers.find(p=>p.id===(row.paperId || draft.submissions.find(s=>s.id===row.submissionId)?.paperId));
        return undefined;
    }
    function matches(row,predicate,base) {
        if(!predicate)return true;
        const query=dialect.sqlToQuery(predicate);let sql=query.sql;
        if(sql.includes('exists')) {
            const u=draft.users.find(u=>u.id===session?.userId),m=draft.users.find(u=>u.id===draft.main_adviser_designation[0]?.mainAdviserId);
            if(!u?.isActive||u.roleId!==2||!m?.isActive||m.roleId!==2||u.id===m.id)return false;
            sql=sql.split('exists')[0];
        }
        const value=(table,column)=>related(base,{[Symbol.for('drizzle:Name')]:table},row)?.[camel(column)];
        const equal=[...sql.matchAll(/"(\w+)"\."(\w+)" (=|<>) \$(\d+)/g)];
        for(const [,table,column,op,n] of equal) { const actual=value(table,column),expected=query.params[Number(n)-1];if(op==='=' ? actual!==expected : actual===expected)return false; }
        for(const [,table,column,list] of sql.matchAll(/"(\w+)"\."(\w+)" in \(([^)]+)\)/g))
            if(![...list.matchAll(/\$(\d+)/g)].some(([,n])=>value(table,column)===query.params[Number(n)-1]))return false;
        return true;
    }
    function project(base,row,fields) { return fields ? Object.fromEntries(Object.entries(fields).map(([key,column])=>[key,related(base,column.table,row)?.[camel(column.name)]])) : structuredClone(row); }
    return {
        select(fields) {
            let table,predicate;const result=()=>rows(table).filter(row=>matches(row,predicate,getTableName(table))).map(row=>project(getTableName(table),row,fields));
            const chain={from(t){table=t;return chain;},where(p){predicate=p;return chain;},innerJoin(){return chain;},orderBy(){return chain;},
                async for(mode){const name=getTableName(table);events.push(name+':'+mode);if(name==='main_adviser_designation'&&replaceAtLock){draft.main_adviser_designation[0].mainAdviserId=replaceAtLock;replaceAtLock=null;}return result();},
                then:(yes,no)=>Promise.resolve().then(result).then(yes,no)};return chain;
        },
        insert(table) { return { values(data) {
            const run=()=>{const name=getTableName(table);events.push('insert:'+name);if(name==='activity_logs' && (failLog===true || (Array.isArray(data)?data:[data]).some(row=>row.action===failLog)))throw Error('Synthetic audit failure');
                return (Array.isArray(data)?data:[data]).map(item=>{const row={id:rows(table).length+1,state:'open',recommendation:null,createdAt:new Date(),completedAt:null,closedAt:null,closedBy:null,closureReason:null,...item};rows(table).push(row);return structuredClone(row);});};
            return {returning:async()=>run(),then:(yes,no)=>Promise.resolve().then(run).then(yes,no)};
        } }; },
        update(table) { return { set(data) { return { where(predicate) { return { returning:async fields=> {
            events.push('update:'+getTableName(table));return rows(table).filter(row=>matches(row,predicate,getTableName(table))).map(row=>{for(const [key,v] of Object.entries(data))row[key]=v instanceof SQL?(key==='revision'?row[key]+1:new Date(Math.max(Date.now(),row.createdAt?.getTime()||0))):v;return project(getTableName(table),row,fields);});
        } }; } }; } }; },
    };
}
let queue=Promise.resolve();
const db={transaction(operation){onEnqueue?.();const run=queue.then(async()=>{const draft=structuredClone(state),result=await operation(executor(draft));state=draft;return result;});queue=run.catch(()=>{});return run;},select(fields){return executor(state).select(fields);}};
const supervision=load('lib/repositories/research-supervision.repository.ts',{'@/lib/db':{db}});
const repo=load('lib/repositories/co-adviser.repository.ts',{'@/lib/db':{db},'./research-supervision.repository':supervision});
const feedback=load('lib/repositories/feedback.repository.ts',{'@/lib/db':{db},'./research-supervision.repository':supervision,'./co-adviser.repository':repo});
const authority={'getCurrentMainAdviser':main,getMainAdviserNotificationRecipient:async()=>current()};
const service=load('lib/services/co-adviser.service.ts',{'@/lib/auth/current-account':{getCurrentAccount:principal},'@/lib/auth/main-adviser':authority,
    '@/lib/repositories/co-adviser.repository':repo,'@/lib/services/notification.service':{sendNotification:async(...args)=>{notifications.push(args);return {success:true};}}});
const delegate=(ids=[30],submissionId=1)=>service.delegateCoAdvisers({submissionId,coAdviserIds:ids});
const recommend=(id=1,submissionId=1,text='Private synthetic recommendation')=>service.submitCoAdviserRecommendation({assignmentId:id,submissionId,recommendation:text});
const decide=(submissionId=1)=>feedback.persistAdviserDecision({submissionId,paperId:1,teacherId:20,comments:'Official only',decision:'Approved',expectedSubmissionStatus:'Under Review',researchStatus:'Approved',activityAction:'Approved',activityDescription:'Official decision'});

test('Main assigns multiple eligible Co-Advisers; open duplicates rejected and terminal reassignment preserves history',async()=>{
    reset();assert.equal((await delegate([30,31])).success,true);assert.equal(state.co_adviser_review_assignments.length,2);
    assert.equal((await delegate()).success,false);assert.equal(state.co_adviser_review_assignments.length,2);
    session={userId:30,roleId:2};assert.equal((await recommend()).success,true);
    session={userId:20,roleId:2};assert.equal((await delegate()).success,true);assert.equal(state.co_adviser_review_assignments.length,3);
    assert.equal(state.co_adviser_review_assignments[0].recommendation,'Private synthetic recommendation');
});
test('identity injection, invalid input, Main-as-Co, inactive/Student candidates, non-Main and finalized submissions fail closed',async()=>{
    reset();for(const input of [{submissionId:1,coAdviserIds:[30],actorId:20},{submissionId:1,coAdviserIds:[30,30]},{submissionId:1,coAdviserIds:[]}])assert.equal((await service.delegateCoAdvisers(input)).success,false);
    for(const ids of [[20],[40],[999]])assert.equal((await delegate(ids)).success,false);
    state.users.find(u=>u.id===30).isActive=false;assert.equal((await delegate()).success,false);
    state.users.find(u=>u.id===30).isActive=true;session={userId:31,roleId:2};assert.equal((await delegate()).success,false);
    session={userId:20,roleId:2};state.submissions[0].status='Approved';assert.equal((await delegate()).success,false);assert.equal(state.co_adviser_review_assignments.length,0);
});
test('cancellation requires current Main and explicit confirmation; Completed/Closed are terminal',async()=>{
    reset();await delegate();assert.equal((await service.cancelCoAdviserAssignment({assignmentId:1,submissionId:1})).success,false);
    assert.equal((await service.cancelCoAdviserAssignment({assignmentId:1,submissionId:2,confirmed:true})).success,false);
    assert.equal((await service.cancelCoAdviserAssignment({assignmentId:1,submissionId:1,confirmed:true})).success,true);
    assert.equal((await service.cancelCoAdviserAssignment({assignmentId:1,submissionId:1,confirmed:true})).success,false);
    assert.equal(state.co_adviser_review_assignments[0].closureReason,'main-cancelled');session={userId:30,roleId:2};assert.equal((await recommend()).success,false);
});
test('one private bounded recommendation completes exactly its owned assignment without academic writes',async()=>{
    reset();await delegate();session={userId:30,roleId:2};const before=JSON.stringify({submissions:state.submissions,papers:state.research_papers,feedback:state.feedbacks});
    assert.equal((await recommend(1,2)).success,false);assert.equal((await recommend(1,1,'   ')).success,false);assert.equal((await recommend(1,1,'a'.repeat(20001))).success,false);assert.equal((await recommend(1,1,'bad\u0000text')).success,false);
    assert.equal((await recommend(1,1,'  Plain <b>literal</b>\nrecommendation  ')).success,true);
    const completed=structuredClone(state.co_adviser_review_assignments[0]);assert.equal(completed.state,'completed');assert.equal(completed.coAdviserId,30);assert.ok(completed.completedAt);assert.equal(completed.recommendation,'Plain <b>literal</b>\nrecommendation');
    assert.equal((await recommend()).success,false);assert.deepEqual(state.co_adviser_review_assignments[0],completed);
    assert.equal(JSON.stringify({submissions:state.submissions,papers:state.research_papers,feedback:state.feedbacks}),before);
    assert.ok(notifications.every(row=>!row.join(' ').includes('literal')));
});
test('foreign, Student, inactive, demoted and promoted-to-Main actors cannot recommend',async()=>{
    reset();await delegate();for(const actor of [{userId:31,roleId:2},{userId:40,roleId:3},null]){session=actor;assert.equal((await recommend()).success,false);}
    session={userId:30,roleId:2};state.users.find(u=>u.id===30).isActive=false;assert.equal((await recommend()).success,false);
    state.users.find(u=>u.id===30).isActive=true;state.users.find(u=>u.id===30).roleId=3;assert.equal((await recommend()).success,false);
    state.users.find(u=>u.id===30).roleId=2;state.main_adviser_designation[0].mainAdviserId=30;assert.equal((await recommend()).success,false);
});
test('having an open Co assignment does not authorize official decisions',async()=>{
    reset();await delegate();session={userId:30,roleId:2};
    assert.equal(await feedback.persistAdviserDecision({submissionId:1,paperId:1,teacherId:30,comments:'Not official',decision:'Approved',expectedSubmissionStatus:'Under Review',researchStatus:'Approved',activityAction:'Approved'}),null);
    assert.equal(state.feedbacks.length,0);assert.equal(state.submissions[0].status,'Under Review');assert.equal(state.co_adviser_review_assignments[0].state,'open');
});
test('Main-only recommendation read and minimized Co projection exclude other assignments and sensitive payload',async()=>{
    reset();await delegate([30,31]);session={userId:30,roleId:2};await recommend();
    const co=await service.getCoAdviserWorkspace();assert.equal(co.success,true);assert.equal(co.data.assignments.length,1);assert.equal(co.data.assignments[0].state,'completed');
    assert.deepEqual(Object.keys(co.data.assignments[0]).sort(),['id','submissionId','title','groupId','version','state','recommendation','reviewAvailable','createdAt','completedAt','closedAt'].sort());
    assert.equal((await service.getMainDelegationPanel(1)).success,false);
    session={userId:40,roleId:3};assert.equal((await service.getCoAdviserWorkspace()).success,false);assert.equal((await service.getMainDelegationPanel(1)).success,false);
    session={userId:20,roleId:2};const panel=await service.getMainDelegationPanel(1);assert.equal(panel.success,true);assert.equal(panel.data.assignments[0].recommendation,'Private synthetic recommendation');
});
test('official finalization closes only open exact-version assignments; preserves completed recommendation and other versions',async()=>{
    reset();await delegate([30,31]);await delegate([30],2);session={userId:30,roleId:2};await recommend();session={userId:20,roleId:2};
    const completed=structuredClone(state.co_adviser_review_assignments[0]);assert.ok(await decide());
    assert.deepEqual(state.co_adviser_review_assignments[0],completed);assert.equal(state.co_adviser_review_assignments[1].state,'closed');assert.equal(state.co_adviser_review_assignments[1].closedBy,20);assert.equal(state.co_adviser_review_assignments[1].closureReason,'official-decision');assert.equal(state.co_adviser_review_assignments[2].state,'open');
    assert.equal(state.feedbacks.length,1);assert.equal(state.submissions[0].status,'Approved');assert.equal(state.submissions[1].status,'Under Review');assert.equal(state.research_papers[0].status,'Approved');
    await assert.rejects(()=>decide(),/status changed/);
});
test('finalization need not wait for recommendations; audit failure rolls all assignment and academic writes back',async()=>{
    reset();await delegate([30,31]);const before=structuredClone(state);failLog='Approved';await assert.rejects(()=>decide(),/Synthetic audit failure/);assert.deepEqual(state,before);
    failLog=false;assert.ok(await decide());assert.ok(state.co_adviser_review_assignments.every(a=>a.state==='closed'));
});
test('recommendation and creation audit failures roll back their entire mutations',async()=>{
    reset();failLog=true;assert.equal((await delegate()).success,false);assert.equal(state.co_adviser_review_assignments.length,0);
    failLog=false;await delegate();session={userId:30,roleId:2};failLog=true;assert.equal((await recommend()).success,false);assert.equal(state.co_adviser_review_assignments[0].state,'open');assert.equal(state.co_adviser_review_assignments[0].recommendation,null);
});
test('simulated recommendation/finalization orderings produce no contradictory terminal state',async()=>{
    reset();await delegate();session={userId:30,roleId:2};
    const entered=new Promise(resolve=>{onEnqueue=resolve;});const recommending=recommend();await entered;onEnqueue=null;
    const first=await Promise.all([recommending,decide()]);assert.equal(first[0].success,true);assert.equal(state.co_adviser_review_assignments[0].state,'completed');assert.equal(state.feedbacks.length,1);
    reset();await delegate();session={userId:30,roleId:2};
    const second=await Promise.all([decide(),recommend()]);assert.ok(second[0]);assert.equal(second[1].success,false);assert.equal(state.co_adviser_review_assignments[0].state,'closed');assert.equal(state.co_adviser_review_assignments[0].recommendation,null);
});
test('replacement at transaction boundary rejects stale Main; lock ordering remains accounts, singleton, submission, assignment',async()=>{
    reset();replaceAtLock=31;assert.equal((await delegate()).success,false);assert.equal(state.co_adviser_review_assignments.length,0);
    reset();await delegate();session={userId:30,roleId:2};events=[];await recommend();
    const order=['users:update','main_adviser_designation:share','submissions:update','co_adviser_review_assignments:update'];
    assert.deepEqual(events.slice(0,4),order);assert.equal(events.filter(e=>e==='users:update').length,1,'Co never acquires Main account after resource locks');
});
test('post-commit completion notification resolves the current Main; notification failure preserves success',async()=>{
    reset();await delegate();state.main_adviser_designation[0].mainAdviserId=31;session={userId:30,roleId:2};assert.equal((await recommend()).success,true);assert.equal(notifications.at(-1)[0],31);
    const isolated=load('lib/services/co-adviser.service.ts',{'@/lib/auth/current-account':{getCurrentAccount:principal},'@/lib/auth/main-adviser':authority,'@/lib/repositories/co-adviser.repository':repo,'@/lib/services/notification.service':{sendNotification:async()=>{throw Error('Synthetic delivery failure');}}});
    reset();assert.equal((await isolated.delegateCoAdvisers({submissionId:1,coAdviserIds:[30]})).success,true);
});
test('delegated PDF is exact assignment/version, 300 seconds, with terminal/path/account/post-sign revocation denial',async()=>{
    reset();await delegate();session={userId:30,roleId:2};const signed=[];
    const pdf=load('lib/services/submission-document.service.ts',{'@/lib/auth/current-account':{getCurrentAccount:principal},'@/lib/auth/main-adviser':authority,
        '@/lib/repositories/co-adviser.repository':repo,'@/lib/repositories/user.repository':{},'@/lib/repositories/submission.repository':{},'@/lib/repositories/research-paper.repository':{},'@/lib/repositories/research-group.repository':{},'@/lib/repositories/group-member.repository':{},
        '@/lib/services/storage.service':{createResearchDocumentSignedUrl:async(...args)=>{signed.push(args);revokeOnSign?.();return 'synthetic-url';}}});
    assert.equal(await pdf.createDelegatedSubmissionDocumentUrl(1,1,30),'synthetic-url');assert.deepEqual(signed.pop(),['research/1/v1/test.pdf',300]);
    for(const [aid,sid,actor]of [[1,2,30],[999,1,30],[1,1,31]])assert.equal(await pdf.createDelegatedSubmissionDocumentUrl(aid,sid,actor),null);
    state.submissions[0].fileUrl='research/1/v2/other.pdf';assert.equal(await pdf.createDelegatedSubmissionDocumentUrl(1,1,30),null);state.submissions[0].fileUrl='research/1/v1/test.pdf';
    state.submissions[0].status='Approved';assert.equal(await pdf.createDelegatedSubmissionDocumentUrl(1,1,30),null);state.submissions[0].status='Under Review';
    for(const terminal of ['completed','closed']){state.co_adviser_review_assignments[0].state=terminal;assert.equal(await pdf.createDelegatedSubmissionDocumentUrl(1,1,30),null);}state.co_adviser_review_assignments[0].state='open';
    revokeOnSign=()=>{state.co_adviser_review_assignments[0].state='closed';};assert.equal(await pdf.createDelegatedSubmissionDocumentUrl(1,1,30),null);
    state.co_adviser_review_assignments[0].state='open';revokeOnSign=()=>{state.users.find(u=>u.id===30).isActive=false;};assert.equal(await pdf.createDelegatedSubmissionDocumentUrl(1,1,30),null);
});
test('Co SQL projections enforce owner, live account/designation, open state and exact submission',async()=>{
    reset();const captures=[];const capture={select(fields){const chain={from(){return chain;},innerJoin(){return chain;},orderBy(){return chain;},where(predicate){captures.push({fields:Object.keys(fields),...dialect.sqlToQuery(predicate)});return chain;},then:(yes,no)=>Promise.resolve([]).then(yes,no)};return chain;}};
    const scoped=load('lib/repositories/co-adviser.repository.ts',{'@/lib/db':{db:capture},'./research-supervision.repository':supervision});await scoped.readCoAssignments(30);await scoped.readDelegatedDocument(30,8,2);
    for(const q of captures){assert.match(q.sql,/co_adviser_id/);assert.match(q.sql,/main_adviser_designation/);assert.match(q.sql,/is_active/);assert.doesNotMatch(q.sql,/"research_groups"\."adviser_id"/);}
    assert.deepEqual(captures[0].fields,['id','submissionId','title','groupId','version','state','recommendation','submissionStatus','createdAt','completedAt','closedAt']);assert.ok(captures[1].params.includes('open'));assert.ok(captures[1].params.includes(8));assert.ok(captures[1].params.includes(2));
});
test('delegated signing action derives active session identity and rejects injected actor/purpose/TTL',async()=>{
    reset();session={userId:30,roleId:2};const calls=[];
    const actions=load('lib/actions/co-adviser.action.ts',{'@/lib/auth/current-account':{getCurrentAccount:principal},'@/lib/services/co-adviser.service':service,
        '@/lib/services/submission-document.service':{createDelegatedSubmissionDocumentUrl:async(...args)=>{calls.push(args);return 'synthetic';}}});
    assert.equal(await actions.getDelegatedDocumentUrlAction({assignmentId:1,submissionId:1}),'synthetic');assert.deepEqual(calls,[[1,1,30]]);
    for(const input of [{assignmentId:1,submissionId:1,actorId:20},{assignmentId:1,submissionId:1,purpose:'adviser-review'},{assignmentId:1,submissionId:1,expiresIn:1800},{assignmentId:0,submissionId:1}])assert.equal(await actions.getDelegatedDocumentUrlAction(input),null);
    session={userId:40,roleId:3};assert.equal(await actions.getDelegatedDocumentUrlAction({assignmentId:1,submissionId:1}),null);assert.equal(calls.length,1);
});

test('assignment detail denies another Co, another version, non-Advisers, inactive accounts and missing Main',async()=>{
    reset();await delegate();session={userId:30,roleId:2};
    assert.equal((await service.getCoAdviserAssignment({assignmentId:1,submissionId:1})).data.assignment.groupId,1);
    assert.equal((await service.getCoAdviserAssignment({assignmentId:1,submissionId:2})).success,false);
    session={userId:31,roleId:2};assert.equal((await service.getCoAdviserAssignment({assignmentId:1,submissionId:1})).success,false);
    session={userId:40,roleId:3};assert.equal((await service.getCoAdviserAssignment({assignmentId:1,submissionId:1})).success,false);
    session={userId:30,roleId:2};state.users.find(u=>u.id===30).isActive=false;assert.equal((await service.getCoAdviserAssignment({assignmentId:1,submissionId:1})).success,false);
    state.users.find(u=>u.id===30).isActive=true;state.main_adviser_designation[0].mainAdviserId=null;assert.equal((await service.getCoAdviserAssignment({assignmentId:1,submissionId:1})).success,false);
});
test('terminal assignment exposes only its author\'s own recommendation and cannot regain PDF access',async()=>{
    reset();await delegate([30,31]);session={userId:30,roleId:2};await recommend(1,1,'Private own text');
    const result=await service.getCoAdviserAssignment({assignmentId:1,submissionId:1});
    assert.equal(result.data.assignment.recommendation,'Private own text');assert.equal(result.data.assignment.reviewAvailable,false);
    assert.equal(await repo.readDelegatedDocument(30,1,1),null);
    assert.equal((await service.getCoAdviserAssignment({assignmentId:2,submissionId:1})).success,false);
});
test('official draft copy rechecks Main, exact completed assignment and Under Review without academic writes',async()=>{
    reset();await delegate();session={userId:30,roleId:2};await recommend(1,1,'Private import');session={userId:20,roleId:2};
    const before=structuredClone(state);const imported=await service.getRecommendationForOfficialDraft({assignmentId:1,submissionId:1});
    assert.equal(imported.success,true);assert.equal(imported.data.text,'Private import');assert.deepEqual(state,before);
    assert.equal((await service.getRecommendationForOfficialDraft({assignmentId:1,submissionId:2})).success,false);
    state.submissions[0].status='Approved';assert.equal((await service.getRecommendationForOfficialDraft({assignmentId:1,submissionId:1})).success,false);
    state.submissions[0].status='Under Review';state.main_adviser_designation[0].mainAdviserId=31;assert.equal((await service.getRecommendationForOfficialDraft({assignmentId:1,submissionId:1})).success,false);
    session={userId:40,roleId:3};assert.equal((await service.getRecommendationForOfficialDraft({assignmentId:1,submissionId:1})).success,false);
});
test('official draft copy denies open assignments and replacement at the locked authority boundary',async()=>{
    reset();await delegate();assert.equal((await service.getRecommendationForOfficialDraft({assignmentId:1,submissionId:1})).success,false);
    session={userId:30,roleId:2};await recommend();session={userId:20,roleId:2};replaceAtLock=31;
    assert.equal((await service.getRecommendationForOfficialDraft({assignmentId:1,submissionId:1})).success,false);
});
test('Main review signer retains 1800 seconds while ordinary download stays 300',async()=>{
    reset();const signed=[];
    const pdf=load('lib/services/submission-document.service.ts',{'@/lib/auth/current-account':{getCurrentAccount:principal},'@/lib/auth/main-adviser':authority,
        '@/lib/repositories/co-adviser.repository':repo,'@/lib/repositories/user.repository':{findUserById:async id=>state.users.find(u=>u.id===id)},
        '@/lib/repositories/submission.repository':{findSubmissionById:async id=>state.submissions.find(s=>s.id===id)},
        '@/lib/repositories/research-paper.repository':{findResearchPaperById:async id=>state.research_papers.find(p=>p.id===id)},
        '@/lib/repositories/research-group.repository':{findResearchGroupById:async id=>({id})},'@/lib/repositories/group-member.repository':{},
        '@/lib/services/storage.service':{createResearchDocumentSignedUrl:async(...args)=>{signed.push(args);return 'synthetic-url';}}});
    assert.equal(await pdf.createSubmissionDocumentUrl(1,20,'adviser-review'),'synthetic-url');assert.deepEqual(signed.pop(),['research/1/v1/test.pdf',1800]);
    assert.equal(await pdf.createSubmissionDocumentUrl(1,20),'synthetic-url');assert.deepEqual(signed.pop(),['research/1/v1/test.pdf',300]);
});
