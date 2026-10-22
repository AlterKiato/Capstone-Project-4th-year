/* eslint-disable @typescript-eslint/no-require-imports */
// Explicit owner-confirmed local DB only. Real PostgreSQL/crypto/services; mock session/delivery.
// node --import tsx tests/phase101b1-email-verification.acceptance.cjs --confirmed-test-data --apply-reviewed-0012
// Later reruns: replace --apply-reviewed-0012 with --accept-applied (never reapplies migration).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const Module = require('node:module');
const postgres = require('postgres');
const { drizzle } = require('drizzle-orm/postgres-js');
const { migrate } = require('drizzle-orm/postgres-js/migrator');
const { readMigrationFiles } = require('drizzle-orm/migrator');
const { sql, eq } = require('drizzle-orm');
const schema = require('../db/schema/index.ts');
const { users, emailVerificationRequests: requests } = schema;
const marker = 'PHASE101B1_' + crypto.randomUUID();
const intendedEmails = [];
const ids = [];
const password = crypto.randomBytes(24).toString('hex');
const originalLoad = Module._load;
const originalEnvironment = process.env.NODE_ENV;
let client, db, session, source, baseline, oldStructure, mainStudent, peer;
let passed = 0, stage = 'configuration', migrated = false, failedAfterConsume = false, sessionsCreated = 0;
let fixtureCleanupNeeded = false, failure, cleanupFailure;
const capture = [];
const pgCode = error => error?.code || error?.cause?.code || error?.name || 'unknown';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const tokenOf = message => new URLSearchParams(new URL(message.text.split('\n').at(-1)).hash.slice(1)).get('token');
const hash = token => crypto.createHash('sha256').update(token).digest('hex');
const row = async query => (await db.execute(query))[0];
async function check(label, work) { stage = label; await work(); passed++; console.log('PASS ' + label); }

function configuredTarget() {
    assert.ok(process.argv.includes('--confirmed-test-data'), 'Owner confirmation required');
    assert.ok(process.argv.includes('--apply-reviewed-0012') !== process.argv.includes('--accept-applied'), 'Choose one execution mode');
    const values = [];
    if (process.env.DATABASE_URL) values.push(process.env.DATABASE_URL);
    for (const file of ['.env', '.env.local', '.env.development', '.env.development.local']) {
        if (fs.existsSync(file)) {
            const value = require('dotenv').parse(fs.readFileSync(file)).DATABASE_URL;
            if (value) values.push(value);
        }
    }
    assert.ok(values.length && values.every(value => value === values[0]), 'Missing/conflicting configuration');
    const target = new URL(values[0]);
    assert.ok(['postgres:', 'postgresql:'].includes(target.protocol));
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
    assert.equal(target.port || '5432', '5432'); assert.equal(target.pathname, '/thesishs_ai'); assert.equal(target.search, '');
    return values[0];
}
async function identity(connection) {
    const [value] = await connection`select current_database() as name, inet_server_addr()::text as address,
        inet_server_port() as port, (select oid from pg_database where datname=current_database()) as oid,
        (select system_identifier::text from pg_control_system()) as cluster`;
    assert.equal(value.name, 'thesishs_ai'); assert.equal(value.port, 5432); assert.equal(value.oid, 16387);
    assert.ok(['127.0.0.1/32', '::1/128'].includes(value.address)); assert.equal(value.cluster, '7652422818440234372');
}
async function ledgerCheck() {
    const ledger = await db.execute(sql`select hash,created_at from drizzle.__drizzle_migrations order by created_at,id`);
    assert.ok([12, 13].includes(ledger.length));
    assert.equal(source.length, 13);
    ledger.forEach((entry, i) => { assert.equal(entry.hash, source[i].hash); assert.equal(Number(entry.created_at), source[i].folderMillis); });
    return ledger.length;
}
const existingTables = Object.keys(JSON.parse(fs.readFileSync('db/migrations/meta/0011_snapshot.json')).tables)
    .map(name => name.replace(/^public\./, '')).sort();
async function snapshot() {
    const result = {};
    for (const name of existingTables) {
        const table = sql`${sql.identifier('public')}.${sql.identifier(name)}`;
        // Normalize the pending nullable column, so before/after migration are comparable.
        const value = name === 'users'
            ? sql`to_jsonb(t) || jsonb_build_object('email_verified_at', to_jsonb(t)->'email_verified_at')`
            : sql`to_jsonb(t)`;
        const excluded = name === 'users' && ids.length
            ? sql`t.id not in (${sql.join(ids.map(id => sql`${id}`), sql`, `)})` : sql`true`;
        result[name] = await row(sql`select count(*)::int as count,
            md5(coalesce(string_agg((${value})::text, '' order by t.id), '')) as fingerprint
            from ${table} t where ${excluded}`);
    }
    // Existing verification rows on reruns must also remain intact.
    if ((await row(sql`select to_regclass('public.email_verification_requests') is not null as present`)).present) {
        const excluded = ids.length ? sql`user_id not in (${sql.join(ids.map(id => sql`${id}`), sql`, `)})` : sql`true`;
        result.verification = await row(sql`select count(*)::int as count,
            md5(coalesce(string_agg(to_jsonb(t)::text, '' order by user_id), '')) as fingerprint
            from email_verification_requests t where ${excluded}`);
    } else result.verification = { count: 0, fingerprint: crypto.createHash('md5').update('').digest('hex') };
    return result;
}
async function structure() {
    const result = {
        columns: await db.execute(sql`select table_name,column_name,data_type,udt_name,is_nullable,column_default,character_maximum_length
            from information_schema.columns where table_schema='public' and table_name <> 'email_verification_requests'
            and column_name <> 'email_verified_at' order by table_name,ordinal_position`),
        constraints: await db.execute(sql`select t.relname as table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) as definition
            from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
            where n.nspname='public' and t.relname <> 'email_verification_requests' order by t.relname,c.conname`),
        indexes: await db.execute(sql`select tablename,indexname,indexdef from pg_indexes where schemaname='public'
            and tablename <> 'email_verification_requests' order by tablename,indexname`),
    };
    return Object.fromEntries(Object.entries(result).map(([key, values]) => [key, Array.from(values, value => ({ ...value }))]));
}
async function resetStudent() {
    capture.length = 0; failedAfterConsume = false;
    await db.delete(requests).where(eq(requests.userId, mainStudent.id));
    await db.update(users).set({ emailVerifiedAt: null, email: mainStudent.email, roleId: 3, isActive: true }).where(eq(users.id, mainStudent.id));
    session = { userId: mainStudent.id, roleId: 3, email: mainStudent.email };
}
async function ageCooldown() {
    await db.execute(sql`update email_verification_requests set
        last_requested_at=last_requested_at-interval '61 seconds', expires_at=expires_at-interval '61 seconds',
        request_times=array(select instant-interval '61 seconds' from unnest(request_times) instant)
        where user_id=${mainStudent.id}`);
}
async function requestState() { return (await db.select().from(requests).where(eq(requests.userId, mainStudent.id)))[0]; }
async function accountState() { return (await db.select({ verified: users.emailVerifiedAt, email: users.email, active: users.isActive, role: users.roleId })
    .from(users).where(eq(users.id, mainStudent.id)))[0]; }
async function violation(expectedCode, work) {
    let actual;
    try { await db.transaction(work); } catch (error) { actual = pgCode(error); }
    assert.equal(actual, expectedCode);
}

async function main() {
    const connectionString = configuredTarget();
    client = postgres(connectionString, { max: 6, connect_timeout: 5, idle_timeout: 2, onnotice: () => {},
        connection: { application_name: 'thesishs-phase101b1-acceptance', statement_timeout: '10000', lock_timeout: '5000' } });
    await identity(client);
    db = drizzle(client, { schema }); source = readMigrationFiles({ migrationsFolder: 'db/migrations' });
    let migrationCount;
    await check('isolation identity, exact ledger and additive migration preflight', async () => {
        migrationCount = await ledgerCheck();
        const statements = source[12].sql.map(value => value.trim()).filter(Boolean);
        assert.equal(statements.length, 3);
        assert.match(statements[0], /^CREATE TABLE "email_verification_requests"/);
        assert.match(statements[1], /^ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;/);
        assert.match(statements[2], /^ALTER TABLE "email_verification_requests" ADD CONSTRAINT/);
        const [state] = await db.execute(sql`select to_regclass('public.email_verification_requests') is not null as present,
            exists(select 1 from information_schema.columns where table_schema='public' and table_name='users' and column_name='email_verified_at') as column_present`);
        assert.equal(state.present, migrationCount === 13); assert.equal(state.column_present, migrationCount === 13);
        const tables = await db.execute(sql`select tablename from pg_tables where schemaname='public' order by tablename`);
        assert.deepEqual(tables.map(t => t.tablename), [...existingTables, ...(migrationCount === 13 ? ['email_verification_requests'] : [])].sort());
        const triggers = await db.execute(sql`select trigger_name from information_schema.triggers where trigger_schema='public'`);
        assert.equal(triggers.length, 0, 'Unexpected database hooks require review');
        baseline = await snapshot(); oldStructure = await structure();
    });
    process.env.NODE_ENV = 'test';
    Module._load = function(id, ...args) {
        if (id === 'server-only') return {};
        if (id === '@/lib/db') return { db };
        if (id === '@/lib/auth/session') return { getSession: async () => session,
            createSession: async () => { sessionsCreated++; }, deleteSession: async () => {} };
        return originalLoad.call(this, id, ...args);
    };
    const realRepository = require('../lib/repositories/email-verification.repository.ts');
    const repositoryProxy = { ...realRepository, withVerificationAccount: (id, work) => realRepository.withVerificationAccount(id,
        store => work({ ...store, consume: async (...args) => {
            await store.consume(...args); if (failedAfterConsume) throw Error('Synthetic rollback after both writes');
        } })) };
    const moduleLoad = Module._load;
    Module._load = function(id, ...args) { return id === '@/lib/repositories/email-verification.repository'
        ? repositoryProxy : moduleLoad.call(this, id, ...args); };
    const { registerUser, loginUser } = require('../lib/services/auth.service.ts');
    const { hashPassword } = require('../lib/auth/hash.ts');
    const { createUser } = require('../lib/repositories/user.repository.ts');
    const { requestStudentEmailVerification: issue, confirmStudentEmailVerification: confirm } = require('../lib/services/email-verification.service.ts');
    const { createDevelopmentVerificationDelivery } = require('../lib/email/verification-delivery.ts');
    const delivery = createDevelopmentVerificationDelivery('http://127.0.0.1:3000/verify-email', async message => { capture.push(message); });
    const issueToken = async () => { assert.equal((await issue(delivery)).success, true); return tokenOf(capture.at(-1)); };

    await check('pre-migration synthetic Student registration and Student/Admin/Adviser password login', async () => {
        const passwordHash = await hashPassword(password);
        for (const role of [3, 3, 1, 2]) {
            const email = `${marker.toLowerCase()}-${ids.length}@example.invalid`; intendedEmails.push(email); fixtureCleanupNeeded = true;
            let account;
            if (role === 3) {
                const registered = await registerUser({ firstName: 'Synthetic', lastName: marker, email, password, confirmPassword: password });
                assert.equal(registered.success, true); account = registered.data;
            } else account = await createUser({ firstName: 'Synthetic', lastName: marker, email, password: passwordHash, roleId: role });
            ids.push(account.id);
            assert.equal((await loginUser({ email, password })).success, true);
            if (role === 3 && !mainStudent) mainStudent = account; else if (role === 3) peer = account;
        }
        assert.equal(capture.length, 0);
    });
    await check('migration 0012 applied once via Drizzle; exact ledger and unrelated structures preserved', async () => {
        if (migrationCount === 12) {
            assert.ok(process.argv.includes('--apply-reviewed-0012'), 'Migration application requires explicit flag');
            // ledgerCheck ensures the supported migrator can execute ONLY reviewed 0012.
            assert.equal(await ledgerCheck(), 12);
            await migrate(db, { migrationsFolder: 'db/migrations' }); migrated = true;
        }
        assert.equal(await ledgerCheck(), 13); assert.deepEqual(await structure(), oldStructure);
        assert.deepEqual(await snapshot(), baseline);
    });
    await check('nullable timezone column, request columns, foreign key, uniqueness and all checks exist', async () => {
        const [column] = await db.execute(sql`select data_type,is_nullable,column_default from information_schema.columns
            where table_schema='public' and table_name='users' and column_name='email_verified_at'`);
        assert.deepEqual({ ...column }, { data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: null });
        const constraints = await db.execute(sql`select conname,contype,pg_get_constraintdef(oid) as definition from pg_constraint
            where conrelid='public.email_verification_requests'::regclass order by conname`);
        assert.equal(constraints.filter(c => c.contype !== 'n').length, 7);
        assert.ok(constraints.some(c => c.contype === 'f' && c.definition.includes('REFERENCES users(id) ON DELETE RESTRICT')));
        const columns = await db.execute(sql`select column_name,udt_name from information_schema.columns
            where table_schema='public' and table_name='email_verification_requests' order by ordinal_position`);
        assert.equal(columns.length, 7); assert.equal(columns.find(c => c.column_name === 'request_times').udt_name, '_timestamptz');
        for (const id of ids) assert.equal((await row(sql`select email_verified_at from users where id=${id}`)).email_verified_at, null);
    });
    await check('digest-only persistence, precise 60-minute expiry and explicit confirmation/no session', async () => {
        await resetStudent(); const token = await issueToken(); const request = await requestState();
        assert.equal(request.tokenDigest, hash(token)); assert.ok(!JSON.stringify(request).includes(token));
        assert.equal(request.expiresAt.getTime() - request.lastRequestedAt.getTime(), 3600000);
        assert.equal(request.requestedEmail, mainStudent.email); assert.equal(request.consumedAt, null);
        assert.equal((await accountState()).verified, null); assert.equal((await confirm(token)).success, true);
        const consumed = await requestState(); assert.ok(consumed.consumedAt instanceof Date);
        assert.equal(consumed.consumedAt.getTime(), (await accountState()).verified.getTime());
        assert.equal((await confirm(token)).success, false); assert.equal(sessionsCreated, 0);
    });
    await check('actual FK, user primary key, digest uniqueness, expiry/consumption/digest/window constraints', async () => {
        await resetStudent(); await issueToken(); const original = await requestState();
        const fresh = { ...original, userId: peer.id, tokenDigest: hash(crypto.randomBytes(32)) };
        await violation('23503', tx => tx.insert(requests).values({ ...fresh, userId: -2147483648 }));
        await violation('23505', tx => tx.insert(requests).values({ ...fresh, userId: mainStudent.id }));
        await violation('23505', tx => tx.insert(requests).values({ ...fresh, tokenDigest: original.tokenDigest }));
        await violation('23514', tx => tx.insert(requests).values({ ...fresh, expiresAt: original.lastRequestedAt }));
        await violation('23514', tx => tx.insert(requests).values({ ...fresh, consumedAt: original.expiresAt }));
        await violation('23514', tx => tx.insert(requests).values({ ...fresh, tokenDigest: 'g'.repeat(64) }));
        await violation('23514', tx => tx.insert(requests).values({ ...fresh, requestTimes: Array(6).fill(original.lastRequestedAt) }));
        await violation('23514', tx => tx.insert(requests).values({ ...fresh, requestTimes: [] }));
    });
    await check('expired, malformed and invalid tokens fail without verification', async () => {
        await resetStudent(); const token = await issueToken();
        await db.execute(sql`update email_verification_requests set expires_at=clock_timestamp()-interval '1 second',
            last_requested_at=clock_timestamp()-interval '61 minutes', request_times=array[clock_timestamp()-interval '61 minutes']
            where user_id=${mainStudent.id}`);
        for (const input of [token, '0'.repeat(64), 'malformed', null]) assert.equal((await confirm(input)).success, false);
        assert.equal((await accountState()).verified, null);
    });
    await check('resend invalidates old tokens and enforces the 60-second cooldown', async () => {
        await resetStudent(); const old = await issueToken(); assert.equal((await issue(delivery)).success, false);
        await ageCooldown(); const fresh = await issueToken();
        assert.equal((await confirm(old)).success, false); assert.equal((await confirm(fresh)).success, true);
    });
    await check('current email, inactive and non-Student database states deny confirmation', async () => {
        for (const change of [{ email: `${marker.toLowerCase()}-changed@example.invalid` }, { isActive: false }, { roleId: 1 }, { roleId: 2 }]) {
            await resetStudent(); const token = await issueToken();
            await db.update(users).set(change).where(eq(users.id, mainStudent.id));
            assert.equal((await confirm(token)).success, false); assert.equal((await accountState()).verified, null);
        }
    });
    await check('simultaneous confirmation has exactly one committed winner', async () => {
        await resetStudent(); const token = await issueToken();
        const results = await Promise.all(Array.from({ length: 8 }, () => confirm(token)));
        assert.equal(results.filter(r => r.success).length, 1); assert.ok((await accountState()).verified);
    });
    await check('concurrent first requests/resends serialize; five-per-rolling-hour limit and ageing work', async () => {
        await resetStudent();
        let results = await Promise.all(Array.from({ length: 8 }, () => issue(delivery)));
        assert.equal(results.filter(r => r.success).length, 1);
        for (let i = 1; i < 5; i++) {
            await ageCooldown(); results = await Promise.all(Array.from({ length: 8 }, () => issue(delivery)));
            assert.equal(results.filter(r => r.success).length, 1);
        }
        await ageCooldown(); results = await Promise.all(Array.from({ length: 8 }, () => issue(delivery)));
        assert.equal(results.filter(r => r.success).length, 0); assert.equal((await requestState()).requestTimes.length, 5);
        await db.execute(sql`update email_verification_requests set request_times[1]=clock_timestamp()-interval '3601 seconds' where user_id=${mainStudent.id}`);
        await issueToken(); assert.equal((await requestState()).requestTimes.length, 5);
    });
    await check('real rollback after BOTH updates preserves unverified account and unused token', async () => {
        await resetStudent(); const token = await issueToken(); failedAfterConsume = true;
        assert.equal((await confirm(token)).success, false);
        assert.equal((await accountState()).verified, null); assert.equal((await requestState()).consumedAt, null);
        failedAfterConsume = false; assert.equal((await confirm(token)).success, true);
    });
    await check('real account row lock blocks confirmation; expiry is checked after the wait', async () => {
        await resetStudent(); const token = await issueToken();
        let unlock, locked; const held = new Promise(resolve => { locked = resolve; });
        const release = new Promise(resolve => { unlock = resolve; });
        const holder = db.transaction(async tx => {
            await tx.select({ id: users.id }).from(users).where(eq(users.id, mainStudent.id)).for('update');
            await tx.execute(sql`update email_verification_requests set expires_at=clock_timestamp()+interval '500 milliseconds' where user_id=${mainStudent.id}`);
            locked(); await release;
        });
        await held; let completed = false;
        const pending = confirm(token).then(value => { completed = true; return value; });
        try {
            let observed = false;
            for (let i = 0; i < 15; i++) {
                const waits = await db.execute(sql`select count(*)::int as count from pg_stat_activity
                    where application_name='thesishs-phase101b1-acceptance' and wait_event_type='Lock'`);
                if (waits[0].count > 0) { observed = true; break; } await pause(20);
            }
            assert.equal(observed, true); assert.equal(completed, false); await pause(550);
        } finally { unlock(); await holder; }
        assert.equal((await pending).success, false); assert.equal((await accountState()).verified, null);
    });
    await check('failed mock delivery retains quota and account; later resend recovers', async () => {
        await resetStudent(); const broken = createDevelopmentVerificationDelivery('http://127.0.0.1:3000/verify-email', async () => { throw Error('Synthetic send failure'); });
        assert.equal((await issue(broken)).success, false); assert.equal((await requestState()).requestTimes.length, 1);
        assert.equal((await accountState()).verified, null); assert.equal((await issue(delivery)).success, false);
        await ageCooldown(); const token = await issueToken(); assert.equal((await requestState()).requestTimes.length, 2);
        assert.equal((await confirm(token)).success, true);
    });
    await check('post-migration unverified Student/Admin/Adviser login and original records remain intact', async () => {
        await resetStudent();
        for (const email of intendedEmails) assert.equal((await loginUser({ email, password })).success, true);
        assert.equal((await accountState()).verified, null); assert.deepEqual(await snapshot(), baseline);
        assert.equal(sessionsCreated, 0);
    });
}

async function cleanup() {
    if (!fixtureCleanupNeeded) return;
    stage = 'synthetic-only cleanup';
    // Recover only this run's exact intended emails + marker, including an uncertain insert acknowledgement.
    const owned = await db.execute(sql`select id from users where first_name='Synthetic' and last_name=${marker}
        and email in (${sql.join([...intendedEmails, `${marker.toLowerCase()}-changed@example.invalid`].map(value => sql`${value}`), sql`, `)})`);
    for (const { id } of owned) if (!ids.includes(id)) ids.push(id);
    if (ids.length) await db.transaction(async tx => {
        const list = sql.join(ids.map(id => sql`${id}`), sql`, `);
        if ((await tx.execute(sql`select to_regclass('public.email_verification_requests') is not null as present`))[0].present)
            await tx.execute(sql`delete from email_verification_requests where user_id in (${list})`);
        const removed = await tx.execute(sql`delete from users where id in (${list}) and first_name='Synthetic' and last_name=${marker} returning id`);
        assert.equal(removed.length, owned.length);
    });
    // Independent connection verifies cleanup and the pre-existing complete row fingerprints.
    const independent = postgres(configuredTarget(), { max: 1, connect_timeout: 5, idle_timeout: 2, onnotice: () => {} });
    try {
        await identity(independent);
        const [remaining] = await independent`select count(*)::int as count from users where last_name=${marker}`;
        assert.equal(remaining.count, 0);
        if ((await independent`select to_regclass('public.email_verification_requests') is not null as present`)[0].present) {
            const [requestsLeft] = await independent`select count(*)::int as count from email_verification_requests where user_id=any(${ids})`;
            assert.equal(requestsLeft.count, 0);
        }
        const originalDb = db;
        try { db = drizzle(independent, { schema }); assert.deepEqual(await snapshot(), baseline); }
        finally { db = originalDb; }
        console.log('PASS independent synthetic cleanup and original-record fingerprints');
    } finally { await independent.end({ timeout: 2 }); }
}

(async () => {
    try { await main(); }
    catch (error) { failure = { stage, code: pgCode(error) }; }
    finally {
        try { await cleanup(); } catch (error) { cleanupFailure = { stage: 'cleanup', code: pgCode(error) }; }
        Module._load = originalLoad;
        if (originalEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalEnvironment;
        if (client) await client.end({ timeout: 3 });
    }
    console.log(JSON.stringify({ passed, migrated0012: migrated, failed: failure || null, cleanupFailure: cleanupFailure || null,
        rawTokensAndCredentialsOmitted: true, realEmailsSent: 0 }));
    if (failure || cleanupFailure) process.exitCode = 1;
})();
