/* eslint-disable @typescript-eslint/no-require-imports */
// Narrow operator guards only: no env-file read, DB connection, backup, fixtures or DDL.
const assert=require('node:assert/strict'),{test}=require('node:test');
const op=require('../scripts/migrate-local-submission-evaluations.cjs');
test('import is inert and CLI refuses absent, incomplete, extra or incorrect execution pins',()=>{
 assert.equal(op.argumentsFor(['--inspect']),false);
 assert.equal(op.argumentsFor(['--verify-installed','--evidence',require('node:path').resolve('offline-evidence.json')]),'installed');
 assert.equal(op.argumentsFor(['--execute','--confirm-target',op.TARGET,'--confirm-source',op.SOURCE]),true);
 for(const args of [[],['--execute'],['--inspect','--execute'],['--verify-installed','--evidence','relative.json'],['--execute','--confirm-target','other','--confirm-source',op.SOURCE],['--execute','--confirm-target',op.TARGET,'--confirm-source','other']])assert.throws(()=>op.argumentsFor(args));
 assert.match(op.BASELINE_CATALOG,/^[a-f0-9]{64}$/);
});
test('pending selection is exactly reviewed 0022 then 0023 and excludes historical replay/destructive statements',()=>{
 const rows=op.pending();assert.deepEqual(rows.map(r=>r.hash),op.MIGRATIONS);assert.equal(rows.length,2);
 assert(rows[0].folderMillis<rows[1].folderMillis);assert.match(rows[0].sql[0],/CREATE TABLE "submission_evaluation_assignments"/);
 assert.match(rows[1].sql[0],/ADD COLUMN "evaluation_assignment_id"/);
 const sql=rows.flatMap(r=>r.sql).join('\n');assert.doesNotMatch(sql,/\b(?:DROP|TRUNCATE|GRANT|REVOKE)\s+(?:TABLE|SCHEMA|DATABASE|SELECT|ALL)|^\s*(?:INSERT|UPDATE|DELETE)\s/gim);
 assert.equal(rows[1].sql.findIndex(x=>x.includes('UNIQUE("id","submission_id")'))<rows[1].sql.findIndex(x=>x.includes('FOREIGN KEY')),true);
});
test('local target guard rejects hosted/remote/other database, role, port, production classification and shared profile',()=>{
 const base={NODE_ENV:'development',DATABASE_URL:'postgres://postgres:offline-fixture@localhost:5432/thesishs_ai'};
 assert.equal(op.localConfiguration(base).endpoint.database,'thesishs_ai');
 for(const patch of [{NODE_ENV:'production'},{VERCEL_ENV:'preview'},{DATABASE_URL:base.DATABASE_URL.replace('localhost','192.0.2.1')},{DATABASE_URL:base.DATABASE_URL.replace('5432','55451')},{DATABASE_URL:base.DATABASE_URL.replace('thesishs_ai','other')},{DATABASE_URL:base.DATABASE_URL.replace('postgres:offline','other:offline')},{THESISHS_DATABASE_TARGETS_JSON:JSON.stringify({preview:{identity:'same',runtime:{host:'localhost',port:5432,database:'thesishs_ai',user:'postgres'},operator:{host:'localhost',port:5432,database:'thesishs_ai',user:'postgres'}}})}])assert.throws(()=>op.localConfiguration({...base,...patch}));
});
test('exact ledger guards reject missing, partial, duplicate, stale and misordered entries; sequence gaps are permitted',()=>{
 const rows=require('../scripts/preview-migration-source.ts').coEvaluationMigrationSource().migrations.map((m,i)=>({id:1+i*2,hash:m.hash,created_at:String(m.folderMillis)}));
 op.ledgerMatches(rows.slice(0,22),22);op.ledgerMatches(rows,24);
 for(const [ledger,count]of [[rows.slice(0,23),23],[rows.slice(0,23),22],[rows,22],[rows.slice(0,22),24]])assert.throws(()=>op.ledgerMatches(ledger,count));
 for(const change of [x=>x[0].hash='foreign',x=>x[21].created_at='0',x=>x[2].id=x[1].id]){const v=structuredClone(rows);change(v);assert.throws(()=>op.ledgerMatches(v,24));}
});
const sample=()=>({target:op.TARGET,source:op.SOURCE,baseline:op.BASELINE_CATALOG,rows:{co_adviser_review_assignments:{count:2,hash:'preserved'},feedbacks:{count:3,hash:'history'}},legacy:{columns:'legacy',permissions:'same'},permissions:{acl:'unchanged'},sequences:{users_id_seq:{value:'7'}},ledger:[{id:1,hash:'prior',created_at:'1'}]});
test('preservation rejects changed legacy rows/catalog/ACLs/sequences/prefix and allows only new sequences/ledger suffix',()=>{
 const before=sample(),after=sample();after.sequences.submission_evaluations_id_seq={value:'1'};after.ledger.push({id:2,hash:'0022',created_at:'2'});op.preserve(before,after);
 for(const change of [x=>x.rows.feedbacks.hash='changed',x=>x.rows.co_adviser_review_assignments.count++,x=>x.legacy.columns='changed',x=>x.permissions.acl='grant',x=>x.sequences.users_id_seq.value='8',x=>x.ledger[0].hash='changed',x=>x.baseline='drift',x=>x.target='other']){const v=sample();change(v);assert.throws(()=>op.preserve(before,v));}
});
test('fresh backup receipt cannot be missing verification, reused, future-dated or for another source/target',()=>{
 const now=2000000,good={kind:'e1cl-0022-0023',target:op.TARGET,source:op.SOURCE,bytes:2000,sha256:'a'.repeat(64),privateAclVerified:true,inventoryVerified:true,fullArchiveDecoded:true,restoreTested:false,createdAt:now};op.backupReceipt(good,now);
 for(const patch of [{kind:'other'},{target:'other'},{source:'other'},{bytes:0},{sha256:'bad'},{privateAclVerified:false},{inventoryVerified:false},{fullArchiveDecoded:false},{createdAt:now-900001},{createdAt:now+1},{restoreTested:true}])assert.throws(()=>op.backupReceipt({...good,...patch},now));
});
function fakeTransaction(fail=false){
 const calls=[],commits=[];const client=()=>{};client.options={parsers:{},serializers:{}};
 client.unsafe=(query,params=[])=>{const work=()=>{calls.push({query,params});if(fail&&query.includes('ADD COLUMN "evaluation"'))throw Error('synthetic second-migration failure');return /order by created_at desc limit 1/.test(query)?[{id:22,hash:'prefix',created_at:'1794939715904'}]:[];};return{then:(yes,no)=>Promise.resolve().then(work).then(yes,no),values:()=>Promise.resolve().then(work)};};
 client.savepoint=async work=>{calls.push({savepoint:'begin'});try{const r=await work(client);commits.push('savepoint released');return r;}catch(e){commits.push('savepoint rolled back');throw e;}};
 return{client,calls,commits};
}
test('installed Drizzle executes both pinned migrations on the supplied session inside one savepoint, not a new connection',async()=>{
 const tx=fakeTransaction();await op.apply(tx.client,tx.client.options);
 assert.equal(tx.calls.filter(x=>x.savepoint==='begin').length,1);assert.deepEqual(tx.commits,['savepoint released']);
 const inserted=tx.calls.filter(x=>/insert into "drizzle"\."__drizzle_migrations"/.test(x.query));assert.equal(inserted.length,2);assert.deepEqual(inserted.map(x=>x.params[0]),op.MIGRATIONS);
 const statements=tx.calls.map(x=>x.query??'');assert(statements.findIndex(x=>x.includes('CREATE TABLE "submission_evaluation_assignments"'))<statements.findIndex(x=>x.includes('ADD COLUMN "evaluation_assignment_id"')));
});
test('second-migration failure propagates from installed Drizzle savepoint; operator never retries it',async()=>{
 const tx=fakeTransaction(true);await assert.rejects(()=>op.apply(tx.client,tx.client.options),e=>e.cause?.message==='synthetic second-migration failure');assert.deepEqual(tx.commits,['savepoint rolled back']);assert.equal(tx.calls.filter(x=>x.savepoint==='begin').length,1);
});
