/* eslint-disable @typescript-eslint/no-require-imports */
// Explicit, isolated test entry point. Fixed loopback port; verifies owned disposable
// data_directory and server identity BEFORE creating its uniquely named test database.
// No .env files, existing app database, hosted services, Storage or providers.
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),Module=require('node:module');
const postgres=require('postgres'),{drizzle}=require('drizzle-orm/postgres-js'),{migrate}=require('drizzle-orm/postgres-js/migrator');
const {eq}=require('drizzle-orm'),{randomUUID}=require('node:crypto');
const schema=require('../db/schema/index.ts');
const target={host:'127.0.0.1',port:55439,username:'r2_disposable',database:'postgres',max:4,onnotice:()=>{},connection:{statement_timeout:10000,lock_timeout:4000}};
async function verify(sql){const [id]=await sql`select current_user as actor,host(inet_server_addr()) as address,inet_server_port() as port,current_setting('data_directory') as directory,current_setting('listen_addresses') as listen`;
 assert.equal(id.actor,'r2_disposable');assert.equal(id.address,'127.0.0.1');assert.equal(id.port,55439);assert.equal(id.listen,'127.0.0.1');assert.equal(path.resolve(id.directory).toLowerCase(),path.resolve('test-results/r2/pgdata').toLowerCase());}
async function main(){const admin=postgres(target);let sql,original;
 try{
 await verify(admin);const name='r2_'+randomUUID().replaceAll('-','');await admin`create database ${admin(name)}`;
 sql=postgres({...target,database:name});await verify(sql);const db=drizzle(sql,{schema});await migrate(db,{migrationsFolder:'db/migrations'});
 original=Module._load;Module._load=function(id,...args){if(id==='server-only')return {};if(id==='@/lib/db')return {db};if(id==='@/lib/auth/current-account')return {getCurrentAccount:async()=>null};assert.ok(!/^(dotenv|@supabase\/supabase-js)$/.test(id),'Live adapter forbidden');return original.call(this,id,...args);};
 const {verifyPreviewCatalog}=require('../scripts/preview-schema.ts');await verifyPreviewCatalog(sql,'upgrade-0019');
 const source=require('../scripts/preview-migration-source.ts');source.verifyRevisionLedger(await sql`select id,hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id`,20);
 const {persistAdviserDecision}=require('../lib/repositories/feedback.repository.ts');
 const {createRevisionRepository}=require('../lib/repositories/revision.repository.ts');const {createSubmission,withPaperSubmissionLock}=require('../lib/repositories/submission.repository.ts');
 const {createSubmissionUploadRepository}=require('../lib/repositories/submission-upload.repository.ts');const {createRevisionService}=require('../lib/services/revision.service.ts');
 const {users,researchGroups:groups,researchPapers:papers,submissions,feedbacks,revisionItems:items,revisionResponses:responses,coAdviserReviewAssignments:assignments}=schema;
 await db.insert(schema.role).values([{id:1,name:'Admin'},{id:2,name:'Adviser'},{id:3,name:'Student'},{id:4,name:'Panel'}]);
 const account=(id,roleId)=>({id,roleId,firstName:'Synthetic',lastName:'R2 '+id,email:'r2-'+id+'@example.invalid',password:'synthetic-not-a-login'});
 await db.insert(users).values([account(1,2),account(2,2),account(3,3),account(4,3),account(5,1),account(6,4),account(7,3)]);
 await db.update(schema.mainAdviserDesignation).set({mainAdviserId:1,updatedBy:5,revision:1}).where(eq(schema.mainAdviserDesignation.id,1));
 await db.insert(groups).values([{id:1,groupName:'R2 disposable group',strand:'TEST',section:'TEST',schoolYear:'2026',adviserId:1},{id:2,groupName:'Foreign disposable group',strand:'TEST',section:'TEST',schoolYear:'2026',adviserId:2}]);
 await db.insert(schema.groupMembers).values([{groupId:1,userId:3},{groupId:1,userId:4},{groupId:2,userId:7}]);
 await db.insert(papers).values([{id:1,groupId:1,title:'R2 disposable research',abstract:'Synthetic only'},{id:2,groupId:2,title:'Foreign disposable research',abstract:'Synthetic only'},{id:3,groupId:1,title:'Second disposable research',abstract:'Synthetic only'}]);
 const [v1]=await db.insert(submissions).values({paperId:1,submittedBy:3,version:'v1',fileUrl:'synthetic/no-storage.pdf',status:'Under Review'}).returning();
 await db.insert(assignments).values({submissionId:v1.id,coAdviserId:2,assignedBy:1});
 const decision=(submissionId,paperId=1,teacherId=1,revisionItems=[{correction:'Explain sampling',reference:'Section 3'},{correction:'Check citations',reference:''}],status='Revision Required')=>persistAdviserDecision({submissionId,paperId,teacherId,comments:'Synthetic official feedback',decision:status,revisionItems,expectedSubmissionStatus:'Under Review',researchStatus:status,activityAction:'R2 test decision',activityDescription:'Disposable only'});
 const repo=createRevisionRepository(db),as=(userId,roleId)=>createRevisionService(repo,async()=>({userId,roleId}));
 assert.equal(await decision(v1.id,1,2),null);assert.equal((await as(3,3).read({paperId:1})).data.cycles.length,0);
 await sql`alter table public.revision_items add constraint r2_injected_failure check (correction <> 'INJECT FAILURE')`;
 await assert.rejects(decision(v1.id,1,1,[{correction:'INJECT FAILURE',reference:''}]));
 assert.equal((await db.select().from(feedbacks)).length,0);assert.equal((await db.select().from(items)).length,0);assert.equal((await db.select().from(submissions))[0].status,'Under Review');assert.equal((await db.select().from(assignments))[0].state,'open');
 await sql`alter table public.revision_items drop constraint r2_injected_failure`;
 for(const name of ['anon','authenticated','thesishs_preview_runtime']){
  const exists=await sql`select 1 from pg_roles where rolname=${name}`;
  if(!exists.length)await sql`create role ${sql(name)} nologin`;
 }
 const {grantRevisionRuntime}=require('../scripts/preview-revisions.ts');await grantRevisionRuntime(sql);
 const feedback=await decision(v1.id);assert.ok(feedback);assert.equal((await db.select().from(assignments))[0].state,'closed');
 const history=await db.select().from(feedbacks);const corrections=await db.select().from(items);assert.equal(corrections.length,2);
 await assert.rejects(sql.begin(async tx=>{await tx`set local role thesishs_preview_runtime`;await tx`update public.revision_items set correction='forbidden' where id=${corrections[0].id}`;}),error=>error.code==='42501');
 for(const [id,role]of [[2,2],[5,1],[6,4],[7,3]]){assert.equal((await as(id,role).read({paperId:1})).success,false);}
 assert.equal((await as(3,3).read({paperId:2})).success,false);assert.equal((await as(1,2).respond({paperId:1,itemId:corrections[0].id,expectedRevision:0,actionTaken:'No'})).success,false);
 const save=(id,itemId,revision,text)=>as(id,3).respond({paperId:1,itemId,expectedRevision:revision,actionTaken:text});
 let result=await save(3,corrections[0].id,0,'Expanded methods');assert.equal(result.success,true);assert.equal(result.data.cycles[0].items[0].responses[0].actionTaken,'Expanded methods');
 assert.equal((await save(3,corrections[0].id,0,'stale overwrite')).success,false);
 assert.equal((await save(4,corrections[0].id,0,'Another member action')).success,true);assert.equal((await as(3,3).read({paperId:1})).data.cycles[0].items[0].responses.length,1);assert.equal((await as(1,2).read({paperId:1})).data.cycles[0].items[0].responses.length,2);
 assert.equal((await save(3,corrections[0].id,1,'')).success,true);assert.equal((await db.select().from(responses).where(eq(responses.studentId,3)))[0].actionTaken,'');
 await sql`alter table public.activity_logs add constraint r2_injected_audit_failure check (action <> 'Revision Action Taken Saved') not valid`;
 assert.equal((await save(3,corrections[0].id,2,'Must roll back with audit')).success,false);assert.equal((await db.select().from(responses).where(eq(responses.studentId,3)))[0].revision,2);
 await sql`alter table public.activity_logs drop constraint r2_injected_audit_failure`;
 const concurrent=await Promise.all([save(3,corrections[0].id,2,'Winner A'),save(3,corrections[0].id,2,'Winner B')]);assert.equal(concurrent.filter(r=>r.success).length,1);
 await sql`alter table public.revision_responses add constraint r2_injected_snapshot_failure check (frozen_by_submission_id is null)`;
 await assert.rejects(withPaperSubmissionLock(1,tx=>createSubmission({paperId:1,submittedBy:3,version:'v2',fileUrl:'synthetic/rollback.pdf'},tx)));
 assert.equal((await db.select().from(submissions).where(eq(submissions.paperId,1))).length,1);assert.ok((await db.select().from(responses)).every(r=>r.frozenBySubmissionId===null));
 await sql`alter table public.revision_responses drop constraint r2_injected_snapshot_failure`;
 // Force submission to hold the shared advisory lock; a queued response must recheck the latest version.
 let unlock,entered;const gate=new Promise(r=>unlock=r),locked=new Promise(r=>entered=r);
 const upload=withPaperSubmissionLock(1,async tx=>{entered();await gate;return createSubmission({paperId:1,submittedBy:3,version:'v2',fileUrl:'synthetic/no-storage-v2.pdf'},tx);});await locked;
 const queued=save(3,corrections[1].id,0,'Must not save after submission');unlock();const v2=await upload;assert.equal((await queued).success,false);
 const frozen=await db.select().from(responses);assert.ok(frozen.every(r=>r.frozenBySubmissionId===v2.id));assert.equal((await save(3,corrections[0].id,3,'overwrite')).success,false);
 assert.deepEqual(await db.select().from(items),corrections);assert.deepEqual(await db.select().from(feedbacks),history);
 await db.update(submissions).set({status:'Under Review'}).where(eq(submissions.id,v2.id));await decision(v2.id,1,1,[{correction:'New cycle',reference:'p. 5'}]);
 const newer=(await db.select().from(items)).find(r=>r.feedbackId!==feedback.id);assert.equal((await save(3,newer.id,0,'New response')).success,true);
 // Direct-upload finalization path uses its existing lock/transaction and the same snapshot helper.
 const uploads=createSubmissionUploadRepository(db);const v3=await uploads.locked(3,1,tx=>tx.submit({finalPath:'synthetic/no-storage-v3.pdf',remarks:null},'v3'));
 assert.ok(v3);assert.equal((await db.select().from(responses).where(eq(responses.itemId,newer.id)))[0].frozenBySubmissionId,v3.id);
 // Approved never publishes attached Revision Required drafts.
 const [approved]=await db.insert(submissions).values({paperId:3,submittedBy:3,version:'v1',fileUrl:'synthetic/approved.pdf',status:'Under Review'}).returning();
 const count=(await db.select().from(items)).length;await decision(approved.id,3,1,[{correction:'Do not publish',reference:''}],'Approved');assert.equal((await db.select().from(items)).length,count);
 await db.update(users).set({isActive:false}).where(eq(users.id,3));assert.equal((await as(3,3).read({paperId:1})).success,false);
 const resultFile={result:'PASS',database:name,loopback:true,port:55439,disposable:true,ledger:20,realPostgres:true,checks:['migration and canonical catalog','minimum grants and immutable corrections','atomic correction/decision/delegation rollback','Main/Co/Student/Admin/Panel/cross-group denial','own-member responses','save/clear/stale concurrent save','response audit and submission snapshot rollback','submission-versus-response scheduling','both submission freeze paths','immutable version history','Approved draft exclusion','account revocation']};
 fs.writeFileSync('test-results/r2/postgres-result.json',JSON.stringify(resultFile,null,2));console.log('PASS R2 disposable PostgreSQL: '+resultFile.checks.join('; ')+'. No existing/hosted database, Storage or provider access.');
 }finally{if(original)Module._load=original;await sql?.end({timeout:2});await admin.end({timeout:2});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
