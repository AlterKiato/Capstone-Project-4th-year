/* eslint-disable @typescript-eslint/no-require-imports */
// Actual Drizzle SQL with a serializing, transactional driver double. No PostgreSQL/network.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const { drizzle } = require('drizzle-orm/pg-proxy');
const queries = [], rows = new Map();
let time = Date.parse('2026-10-22T00:00:00Z'), fault = false, queue = Promise.resolve();
const db = drizzle(async (query, params) => {
    queries.push({ query, params });
    if (fault) throw Error('private driver failure');
    if (query.startsWith('delete')) {
        const expired = [...rows].filter(([, r]) => r.expires <= time).sort((a, b) => a[1].expires - b[1].expires).slice(0, 64);
        expired.forEach(([key]) => rows.delete(key)); return { rows: [] };
    }
    if (query.startsWith('select')) return { rows: [{ now: new Date(time).toISOString() }] };
    assert.match(query, /^insert into "auth_rate_limit_buckets"/);
    const [digest, start, expiry, limit] = params;
    // The real postgres-js driver rejects bare Dates in this raw SQL context.
    assert.equal(typeof start, 'string'); assert.equal(typeof expiry, 'string');
    assert.match(start, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    assert.match(expiry, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    const key = digest + ':' + new Date(start).getTime(), row = rows.get(key);
    if (row && row.count >= limit) return { rows: [] };
    rows.set(key, { count: (row?.count ?? 0) + 1, expires: new Date(expiry).getTime() });
    return { rows: [{ hit_count: rows.get(key).count }] };
});
// Simulates serialization/rollback, not proof of PostgreSQL lock behavior.
db.transaction = work => {
    const pending = queue.then(async () => {
        const before = structuredClone(rows);
        try { return await work(db); } catch (error) { rows.clear(); before.forEach((r, k) => rows.set(k, r)); throw error; }
    });
    queue = pending.catch(() => {}); return pending;
};
const original = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (id === '@/lib/db') return { db };
    return original.call(this, id, ...args);
};
const path = require.resolve('../lib/repositories/auth-rate-limit.repository.ts');
const first = require(path).consumeAuthBuckets;
delete require.cache[path];
const second = require(path).consumeAuthBuckets;
const bucket = (letter, limit) => ({ keyDigest: letter.repeat(64), limit });
function reset() { rows.clear(); queries.length = 0; fault = false; time = Date.parse('2026-10-22T00:00:00Z'); }
test('Shared authentication persistence SQL contracts (driver double)', async t => {
    await t.test('two independent repository instances share concurrent account budgets', async () => {
        reset(); const results = await Promise.all(Array.from({ length: 40 }, (_, i) =>
            (i % 2 ? first : second)(bucket('a', 100), [bucket('b', 10)])));
        assert.equal(results.filter(Boolean).length, 10);
        assert.equal([...rows.values()].find(r => r.count === 40).count, 40);
        assert.equal(rows.get('b'.repeat(64) + ':' + time).count, 10);
    });
    await t.test('atomic conditional upsert, global-first order and parameterized digest persistence', async () => {
        reset(); await first(bucket('f', 20), [bucket('d', 5), bucket('b', 5)]);
        const inserts = queries.filter(r => r.query.startsWith('insert'));
        assert.deepEqual(inserts.map(r => r.params[0][0]), ['f', 'b', 'd']);
        for (const { query, params } of inserts) {
            assert.match(query, /on conflict \(key_digest, window_start\) do update/);
            assert.match(query, /where "auth_rate_limit_buckets"\."hit_count" < \$/);
            assert.match(query, /returning hit_count/); assert.ok(!query.includes(params[0]));
        }
        assert.match(queries[0].query, /limit 64 for update skip locked/);
        assert.ok(queries[1].query.includes('clock_timestamp()'));
    });
    await t.test('a saturated global budget cannot allocate new identity rows', async () => {
        reset(); assert.equal(await first(bucket('a', 1), [bucket('b', 5)]), true);
        assert.equal(await second(bucket('a', 1), [bucket('c', 5)]), false);
        assert.equal(rows.size, 2);
    });
    await t.test('fixed window resets at the exact boundary and expiration is bounded', async () => {
        reset(); const start = time;
        assert.equal(await first(bucket('a', 1), []), true);
        time = start + 899999; assert.equal(await second(bucket('a', 1), []), false);
        time++; assert.equal(await second(bucket('a', 1), []), true);
        assert.equal(rows.get('a'.repeat(64) + ':' + start).expires, start + 4500000);
        time = start + 4500000; await first(bucket('a', 1), []);
        assert.ok(!rows.has('a'.repeat(64) + ':' + start));
    });
    await t.test('lazy cleanup deletes at most 64 expired rows per admission', async () => {
        reset(); for (let i = 0; i < 100; i++) rows.set('expired' + i, { count: 1, expires: time - 1 });
        await first(bucket('a', 1), []);
        assert.equal([...rows.keys()].filter(k => k.startsWith('expired')).length, 36);
    });
    await t.test('driver failures reject the transaction and do not admit traffic', async () => {
        reset(); fault = true;
        await assert.rejects(first(bucket('a', 1), []), error => error.cause?.message === 'private driver failure');
        assert.equal(rows.size, 0);
    });
}).finally(() => { Module._load = original; });
