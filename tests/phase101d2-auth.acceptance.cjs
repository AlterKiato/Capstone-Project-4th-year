/* eslint-disable @typescript-eslint/no-require-imports */
// Real local PostgreSQL/Drizzle, bcrypt, JWT, session/actions/services.
// Only Next request/cookie/navigation and delivery are synthetic boundaries. Never logs credentials/tokens.
// node --import tsx tests/phase101d2-auth.acceptance.cjs --confirmed-test-data --apply-reviewed-0013
// Later reruns: --accept-applied instead of --apply-reviewed-0013 (never reapplies).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const Module = require('node:module');
const { AsyncLocalStorage } = require('node:async_hooks');
const postgres = require('postgres');
const { drizzle } = require('drizzle-orm/postgres-js');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const { readMigrationFiles } = require('drizzle-orm/migrator');
const { sql } = require('drizzle-orm');
const schema = require('../db/schema/index.ts');
const marker = 'PHASE101D2_' + crypto.randomUUID();
const password = crypto.randomBytes(20).toString('hex');
const keys = new Set(), emails = new Set(), ids = [], notices = [];
const cookies = new Map(), cookieWrites = [], captured = [];
const envNames = ['NODE_ENV', 'JWT_SECRET', 'THESISHS_SHARED_AUTH_LIMITS', 'THESISHS_AUTH_LIMIT_SECRET',
    'THESISHS_AUTH_LIMITS_JSON', 'THESISHS_AUTH_SOURCE_MODE', 'VERCEL', 'THESISHS_LOCAL_MAILPIT', 'THESISHS_VERIFICATION_ORIGIN'];
const previousEnv = Object.fromEntries(envNames.map(n => [n, process.env[n]]));
const originalLoad = Module._load, limiterContext = new AsyncLocalStorage();
const tables = Object.keys(JSON.parse(fs.readFileSync('db/migrations/meta/0012_snapshot.json')).tables).map(n => n.replace(/^public\./, '')).sort();
let client, peer, db, peerDb, endedClient, endedDb, baseline, oldStructure, source, wrappedRepository;
let stage = 'configuration', passed = 0, migrated = false, cleanupNeeded = false, failure, cleanupFailure;
let turn = 0, limiterUnavailable = false, rollbackAfterCounters = false, calls = 0, sourceHeader = '192.0.2.44';
let lastRepositoryFailure;
let student, admin, adviser, deletedUser;
const requestHeaders = new Headers({ origin: 'http://127.0.0.1:3031', host: '127.0.0.1:3031' });
const row = async (query, database = db) => (await database.execute(query))[0];
const code = error => error?.code || error?.cause?.code || error?.name || 'unknown';
const tokenOf = message => new URLSearchParams(new URL(message.text.split('\n').at(-1)).hash.slice(1)).get('token');
async function check(label, work) { stage = label; await work(); passed++; console.log('PASS ' + label); }
function target() {
    assert.ok(process.argv.includes('--confirmed-test-data'));
    assert.ok(process.argv.includes('--apply-reviewed-0013') !== process.argv.includes('--accept-applied'));
    const values = [process.env.DATABASE_URL, ...fs.readdirSync('.').filter(f => /^\.env(?:\.|$)/.test(f) && fs.statSync(f).isFile())
        .map(f => require('dotenv').parse(fs.readFileSync(f)).DATABASE_URL)].filter(Boolean);
    assert.ok(values.length && values.every(v => v === values[0]), 'Conflicting target configuration');
    const value = new URL(values[0]);
    assert.ok(['postgres:', 'postgresql:'].includes(value.protocol));
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(value.hostname));
    assert.equal(value.port || '5432', '5432'); assert.equal(value.pathname, '/thesishs_ai'); assert.equal(value.search, '');
    return values[0];
}
async function identity(connection) {
    const [value] = await connection`select current_database() as database,inet_server_addr()::text as address,
        inet_server_port() as port,(select oid from pg_database where datname=current_database()) as oid,
        (select system_identifier::text from pg_control_system()) as cluster`;
    assert.equal(value.database, 'thesishs_ai'); assert.equal(value.port, 5432); assert.equal(value.oid, 16387);
    assert.ok(['127.0.0.1/32', '::1/128'].includes(value.address)); assert.equal(value.cluster, '7652422818440234372');
    return value;
}
async function ledger(database = db) {
    const entries = await database.execute(sql`select hash,created_at from drizzle.__drizzle_migrations order by created_at,id`);
    assert.ok([13, 14].includes(entries.length)); assert.equal(source.length, 14);
    entries.forEach((r, i) => { assert.equal(r.hash, source[i].hash); assert.equal(Number(r.created_at), source[i].folderMillis); });
    return entries.length;
}
async function structure(database = db, limiter = false) {
    const predicate = limiter ? sql`table_name='auth_rate_limit_buckets'` : sql`table_name<>'auth_rate_limit_buckets'`;
    const relation = limiter ? sql`t.relname='auth_rate_limit_buckets'` : sql`t.relname<>'auth_rate_limit_buckets'`;
    return {
        columns: await database.execute(sql`select table_name,column_name,data_type,udt_name,is_nullable,column_default,character_maximum_length
            from information_schema.columns where table_schema='public' and ${predicate} order by table_name,ordinal_position`),
        constraints: await database.execute(sql`select t.relname as table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) as definition
            from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
            where n.nspname='public' and ${relation} order by t.relname,c.conname`),
        indexes: await database.execute(sql`select tablename,indexname,indexdef from pg_indexes where schemaname='public' and
            ${limiter ? sql`tablename='auth_rate_limit_buckets'` : sql`tablename<>'auth_rate_limit_buckets'`} order by tablename,indexname`),
    };
}
async function fingerprints(database = db) {
    const result = {};
    for (const name of tables) {
        const owned = name === 'users' ? 'id' : ['notifications', 'email_verification_requests'].includes(name) ? 'user_id' : null;
        const condition = owned && ids.length ? sql`${sql.identifier(owned)} not in (${sql.join(ids.map(id => sql`${id}`), sql`, `)})` : sql`true`;
        result[name] = await row(sql`select count(*)::int as count,md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) as fingerprint
            from ${sql.identifier('public')}.${sql.identifier(name)} t where ${condition}`, database);
    }
    return result;
}
function freshLimits(overrides) {
    process.env.THESISHS_AUTH_LIMIT_SECRET = crypto.randomBytes(32).toString('hex');
    if (overrides) process.env.THESISHS_AUTH_LIMITS_JSON = JSON.stringify(overrides); else delete process.env.THESISHS_AUTH_LIMITS_JSON;
    sourceHeader = '192.0.2.44'; requestHeaders.set('x-vercel-forwarded-for', sourceHeader);
}
function hmac(value) { const digest = crypto.createHmac('sha256', process.env.THESISHS_AUTH_LIMIT_SECRET).update(value).digest('hex'); keys.add(digest); return digest; }
async function currentWindow() {
    return Number((await row(sql`select floor(extract(epoch from clock_timestamp())/900)*900000 as start`)).start);
}
async function seed(digest, start, expires, count = 1) {
    keys.add(digest); cleanupNeeded = true;
    await db.execute(sql`insert into auth_rate_limit_buckets(key_digest,window_start,expires_at,hit_count)
        values(${digest},${new Date(start).toISOString()},${new Date(expires).toISOString()},${count})`);
}
async function bucketRows() {
    return db.execute(sql`select key_digest,window_start,expires_at,hit_count from auth_rate_limit_buckets order by key_digest,window_start`);
}
async function main() {
    const connection = target();
    const options = { max: 2, connect_timeout: 3, idle_timeout: 2, onnotice: () => {}, connection: {
        application_name: 'thesishs-phase101d2-acceptance', statement_timeout: '10000', lock_timeout: '5000' } };
    client = postgres(connection, options); peer = postgres(connection, options);
    db = drizzle(client, { schema }); peerDb = drizzle(peer, { schema });
    source = readMigrationFiles({ migrationsFolder: 'db/migrations' });
    let beforeCount;
    await check('read-only identity/isolation, exact ledger, additive SQL/snapshot and capacity preflight', async () => {
        const id = await identity(client); await identity(peer); beforeCount = await ledger();
        if (process.argv.includes('--accept-applied')) assert.equal(beforeCount, 14, 'Applied 0013 required; migration execution is forbidden in this mode');
        const statements = source[13].sql.map(s => s.trim()).filter(Boolean);
        assert.equal(statements.length, 2); assert.match(statements[0], /^CREATE TABLE "auth_rate_limit_buckets"/);
        assert.match(statements[1], /^CREATE INDEX "auth_rate_limit_expiry_idx" ON "auth_rate_limit_buckets"/);
        assert.ok(!/\b(DROP|ALTER|TRUNCATE|DELETE|UPDATE)\b/i.test(statements.join('\n')));
        const prior = JSON.parse(fs.readFileSync('db/migrations/meta/0012_snapshot.json'));
        const next = JSON.parse(fs.readFileSync('db/migrations/meta/0013_snapshot.json'));
        assert.equal(next.prevId, prior.id); delete next.tables['public.auth_rate_limit_buckets'];
        for (const obj of [prior, next]) { delete obj.id; delete obj.prevId; } assert.deepEqual(next, prior);
        const actualTables = (await db.execute(sql`select tablename from pg_tables where schemaname='public' order by tablename`)).map(r => r.tablename);
        assert.deepEqual(actualTables, [...tables, ...(beforeCount === 14 ? ['auth_rate_limit_buckets'] : [])].sort());
        assert.equal((await db.execute(sql`select trigger_name from information_schema.triggers where trigger_schema='public'`)).length, 0);
        if (beforeCount === 14) assert.equal((await row(sql`select count(*)::int as n from auth_rate_limit_buckets`)).n, 0,
            'Existing limiter data requires review before global lazy cleanup can be exercised');
        const data = await row(sql`select count(*)::int as users,count(*) filter(where email ilike '%test%' or email like '%.invalid'
            or first_name ilike '%test%' or first_name ilike '%synthetic%')::int as marked from users`);
        assert.equal(data.users, data.marked); // Prior owner confirmation also covers the same unmarked research fixtures.
        const capacity = await row(sql`select current_setting('max_connections')::int-current_setting('superuser_reserved_connections')::int
            -current_setting('reserved_connections')::int-(select count(*) from pg_stat_activity)::int as spare`);
        assert.ok(capacity.spare >= 15, 'Five planned connections plus ten spare required');
        baseline = await fingerprints(); oldStructure = await structure();
        console.log(JSON.stringify({ target: id, ledgerEntries: beforeCount, pending: 14 - beforeCount, testMarkedAccounts: data.marked,
            isolation: 'same owner-approved all-development/test database', existingTables: tables.length }));
    });
    process.env.NODE_ENV = 'test'; process.env.JWT_SECRET = crypto.randomBytes(64).toString('hex');
    process.env.THESISHS_SHARED_AUTH_LIMITS = 'enabled'; process.env.VERCEL = '1'; process.env.THESISHS_AUTH_SOURCE_MODE = 'vercel-direct';
    freshLimits();
    const databaseProxy = new Proxy({}, { get(_target, property) {
        if (property === 'transaction') return async work => {
            if (limiterContext.getStore()) {
                if (limiterUnavailable) return endedDb.transaction(work);
                const selected = turn++ % 2 ? peerDb : db;
                return selected.transaction(async tx => {
                    const value = await work(tx); if (rollbackAfterCounters) throw Error('owned test rollback'); return value;
                });
            }
            return db.transaction(work);
        }
        const value = db[property]; return typeof value === 'function' ? value.bind(db) : value;
    } });
    Module._load = function(id, ...args) {
        if (id === 'server-only' || id === 'dotenv/config') return {};
        if (id === '@/lib/db') return { db: databaseProxy };
        if (id === 'next/headers') return { headers: async () => requestHeaders, cookies: async () => ({
            get: name => cookies.has(name) ? { value: cookies.get(name) } : undefined,
            set: (name, value, options) => { cookies.set(name, value); cookieWrites.push({ name, options }); }, delete: name => cookies.delete(name),
        }) };
        if (id === 'next/navigation') return { redirect: path => { throw Error('REDIRECT ' + path); } };
        if (id === 'next/cache') return { revalidatePath() {} };
        if (id === '@/lib/services/storage.service') return { createResearchDocumentSignedUrl: async () => { throw Error('Storage forbidden'); } };
        if (id === 'nodemailer') return { createTransport: () => { throw Error('SMTP forbidden'); } };
        if (id === '@/lib/repositories/auth-rate-limit.repository' && wrappedRepository) return wrappedRepository;
        return originalLoad.call(this, id, ...args);
    };
    const realRepository = require('../lib/repositories/auth-rate-limit.repository.ts');
    wrappedRepository = { ...realRepository, consumeAuthBuckets: async (global, identities) => {
        calls++; for (const b of [global, ...identities]) keys.add(b.keyDigest);
        cleanupNeeded = true;
        try { return await limiterContext.run(true, () => realRepository.consumeAuthBuckets(global, identities)); }
        catch (error) {
            // Whitelist diagnostic categories; never print query text, parameters or error messages.
            lastRepositoryFailure = { code: code(error), causeCode: error.cause?.code ?? null,
                dateSerialization: /Date/.test(error.cause?.message ?? '') && /string|Buffer|argument/i.test(error.cause?.message ?? '') };
            throw error;
        }
    } };
    const { allowAuthAttempt: allow } = require('../lib/services/auth-rate-limit.service.ts');
    const { getAuthLimitConfiguration, AUTH_RETRY_MESSAGE } = require('../lib/auth/auth-rate-limit-config.ts');
    if (beforeCount === 13) await check('enabled pre-migration limiter fails closed on the genuinely missing table', async () => {
        assert.equal(await allow('login', marker + '@example.invalid'), false);
    });
    await check('verify already-applied 0013 or explicitly apply once; exact ledger and old schema preserved', async () => {
        if (beforeCount === 13) {
            assert.ok(process.argv.includes('--apply-reviewed-0013')); assert.equal(await ledger(), 13);
            await migrate(db, { migrationsFolder: 'db/migrations' }); migrated = true;
        }
        assert.equal(await ledger(), 14); assert.deepEqual(await structure(), oldStructure); assert.deepEqual(await fingerprints(), baseline);
        const current = await structure(db, true);
        assert.deepEqual(current.columns.map(c => [c.column_name, c.data_type, c.is_nullable]), [
            ['key_digest', 'character varying', 'NO'], ['window_start', 'timestamp with time zone', 'NO'],
            ['expires_at', 'timestamp with time zone', 'NO'], ['hit_count', 'integer', 'NO']]);
        assert.equal(current.columns[0].character_maximum_length, 64);
        assert.equal(current.constraints.filter(c => c.contype === 'c').length, 3);
        assert.equal(current.constraints.filter(c => c.contype === 'p').length, 1);
        assert.equal(current.constraints.filter(c => c.contype === 'n').length, 4); // PostgreSQL 18 catalogs NOT NULL constraints.
        assert.match(current.constraints.find(c => c.contype === 'p').definition, /PRIMARY KEY \(key_digest, window_start\)/);
        assert.equal(current.indexes.length, 2); assert.ok(current.indexes.some(i => i.indexname === 'auth_rate_limit_expiry_idx'));
    });
    await check('actual PK/digest/count/expiry constraints reject invalid rows with rollback', async () => {
        const start = await currentWindow(), digest = hmac('constraint');
        for (const [expected, key, count, expiry] of [['23514', 'invalid', 1, start + 900000], ['23514', digest, 0, start + 900000],
            ['23514', digest, 1, start]]) {
            let actual;
            try { await db.transaction(tx => tx.execute(sql`insert into auth_rate_limit_buckets values(${key},${new Date(start).toISOString()},${new Date(expiry).toISOString()},${count})`)); }
            catch (error) { actual = code(error); } assert.equal(actual, expected);
        }
        await seed(digest, start, start + 900000); let duplicate;
        try { await seed(digest, start, start + 900000); } catch (error) { duplicate = code(error); } assert.equal(duplicate, '23505');
    });
    await check('timestamp regression: first legitimate admission persists exact UTC window/expiry and count', async () => {
        freshLimits(); const identifier = 'timestamp-regression@example.invalid';
        assert.equal(await allow('login', identifier), true);
        const expected = ['global', 'source', 'account'].map(dimension => hmac(JSON.stringify([
            'thesishs-auth-limit-v1', 'login', dimension, dimension === 'global' ? 'all' : dimension === 'source' ? sourceHeader : identifier,
        ])));
        const persisted = await peerDb.execute(sql`select key_digest,window_start,expires_at,hit_count,
            expires_at > clock_timestamp() as unexpired from auth_rate_limit_buckets
            where key_digest in (${sql.join(expected.map(key => sql`${key}`), sql`, `)})`);
        assert.equal(persisted.length, 3);
        for (const counter of persisted) {
            assert.equal(counter.hit_count, 1); assert.equal(counter.unexpired, true);
            assert.equal(new Date(counter.window_start).getTime() % 900000, 0);
            assert.equal(new Date(counter.expires_at).getTime() - new Date(counter.window_start).getTime(), 4500000);
            assert.match(counter.key_digest, /^[a-f0-9]{64}$/);
        }
        assert.equal(await allow('login', identifier), true);
        const counts = await peerDb.execute(sql`select hit_count from auth_rate_limit_buckets
            where key_digest in (${sql.join(expected.map(key => sql`${key}`), sql`, `)})`);
        assert.deepEqual(counts.map(r => r.hit_count), [2, 2, 2]);
    });
    await check('default thresholds/configuration and real normalized account/source/global separation', async () => {
        freshLimits();
        assert.deepEqual(['login', 'registration', 'verificationRequest', 'verificationConfirm'].map(op => getAuthLimitConfiguration(op).limits), [
            { account: 10, source: 300, global: 1200 }, { account: 5, source: 60, global: 120 },
            { account: 10, source: 120, global: 600 }, { source: 120, global: 600 }]);
        for (const op of ['login', 'registration', 'verificationRequest']) {
            const limit = getAuthLimitConfiguration(op).limits.account;
            for (let i = 0; i < limit; i++) assert.equal(await allow(op, 'NORMALIZED@example.invalid'), true);
            assert.equal(await allow(op, 'normalized@example.invalid'), false);
        }
        freshLimits({ login: { account: 2, source: 30, global: 30 } });
        assert.equal(await allow('login', 'one@example.invalid'), true); assert.equal(await allow('login', 'one@example.invalid'), true);
        assert.equal(await allow('login', 'one@example.invalid'), false); // Global/source counts commit on account denial.
        assert.equal(await allow('login', 'two@example.invalid'), true); // Another account remains usable on the same source.
        assert.equal(await allow('registration', 'three@example.invalid'), true); // Independent operation.
    });
    await check('source/global thresholds across all four operations using bounded configured limits', async () => {
        for (const op of ['login', 'registration', 'verificationRequest', 'verificationConfirm']) {
            freshLimits({ [op]: { ...(op === 'verificationConfirm' ? {} : { account: 3 }), source: 3, global: 5 } });
            for (let i = 0; i < 3; i++) assert.equal(await allow(op, String(i)), true);
            assert.equal(await allow(op, 'another'), false);
            requestHeaders.set('x-vercel-forwarded-for', '192.0.2.45'); assert.equal(await allow(op, 'another'), true);
            requestHeaders.set('x-vercel-forwarded-for', '192.0.2.46'); assert.equal(await allow(op, 'another'), false);
        }
        freshLimits({ verificationConfirm: { source: 2, global: 3 } });
        delete process.env.THESISHS_AUTH_SOURCE_MODE;
        for (let i = 0; i < 3; i++) { requestHeaders.set('x-forwarded-for', '192.0.2.' + i); assert.equal(await allow('verificationConfirm'), true); }
        assert.equal(await allow('verificationConfirm'), false); process.env.THESISHS_AUTH_SOURCE_MODE = 'vercel-direct';
    });
    await check('20 concurrent requests on independent pools admit exactly five and persist saturated counters', async () => {
        freshLimits({ login: { account: 5, source: 30, global: 30 } });
        const results = await Promise.all(Array.from({ length: 20 }, () => allow('login', 'concurrent@example.invalid')));
        assert.equal(results.filter(Boolean).length, 5);
        const expected = dimension => hmac(JSON.stringify(['thesishs-auth-limit-v1', 'login', dimension,
            dimension === 'global' ? 'all' : dimension === 'source' ? sourceHeader : 'concurrent@example.invalid']));
        const current = await peerDb.execute(sql`select key_digest,hit_count from auth_rate_limit_buckets where key_digest in
            (${expected('global')},${expected('source')},${expected('account')})`);
        // Account denial commits only preceding counters; identities are sorted by digest.
        const expectedSource = expected('source') < expected('account') ? 20 : 5;
        assert.deepEqual(current.map(r => r.hit_count).sort((a, b) => a - b), [5, expectedSource, 20]);
        const [a] = await client`select pg_backend_pid() as pid`; const [b] = await peer`select pg_backend_pid() as pid`;
        assert.notEqual(a.pid, b.pid);
    });
    await check('transaction failure rolls back all counters; authentication fails closed', async () => {
        freshLimits(); const before = await bucketRows(); rollbackAfterCounters = true;
        try { assert.equal(await allow('login', 'rollback@example.invalid'), false); } finally { rollbackAfterCounters = false; }
        assert.deepEqual(await bucketRows(), before); assert.equal(await allow('login', 'rollback@example.invalid'), true);
    });
    await check('old windows are inactive, live DB clock creates current window, cleanup removes at most 64 expired owned rows', async () => {
        const start = await currentWindow(), global = hmac('rollover-global'), identityKey = hmac('rollover-account');
        await seed(global, start - 900000, start + 3600000, 1); await seed(identityKey, start - 900000, start + 3600000, 1);
        const expiredKeys = Array.from({ length: 100 }, (_, i) => hmac('expired-' + i));
        for (const key of expiredKeys) await seed(key, start - 7200000, start - 1);
        assert.equal(await wrappedRepository.consumeAuthBuckets({ keyDigest: global, limit: 1 }, [{ keyDigest: identityKey, limit: 1 }]), true);
        const remaining = await db.execute(sql`select key_digest from auth_rate_limit_buckets where key_digest in (${sql.join(expiredKeys.map(k => sql`${k}`), sql`, `)})`);
        assert.equal(remaining.length, 36);
        const live = await db.execute(sql`select window_start,expires_at,hit_count from auth_rate_limit_buckets where key_digest=${global} order by window_start`);
        assert.equal(live.length, 2); assert.equal(live[1].hit_count, 1); assert.equal(new Date(live[1].window_start).getTime(), start);
        assert.equal(new Date(live[1].expires_at).getTime(), start + 4500000);
        freshLimits({ login: { account: 5, source: 20, global: 20 } });
        const concurrent = await Promise.all(Array.from({ length: 8 }, () => allow('login', 'cleanup-contention@example.invalid')));
        assert.equal(concurrent.filter(Boolean).length, 5);
        assert.equal((await row(sql`select count(*)::int as n from auth_rate_limit_buckets
            where key_digest in (${sql.join(expiredKeys.map(key => sql`${key}`), sql`, `)})`)).n, 0);
        const stillActive = await db.execute(sql`select window_start,expires_at,hit_count from auth_rate_limit_buckets where key_digest=${global} order by window_start`);
        assert.deepEqual(stillActive, live, 'Concurrent cleanup must preserve active counters');
    });
    const { createUser } = require('../lib/repositories/user.repository.ts');
    const { hashPassword } = require('../lib/auth/hash.ts');
    const { loginUser, registerUser } = require('../lib/services/auth.service.ts');
    const actions = require('../lib/actions/auth.action.ts'), session = require('../lib/auth/session.ts');
    const jwt = require('../lib/auth/jwt.ts'), guard = require('../lib/auth/authorization.ts');
    const notifications = require('../lib/services/notification.service.ts'), repository = require('../lib/services/repository.service.ts');
    const { parseRepositorySearchParams } = require('../lib/validations/repository.ts');
    const { registerSchema } = require('../lib/validations/auth.ts');
    const { managedAccountSchema } = require('../lib/validations/user.ts');
    const email = label => { const value = `${marker.toLowerCase()}-${label}@example.invalid`; emails.add(value); return value; };
    const form = values => { const value = new FormData(); Object.entries(values).forEach(([k, v]) => value.set(k, v)); return value; };
    const signIn = async user => session.createSession({ userId: user.id, roleId: user.roleId, email: user.email });
    await check('real synthetic Student/Admin/Adviser bcrypt logins and seven-day cookie sessions', async () => {
        freshLimits(); const hashed = await hashPassword(password), legacyPassword = '\u00e9'.repeat(40);
        for (const [label, roleId] of [['student', 3], ['admin', 1], ['adviser', 2], ['deleted', 3]]) {
            const accountPassword = label === 'deleted' ? legacyPassword : password;
            const account = await createUser({ firstName: 'Synthetic', lastName: marker, email: email(label),
                password: label === 'deleted' ? await hashPassword(accountPassword) : hashed, roleId });
            ids.push(account.id);
            if (label === 'student') student = account; else if (label === 'admin') admin = account; else if (label === 'adviser') adviser = account; else deletedUser = account;
            await assert.rejects(actions.loginAction({}, form({ email: account.email, password: accountPassword })), /REDIRECT \/dashboard/);
            assert.equal((await session.getSession()).roleId, roleId); assert.equal((await guard.requireAuth()).userId, account.id);
        }
        assert.deepEqual(cookieWrites.at(-1).options, { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 604800 });
        const current = await session.getSession(); assert.equal(current.exp - current.iat, 604800);
        process.env.NODE_ENV = 'production'; await signIn(student); assert.equal(cookieWrites.at(-1).options.secure, true); process.env.NODE_ENV = 'test';
        assert.equal((await row(sql`select email_verified_at from users where id=${student.id}`)).email_verified_at, null);
    });
    await check('real registration accepts 72 UTF-8 bytes, rejects excess bytes and preserves optional immediate session', async () => {
        freshLimits(); const boundary = 'é'.repeat(36), data = { firstName: 'Synthetic', lastName: marker, email: email('registration'), password: boundary, confirmPassword: boundary };
        await assert.rejects(actions.registerAction({}, form(data)), /REDIRECT \/dashboard/);
        const registered = await session.getSession(); ids.push(registered.userId); assert.equal(registered.roleId, 3);
        assert.equal((await loginUser({ email: data.email, password: boundary })).success, true);
        for (const password of ['a'.repeat(73), 'é'.repeat(37), '😀'.repeat(19)]) {
            const invalid = { ...data, email: email('rejected'), password, confirmPassword: password };
            assert.equal(registerSchema.safeParse(invalid).success, false);
            assert.equal(managedAccountSchema.safeParse({ ...invalid, roleId: 2 }).success, false);
            assert.equal((await registerUser(invalid)).success, false);
        }
        assert.equal((await row(sql`select count(*)::int as n from users where email=${email('rejected')}`)).n, 0);
        assert.equal(captured.length, 0);
    });
    await check('generic wrong/missing/inactive failures and real login/registration throttling', async () => {
        freshLimits(); const wrong = await loginUser({ email: student.email, password: 'synthetic-wrong-password' });
        const missing = await loginUser({ email: email('missing'), password });
        await db.execute(sql`update users set is_active=false where id=${student.id}`);
        const inactive = await loginUser({ email: student.email, password }); assert.deepEqual(wrong, missing); assert.deepEqual(wrong, inactive);
        await db.execute(sql`update users set is_active=true where id=${student.id}`);
        freshLimits({ login: { account: 1, source: 10, global: 10 }, registration: { account: 1, source: 10, global: 10 } });
        assert.equal((await loginUser({ email: student.email, password })).success, true);
        assert.equal((await loginUser({ email: student.email, password })).message, AUTH_RETRY_MESSAGE);
        const duplicate = { firstName: 'Synthetic', lastName: marker, email: student.email, password, confirmPassword: password };
        assert.equal((await registerUser(duplicate)).success, false); assert.equal((await registerUser(duplicate)).message, AUTH_RETRY_MESSAGE);
    });
    await check('active role permissions and notification recipient ownership use real PostgreSQL accounts', async () => {
        const records = await db.execute(sql`insert into notifications(user_id,title,message) values
            (${student.id},${marker},'Synthetic acceptance'),(${admin.id},${marker},'Synthetic acceptance') returning id,user_id`);
        notices.push(...records.map(r => r.id)); await signIn(student);
        assert.equal((await notifications.getUserNotifications(student.id)).success, true);
        assert.equal((await notifications.getUserNotifications(admin.id)).success, false);
        assert.equal((await notifications.removeUserNotification(records.find(r => r.user_id === admin.id).id, student.id)).success, false);
        assert.equal((await notifications.removeUserNotification(records.find(r => r.user_id === student.id).id, student.id)).success, true);
        await assert.rejects(guard.requireRole([1]), /REDIRECT \/dashboard/);
        for (const account of [student, admin, adviser]) {
            await signIn(account); await repository.getPublishedResearch(parseRepositorySearchParams({})); await repository.getPublishedResearchFilterOptions();
            assert.equal((await notifications.getCurrentNotificationPreview()).success, true);
        }
    });
    await check('valid JWTs cannot authorize inactive/deleted/stale-role accounts or delete notifications', async () => {
        const denied = async () => {
            assert.ok(await session.getSession()); await assert.rejects(guard.requireAuth(), /REDIRECT \/login/);
            await assert.rejects(notifications.getUserNotifications(student.id), /REDIRECT \/login/);
            await assert.rejects(notifications.removeUserNotification(notices[0], student.id), /REDIRECT \/login/);
            await assert.rejects(repository.getPublishedResearchFilterOptions(), /REDIRECT \/login/);
        };
        await signIn(student); await db.execute(sql`update users set is_active=false where id=${student.id}`); await denied();
        await db.execute(sql`update users set is_active=true,role_id=2 where id=${student.id}`); await denied();
        await db.execute(sql`update users set role_id=3 where id=${student.id}`);
        await signIn(deletedUser); await db.execute(sql`delete from users where id=${deletedUser.id} and last_name=${marker}`); await denied();
        await signIn(student); assert.equal((await guard.requireAuth()).userId, student.id);
    });
    await check('actual closed limiter connection returns controlled failures while authorized research reads continue', async () => {
        endedClient = postgres(connection, { max: 1, connect_timeout: 3 }); endedDb = drizzle(endedClient, { schema }); await endedClient.end();
        limiterUnavailable = true;
        try {
            freshLimits(); assert.equal(await allow('verificationConfirm'), false);
            assert.equal((await loginUser({ email: student.email, password })).message, AUTH_RETRY_MESSAGE);
            assert.equal((await registerUser({ firstName: 'Synthetic', lastName: marker, email: email('unavailable'), password, confirmPassword: password })).message, AUTH_RETRY_MESSAGE);
            await signIn(student); const before = calls;
            await repository.getPublishedResearch(parseRepositorySearchParams({})); await repository.getPublishedResearchDetails(0);
            assert.equal((await notifications.getUserNotifications(student.id)).success, true); assert.equal(calls, before);
        } finally { limiterUnavailable = false; }
        const secret = process.env.THESISHS_AUTH_LIMIT_SECRET; process.env.NODE_ENV = 'production'; delete process.env.THESISHS_AUTH_LIMIT_SECRET;
        try { assert.equal(await allow('login', student.email), false); } finally { process.env.THESISHS_AUTH_LIMIT_SECRET = secret; process.env.NODE_ENV = 'test'; }
    });
    await check('real signed malformed/expired/future/unsupported JWT claims reject; logout deletes only local cookie', async () => {
        const { SignJWT } = await import('jose'); const now = Math.floor(Date.now() / 1000), key = new TextEncoder().encode(process.env.JWT_SECRET);
        const claims = { userId: student.id, roleId: 3, email: student.email, iat: now, exp: now + 604800 };
        for (const patch of [{ exp: undefined }, { iat: undefined }, { userId: '1' }, { roleId: 99 }, { email: 'invalid' }, { exp: now - 1 }, { iat: now + 300 }]) {
            const token = await new SignJWT({ ...claims, ...patch }).setProtectedHeader({ alg: 'HS256' }).sign(key);
            assert.equal(await jwt.verifyToken(token), null);
        }
        await actions.logoutAction(); assert.equal(await session.getSession(), null);
    });
    await check('optional verification retains DB cooldown/rolling quota, digest-only single use and no automatic login', async () => {
        process.env.NODE_ENV = 'test'; freshLimits(); await signIn(student);
        const { createDevelopmentVerificationDelivery } = require('../lib/email/verification-delivery.ts');
        const { requestStudentEmailVerification: issue, confirmStudentEmailVerification: confirm } = require('../lib/services/email-verification.service.ts');
        const delivery = createDevelopmentVerificationDelivery('http://127.0.0.1:3031/verify-email', async message => { captured.push(message); });
        assert.equal((await issue(delivery)).success, true); assert.equal((await issue(delivery)).success, false);
        for (let i = 1; i < 5; i++) {
            await db.execute(sql`update email_verification_requests set last_requested_at=clock_timestamp()-interval '61 seconds' where user_id=${student.id}`);
            assert.equal((await issue(delivery)).success, true);
        }
        await db.execute(sql`update email_verification_requests set last_requested_at=clock_timestamp()-interval '61 seconds' where user_id=${student.id}`);
        assert.equal((await issue(delivery)).success, false);
        // Raw postgres-js SQL returns this timestamp array as text; use the application's column decoding.
        const [request] = await db.select().from(schema.emailVerificationRequests)
            .where(sql`${schema.emailVerificationRequests.userId}=${student.id}`);
        const token = tokenOf(captured.at(-1)); assert.match(request.tokenDigest, /^[a-f0-9]{64}$/); assert.notEqual(request.tokenDigest, token);
        assert.equal(request.requestTimes.length, 5); assert.equal(request.expiresAt - request.requestTimes.at(-1), 3600000);
        await actions.logoutAction(); const before = cookieWrites.length;
        const confirmations = await Promise.all([confirm(token), confirm(token)]); assert.equal(confirmations.filter(r => r.success).length, 1);
        assert.equal((await confirm(token)).success, false); assert.equal(await session.getSession(), null); assert.equal(cookieWrites.length, before);
        assert.equal((await loginUser({ email: student.email, password })).success, true);
        process.env.NODE_ENV = 'production'; assert.throws(() => createDevelopmentVerificationDelivery('http://127.0.0.1/verify-email', async () => {}));
        process.env.THESISHS_LOCAL_MAILPIT = 'enabled'; process.env.THESISHS_VERIFICATION_ORIGIN = 'http://127.0.0.1:3031';
        const verificationActions = require('../lib/actions/email-verification.action.ts');
        assert.equal((await verificationActions.requestVerificationAction({}, new FormData())).success, false);
        assert.equal((await verificationActions.confirmVerificationAction({}, form({ token }))).success, false); process.env.NODE_ENV = 'test';
    });
    await check('only HMAC keys/counters persisted; all pre-existing records and schema remain unchanged', async () => {
        for (const entry of await bucketRows()) { assert.match(entry.key_digest, /^[a-f0-9]{64}$/); assert.ok(keys.has(entry.key_digest)); }
        assert.deepEqual(await fingerprints(), baseline); assert.deepEqual(await structure(), oldStructure); assert.equal(await ledger(), 14);
    });
}
async function cleanup() {
    if (!cleanupNeeded || !baseline) return;
    stage = 'owned fixture cleanup';
    // Recover uncertain inserts using both this unguessable marker and exact intended emails.
    if (emails.size) {
        const owned = await db.execute(sql`select id from users where first_name='Synthetic' and last_name=${marker}
            and email in (${sql.join([...emails].map(e => sql`${e}`), sql`, `)})`);
        for (const { id } of owned) if (!ids.includes(id)) ids.push(id);
    }
    await db.transaction(async tx => {
        if (ids.length) {
            const list = sql.join(ids.map(id => sql`${id}`), sql`, `);
            await tx.execute(sql`delete from notifications where user_id in (${list}) and title=${marker}`);
            await tx.execute(sql`delete from email_verification_requests where user_id in (${list})`);
            await tx.execute(sql`delete from users where id in (${list}) and first_name='Synthetic' and last_name=${marker}`);
        }
        if ((await tx.execute(sql`select to_regclass('public.auth_rate_limit_buckets') is not null as present`))[0].present && keys.size)
            await tx.execute(sql`delete from auth_rate_limit_buckets where key_digest in (${sql.join([...keys].map(k => sql`${k}`), sql`, `)})`);
    });
    const independent = postgres(target(), { max: 1, connect_timeout: 3, onnotice: () => {}, connection: { statement_timeout: '10000' } });
    try {
        await identity(independent); const independentDb = drizzle(independent, { schema });
        assert.equal((await independent`select count(*)::int as n from users where last_name=${marker}`).at(0).n, 0);
        if (ids.length) {
            assert.equal((await independent`select count(*)::int as n from email_verification_requests where user_id=any(${ids})`).at(0).n, 0);
            assert.equal((await independent`select count(*)::int as n from notifications where user_id=any(${ids})`).at(0).n, 0);
        }
        if ((await independent`select to_regclass('public.auth_rate_limit_buckets') is not null as present`).at(0).present)
            assert.equal((await independent`select count(*)::int as n from auth_rate_limit_buckets`).at(0).n, 0);
        assert.deepEqual(await fingerprints(independentDb), baseline); assert.deepEqual(await structure(independentDb), oldStructure);
        console.log('PASS independent cleanup: no owned accounts/notifications/verification/limiter records; full original-row fingerprints unchanged');
    } finally { await independent.end({ timeout: 2 }); }
}
(async () => {
    try { await main(); } catch (error) {
        const scalar = value => ['boolean', 'number'].includes(typeof value) ? value : undefined;
        failure = { stage, code: code(error), assertion: error.code === 'ERR_ASSERTION'
            ? { operator: error.operator, actual: scalar(error.actual), expected: scalar(error.expected) } : undefined };
    }
    finally {
        rollbackAfterCounters = false; limiterUnavailable = false;
        try { await cleanup(); } catch (error) { cleanupFailure = { stage, code: code(error) }; }
        Module._load = originalLoad;
        for (const [n, v] of Object.entries(previousEnv)) { if (v === undefined) delete process.env[n]; else process.env[n] = v; }
        if (client) await client.end({ timeout: 3 }); if (peer) await peer.end({ timeout: 3 });
    }
    console.log(JSON.stringify({ passed, migrated0013: migrated, failure: failure || null, cleanupFailure: cleanupFailure || null,
        repositoryFailure: failure ? lastRepositoryFailure ?? null : null,
        realEmailsSent: 0, credentialsAndTokensOmitted: true }));
    if (failure || cleanupFailure) process.exitCode = 1;
})();
