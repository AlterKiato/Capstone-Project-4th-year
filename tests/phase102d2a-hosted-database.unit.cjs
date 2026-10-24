/* eslint-disable @typescript-eslint/no-require-imports */
// Pure configuration, actual Drizzle driver/migrator and transactional doubles. No live service or credentials.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const path = require('node:path');
const vm = require('node:vm');
const { X509Certificate } = require('node:crypto');
const tls = require('node:tls');
const postgres = require('postgres');
const { drizzle } = require('drizzle-orm/postgres-js');
const { sql } = require('drizzle-orm');
const { databaseConfiguration } = require('../lib/db/config.ts');
const { verifyDatabaseIdentity } = require('../lib/db/identity.ts');
const { guardedRuntimeClient } = require('../lib/db/guarded-client.ts');
const { previewMigrationSource, verifyPreviewLedger } = require('../scripts/preview-migration-source.ts');
const { initializePreview, previewFailure } = require('../scripts/preview-initialization.ts');
const { main, inspectPreviewState, applyPreviewMigrations } = require('../scripts/initialize-preview-database.ts');
const { verifyPreviewColumnNames } = require('../scripts/preview-schema.ts');
const { inspectOperatorTarget } = require('../scripts/database-operator.ts');
const ref = 'a'.repeat(20), otherRef = 'b'.repeat(20);
// Public trust material from the approved Dashboard link; not a runtime fallback.
const ca = readFileSync('tests/fixtures/tls/supabase-root-2021.crt', 'utf8');
const endpoint = (host, user) => ({ host, port: 5432, database: 'postgres', user });
function fixture(mode = 'direct') {
    const development = { identity: 'local', runtime: endpoint('localhost', 'local_runtime'), operator: endpoint('localhost', 'local_operator'),
        observed: { provider: 'postgres', databaseOid: '16387', cluster: '101', runtimeRole: 'local_runtime', operatorRole: 'local_operator' } };
    const host = mode === 'session' ? 'aws-1-us-east-1.pooler.supabase.com' : `db.${ref}.supabase.co`;
    const preview = { identity: 'isolated-preview', runtime: endpoint(host, mode === 'session' ? `app_runtime.${ref}` : 'app_runtime'),
        operator: endpoint(host, mode === 'session' ? `app_operator.${ref}` : 'app_operator'),
        observed: { provider: 'supabase', projectRef: ref, databaseOid: '5', runtimeRole: 'app_runtime', operatorRole: 'app_operator' } };
    const profiles = { development, preview, production: { identity: 'future-production', reserved: true } };
    const env = { NODE_ENV: 'production', VERCEL_ENV: 'preview', THESISHS_DATABASE_ENV: 'preview',
        THESISHS_DATABASE_CA_PEM: ca,
        THESISHS_DATABASE_CONNECTION_MODE: mode, THESISHS_DATABASE_TARGETS_JSON: JSON.stringify(profiles),
        DATABASE_URL: `postgresql://${preview.runtime.user}:synthetic-fixture-only@${host}:5432/postgres?sslmode=verify-full` };
    return { profiles, env };
}
const mapped = (f, changes = {}) => ({ ...f.env, ...changes, THESISHS_DATABASE_TARGETS_JSON: JSON.stringify(f.profiles) });

test('R4A hosted runtime and operator load explicit CA trust into the actual lazy driver', async () => {
    for (const mode of ['direct', 'session']) for (const purpose of ['runtime', 'operator']) {
        const f = fixture(mode), env = { ...f.env };
        if (purpose === 'operator') {
            env.THESISHS_DATABASE_ADMIN_URL = env.DATABASE_URL.replace('app_runtime', 'app_operator');
            delete env.DATABASE_URL;
        }
        const c = databaseConfiguration(env, purpose), client = postgres(c.url, c.options);
        try {
            assert.equal(client.options.ssl.ca, ca);
            assert.equal(client.options.ssl.rejectUnauthorized, true);
            assert.equal(client.options.ssl.checkServerIdentity, undefined);
            assert.doesNotThrow(() => tls.createSecureContext(client.options.ssl));
        } finally { await client.end({ timeout: 1 }); }
    }
});
test('R4A missing, malformed, bundled, private-key and oversized CA inputs fail without echoing inputs', () => {
    const f = fixture();
    for (const value of [undefined, '', 'sensitive-input-marker', '/operator/root.crt', 'x'.repeat(16385),
        ca + ca, ca + 'unexpected trailer', ca.replace('CERTIFICATE', 'PRIVATE KEY'),
        '-----BEGIN CERTIFICATE-----\nnot-a-certificate\n-----END CERTIFICATE-----']) {
        assert.throws(() => databaseConfiguration({ ...f.env, THESISHS_DATABASE_CA_PEM: value }),
            error => error.message === 'Database configuration is missing or not approved for this environment.');
    }
});
test('R4A CA validity dates are enforced and CRLF PEM is accepted', t => {
    const f = fixture(), certificate = new X509Certificate(ca);
    assert.equal(databaseConfiguration({ ...f.env, THESISHS_DATABASE_CA_PEM: ca.replaceAll('\n', '\r\n') }).options.ssl.ca, ca);
    for (const now of [Date.parse(certificate.validFrom) - 1, Date.parse(certificate.validTo)]) {
        t.mock.method(Date, 'now', () => now);
        assert.throws(() => databaseConfiguration(f.env));
        t.mock.restoreAll();
    }
});
test('R4A verification overrides and transaction pooling remain refused', () => {
    const f = fixture('session');
    for (const change of [{ NODE_TLS_REJECT_UNAUTHORIZED: '0' }, { THESISHS_DATABASE_CONNECTION_MODE: 'transaction' },
        { DATABASE_URL: f.env.DATABASE_URL.replace('5432', '6543') },
        { DATABASE_URL: f.env.DATABASE_URL.replace('verify-full', 'disable') },
        { DATABASE_URL: f.env.DATABASE_URL + '&rejectUnauthorized=false' },
        { DATABASE_URL: f.env.DATABASE_URL + '&checkServerIdentity=disabled' }])
        assert.throws(() => databaseConfiguration({ ...f.env, ...change }));
});
test('R4A Development ignores hosted CA input and retains existing TLS opt-in behavior', () => {
    const env = { NODE_ENV: 'development', DATABASE_URL: 'postgres://local:synthetic@localhost/app', THESISHS_DATABASE_CA_PEM: 'not-used' };
    assert.equal(databaseConfiguration(env).options.ssl, false);
    assert.deepEqual(databaseConfiguration({ ...env, DATABASE_URL: env.DATABASE_URL + '?sslmode=verify-full' }).options.ssl,
        { rejectUnauthorized: true });
});

function driver(config, changes = {}) {
    const state = { queries: [], application: 0, identities: 0, begins: 0, commits: 0, rollbacks: 0, ...changes };
    const row = { database: config.endpoint.database, username: config.observed.runtimeRole, login: config.observed.runtimeRole,
        oid: config.observed.databaseOid, control: false, connect: true, create_database_objects: false, create_public: false,
        create_ledger: false, owns_objects: false, owns_schema: false, owns_database: false };
    const roles = [config.observed.runtimeRole, config.observed.operatorRole].map(name => ({ name, login: true, elevated: false, memberships: false }));
    const client = (parts, ...parameters) => {
        if (typeof parts === 'string') return { identifier: parts };
        assert.ok(Array.isArray(parts) && Object.hasOwn(parts, 'raw'));
        return client.unsafe(parts.join('?'), parameters);
    };
    client.options = { parsers: {}, serializers: {} };
    client.unsafe = (query, parameters = []) => {
        state.queries.push(query);
        let rows;
        if (query.startsWith('select pg_catalog.current_database()')) { state.identities++; rows = [{ ...row, ...(state.row ?? {}) }]; }
        else if (query.includes('system_identifier')) rows = [{ cluster: state.cluster }];
        else if (query.includes('from pg_catalog.pg_roles r where')) rows = state.roles ?? roles;
        else if (query.includes('has_schema_privilege')) rows = [{ create_public: true, temporary: true, create_ledger: true, ...(state.permissions ?? {}) }];
        else if (state.inspection && query.includes('select to_regclass')) rows = [{ ledger: false }];
        else if (state.inspection && query.includes('select c.relname,c.relkind')) rows = state.relations ?? [];
        else if (state.inspection && query.includes('count(*)')) rows = [{ count: 20 }];
        else if (state.inspection && /from pg_proc|from pg_type|information_schema\.columns|from pg_constraint|from pg_indexes|from pg_sequences/.test(query)) rows = [];
        else if (query.includes("current_setting('transaction_read_only')")) rows = [{ read_only: 'off' }];
        else if (query.includes('from drizzle.__drizzle_migrations')) rows = previewMigrationSource().migrations.map(m => ({ hash: m.hash, created_at: String(m.folderMillis) }));
        else if (query.includes('order by created_at desc')) rows = [];
        else { state.application++; rows = [{ value: 1 }]; }
        if (query.includes('insert into "drizzle"."__drizzle_migrations"')) (state.migrationRows ??= []).push(parameters);
        return { then: (yes, no) => Promise.resolve(rows).then(yes, no), values: () => Promise.resolve([[1]]) };
    };
    client.begin = async callback => {
        state.begins++;
        try { const result = await callback(client); state.commits++; return result; }
        catch (error) { state.rollbacks++; throw error; }
    };
    client.savepoint = async callback => callback(client);
    client.end = async () => {};
    return { client, state, row, roles };
}

test('isolated Preview accepts production-mode Next and an explicitly non-connectable Production reservation', () => {
    const f = fixture(), c = databaseConfiguration(f.env);
    assert.equal(c.environment, 'preview'); assert.equal(c.options.max, 2); assert.equal(c.options.prepare, true);
    assert.deepEqual(c.options.ssl, { rejectUnauthorized: true, ca });
    assert.throws(() => databaseConfiguration({ ...f.env, VERCEL_ENV: 'production', THESISHS_DATABASE_ENV: 'production' }));
    for (const edit of [p => { delete p.preview.observed; }, p => { delete p.preview.observed.databaseOid; },
        p => { delete p.preview.observed.projectRef; }, p => { delete p.development; }, p => { p.production = { identity: 'placeholder' }; }]) {
        const g = fixture(); edit(g.profiles); assert.throws(() => databaseConfiguration(mapped(g)));
    }
});
test('cross-environment identity and physical reuse fail even through aliases', () => {
    const f = fixture(); f.profiles.production = structuredClone(f.profiles.preview); f.profiles.production.identity = 'other-label';
    assert.throws(() => databaseConfiguration(mapped(f)));
    const g = fixture(); g.profiles.preview.observed = { ...g.profiles.development.observed, runtimeRole: 'app_runtime', operatorRole: 'app_operator' };
    g.profiles.preview.runtime.host = g.profiles.preview.operator.host = 'remote.example.invalid';
    g.env.DATABASE_URL = 'postgresql://app_runtime:synthetic-fixture-only@remote.example.invalid/postgres';
    assert.throws(() => databaseConfiguration(mapped(g)));
});
test('distinct verified Supabase routes may share a pooler; role names can contain provider-independent dots', () => {
    const f = fixture('session'), p = structuredClone(f.profiles.preview); p.identity = 'separate-production'; p.observed.projectRef = otherRef;
    p.runtime.user = `app_runtime.${otherRef}`; p.operator.user = `app_operator.${otherRef}`; f.profiles.production = p;
    assert.equal(databaseConfiguration(mapped(f)).mode, 'session');
    const g = fixture('session'); g.profiles.preview.observed.runtimeRole = 'app.runtime'; g.profiles.preview.runtime.user = `app.runtime.${ref}`;
    g.env.DATABASE_URL = g.env.DATABASE_URL.replace(`app_runtime.${ref}`, `app.runtime.${ref}`);
    assert.equal(databaseConfiguration(mapped(g)).observed.runtimeRole, 'app.runtime');
});
test('wrong routes, qualified aliases of the same role, transaction mode and invalid TLS are rejected', () => {
    const f = fixture('session');
    for (const change of [{ THESISHS_DATABASE_ENV: 'production' }, { THESISHS_DATABASE_CONNECTION_MODE: 'transaction' },
        { THESISHS_DATABASE_CONNECTION_MODE: 'direct' }, { DATABASE_URL: f.env.DATABASE_URL.replace('5432', '6543') },
        { DATABASE_URL: f.env.DATABASE_URL.replace('verify-full', 'disable') }, { THESISHS_DATABASE_ADMIN_URL: 'not-allowed' }])
        assert.throws(() => databaseConfiguration({ ...f.env, ...change }));
    const g = fixture('session'); g.profiles.preview.observed.operatorRole = 'app_runtime';
    assert.throws(() => databaseConfiguration(mapped(g)));
});
test('effective identity is observed independently of pooler username syntax; managed fallback is explicit', async () => {
    const c = databaseConfiguration(fixture('session').env), d = driver(c);
    assert.equal((await verifyDatabaseIdentity(d.client, c)).username, 'app_runtime');
    for (const row of [{ oid: '6' }, { database: 'other' }, { username: 'app_operator' }, { login: 'app_operator' }, { connect: false }])
        await assert.rejects(verifyDatabaseIdentity(driver(c, { row }).client, c));
    await assert.rejects(verifyDatabaseIdentity(driver(c, { row: { control: true }, cluster: '202' }).client, c));
    const pinned = { ...c, observed: { ...c.observed, cluster: '202' } };
    await verifyDatabaseIdentity(driver(pinned, { row: { control: true }, cluster: '202' }).client, pinned);
    assert.equal((await verifyDatabaseIdentity(driver(pinned).client, pinned)).verification, 'provider-route');
    const native = { ...pinned, observed: { ...pinned.observed, provider: 'postgres', projectRef: undefined } };
    await assert.rejects(verifyDatabaseIdentity(driver(native).client, native));
});
test('runtime and operator effective privileges cannot be interchanged or escalated through memberships', async () => {
    const c = databaseConfiguration(fixture().env);
    for (const key of ['create_database_objects', 'create_public', 'create_ledger', 'owns_objects', 'owns_schema', 'owns_database'])
        await assert.rejects(verifyDatabaseIdentity(driver(c, { row: { [key]: true } }).client, c));
    for (const key of ['elevated', 'memberships']) {
        const d = driver(c); d.roles[1][key] = true;
        await assert.rejects(verifyDatabaseIdentity(d.client, c));
    }
    await assert.rejects(verifyDatabaseIdentity(driver(c, { roles: [] }).client, c));
});
test('Drizzle guard is lazy and checks identity on the same transaction before application SQL', async () => {
    const c = databaseConfiguration(fixture().env), d = driver(c), db = drizzle(guardedRuntimeClient(d.client, c));
    assert.equal(d.state.queries.length, 0);
    assert.equal((await db.execute(sql`select 1 as value`))[0].value, 1);
    assert.equal((await db.select({ value: sql`1` }).from(sql`(select 1) as probe`))[0].value, 1);
    assert.equal(d.state.identities, 2); assert.equal(d.state.commits, 2);
    const first = d.state.queries.findIndex(q => q === 'select 1 as value');
    assert.ok(d.state.queries.slice(0, first).some(q => q.includes('current_database()')));
    const bad = driver(c, { row: { oid: 'wrong' } }), blocked = drizzle(guardedRuntimeClient(bad.client, c));
    await assert.rejects(blocked.execute(sql`select 1 as value`)); assert.equal(bad.state.application, 0);
});
test('explicit Drizzle transactions/savepoints retain identity guard, settings and same-connection scope', async () => {
    const c = databaseConfiguration(fixture().env), d = driver(c), db = drizzle(guardedRuntimeClient(d.client, c));
    await db.transaction(async tx => { await tx.execute(sql`select 1 as value`); await tx.transaction(inner => inner.execute(sql`select 1 as value`)); },
        { isolationLevel: 'serializable', accessMode: 'read write' });
    assert.equal(d.state.identities, 1); assert.equal(d.state.begins, 1);
    assert.match(d.state.queries[0], /^set transaction isolation level serializable read write$/);
});
test('guarded pending queries are executed once and unsupported escape hatches are refused', async () => {
    const c = databaseConfiguration(fixture().env), d = driver(c), client = guardedRuntimeClient(d.client, c);
    const query = client.unsafe('select 1 as value'); await query; await query;
    assert.equal(d.state.application, 1); assert.equal(d.state.identities, 1);
    assert.throws(() => client.reserve()); assert.throws(() => client`select 1`);
});
test('local Development client behavior remains unchanged', () => {
    const c = databaseConfiguration({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://local:synthetic-fixture-only@localhost/app' });
    const sentinel = {}; assert.equal(guardedRuntimeClient(sentinel, c), sentinel);
    assert.equal(c.options.max, 10); assert.equal(c.options.ssl, false);
});
test('initializer rejects missing operator permissions before application inspection', async () => {
    const f = fixture(), c = databaseConfiguration({ ...f.env, DATABASE_URL: undefined, THESISHS_DATABASE_ADMIN_URL: f.env.DATABASE_URL.replace('app_runtime:', 'app_operator:') }, 'operator');
    for (const permission of ['create_public', 'temporary', 'create_ledger']) {
        const d = driver(c, { row: { username: 'app_operator', login: 'app_operator' }, permissions: { [permission]: false } });
        await assert.rejects(inspectPreviewState(d.client, c));
        assert.equal(d.state.queries.some(q => q.includes('count(*)')), false);
    }
});
test('existing role/Admin operator inspection accepts a verified qualified pooler login and full ledger', async () => {
    const f = fixture('session'), c = databaseConfiguration({ ...f.env, DATABASE_URL: undefined,
        THESISHS_DATABASE_ADMIN_URL: f.env.DATABASE_URL.replace(`app_runtime.${ref}:`, `app_operator.${ref}:`) }, 'operator');
    const d = driver(c, { row: { username: 'app_operator', login: 'app_operator' } });
    const result = await inspectOperatorTarget(d.client, c);
    assert.equal(result.migrations, 15); assert.match(result.fingerprint, /^[a-f0-9]{64}$/);
});
test('actual initializer inspection distinguishes an empty namespace from existing application records', async () => {
    const f = fixture(), c = databaseConfiguration({ ...f.env, DATABASE_URL: undefined, THESISHS_DATABASE_ADMIN_URL: f.env.DATABASE_URL.replace('app_runtime:', 'app_operator:') }, 'operator');
    const d = driver(c, { inspection: true, row: { username: 'app_operator', login: 'app_operator' } });
    assert.equal((await inspectPreviewState(d.client, c)).empty, true);
    d.state.relations = [{ relname: 'users', relkind: 'r', relowner: '42' }];
    assert.equal((await inspectPreviewState(d.client, c)).empty, false);
    assert.ok(!d.state.queries.some(q => /^(insert|update|delete|create|alter|drop)/i.test(q)));
});
test('full immutable migration sources and every ledger hash/timestamp are required', () => {
    const { migrations } = previewMigrationSource(), ledger = migrations.map(m => ({ hash: m.hash, created_at: String(m.folderMillis) }));
    verifyPreviewLedger(ledger);
    for (const rows of [ledger.slice(1), ledger.map((r, i) => i === 5 ? { ...r, hash: 'changed' } : r),
        ledger.map((r, i) => i === 4 ? { ...r, created_at: '0' } : r)]) assert.throws(() => verifyPreviewLedger(rows));
});
test('R4C actual Postgres.js transaction shape keeps the supported Drizzle migrator inside its savepoint', async () => {
    // Expose the installed driver's original transaction SQL factory in memory only. No dependency files change.
    // Unlike the old double, these callable clients have neither root options nor begin/end/reserve methods.
    const entry = require.resolve('postgres'), localRequire = createRequire(entry);
    const source = readFileSync(entry, 'utf8').replaceAll('\r\n', '\n');
    const marker = '  return sql\n\n  function Sql(handler)';
    assert.equal(source.split(marker).length, 2);
    const instrumented = source.replace(marker, "  sql.transactionFactory = handler => Sql(handler);\n" + marker);
    let connections = 0;
    const confinedRequire = name => name === './connection.js' ? (...args) => {
        const connection = localRequire(name)(...args);
        connection.connect = () => { connections++; throw Error('Offline network access prohibited'); };
        return connection;
    } : localRequire(name);
    const moduleObject = { exports: {} };
    vm.runInThisContext(`(function(require,module,exports,__filename,__dirname){${instrumented}\n})`, { filename: entry })(
        confinedRequire, moduleObject, moduleObject.exports, entry, path.dirname(entry));
    for (const failMigration of [false, true]) {
        const root = moduleObject.exports({ host: 'diagnostic.invalid', database: 'synthetic', username: 'synthetic',
            password: 'synthetic', max: 1, no_subscribe: true });
        const state = { queries: [], ledger: [], commits: 0, rollbacks: 0, savepoints: 0, savepointRollbacks: 0, rootQueries: 0 };
        root.unsafe = () => { state.rootQueries++; throw Error('Root query escape'); };
        const transaction = scope => {
            const tx = root.transactionFactory(query => {
                const text = query.strings.join(''); state.queries.push({ scope, text });
                if (failMigration && text.trimStart().startsWith('CREATE TABLE "role"')) {
                    query.reject(Object.assign(Error('synthetic-private-password postgresql://private'), { code: '42601' }));
                } else {
                    if (text.includes('insert into "drizzle"."__drizzle_migrations"')) state.ledger.push(query.args);
                    query.resolve([]);
                }
            });
            tx.savepoint = async callback => {
                state.savepoints++;
                try { return await callback(transaction('savepoint')); }
                catch (error) { state.savepointRollbacks++; throw error; }
            };
            assert.equal(tx.options, undefined); assert.equal(tx.begin, undefined);
            return tx;
        };
        try {
            const outer = transaction('outer');
            assert.throws(() => drizzle(outer), /Cannot read properties of undefined.*parsers/);
            try { await applyPreviewMigrations(outer, root.options); state.commits++; }
            catch (error) {
                state.rollbacks++; state.ledger = [];
                assert.equal(failMigration, true);
                assert.deepEqual(previewFailure(error), { classification: 'postgresql', code: '42601' });
            }
            assert.equal(state.savepoints, 1); assert.equal(state.rootQueries, 0); assert.equal(connections, 0);
            assert.ok(state.queries.slice(0, 3).every(q => q.scope === 'outer')); // Ledger setup/lookup also stay in the outer transaction.
            assert.ok(state.queries.slice(3).length > 0 && state.queries.slice(3).every(q => q.scope === 'savepoint'));
            assert.equal(state.commits, failMigration ? 0 : 1); assert.equal(state.rollbacks, failMigration ? 1 : 0);
            assert.equal(state.savepointRollbacks, failMigration ? 1 : 0);
            assert.deepEqual(state.ledger.map(p => p[0]), failMigration ? [] : previewMigrationSource().migrations.map(m => m.hash));
        } finally { await root.end({ timeout: 1 }); }
    }
});

test('R4C.3 committed users column order passes without changing the input arrays', () => {
    const expected = Object.values(previewMigrationSource().snapshot.tables['public.users'].columns).map(c => c.name);
    const create = readFileSync('db/migrations/0001_adorable_killmonger.sql', 'utf8').split('\n);')[0];
    const actual = [...create.matchAll(/^\s*"([^"]+)"\s+/gm)].map(m => m[1]);
    for (const file of ['0002_harsh_madame_web.sql', '0012_student_email_verification.sql'])
        for (const match of readFileSync(`db/migrations/${file}`, 'utf8').matchAll(/ALTER TABLE "users" ADD COLUMN "([^"]+)"/g)) actual.push(match[1]);
    assert.notDeepEqual(actual, expected);
    const savedActual = [...actual], savedExpected = [...expected];
    verifyPreviewColumnNames('users', actual, expected);
    assert.deepEqual(actual, savedActual); assert.deepEqual(expected, savedExpected);
});

for (const [label, change, assertion] of [
    ['missing', columns => columns.slice(1), 'column-count'],
    ['extra', columns => [...columns, 'unexpected_column'], 'column-count'],
    ['renamed', columns => columns.map(name => name === 'email' ? 'synthetic-private-column' : name), 'column-names'],
]) test(`R4C.3 ${label} column is rejected with a safe table/assertion identifier`, () => {
    const expected = Object.values(previewMigrationSource().snapshot.tables['public.users'].columns).map(c => c.name);
    assert.throws(() => verifyPreviewColumnNames('users', change(expected), expected), error => {
        const safe = previewFailure(new Error('synthetic private URL postgresql://private', { cause: error }));
        assert.deepEqual(safe, { classification: 'schema-assertion', schemaObject: 'public.users', schemaAssertion: assertion });
        assert.ok(!JSON.stringify(safe).includes('synthetic')); assert.ok(!JSON.stringify(safe).includes('postgresql://'));
        return true;
    });
});

test('R4C failed migration retains only safe classification through durable inspection failure', async () => {
    const secret = 'synthetic-private-password postgresql://private';
    const cause = Object.assign(Error(secret), { code: '42501', query: secret, parameters: [secret] });
    let writes = 0, reads = 0;
    await assert.rejects(initializePreview({
        inspect: async () => { if (reads++) throw Error(secret); return { target: 'target', empty: true, ledger: [], catalog: 'empty' }; },
        apply: async () => { writes++; throw new Error(secret, { cause }); },
    }, { execute: true, target: 'target', source: 'source' }, 'source'), error => {
        const safe = previewFailure(error);
        assert.deepEqual(safe, { classification: 'postgresql', code: '42501' });
        assert.ok(!JSON.stringify(safe).includes(secret)); return true;
    });
    assert.equal(writes, 1); assert.equal(reads, 2);
    assert.deepEqual(previewFailure(new TypeError(secret)), { classification: 'type-error' });
    assert.deepEqual(previewFailure(Object.assign(Error(secret), { code: 'ERR_ASSERTION' })), { classification: 'schema-assertion' });
});

test('R4C CLI refusal returns numeric failure status and explicit execution/commit state without private inputs', async () => {
    const savedError = console.error, savedCode = process.exitCode, output = [];
    try {
        console.error = message => output.push(message);
        const result = await main(['--invalid', 'synthetic-private-password postgresql://private']);
        assert.equal(result.exitStatus, 1); assert.equal(process.exitCode, 1); assert.equal(result.stage, 'arguments');
        assert.equal(result.executionBegan, false); assert.equal(result.commitConfirmed, false);
        assert.equal(result.durableInspectionRequired, false);
        assert.ok(!output.join('\n').includes('synthetic-private-password'));
        assert.deepEqual(JSON.parse(output[1]), result);
    } finally { console.error = savedError; process.exitCode = savedCode; }
});
test('empty-only explicit initialization and independent durable verification never retry uncertain writes', async () => {
    const source = previewMigrationSource(), ledger = source.migrations.map(m => ({ hash: m.hash, created_at: String(m.folderMillis) }));
    const before = { target: 'target', empty: true, ledger: [], catalog: 'empty' }, after = { ...before, empty: false, ledger, catalog: 'verified' };
    let current = before, writes = 0, reads = 0;
    const io = { inspect: async () => { reads++; return current; }, apply: async () => { writes++; current = after; return after.catalog; } };
    const approval = { execute: true, target: before.target, source: source.hash };
    for (const state of [{ ...before, empty: false }, { ...before, ledger: [ledger[0]] }]) {
        current = state; await assert.rejects(initializePreview(io, approval, source.hash)); assert.equal(writes, 0);
    }
    current = before; assert.equal(await initializePreview(io, approval, source.hash), 'initialized-confirmed'); assert.equal(writes, 1);
    writes = reads = 0; current = before;
    io.apply = async () => { writes++; current = after; throw Error('synthetic uncertain commit'); };
    await assert.rejects(initializePreview(io, approval, source.hash)); assert.equal(writes, 1); assert.equal(reads, 2);
    current = before; writes = 0;
    await assert.rejects(initializePreview(io, { ...approval, source: 'wrong' }, source.hash)); assert.equal(writes, 0);
});
test('initializer has no startup/build hook and absent execution flags cannot access services', () => {
    const p = JSON.parse(readFileSync('package.json', 'utf8'));
    for (const name of ['build', 'start', 'dev']) assert.doesNotMatch(p.scripts[name], /migrat|initializ/);
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/initialize-preview-database.ts'], {
        encoding: 'utf8', timeout: 20000, env: { ...process.env, DATABASE_URL: 'do-not-connect', THESISHS_DATABASE_ADMIN_URL: 'do-not-connect' } });
    assert.equal(result.status, 1); assert.equal(result.stdout, ''); assert.doesNotMatch(result.stderr, /do-not-connect/);
    assert.match(result.stderr, /No automatic retry/);
});
