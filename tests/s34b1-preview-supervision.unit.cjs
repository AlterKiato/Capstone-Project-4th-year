/* eslint-disable @typescript-eslint/no-require-imports */
// Existing VM/transaction-double pattern; no database, environment file or network access.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const vm = require('node:vm');
const ts = require('typescript');
const source = require('../scripts/preview-migration-source.ts');
const { upgradePreview0017 } = require('../scripts/preview-initialization.ts');
const supervision = require('../scripts/preview-supervision.ts');
const operator = require('../scripts/initialize-preview-database.ts');
const { verifyPreviewSchema, PreviewSchemaAssertion } = require('../scripts/preview-schema.ts');
const fullLedger = () => source.supervisionMigrationSource().migrations.map((m,i)=>({id:i+1,hash:m.hash,created_at:String(m.folderMillis)}));
const config = { environment:'preview',purpose:'operator',identity:'synthetic-preview',endpoint:{database:'postgres'},
 observed:{provider:'supabase',projectRef:'cbkplqkkjuoglpimwmib',databaseOid:'5',cluster:'7678069749886157684',runtimeRole:'thesishs_preview_runtime',operatorRole:'thesishs_preview_operator'} };
function shape(entries) {
 const snapshot=entries===18?source.supervisionMigrationSource().snapshot:source.workspaceMigrationSource().snapshot;
 const columns=[],constraints=[];
 for(const t of Object.values(snapshot.tables)) {
  columns.push(...Object.keys(t.columns).map(column_name=>({table_name:t.name,column_name})));
  for(const [key,type] of [['foreignKeys','f'],['uniqueConstraints','u'],['checkConstraints','c'],['compositePrimaryKeys','p']])
   constraints.push(...Object.keys(t[key]).map(n=>({relname:t.name,conname:n.slice(0,63),contype:type,convalidated:true,enforced:'true'})));
  if(Object.values(t.columns).some(c=>c.primaryKey))constraints.push({relname:t.name,conname:t.name+'_pkey',contype:'p',convalidated:true,enforced:'true'});
 }
 return {snapshot,columns,constraints};
}
function relations(entries) {
    const snapshot = entries === 18 ? source.supervisionMigrationSource().snapshot : source.workspaceMigrationSource().snapshot;
    return Object.values(snapshot.tables).flatMap(t => [
        { relname: t.name, relkind: 'r' },
        ...Object.values(t.columns).filter(c => c.type === 'serial').map(c => ({ relname: `${t.name}_${c.name}_seq`, relkind: 'S' })),
        ...[...Object.keys(t.indexes), ...Object.keys(t.uniqueConstraints), ...Object.keys(t.compositePrimaryKeys),
            ...(Object.values(t.columns).some(c => c.primaryKey) ? [`${t.name}_pkey`] : [])].map(n => ({ relname: n.slice(0, 63), relkind: 'i' })),
    ]).map(r => ({ ...r, relowner: '42', relacl: null })).sort((a, b) => a.relname.localeCompare(b.relname));
}

function databaseDouble(entries = 17) {
    const state = { entries, queries: [], grants: entries === 18 ? 6 : 3, writes: false, savepoints: 0, begins: [],
        pushHash: 'push-records', oldSequence: '9', oldAcl: null, fail: undefined };
    const query = (text, params = []) => {
        state.queries.push({ text, params });
        if (/^\s*(create|alter|drop|insert|grant|lock)/i.test(text)) {
            assert.equal(state.writes, true, 'read-only inspection attempted mutation');
            if (state.fail && text.toLowerCase().includes(state.fail)) throw Error('private SQL failure');
        }
        if (text.includes('insert into "drizzle"."__drizzle_migrations"')) state.entries = 18;
        if (/^grant /i.test(text)) state.grants++;
        if (text.includes('from drizzle.__drizzle_migrations')) return fullLedger().slice(0, state.entries);
        if (text.includes('order by created_at desc')) return [fullLedger()[state.entries - 1]];
        if (text.includes('as database_create')) return [{ schema_usage: true, database_create: false, schema_ddl: false, owns_objects: false,
            owns_database: false, truncate: false, ...(state.boundary ?? {}) }];
        if (text.includes('as readable')) return [{ readable: true, lockable: true, ...(state.authorization ?? {}) }];
        if (text.includes('as required')) return [{ required: !state.missingRequired }];
        if (text.includes('as public_access')) return [{ public_access: Boolean(state.publicAccess) }];
        if (text.includes('as exposed')) return [{ exposed: Boolean(state.exposed) }];
        if (text.includes('as widened')) return [{ widened: false }];
        if (text.includes('as grantable')) {
            const name = params[1], privilege = params[2];
            const allowed = name.endsWith('_seq') ? privilege === 'USAGE' : ['SELECT', 'UPDATE'].includes(privilege) || privilege === 'INSERT' && name !== 'public.main_adviser_designation' || name === 'public.group_tasks' && privilege === 'DELETE';
            return [{ allowed: (state.grants >= 3 && !/main_adviser|co_adviser/.test(name) || state.grants === 6) && allowed || false, grantable: false, ...(state.access ?? {}) }];
        }
        if (text.includes('has_schema_privilege')) return [{ create_public: true, temporary: true, create_ledger: true }];
        if (text.includes('select c.relname,c.relkind')) return (state.relations ?? relations(state.entries)).map(r => r.relname === 'users' ? { ...r, relacl: state.oldAcl } : r);
        if (text.includes('select to_regclass')) return [{ ledger: true }];
        if (text.includes('from pg_sequences')) return relations(state.entries).filter(r => r.relkind === 'S').map(r => ({ sequencename: r.relname, start_value: '1', increment_by: '1' }));
        if (text.includes('last_value::text')) return [{ value: params[0].identifier.includes('group_tasks') || params[0].identifier.includes('task_notes') ? '1' : state.oldSequence, is_called: true }];
        if (text.includes('string_agg')) return [{ hash: params[0].identifier === 'public.push_subscriptions' ? state.pushHash : 'old-records' }];
        if (text.includes('count(*)')) return [{ count: 0 }];
        if (text.includes('information_schema.columns')) return shape(state.entries).columns;
        if (text.includes('from pg_constraint')) return state.constraints ?? shape(state.entries).constraints;
        if (/from pg_proc|from pg_type|from pg_indexes/.test(text)) return [];
        return [];
    };
    function client() {
        const sql = (parts, ...params) => typeof parts === 'string' ? { identifier: parts } : sql.unsafe(parts.join('?'), params);
        sql.unsafe = (text, params) => {
            const result = Promise.resolve().then(() => query(text, params));
            result.values = () => result;
            return result;
        };
        sql.savepoint = async callback => { state.savepoints++; return callback(sql); };
        return sql;
    }
    const tx = client(), root = client();
    root.options = { parsers: {}, serializers: {} };
    root.begin = async (mode, callback) => {
        if (typeof mode === 'function') { callback = mode; mode = 'write'; }
        state.begins.push(mode);
        const saved = { entries: state.entries, grants: state.grants }, previous = state.writes;
        state.writes = mode === 'write';
        try { return await callback(tx); }
        catch (error) { Object.assign(state, saved); throw error; }
        finally { state.writes = previous; }
    };
    root.end = async () => {};
    return { state, root, tx };
}

// Only identity observation is doubled; target pins and all SQL/operator decisions stay real.
function cliDouble(db, schemaFailure, configPatch = {}, backupFailure = false) {
    const output = [], schemaModes = [], connections = [];
    const fakeProcess = { argv: ['node', 'unit'], env: {}, stdin: { isTTY: true }, stdout: { isTTY: true }, exitCode: 0 };
    const exports = {};
    const code = ts.transpileModule(readFileSync('scripts/initialize-preview-database.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, { exports, process: fakeProcess, console: { log: v => output.push(v), error: v => output.push(v) }, require(name) {
        if (name === 'postgres') return (_url, options) => { connections.push(options); return db.root; };
        if (name === '@/lib/db/config') return { databaseConfiguration: () => ({ ...config, ...configPatch, url: 'never-connected', options: {} }) };
        if (name === '@/lib/db/identity') return { verifyDatabaseIdentity: async () => ({ database: 'postgres', oid: '5', username: config.observed.operatorRole }) };
        if (name === './preview-schema') return { verifyPreviewSchema: async (_sql, mode) => {
            assert.equal(db.state.writes, true); schemaModes.push(mode);
        }, verifyPreviewCatalog: async (_sql, mode) => {
            if (db.state.writes && mode !== 'supervision-installed') schemaModes.push(mode);
            if (db.state.writes && schemaFailure === mode) throw Error('synthetic schema mismatch');
        } };
        if (name === './preview-supervision') return { ...supervision, readSupervisionBackup: (file, hash, before) => { assert.equal(db.state.writes, false); assert.equal(file, '/synthetic/private/evidence.json'); assert.equal(hash, 'a'.repeat(64)); assert.equal(before.ledger.length, 17); if (backupFailure) throw Error('private backup path failure'); return { sha256: hash }; } };
        if (name.startsWith('./')) return require(`../scripts/${name.slice(2)}.ts`);
        if (name === 'dotenv') return { config: () => {} };
        return require(name);
    } });
    return { api: exports, output, schemaModes, connections, process: fakeProcess };
}

const approvals = inspected => ['--confirm-target',inspected.target,'--confirm-source',inspected.source,
    '--confirm-data-api-disabled','yes','--confirm-recovery-verified','yes',
    '--backup-evidence','/synthetic/private/evidence.json','--confirm-backup','a'.repeat(64)];
async function inspectedCli(db=databaseDouble(), ...args) {
    const cli=cliDouble(db,...args); const result=await cli.api.main(['--inspect-upgrade-0017']);
    assert.equal(result.exitStatus,0);return {db,cli,inspected:JSON.parse(cli.output[0])};
}

test('0017 source pins and ordered 17/18 ledgers reject incomplete, divergent, reordered or extra history',()=>{
    assert.equal(source.supervisionMigrationSource().migrations.length,18);
    assert.equal(createHash('sha256').update(readFileSync('db/migrations/0017_research_supervision.sql')).digest('hex'),
        '155d1cfacb773838133d4bce215c1dbbd4011d277c1f11f7cb7ca0299169a98a');
    source.verifySupervisionLedger(fullLedger(),18);source.verifySupervisionLedger(fullLedger().slice(0,17),17);
    assert.equal(source.recognizeSupervisionLedger(fullLedger()).state,'supervision-recorded');
    for(const ledger of [fullLedger().slice(0,16),fullLedger().slice(1),[...fullLedger(),fullLedger().at(-1)],
        fullLedger().map((r,i)=>i===17?{...r,hash:'wrong'}:r),fullLedger().map((r,i)=>i===3?{...r,created_at:'0'}:r),
        fullLedger().map((r,i)=>({...r,id:i===8?8:r.id}))])assert.throws(()=>source.recognizeSupervisionLedger(ledger));
    assert.throws(()=>source.verifySupervisionLedger(fullLedger(),16));
});

test('changed migration SQL checksum fails source inspection before any operator connection',()=>{
    const exports={};const code=ts.transpileModule(readFileSync('scripts/preview-migration-source.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
    vm.runInNewContext(code,{exports,Buffer,require(name){if(name==='drizzle-orm/migrator')return {readMigrationFiles:()=>{
        const m=structuredClone(require('drizzle-orm/migrator').readMigrationFiles({migrationsFolder:'db/migrations'}));m[17].hash='changed';return m;}};return require(name);}});
    assert.throws(()=>exports.supervisionMigrationSource(),/source mismatch/);
});

test('0017 orchestration requires exact 0016, confirmations, preservation and refuses already applied without replay',async()=>{
    const before={target:'target',empty:false,ledger:fullLedger().slice(0,17),catalog:'before',preservedData:'old'};
    const after={...before,ledger:fullLedger(),catalog:'after'},hash=source.SUPERVISION_SOURCE_DIGEST;
    let current=before,writes=0;
    const io={inspect:async()=>current,apply:async()=>{writes++;current=after;return after.catalog;}};
    const approval={execute:true,target:'target',source:hash};
    for(const state of [after,{...before,ledger:[]},{...before,preservedData:undefined},{...before,empty:true}]){
        current=state;await assert.rejects(upgradePreview0017(io,approval,hash));assert.equal(writes,0);
    }
    current=before;
    for(const patch of [{execute:false},{source:'wrong'},{target:'wrong'}])await assert.rejects(upgradePreview0017(io,{...approval,...patch},hash));
    assert.equal(writes,0);assert.equal(await upgradePreview0017(io,approval,hash),'upgraded-0017-confirmed');assert.equal(writes,1);
});

test('read-only 0017 inspection recognizes pending and installed targets; preserves all 0016 rows/catalog/sequences',async()=>{
    const {db,cli,inspected}=await inspectedCli();
    assert.equal(inspected.state,'pending-0017');assert.equal(inspected.ledgerEntries,17);
    assert.equal(inspected.canonicalSchemaVerified,true);assert.equal(cli.schemaModes.length,0);
    assert.equal(cli.connections[0].connection.default_transaction_read_only,true);
    const before=await cli.api.inspectPreviewState(db.tx,config,'0017');db.state.entries=18;db.state.grants=6;
    const after=await cli.api.inspectPreviewState(db.tx,config,'0017');assert.equal(before.preservedData,after.preservedData);
    for(const [key,value]of [['pushHash','changed'],['oldSequence','changed'],['oldAcl','widened']]){
        const saved=db.state[key];db.state[key]=value;
        assert.notEqual((await cli.api.inspectPreviewState(db.tx,config,'0017')).preservedData,before.preservedData);db.state[key]=saved;
    }
    const second=cliDouble(db);assert.equal((await second.api.main(['--inspect-upgrade-0017'])).exitStatus,0);
    assert.equal(JSON.parse(second.output[0]).state,'already-applied');
    assert.ok(db.state.queries.every(q=>/^select |^set local /i.test(q.text)));
});

test('wrong pinned target or purpose is rejected before driver construction',async()=>{
    for(const patch of [{environment:'production'},{purpose:'runtime'},{endpoint:{database:'other'}},
        ...['projectRef','databaseOid','cluster','runtimeRole','operatorRole'].map(k=>({observed:{...config.observed,[k]:'wrong'}}))]){
        const cli=cliDouble(databaseDouble(),undefined,patch);const result=await cli.api.main(['--inspect-upgrade-0017']);
        assert.equal(result.exitStatus,1);assert.equal(cli.connections.length,0);
    }
});

test('partial schema, missing constraint, unsafe runtime and missing existing operational privilege refuse read-only',async()=>{
    for(const mutate of [s=>{s.entries=16;},s=>{s.relations=relations(18);},s=>{s.constraints=shape(17).constraints.slice(1);},
        s=>{s.boundary={truncate:true};},s=>{s.missingRequired=true;},s=>{s.entries=18;s.grants=3;}]){
        const db=databaseDouble();mutate(db.state);const cli=cliDouble(db);
        await assert.rejects(cli.api.inspectPreviewState(db.tx,config,'0017'));assert.equal(db.state.writes,false);
        assert.ok(!db.state.queries.some(q=>/^grant /i.test(q.text)));
    }
});

test('required new CHECK/FK/PK names and validation states are checked in read-only preflight',()=>{
    const {snapshot,columns,constraints}=shape(18);supervision.verifySupervisionCatalogShape(snapshot,columns,constraints);
    for(const name of ['main_adviser_singleton_check','main_adviser_revision_check','main_adviser_configuration_check',
        'co_adviser_distinct_actor_check','co_adviser_recommendation_check','co_adviser_lifecycle_check',
        'co_adviser_review_assignments_submission_id_submissions_id_fk','main_adviser_designation_pkey']){
        assert.throws(()=>supervision.verifySupervisionCatalogShape(snapshot,columns,constraints.filter(c=>c.conname!==name)));
    }
    assert.throws(()=>supervision.verifySupervisionCatalogShape(snapshot,columns.slice(1),constraints));
    assert.throws(()=>supervision.verifySupervisionCatalogShape(snapshot,columns,constraints.map((c,i)=>i?c:{...c,convalidated:false})));
});

test('new canonical schema modes select 0016/0017 snapshots and reject unexpected tables before temporary DDL',async()=>{
    const sentinel=Error('stop before canonical SQL');
    for(const mode of ['supervision-baseline','upgrade-0017']){
        const snapshot=mode==='upgrade-0017'?source.supervisionMigrationSource().snapshot:source.workspaceMigrationSource().snapshot;
        await assert.rejects(verifyPreviewSchema(async parts=>{if(parts.join('').includes('select tablename'))return Object.values(snapshot.tables).map(t=>({tablename:t.name})).sort((a,b)=>a.tablename.localeCompare(b.tablename));throw sentinel;},mode),e=>e===sentinel);
        await assert.rejects(verifyPreviewSchema(async()=>[],mode),e=>e instanceof PreviewSchemaAssertion);
    }
});

// Exercise the real canonical verifier's new-table branches with a synthetic catalog/parser double.
// Returned canonical SQL is fixture data, never PostgreSQL evidence.
function canonicalDouble(defect) {
    const tables=Object.fromEntries(Object.entries(source.supervisionMigrationSource().snapshot.tables).filter(([k])=>/public\.(?:main_adviser_designation|co_adviser_review_assignments)$/.test(k)));
    const snapshot={tables},exports={};
    const code=ts.transpileModule(readFileSync('scripts/preview-schema.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
    vm.runInThisContext('(function(exports, require) {\n'+code+'\n})')(exports,name=>{
        if(name==='./preview-migration-source')return {...source,supervisionMigrationSource:()=>({snapshot})};if(name.startsWith('./'))return require('../scripts/'+name.slice(2)+'.ts');return require(name);
    });
    let table,canonicalCheck='',canonicalDefault='',canonicalIndex='';
    const constraints=t=>[
        {name:t.name+'_pkey',type:'p',columns:['id']},
        ...Object.values(t.foreignKeys).map(f=>({name:f.name.slice(0,63),type:'f',target:defect==='fk'?'wrong':f.tableTo,target_schema:'public',confmatchtype:'s',
            columns:f.columnsFrom,referenced:f.columnsTo,confdeltype:'r',confupdtype:'a'})),
        ...Object.values(t.checkConstraints).map(c=>({name:c.name,type:'c',definition:'CHECK ('+c.value.replaceAll('"'+t.name+'".','')+')'+(defect==='check'?' changed':'')})),
    ].map(c=>({...c,convalidated:true,enforced:true,condeferrable:false,condeferred:false}));
    const indexDef=item=>'CREATE '+(item.isUnique?'UNIQUE ':'')+'INDEX synthetic ON synthetic USING '+item.method+' ('+item.columns.map(c=>'"'+c.expression+'" '+(c.asc?'asc':'desc')+' nulls '+c.nulls).join(',')+')'+(item.where?' where '+item.where.replaceAll('"'+table.name+'".',''):'');
    const query=(text,params=[])=>{
        if(text.startsWith('alter table pg_temp.phase102b_check add constraint'))canonicalCheck='CHECK ('+text.slice(text.indexOf('check (')+7,-1)+')';
        if(text.startsWith('alter table pg_temp.phase102b_check alter column'))canonicalDefault=text.slice(text.indexOf(' set default ')+13);
        if(text.startsWith('create ')&&text.includes('index phase102b_expected'))canonicalIndex='CREATE '+(text.includes('unique')?'UNIQUE ':'')+'INDEX synthetic ON synthetic'+text.slice(text.indexOf(' using ')).replace(' using ',' USING ');
        if(text.includes('select tablename'))return Object.values(tables).map(t=>({tablename:t.name})).sort((a,b)=>a.tablename.localeCompare(b.tablename));
        if(text.includes('select relrowsecurity')){table=tables[params[0]];return [{relrowsecurity:false,relforcerowsecurity:false}];}
        if(text.includes('select a.attname as name'))return Object.values(table.columns).map(c=>({name:c.name,type:c.type==='serial'?'integer':c.type.replace(/^varchar/,'character varying'),not_null:c.notNull,default_collation:true,
            default_value:c.type==='serial'?"nextval('co_adviser_review_assignments_id_seq'::regclass)":Object.hasOwn(c,'default')?String(c.default):null}));
        if(text.includes('pg_get_serial_sequence'))return [{sequence:'public.co_adviser_review_assignments_id_seq'}];
        if(text.includes('select k.conname as name'))return constraints(table);
        if(text.includes('select pg_get_expr'))return [{value:canonicalDefault}];
        if(text.includes('select pg_get_constraintdef'))return [{definition:canonicalCheck}];
        if(text.includes('select indexname,indexdef'))return [{indexname:table.name+'_pkey',indexdef:'CREATE UNIQUE INDEX pk'},...Object.values(table.indexes).map(i=>({indexname:i.name,indexdef:indexDef(i)+(defect==='index'?' changed':'')}))];
        if(text.includes('select pg_get_indexdef'))return [{definition:canonicalIndex}];
        if(text.includes('count(*)'))return [{count:0}];
        if(text.includes('select id,main_adviser_id'))return [{id:1,main_adviser_id:defect==='singleton'?7:null,revision:0,updated_by:null}];
        if(text.includes('from pg_sequences'))return [{sequencename:'co_adviser_review_assignments_id_seq',start_value:'1',min_value:'1',max_value:'2147483647',increment_by:'1',cache_size:'1',cycle:false}];
        if(text.includes('select c.relname as name'))return Object.values(tables).flatMap(t=>[{name:t.name,kind:'r',owned:true},{name:t.name+'_pkey',kind:'i',owned:true},
            ...Object.keys(t.indexes).map(name=>({name,kind:'i',owned:true})),...(t.name==='co_adviser_review_assignments'?[{name:'co_adviser_review_assignments_id_seq',kind:'S',owned:true}]:[])]).sort((a,b)=>a.name.localeCompare(b.name));
        if(text.includes('as routines'))return [{routines:false,types:false}];
        if(text.includes('last_value::text'))return [{value:'1',is_called:defect==='sequence'}];
        if(text.includes('as triggers'))return [{triggers:false}];
        if(/^(?:create|alter|drop)/.test(text))return [];
        throw Error('Unexpected synthetic catalog query: '+text);
    };
    const sql=(parts,...params)=>typeof parts==='string'?{identifier:parts}:Promise.resolve(query(parts.join('?'),params));sql.unsafe=async text=>query(text);
    return ()=>exports.verifyPreviewSchema(sql,'upgrade-0017');
}
test('canonical new-table verifier checks expressions, FK targets, partial index, singleton and sequence properties',async()=>{
    const result=await canonicalDouble()();assert.equal(result.tables,2);
    for(const defect of ['check','fk','index','singleton','sequence'])await assert.rejects(canonicalDouble(defect)(),e=>e.name==='Error'&&e.message==='Preview schema assertion failed.');
});

test('only minimum new runtime grants are emitted after exact 18 ledger; missing, excess or exposed access rejects',async()=>{
    const db=databaseDouble(18);db.state.writes=true;db.state.grants=3;
    await supervision.grantSupervisionRuntime(db.tx);
    assert.deepEqual(db.state.queries.filter(q=>/^grant /i.test(q.text)).map(q=>q.text),[
        'grant select,update on table public.main_adviser_designation to thesishs_preview_runtime',
        'grant select,insert,update on table public.co_adviser_review_assignments to thesishs_preview_runtime',
        'grant usage on sequence public.co_adviser_review_assignments_id_seq to thesishs_preview_runtime']);
    for(const mutate of [s=>{s.access={allowed:false};},s=>{s.access={allowed:true};},s=>{s.access={grantable:true};},s=>{s.publicAccess=true;},s=>{s.exposed=true;},s=>{s.missingRequired=true;}]){
        const other=databaseDouble(18);mutate(other.state);await assert.rejects(supervision.verifySupervisionRuntime(other.tx,true));
    }
    const partial=databaseDouble();await assert.rejects(supervision.grantSupervisionRuntime(partial.tx));assert.ok(!partial.state.queries.some(q=>/^grant /i.test(q.text)));
});

function backupFixture(){
    const before={target:'target',catalog:'catalog',preservedData:'old',empty:false,ledger:fullLedger().slice(0,17)};
    const archive=Buffer.from('PGDMP-synthetic-offline-archive-double');
    const record={version:1,scope:'preview-0017-backup',projectRef:config.observed.projectRef,database:'postgres',databaseOid:'5',cluster:config.observed.cluster,
        source:source.SUPERVISION_SOURCE_DIGEST,target:before.target,catalog:before.catalog,preservedData:before.preservedData,
        archiveSha256:createHash('sha256').update(archive).digest('hex'),inventoryVerified:true,fullArchiveDecoded:true,privateStorageVerified:true,
        ledgerIncluded:true,sequencesIncluded:true,privilegesRecorded:true,verifiedAt:new Date().toISOString(),tables:Object.values(source.workspaceMigrationSource().snapshot.tables).map(t=>t.name)};
    return {before,archive,record};
}
test('backup evidence binds verified archive bytes, exact target/source/catalog, all 19 tables/ledger/sequences and freshness',()=>{
    const {before,archive,record}=backupFixture();assert.equal(supervision.verifySupervisionBackup(record,archive,before).sha256,record.archiveSha256);
    for(const patch of [{target:'wrong'},{source:'wrong'},{catalog:'wrong'},{preservedData:'changed'},{databaseOid:'other'},
        {archiveSha256:'wrong'},{inventoryVerified:false},{fullArchiveDecoded:false},{privateStorageVerified:false},{privilegesRecorded:false},
        {ledgerIncluded:false},{sequencesIncluded:false},{tables:record.tables.slice(1)},{verifiedAt:'invalid'},{verifiedAt:'2000-01-01T00:00:00Z'},
        {verifiedAt:new Date(Date.now()+60000).toISOString()}])assert.throws(()=>supervision.verifySupervisionBackup({...record,...patch},archive,before));
    assert.throws(()=>supervision.verifySupervisionBackup(record,Buffer.from('invalid'),before));
    assert.throws(()=>supervision.verifySupervisionBackup(record,archive,{...before,ledger:fullLedger()}));
    assert.throws(()=>supervision.readSupervisionBackup('package.json','a'.repeat(64),before),/prerequisites/);
});

test('installed Drizzle/session applies exactly 0017 with one ledger write; no historical SQL or replay',async()=>{
    const db=databaseDouble();db.state.writes=true;await operator.applyPreviewMigrations(db.tx,db.root.options,'0017');
    assert.equal(db.state.entries,18);assert.equal(db.state.savepoints,1);
    assert.equal(db.state.queries.filter(q=>q.text.includes('insert into "drizzle"."__drizzle_migrations"')).length,1);
    assert.ok(db.state.queries.some(q=>q.text.includes('CREATE TABLE "co_adviser_review_assignments"')));
    assert.ok(!db.state.queries.some(q=>/CREATE TABLE "(?:users|group_tasks|push_subscriptions)"/.test(q.text)));
    await assert.rejects(operator.applyPreviewMigrations(db.tx,db.root.options,'0017'));
});

test('CLI success requires backup, 19 old-table writer locks, canonical pre/post and durable read-only inspection',async()=>{
    const {db,cli,inspected}=await inspectedCli();const result=await cli.api.main(['--upgrade-0017',...approvals(inspected)]);
    assert.equal(result.exitStatus,0);assert.equal(result.commitConfirmed,true);assert.equal(db.state.entries,18);assert.equal(db.state.grants,6);
    assert.deepEqual(cli.schemaModes,['supervision-baseline','upgrade-0017']);
    assert.equal(db.state.queries.filter(q=>q.text.startsWith('lock table ?')).length,19);
    assert.equal(db.state.begins.filter(m=>m==='write').length,1);assert.ok(db.state.begins.at(-1).includes('read only'));
});

test('already applied CLI execution refuses before backup, temporary SQL, grants or write transaction',async()=>{
    const {db,cli,inspected}=await inspectedCli(databaseDouble(18));const result=await cli.api.main(['--upgrade-0017',...approvals(inspected)]);
    assert.equal(result.exitStatus,1);assert.equal(result.executionBegan,false);assert.equal(db.state.begins.filter(m=>m==='write').length,0);
    assert.equal(cli.schemaModes.length,0);assert.ok(!db.state.queries.some(q=>/^grant /i.test(q.text)));
});

test('missing/waived/ambiguous backup confirmations reject before connection; invalid private backup prevents writes',async()=>{
    const {cli,inspected}=await inspectedCli();const args=approvals(inspected);
    for(const invalid of [[],args.slice(0,-2),[...args,'--accept-preview-no-backup-risk','yes'],[...args,'--recovery-mode','synthetic-accounts'],
        args.map(v=>v==='yes'?'no':v),[...args,'--confirm-target','duplicate']]){
        const count=cli.connections.length;assert.equal((await cli.api.main(['--upgrade-0017',...invalid])).exitStatus,1);assert.equal(cli.connections.length,count);
    }
    cli.process.stdin.isTTY=false;
    const connections=cli.connections.length;assert.equal((await cli.api.main(['--upgrade-0017',...args])).exitStatus,1);
    assert.equal(cli.connections.length,connections);
    const f=await inspectedCli(databaseDouble(),undefined,{},true);const result=await f.cli.api.main(['--upgrade-0017',...approvals(f.inspected)]);
    assert.equal(result.exitStatus,1);assert.equal(result.executionBegan,false);assert.equal(f.db.state.begins.filter(m=>m==='write').length,0);
    assert.equal(result.stage,'private backup verification');
    assert.doesNotMatch(f.cli.output.join('\n'),/private backup path failure|never-connected/);
});

test('schema/grant failure rolls back once; no destructive SQL, replay or leaked private errors',async()=>{
    for(const failure of ['supervision-baseline','upgrade-0017','grant select,insert,update on table public.co_adviser_review_assignments']){
        const {db,cli,inspected}=await inspectedCli(databaseDouble(),failure);if(failure.startsWith('grant'))db.state.fail=failure;
        const result=await cli.api.main(['--upgrade-0017',...approvals(inspected)]);
        assert.equal(result.exitStatus,1);assert.equal(result.durableInspectionRequired,true);assert.equal(result.commitConfirmed,false);
        assert.equal(db.state.entries,17);assert.equal(db.state.grants,3);assert.equal(db.state.begins.filter(m=>m==='write').length,1);
        assert.doesNotMatch(cli.output.join('\n'),/private SQL failure|never-connected/);
        assert.ok(!db.state.queries.some(q=>/^(?:truncate|delete|drop table public|restore)/i.test(q.text)));
    }
});

test('uncertain commit, changed durable catalog/preservation, or unavailable readback never triggers automatic replay/recovery',async()=>{
    const before={target:'target',empty:false,ledger:fullLedger().slice(0,17),catalog:'old',preservedData:'old-data'};
    const after={...before,ledger:fullLedger(),catalog:'new'},hash=source.SUPERVISION_SOURCE_DIGEST;
    for(const failure of ['uncertain','catalog','data','inspection']){
        let state=before,writes=0,reads=0;
        const io={inspect:async()=>{reads++;if(failure==='inspection'&&reads===2)throw Error('unavailable');return state;},apply:async()=>{
            writes++;state={...after,...(failure==='catalog'?{catalog:'different'}:failure==='data'?{preservedData:'different'}:{})};
            if(failure==='uncertain')throw Error('uncertain acknowledgement');return after.catalog;}};
        await assert.rejects(upgradePreview0017(io,{execute:true,target:before.target,source:hash},hash));assert.equal(writes,1);assert.equal(reads,2);
    }
});
