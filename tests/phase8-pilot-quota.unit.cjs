/* eslint-disable @typescript-eslint/no-require-imports */
// Synthetic transaction/SQL contract model, not real PostgreSQL acceptance. No schema is applied.
const assert = require('node:assert/strict');
const Module = require('node:module');
const { PgDialect } = require('drizzle-orm/pg-core');
const dialect = new PgDialect();
let outbound = 0;
const forbidden = () => { outbound++; throw new Error('OUTBOUND_FORBIDDEN'); };
global.fetch = forbidden;
for (const name of ['node:http', 'node:https']) { const mod = require(name); mod.get = forbidden; mod.request = forbidden; }
const net = require('node:net'); net.connect = forbidden; net.createConnection = forbidden; net.Socket.prototype.connect = forbidden;
require('node:tls').connect = forbidden;
const state = { rows: [], now: Date.UTC(2026, 9, 9, 12), lock: false, fail: false, failRelease: false, failCommit: false };
const statements = [];
const fakeDB = {
    async transaction(work, options) {
        let acquired = false, staged = null;
        try {
            const result = await work({ execute: async query => {
                if (state.fail) throw new Error('STORAGE_UNAVAILABLE');
                const { sql, params } = dialect.sqlToQuery(query); statements.push(sql);
                if (sql.startsWith('set local')) return [];
                if (sql.includes('pg_try_advisory_xact_lock')) {
                    if (state.lock) return [{ acquired: false }];
                    acquired = state.lock = true; return [{ acquired: true }];
                }
                if (sql.includes('insert into ai_pilot_attempts')) {
                    assert.ok(acquired, 'Reservation requires transaction lock');
                    assert.equal(options?.isolationLevel, 'read committed', 'Refresh snapshot after shared lock acquisition');
                    assert.match(sql, /clock_timestamp\(\)/);
                    assert.match(sql, /date_trunc\('day', now at time zone 'UTC'\) at time zone 'UTC'/);
                    assert.equal((sql.match(/interval '24 hours'/g) || []).length, 2);
                    assert.match(sql, /released_at is null/); assert.match(sql, /\) < 10/); assert.match(sql, /\) < 3/);
                    assert.match(sql, /interval '120 seconds'/);
                    const [id, userId, secondUser, thirdUser] = params;
                    assert.equal(userId, secondUser); assert.equal(userId, thirdUser);
                    assert.ok(params.length === 4 || params.length === 10, 'Only token/account and optional trusted approval window');
                    if (params.length === 10) {
                        const [start,end,startAgain,endAgain,cooldownStart,cooldownEnd] = params.slice(4);
                        assert.equal(start,startAgain); assert.equal(end,endAgain); assert.match(sql,/\) < 2/);
                        assert.equal(start,cooldownStart);assert.equal(end,cooldownEnd);
                        const within=state.rows.filter(row=>row.at >= Date.parse(start) && row.at < Date.parse(end));
                        if (state.now < Date.parse(start) || state.now >= Date.parse(end) || within.length >= 2 || within.some(row=>row.at > state.now-120000)) return [];
                    }
                    const start = Math.floor(state.now / 86400000) * 86400000;
                    const today = state.rows.filter(row => row.at >= start && row.at < start + 86400000);
                    if (state.rows.some(row => row.released === null) || today.length >= 10 || today.filter(row => row.userId === userId).length >= 3 ||
                        state.rows.some(row => row.userId === userId && row.at > state.now - 120000)) return [];
                    staged = { id, userId, at: state.now, released: null }; return [{ id }];
                }
                assert.match(sql, /update ai_pilot_attempts/);
                assert.match(sql, /where id = \$1::uuid and released_at is null/);
                if (state.failRelease) throw new Error('RELEASE_UNAVAILABLE');
                const row = state.rows.find(row => row.id === params[0]);
                if (row && row.released === null) row.released = Math.max(state.now, row.at);
                return [];
            } });
            if (state.failCommit) throw new Error('COMMIT_UNAVAILABLE');
            if (staged) state.rows.push(staged);
            return result;
        } finally { if (acquired) state.lock = false; }
    },
};
const original = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (id === '@/lib/db') return { db: fakeDB };
    return original.call(this, id, ...args);
};
function instance() {
    for (const file of ['../lib/auth/ai-pilot-limits.ts', '../lib/repositories/ai-pilot-quota.repository.ts']) delete require.cache[require.resolve(file)];
    return require('../lib/auth/ai-pilot-limits.ts');
}
const reset = () => { state.rows = []; state.now = Date.UTC(2026,9,9,12); state.fail = state.failRelease = state.failCommit = false; };
async function main() {
    const a = instance(), b = instance();
    assert.deepEqual(a.AI_PILOT_LIMITS, { perUserPerUTCDay:3, globalPerUTCDay:10, cooldownMs:120000, concurrency:1 });
    for (const id of [0,-1,NaN,1.5,'1',Number.MAX_SAFE_INTEGER + 1]) assert.equal(await a.reserveAIPilotAttempt(id), null);
    assert.equal(statements.length, 0);
    const racers = await Promise.all(Array.from({length:20}, (_, i) => (i % 2 ? a : b).reserveAIPilotAttempt(i + 1)));
    assert.equal(racers.filter(Boolean).length, 1); assert.equal(state.rows.length, 1);
    await racers.find(Boolean)();
    assert.equal(await b.reserveAIPilotAttempt(1), null);
    state.now += 119999; assert.equal(await a.reserveAIPilotAttempt(1), null);
    state.now++; let release = await b.reserveAIPilotAttempt(1); assert.ok(release); await release(); await release();
    state.now += 120000; release = await a.reserveAIPilotAttempt(1); assert.ok(release); await release();
    state.now += 120000; assert.equal(await b.reserveAIPilotAttempt(1), null, 'Failed/finished attempts remain charged');
    for (let id = 2; id <= 8; id++) { release = await b.reserveAIPilotAttempt(id); assert.ok(release); await release(); }
    assert.equal(state.rows.length, 10); assert.equal(await instance().reserveAIPilotAttempt(100), null, 'Restart preserves global daily quota');
    state.now = Date.UTC(2026,9,10); release = await instance().reserveAIPilotAttempt(1); assert.ok(release); await release();
    reset(); state.now = Date.UTC(2026,9,9,23,59,59); release = await a.reserveAIPilotAttempt(1); await release();
    state.now += 1000; assert.equal(await b.reserveAIPilotAttempt(1), null, 'Cooldown spans UTC midnight');
    state.now += 119000; release = await b.reserveAIPilotAttempt(1); assert.ok(release); await release();
    reset(); release = await a.reserveAIPilotAttempt(1); assert.ok(release);
    state.now += 86400000; assert.equal(await instance().reserveAIPilotAttempt(2), null, 'Crash slot never expires automatically');
    const repo = require('../lib/repositories/ai-pilot-quota.repository.ts');
    await repo.releasePilotAttempt('00000000-0000-0000-0000-000000000000');
    assert.equal(await b.reserveAIPilotAttempt(2), null, 'Unrelated token cannot release slot');
    state.failRelease = true; await release(); assert.equal(await b.reserveAIPilotAttempt(2), null);
    state.failRelease = false; await release(); release = await b.reserveAIPilotAttempt(2); assert.ok(release); await release();
    reset(); state.fail = true; assert.equal(await a.reserveAIPilotAttempt(1), null);
    state.fail = false; state.failCommit = true; assert.equal(await a.reserveAIPilotAttempt(1), null); assert.equal(state.rows.length, 0);
    reset(); const window={startsAt:new Date(state.now-1000),endsAt:new Date(state.now+3600000)};
    release=await a.reserveAIPilotAttempt(1,window);assert.ok(release);await release();assert.equal(await instance().reserveAIPilotAttempt(2,window),null,'Global pilot spacing across testers');state.now+=120000;
    release=await instance().reserveAIPilotAttempt(2,window);assert.ok(release);await release();
    assert.equal(await instance().reserveAIPilotAttempt(3,window),null,'Persistent approval-window cap: at most two attempts across users/restarts');
    assert.equal(state.rows.length,2);state.now=window.endsAt.getTime();assert.equal(await a.reserveAIPilotAttempt(4,window),null);
    assert.equal(await a.reserveAIPilotAttempt(4,{...window,prompt:'untrusted'}),null);
    assert.ok(!statements.some(sql => /delete|prompt|response|payload|research/i.test(sql)));
    assert.equal(outbound, 0);
    console.log('PASS synthetic multi-instance concurrency/SQL contract, committed attempts, restart persistence, UTC reset, cross-midnight cooldown, token-bound release, crash/release/storage/commit fail-closed and ZERO outbound calls');
    console.log('Synthetic model only; real PostgreSQL verification is tests/phase8-pilot-quota.acceptance.cjs.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
