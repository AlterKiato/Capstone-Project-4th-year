/* eslint-disable @typescript-eslint/no-require-imports */
// Offline guards only. No credential-file loading, database, backup or provider access.
const assert=require('node:assert/strict'),{test}=require('node:test'),path=require('node:path');
const source=require('../scripts/preview-migration-source.ts');
const policy=require('../scripts/preview-evaluations.ts');
const op=require('../scripts/initialize-preview-database.ts');
const cli=require('../scripts/migrate-preview-evaluations.ts');
const ledger=n=>source.coEvaluationMigrationSource().migrations.slice(0,n).map((m,i)=>({id:1+i*2,hash:m.hash,created_at:String(m.folderMillis)}));
const state=n=>({empty:false,target:'approved-preview',catalog:n===21?'before':'after',preservedData:'old-records',ledger:ledger(n)});
const approval={execute:true,target:'approved-preview',source:source.coEvaluationMigrationSource().hash};

test('inert CLI requires explicit private profile and all separate execution confirmations',()=>{
    const profile=path.resolve('private-profile-placeholder.env');
    assert.equal(cli.evaluationArguments(['--inspect','--profile',profile],false).execute,false);
    const args=['--execute','--profile',profile,'--confirm-target','a'.repeat(64),'--confirm-source',approval.source,
        '--confirm-data-api-disabled','yes','--backup-evidence',path.resolve('private-backup-placeholder.json'),'--confirm-backup','b'.repeat(64)];
    assert.equal(cli.evaluationArguments(args,true).execute,true);
    for(const a of [[],['--inspect'],['--inspect','--profile','relative.env'],['--inspect','--profile',profile,'--profile',profile],args.slice(0,-2),[...args,'--repair','yes']])assert.throws(()=>cli.evaluationArguments(a,true));
    assert.throws(()=>cli.evaluationArguments(args,false));
    assert.throws(()=>cli.evaluationArguments(args.map(x=>x==='yes'?'no':x),true));
});
test('target guards reject local, Production, wrong project/cluster/role, pooler mode and relaxed TLS',()=>{
    const config={environment:'preview',purpose:'operator',mode:'session',endpoint:{host:'aws-0-ap-southeast-1.pooler.supabase.com',port:5432,database:'postgres',user:'thesishs_preview_operator.cbkplqkkjuoglpimwmib'},
        observed:{provider:'supabase',projectRef:'cbkplqkkjuoglpimwmib',databaseOid:'5',cluster:'7678069749886157684',runtimeRole:'thesishs_preview_runtime',operatorRole:'thesishs_preview_operator'},options:{ssl:{rejectUnauthorized:true,ca:'synthetic-public-ca'}}};
    op.verifyEvaluationTarget(config);
    const changes=[x=>x.environment='production',x=>x.environment='development',x=>x.purpose='runtime',x=>x.endpoint.host='localhost',x=>x.endpoint.port=6543,
        x=>x.endpoint.user='postgres',x=>x.observed.projectRef='another-project',x=>x.observed.cluster='7652422818440234372',x=>x.observed.databaseOid='16387',
        x=>x.observed.runtimeRole=x.observed.operatorRole,x=>x.mode='direct',x=>x.options.ssl=false,x=>x.options.ssl.rejectUnauthorized=false,x=>delete x.options.ssl.ca];
    for(const change of changes){const bad=structuredClone(config);change(bad);assert.throws(()=>op.verifyEvaluationTarget(bad));}
});
test('exact source suffix and complete ledger checks refuse partial/reordered/replayed histories',()=>{
    assert.deepEqual(source.coEvaluationMigrationSource().migrations.slice(0,21),source.emailOtpMigrationSource().migrations);
    assert.deepEqual(source.coEvaluationMigrationSource().migrations.slice(21).map(m=>m.hash),[
        'c25f2a298a40031c1d3601b8c27199b7c0c4a02f45f0a33d93b451bba7acbe18',
        '6eede979948ac7cb2476b479c8a756101073e92a0e8d382120e2677afdfb3c24',
        '86619dfff7d6caf9b7d862799d3450266e8f250c7a15f98f7c22cb7aed2f2889']);
    source.verifyEvaluationLedger(ledger(21),21);source.verifyEvaluationLedger(ledger(24),24);
    for(const n of [0,20,22,23])assert.throws(()=>source.recognizeEvaluationLedger(ledger(n)));
    for(const change of [x=>x[0].hash='foreign',x=>x[20].created_at='0',x=>x[1].id=x[0].id,x=>x[0].id=0]){const rows=ledger(21);change(rows);assert.throws(()=>source.verifyEvaluationLedger(rows,21));}
    assert.throws(()=>source.verifyEvaluationLedger(ledger(24),21));
});
test('approval/pre-state denial happens before apply; successful path makes one attempt and durable read',async()=>{
    for(const patch of [{execute:false},{target:'production'},{source:'wrong'}]){let writes=0;await assert.rejects(policy.upgradePreviewEvaluations({inspect:async()=>state(21),apply:async()=>{writes++;}},{...approval,...patch}));assert.equal(writes,0);}
    for(const n of [22,23,24]){let writes=0;await assert.rejects(policy.upgradePreviewEvaluations({inspect:async()=>state(n),apply:async()=>{writes++;}},approval));assert.equal(writes,0);}
    let reads=0,writes=0;assert.equal(await policy.upgradePreviewEvaluations({inspect:async()=>state(++reads===1?21:24),apply:async()=>{writes++;return'after';}},approval),'upgraded-evaluation-0021-0023-confirmed');assert.equal(writes,1);assert.equal(reads,2);
});
test('uncertain execution performs one durable inspection without replay; durable preservation drift fails',async()=>{
    let reads=0,writes=0;await assert.rejects(policy.upgradePreviewEvaluations({inspect:async()=>{reads++;return state(21);},apply:async()=>{writes++;throw Error('uncertain');}},approval),/unconfirmed/);assert.equal(reads,2);assert.equal(writes,1);
    for(const patch of [{target:'different'},{preservedData:'changed'},{catalog:'changed'}]){let n=0;await assert.rejects(policy.upgradePreviewEvaluations({inspect:async()=>++n===1?state(21):{...state(24),...patch},apply:async()=>'after'},approval));}
});
test('backup is fresh, private-attested and bound to exact target/source/catalog/data/table inventory',()=>{
    const archive=Buffer.concat([Buffer.from('PGDMP'),Buffer.alloc(1100)]),now=2000000;
    const good={version:1,scope:'preview-evaluation-0021-0023-backup',projectRef:'cbkplqkkjuoglpimwmib',database:'postgres',databaseOid:'5',cluster:'7678069749886157684',
        source:approval.source,target:'approved-preview',catalog:'before',preservedData:'old-records',archiveSha256:require('node:crypto').createHash('sha256').update(archive).digest('hex'),
        inventoryVerified:true,fullArchiveDecoded:true,privateStorageVerified:true,ledgerIncluded:true,sequencesIncluded:true,privilegesRecorded:true,
        tables:Object.values(source.emailOtpMigrationSource().snapshot.tables).map(t=>t.name),verifiedAt:new Date(now).toISOString()};
    policy.verifyEvaluationBackup(good,archive,state(21),now);
    for(const patch of [{scope:'preview-0017-backup'},{target:'other'},{source:'wrong'},{catalog:'changed'},{preservedData:'changed'},{archiveSha256:'bad'},{tables:[]},
        {privateStorageVerified:false},{inventoryVerified:false},{fullArchiveDecoded:false},{ledgerIncluded:false},{sequencesIncluded:false},{privilegesRecorded:false},
        {verifiedAt:new Date(now-900001).toISOString()},{verifiedAt:new Date(now+1).toISOString()}])assert.throws(()=>policy.verifyEvaluationBackup({...good,...patch},archive,state(21),now));
    assert.throws(()=>policy.verifyEvaluationBackup(good,Buffer.from('not an archive'),state(21),now));
});
function routineSql(change=()=>{}){const body=source.coEvaluationMigrationSource().migrations[22].sql.find(s=>s.includes('CREATE FUNCTION public.prevent_submission_evaluation_mutation()')).split('$$')[1];
    const f={oid:'123',proname:'prevent_submission_evaluation_mutation',prokind:'f',pronargs:0,trigger_return:true,proretset:false,prosecdef:false,proleakproof:false,proisstrict:false,provolatile:'v',proparallel:'u',proconfig:['search_path=pg_catalog'],prosrc:body,lanname:'plpgsql',owned:true};
    const t=policy.IMMUTABLE_TABLES.flatMap(table=>[{table,name:table+'_immutable',type:27},{table,name:table+'_no_truncate',type:34}]).sort((a,b)=>a.table.localeCompare(b.table)||a.name.localeCompare(b.name)).map(x=>({relname:x.table,tgname:x.name,function_oid:'123',tgtype:x.type,tgenabled:'O',tgnargs:0,tgattr:'',no_when:true,args:'',no_constraint:true,tgdeferrable:false,tginitdeferred:false,tgoldtable:null,tgnewtable:null}));
    const data={f,t};change(data);return async strings=>strings.join('').includes('from pg_proc')?[data.f]:data.t;
}
test('exact immutable routine/trigger contract refuses altered body/owner/security/search path/bindings/events',async()=>{
    await policy.verifyEvaluationRoutines(routineSql());
    for(const change of [x=>x.f.prosrc='begin return new; end;',x=>x.f.owned=false,x=>x.f.prosecdef=true,x=>x.f.proconfig=['search_path=public'],
        x=>x.t.pop(),x=>x.t[0].function_oid='other',x=>x.t[0].tgtype=19,x=>x.t[0].tgenabled='D',x=>x.t[0].no_when=false,x=>x.t[0].args='00'])await assert.rejects(()=>policy.verifyEvaluationRoutines(routineSql(change)));
});
function rightsSql(change=()=>{}){return async(strings,...values)=>{const q=strings.join('?');let row;
    if(q.includes('as allowed')){const name=values[1].split('.')[1],privilege=values[2];row={allowed:q.includes('has_sequence_privilege')?privilege==='USAGE':policy.EVALUATION_RIGHTS[name].includes(privilege),grantable:false};}
    else row=q.includes('as extra')?{extra:false}:{exposed:false};change(q,values,row);return[row];};}
test('minimum effective table/column/sequence rights reject missing/excess/grantable/PUBLIC exposure',async()=>{
    await policy.verifyEvaluationRuntime(rightsSql(),true);
    for(const change of [(q,v,r)=>{if(q.includes('as allowed')&&v[2]==='SELECT')r.allowed=false;},(q,v,r)=>{if(q.includes('as allowed')&&v[1]==='public.submission_evaluations'&&v[2]==='UPDATE')r.allowed=true;},
        (q,v,r)=>{if(q.includes('as allowed'))r.grantable=true;},(q,v,r)=>{if(q.includes('as extra'))r.extra=true;},(q,v,r)=>{if(q.includes('as exposed'))r.exposed=true;}])await assert.rejects(()=>policy.verifyEvaluationRuntime(rightsSql(change),true));
});
function fakeTransaction(fail=false){const calls=[],outcomes=[];const tx=()=>Promise.resolve(ledger(21));tx.options={parsers:{},serializers:{}};
    tx.unsafe=(query,params=[])=>{const work=()=>{calls.push({query,params});if(fail&&query.includes('CREATE FUNCTION public.prevent_submission_evaluation_mutation'))throw Error('synthetic 0022 failure');return /order by created_at desc limit 1/.test(query)?[{id:41,hash:ledger(21)[20].hash,created_at:ledger(21)[20].created_at}]:[];};return{then:(yes,no)=>Promise.resolve().then(work).then(yes,no),values:()=>Promise.resolve().then(work)};};
    tx.savepoint=async work=>{try{const r=await work(tx);outcomes.push('released');return r;}catch(e){outcomes.push('rolled back');throw e;}};return{tx,calls,outcomes};}
test('installed Drizzle submits only the pinned three migrations within the supplied savepoint',async()=>{
    const f=fakeTransaction();await op.applyPreviewMigrations(f.tx,f.tx.options,'evaluation');assert.deepEqual(f.outcomes,['released']);
    assert.deepEqual(f.calls.filter(c=>/insert into "drizzle"\."__drizzle_migrations"/.test(c.query)).map(c=>c.params[0]),source.coEvaluationMigrationSource().migrations.slice(21).map(m=>m.hash));
    const bad=fakeTransaction(true);await assert.rejects(()=>op.applyPreviewMigrations(bad.tx,bad.tx.options,'evaluation'),e=>e.cause?.message==='synthetic 0022 failure');assert.deepEqual(bad.outcomes,['rolled back']);
});

function cliDouble(fault){
    const target='a'.repeat(64),output=[],connections=[],events=[];let entries=21,attempts=0,backups=0;
    const config={environment:'preview',purpose:'operator',mode:'session',url:'synthetic-never-connected',endpoint:{host:'aws-0-ap-southeast-1.pooler.supabase.com',port:5432,database:'postgres',user:'thesishs_preview_operator.cbkplqkkjuoglpimwmib'},
        observed:{provider:'supabase',projectRef:'cbkplqkkjuoglpimwmib',databaseOid:'5',cluster:'7678069749886157684',runtimeRole:'thesishs_preview_runtime',operatorRole:'thesishs_preview_operator'},options:{ssl:{rejectUnauthorized:true,ca:'synthetic-ca'}}};
    const io={inspectPreviewState:async()=>({...state(entries),target,...(fault==='durable drift'&&entries===24&&connections.length>2?{preservedData:'changed'}:{})}),verifyEvaluationTarget:op.verifyEvaluationTarget,
        applyPreviewMigrations:async(_tx,_options,mode)=>{assert.equal(mode,'evaluation');assert.equal(backups,2);events.push('apply');attempts++;if(fault==='SQL error')throw Error('private SQL must not leak');entries=24;}};
    const driver=(_url,options)=>{const id=connections.length;const client={options,ended:false};connections.push(client);
        const tx=(parts,...values)=>{if(typeof parts==='string')return{identifier:parts};const q=parts.join('?');events.push(q.startsWith('lock table')?'lock:'+values[0]?.identifier:q);
            if(q.includes('transaction_read_only'))return Promise.resolve([{read_only:'on'}]);if(q.includes('count(*)'))return Promise.resolve([{count:0}]);if(q.includes('last_value'))return Promise.resolve([{value:'1',is_called:false}]);if(q.includes(' as changed'))return Promise.resolve([{changed:false}]);return Promise.resolve([]);};
        client.begin=async(mode,callback)=>{if(typeof mode==='function'){callback=mode;mode='write';}const saved=entries;events.push('begin:'+id+':'+mode);
            try{const result=await callback(tx);if(mode==='write'&&fault==='uncertain commit')throw Error('private uncertain commit');return result;}catch(e){if(fault!=='uncertain commit')entries=saved;throw e;}};
        client.end=async()=>{client.ended=true;};return client;};
    const exports={},processDouble={argv:['node','offline-unit'],env:{},stdin:{isTTY:true},stdout:{isTTY:true},exitCode:0};
    const ts=require('typescript');const code=ts.transpileModule(require('node:fs').readFileSync('scripts/migrate-preview-evaluations.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    require('node:vm').runInNewContext(code,{exports,process:processDouble,console:{log:x=>output.push(x),error:x=>output.push(x)},require(name){
        if(name==='postgres')return driver;if(name==='node:fs')return{readFileSync:()=>Buffer.from('synthetic profile'),statSync:()=>({size:10})};
        if(name==='dotenv')return{parse:()=>({})};if(name==='@/lib/db/config')return{databaseConfiguration:()=>config};if(name==='./upload-acceptance-safety')return{privateFile:p=>p};
        if(name==='./initialize-preview-database')return io;if(name==='./preview-evaluations')return{...policy,grantEvaluationRuntime:async()=>{events.push('grants');},readEvaluationBackup:()=>{backups++;events.push('backup');if(fault==='backup'||fault==='locked backup'&&backups===2)throw Error('private backup path');}};
        if(name.startsWith('./'))return require('../scripts/'+name.slice(2)+'.ts');return require(name);
    }});
    const args=['--execute','--profile',path.resolve('private-profile-placeholder.env'),'--confirm-target',target,'--confirm-source',approval.source,'--confirm-data-api-disabled','yes','--backup-evidence',path.resolve('private-backup-placeholder.json'),'--confirm-backup','b'.repeat(64)];
    return{run:()=>exports.main(args),output,connections,events,status:()=>({entries,attempts,backups,exitCode:processDouble.exitCode})};
}
test('CLI composes exact source, two backup checks, sorted locks, one write and independent durable connection',async()=>{
    const f=cliDouble();await f.run();assert.equal(f.status().exitCode,0);assert.equal(f.status().attempts,1);assert.equal(f.status().backups,2);
    assert.equal(f.connections.length,3);assert.ok(f.connections.every(c=>c.ended));assert.equal(f.connections[0].options.connection.default_transaction_read_only,true);assert.equal(f.connections[2].options.connection.default_transaction_read_only,true);
    const locks=f.events.filter(e=>e.startsWith('lock:public.'));assert.deepEqual(locks,[...locks].sort());assert.equal(locks.length,Object.keys(source.emailOtpMigrationSource().snapshot.tables).length);
    assert.ok(f.events.indexOf('apply')>f.events.lastIndexOf('backup'));assert.ok(f.events.indexOf('grants')>f.events.indexOf('apply'));
    assert.ok(JSON.parse(f.output.at(-1)).independentlyVerified);
});
test('CLI backup/SQL/uncertain/durable failures never retry writes or expose private errors',async()=>{
    for(const fault of ['backup','locked backup','SQL error','uncertain commit','durable drift']){
        const f=cliDouble(fault);await f.run();assert.equal(f.status().exitCode,1);assert.equal(f.status().attempts,fault.includes('backup')?0:1);
        assert.ok(f.connections.every(c=>c.ended));assert.doesNotMatch(f.output.join(''),/private backup path|private SQL|private uncertain commit|synthetic-never-connected/);
        if(fault==='SQL error')assert.equal(f.status().entries,21);if(fault==='uncertain commit')assert.equal(f.status().entries,24);
    }
});
