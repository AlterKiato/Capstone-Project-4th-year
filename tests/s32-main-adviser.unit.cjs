/* eslint-disable @typescript-eslint/no-require-imports */
// Actual TS services/repositories with isolated module boundaries and transactional doubles.
// No environment, PostgreSQL, Storage, provider or browser connection.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { getTableName, SQL } = require('drizzle-orm');
const { PgDialect } = require('drizzle-orm/pg-core');
const dialect = new PgDialect();
function load(file, mocks) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { exports, console, Date, require(id) {
        if (Object.hasOwn(mocks, id)) return mocks[id];
        if (id === 'server-only') return {};
        if (/lib\/(db|supabase)|^postgres$|dotenv/.test(id)) throw Error('Live adapter forbidden: ' + id);
        return require(id.startsWith('@/') ? path.resolve(id.slice(2)) : id);
    } }, { filename: file });
    return exports;
}
let state, session, events, replaceAtLock, failLog;
const user = (id, roleId) => ({ id, roleId, isActive: true, email: `${id}@example.invalid` });
function reset() {
    state = { users: [user(10,1),user(20,2),user(30,2),user(40,3)], main_adviser_designation: [{ id:1,mainAdviserId:20,revision:1 }],
        research_groups: [{id:1,adviserId:30,status:'active',groupName:'Historical other Adviser'}, {id:2,adviserId:30,status:'active',groupName:'Second group'}],
        group_members: [], co_adviser_review_assignments: [], research_papers: [{id:1,groupId:1,status:'In Review'}], submissions: [{id:1,paperId:1,submittedBy:40,version:'v1',status:'Submitted'}], feedbacks: [], activity_logs: [] };
    session = {userId:20,roleId:2,email:'20@example.invalid'}; events=[]; replaceAtLock=null; failLog=false;
}
const current = () => state.main_adviser_designation[0]?.mainAdviserId ?? null;
const principal = () => {
    const account = state.users.find(u=>u.id===session?.userId);
    return account?.isActive && account.roleId===session.roleId ? session : null;
};
const getMain = async expected => {
    const actor=principal(); return actor?.roleId===2 && actor.userId===current() && (expected===undefined || expected===actor.userId) ? actor : null;
};
function matches(row, predicate) {
    if (!predicate) return true;
    const q=dialect.sqlToQuery(predicate), camel=s=>s.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
    const eq=[...q.sql.matchAll(/"\w+"\."(\w+)" = \$(\d+)/g)], inside=q.sql.match(/"\w+"\."(\w+)" in \(([^)]+)\)/);
    assert.ok(eq.length || inside,'Unsupported test predicate: '+q.sql);
    return eq.every(([,name,n])=>row[camel(name)]===q.params[Number(n)-1]) && (!inside || [...inside[2].matchAll(/\$(\d+)/g)].some(([,n])=>row[camel(inside[1])]===q.params[Number(n)-1]));
}
function executor(draft, context) {
    const rows=table=>draft[getTableName(table)];
    const projection=(row, fields)=>fields?Object.fromEntries(Object.entries(fields).map(([key,column])=>[key,row[column.name.replace(/_([a-z])/g,(_,c)=>c.toUpperCase())]])):structuredClone(row);
    const write=table=>{ assert.ok(context.main,'academic writes require the singleton lock'); events.push('write:'+getTableName(table)); };
    return {
        async execute(query) { assert.match(dialect.sqlToQuery(query).sql, /select pg_advisory_xact_lock/); events.push('paper:advisory-lock'); return []; },
        select(fields) {
            let table, predicate;
            const result=()=>rows(table).filter(row=>matches(row,predicate)).map(row=>projection(row,fields));
            const chain={from(t){table=t;return chain;},where(p){predicate=p;return chain;},orderBy(){return chain;},
                async for(mode){
                    const name=getTableName(table);
                    if(name==='users'){assert.equal(context.main,false);assert.equal(mode,'update');context.users=true;events.push('users:lock');}
                    else if(name==='main_adviser_designation'){
                        assert.ok(context.users); assert.ok(['share','update'].includes(mode));
                        if(replaceAtLock){draft.main_adviser_designation[0].mainAdviserId=replaceAtLock;replaceAtLock=null;}
                        context.main=true;events.push('designation:lock');
                    } else {assert.ok(context.main);events.push(name+':lock');}
                    return result();
                },then(resolve,reject){return Promise.resolve().then(result).then(resolve,reject);}};
            return chain;
        },
        insert(table){return {values(data){const run=()=>{write(table);if(failLog && getTableName(table)==='activity_logs')throw Error('Synthetic log failure');const row={id:rows(table).length+1,joinedAt:new Date(),...data};rows(table).push(row);return [structuredClone(row)];};return{returning:async()=>run(),then:(resolve,reject)=>Promise.resolve().then(run).then(resolve,reject)};}};},
        update(table){return {set(data){return {where(predicate){return {returning:async fields=>{
            write(table);return rows(table).filter(row=>matches(row,predicate)).map(row=>{for(const [key,value]of Object.entries(data))row[key]=value instanceof SQL?row[key]+1:value;return projection(row,fields);});
        }};}};}};},
        delete(table){return {where:async predicate=>{write(table);draft[getTableName(table)]=rows(table).filter(row=>!matches(row,predicate));}};},
    };
}
let queue=Promise.resolve();
const db={transaction(operation){const run=queue.then(async()=>{const draft=structuredClone(state);const result=await operation(executor(draft,{users:false,main:false}));state=draft;return result;});queue=run.catch(()=>{});return run;}};
const mainRepo=load('lib/repositories/research-supervision.repository.ts',{'@/lib/db':{db}});
const repoMocks={'@/lib/db':{db},'./research-supervision.repository':mainRepo};
const membersRepo=load('lib/repositories/group-member.repository.ts',repoMocks);
const groupsRepo=load('lib/repositories/research-group.repository.ts',repoMocks);
const coRepo=load('lib/repositories/co-adviser.repository.ts',repoMocks);
const feedbackRepo=load('lib/repositories/feedback.repository.ts',{...repoMocks,'./co-adviser.repository':coRepo});
// R2 added a manuscript-only dependency. S3.2 review checks must never invoke that path.
const submissionsRepo=load('lib/repositories/submission.repository.ts',{...repoMocks,'./revision.repository':{freezeRevisionResponses:async()=>{throw Error('Manuscript submission outside S3.2 regression scope');}}});
const mainAuth={'getCurrentMainAdviser':getMain};
const groupRead={findResearchGroupsForMainAdviser:async()=>state.research_groups,findResearchGroupById:async id=>state.research_groups.find(g=>g.id===id),createResearchGroupForMainAdviser:groupsRepo.createResearchGroupForMainAdviser};
const submissionRead={findSubmissionForAdviser:async(id,groups,actor)=>{assert.equal(actor,current());const row=state.submissions.find(s=>s.id===id);return row&&groups.includes(1)?{...row,researchTitle:'Synthetic',groupId:1}:undefined;},findSubmissionsByGroupIds:async(groups,actor)=>{assert.equal(actor,current());return state.submissions.filter(s=>groups.includes(state.research_papers.find(p=>p.id===s.paperId).groupId));}};
const base={'@/lib/auth/main-adviser':mainAuth,'@/lib/repositories/research-group.repository':groupRead,'@/lib/repositories/adviser-submission.repository':submissionRead};
const review=load('lib/services/adviser-review.service.ts',{...base,'@/lib/repositories/submission.repository':submissionsRepo});
const feedback=load('lib/services/adviser-feedback.service.ts',{...base,'@/lib/repositories/feedback.repository':feedbackRepo,
    '@/lib/services/notification.service':{notifyStudentSubmissionApproved:async()=>({success:true}),notifyStudentSubmissionRevisionRequired:async()=>({success:true})}});
const memberService=load('lib/services/group-member.services.ts',{...base,'@/lib/repositories/group-member.repository':membersRepo});
const groupService=load('lib/services/research-group.services.ts',{...base,'@/lib/auth/ai-authorization':{getActiveAIAccount:async()=>null},
    '@/lib/repositories/user.repository':{findUsersByRoleId:async()=>[]},'@/lib/services/activity-log.service':{logActivity:async()=>{}},'@/lib/services/notification.service':{sendNotification:async()=>({success:true})}});
const directory=load('lib/services/adviser-submission.service.ts',base);
const authorityMessage=/Main Research Adviser/;

test('fresh Main helper rejects missing/inactive/stale-role/non-Main/forged identities and fails closed on designation errors',async()=>{
    reset();let fail=false;
    const auth=load('lib/auth/main-adviser.ts',{'@/lib/auth/current-account':{getCurrentAccount:async()=>principal()},'@/lib/repositories/research-supervision.repository':{
        findCurrentMainAdviserId:async()=>{if(fail)throw Error('Synthetic lookup failure');const u=state.users.find(u=>u.id===current());return u?.isActive&&u.roleId===2?u.id:null;}}});
    assert.equal((await auth.getCurrentMainAdviser()).userId,20);assert.equal(await auth.getCurrentMainAdviser(30),null);
    for(const actor of [null,{userId:30,roleId:2},{userId:10,roleId:1},{userId:20,roleId:3}]){session=actor;assert.equal(await auth.getCurrentMainAdviser(),null);}
    session={userId:20,roleId:2};state.users.find(u=>u.id===20).isActive=false;assert.equal(await auth.getCurrentMainAdviser(),null);
    state.users.find(u=>u.id===20).isActive=true;state.main_adviser_designation[0].mainAdviserId=null;assert.equal(await auth.getCurrentMainAdviser(),null);assert.equal(await auth.getMainAdviserNotificationRecipient(),null);
    fail=true;assert.equal(await auth.getCurrentMainAdviser(),null);assert.equal(await auth.getMainAdviserNotificationRecipient(),null);
});

test('Main lists and reviews institutional projects regardless of historical Adviser; ordinary Adviser has no academic operations',async()=>{
    reset();assert.equal((await directory.getAdviserSubmissions(20)).data.length,1);
    assert.equal((await groupService.getResearchGroupsByAdviser(20)).data.length,2);
    assert.equal((await review.startSubmissionReview(1,20)).success,true);
    assert.equal((await feedback.createAdviserFeedback(1,20,'Official feedback','Approved')).success,true);
    assert.equal(state.feedbacks[0].teacherId,20);assert.equal(state.research_groups[0].adviserId,30);
    reset();session={userId:30,roleId:2};const before=JSON.stringify(state);
    for(const result of [await directory.getAdviserSubmissions(30),await groupService.getResearchGroupsByAdviser(30),await review.startSubmissionReview(1,30),await feedback.createAdviserFeedback(1,30,'No','Approved'),
        await groupService.createResearchGroup({groupName:'Test',strand:'STEM',section:'1',schoolYear:'2026'},30),await memberService.addGroupMember(1,40),await memberService.removeGroupMember(1,40)]) {
        assert.equal(result.success,false);assert.match(result.message,authorityMessage);
    }
    assert.equal(JSON.stringify(state),before);
});

test('dashboard/group/member-eligibility adapters return institutional data only for the current Main',async()=>{
    reset();let reads=0;
    const auth={'@/lib/auth/authorization':{requireRole:async()=>session},'@/lib/auth/main-adviser':mainAuth};
    const dashboard=load('lib/services/adviser-dashboard.service.ts',{...auth,'@/lib/repositories/adviser-dashboard.repository':{readAdviserDashboard:async()=>{reads++;return {totalGroups:2,pending:1,reviewed:0,attention:[],groups:state.research_groups};}}});
    const groups=load('lib/services/adviser-groups.service.ts',{...auth,'@/lib/repositories/research-group.repository':groupRead,'./group-member.services':memberService,
        '@/lib/repositories/adviser-groups.repository':{readAdviserGroups:async()=>{reads++;return state.research_groups;},readEligibleGroupStudents:async(group,actor)=>{assert.equal(actor,20);assert.equal(group,1);reads++;return [{id:40}];}}});
    assert.equal((await dashboard.getAdviserDashboard()).totalGroups,2);assert.equal((await groups.getAdviserGroupsDirectory()).groups.length,2);
    assert.equal((await groups.getEligibleGroupStudents(1))[0].id,40);const before=reads;
    session={userId:30,roleId:2};assert.equal(await dashboard.getAdviserDashboard(),null);assert.equal(await groups.getAdviserGroupsDirectory(),null);assert.equal(await groups.getEligibleGroupStudents(1),null);assert.equal(reads,before);
    session={userId:20,roleId:2};state.main_adviser_designation=[];assert.equal(await dashboard.getAdviserDashboard(),null);assert.equal(await groups.getAdviserGroupsDirectory(),null);
});

test('Main group creation retains creator attribution; membership add/remove preserves one active group under locks',async()=>{
    reset();const result=await groupService.createResearchGroup({groupName:'New Group',strand:'STEM',section:'1',schoolYear:'2026'},20);
    assert.equal(result.success,true);assert.equal(result.data.adviserId,20);assert.equal(state.research_groups[0].adviserId,30);
    assert.equal((await memberService.addGroupMember(1,40)).success,true);
    assert.equal((await memberService.addGroupMember(2,40)).success,false);assert.equal(state.group_members.length,1);
    assert.equal((await memberService.removeGroupMember(1,40)).success,true);assert.equal((await memberService.addGroupMember(2,40)).success,true);
    state.research_groups.find(g=>g.id===1).status='archived';assert.equal((await memberService.addGroupMember(1,40)).success,false);
    assert.ok(events.indexOf('users:lock')<events.indexOf('designation:lock'));
});

test('simulated concurrent memberships admit one active assignment; no schema or historical owner mutation',async()=>{
    reset();const groups=JSON.stringify(state.research_groups);
    const results=await Promise.all([memberService.addGroupMember(1,40),memberService.addGroupMember(2,40)]);
    assert.equal(results.filter(r=>r.success).length,1);assert.equal(state.group_members.length,1);assert.equal(JSON.stringify(state.research_groups),groups);
});

test('official decisions serialize with replacement; former Main loses authority and duplicate decisions cannot persist',async()=>{
    reset();state.submissions[0].status='Under Review';
    const data={submissionId:1,paperId:1,teacherId:20,comments:'Official',decision:'Approved',expectedSubmissionStatus:'Under Review',researchStatus:'Approved',activityAction:'Approved'};
    await Promise.all([feedbackRepo.persistAdviserDecision(data),mainRepo.replaceMainAdviserDesignation(10,30,1)]);
    assert.equal(current(),30);assert.equal(state.feedbacks.length,1);assert.equal(await getMain(20),null);
    assert.equal(await feedbackRepo.persistAdviserDecision(data),null);
    reset();state.submissions[0].status='Under Review';
    await mainRepo.replaceMainAdviserDesignation(10,30,1);assert.equal(await feedbackRepo.persistAdviserDecision(data),null);assert.equal(state.feedbacks.length,0);
    reset();state.submissions[0].status='Under Review';
    const results=await Promise.allSettled([feedbackRepo.persistAdviserDecision(data),feedbackRepo.persistAdviserDecision(data)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(state.feedbacks.length,1);
});

test('replacement before mutation lock denies writes; missing designation fails closed; exact paper binding and audit rollback hold',async()=>{
    reset();replaceAtLock=30;assert.equal((await review.startSubmissionReview(1,20)).success,false);assert.equal(state.submissions[0].status,'Submitted');
    reset();state.main_adviser_designation=[];assert.equal((await memberService.addGroupMember(1,40)).success,false);assert.equal((await review.startSubmissionReview(1,20)).success,false);
    reset();state.submissions[0].status='Under Review';
    const data={submissionId:1,paperId:2,teacherId:20,comments:'Official',decision:'Approved',expectedSubmissionStatus:'Under Review',researchStatus:'Approved',activityAction:'Approved'};
    assert.equal(await feedbackRepo.persistAdviserDecision(data),null);assert.equal(state.feedbacks.length,0);
    failLog=true;await assert.rejects(()=>feedbackRepo.persistAdviserDecision({...data,paperId:1}),/Synthetic log failure/);
    assert.equal(state.feedbacks.length,0);assert.equal(state.submissions[0].status,'Under Review');assert.equal(state.research_papers[0].status,'In Review');
});

test('Main PDF signing preserves exact paper/version, fixed lifetimes, Student contracts and rejects ordinary/revoked Advisers',async()=>{
    reset();let file='research/1/v1/test.pdf',calls=[],member=true,revokeDuringSign=false;
    const pdf=load('lib/services/submission-document.service.ts',{'@/lib/auth/main-adviser':mainAuth,
        '@/lib/auth/current-account':{getCurrentAccount:async()=>principal()},
        '@/lib/repositories/co-adviser.repository':{readDelegatedDocument:async()=>null},
        '@/lib/repositories/user.repository':{findUserById:async id=>state.users.find(u=>u.id===id)},
        '@/lib/repositories/submission.repository':{findSubmissionById:async()=>({...state.submissions[0],fileUrl:file})},
        '@/lib/repositories/research-paper.repository':{findResearchPaperById:async()=>state.research_papers[0]},
        '@/lib/repositories/research-group.repository':groupRead,'@/lib/repositories/group-member.repository':{findGroupMember:async()=>member},
        '@/lib/services/storage.service':{createResearchDocumentSignedUrl:async(...args)=>{calls.push(args);if(revokeDuringSign)state.main_adviser_designation[0].mainAdviserId=30;return 'synthetic-url';}}});
    assert.equal(await pdf.createSubmissionDocumentUrl(1,20,'adviser-review'),'synthetic-url');assert.equal(calls.pop()[1],1800);
    assert.equal(await pdf.createSubmissionDocumentUrl(1,20),'synthetic-url');assert.equal(calls.pop()[1],300);
    file='research/1/v2/test.pdf';assert.equal(await pdf.createSubmissionDocumentUrl(1,20),null);file='research/1/v1/test.pdf';
    session={userId:30,roleId:2};assert.equal(await pdf.createSubmissionDocumentUrl(1,30),null);assert.equal(calls.length,0);
    session={userId:20,roleId:2};revokeDuringSign=true;assert.equal(await pdf.createSubmissionDocumentUrl(1,20),null);
    session={userId:40,roleId:3};assert.equal(await pdf.createSubmissionDocumentUrl(1,40),'synthetic-url');assert.equal(calls.pop()[1],300);
    member=false;assert.equal(await pdf.createSubmissionDocumentUrl(1,40),null);assert.equal(await pdf.createSubmissionDocumentUrl(1,10),null);
});

test('AI aggregate reads require current Main and discard a result after replacement; no provider activation',async()=>{
    reset();let reads=0,replace=false;
    const aggregate=load('lib/services/ai-aggregation.service.ts',{'@/lib/auth/main-adviser':mainAuth,
        '@/lib/auth/ai-authorization':{getActiveAIAccount:async()=>null},'@/lib/repositories/admin-ai-aggregate.repository':{},
        '@/lib/repositories/adviser-submission.repository':{getAdviserAIWorkflowAggregate:async()=>{reads++;if(replace)state.main_adviser_designation[0].mainAdviserId=30;return {}; }},
        '@/lib/ai/aggregate-policy':{minimizeAdviserAggregate:value=>value,minimizeAdminAggregate:value=>value}});
    session={userId:30,roleId:2};assert.equal((await aggregate.prepareLocalAdviserAggregate()).success,false);assert.equal(reads,0);
    session={userId:20,roleId:2};assert.equal((await aggregate.prepareLocalAdviserAggregate()).success,true);
    replace=true;assert.equal((await aggregate.prepareLocalAdviserAggregate()).success,false);
});

test('dashboard, group, member, submission, feedback/version and aggregate SQL scopes use live Main designation, not adviser_id',async()=>{
    reset();const queries=[];
    const capture={select(){const chain={from(){return chain;},innerJoin(){return chain;},leftJoin(){return chain;},orderBy(){return chain;},limit(){return chain;},where(predicate){queries.push(dialect.sqlToQuery(predicate).sql);return chain;},then(resolve,reject){return Promise.resolve([]).then(resolve,reject);}};return chain;},$count(){return 0;}};
    const mocks={'@/lib/db':{db:capture},'./research-supervision.repository':mainRepo};
    const groups=load('lib/repositories/adviser-groups.repository.ts',mocks);await groups.readAdviserGroups(20);await groups.readEligibleGroupStudents(1,20);
    const subs=load('lib/repositories/adviser-submission.repository.ts',mocks);await subs.findSubmissionsByGroupIds([1,2],20);await subs.findSubmissionForAdviser(1,[1,2],20);await subs.findSubmissionVersionsForAdviser(1,20);await subs.getAdviserAIWorkflowAggregate(20);
    await load('lib/repositories/adviser-review-details.repository.ts',mocks).readOwnedSubmissionFeedback(1,20);
    await assert.rejects(()=>load('lib/repositories/adviser-dashboard.repository.ts',mocks).readAdviserDashboard(20)); // empty capture rows; every predicate was captured
    const scoped=queries.filter(query=>query.includes('main_adviser_designation'));
    assert.ok(scoped.length>=12);for(const query of scoped){assert.match(query,/is_active/);assert.doesNotMatch(query,/"research_groups"\."adviser_id"/);}
    for(const query of queries.filter(query=>!query.includes('main_adviser_designation'))) assert.match(query,/"group_members"\."user_id" = "users"\."id"/, 'only correlated membership eligibility subqueries omit the outer authority scope');
});
