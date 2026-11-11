/* eslint-disable @typescript-eslint/no-require-imports */
// Extends the existing synthetic catalog pattern. No PostgreSQL instance, credentials or network.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {verifyPreviewCatalog,PreviewSchemaAssertion}=require('../scripts/preview-schema.ts');
const {catalogCheck,catalogDefault,catalogIndex,catalogIdentifier}=require('../scripts/preview-catalog-contract.ts');
const source=require('../scripts/preview-migration-source.ts');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');

function fixture(entries=17,mutate=()=>{}) {
    const snapshot=(entries===20?source.revisionMigrationSource():entries===19?source.progressMigrationSource():entries===18?source.supervisionMigrationSource():source.workspaceMigrationSource()).snapshot;
    const constraints=t=>[
        ...Object.values(t.foreignKeys).map(f=>({name:f.name.slice(0,63),type:'f',target:f.tableTo,target_schema:'public',confmatchtype:'s',
            columns:f.columnsFrom,referenced:f.columnsTo,confdeltype:({'no action':'a',restrict:'r',cascade:'c','set null':'n'})[f.onDelete],confupdtype:'a'})),
        ...Object.values(t.checkConstraints).map(c=>({name:c.name,type:'c',definition:catalogCheck(c.name)})),
        ...Object.values(t.uniqueConstraints).map(c=>({name:c.name.slice(0,63),type:'u',columns:c.columns})),
        ...Object.values(t.compositePrimaryKeys).map(c=>({name:c.name.slice(0,63),type:'p',columns:c.columns})),
        ...(Object.values(t.columns).some(c=>c.primaryKey)?[{name:t.name+'_pkey',type:'p',columns:Object.values(t.columns).filter(c=>c.primaryKey).map(c=>c.name)}]:[]),
    ].map(c=>({...c,convalidated:true,enforced:true,condeferrable:false,condeferred:false}));
    const tables=Object.values(snapshot.tables).map(t=>({name:t.name,security:{relrowsecurity:false,relforcerowsecurity:false},
        columns:Object.values(t.columns).map(c=>({name:c.name,type:c.type==='serial'?'integer':c.type.replace(/^varchar/,'character varying').replace(/^timestamp$/,'timestamp without time zone'),
            not_null:c.notNull,default_collation:true,attidentity:'',attgenerated:'',default_value:c.type==='serial'?`nextval('${t.name}_${c.name}_seq'::regclass)`:catalogDefault(c)})),
        constraints:constraints(t),indexes:[...Object.values(t.indexes).map(i=>({indexname:i.name,indexdef:catalogIndex(t.name,i)})),
            ...constraints(t).filter(c=>['p','u'].includes(c.type)).map(c=>({indexname:c.name,indexdef:`CREATE UNIQUE INDEX ${c.name} ON public.${t.name} USING btree (${c.columns.map(catalogIdentifier).join(', ')})`}))],
        health:constraints(t).filter(c=>['p','u'].includes(c.type)).concat(Object.values(t.indexes)).map(()=>({indisvalid:true,indisready:true,indislive:true,indimmediate:true})),
    }));
    const sequenceNames=Object.values(snapshot.tables).flatMap(t=>Object.values(t.columns).filter(c=>c.type==='serial').map(c=>t.name+'_'+c.name+'_seq')).sort();
    const state={tables,serials:sequenceNames.map(sequencename=>({sequencename,start_value:'1',min_value:'1',max_value:'2147483647',increment_by:'1',cache_size:'1',cycle:false})),
        objects:tables.flatMap(t=>[{name:t.name,kind:'r',owned:true},...t.indexes.map(i=>({name:i.indexname,kind:'i',owned:true}))]).concat(sequenceNames.map(name=>({name,kind:'S',owned:true}))).sort((a,b)=>a.name.localeCompare(b.name)),
        ledgerObjects:[['__drizzle_migrations','r'],['__drizzle_migrations_id_seq','S'],['__drizzle_migrations_pkey','i']].map(([relname,relkind])=>({relname,relkind,owned:true,relrowsecurity:false,relforcerowsecurity:false})),
        ledgerColumns:[{name:'id',type:'integer',not_null:true,default_value:"nextval('drizzle.__drizzle_migrations_id_seq'::regclass)",attidentity:'',attgenerated:''},
            {name:'hash',type:'text',not_null:true,default_value:null,attidentity:'',attgenerated:''},{name:'created_at',type:'bigint',not_null:false,default_value:null,attidentity:'',attgenerated:''}],
        ledgerConstraints:[{conname:'__drizzle_migrations_pkey',contype:'p',definition:'PRIMARY KEY (id)',convalidated:true,condeferrable:false,condeferred:false}],
        bindings:{custom_bindings:false,rules:false},extras:{routines:false,types:false},triggers:false,sequenceOwner:true,
        singleton:[{id:1,main_adviser_id:null,revision:0,updated_by:null}],newCount:0,newSequenceCalled:false,queries:[]};
    mutate(state);
    let table;
    const query=(text,params)=>{
        state.queries.push(text);assert.match(text,/^select\s/i,'catalog verifier emitted non-SELECT SQL');
        if(text.includes("where n.nspname='drizzle'"))return state.ledgerObjects;
        if(text.includes("a.attrelid='drizzle.__drizzle_migrations'"))return state.ledgerColumns;
        if(text.includes("from pg_constraint where conrelid='drizzle"))return state.ledgerConstraints;
        if(text.includes("pg_get_serial_sequence('drizzle"))return [{sequence:'drizzle.__drizzle_migrations_id_seq'}];
        if(text.includes("schemaname='drizzle'"))return [{sequencename:'__drizzle_migrations_id_seq',start_value:'1',min_value:'1',max_value:'2147483647',increment_by:'1',cycle:false,cache_size:'1'}];
        if(text.includes("i.indrelid='drizzle"))return [{definition:'CREATE UNIQUE INDEX __drizzle_migrations_pkey ON drizzle.__drizzle_migrations USING btree (id)',indisvalid:true,indisready:true,indislive:true,indimmediate:true}];
        if(text.includes("tgrelid='drizzle"))return [{triggers:false,rules:false}];
        if(text.includes('select tablename'))return state.tables.map(t=>({tablename:t.name})).sort((a,b)=>a.tablename.localeCompare(b.tablename));
        if(text.includes('select relrowsecurity')){table=state.tables.find(t=>'public.'+t.name===params[0]);return [table.security];}
        if(text.includes('select a.attname as name'))return table.columns;
        if(text.includes('pg_get_serial_sequence'))return [{sequence:state.sequenceOwner?params[0]+'_'+params[1]+'_seq':'public.wrong_seq'}];
        if(text.includes('select k.conname as name'))return table.constraints;
        if(text.includes('select indexname,indexdef'))return table.indexes;
        if(text.includes('select i.indisvalid'))return table.health;
        if(text.includes('select count(*)'))return [{count:state.newCount}];
        if(text.includes('select id,main_adviser_id'))return state.singleton;
        if(text.includes('from pg_sequences'))return state.serials;
        if(text.includes('select c.relname as name'))return state.objects;
        if(text.includes('as routines'))return [state.extras];
        if(text.includes('last_value::text'))return [{value:'1',is_called:state.newSequenceCalled}];
        if(text.includes('as custom_bindings'))return [state.bindings];
        if(text.includes('as triggers'))return [{triggers:state.triggers}];
        throw Error('Unexpected synthetic query: '+text);
    };
    const sql=(parts,...params)=>typeof parts==='string'?{identifier:parts}:Promise.resolve(query(parts.join('?').trim(),params));
    sql.unsafe=()=>{throw Error('unsafe SQL is forbidden in catalog inspection');};
    return {state,run:(mode=entries===20?'revision-installed':entries===19?'progress-installed':entries===18?'supervision-installed':'supervision-baseline')=>verifyPreviewCatalog(sql,mode)};
}

test('complete canonical 0016 and installed 0017 catalogs pass with SELECT-only SQL',async()=>{
    for(const entries of [17,18]){const f=fixture(entries);const r=await f.run();assert.equal(r.tables,entries===17?19:21);assert.ok(f.state.queries.length>100);}
});

const cases={
    'missing CHECK':s=>s.tables.find(t=>t.name==='group_tasks').constraints.pop(),
    'altered CHECK':s=>s.tables.find(t=>t.name==='group_tasks').constraints.find(c=>c.type==='c').definition+=' OR true',
    'NOT VALID':s=>s.tables[0].constraints[0].convalidated=false,
    'wrong FK target':s=>s.tables.find(t=>t.name==='group_members').constraints.find(c=>c.type==='f').target='users_other',
    'wrong FK action':s=>s.tables.find(t=>t.name==='group_members').constraints.find(c=>c.type==='f').confdeltype='c',
    'changed UNIQUE keys':s=>s.tables.find(t=>t.name==='users').constraints.find(c=>c.type==='u').columns=['id'],
    'wrong default':s=>s.tables.find(t=>t.name==='users').columns.find(c=>c.name==='is_active').default_value='false',
    'unexpected default':s=>s.tables.find(t=>t.name==='users').columns.find(c=>c.name==='email').default_value="'x'::character varying",
    'wrong column type':s=>s.tables[0].columns[0].type='bigint',
    'generated column':s=>s.tables[0].columns[0].attgenerated='s',
    'wrong index definition':s=>s.tables.find(t=>t.name==='group_tasks').indexes[0].indexdef+=' INCLUDE (status)',
    'invalid index':s=>s.tables[0].health[0].indisvalid=false,
    'wrong constraint index':s=>s.tables[0].indexes.find(i=>i.indexname.endsWith('_pkey')).indexdef+=' WHERE false',
    'wrong partial predicate':s=>s.tables.find(t=>t.name==='ai_pilot_attempts').indexes.find(i=>i.indexname==='ai_pilot_one_active_idx').indexdef+=' OR true',
    'sequence ownership':s=>s.sequenceOwner=false,
    'sequence increment':s=>s.serials[0].increment_by='2',
    'unexpected object':s=>s.objects.push({name:'unexpected',kind:'r',owned:true}),
    'missing table':s=>s.tables.pop(),
    'unexpected owner':s=>s.objects[0].owned=false,
    'unexpected RLS':s=>s.tables[0].security.relrowsecurity=true,
    'unexpected trigger':s=>s.triggers=true,
    'custom function binding':s=>s.bindings.custom_bindings=true,
    'rewrite rule':s=>s.bindings.rules=true,
    'altered ledger column':s=>s.ledgerColumns[1].type='character varying(64)',
    'altered ledger PK':s=>s.ledgerConstraints[0].definition='PRIMARY KEY (hash)',
    'unexpected ledger object':s=>s.ledgerObjects.push({relname:'other',relkind:'r',owned:true}),
};
for(const [name,mutate]of Object.entries(cases))test('catalog refuses '+name+' without DDL',async()=>{
    const f=fixture(17,mutate);await assert.rejects(f.run(),e=>e instanceof PreviewSchemaAssertion);
    assert.ok(f.state.queries.every(q=>/^select\s/i.test(q)));
});

test('0017 additive constraints, partial pair uniqueness, singleton and fresh sequence are enforced',async()=>{
    await fixture(18).run('upgrade-0017');
    for(const mutate of [s=>s.tables.find(t=>t.name==='co_adviser_review_assignments').constraints.pop(),
        s=>s.tables.find(t=>t.name==='co_adviser_review_assignments').indexes[0].indexdef+=' OR true',
        s=>s.singleton[0].main_adviser_id=7,s=>s.newCount=1,s=>s.newSequenceCalled=true])await assert.rejects(fixture(18,mutate).run('upgrade-0017'));
    // Inspection of an installed target permits legitimate later rows/designation/sequence use.
    await fixture(18,s=>{s.singleton=[];s.newCount=4;s.newSequenceCalled=true;}).run();
});

test('finite expression contract preserves literal content and refuses unsupported source shapes',()=>{
    // Each exact CHECK is one complete CHECK expression; quoted literal contents are untouched.
    for(const t of Object.values(source.supervisionMigrationSource().snapshot.tables))for(const c of Object.values(t.checkConstraints)){
        const text=catalogCheck(c.name).replace(/'(?:[^']|'')*'/g,"''");let depth=0;
        assert.ok(text.startsWith('CHECK ('));
        for(let i=6;i<text.length;i++){
            if(text[i]==='(')depth++;if(text[i]===')')depth--;
            assert.ok(depth>0||i===text.length-1,c.name+' closed early');
        }assert.equal(depth,0,c.name);
    }
    assert.equal(catalogCheck('main_adviser_singleton_check'),'CHECK ((id = 1))');
    assert.equal(catalogCheck('group_tasks_status_check'),"CHECK (((status)::text = ANY ((ARRAY['To Do'::character varying, 'In Progress'::character varying, 'Done'::character varying])::text[])))");
    assert.throws(()=>catalogCheck('new_unreviewed_check'));
    assert.throws(()=>catalogDefault({type:'text',default:'unsafe()'}));
    const i=source.supervisionMigrationSource().snapshot.tables['public.co_adviser_review_assignments'].indexes.co_adviser_open_assignment_unique;
    assert.equal(catalogIndex('co_adviser_review_assignments',i),"CREATE UNIQUE INDEX co_adviser_open_assignment_unique ON public.co_adviser_review_assignments USING btree (submission_id, co_adviser_id) WHERE ((state)::text = 'open'::text)");
    for(const patch of [{method:'hash'},{with:{fillfactor:50}},{where:'true'},{columns:[{expression:'submission_id',isExpression:false,asc:false,nulls:'last'}]}])assert.throws(()=>catalogIndex('co_adviser_review_assignments',{...i,...patch}));
});

test('existing explicit local verifier still uses PostgreSQL temporary canonicalization',async()=>{
    const exports={};const code=ts.transpileModule(readFileSync('scripts/preview-schema.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
    const table=source.workspaceMigrationSource().snapshot.tables['public.activity_logs'];
    // Preserve its expected local ownership helper input, stopping at the first temporary statement.
    vm.runInThisContext('(function(exports,require){'+code+'\n})')(exports,name=>name==='./preview-migration-source'?{...source,workspaceMigrationSource:()=>({snapshot:{tables:{'public.activity_logs':table}}})}:name.startsWith('./')?require('../scripts/'+name.slice(2)+'.ts'):require(name));
    const f=fixture();const sentinel=Error('local temporary canonicalization reached');let current;
    const sql=(parts,...params)=>{
        if(typeof parts==='string')return {identifier:parts};const text=parts.join('?');
        if(text.includes('create temporary table'))throw sentinel;
        if(text.includes('select tablename'))return Promise.resolve([{tablename:'activity_logs'}]);
        if(text.includes('select relrowsecurity'))return Promise.resolve([{relrowsecurity:false,relforcerowsecurity:false}]);
        if(text.includes('select a.attname as name')){current=f.state.tables.find(t=>t.name==='activity_logs');return Promise.resolve(current.columns);}
        if(text.includes('pg_get_serial_sequence'))return Promise.resolve([{sequence:params[0]+'_'+params[1]+'_seq'}]);
        if(text.includes('select k.conname'))return Promise.resolve(current.constraints);
        throw Error('unexpected local fixture query');
    };
    await assert.rejects(exports.verifyLocalWorkspaceSchema(sql,17),e=>e===sentinel);
});


test('0018 installed and new catalogs retain exact composite evidence FK, verification checks and fresh sequence',async()=>{
    const result=await fixture(19).run('upgrade-0018');assert.equal(result.tables,22);
    for(const mutate of [
        s=>s.tables.find(t=>t.name==='research_milestones').constraints.find(c=>c.name==='research_milestones_submission_paper_fk').referenced=['id','id'],
        s=>s.tables.find(t=>t.name==='research_milestones').constraints.find(c=>c.name==='research_milestones_verification_check').definition+=' OR true',
        s=>s.tables.find(t=>t.name==='submissions').constraints.find(c=>c.name==='submissions_id_paper_unique').columns=['id'],
        s=>s.newCount=1,s=>s.newSequenceCalled=true,
    ])await assert.rejects(fixture(19,mutate).run('upgrade-0018'));
    await fixture(19,s=>{s.newCount=2;s.newSequenceCalled=true;}).run();
});

test('0019 catalog verifies immutable correction links, own-response uniqueness and both fresh tables/sequences',async()=>{
    assert.equal((await fixture(20).run('upgrade-0019')).tables,24);
    for(const mutate of [
        s=>s.tables.find(t=>t.name==='revision_items').constraints.find(c=>c.type==='f').target='submissions',
        s=>s.tables.find(t=>t.name==='revision_responses').constraints.find(c=>c.name==='revision_responses_item_student_unique').columns=['item_id'],
        s=>s.tables.find(t=>t.name==='revision_items').constraints.find(c=>c.name==='revision_items_correction_check').definition+=' OR true',
        s=>s.newCount=1,s=>s.newSequenceCalled=true,
    ])await assert.rejects(fixture(20,mutate).run('upgrade-0019'));
    await fixture(20,s=>{s.newCount=2;s.newSequenceCalled=true;}).run();
});
