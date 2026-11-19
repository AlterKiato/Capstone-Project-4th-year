/* eslint-disable @typescript-eslint/no-require-imports */
// Actual Student action/service/repositories; request identity is injected, data is disposable only.
const assert = require('node:assert/strict'), fs = require('node:fs');
const { AsyncLocalStorage } = require('node:async_hooks'), { randomUUID } = require('node:crypto');
const { drizzle } = require('drizzle-orm/postgres-js'), { migrate } = require('drizzle-orm/postgres-js/migrator');
exports.run = async ({state, root, save, verify, connect}) => {
 require('tsx/cjs');
 const sql = connect(state), runtime = connect(state, state.database, true), actors = new AsyncLocalStorage(), checks=[];
 const check = async (name, work) => { await work(); checks.push(name); console.log('PASS '+name); };
 const as = (id, work) => actors.run(id, work);
 try {
  await verify(sql,state,state.database);
  assert.equal((await sql`select 1 from pg_tables where schemaname='public'`).length,0);
  await migrate(drizzle(sql),{migrationsFolder:'db/migrations'});
  assert.deepEqual((await sql`select hash from drizzle.__drizzle_migrations order by created_at,id`).map(r=>r.hash),require('../scripts/preview-migration-source.ts').coEvaluationMigrationSource().migrations.map(m=>m.hash));
  await sql`insert into role(id,name) values(1,'Admin'),(2,'Adviser'),(3,'Student'),(4,'Panel')`;
  for (const [id,role] of [[1,2],[2,3],[3,3],[4,3],[5,1],[6,4],[7,2]]) await sql`insert into users(id,first_name,last_name,email,password,role_id,is_active) values(${id},'Synthetic',${'E1D '+id},${'e1d-'+id+'@example.invalid'},'not-a-login-hash',${role},true)`;
  await sql`insert into research_groups(id,group_name,strand,section,school_year,adviser_id) values(1,'Disposable E1D A','STEM','A','2026',1),(2,'Disposable E1D B','STEM','B','2026',1)`;
  await sql`insert into group_members(group_id,user_id) values(1,2),(1,3),(2,4)`;
  for(const [id,group] of [[1,1],[2,1],[3,2]]) await sql`insert into research_papers(id,group_id,title,abstract) values(${id},${group},${'Synthetic project '+id},'Synthetic only')`;
  const contexts=[];
  const create = async (size=3, {paperId=1, student=2, version, status='Revision Required', rubric=true, incomplete=false}={}) => {
   const [s]=await sql`insert into submissions(paper_id,submitted_by,version,file_url,status) values(${paperId},${student},${version??'v'+(contexts.length+1)},'research/disposable/never-uploaded.pdf',${status}) returning id,version`;
   const [f]=await sql`insert into feedbacks(submission_id,teacher_id,comments,decision) values(${s.id},1,'Official synthetic narrative',${status==='Approved'?'Approved':'Revision Required'}) returning id`;
   const request={paperId,submissionId:s.id,version:s.version,feedbackId:f.id};contexts.push(request);
   if(rubric){
    const snapshot={name:'Frozen rubric '+size,sourceTemplateId:99,sourceRevision:4,sourceOwnerId:1,scale:{version:1,levels:Array.from({length:size},(_,i)=>({points:i+1,label:'Frozen level '+(i+1),description:'Meaning '+(i+1)}))},criteria:[{key:randomUUID(),position:0,name:'Method',description:'Frozen method',allowsNa:false},{key:randomUUID(),position:1,name:'Evidence',description:'Frozen evidence',allowsNa:true}]};
    const [a]=await sql`insert into submission_evaluation_assignments(submission_id,revision,assigned_by,snapshot) values(${s.id},1,1,${JSON.stringify(snapshot)}::jsonb) returning id`;
    if(!['Submitted','Under Review'].includes(status)){
     const [e]=await sql`insert into submission_evaluations(assignment_id,feedback_id,earned,possible) values(${a.id},${f.id},${size},${size}) returning id`;
     if(!incomplete)for(const [i,c] of snapshot.criteria.entries())await sql`insert into submission_evaluation_items(evaluation_id,criterion_key,rating,na,reason,comment) values(${e.id},${c.key},${i===0?size:null},${i===1},${i===1?'Not used by this method':''},${i===0?'Official criterion comment':''})`;
    }
   }
   return request;
  };
  const history=[];for(const size of [2,3,4,5])history.push(await create(size));
  const pending=await create(3,{status:'Under Review'}),submitted=await create(3,{status:'Submitted'}),narrative=await create(3,{rubric:false}),otherProject=await create(3,{paperId:2,status:'Approved'}),foreign=await create(3,{paperId:3,student:4}),incomplete=await create(3,{incomplete:true});
  await sql`insert into co_adviser_review_assignments(submission_id,co_adviser_id,assigned_by,state,recommendation,completed_at,evaluation_assignment_id,evaluation) select submission_id,7,1,'completed','PRIVATE CO SENTINEL',clock_timestamp(),id,${JSON.stringify({version:1,earned:1,possible:5,items:[{comment:'PRIVATE CO SCORE SENTINEL'}]})}::jsonb from submission_evaluation_assignments where submission_id=${history[0].submissionId}`;
  // A later working generation must never replace the finalized snapshot.
  await sql`insert into submission_evaluation_assignments(submission_id,revision,assigned_by,snapshot) values(${history[0].submissionId},2,1,null)`;
  await sql.unsafe(`create role e1d_runtime login nosuperuser nocreatedb nocreaterole noreplication nobypassrls password '${state.runtimePassword}'`);
  await sql`grant connect on database ${sql(state.database)} to e1d_runtime`;
  await sql`grant usage on schema public to e1d_runtime`;await sql`grant select on all tables in schema public to e1d_runtime`;
  await sql`revoke select on co_adviser_review_assignments,evaluation_templates,evaluation_template_criteria from e1d_runtime`;
  await sql`alter role e1d_runtime set default_transaction_read_only=on`;
  const schema=require('../db/schema/index.ts'),db=drizzle(runtime,{schema});
  const Module=require('node:module'),original=Module._load;
  Module._load=function(id,...rest){if(id==='server-only')return{};if(id==='@/lib/db')return{db};
   if(id==='@/lib/auth/current-account')return{getCurrentAccount:async()=>{const [u]=await runtime`select id,role_id from users where id=${actors.getStore()??0} and is_active`;return u?{userId:u.id,roleId:u.role_id}:null}};
   assert(!/^(dotenv|@supabase\/supabase-js|next\/headers)$/.test(id),'External/session adapter forbidden');return original.call(this,id,...rest);};
  try {
   const {getStudentEvaluationAction:read}=require('../lib/actions/student-evaluation.action.ts');
   const {studentWorkspaceRepository:workspace}=require('../lib/repositories/student-workspace.repository.ts');
   const denied={success:false,message:'Evaluation unavailable. Reload this submission and try again.'};
   await check('Original submitter: frozen 2/3/4/5 scales, ordered criteria, meanings, comments, N/A and totals',async()=>{
    for(const [i,r] of history.entries()){const result=await as(2,()=>read(r));assert(result.success);assert.equal(result.data.version,r.version);assert.equal(result.data.templateName,'Frozen rubric '+(i+2));assert.equal(result.data.templateRevision,4);assert.equal(result.data.earned,i+2);assert.equal(result.data.possible,i+2);assert.deepEqual(result.data.criteria.map(c=>c.name),['Method','Evidence']);assert.equal(result.data.criteria[0].comment,'Official criterion comment');assert.equal(result.data.criteria[1].reason,'Not used by this method');assert.equal(result.data.scale.levels.at(-1).label,'Frozen level '+(i+2));}
   });
   await check('Same-group non-submitter, foreign Student, unauthenticated, Admin, Panel and Advisers uniformly denied',async()=>{for(const id of[3,4,0,1,5,6,7])assert.deepEqual(await as(id,()=>read(history[0])),denied);});
   await check('Exact project/submission/version/feedback; unknown and evaluation-ID enumeration fail safely',async()=>{
    const own=history[0];for(const patch of[{paperId:2},{submissionId:history[1].submissionId},{version:history[1].version},{feedbackId:history[1].feedbackId},{submissionId:2147483647},{evaluationId:1}])assert.deepEqual(await as(2,()=>read({...own,...patch})),denied);
    assert.deepEqual(await as(2,()=>read(foreign)),denied);assert((await as(2,()=>read(otherProject))).success);
   });
   await check('Pending/Submitted assignment-only and incomplete official items expose no scores',async()=>{for(const r of[pending,submitted,incomplete])assert.deepEqual(await as(2,()=>read(r)),denied);});
   await check('Final narrative-only feedback returns authorized null, preserving existing narrative',async()=>{assert.deepEqual(await as(2,()=>read(narrative)),{success:true,data:null});const rows=await workspace.feedback(2,[narrative.submissionId]);assert.equal(rows[0].comments,'Official synthetic narrative');assert.equal(rows[0].evaluationState,'none');});
   await check('Historical official generation retained; private Co and template/assignment ownership absent from payload',async()=>{
    const r=await as(2,()=>read(history[0]));const json=JSON.stringify(r);for(const key of['PRIVATE CO','sourceOwnerId','sourceTemplateId','assignmentId','criterionKey','teacherId','snapshot','revision":2'])assert(!json.includes(key));assert.equal(r.data.templateName,'Frozen rubric 2');
    fs.writeFileSync(root+'/official-result-fixture.json',JSON.stringify(r.data));
   });
   await check('Workspace availability is original-submitter scoped, pending hidden and selected project isolated',async()=>{
    const own=await workspace.feedback(2,contexts.map(c=>c.submissionId));assert.equal(own.find(r=>r.submissionId===pending.submissionId).evaluationState,null);assert.equal(own.find(r=>r.submissionId===history[0].submissionId).evaluationState,'available');assert(!own.some(r=>r.submissionId===foreign.submissionId));assert.equal((await workspace.feedback(3,[history[0].submissionId])).length,0);const rows=await workspace.submissions(2,[2]);assert(rows.every(r=>r.paperId===2));
   });
   await check('Inactive/changed-role/membership-removed actors denied after prior success',async()=>{
    await sql`update users set is_active=false where id=2`;assert.deepEqual(await as(2,()=>read(history[0])),denied);await sql`update users set is_active=true,role_id=1 where id=2`;assert.deepEqual(await as(2,()=>read(history[0])),denied);await sql`update users set role_id=3 where id=2`;await sql`delete from group_members where user_id=2`;assert.deepEqual(await as(2,()=>read(history[0])),denied);
   });
   await check('Reader runtime has read-only transactions and no write grants',async()=>{assert.equal((await runtime`show transaction_read_only`)[0].transaction_read_only,'on');assert.equal((await runtime`select has_table_privilege(current_user,'submissions','UPDATE') as allowed`)[0].allowed,false);});
  }finally{Module._load=original;}
  state.databaseChecks=checks;save(state);fs.writeFileSync(root+'/database-results.json',JSON.stringify({boundary:'Actual action/service/repository against isolated PostgreSQL; injected request principal, no cookie/browser authentication claim',checks},null,2));
 }finally{await runtime.end();await sql.end();}
};
