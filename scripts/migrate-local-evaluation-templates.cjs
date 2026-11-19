/* eslint-disable @typescript-eslint/no-require-imports */
// Owner-authorized E1B-L only. No import-time connection, backup, DDL or automatic retry.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { lookup } = require('node:dns/promises'), { execFileSync } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const postgres = require('postgres'), { drizzle } = require('drizzle-orm/postgres-js'), { PgDialect } = require('drizzle-orm/pg-core');
const { databaseConfiguration } = require('../lib/db/config.ts');
const { verifyLocalIdentity } = require('./migrate-local-workspace.ts');
const source = require('./preview-migration-source.ts');
const { verifyPreviewCatalog } = require('./preview-schema.ts');
const { catalogDefault, catalogIdentifier, catalogIndex } = require('./preview-catalog-contract.ts');
const { privateFile } = require('./upload-acceptance-safety.ts');
const SOURCE = 'd560ec745f5fdd4786f43c94f0bce456a4e7e7728f7aff206fd7b2642c7c780c';
const TARGET = '8be02ccf26465e24fe4daa24fb5adbf11ca3283956a0d242e6a4b43b4ebd6079';
const MIGRATION = 'c25f2a298a40031c1d3601b8c27199b7c0c4a02f45f0a33d93b451bba7acbe18';
const NEW = ['evaluation_template_criteria', 'evaluation_templates'];
const bin = 'C:/Program Files/PostgreSQL/18/bin', digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const bytesHash = bytes => createHash('sha256').update(bytes).digest('hex');
const pgName = name => name.slice(0, 63);
function pending() {
    const s = source.evaluationTemplateMigrationSource(); assert.equal(s.hash, SOURCE); assert.equal(s.migrations.length, 22);
    const only = s.migrations.slice(21); assert.equal(only.length, 1); assert.equal(only[0].hash, MIGRATION); return only;
}
function localConfiguration(env) {
    assert.notEqual(env.NODE_ENV, 'production'); assert.ok(!['preview', 'production'].includes(env.VERCEL_ENV));
    const c = databaseConfiguration({ ...env, NODE_ENV: 'development' });
    assert.equal(c.environment, 'development'); assert.equal(c.mode, 'direct');
    assert.ok(['localhost', '127.0.0.1', '[::1]', '::1'].includes(c.endpoint.host));
    assert.equal(c.endpoint.port, 5432); assert.equal(c.endpoint.database, 'thesishs_ai'); assert.equal(c.endpoint.user, 'postgres');
    for (const [stage, profile] of Object.entries(JSON.parse(env.THESISHS_DATABASE_TARGETS_JSON || '{}'))) {
        if (stage === 'development' || profile.reserved) continue;
        assert.ok(!(profile.observed?.databaseOid === '16387' && profile.observed?.cluster === '7652422818440234372'));
        for (const ep of [profile.runtime, profile.operator].filter(Boolean)) assert.ok(!(ep.database === 'thesishs_ai' && ep.port === 5432 && ['localhost','127.0.0.1','::1','[::1]'].includes(ep.host)));
    }
    return c;
}
function preserve(before, after) {
    assert.equal(after.target, before.target); assert.equal(after.source, before.source);
    for (const name of Object.keys(before.rows)) { assert.deepEqual(after.rows[name], before.rows[name]); assert.equal(after.catalog[name], before.catalog[name]); }
    for (const name of Object.keys(before.sequences)) assert.deepEqual(after.sequences[name], before.sequences[name]);
    assert.deepEqual(after.permissions, before.permissions);
    assert.deepEqual(after.ledger.slice(0, before.ledger.length), before.ledger);
}
function expectedObjects(snapshot) {
    return Object.values(snapshot.tables).flatMap(t => [t.name+':r',
        ...[...Object.keys(t.indexes), ...Object.keys(t.uniqueConstraints), ...Object.keys(t.compositePrimaryKeys),
            ...(Object.values(t.columns).some(c => c.primaryKey) ? [t.name+'_pkey'] : [])].map(n => pgName(n)+':i'),
        ...Object.values(t.columns).filter(c => c.type === 'serial').map(c => t.name+'_'+c.name+'_seq:S')]).sort();
}
async function localCatalog(tx, snapshot, baseline) {
    // Existing SELECT-only verifier authenticates columns/defaults/constraints/indexes through 0020.
    // Its hosted all-one-owner rule is replaced only by the established LOCAL upload-operator split.
    if (baseline) {
        try { await verifyPreviewCatalog(tx, 'otp-installed'); }
        catch (e) { if (e.schemaObject !== 'public' || e.schemaAssertion !== 'ownership') throw e; }
    }
    const objects = await tx`select c.relname as name,c.relkind::text as kind,pg_get_userbyid(c.relowner) as owner from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and not exists(select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=c.oid and d.deptype='e') order by c.relname`;
    const intent = snapshot.tables['public.submission_upload_intents'];
    const legacy = new Set([intent.name, intent.name+'_pkey', ...Object.keys(intent.indexes), ...Object.keys(intent.uniqueConstraints)].map(pgName));
    assert.ok(objects.every(o => o.owner === (legacy.has(o.name) ? 'thesishs_local_operator' : 'postgres')));
    assert.deepEqual(objects.map(o => o.name+':'+o.kind).sort(), expectedObjects(snapshot));
    const sequences = await tx`select sequencename,start_value::text,min_value::text,max_value::text,increment_by::text,cycle,cache_size::text from pg_sequences where schemaname='public' order by sequencename`;
    for (const s of sequences) assert.deepEqual([s.start_value,s.min_value,s.max_value,s.increment_by,s.cycle,s.cache_size], ['1','1','2147483647','1',false,'1']);
    const [extras] = await tx`select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and not exists(select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')) as routines,
        exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype in ('d','e','r','m') and not exists(select 1 from pg_depend d where d.classid='pg_type'::regclass and d.objid=t.oid and d.deptype='e')) as types,
        exists(select 1 from pg_trigger g join pg_class c on c.oid=g.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not g.tgisinternal) as triggers,
        exists(select 1 from pg_rewrite r join pg_class c on c.oid=r.ev_class where c.relnamespace='public'::regnamespace and r.rulename<>'_RETURN') as rules`;
    assert.deepEqual({...extras}, { routines:false, types:false, triggers:false, rules:false });
    const [binding] = await tx`select exists(select 1 from pg_depend d left join pg_proc p on d.refclassid='pg_proc'::regclass and p.oid=d.refobjid
        left join pg_operator o on d.refclassid='pg_operator'::regclass and o.oid=d.refobjid left join pg_type t on d.refclassid='pg_type'::regclass and t.oid=d.refobjid
        where ((d.classid='pg_constraint'::regclass and d.objid in (select oid from pg_constraint where connamespace='public'::regnamespace))
        or (d.classid='pg_attrdef'::regclass and d.objid in (select a.oid from pg_attrdef a join pg_class c on c.oid=a.adrelid where c.relnamespace='public'::regnamespace))
        or (d.classid='pg_class'::regclass and d.objid in (select oid from pg_class where relnamespace='public'::regnamespace and relkind='i')))
        and coalesce(p.pronamespace,o.oprnamespace,t.typnamespace)<>'pg_catalog'::regnamespace) as custom`;
    assert.equal(binding.custom, false);
}
async function verifyNew(tx, snapshot) {
    let checkCount = 0;
    for (const name of NEW) {
        const t = snapshot.tables['public.'+name];
        const columns = await tx`select a.attname as name,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull as required,pg_get_expr(d.adbin,d.adrelid) as value
            from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=${'public.'+name}::regclass and a.attnum>0 and not a.attisdropped order by a.attnum`;
        assert.deepEqual(columns.map(c => c.name).sort(), Object.keys(t.columns).sort());
        for (const c of Object.values(t.columns)) {
            const actual = columns.find(a => a.name === c.name); assert.equal(actual.type, c.type === 'serial' ? 'integer' : c.type.replace(/^varchar/,'character varying'));
            assert.equal(actual.required, c.notNull); assert.equal(actual.value, c.type === 'serial' ? "nextval('"+name+'_'+c.name+"_seq'::regclass)" : catalogDefault(c));
        }
        const constraints = await tx`select k.conname as name,k.contype as type,k.convalidated,coalesce((to_jsonb(k)->>'conenforced')::boolean,true) as enforced,k.condeferrable,k.condeferred,
            pg_get_constraintdef(k.oid) as definition,k.confdeltype,k.confupdtype,k.confmatchtype,f.relname as target,fn.nspname as target_schema,
            array(select a.attname from unnest(k.conkey) with ordinality x(num,ord) join pg_attribute a on a.attrelid=k.conrelid and a.attnum=x.num order by x.ord) as columns,
            array(select a.attname from unnest(k.confkey) with ordinality x(num,ord) join pg_attribute a on a.attrelid=k.confrelid and a.attnum=x.num order by x.ord) as referenced
            from pg_constraint k left join pg_class f on f.oid=k.confrelid left join pg_namespace fn on fn.oid=f.relnamespace where k.conrelid=${'public.'+name}::regclass`;
        const wanted = [...Object.keys(t.foreignKeys),...Object.keys(t.uniqueConstraints),...Object.keys(t.compositePrimaryKeys),...Object.keys(t.checkConstraints),...(Object.values(t.columns).some(c=>c.primaryKey)?[name+'_pkey']:[])].map(pgName).sort();
        assert.deepEqual(constraints.filter(c=>c.type!=='n').map(c=>c.name).sort(), wanted); assert.ok(constraints.every(c=>c.convalidated&&c.enforced&&!c.condeferrable&&!c.condeferred));
        for (const fk of Object.values(t.foreignKeys)) { const c=constraints.find(c=>c.name===pgName(fk.name)); assert.equal(c.type,'f');assert.equal(c.target,fk.tableTo);assert.equal(c.target_schema,'public');assert.equal(c.confdeltype,'r');assert.equal(c.confupdtype,'a');assert.equal(c.confmatchtype,'s');assert.deepEqual(c.columns,fk.columnsFrom);assert.deepEqual(c.referenced,fk.columnsTo); }
        for (const [kind,entries] of [['p',t.compositePrimaryKeys],['u',t.uniqueConstraints]]) for(const item of Object.values(entries)){const c=constraints.find(c=>c.name===pgName(item.name));assert.equal(c.type,kind);assert.deepEqual(c.columns,item.columns);}
        const primary=Object.values(t.columns).filter(c=>c.primaryKey).map(c=>c.name);if(primary.length)assert.deepEqual(constraints.find(c=>c.type==='p').columns,primary);
        checkCount+=constraints.filter(c=>c.type==='c').length;
        const indexes = await tx`select indexname,indexdef from pg_indexes where schemaname='public' and tablename=${name}`;
        assert.deepEqual(indexes.map(i=>i.indexname).sort(),[...Object.keys(t.indexes).map(pgName),...constraints.filter(c=>['p','u'].includes(c.type)).map(c=>c.name)].sort());
        for(const item of Object.values(t.indexes))assert.equal(indexes.find(i=>i.indexname===pgName(item.name)).indexdef,catalogIndex(name,item));
        for(const c of constraints.filter(c=>['p','u'].includes(c.type)))assert.equal(indexes.find(i=>i.indexname===c.name).indexdef,'CREATE UNIQUE INDEX '+c.name+' ON public.'+name+' USING btree ('+c.columns.map(catalogIdentifier).join(', ')+')');
        const health=await tx`select indisvalid,indisready,indislive,indimmediate from pg_index where indrelid=${'public.'+name}::regclass`;
        assert.equal(health.length,indexes.length);assert.ok(health.every(i=>i.indisvalid&&i.indisready&&i.indislive&&i.indimmediate));
        const [security]=await tx`select relrowsecurity,relforcerowsecurity,relowner=(select oid from pg_roles where rolname=current_user) as owned from pg_class where oid=${'public.'+name}::regclass`;
        assert.deepEqual({...security},{relrowsecurity:false,relforcerowsecurity:false,owned:true});
        const [rows]=await tx`select count(*)::int as count from ${tx('public.'+name)}`;assert.equal(rows.count,0);
    }
    assert.equal(checkCount,6);
    const [sequence]=await tx`select last_value::text,is_called from public.evaluation_templates_id_seq`;assert.deepEqual({...sequence},{last_value:'1',is_called:false});
    const grantRows=await tx`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace,
        lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 's'::"char" else 'r'::"char" end,c.relowner))) a
        where n.nspname='public' and c.relname in ('evaluation_templates','evaluation_template_criteria','evaluation_templates_id_seq') and a.grantee<>c.relowner`;
    assert.equal(grantRows.length,0,'No extra new-object grants');
}
async function inspect(tx, configuration, count) {
    pending();
    const [identity]=await tx`select current_database() as database,current_user as username,session_user as login,host(inet_server_addr()) as address,inet_server_port() as port,
        (select oid::text from pg_database where datname=current_database()) as oid,(select system_identifier::text from pg_control_system()) as cluster,
        (select pg_get_userbyid(datdba) from pg_database where datname=current_database()) as owner,(select rolsuper from pg_roles where rolname=current_user) as superuser`;
    verifyLocalIdentity(identity);
    const target=digest({endpoint:configuration.endpoint,marker:configuration.identity,identity:{database:identity.database,oid:identity.oid,cluster:identity.cluster,address:identity.address,port:identity.port,username:identity.username,login:identity.login,owner:identity.owner}});assert.equal(target,TARGET);
    const connections=await tx`select count(*)::int as count from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid()`;assert.equal(connections[0].count,0,'Another database connection is active; do not assume environment isolation');
    const ledger=Array.from(await tx`select id,hash,created_at::text from drizzle.__drizzle_migrations order by created_at,id`);
    if(count===21)source.verifyEmailOtpLedger(ledger,21);else{assert.equal(count,22);assert.equal(ledger.length,22);const all=source.evaluationTemplateMigrationSource().migrations;assert.ok(ledger.every((r,i)=>r.hash===all[i].hash&&r.created_at===String(all[i].folderMillis)));source.verifyEmailOtpLedger(ledger.slice(0,21),21);assert.ok(Number.isSafeInteger(ledger[21].id)&&ledger[21].id>ledger[20].id);}
    const snapshot=count===21?source.emailOtpMigrationSource().snapshot:source.evaluationTemplateMigrationSource().snapshot;
    await localCatalog(tx,snapshot,count===21);
    if(count===21){const absent=await tx`select to_regclass('public.evaluation_templates') is null as header,to_regclass('public.evaluation_template_criteria') is null as criteria`;assert.equal(absent[0].header&&absent[0].criteria,true);}else await verifyNew(tx,snapshot);
    const columns=await tx`select c.relname,a.attname,a.attnum,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid) as value from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='public' and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum`;
    const constraints=await tx`select c.relname,k.conname,to_jsonb(k)-'oid'-'conrelid'-'conindid'-'confrelid'-'connamespace' as properties,pg_get_constraintdef(k.oid) as definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,k.conname`;
    const indexes=await tx`select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname`;
    const security=await tx`select c.relname,pg_get_userbyid(c.relowner) as owner,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p') order by c.relname`;
    const rows={},catalog={},sequences={};
    for(const t of Object.values(snapshot.tables)){
        assert.match(t.name,/^[a-z_][a-z0-9_]*$/);
        const [r]=await tx`select count(*)::int as count,md5(coalesce(string_agg(h,'' order by h),'')) as hash from (select md5(row_to_json(t)::text) as h from ${tx('public.'+t.name)} t) q`;
        rows[t.name]=r;catalog[t.name]=digest({columns:columns.filter(r=>r.relname===t.name),constraints:constraints.filter(r=>r.relname===t.name),indexes:indexes.filter(r=>r.tablename===t.name),security:security.filter(r=>r.relname===t.name)});
    }
    for(const s of await tx`select sequencename,start_value::text,min_value::text,max_value::text,increment_by::text,cycle,cache_size::text,sequenceowner from pg_sequences where schemaname='public' order by sequencename`){assert.match(s.sequencename,/^[a-z_][a-z0-9_]*$/);const [v]=await tx`select last_value::text,is_called from ${tx('public.'+s.sequencename)}`;const [acl]=await tx`select relacl::text from pg_class where oid=${'public.'+s.sequencename}::regclass`;sequences[s.sequencename]={definition:s,value:v,acl};}
    const permissions={schemas:await tx`select nspname,pg_get_userbyid(nspowner) as owner,nspacl::text from pg_namespace where nspname in ('public','drizzle') order by nspname`,database:await tx`select datacl::text from pg_database where datname=current_database()`,defaults:await tx`select defaclrole::regrole::text,defaclnamespace::regnamespace::text,defaclobjtype,defaclacl::text from pg_default_acl order by oid`,roles:await tx`select rolname,rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls from pg_roles order by rolname`};
    const [priv]=await tx`select has_schema_privilege(current_user,'public','USAGE,CREATE') as schema,has_table_privilege(current_user,'drizzle.__drizzle_migrations','SELECT,INSERT') as ledger,has_table_privilege(current_user,'users','SELECT,UPDATE') as users,has_table_privilege(current_user,'main_adviser_designation','SELECT,UPDATE') as designation,has_table_privilege(current_user,'activity_logs','INSERT') as audit,has_sequence_privilege(current_user,pg_get_serial_sequence('public.activity_logs','id'),'USAGE') as audit_sequence`;assert.ok(Object.values(priv).every(Boolean));
    return {identity,target,source:SOURCE,ledger,rows,catalog,sequences,permissions};
}
function binary(name,args,env) { return execFileSync(path.join(bin,name+'.exe'),args,{windowsHide:true,env,encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe'],maxBuffer:4*1024*1024}); }
function backup(before, configuration) {
    assert.equal(process.platform,'win32');
    const run='e1bl-0021-'+randomUUID().replaceAll('-',''),base=path.resolve(process.env.USERPROFILE,'.thesishs-private-backups'),home=path.join(base,run);
    assert.equal(path.dirname(home),base);assert.ok(!home.startsWith(path.resolve(process.cwd())+path.sep));
    if(fs.existsSync(base))assert.equal(fs.lstatSync(base).isSymbolicLink(),false);fs.mkdirSync(home,{recursive:true});assert.equal(fs.lstatSync(home).isSymbolicLink(),false);
    execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop';$p=$env:THESISHS_E1BL_PRIVATE_DIR;$a=Get-Acl -LiteralPath $p;$a.SetAccessRuleProtection($true,$false);$u=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;$a.SetOwner($u);foreach($s in @($u.Value,'S-1-5-18','S-1-5-32-544')){$r=[System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new($s),'FullControl','ContainerInherit,ObjectInherit','None','Allow');$a.AddAccessRule($r)};Set-Acl -LiteralPath $p -AclObject $a"],{env:{...process.env,THESISHS_E1BL_PRIVATE_DIR:home},windowsHide:true,stdio:'ignore',timeout:10000});
    const archive=path.join(home,'database.custom'),pass=path.join(home,'temporary.pgpass'),url=new URL(configuration.url),escape=value=>value.replace(/\\/g,'\\\\').replace(/:/g,'\\:');
    assert.ok(!/[\r\n]/.test(decodeURIComponent(url.password)));
    fs.writeFileSync(pass,[before.identity.address,'5432','thesishs_ai','postgres',decodeURIComponent(url.password)].map(escape).join(':')+'\n',{flag:'wx'});
    const env={};for(const key of ['SystemRoot','WINDIR','PATH','PATHEXT','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'])if(process.env[key])env[key]=process.env[key];
    Object.assign(env,{PGPASSFILE:pass,PGAPPNAME:'e1bl_0021_backup',PGOPTIONS:'-c default_transaction_read_only=on'});
    try {
        privateFile(pass);
        assert.match(binary('pg_dump',['--version'],env),/PostgreSQL\) 18\./);
        binary('pg_dump',['--host='+before.identity.address,'--port=5432','--username=postgres','--dbname=thesishs_ai','--no-password','--format=custom','--lock-wait-timeout=3s','--file='+archive],env);
        privateFile(archive);const bytes=fs.readFileSync(archive);assert.equal(bytes.subarray(0,5).toString(),'PGDMP');assert.ok(bytes.length>1024);
        const inventory=binary('pg_restore',['--list',archive],env);
        for(const name of Object.keys(before.rows))assert.ok(new RegExp('\\bTABLE public '+name+'\\b').test(inventory));
        assert.ok(inventory.includes('TABLE drizzle __drizzle_migrations'));
        binary('pg_restore',['--file=NUL',archive],env); // Decode every archive payload; no database connection or restore.
        const hash=bytesHash(bytes);assert.equal(bytesHash(fs.readFileSync(archive)),hash);
        const evidence={id:run,bytes:bytes.length,sha256:hash,inventoryVerified:true,fullArchiveDecoded:true,restoreTested:false,before};
        fs.writeFileSync(path.join(home,'evidence.json'),JSON.stringify(evidence,null,2),{flag:'wx'});privateFile(path.join(home,'evidence.json'));
        console.log(JSON.stringify({stage:'backup',id:run,bytes:bytes.length,sha256:hash,privateAclVerified:true,inventoryVerified:true,fullArchiveDecoded:true,restoreTested:false}));
        return {home,archive,hash,evidence};
    } finally {if(fs.existsSync(pass))fs.unlinkSync(pass);}
}
async function apply(tx,options) {
    const nested=new Proxy(tx,{get(target,key){if(key==='options')return options;return key==='begin'?target.savepoint.bind(target):Reflect.get(target,key);}});
    const database=drizzle(nested);await new PgDialect().migrate(pending(),database._.session,{migrationsFolder:'db/migrations'});
}
async function main(args=process.argv.slice(2)) {
    const execute=args[0]==='--execute';assert.ok(execute||args.length===1&&args[0]==='--inspect');
    if(execute)assert.deepEqual(args,['--execute','--confirm-target',TARGET,'--confirm-source',SOURCE]);
    for(const file of ['.env.local','.env.development','.env.development.local'])assert.equal(fs.existsSync(file),false,'Unreviewed environment override');
    const configuration=localConfiguration({...require('dotenv').parse(fs.readFileSync('.env')),...process.env});pending();
    const addresses=await lookup(configuration.endpoint.host.replace(/^\[|\]$/g,''),{all:true});assert.ok(addresses.length&&addresses.every(a=>a.address==='::1'||/^127\./.test(a.address)));
    const connection=()=>postgres(configuration.url,{...configuration.options,max:1,onnotice:()=>{},connection:{application_name:'e1bl_0021_operator',statement_timeout:10000,lock_timeout:3000,idle_in_transaction_session_timeout:180000}});
    let sql=connection(),began=false,saved,after,backupInfo;
    try {
        const before=await sql.begin('isolation level repeatable read read only',tx=>inspect(tx,configuration,21));
        console.log(JSON.stringify({stage:'verified',identity:before.identity,target:before.target,source:SOURCE,ledger:21,otherConnections:0}));
        if(!execute)return;
        await sql.begin(async tx=>{
            await tx`set local search_path=public`;await tx`select pg_advisory_xact_lock(1296388937,16)`;
            await tx`lock table drizzle.__drizzle_migrations in exclusive mode`;
            for(const name of Object.keys(before.rows).sort())await tx`lock table ${tx('public.'+name)} in share mode`;
            const current=await inspect(tx,configuration,21);preserve(before,current);
            backupInfo=backup(current,configuration);const backed=await inspect(tx,configuration,21);preserve(current,backed);
            assert.equal(bytesHash(fs.readFileSync(privateFile(backupInfo.archive))),backupInfo.hash);
            // The one migration, ledger INSERT and all verification below share this outer transaction.
            began=true;await apply(tx,sql.options);after=await inspect(tx,configuration,22);preserve(current,after);saved=current;
            console.log('PASS precommit: exactly 0021, 22-entry ledger, new empty tables/keys/checks/indexes/sequence; old rows/catalog/sequences/ACLs unchanged.');
        });
        await sql.end({timeout:2});sql=connection();
        const durable=await sql.begin('isolation level repeatable read read only',tx=>inspect(tx,configuration,22));preserve(saved,durable);assert.deepEqual(durable,after);
        fs.writeFileSync(path.join(backupInfo.home,'migration-result.json'),JSON.stringify({result:'PASS',migration:'0021',target:TARGET,source:SOURCE,ledger:22,preserved:true,backupId:backupInfo.evidence.id,after:durable},null,2));
        console.log(JSON.stringify({result:'PASS',migration:'0021',ledger:22,independentReconnect:true,preservation:true,noGrantChanges:true,backupId:backupInfo.evidence.id}));
    } catch(error) {
        let durableLedger=null;
        if(began){try{await sql.end({timeout:2});sql=connection();await sql.begin('read only',async tx=>{const [i]=await tx`select current_database() as database,current_user as username,session_user as login,host(inet_server_addr()) as address,inet_server_port() as port,(select oid::text from pg_database where datname=current_database()) as oid,(select system_identifier::text from pg_control_system()) as cluster,(select pg_get_userbyid(datdba) from pg_database where datname=current_database()) as owner,(select rolsuper from pg_roles where rolname=current_user) as superuser`;verifyLocalIdentity(i);const rows=await tx`select hash from drizzle.__drizzle_migrations`;durableLedger=rows.length;});}catch{/* Uncertainty remains explicit; no retry. */}}
        console.error(JSON.stringify({result:'BLOCKED_OR_UNCONFIRMED',executionBegan:began,durableLedger,code:error.code||error.name,schemaObject:error.schemaObject,schemaAssertion:error.schemaAssertion,automaticRetry:false}));process.exitCode=1;
    } finally {await sql?.end({timeout:2});}
}
module.exports={pending,localConfiguration,preserve,expectedObjects,SOURCE,TARGET,MIGRATION,main};
if(require.main===module)main().catch(e=>{console.error('E1B-L arguments/configuration refused ('+(e.code||e.name)+'). No automatic retry.');process.exitCode=1;});
