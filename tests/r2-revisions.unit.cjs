/* eslint-disable @typescript-eslint/no-require-imports */
// Offline: real service/action/SQL generation, transactional doubles. No env/DB/Storage/network.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path');
const source=require('../scripts/preview-migration-source.ts');
const {revisionDraftsSchema,revisionDraftsFromForm}=require('../lib/validations/revision.ts');
const {revisionCounts}=require('../lib/revisions.ts');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,JSON,console,require(id){if(id==='server-only')return {};if(Object.hasOwn(mocks,id))return mocks[id];if(/lib\/db|postgres|dotenv/.test(id))throw Error('Live adapter forbidden');return require(id.startsWith('@/')?path.resolve(id.slice(2)):id);}});return exports;}
test('0019 adds only two tables and preserves every pinned 0000-0018 artifact',()=>{
 const before=source.progressMigrationSource(),after=source.revisionMigrationSource();assert.equal(after.migrations.length,20);assert.equal(after.snapshot.prevId,before.snapshot.id);
 const tables=structuredClone(after.snapshot.tables);delete tables['public.revision_items'];delete tables['public.revision_responses'];assert.deepEqual(tables,before.snapshot.tables);
 const sql=fs.readFileSync('db/migrations/0019_lean_revision_management.sql','utf8');assert.doesNotMatch(sql,/(?:^|;|\n)\s*(DROP|DELETE|TRUNCATE|UPDATE|INSERT|GRANT)\b/i);
 assert.equal(after.snapshot.tables['public.revision_items'].foreignKeys.revision_items_feedback_id_feedbacks_id_fk.tableTo,'feedbacks');
 assert.equal(before.hash,source.PROGRESS_SOURCE_DIGEST);assert.equal(source.supervisionMigrationSource().hash,source.SUPERVISION_SOURCE_DIGEST);
 assert.equal(source.workspaceMigrationSource().hash,source.WORKSPACE_SOURCE_DIGEST);assert.equal(source.previewMigrationSource().hash,source.PREVIEW_SOURCE_DIGEST);
});
test('bounded correction codec distinguishes missing legacy payload from malformed/untrusted items',async()=>{
 assert.deepEqual(revisionDraftsFromForm(null),[]);for(const input of ['{','x'.repeat(70001),new File(['x'],'x')])assert.equal(revisionDraftsFromForm(input),null);
 for(const items of [[{correction:' ',reference:''}],[{correction:'x',reference:'x'.repeat(121)}],Array.from({length:31},()=>({correction:'x'})),[{correction:'x',studentId:1}]])assert.equal(revisionDraftsSchema.safeParse(items).success,false);
 const form=new FormData();form.set('revisionItems',JSON.stringify([{correction:' Fix\nmethod ',reference:' p. 2 '}]));
 const received=await new Request('http://offline.invalid/not-sent',{method:'POST',body:form}).formData();assert.deepEqual(revisionDraftsSchema.parse(revisionDraftsFromForm(received.get('revisionItems'))),[{correction:'Fix\nmethod',reference:'p. 2'}]);
});
test('confirmation snapshot freezes items and detects a changed correction or reference',()=>{
 const {createReviewConfirmation,matchesReviewConfirmation}=require('../lib/utils/review-confirmation.ts');const draft={submissionId:1,comments:'Feedback',decision:'Revision Required',revisionItems:[{correction:'Fix',reference:'p1'}]};
 const confirmed=createReviewConfirmation(draft);draft.revisionItems[0].reference='p2';assert.equal(confirmed.revisionItems[0].reference,'p1');assert.equal(matchesReviewConfirmation(confirmed,draft),false);assert.equal(Object.isFrozen(confirmed.revisionItems[0]),true);
});
function fixture(){
 const state={actor:{userId:3,roleId:3},main:1,active:true,member:true,latest:10,responses:[],logs:[],failAudit:false};
 const repo={async withPaper(id,role,paperId,work){if(!state.active||paperId!==1||!(role===2&&id===state.main||role===3&&[3,4].includes(id)&&state.member))return null;
 const old=structuredClone(state);try{return await work({read:async()=>({canManage:role===2,cycles:[{feedbackId:20,submissionId:10,version:'v1',editable:role===3&&state.latest===10,items:[1,2].map(itemId=>({id:itemId,correction:'Correction '+itemId,reference:'',position:itemId-1,responses:state.responses.filter(r=>r.itemId===itemId&&(role===2||r.studentId===id))}))}]}),respond:async(itemId,expectedRevision,actionTaken)=>{
 if(role!==3||![1,2].includes(itemId)||state.latest!==10)return 'closed';const row=state.responses.find(r=>r.studentId===id&&r.itemId===itemId);if(row?.frozenBySubmissionId)return 'closed';if((row?.revision??0)!==expectedRevision)return 'stale';
 if(row)Object.assign(row,{actionTaken,revision:row.revision+1});else state.responses.push({itemId,studentId:id,actionTaken,revision:1,frozenBySubmissionId:null});if(state.failAudit)throw Error('PRIVATE_AUDIT_FAILURE');state.logs.push(itemId);return 'saved';}});}catch(e){Object.assign(state,old);throw e;}}};
 const service=load('lib/services/revision.service.ts',{'@/lib/db':{db:{}},'@/lib/auth/current-account':{getCurrentAccount:async()=>state.actor},'@/lib/repositories/revision.repository':{createRevisionRepository:()=>repo}}).createRevisionService(repo,async()=>state.actor);
 const respond=(actionTaken,expectedRevision=0,itemId=1)=>service.respond({paperId:1,itemId,expectedRevision,actionTaken});return {state,service,respond};
}
test('Student response save/clear derives Pending/Addressed; separate members cannot overwrite each other',async()=>{
 const f=fixture();let result=await f.respond(' Method updated ');assert.equal(result.success,true);assert.equal(f.state.responses[0].actionTaken,'Method updated');assert.deepEqual(revisionCounts(result.data.cycles[0]),{total:2,addressed:1,pending:1});
 assert.equal((await f.respond('stale',0)).success,false);assert.equal((await f.respond('',1)).success,true);assert.equal(f.state.responses[0].actionTaken,'');
 f.state.actor.userId=4;result=await f.respond('Different member');assert.equal(result.success,true);assert.equal(f.state.responses.length,2);assert.equal(result.data.cycles[0].items[0].responses.length,1);assert.equal(f.state.responses[0].actionTaken,'');
 f.state.actor={userId:1,roleId:2};result=await f.service.read({paperId:1});assert.equal(result.data.cycles[0].items[0].responses.length,2);assert.equal((await f.respond('Main cannot respond')).success,false);
});
test('authorization denies other roles, Co-Adviser, cross-paper, removed members, stale role and forged actor fields',async()=>{
 const f=fixture();for(const actor of [null,{userId:2,roleId:2},{userId:5,roleId:1},{userId:8,roleId:4}]){f.state.actor=actor;assert.equal((await f.service.read({paperId:1})).success,false);assert.equal((await f.respond('x')).success,false);}
 f.state.actor={userId:3,roleId:3};assert.equal((await f.service.read({paperId:99})).success,false);assert.equal((await f.respond('x',0,999)).success,false);
 assert.equal((await f.service.respond({paperId:1,itemId:1,expectedRevision:0,actionTaken:'x',studentId:4})).success,false);
 for(const key of ['active','member']){f.state[key]=false;assert.equal((await f.respond('x')).success,false);f.state[key]=true;}assert.equal(f.state.responses.length,0);
});
test('new submission closes response window and frozen records remain unchanged; failed audit rolls back',async()=>{
 const f=fixture();await f.respond('Historical response');const old=JSON.stringify(f.state.responses);f.state.latest=11;assert.equal((await f.respond('overwrite',1)).success,false);assert.equal(JSON.stringify(f.state.responses),old);
 f.state.latest=10;f.state.responses[0].frozenBySubmissionId=11;assert.equal((await f.respond('overwrite',1)).success,false);
 const g=fixture();g.state.failAudit=true;const result=await g.respond('rollback');assert.equal(result.success,false);assert.doesNotMatch(result.message,/PRIVATE/);assert.equal(g.state.responses.length,0);
});
test('actual repository SQL applies current authority, membership, paper scope and shared upload advisory lock',async()=>{
 const {drizzle}=require('drizzle-orm/pg-proxy'),schema=require('../db/schema/index.ts');
 const guard=load('lib/repositories/research-supervision.repository.ts',{'@/lib/db':{db:{}}});
 const {createRevisionRepository,freezeRevisionResponses}=load('lib/repositories/revision.repository.ts',{'./research-supervision.repository':guard});
 const state={role:3,active:true,main:1,member:true,groupStatus:'active',queries:[]};
 const db=drizzle(async(query,params)=>{
  state.queries.push({query,params});let row;
  if(query.includes('from "users"'))row={id:3,role_id:state.role,is_active:state.active};
  else if(query.includes('from "main_adviser_designation"'))row={main_adviser_id:state.main};
  else if(query.includes('from "research_papers"'))row={group_id:10};else if(query.includes('from "research_groups"'))row={id:10,status:state.groupStatus};
  else if(query.includes('from "group_members"'))row=state.member?{id:9}:null;
  else if(query.includes('from "submissions"'))row={id:7,version:'v1',status:'Revision Required'};
  else if(query.includes('from "revision_items"'))return {rows:query.includes('select "revision_items"."id" from')?[[11]]:[]};
  if(!row||!query.startsWith('select'))return {rows:[]};const columns=[...query.slice(0,query.indexOf(' from ')).matchAll(/"([a-z_]+)"/g)].map(m=>m[1]);return {rows:[columns.map(c=>row[c]??null)]};
 },{schema});db.transaction=work=>work(db);const repo=createRevisionRepository(db);
 assert.equal(await repo.withPaper(3,3,1,async scope=>(await scope.read()).canManage),false);
 const query=state.queries.find(q=>q.query.includes('from "revision_items"'));assert.match(query.query,/"submissions"\."paper_id" =/);assert.deepEqual(query.params,[1,'Revision Required','Revision Required']);
 const advisory=state.queries.findIndex(q=>q.query.includes('pg_advisory_xact_lock')),account=state.queries.findIndex(q=>q.query.includes('from "users"')),submission=state.queries.findIndex(q=>q.query.includes('from "submissions"')),paper=state.queries.findIndex(q=>q.query.includes('from "research_papers"')&&q.query.includes('for share'));
 assert.ok(advisory<account&&account<submission&&submission<paper);
 for(const change of [{active:false},{member:false},{groupStatus:'archived'},{role:2}]){const old={...state};Object.assign(state,change);assert.equal(await repo.withPaper(3,3,1,async()=>assert.fail('denied operation')),null);Object.assign(state,old);}
 state.role=2;state.main=3;assert.equal(await repo.withPaper(3,2,1,async scope=>(await scope.read()).canManage),true);state.main=99;assert.equal(await repo.withPaper(3,2,1,async()=>assert.fail('Co denied')),null);
 await freezeRevisionResponses(db,1,8);const frozen=state.queries.find(q=>q.query.startsWith('update "revision_responses"'));assert.match(frozen.query,/"frozen_by_submission_id" is null/);assert.deepEqual(frozen.params,[8,11]);
});
test('response refresh failure preserves acknowledged save',async()=>{
 const action=load('lib/actions/revision.action.ts',{'next/cache':{revalidatePath(){throw Error('cache');}},'@/lib/services/revision.service':{respondToRevision:async()=>({success:true,message:'Saved',data:{cycles:[]}})}});
 assert.equal((await action.respondToRevisionAction({})).success,true);
});
test('real response repository SQL persists own response, rejects stale saves, clears and freezes history atomically',async()=>{
 const {drizzle}=require('drizzle-orm/pg-proxy'),schema=require('../db/schema/index.ts');
 const guard=load('lib/repositories/research-supervision.repository.ts',{'@/lib/db':{db:{}}});
 const {createRevisionRepository,freezeRevisionResponses}=load('lib/repositories/revision.repository.ts',{'./research-supervision.repository':guard});
 let saved=null,latest=7,failAudit=false,logs=0;const queries=[];
 const raw={revision_items:{id:11,feedback_id:20,correction:'Fix method',reference:'Section 3',position:0,created_at:'2026-11-11 01:00:00+00'},feedbacks:{id:20,created_at:'2026-11-11 01:00:00'},submissions:{id:7,version:'v1'},users:{first_name:'Synthetic',last_name:'Student'}};
 function project(query,tables){const part=query.slice(0,query.indexOf(' from '));const matches=[...part.matchAll(/"([a-z_]+)"(?:\."([a-z_]+)")?/g)];return matches.map(([,a,b])=>b?tables[a]?.[b]??null:tables.default?.[a]??null);}
 const db=drizzle(async(query,params)=>{queries.push({query,params});
  if(query.startsWith('insert into "revision_responses"')){saved={id:1,item_id:params[0],student_id:params[1],action_taken:params[2],revision:1,frozen_by_submission_id:null,updated_at:'2026-11-11 01:00:00+00'};return {rows:[]};}
  if(query.startsWith('update "revision_responses"')){if(query.includes('set "frozen_by_submission_id"'))saved.frozen_by_submission_id=params[0];else Object.assign(saved,{action_taken:params[0],revision:params[1]});return {rows:[]};}
  if(query.startsWith('insert into "activity_logs"')){if(failAudit)throw Error('audit');logs++;return {rows:[]};}
  let row;
  if(query.includes('from "revision_responses"'))return {rows:saved?[project(query,{...raw,revision_responses:saved,default:saved})]:[]};
  if(query.includes('from "revision_items"'))return {rows:[project(query,raw)]};
  if(query.includes('from "users"'))row={id:3,role_id:3,is_active:true};
  else if(query.includes('from "research_papers"'))row={group_id:10};else if(query.includes('from "research_groups"'))row={id:10,status:'active'};
  else if(query.includes('from "group_members"'))row={id:9};else if(query.includes('from "submissions"'))return {rows:[[7,'v1','Revision Required'],...(latest===7?[]:[[8,'v2','Submitted']])]};
  return {rows:row?[project(query,{default:row})]:[]};
 },{schema});
 db.transaction=async work=>{const before=structuredClone(saved),beforeLogs=logs;try{return await work(db);}catch(e){saved=before;logs=beforeLogs;throw e;}};
 const repo=createRevisionRepository(db),save=(revision,text)=>repo.withPaper(3,3,1,scope=>scope.respond(11,revision,text));
 assert.equal(await save(0,'Updated method'),'saved');assert.equal(saved.student_id,3);assert.equal(saved.action_taken,'Updated method');
 assert.equal(await save(0,'stale'),'stale');assert.equal(await save(1,''),'saved');assert.equal(saved.revision,2);assert.equal(saved.action_taken,'');
 failAudit=true;await assert.rejects(save(2,'rollback'),error=>error.cause?.message==='audit');assert.equal(saved.action_taken,'');assert.equal(saved.revision,2);failAudit=false;
 const data=await repo.withPaper(3,3,1,scope=>scope.read());assert.equal(data.cycles[0].items[0].responses[0].revision,2);
 const owned=queries.find(q=>q.query.includes('from "revision_responses"')&&q.query.includes('for update'));assert.deepEqual(owned.params,[11,3]);
 await db.transaction(tx=>freezeRevisionResponses(tx,1,8));assert.equal(saved.frozen_by_submission_id,8);assert.equal(await save(2,'overwrite'),'closed');
 latest=8;assert.equal(await save(2,'overwrite'),'closed');assert.equal(logs,2);
});
test('0019 operator requires exact 19-entry source/target and durable preservation; no retry on uncertainty',async()=>{
 const {upgradePreview0019}=require('../scripts/preview-revisions.ts');const ledger=source.revisionMigrationSource().migrations.map(m=>({hash:m.hash,created_at:String(m.folderMillis)}));const before={target:'test',empty:false,preservedData:'old',catalog:'before',ledger:ledger.slice(0,19)},after={...before,catalog:'after',ledger};let reads=0,writes=0;
 const io={inspect:async()=>++reads===1?before:after,apply:async()=>{writes++;return 'after';}},approval={execute:true,target:'test',source:source.REVISION_SOURCE_DIGEST};
 assert.equal(await upgradePreview0019(io,approval,source.REVISION_SOURCE_DIGEST),'upgraded-0019-confirmed');assert.equal(writes,1);
 for(const bad of [{...approval,execute:false},{...approval,source:'bad'},{...approval,target:'other'}])await assert.rejects(upgradePreview0019({...io,inspect:async()=>before},bad,source.REVISION_SOURCE_DIGEST));
 reads=0;await assert.rejects(upgradePreview0019({...io,inspect:async()=>++reads===1?before:{...after,preservedData:'changed'}},approval,source.REVISION_SOURCE_DIGEST));
 reads=0;writes=0;await assert.rejects(upgradePreview0019({...io,apply:async()=>{writes++;throw Error('uncertain');}},approval,source.REVISION_SOURCE_DIGEST),/unconfirmed/);assert.equal(writes,1);assert.equal(reads,2);
});
test('0019 grants are exactly SELECT/INSERT corrections, SELECT/INSERT/UPDATE responses and sequence USAGE',async()=>{
 const {grantRevisionRuntime,verifyRevisionRuntime}=require('../scripts/preview-revisions.ts');let excess=false,exposed=false;const queries=[];
 const sql=(parts,...params)=>{const text=parts.join('?');queries.push(text);if(text.includes('from drizzle.__drizzle_migrations'))return Promise.resolve(source.revisionMigrationSource().migrations.map(m=>({hash:m.hash,created_at:String(m.folderMillis)})));
 if(text.includes('as grantable')){const sequence=params[1].endsWith('_seq');return Promise.resolve([{allowed:sequence?params[2]==='USAGE':(params[1].endsWith('revision_items')?['SELECT','INSERT']:['SELECT','INSERT','UPDATE']).includes(params[2])||excess&&params[2]==='DELETE',grantable:false}]);}
 if(text.includes('as widened'))return Promise.resolve([{widened:false}]);if(text.includes('as exposed'))return Promise.resolve([{exposed}]);return Promise.resolve([]);};
 await grantRevisionRuntime(sql);assert.deepEqual(queries.filter(q=>q.startsWith('grant')),['grant select,insert on table public.revision_items to thesishs_preview_runtime','grant select,insert,update on table public.revision_responses to thesishs_preview_runtime','grant usage on sequence public.revision_items_id_seq,public.revision_responses_id_seq to thesishs_preview_runtime']);
 excess=true;await assert.rejects(verifyRevisionRuntime(sql,true));excess=false;exposed=true;await assert.rejects(verifyRevisionRuntime(sql,true));
});
