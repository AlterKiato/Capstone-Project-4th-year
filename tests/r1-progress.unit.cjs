/* eslint-disable @typescript-eslint/no-require-imports */
// Offline service/action policy and generated artifact checks. No database or environment access.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path');
const source=require('../scripts/preview-migration-source.ts');
const view=require('../lib/research-progress.ts');
const {progressMutationSchema}=require('../lib/validations/research-progress.ts');
function load(file,mocks){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,require(id){if(id==='server-only')return {};if(Object.hasOwn(mocks,id))return mocks[id];if(/lib\/db|postgres|dotenv/.test(id))throw Error('Live adapter forbidden');return require(id.startsWith('@/')?path.resolve(id.slice(2)):id);}});return exports;}
function fixture(){
 const state={actor:{userId:1,roleId:2},main:1,active:true,member:true,rows:[],logs:[],evidence:[{id:1,version:'v1',status:'Submitted'},{id:2,version:'v2',status:'Revision Required'},{id:3,version:'v3',status:'Approved'}],failLog:false};
 const repo={async withPaper(id,role,paperId,operation){if(!state.active||paperId!==1||!(role===2&&id===state.main||role===3&&id===3&&state.member))return null;
 const old=structuredClone(state);try{return await operation({canManage:role===2,list:async()=>({milestones:state.rows,submissions:state.evidence}),milestone:async id=>state.rows.find(r=>r.id===id),evidence:async id=>state.evidence.find(r=>r.id===id),
 create:async(title,dueDate)=>{const row={id:1,paperId:1,title,dueDate,submissionId:null,verifiedBy:null,verifiedAt:null,revision:0};state.rows.push(row);return row;},
 patch:async(row,patch)=>{const saved={...row,...patch,revision:row.revision+1};state.rows=state.rows.map(r=>r.id===row.id?saved:r);return saved;},log:async(...args)=>{if(state.failLog)throw Error('PRIVATE_AUDIT_FAILURE');state.logs.push(args);}});}catch(e){Object.assign(state,old);throw e;}}};
 const service=load('lib/services/research-progress.service.ts',{'@/lib/db':{db:{}},'@/lib/auth/current-account':{getCurrentAccount:async()=>state.actor},'@/lib/repositories/research-progress.repository':{createResearchProgressRepository:()=>repo}}).createResearchProgressService(repo,async()=>state.actor);
 const existing=operation=>({operation,paperId:1,milestoneId:1,expectedRevision:state.rows[0].revision});
 const create=()=>service.mutate({operation:'create',paperId:1,title:' Manuscript ',dueDate:'2026-11-01'});
 return {state,service,existing,create};
}
test('0018 is additive, ordered before its composite FK, and preserves every historical source pin',()=>{
 const before=source.supervisionMigrationSource(),after=source.progressMigrationSource();assert.equal(before.migrations.length,18);assert.equal(after.migrations.length,19);
 const tables=structuredClone(after.snapshot.tables);delete tables['public.research_milestones'];delete tables['public.submissions'].uniqueConstraints.submissions_id_paper_unique;
 assert.deepEqual(tables,before.snapshot.tables);assert.equal(after.snapshot.prevId,before.snapshot.id);
 const sql=fs.readFileSync('db/migrations/0018_research_progress.sql','utf8');assert.doesNotMatch(sql,/(?:^|;|\n)\s*(DROP|DELETE|TRUNCATE|UPDATE|INSERT|GRANT)\b/i);
 assert.ok(sql.indexOf('ADD CONSTRAINT "submissions_id_paper_unique"')<sql.indexOf('ADD CONSTRAINT "research_milestones_submission_paper_fk"'));
 const fk=after.snapshot.tables['public.research_milestones'].foreignKeys.research_milestones_submission_paper_fk;
 assert.deepEqual(fk.columnsFrom,['submission_id','paper_id']);assert.deepEqual(fk.columnsTo,['id','paper_id']);assert.equal(fk.onDelete,'restrict');
 assert.equal(source.previewMigrationSource().hash,source.PREVIEW_SOURCE_DIGEST);assert.equal(source.workspaceMigrationSource().hash,source.WORKSPACE_SOURCE_DIGEST);assert.equal(before.hash,source.SUPERVISION_SOURCE_DIGEST);
});
test('Main creates and edits paper milestones, while unauthorized scopes and roles fail closed',async()=>{
 const f=fixture();assert.equal((await f.create()).success,true);assert.equal(f.state.rows[0].title,'Manuscript');
 assert.equal((await f.service.mutate({...f.existing('edit'),title:'Final manuscript',dueDate:'2026-11-02'})).success,true);assert.equal(f.state.logs.length,2);
 for(const actor of [null,{userId:2,roleId:2},{userId:5,roleId:1},{userId:3,roleId:3}]){f.state.actor=actor;assert.equal((await f.create()).success,false);}
 f.state.actor={userId:3,roleId:3};assert.equal((await f.service.read({paperId:1})).success,true);assert.equal((await f.service.read({paperId:2})).success,false);f.state.member=false;assert.equal((await f.service.read({paperId:1})).success,false);
});
test('linking Submitted, Under Review or Revision Required evidence never verifies; foreign evidence is denied',async()=>{
 const f=fixture();await f.create();f.state.evidence.push({id:4,version:'v4',status:'Under Review'});
 for(const submissionId of [1,2,4]){f.state.actor={userId:3,roleId:3};assert.equal((await f.service.mutate({...f.existing('link'),submissionId})).success,true);f.state.actor={userId:1,roleId:2};assert.equal((await f.service.mutate(f.existing('verify'))).success,false);assert.equal(f.state.rows[0].verifiedAt,null);}
 f.state.actor={userId:3,roleId:3};assert.equal((await f.service.mutate({...f.existing('link'),submissionId:999})).success,false);
});
test('Approved evidence awaits explicit Main verification and counts only that version',async()=>{
 const f=fixture();await f.create();f.state.actor={userId:3,roleId:3};await f.service.mutate({...f.existing('link'),submissionId:3});
 let result=await f.service.read({paperId:1});assert.equal(view.milestoneStatus(result.data.milestones[0]),'Awaiting verification');assert.equal(view.completedMilestones(result.data.milestones),0);
 assert.equal((await f.service.mutate(f.existing('verify'))).success,false);f.state.actor={userId:1,roleId:2};assert.equal((await f.service.mutate(f.existing('verify'))).success,true);
 f.state.evidence.push({id:9,version:'v5',status:'Submitted'});result=await f.service.read({paperId:1});assert.equal(view.completedMilestones(result.data.milestones),1);assert.equal(result.data.milestones[0].evidence.id,3);assert.equal(view.milestoneStatus(result.data.milestones[0]),'Completed');assert.equal(view.milestoneOverdue(result.data.milestones[0],'2026-12-01'),false);
});
test('relink/edit reset verification, no-op saves preserve it, and stale revisions cannot overwrite new evidence',async()=>{
 const f=fixture();await f.create();f.state.actor={userId:3,roleId:3};await f.service.mutate({...f.existing('link'),submissionId:3});f.state.actor={userId:1,roleId:2};await f.service.mutate(f.existing('verify'));
 const rev=f.state.rows[0].revision;await f.service.mutate({...f.existing('edit'),title:'Manuscript',dueDate:'2026-11-01'});assert.equal(f.state.rows[0].revision,rev);
 f.state.actor={userId:3,roleId:3};await f.service.mutate({...f.existing('link'),submissionId:3});assert.equal(f.state.rows[0].revision,rev);
 const stale=f.existing('link');await f.service.mutate({...stale,submissionId:1});assert.equal(f.state.rows[0].verifiedAt,null);assert.equal((await f.service.mutate({...stale,submissionId:3})).success,false);
 await f.service.mutate({...f.existing('link'),submissionId:3});f.state.actor={userId:1,roleId:2};await f.service.mutate(f.existing('verify'));await f.service.mutate({...f.existing('edit'),title:'Changed',dueDate:'2026-11-01'});assert.equal(f.state.rows[0].verifiedBy,null);
});
test('audit failure rolls back milestone and returns a private-error-free uncertain result',async()=>{
 const f=fixture();f.state.failLog=true;const result=await f.create();assert.equal(result.success,false);assert.equal(f.state.rows.length,0);assert.doesNotMatch(result.message,/PRIVATE/);
});
test('deadline validation, counts, due-today and Manila midnight are deterministic',()=>{
 for(const dueDate of ['2026-02-30','2026-2-01','0000-01-01','2026-01-01T01:00'])assert.equal(progressMutationSchema.safeParse({operation:'create',paperId:1,title:'Valid',dueDate}).success,false);
 assert.equal(progressMutationSchema.safeParse({operation:'create',paperId:1,title:' ',dueDate:'2026-11-01'}).success,false);
 const row={verifiedBy:null,verifiedAt:null,submissionId:null,dueDate:'2026-11-11',evidence:null};assert.equal(view.milestoneStatus(row),'Pending');assert.equal(view.milestoneOverdue(row,'2026-11-11'),false);assert.equal(view.milestoneOverdue(row,'2026-11-12'),true);assert.equal(view.completedMilestones([]),0);assert.equal(view.manilaToday(new Date('2026-11-10T16:00:00Z')),'2026-11-11');
});
test('action refresh failure preserves acknowledged academic success',async()=>{
 let writes=0;const action=load('lib/actions/research-progress.action.ts',{'next/cache':{revalidatePath(){throw Error('cache');}},'@/lib/services/research-progress.service':{mutateResearchProgress:async()=>{writes++;return {success:true,message:'Saved'};}}});
 assert.equal((await action.mutateResearchProgressAction({})).success,true);assert.equal(writes,1);
});
test('0018 orchestration refuses bad source/target/history and validates independent durable preservation',async()=>{
 const {upgradePreview0018}=require('../scripts/preview-progress.ts');const ledger=source.progressMigrationSource().migrations.map(m=>({hash:m.hash,created_at:String(m.folderMillis)}));
 const before={target:'test',empty:false,preservedData:'old',catalog:'before',ledger:ledger.slice(0,18)},after={...before,catalog:'after',ledger};let applied=0,reads=0;
 const io={inspect:async()=>++reads===1?before:after,apply:async()=>{applied++;return 'after';}};
 assert.equal(await upgradePreview0018(io,{execute:true,target:'test',source:source.PROGRESS_SOURCE_DIGEST},source.PROGRESS_SOURCE_DIGEST),'upgraded-0018-confirmed');assert.equal(applied,1);assert.equal(reads,2);
 for(const approval of [{execute:false,target:'test',source:source.PROGRESS_SOURCE_DIGEST},{execute:true,target:'foreign',source:source.PROGRESS_SOURCE_DIGEST},{execute:true,target:'test',source:'bad'}])await assert.rejects(upgradePreview0018({...io,inspect:async()=>before},approval,source.PROGRESS_SOURCE_DIGEST));
 await assert.rejects(upgradePreview0018({...io,inspect:async()=>after},{execute:true,target:'test',source:source.PROGRESS_SOURCE_DIGEST},source.PROGRESS_SOURCE_DIGEST));
 reads=0;await assert.rejects(upgradePreview0018({...io,inspect:async()=>++reads===1?before:{...after,preservedData:'changed'}},{execute:true,target:'test',source:source.PROGRESS_SOURCE_DIGEST},source.PROGRESS_SOURCE_DIGEST));
});

test('real repository SQL pins current authority, membership, paper/evidence and locks submission before paper',async()=>{
 const {drizzle}=require('drizzle-orm/pg-proxy'),schema=require('../db/schema/index.ts');
 const guard=load('lib/repositories/research-supervision.repository.ts',{'@/lib/db':{db:{}}});
 const {createResearchProgressRepository}=load('lib/repositories/research-progress.repository.ts',{'./research-supervision.repository':guard});
 const state={id:3,role:3,active:true,main:1,member:true,groupStatus:'active',queries:[]};
 const db=drizzle(async(query,params)=>{
  state.queries.push({query,params});let row;
  if(query.includes('from "users"'))row={id:state.id,role_id:state.role,is_active:state.active};
  else if(query.includes('from "main_adviser_designation"'))row={main_adviser_id:state.main};
  else if(query.includes('from "research_papers"'))row={group_id:10};
  else if(query.includes('from "research_groups"'))row={id:10,status:state.groupStatus};
  else if(query.includes('from "group_members"'))row=state.member?{id:9}:null;
  else if(query.includes('from "submissions"'))row=params.length===1||params[0]===5?{id:5,status:'Approved'}:null;
  if(!row||!query.startsWith('select'))return {rows:[]};
  const columns=[...query.slice(0,query.indexOf(' from ')).matchAll(/"([a-z_]+)"/g)].map(m=>m[1]);return {rows:[columns.map(c=>row[c]??null)]};
 },{schema});db.transaction=work=>work(db);
 const repo=createResearchProgressRepository(db);
 const result=await repo.withPaper(3,3,1,async scope=>{assert.equal(scope.canManage,false);assert.equal((await scope.evidence(5)).status,'Approved');assert.equal(await scope.evidence(99),undefined);return 'allowed';});assert.equal(result,'allowed');
 const evidence=state.queries.find(q=>q.query.includes('from "submissions"')&&q.params.length===2);assert.deepEqual(evidence.params,[5,1]);assert.match(evidence.query,/"submissions"\."paper_id" = .*for share/);
 const submissionLock=state.queries.findIndex(q=>q.query.includes('from "submissions"')&&q.query.includes('for share')),paperLock=state.queries.findIndex(q=>q.query.includes('from "research_papers"')&&q.query.includes('for share'));assert.ok(submissionLock<paperLock);
 for(const change of [{active:false},{member:false},{groupStatus:'archived'},{role:2}]){const old={...state};Object.assign(state,change);assert.equal(await repo.withPaper(3,3,1,async()=>assert.fail('unauthorized operation')),null);Object.assign(state,old);}
 state.id=1;state.role=2;assert.equal(await repo.withPaper(1,2,1,async scope=>scope.canManage),true);state.main=2;assert.equal(await repo.withPaper(1,2,1,async()=>assert.fail('revoked Main')),null);
});

test('0018 grants are exactly two statements and reject excess privileges or exposure',async()=>{
 const {grantProgressRuntime,verifyProgressRuntime}=require('../scripts/preview-progress.ts');let excess=false,exposed=false;const queries=[];
 const sql=(parts,...params)=>{const text=parts.join('?');queries.push(text);
  if(text.includes('from drizzle.__drizzle_migrations'))return Promise.resolve(source.progressMigrationSource().migrations.map(m=>({hash:m.hash,created_at:String(m.folderMillis)})));
  if(text.includes('as grantable')){const sequence=params[1].endsWith('_seq');return Promise.resolve([{allowed:sequence?params[2]==='USAGE':['SELECT','INSERT','UPDATE'].includes(params[2])||excess&&params[2]==='DELETE',grantable:false}]);}
  if(text.includes('as widened'))return Promise.resolve([{widened:false}]);if(text.includes('as exposed'))return Promise.resolve([{exposed}]);return Promise.resolve([]);
 };
 await grantProgressRuntime(sql);assert.deepEqual(queries.filter(q=>q.startsWith('grant')),['grant select,insert,update on table public.research_milestones to thesishs_preview_runtime','grant usage on sequence public.research_milestones_id_seq to thesishs_preview_runtime']);
 excess=true;await assert.rejects(verifyProgressRuntime(sql,true));excess=false;exposed=true;await assert.rejects(verifyProgressRuntime(sql,true));
});
