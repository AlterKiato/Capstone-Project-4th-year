/* eslint-disable @typescript-eslint/no-require-imports */
// Core operator rehearsal only, on the existing fresh, task-owned E1CB fixture cluster.
// Never reads .env/private hosted profiles, never invokes the hosted CLI or changes its pins.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const postgres=require('postgres'),{drizzle}=require('drizzle-orm/postgres-js'),{PgDialect}=require('drizzle-orm/pg-core');
const source=require('../scripts/preview-migration-source.ts');
const op=require('../scripts/initialize-preview-database.ts'),policy=require('../scripts/preview-evaluations.ts');
const {verifyPreviewCatalog}=require('../scripts/preview-schema.ts');
const root=path.resolve('test-results/e1cb'),state=JSON.parse(fs.readFileSync(path.join(root,'current-run.json')));
const phase=process.argv[2];assert.ok(['--capture-contracts','--rehearse','--verify-triggers'].includes(phase));
assert.match(state.run,/^[a-f0-9]{32}$/);assert.equal(state.directory,path.join(root,state.run,'pgdata'));
assert.equal(state.port,55451);assert.equal(state.database,'e1cb_'+state.run);assert.equal(state.operator,'e1cb_operator');
assert.equal(fs.readFileSync(path.join(root,state.run,'owner'),'utf8'),state.run);
assert.equal(fs.realpathSync(path.dirname(state.directory)),path.join(fs.realpathSync(root),state.run));
assert.ok(!['7652422818440234372','7678069749886157684'].includes(state.cluster));
const control=execFileSync('C:/Program Files/PostgreSQL/18/bin/pg_controldata.exe',[state.directory],{encoding:'utf8',windowsHide:true}).match(/Database system identifier:\s*(\d+)/)[1];
assert.equal(control,state.cluster);
const connect=()=>postgres({host:'127.0.0.1',port:state.port,database:state.database,username:state.operator,password:state.operatorPassword,
    ssl:false,max:1,onnotice:()=>{},connect_timeout:5,connection:{statement_timeout:10000,lock_timeout:3000}});
async function identity(sql){const[r]=await sql`select current_database() as database,current_user as actor,host(inet_server_addr()) as address,
    inet_server_port() as port,current_setting('data_directory') as directory,current_setting('listen_addresses') as listen,
    (select system_identifier::text from pg_control_system()) as cluster,(select oid::text from pg_database where datname=current_database()) as oid`;
    assert.equal(r.database,state.database);assert.equal(r.actor,state.operator);assert.equal(r.address,'127.0.0.1');assert.equal(r.port,55451);
    assert.equal(r.listen,'127.0.0.1');assert.equal(path.resolve(r.directory),path.resolve(state.directory));assert.equal(r.cluster,control);assert.equal(r.oid,state.databaseOid);}
const tables=Object.values(source.emailOtpMigrationSource().snapshot.tables).map(t=>t.name).sort();
async function preserve(sql){const rows={};for(const table of tables){const omitted=table==='co_adviser_review_assignments'?['evaluation','evaluation_assignment_id']:[];
    const[r]=await sql`select count(*)::int as count,md5(coalesce(string_agg((to_jsonb(t)-${omitted}::text[])::text,'' order by (to_jsonb(t)-${omitted}::text[])::text),'')) as hash from ${sql(`public.${table}`)} t`;rows[table]={...r};}
    return{rows,relations:await sql`select c.relname,c.relkind,c.relowner::text,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and (c.relname=any(${tables}::text[]) or c.relname in (select indexname from pg_indexes where schemaname='public' and tablename=any(${tables}::text[]))) order by c.relname`,
    columns:(await sql`select table_name,column_name,data_type,is_nullable,column_default from information_schema.columns where table_schema='public' and table_name=any(${tables}::text[]) order by table_name,ordinal_position`).filter(r=>!policy.isEvaluationAddedColumn(r.table_name,r.column_name)),
    constraints:(await sql`select c.relname,k.conname,pg_get_constraintdef(k.oid) as definition,k.convalidated from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(${tables}::text[]) order by c.relname,k.conname`).filter(r=>!policy.isEvaluationAddedConstraint(r.relname,r.conname)),
    sequences:await Promise.all(Object.values(source.emailOtpMigrationSource().snapshot.tables).flatMap(t=>Object.values(t.columns).filter(c=>c.type==='serial').map(async c=>({name:`${t.name}_${c.name}_seq`,rows:await sql`select last_value::text,is_called from ${sql(`public.${t.name}_${c.name}_seq`)}`})))),
    ledger:(await sql`select id,hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id`).slice(0,21)};
}
const plain=x=>JSON.parse(JSON.stringify(x));
async function setup(sql){assert.equal((await sql`select 1 from pg_tables where schemaname='public'`).length,0);
    for(const name of ['thesishs_preview_runtime','anon','authenticated'])await sql`create role ${sql(name)} nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls`;
    const database=drizzle(sql);await new PgDialect().migrate(source.emailOtpMigrationSource().migrations,database._.session,{migrationsFolder:'db/migrations'});
    await sql`insert into role(id,name) values(1,'Admin'),(2,'Adviser'),(3,'Student'),(4,'Panel')`;
    for(const[id,role]of[[1,1],[2,2],[3,3],[4,2]])await sql`insert into users(id,first_name,last_name,email,password,role_id) values(${id},'Synthetic','Sentinel',${'e1pp4a-'+id+'@example.invalid'},'not-a-login-secret',${role})`;
    await sql`update main_adviser_designation set main_adviser_id=2,updated_by=1,revision=1 where id=1`;
    await sql`insert into research_groups(id,group_name,strand,section,school_year,adviser_id) values(1,'Disposable operator fixture','STEM','A','2026',2)`;
    await sql`insert into group_members(group_id,user_id) values(1,3)`;
    await sql`insert into research_papers(id,group_id,title,abstract,status) values(1,1,'Disposable sentinel','Synthetic','Under Review')`;
    await sql`insert into submissions(id,paper_id,submitted_by,version,file_url,status) values(1,1,3,'v1','disposable/never-uploaded.pdf','Under Review')`;
    await sql`insert into feedbacks(submission_id,teacher_id,comments,decision) values(1,2,'Historical synthetic feedback','Revision Required')`;
    await sql`insert into co_adviser_review_assignments(submission_id,co_adviser_id,assigned_by,state,recommendation,completed_at) values(1,4,2,'completed','Historical synthetic private narrative',clock_timestamp())`;
}
async function locked(sql,work){return sql.begin(async tx=>{await tx`set local search_path=public`;await tx`select pg_advisory_xact_lock(1296388937,15)`;
    await tx`lock table drizzle.__drizzle_migrations in share row exclusive mode`;for(const name of tables)await tx`lock table ${tx(`public.${name}`)} in share mode`;return work(tx);});}
async function main(){const sql=connect(),checks=[];try{await identity(sql);
    if(phase==='--verify-triggers'){
        source.verifyEvaluationLedger(await sql`select id,hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id`,24);
        for(const table of policy.IMMUTABLE_TABLES)for(const action of ['update','delete']){
            await assert.rejects(sql.begin(async tx=>{
                await tx`insert into submission_evaluation_assignments(id,submission_id,revision,assigned_by) values(1000001,1,1,2)`;
                await tx`insert into submission_evaluations(id,assignment_id,feedback_id,earned,possible) values(1000001,1000001,1,1,1)`;
                await tx`insert into submission_evaluation_items(evaluation_id,criterion_key,rating,na,reason,comment) values(1000001,'11111111-1111-4111-8111-111111111111',1,false,'','')`;
                await tx.unsafe(action==='delete'?`delete from public.${table}`:`update public.${table} set ${table==='submission_evaluation_assignments'?'revision=revision':table==='submission_evaluations'?'earned=earned':'comment=comment'}`);
            }),e=>e.code==='23514');
        }
        await assert.rejects(sql.begin(tx=>tx`truncate table public.submission_evaluation_items`),e=>e.code==='23514');
        for(const table of policy.EVALUATION_TABLES)assert.equal((await sql`select count(*)::int as count from ${sql(`public.${table}`)}`)[0].count,0);
        for(const sequence of policy.EVALUATION_SEQUENCES){const[r]=await sql`select last_value::text as value,is_called from ${sql(`public.${sequence}`)}`;assert.equal(r.value,'1');assert.equal(r.is_called,false);}
        await verifyPreviewCatalog(sql,'co-evaluation-installed');await policy.verifyEvaluationRuntime(sql,true);
        fs.writeFileSync('test-results/e1p-p4a/triggers.json',JSON.stringify({result:'PASS',checks:['All three immutable tables reject UPDATE and DELETE with 23514','TRUNCATE rejected with 23514','All temporary synthetic rows rolled back; new sequences remain unused'],hostedConnection:false},null,2)+'\n');
        console.log('PASS: six row-mutation and one statement-mutation trigger checks; synthetic rows rolled back.');return;
    }
    if(phase==='--capture-contracts'){
        const existing=await sql`select 1 from pg_tables where schemaname='public'`;
        if(!existing.length)await setup(sql);
        else assert.equal((await sql`select count(*)::int as count from users where id=3 and email='e1pp4a-3@example.invalid'`)[0].count,1,'Only this exact owned sentinel fixture may resume');
    }
    const baseline=plain(await preserve(sql));const ledger=await sql`select id,hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id`;source.verifyEvaluationLedger(ledger,21);
    await verifyPreviewCatalog(sql,'otp-installed');checks.push('fresh disposable identity and exact 0020 predecessor catalog');
    if(phase==='--capture-contracts'){
        await assert.rejects(locked(sql,async tx=>{await tx`create function public.prevent_submission_evaluation_mutation() returns trigger language plpgsql as 'begin return new; end;'`;await op.applyPreviewMigrations(tx,sql.options,'evaluation');}),e=>e.cause?.code==='42723'||e.code==='42723');
        assert.deepEqual(plain(await preserve(sql)),baseline);assert.equal((await sql`select to_regprocedure('public.prevent_submission_evaluation_mutation()') as value`)[0].value,null);
        checks.push('real 0022 duplicate-function error rolls back 0021/0022 DDL and ledger without retry');
        await assert.rejects(locked(sql,async tx=>{await op.applyPreviewMigrations(tx,sql.options,'evaluation');
            const checks=await tx`select conname,pg_get_constraintdef(oid) as definition from pg_constraint where connamespace='public'::regnamespace and contype='c' order by conname`;
            const priorNames=new Set(Object.values(source.emailOtpMigrationSource().snapshot.tables).flatMap(t=>Object.keys(t.checkConstraints)));
            fs.writeFileSync('test-results/e1p-p4a/evaluation-check-contracts.json',JSON.stringify(Object.fromEntries(checks.filter(r=>!priorNames.has(r.conname)).map(r=>[r.conname,r.definition])),null,2)+'\n');
            throw Error('intentional isolated contract-capture rollback');}),/intentional isolated/);
        assert.deepEqual(plain(await preserve(sql)),baseline);await verifyPreviewCatalog(sql,'otp-installed');checks.push('all-three-migration rollback preserves baseline');
    }else{
        await locked(sql,async tx=>{await op.applyPreviewMigrations(tx,sql.options,'evaluation');await policy.grantEvaluationRuntime(tx);
            await verifyPreviewCatalog(tx,'co-evaluation-installed');assert.deepEqual(plain(await preserve(tx)),baseline);});
        checks.push('same installed Drizzle/savepoint path applies only 0021–0023 with locks, exact catalog and minimum grants');
        const fresh=connect();try{await identity(fresh);source.verifyEvaluationLedger(await fresh`select id,hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id`,24);
            await verifyPreviewCatalog(fresh,'co-evaluation-installed');await policy.verifyEvaluationRuntime(fresh,true);assert.deepEqual(plain(await preserve(fresh)),baseline);
            const[row]=await fresh`select evaluation,evaluation_assignment_id from co_adviser_review_assignments where id=1`;assert.equal(row.evaluation,null);assert.equal(row.evaluation_assignment_id,null);
            await assert.rejects(locked(fresh,tx=>op.applyPreviewMigrations(tx,fresh.options,'evaluation')),/ledger/);
            checks.push('independent reconnect verifies 24-entry state, history/catalog/ACL/sequence preservation and replay refusal');
            for(const mutation of ['disable trigger submission_evaluations_immutable','disable trigger submission_evaluations_no_truncate']){
                await assert.rejects(fresh.begin(async tx=>{await tx.unsafe('alter table public.submission_evaluations '+mutation);await verifyPreviewCatalog(tx,'co-evaluation-installed');}));
            }
            await assert.rejects(fresh.begin(async tx=>{await tx`grant update on submission_evaluations to thesishs_preview_runtime`;await policy.verifyEvaluationRuntime(tx,true);}));
            await assert.rejects(fresh.begin(async tx=>{await tx`grant execute on function public.prevent_submission_evaluation_mutation() to public`;await policy.verifyEvaluationRuntime(tx,true);}));
            await assert.rejects(fresh.begin(async tx=>{await tx`alter table co_adviser_review_assignments drop constraint co_recommendation_exact_evaluation_fk`;await verifyPreviewCatalog(tx,'co-evaluation-installed');}));
            await verifyPreviewCatalog(fresh,'co-evaluation-installed');await policy.verifyEvaluationRuntime(fresh,true);
            checks.push('disabled triggers, missing exact-version FK, excessive runtime UPDATE and PUBLIC function exposure rejected and rolled back');
        }finally{await fresh.end();}
    }
    const receipt={result:'PASS',phase,disposable:{database:state.database,cluster:state.cluster,port:state.port},checks,hostedConnection:false};
    fs.writeFileSync('test-results/e1p-p4a/'+(phase==='--capture-contracts'?'capture':'rehearsal')+'.json',JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));
}finally{await sql.end();}}
main().catch(e=>{console.error(JSON.stringify({result:'FAIL',phase,code:e.code??e.name,assertion:e.operator??null,message:e instanceof assert.AssertionError?e.message:String(e.message).startsWith('Preview')?e.message:'Disposable rehearsal failed; raw SQL/parameters suppressed'}));process.exitCode=1;});
