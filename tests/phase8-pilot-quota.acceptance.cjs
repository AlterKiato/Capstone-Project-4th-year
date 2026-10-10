/* eslint-disable @typescript-eslint/no-require-imports */
// Real PostgreSQL; source fixtures stay inside one outer rollback. No migrations/provider calls.
const assert = require('node:assert/strict'), Module = require('node:module');
const crypto = require('node:crypto'), fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const syntheticOnly = process.argv[2] === '--synthetic-window';
require('dotenv').config({ quiet:true });
const postgres = require('postgres');
const { drizzle } = require('drizzle-orm/postgres-js');
const { PgDialect } = require('drizzle-orm/pg-core');
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname,'localhost'); assert.equal(target.port || '5432','5432'); assert.equal(target.pathname,'/thesishs_ai');
const options = { connect_timeout:5, onnotice:()=>{}, connection:{ statement_timeout:'15000', timezone:'UTC', application_name:'phase8_quota_rollback_acceptance' } };
const client = postgres(target.toString(), { ...options, max:1 });
const contenders = postgres(target.toString(), { ...options, max:4 });
const dialect = new PgDialect();
const rollback = new Error('EXPECTED_ROLLBACK');
const marker = 'PHASE8_QUOTA_' + crypto.randomUUID();
let database, clock = null, fault = false, lastError = null, outbound = 0, complete = false;
const originalLoad = Module._load;
const binding = { transaction: async (work, options) => database.transaction(async tx => {
    const raw = tx.session.client;
    if (fault) await raw`SET LOCAL search_path = pg_catalog`;
    return work({ execute: async query => {
        const compiled = dialect.sqlToQuery(query);
        // Test-only SQL clock replacement; no production clock injection/configuration exists.
        const text = clock === null ? compiled.sql : compiled.sql.replaceAll('clock_timestamp()', `to_timestamp(${clock})`);
        try { return await raw.unsafe(text, compiled.params); }
        catch (error) { lastError = error.code; throw error; }
    } });
}, options) };
Module._load = function(id,...args) {
    if (id === 'server-only') return {};
    if (id === '@/lib/db') return { db:binding };
    return originalLoad.call(this,id,...args);
};
const originalFetch = global.fetch;
global.fetch = () => { outbound++; throw new Error('OUTBOUND_FORBIDDEN'); };
const networkOriginals=[];
for (const name of ['node:http','node:https']) for (const method of ['get','request']) {
    const mod=require(name); networkOriginals.push([mod,method,mod[method]]);
    mod[method]=()=>{outbound++;throw new Error('OUTBOUND_FORBIDDEN');};
}
function instance() {
    for (const file of ['../lib/auth/ai-pilot-limits.ts','../lib/repositories/ai-pilot-quota.repository.ts']) delete require.cache[require.resolve(file)];
    return require('../lib/auth/ai-pilot-limits.ts');
}
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
async function unchangedFingerprint(sql) {
    const tables=await sql`SELECT table_schema,table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema IN ('public','drizzle') ORDER BY 1,2`;
    const hashes=[];
    for (const table of tables) {
        const [row]=await sql`SELECT count(*)::int AS n,md5(coalesce(string_agg(h,',' ORDER BY h),'')) AS hash FROM (SELECT md5(row_to_json(t)::text) AS h FROM ${sql(table.table_schema+'.'+table.table_name)} t) q`;
        hashes.push({ schema:table.table_schema,table:table.table_name,...row });
    }
    const sequences=[];
    for (const sequence of await sql`SELECT schemaname,sequencename FROM pg_sequences WHERE schemaname IN ('public','drizzle') ORDER BY 1,2`) {
        const [row]=await sql`SELECT last_value,is_called FROM ${sql(sequence.schemaname+'.'+sequence.sequencename)}`;
        sequences.push({ ...sequence,...row });
    }
    return sha(JSON.stringify({hashes,sequences}));
}
async function ledger() {
    const actual=Array.from(await client`SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`, row=>({...row}));
    const journal=JSON.parse(fs.readFileSync('db/migrations/meta/_journal.json','utf8')).entries;
    assert.equal(journal.length,12);
    assert.deepEqual(actual,journal.map(entry=>({hash:sha(fs.readFileSync('db/migrations/'+entry.tag+'.sql')),created_at:String(entry.when)})));
}
async function main() {
    await ledger();
    const indexes=await client`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='ai_pilot_attempts'`;
    for(const name of ['ai_pilot_attempts_pkey','ai_pilot_day_idx','ai_pilot_user_time_idx','ai_pilot_one_active_idx']) assert.ok(indexes.some(row=>row.indexname===name));
    const constraints=await client`SELECT conname,contype,convalidated FROM pg_constraint WHERE conrelid='public.ai_pilot_attempts'::regclass`;
    for(const [name,type] of [['ai_pilot_attempts_pkey','p'],['ai_pilot_release_check','c'],['ai_pilot_attempts_user_id_users_id_fk','f']]) assert.ok(constraints.some(row=>row.conname===name&&row.contype===type&&row.convalidated));
    assert.equal((await client`SELECT count(*)::int AS n FROM ai_pilot_attempts`)[0].n,0);
    const before=await unchangedFingerprint(client);
    try {
        await drizzle(client).transaction(async root => {
            const raw=root.session.client;
            const [{next}]=await raw`SELECT (coalesce(max(id),0)+1000000)::int AS next FROM users`;
            assert.ok(next < 2147483600);
            const ids=Array.from({length:4},(_,i)=>next+i);
            for (let i=0;i<ids.length;i++) await raw`INSERT INTO users(id,first_name,last_name,email,password,role_id) VALUES (${ids[i]},'Synthetic',${marker},${marker+'-'+i+'@example.invalid'},'NOT_A_LOGIN_HASH',${i%2+1})`;
            const [{epoch}]=await raw`SELECT extract(epoch FROM clock_timestamp())::double precision AS epoch`;
            const start=Math.floor(epoch/86400)*86400+43200;
            async function scenario(work) {
                const done=new Error('SCENARIO_ROLLBACK');
                try { await root.transaction(async branch => { database=branch; clock=null; fault=false; lastError=null; await work(branch.session.client); assert.equal(lastError,null); throw done; }); }
                catch (error) { if (error!==done) throw error; }
                database=root; clock=null; fault=false;
                assert.equal((await raw`SELECT count(*)::int AS n FROM ai_pilot_attempts`)[0].n,0);
            }
            if(syntheticOnly) {
                const window={startsAt:new Date(start*1000),endsAt:new Date((start+3600)*1000)};
                await scenario(async sql=>{
                    // Actual DB clock and real SQL: concurrent independent workers cannot acquire permission.
                    const liveWindow={startsAt:new Date((epoch-10)*1000),endsAt:new Date((epoch+3600)*1000)};
                    const release=await instance().reserveAIPilotAttempt(ids[0],liveWindow); assert.ok(release);
                    const owner=database; database=drizzle(contenders);
                    const results=await Promise.all(Array.from({length:16},()=>instance().reserveAIPilotAttempt(ids[1],liveWindow)));
                    assert.ok(results.every(value=>value===null)); database=owner;
                    for(let i=0;i<2;i++) {
                        const child=spawnSync(process.execPath,['--import','tsx',__filename,'--lock-probe'],{encoding:'utf8',timeout:20000});
                        assert.equal(child.status,0,'Fresh child must deny permission without writing');
                        assert.equal(child.stdout.trim(),'PASS fresh process denied by PostgreSQL lock; rollback only');
                    }
                    await release();
                    assert.equal((await sql`SELECT count(*)::int AS n FROM ai_pilot_attempts WHERE released_at IS NOT NULL`)[0].n,1);
                    assert.equal(await instance().reserveAIPilotAttempt(ids[1],liveWindow),null,'Global pilot cooldown also applies across users');
                });
                await scenario(async sql=>{
                    clock=start-1; assert.equal(await instance().reserveAIPilotAttempt(ids[0],window),null);
                    clock=start; const first=await instance().reserveAIPilotAttempt(ids[0],window); assert.ok(first); await first();
                    clock=start+119; assert.equal(await instance().reserveAIPilotAttempt(ids[1],window),null);
                    clock=start+120; const second=await instance().reserveAIPilotAttempt(ids[1],window); assert.ok(second);
                    // A simulated failed provider never executes; release retains its charged attempt.
                    await second(); clock=start+240;
                    assert.equal(await instance().reserveAIPilotAttempt(ids[2],window),null,'Third attempt denied even for another user/fresh module');
                    assert.equal(await instance().reserveAIPilotAttempt(ids[0],window),null);
                    assert.equal((await sql`SELECT count(*)::int AS n FROM ai_pilot_attempts`)[0].n,2);
                    clock=start+3600; assert.equal(await instance().reserveAIPilotAttempt(ids[3],window),null,'End is exclusive');
                });
                await scenario(async ()=>{
                    clock=start+3600; assert.equal(await instance().reserveAIPilotAttempt(ids[0],window),null,'Expired empty window denies independently of cap');
                });
                await scenario(async ()=>{
                    // An attempt from the ordinary path inside the frozen window also consumes its budget.
                    clock=start; const ordinary=await instance().reserveAIPilotAttempt(ids[0]); assert.ok(ordinary); await ordinary();
                    clock=start+120; const pilot=await instance().reserveAIPilotAttempt(ids[1],window); assert.ok(pilot); await pilot();
                    clock=start+240; assert.equal(await instance().reserveAIPilotAttempt(ids[2],window),null);
                });
                await scenario(async ()=>{
                    const midnight=Math.floor(epoch/86400)*86400+86400;
                    const crossing={startsAt:new Date((midnight-120)*1000),endsAt:new Date((midnight+1800)*1000)};
                    clock=midnight-120; const first=await instance().reserveAIPilotAttempt(ids[0],crossing); assert.ok(first); await first();
                    clock=midnight; const second=await instance().reserveAIPilotAttempt(ids[1],crossing); assert.ok(second); await second();
                    clock=midnight+120; assert.equal(await instance().reserveAIPilotAttempt(ids[2],crossing),null,'UTC rollover cannot reset frozen pilot budget');
                });
                await scenario(async ()=>{
                    clock=start-600;
                    for(let i=0;i<3;i++) { const release=await instance().reserveAIPilotAttempt(ids[0]); assert.ok(release); await release(); clock+=120; }
                    clock=start; assert.equal(await instance().reserveAIPilotAttempt(ids[0],window),null,'Pilot cannot bypass three/user/day');
                });
                await scenario(async ()=>{
                    clock=start-1200;
                    for(let i=0;i<10;i++) { const release=await instance().reserveAIPilotAttempt(ids[Math.floor(i/3)]); assert.ok(release); await release(); clock+=120; }
                    clock=start; assert.equal(await instance().reserveAIPilotAttempt(ids[3],window),null,'Pilot cannot bypass ten/global/day');
                });
                await scenario(async ()=>{
                    clock=start; fault=true; assert.equal(await instance().reserveAIPilotAttempt(ids[0],window),null);
                    assert.equal(lastError,'42P01'); fault=false; lastError=null;
                });
                console.log('PASS synthetic pilot production SQL: two charged attempts, denied third, global 119/120s spacing, half-open window, UTC rollover, ordinary-path charging, 3/user and 10/global stacking, fail-closed storage');
                console.log('PASS 16 independent-connection contenders and two fresh child processes denied; recreated modules retain SQL attempt counts');
            }
            if(!syntheticOnly) {
            await scenario(async sql => {
                const a=instance(); const release=await a.reserveAIPilotAttempt(ids[0]); assert.ok(release);
                assert.equal((await sql`SELECT count(*)::int AS n FROM ai_pilot_attempts`)[0].n,1,'Charge stored before permission');
                assert.equal(await instance().reserveAIPilotAttempt(ids[1]),null,'Fresh module sees active SQL row');
                const owner=database; database=drizzle(contenders);
                const denied=await Promise.all(Array.from({length:16},()=>instance().reserveAIPilotAttempt(ids[1])));
                assert.ok(denied.every(value=>value===null),'Independent connections cannot bypass owner lock');
                database=owner;
                try { throw new Error('SIMULATED_PROVIDER_FAILURE'); } catch { /* No actual provider. */ } finally { await release(); }
                assert.equal((await sql`SELECT count(*)::int AS n FROM ai_pilot_attempts WHERE released_at IS NOT NULL`)[0].n,1,'Failure remains charged');
                assert.equal(await a.reserveAIPilotAttempt(ids[0]),null,'Real DB-clock cooldown');
                await sql`UPDATE ai_pilot_attempts SET attempted_at=clock_timestamp()-interval '121 seconds',released_at=clock_timestamp()-interval '120 seconds'`;
                const second=await a.reserveAIPilotAttempt(ids[0]); assert.ok(second); await second();
                const [{n}]=await sql`SELECT count(*)::int AS n FROM ai_pilot_attempts`; assert.equal(n,2);
            });
            console.log('PASS real DB-clock reservation/failure charging/cooldown and 16 contenders on independent PostgreSQL connections; module recreation remains SQL-bound');
            await scenario(async sql => {
                clock=start; const a=instance();
                for (let i=0;i<10;i++) {
                    const user=ids[Math.floor(i/3)];
                    const release=await a.reserveAIPilotAttempt(user); assert.ok(release); await release(); clock+=120;
                    if (i===2) assert.equal(await instance().reserveAIPilotAttempt(ids[0]),null,'Exactly three/user/day');
                }
                assert.equal((await sql`SELECT count(*)::int AS n FROM ai_pilot_attempts`)[0].n,10);
                assert.equal(await instance().reserveAIPilotAttempt(ids[3]),null,'Exactly ten globally/day');
                clock=start+86400; const nextDay=await instance().reserveAIPilotAttempt(ids[0]); assert.ok(nextDay); await nextDay();
                assert.equal((await sql`SELECT count(*)::int AS n FROM ai_pilot_attempts`)[0].n,11,'UTC reset retains prior attempts');
            });
            await scenario(async sql => {
                await sql`SET LOCAL TIME ZONE 'America/New_York'`;
                const a=instance(); clock=Math.floor(epoch/86400)*86400+86399;
                const first=await a.reserveAIPilotAttempt(ids[0]); assert.ok(first); await first();
                clock+=1; assert.equal(await a.reserveAIPilotAttempt(ids[0]),null,'Cooldown crosses midnight');
                clock+=118; assert.equal(await a.reserveAIPilotAttempt(ids[0]),null,'119 seconds denied');
                clock+=1; const allowed=await a.reserveAIPilotAttempt(ids[0]); assert.ok(allowed); await allowed();
            });
            console.log('PASS production SQL at controlled UTC boundaries: 3/user, 10/global, new-day allowance, cross-midnight 119/120-second boundary');
            await scenario(async sql => {
                const a=instance(); clock=start;
                for (let i=0;i<2;i++) { const release=await a.reserveAIPilotAttempt(ids[0]); assert.ok(release); await release(); clock+=120; }
                assert.ok(await a.reserveAIPilotAttempt(ids[0])); // Simulated abandoned worker; never expires.
                const [active]=await sql`SELECT id,user_id,attempted_at FROM ai_pilot_attempts WHERE released_at IS NULL`;
                clock+=86400; assert.equal(await instance().reserveAIPilotAttempt(ids[1]),null);
                // Test fixture has no live worker/provider. Manual operator recovery is otherwise conditional on shutdown.
                clock=start+360;
                await sql`SELECT pg_advisory_xact_lock(84385,1)`;
                await sql`SELECT id FROM ai_pilot_attempts WHERE id=${active.id}::uuid FOR UPDATE`;
                const changed=await sql`UPDATE ai_pilot_attempts SET released_at=greatest(to_timestamp(${clock}),attempted_at) WHERE id=${active.id}::uuid AND released_at IS NULL RETURNING id`;
                assert.equal(changed.length,1);
                assert.equal((await sql`SELECT count(*)::int AS n FROM ai_pilot_attempts`)[0].n,3);
                const [preserved]=await sql`SELECT id,user_id,attempted_at FROM ai_pilot_attempts WHERE id=${active.id}::uuid`;
                assert.deepEqual({...preserved},{...active});
                assert.equal(await instance().reserveAIPilotAttempt(ids[0]),null,'Recovery never refunds the daily limit');
            });
            await scenario(async sql => {
                const id=crypto.randomUUID();
                await sql`INSERT INTO ai_pilot_attempts(id,user_id,attempted_at) VALUES (${id}::uuid,${ids[0]},clock_timestamp())`;
                await assert.rejects(sql.savepoint(t=>t`INSERT INTO ai_pilot_attempts(id,user_id,attempted_at) VALUES (${crypto.randomUUID()}::uuid,${ids[1]},clock_timestamp())`),e=>e.code==='23505');
                await assert.rejects(sql.savepoint(t=>t`UPDATE ai_pilot_attempts SET released_at=attempted_at-interval '1 second' WHERE id=${id}::uuid`),e=>e.code==='23514');
                await assert.rejects(sql.savepoint(t=>t`INSERT INTO ai_pilot_attempts(id,user_id,attempted_at,released_at) VALUES (${crypto.randomUUID()}::uuid,-1,clock_timestamp(),clock_timestamp()+interval '1 second')`),e=>e.code==='23503');
            });
            await scenario(async () => {
                fault=true; assert.equal(await instance().reserveAIPilotAttempt(ids[0]),null);
                assert.equal(lastError,'42P01','Actual DB missing-storage error denies without memory fallback');
                fault=false; lastError=null;
            });
            console.log('PASS abandoned slot/recovery count preservation, real unique/CHECK/FK failures and fail-closed missing storage');
            }
            assert.equal(require('../lib/ai/groq-provider.ts').getGroqAvailability().enabled,false);
            assert.equal(require('../lib/ai/groq-provider.ts').getLocalGroqPilotAvailability().enabled,false);
            assert.equal(outbound,0); complete=true; throw rollback;
        }, { isolationLevel:'read committed' });
    } catch (error) { if (error!==rollback) throw error; }
    assert.equal(complete,true);
    assert.equal((await client`SELECT count(*)::int AS n FROM ai_pilot_attempts`)[0].n,0);
    assert.equal((await client`SELECT count(*)::int AS n FROM users WHERE last_name=${marker}`)[0].n,0);
    assert.equal(await unchangedFingerprint(client),before,'Every table/ledger and sequence state unchanged');
    await ledger();
    console.log('PASS outer rollback cleanup: zero quota/test users, all table data/ledger/sequence states unchanged; ZERO provider calls');
    console.log('Limit: savepoint-contained reservations do not prove committed crash durability or a physical process/database restart; commit ordering remains covered by synthetic contract plus PostgreSQL transaction semantics.');
}
async function lockProbe() {
    try { await drizzle(client).transaction(async root=>{
        database=root;
        const now=Date.now();
        assert.equal(await instance().reserveAIPilotAttempt(1,{startsAt:new Date(now-60000),endsAt:new Date(now+60000)}),null);
        assert.equal(lastError,null,'Lock denial must not be a swallowed storage error');
        assert.equal(outbound,0); throw rollback;
    }); } catch(error) { if(error!==rollback) throw error; }
    console.log('PASS fresh process denied by PostgreSQL lock; rollback only');
}
(process.argv[2]==='--lock-probe'?lockProbe():main()).catch(error=>{console.error('STOP PostgreSQL quota verification:',error.code||error.name);console.error((error.stack||'').split('\n').filter(x=>x.trim().startsWith('at ')).slice(0,5).join('\n'));process.exitCode=1;}).finally(async()=>{
    Module._load=originalLoad;global.fetch=originalFetch;
    for(const [mod,method,original] of networkOriginals)mod[method]=original;
    await client.end({timeout:5});await contenders.end({timeout:5});
});
