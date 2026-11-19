/* eslint-disable @typescript-eslint/no-require-imports */
// E1C-L preparation only. Import is inert. --execute requires a SEPARATELY authorized owner checkpoint.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {lookup}=require('node:dns/promises'),{execFileSync}=require('node:child_process');
const {createHash,randomUUID}=require('node:crypto'),postgres=require('postgres');
const {drizzle}=require('drizzle-orm/postgres-js'),{PgDialect}=require('drizzle-orm/pg-core');
const {localConfiguration,expectedObjects}=require('./migrate-local-evaluation-templates.cjs');
const {verifyLocalIdentity}=require('./migrate-local-workspace.ts');
const {privateFile}=require('./upload-acceptance-safety.ts');
const {catalogDefault,catalogIndex,catalogCheck}=require('./preview-catalog-contract.ts');
const sources=require('./preview-migration-source.ts');
const TARGET='8be02ccf26465e24fe4daa24fb5adbf11ca3283956a0d242e6a4b43b4ebd6079';
const SOURCE='f0140057433afdfb912e6da5d785086d16872eb2197de084b7e5e6ed49379f16';
const MIGRATIONS=['6eede979948ac7cb2476b479c8a756101073e92a0e8d382120e2677afdfb3c24','86619dfff7d6caf9b7d862799d3450266e8f250c7a15f98f7c22cb7aed2f2889'];
// Filled from the source-reviewed, read-only local catalog preflight. No row values are pinned here.
const BASELINE_CATALOG='fb9c71ebaab211ff9a05f51519d1e97ca98967a8e2969653bda64d6af29f4017';
const NEW=['submission_evaluation_assignments','submission_evaluations','submission_evaluation_items'];
const CO_COLUMNS=['evaluation_assignment_id','evaluation'];
const CO_CONSTRAINTS=['co_recommendation_exact_evaluation_fk','co_recommendation_evaluation_check'];
const bin='C:/Program Files/PostgreSQL/18/bin';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const bytesHash=x=>createHash('sha256').update(x).digest('hex');
const name63=x=>x.slice(0,63);
function pending(){
 const s=sources.coEvaluationMigrationSource();assert.equal(s.hash,SOURCE);assert.equal(s.migrations.length,24);
 const journal=JSON.parse(fs.readFileSync('db/migrations/meta/_journal.json','utf8'));
 assert.deepEqual(journal.entries.slice(22).map(e=>e.tag),['0022_submission_evaluation','0023_co_adviser_evaluation']);
 assert.equal(journal.entries[22].idx,22);assert.equal(journal.entries[23].idx,23);assert(journal.entries[22].when<journal.entries[23].when);
 const snapshot22=JSON.parse(fs.readFileSync('db/migrations/meta/0022_snapshot.json','utf8'));
 assert.equal(s.snapshot.prevId,snapshot22.id);
 const rows=s.migrations.slice(22);assert.deepEqual(rows.map(r=>r.hash),MIGRATIONS);assert.equal(rows.length,2);
 return rows;
}
function argumentsFor(args){
 if(args.length===1&&args[0]==='--inspect')return false;
 if(args.length===3&&args[0]==='--verify-installed'&&args[1]==='--evidence'){assert(path.isAbsolute(args[2]));return 'installed';}
 assert.deepEqual(args,['--execute','--confirm-target',TARGET,'--confirm-source',SOURCE]);return true;
}
function ledgerMatches(ledger,count){
 assert([22,24].includes(count));assert.equal(ledger.length,count);const source=sources.coEvaluationMigrationSource();
 for(const[r,i]of ledger.map((r,i)=>[r,i])){assert.equal(r.hash,source.migrations[i].hash);assert.equal(r.created_at,String(source.migrations[i].folderMillis));assert(Number.isSafeInteger(r.id)&&r.id>0&&(i===0||r.id>ledger[i-1].id));}
}
async function identity(tx,c){
 const [i]=await tx`select current_database() as database,current_user as username,session_user as login,host(inet_server_addr()) as address,inet_server_port() as port,
 (select oid::text from pg_database where datname=current_database()) as oid,(select system_identifier::text from pg_control_system()) as cluster,
 (select pg_get_userbyid(datdba) from pg_database where datname=current_database()) as owner,(select rolsuper from pg_roles where rolname=current_user) as superuser`;
 verifyLocalIdentity(i);
 const target=digest({endpoint:c.endpoint,marker:c.identity,identity:{database:i.database,oid:i.oid,cluster:i.cluster,address:i.address,port:i.port,username:i.username,login:i.login,owner:i.owner}});
 assert.equal(target,TARGET);return i;
}
async function catalog(tx){
 const relations=await tx`select c.relname as name,c.relkind::text as kind,pg_get_userbyid(c.relowner) as owner,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity,c.relpersistence,c.relreplident from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e') order by c.relname`;
 const columns=await tx`select c.relname,a.attname as name,a.attnum,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull as required,a.attidentity,a.attgenerated,a.attcollation::text,pg_get_expr(d.adbin,d.adrelid) as value from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='public' and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum`;
 const constraints=await tx`select c.relname,k.conname as name,k.contype as type,k.convalidated,coalesce((to_jsonb(k)->>'conenforced')::boolean,true) as enforced,k.condeferrable,k.condeferred,k.confdeltype,k.confupdtype,k.confmatchtype,f.relname as target,fn.nspname as target_schema,pg_get_constraintdef(k.oid) as definition,
 array(select a.attname from unnest(k.conkey) with ordinality x(num,ord) join pg_attribute a on a.attrelid=k.conrelid and a.attnum=x.num order by x.ord) as columns,
 array(select a.attname from unnest(k.confkey) with ordinality x(num,ord) join pg_attribute a on a.attrelid=k.confrelid and a.attnum=x.num order by x.ord) as referenced
 from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace left join pg_class f on f.oid=k.confrelid left join pg_namespace fn on fn.oid=f.relnamespace where n.nspname='public' order by c.relname,k.conname`;
 const indexes=await tx`select p.tablename,p.indexname,p.indexdef,i.indisvalid,i.indisready,i.indislive,i.indimmediate from pg_indexes p join pg_class c on c.relname=p.indexname and c.relnamespace='public'::regnamespace join pg_index i on i.indexrelid=c.oid where p.schemaname='public' order by p.tablename,p.indexname`;
 const routines=await tx`select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,pg_get_function_result(p.oid) as result,p.prosrc,p.proconfig,p.prosecdef,p.proacl::text,pg_get_userbyid(p.proowner) as owner,l.lanname from pg_proc p join pg_language l on l.oid=p.prolang where p.pronamespace='public'::regnamespace and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e') order by p.proname,p.oid`;
 const triggers=await tx`select c.relname,t.tgname,t.tgenabled,t.tgtype,p.proname,pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid where c.relnamespace='public'::regnamespace and not t.tgisinternal order by c.relname,t.tgname`;
 const extras=await tx`select exists(select 1 from pg_type where typnamespace='public'::regnamespace and typtype in ('d','e','r','m')) as custom_types,exists(select 1 from pg_rewrite r join pg_class c on c.oid=r.ev_class where c.relnamespace='public'::regnamespace and r.rulename<>'_RETURN') as rules,exists(select 1 from pg_policy p join pg_class c on c.oid=p.polrelid where c.relnamespace='public'::regnamespace) as policies`;
 assert.deepEqual({...extras[0]},{custom_types:false,rules:false,policies:false});
 return{relations,columns,constraints,indexes,routines,triggers};
}
function shape(actual,snapshot){
 assert.deepEqual(actual.relations.map(r=>r.name+':'+r.kind).sort(),expectedObjects(snapshot));
 for(const t of Object.values(snapshot.tables)){
 const cols=actual.columns.filter(r=>r.relname===t.name),cs=actual.constraints.filter(r=>r.relname===t.name&&r.type!=='n'),ix=actual.indexes.filter(r=>r.tablename===t.name);
 assert.deepEqual(cols.map(c=>c.name).sort(),Object.keys(t.columns).sort());
 for(const c of Object.values(t.columns)){const a=cols.find(a=>a.name===c.name);assert.equal(a.type,c.type==='serial'?'integer':c.type==='timestamp'?'timestamp without time zone':c.type.replace(/^varchar/,'character varying'));assert.equal(a.required,c.notNull);assert.equal(a.attidentity,'');assert.equal(a.attgenerated,'');assert.equal(a.value,c.type==='serial'?"nextval('"+t.name+'_'+c.name+"_seq'::regclass)":catalogDefault(c));}
 const primary=Object.values(t.columns).filter(c=>c.primaryKey).map(c=>c.name);
 const wanted=[...Object.keys(t.foreignKeys),...Object.keys(t.uniqueConstraints),...Object.keys(t.compositePrimaryKeys),...Object.keys(t.checkConstraints),...(primary.length?[t.name+'_pkey']:[])].map(name63).sort();
 assert.deepEqual(cs.map(c=>c.name).sort(),wanted);assert(cs.every(c=>c.convalidated&&c.enforced&&!c.condeferrable&&!c.condeferred));
 if(primary.length)assert.deepEqual(cs.find(c=>c.type==='p').columns,primary);
 for(const [kind,items]of [['p',t.compositePrimaryKeys],['u',t.uniqueConstraints]])for(const item of Object.values(items)){const c=cs.find(c=>c.name===name63(item.name));assert.equal(c.type,kind);assert.deepEqual(c.columns,item.columns);}
 for(const fk of Object.values(t.foreignKeys)){const c=cs.find(c=>c.name===name63(fk.name)),action={'restrict':'r','no action':'a','cascade':'c','set null':'n','set default':'d'};assert.equal(c.type,'f');assert.equal(c.target,fk.tableTo);assert.equal(c.target_schema,'public');assert.equal(c.confdeltype,action[fk.onDelete??'no action']);assert.equal(c.confupdtype,action[fk.onUpdate??'no action']);assert.equal(c.confmatchtype,'s');assert.deepEqual(c.columns,fk.columnsFrom);assert.deepEqual(c.referenced,fk.columnsTo);}
 for(const name of Object.keys(t.checkConstraints)){const c=cs.find(c=>c.name===name63(name));assert.equal(c.type,'c');
 // Existing finite CHECK contract is reused. New E1B/E1C checks are covered by the pinned baseline or exact migration plus durable catalog fingerprint.
 if(!name.startsWith('evaluation_template')&&!name.startsWith('submission_evaluation')&&!name.startsWith('co_recommendation'))assert.equal(c.definition,catalogCheck(name));}
 assert.deepEqual(ix.map(i=>i.indexname).sort(),[...Object.keys(t.indexes),...cs.filter(c=>['p','u'].includes(c.type)).map(c=>c.name)].map(name63).sort());assert(ix.every(i=>i.indisvalid&&i.indisready&&i.indislive&&i.indimmediate));
 for(const i of Object.values(t.indexes))assert.equal(ix.find(a=>a.indexname===name63(i.name)).indexdef,catalogIndex(t.name,i));
 const security=actual.relations.find(r=>r.name===t.name);assert(!security.relrowsecurity&&!security.relforcerowsecurity);assert.equal(security.kind,'r');
 }
}
function legacyCatalog(actual){
 const names=new Set(Object.values(sources.evaluationTemplateMigrationSource().snapshot.tables).map(t=>t.name));
 const objects=new Set(expectedObjects(sources.evaluationTemplateMigrationSource().snapshot).map(x=>x.split(':')[0]));
 return{relations:actual.relations.filter(r=>objects.has(r.name)),columns:actual.columns.filter(r=>names.has(r.relname)&&!(r.relname==='co_adviser_review_assignments'&&CO_COLUMNS.includes(r.name))),
 constraints:actual.constraints.filter(r=>names.has(r.relname)&&!(r.relname==='co_adviser_review_assignments'&&CO_CONSTRAINTS.includes(r.name))),indexes:actual.indexes.filter(r=>names.has(r.tablename)),routines:actual.routines.filter(r=>r.proname!=='prevent_submission_evaluation_mutation'),triggers:actual.triggers.filter(r=>names.has(r.relname))};
}
async function capture(tx,c,count,requireCatalogPin=true){
 pending();const observed=await identity(tx,c);const ledger=Array.from(await tx`select id,hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id`);ledgerMatches(ledger,count);
 const snapshot=count===22?sources.evaluationTemplateMigrationSource().snapshot:sources.coEvaluationMigrationSource().snapshot;
 const actual=await catalog(tx);shape(actual,snapshot);
 if(count===22){assert.equal(actual.routines.length,0);assert.equal(actual.triggers.length,0);}else{
 assert.equal(actual.routines.length,1);const f=actual.routines[0];assert.equal(f.proname,'prevent_submission_evaluation_mutation');assert.equal(f.result,'trigger');assert.equal(f.arguments,'');assert.equal(f.owner,'postgres');assert.equal(f.lanname,'plpgsql');assert.equal(f.prosecdef,false);assert.equal(f.proacl,null);assert.deepEqual(f.proconfig,['search_path=pg_catalog']);assert.equal(f.prosrc,pending()[0].sql.join('\n').match(/AS \$\$([\s\S]*?)\$\$/)[1]);
 assert.equal(actual.triggers.length,6);for(const name of NEW){const rows=actual.triggers.filter(t=>t.relname===name);assert.deepEqual(rows.map(t=>t.tgname).sort(),[name+'_immutable',name+'_no_truncate'].sort());assert(rows.every(t=>t.tgenabled==='O'&&t.proname===f.proname));assert.equal(rows.find(t=>t.tgname.endsWith('_immutable')).tgtype,27);assert.equal(rows.find(t=>t.tgname.endsWith('_no_truncate')).tgtype,34);}
 }
 const permissions={schemas:await tx`select nspname,pg_get_userbyid(nspowner) as owner,nspacl::text from pg_namespace where nspname in ('public','drizzle') order by nspname`,database:await tx`select datacl::text from pg_database where datname=current_database()`,defaults:await tx`select defaclrole::regrole::text,defaclnamespace::regnamespace::text,defaclobjtype,defaclacl::text from pg_default_acl order by oid`,roles:await tx`select rolname,rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls from pg_roles order by rolname`,memberships:await tx`select roleid::regrole::text as role,member::regrole::text as member,admin_option,inherit_option,set_option from pg_auth_members order by roleid,member`};
 const sequences={};for(const s of await tx`select sequencename,start_value::text,min_value::text,max_value::text,increment_by::text,cycle,cache_size::text,sequenceowner from pg_sequences where schemaname='public' order by sequencename`){assert.match(s.sequencename,/^[a-z_]+$/);const[v]=await tx`select last_value::text,is_called from ${tx('public.'+s.sequencename)}`;sequences[s.sequencename]={definition:s,value:v};}
 const rows={};for(const t of Object.values(sources.evaluationTemplateMigrationSource().snapshot.tables)){
 const columns=Object.keys(t.columns);assert.match(t.name,/^[a-z_][a-z0-9_]*$/);assert(columns.every(n=>/^[a-z_][a-z0-9_]*$/.test(n)));const projection=columns.map(n=>'"'+n+'"').join(',');
 const[r]=await tx.unsafe('select count(*)::int as count,md5(coalesce(string_agg(h,\'\' order by h),\'\')) as hash from (select md5(row_to_json(t)::text) as h from (select '+projection+' from public."'+t.name+'") t) q');rows[t.name]=r;
 }
 const legacy=legacyCatalog(actual),baseline=digest({catalog:legacy,permissions,sequences:Object.fromEntries(Object.entries(sequences).filter(([name])=>!NEW.some(t=>name===t+'_id_seq')).map(([n,s])=>[n,s.definition]))});
 if(requireCatalogPin)assert.equal(baseline,BASELINE_CATALOG,'Catalog/ownership/ACL drift since reviewed preflight');
 if(count===24){for(const name of NEW){assert.equal((await tx`select count(*)::int as count from ${tx('public.'+name)}`)[0].count,0);const owned=actual.relations.find(r=>r.name===name);assert.equal(owned.owner,'postgres');assert.equal(owned.relacl,null);}
 for(const name of ['submission_evaluation_assignments_id_seq','submission_evaluations_id_seq'])assert.deepEqual({...sequences[name].value},{last_value:'1',is_called:false});
 const grants=await tx`select c.relname from pg_class c,lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) a where c.relnamespace='public'::regnamespace and c.relname=any(${[...NEW,'submission_evaluation_assignments_id_seq','submission_evaluations_id_seq']}::text[]) and a.grantee<>c.relowner`;assert.equal(grants.length,0);
 assert.equal((await tx`select count(*)::int as count from co_adviser_review_assignments where evaluation_assignment_id is not null or evaluation is not null`)[0].count,0);
 }
 const[priv]=await tx`select has_database_privilege(current_user,current_database(),'CREATE') as database_create,has_schema_privilege(current_user,'public','USAGE,CREATE') as public_schema,has_table_privilege(current_user,'drizzle.__drizzle_migrations','SELECT,INSERT') as ledger,has_table_privilege(current_user,'co_adviser_review_assignments','SELECT,UPDATE') as co_table,has_table_privilege(current_user,'submissions','SELECT,REFERENCES') as submissions,has_table_privilege(current_user,'feedbacks','SELECT,REFERENCES') as feedbacks,has_table_privilege(current_user,'users','SELECT,REFERENCES') as users,has_language_privilege(current_user,'plpgsql','USAGE') as plpgsql`;
 assert(Object.values(priv).every(Boolean));
 return{identity:observed,target:TARGET,source:SOURCE,ledger,rows,legacy,permissions,sequences,baseline,installedCatalog:digest(actual),privileges:priv};
}
function preserve(before,after){
 assert.equal(after.target,before.target);assert.equal(after.source,before.source);assert.equal(after.baseline,before.baseline);assert.deepEqual(after.rows,before.rows);assert.deepEqual(after.legacy,before.legacy);assert.deepEqual(after.permissions,before.permissions);
 for(const[name,value]of Object.entries(before.sequences))assert.deepEqual(after.sequences[name],value);
 assert.deepEqual(after.ledger.slice(0,before.ledger.length),before.ledger);
}
async function quiet(tx){assert.equal((await tx`select count(*)::int as count from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid()`)[0].count,0,'Quiesce other database clients; never terminate them automatically');}
function backupReceipt(receipt,now=Date.now()){
 assert.equal(receipt.kind,'e1cl-0022-0023');assert.equal(receipt.target,TARGET);assert.equal(receipt.source,SOURCE);assert(receipt.bytes>1024);assert.match(receipt.sha256,/^[a-f0-9]{64}$/);assert(receipt.privateAclVerified&&receipt.inventoryVerified&&receipt.fullArchiveDecoded);assert.equal(receipt.restoreTested,false);assert(Number.isFinite(receipt.createdAt)&&now>=receipt.createdAt&&now-receipt.createdAt<=900000);
}
function binary(name,args,env){return execFileSync(path.join(bin,name+'.exe'),args,{windowsHide:true,env,encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024});}
function backup(before,c){
 assert.equal(process.platform,'win32');const id='e1cl-0022-0023-'+randomUUID().replaceAll('-',''),base=path.resolve(process.env.USERPROFILE,'.thesishs-private-backups'),home=path.join(base,id);
 assert.equal(path.dirname(home),base);assert(!home.startsWith(path.resolve(process.cwd())+path.sep));if(fs.existsSync(base))assert(!fs.lstatSync(base).isSymbolicLink());fs.mkdirSync(home,{recursive:true});assert(!fs.lstatSync(home).isSymbolicLink());
 execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop';$p=$env:THESISHS_E1CL_PRIVATE_DIR;$a=Get-Acl -LiteralPath $p;$a.SetAccessRuleProtection($true,$false);$u=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;$a.SetOwner($u);foreach($s in @($u.Value,'S-1-5-18','S-1-5-32-544')){$r=[System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new($s),'FullControl','ContainerInherit,ObjectInherit','None','Allow');$a.AddAccessRule($r)};Set-Acl -LiteralPath $p -AclObject $a"],{env:{...process.env,THESISHS_E1CL_PRIVATE_DIR:home},windowsHide:true,stdio:'ignore',timeout:10000});
 const archive=path.join(home,'database.custom'),pass=path.join(home,'temporary.pgpass'),url=new URL(c.url),escape=v=>v.replace(/\\/g,'\\\\').replace(/:/g,'\\:');assert(!/[\r\n]/.test(decodeURIComponent(url.password)));
 const env={};for(const k of ['SystemRoot','WINDIR','PATH','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'])if(process.env[k])env[k]=process.env[k];Object.assign(env,{PGPASSFILE:pass,PGAPPNAME:'e1cl_0022_0023_backup',PGOPTIONS:'-c default_transaction_read_only=on'});
 try{fs.writeFileSync(pass,[before.identity.address,'5432','thesishs_ai','postgres',decodeURIComponent(url.password)].map(escape).join(':')+'\n',{flag:'wx'});privateFile(pass);
 assert.match(binary('pg_dump',['--version'],env),/PostgreSQL\) 18\./);binary('pg_dump',['--host='+before.identity.address,'--port=5432','--username=postgres','--dbname=thesishs_ai','--no-password','--format=custom','--lock-wait-timeout=3s','--file='+archive],env);
 const bytes=fs.readFileSync(privateFile(archive));assert.equal(bytes.subarray(0,5).toString(),'PGDMP');const inventory=binary('pg_restore',['--list',archive],env);for(const name of Object.keys(before.rows))assert(new RegExp('\\bTABLE public '+name+'\\b').test(inventory));assert(inventory.includes('TABLE drizzle __drizzle_migrations'));binary('pg_restore',['--file=NUL',archive],env);
 const receipt={kind:'e1cl-0022-0023',id,target:TARGET,source:SOURCE,bytes:bytes.length,sha256:bytesHash(bytes),privateAclVerified:true,inventoryVerified:true,fullArchiveDecoded:true,restoreTested:false,createdAt:Date.now()};backupReceipt(receipt);assert.equal(bytesHash(fs.readFileSync(privateFile(archive))),receipt.sha256);
 const evidence=path.join(home,'evidence.json');fs.writeFileSync(evidence,JSON.stringify({receipt,before},null,2),{flag:'wx'});privateFile(evidence);console.log(JSON.stringify({stage:'backup-verified',...receipt}));return{home,archive,receipt};
 }finally{if(fs.existsSync(pass))fs.unlinkSync(pass);}
}
async function apply(tx,options){
 // Drizzle session.transaction calls .begin; map that to a savepoint on the ALREADY OPEN outer transaction.
 const nested=new Proxy(tx,{get(target,key){if(key==='options')return options;return key==='begin'?target.savepoint.bind(target):Reflect.get(target,key);}});
 const database=drizzle(nested);await new PgDialect().migrate(pending(),database._.session,{migrationsFolder:'db/migrations'});
}
async function main(args=process.argv.slice(2)){
 const mode=argumentsFor(args),execute=mode===true;pending();for(const file of ['.env.local','.env.development','.env.development.local'])assert(!fs.existsSync(file),'Unreviewed environment override');
 const c=localConfiguration({...require('dotenv').parse(fs.readFileSync('.env')),...process.env});const addresses=await lookup(c.endpoint.host.replace(/^\[|\]$/g,''),{all:true});assert(addresses.length&&addresses.every(a=>['::1','127.0.0.1'].includes(a.address)));
 const connection=()=>postgres(c.url,{...c.options,max:1,onnotice(){},connection:{application_name:'e1cl_0022_0023_operator',statement_timeout:10000,lock_timeout:3000,idle_in_transaction_session_timeout:180000}});
 let sql=connection(),began=false,saved,after,archive;
 try{
 const before=await sql.begin('isolation level repeatable read read only',async tx=>{assert.equal((await tx`show transaction_read_only`)[0].transaction_read_only,'on');return capture(tx,c,mode==='installed'?24:22);});
 if(mode==='installed'){
 const evidence=JSON.parse(fs.readFileSync(privateFile(args[2]),'utf8'));assert.equal(evidence.receipt.kind,'e1cl-0022-0023');assert.equal(evidence.receipt.source,SOURCE);assert.equal(evidence.receipt.target,TARGET);
 assert.equal(bytesHash(fs.readFileSync(privateFile(path.join(path.dirname(args[2]),'database.custom')))),evidence.receipt.sha256);preserve(evidence.before,before);
 console.log(JSON.stringify({stage:'independent-installed-verification',readOnly:true,identity:before.identity,ledger:24,source:SOURCE,preservation:true,backupId:evidence.receipt.id}));return;
 }
 console.log(JSON.stringify({stage:'preflight',readOnly:true,identity:before.identity,target:TARGET,source:SOURCE,ledger:22,baselineCatalog:before.baseline,tables:Object.keys(before.rows).length,privileges:before.privileges}));if(!execute)return;
 await sql.begin(async tx=>{
 await tx`set local search_path=public`;await tx`select pg_advisory_xact_lock(1296388937,16)`;await tx`lock table drizzle.__drizzle_migrations in exclusive mode`;
 for(const name of Object.keys(before.rows).sort())await tx`lock table ${tx('public.'+name)} in share mode`;
 await quiet(tx);const current=await capture(tx,c,22);preserve(before,current);
 archive=backup(current,c);backupReceipt(archive.receipt);const backed=await capture(tx,c,22);preserve(current,backed);await quiet(tx);pending();assert.equal(bytesHash(fs.readFileSync(privateFile(archive.archive))),archive.receipt.sha256);
 began=true;await apply(tx,sql.options);after=await capture(tx,c,24);preserve(current,after);saved=current;
 console.log('PASS precommit: only 0022 then 0023; 24-entry ledger; exact additive structures, empty results/null Co additions, preserved legacy data/catalog/sequences/ACLs.');
 });
 await sql.end({timeout:2});sql=connection();const durable=await sql.begin('isolation level repeatable read read only',tx=>capture(tx,c,24));preserve(saved,durable);assert.deepEqual(durable,after);
 const result=path.join(archive.home,'migration-result.json');fs.writeFileSync(result,JSON.stringify({result:'PASS',migrations:['0022','0023'],source:SOURCE,target:TARGET,ledger:24,independentReconnect:true,preservation:true,backupId:archive.receipt.id,after:durable},null,2),{flag:'wx'});privateFile(result);
 console.log(JSON.stringify({result:'PASS',migrations:['0022','0023'],ledger:24,independentReconnect:true,preservation:true,backupId:archive.receipt.id}));
 }catch(e){
 let durableState='NOT_CHECKED';if(began){try{await sql.end({timeout:2});sql=connection();durableState=await sql.begin('read only',async tx=>{await identity(tx,c);const ledger=Array.from(await tx`select id,hash,created_at::text as created_at from drizzle.__drizzle_migrations order by created_at,id`);if([22,24].includes(ledger.length)){ledgerMatches(ledger,ledger.length);return ledger.length===22?'22_PREFIX_ROLLBACK_CATALOG_REVIEW_REQUIRED':'24_RECORDED_CATALOG_REVIEW_REQUIRED';}return'UNEXPECTED_LEDGER_STOP';});}catch{durableState='UNCONFIRMED_STOP';}}
 console.error(JSON.stringify({result:'BLOCKED_OR_UNCONFIRMED',executionBegan:began,durableState,code:e.code||e.name,automaticRetry:false,backupId:archive?.receipt.id??null}));process.exitCode=1;
 }finally{await sql?.end({timeout:2});}
}
module.exports={pending,argumentsFor,ledgerMatches,localConfiguration,shape,legacyCatalog,capture,preserve,backupReceipt,apply,SOURCE,TARGET,MIGRATIONS,BASELINE_CATALOG,main};
if(require.main===module)main().catch(e=>{console.error('E1C-L arguments/configuration refused ('+(e.code||e.name)+'). No execution/retry.');process.exitCode=1;});
