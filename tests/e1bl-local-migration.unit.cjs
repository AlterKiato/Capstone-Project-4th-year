/* eslint-disable @typescript-eslint/no-require-imports */
// Pure guard tests. No environment-file read, database connection, backup or migration.
const assert=require('node:assert/strict'),{test}=require('node:test');
const {pending,localConfiguration,preserve,expectedObjects,SOURCE,MIGRATION}=require('../scripts/migrate-local-evaluation-templates.cjs');
test('0021 selection is exactly one reviewed migration, with no historical replay',()=>{
    const rows=pending();assert.equal(rows.length,1);assert.equal(rows[0].hash,MIGRATION);
    assert.equal(SOURCE,'d560ec745f5fdd4786f43c94f0bce456a4e7e7728f7aff206fd7b2642c7c780c');
    assert.match(rows[0].sql.join('\n'),/CREATE TABLE "evaluation_templates"/);
    assert.doesNotMatch(rows[0].sql.join('\n'),/CREATE TABLE "users"|DROP TABLE|TRUNCATE|GRANT /);
});
test('configuration fails closed on hosted classification, remote host, database, role, port and shared target',()=>{
    const base={NODE_ENV:'development',DATABASE_URL:'postgres://postgres:offline-fixture@localhost:5432/thesishs_ai'};
    assert.equal(localConfiguration(base).endpoint.database,'thesishs_ai');
    for(const patch of [{NODE_ENV:'production'},{VERCEL_ENV:'preview'},{DATABASE_URL:base.DATABASE_URL.replace('localhost','192.0.2.1')},
        {DATABASE_URL:base.DATABASE_URL.replace('thesishs_ai','other')},{DATABASE_URL:base.DATABASE_URL.replace('postgres:offline','other:offline')},
        {DATABASE_URL:base.DATABASE_URL.replace('5432','55447')},
        {THESISHS_DATABASE_TARGETS_JSON:JSON.stringify({production:{identity:'same',runtime:{host:'localhost',port:5432,database:'thesishs_ai',user:'postgres'},operator:{host:'localhost',port:5432,database:'thesishs_ai',user:'postgres'}}})}])assert.throws(()=>localConfiguration({...base,...patch}));
});
const state=()=>({target:'pin',source:'source',rows:{users:{count:2,hash:'rows'}},catalog:{users:'schema'},sequences:{users_id_seq:{value:'2'}},permissions:{acl:'same'},ledger:[{id:1,hash:'first'}]});
test('preservation rejects changed data/schema/sequences/ACLs/history and permits only additive state',()=>{
    const before=state(),after=state();after.rows.evaluation_templates={count:0,hash:'empty'};after.catalog.evaluation_templates='new';after.ledger.push({id:2,hash:'0021'});preserve(before,after);
    for(const change of [s=>s.rows.users.count++,s=>s.rows.users.hash='changed',s=>s.catalog.users='changed',s=>s.sequences.users_id_seq.value='3',
        s=>s.permissions.acl='changed',s=>s.ledger[0].hash='changed',s=>s.target='other',s=>s.source='other']){const s=state();change(s);assert.throws(()=>preserve(before,s));}
});
test('expected additive object set contains only two tables, four indexes and one sequence',()=>{
    const {emailOtpMigrationSource,evaluationTemplateMigrationSource}=require('../scripts/preview-migration-source.ts');
    const before=new Set(expectedObjects(emailOtpMigrationSource().snapshot)),after=expectedObjects(evaluationTemplateMigrationSource().snapshot);
    const added=after.filter(x=>!before.has(x));assert.equal(added.length,7);assert.equal(added.filter(x=>x.endsWith(':r')).length,2);assert.equal(added.filter(x=>x.endsWith(':i')).length,4);assert.deepEqual(added.filter(x=>x.endsWith(':S')),['evaluation_templates_id_seq:S']);
});
