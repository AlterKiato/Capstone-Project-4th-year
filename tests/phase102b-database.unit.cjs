/* eslint-disable @typescript-eslint/no-require-imports */
// Pure configuration/role-map guards, private-terminal refusal and bootstrap validation; no database connections.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const { PassThrough } = require('node:stream');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { databaseConfiguration } = require('../lib/db/config.ts');
const { missingCanonicalRoles } = require('../lib/repositories/database-initialization.repository.ts');
const { requirePrivateTerminal, privateAdminInput } = require('../scripts/database-operator.ts');
const endpoint = (host, database, user) => ({ host, port: 5432, database, user });
const ca = readFileSync('tests/fixtures/tls/supabase-root-2021.crt', 'utf8');
function remote() {
    const profiles = {};
    for (const stage of ['development', 'preview', 'production']) profiles[stage] = { identity: stage,
        runtime: endpoint(`${stage}.example.invalid`, stage, 'runtime'), operator: endpoint(`${stage}.example.invalid`, stage, 'operator'),
        observed: { provider: 'postgres', cluster: String(100 + ['development','preview','production'].indexOf(stage)), databaseOid: '5', runtimeRole: 'runtime', operatorRole: 'operator' } };
    return { NODE_ENV: 'production', VERCEL_ENV: 'production', THESISHS_DATABASE_ENV: 'production',
        THESISHS_DATABASE_CA_PEM: ca,
        DATABASE_URL: 'postgres://runtime:synthetic@production.example.invalid:5432/production',
        THESISHS_DATABASE_CONNECTION_MODE: 'session', THESISHS_DATABASE_TARGETS_JSON: JSON.stringify(profiles) };
}
function rejected(env, purpose) {
    assert.throws(() => databaseConfiguration(env, purpose), error => error.message === 'Database configuration is missing or not approved for this environment.');
}
test('local runtime behavior and bounded defaults', () => {
    const c = databaseConfiguration({ NODE_ENV: 'development', DATABASE_URL: 'postgres://local:synthetic@localhost/app' });
    assert.equal(c.options.max, 10); assert.equal(c.options.ssl, false); assert.equal(c.options.prepare, true);
    assert.equal(c.options.connect_timeout, 5); assert.equal(c.options.idle_timeout, 20); assert.equal(c.options.max_lifetime, 300);
});
test('hosted runtime and operator enforce verified TLS and separate credentials', () => {
    const c = databaseConfiguration(remote()); assert.deepEqual(c.options.ssl, { rejectUnauthorized: true, ca }); assert.equal(c.options.max, 2);
    assert.equal(databaseConfiguration({ ...remote(), THESISHS_DATABASE_ADMIN_URL:
        'postgres://operator:synthetic@production.example.invalid:5432/production' }, 'operator').options.max, 1);
});
test('production configuration and stage mistakes fail closed', () => {
    for (const change of [{ THESISHS_DATABASE_ENV: undefined }, { THESISHS_DATABASE_ENV: 'development' },
        { THESISHS_DATABASE_ENV: 'preview' }, { THESISHS_DATABASE_TARGETS_JSON: '{}' },
        { THESISHS_DATABASE_CONNECTION_MODE: undefined }, { THESISHS_DATABASE_CONNECTION_MODE: 'transaction' },
        { DATABASE_URL: 'postgres://local:synthetic@localhost/app' }, { DATABASE_URL: 'postgres://missing-password@host/app' },
        { DATABASE_URL: remote().DATABASE_URL + '?sslmode=disable' }, { DATABASE_URL: remote().DATABASE_URL + '?options=unsafe' },
        { DATABASE_URL: remote().DATABASE_URL + '#secret' }, { NODE_ENV: 'test' },
        { THESISHS_DATABASE_ADMIN_URL: 'privileged-configuration-must-stay-off-runtime' }]) rejected({ ...remote(), ...change });
});
test('cross-environment data sharing is rejected even with different users', () => {
    for (const variant of ['identity', 'database', 'operatorDatabase', 'credentials', 'missingDevelopment']) {
        const env = remote(), profiles = JSON.parse(env.THESISHS_DATABASE_TARGETS_JSON);
        if (variant === 'identity') profiles.preview.identity = profiles.production.identity;
        if (variant === 'database') profiles.preview.runtime = { ...profiles.production.runtime, user: 'other' };
        if (variant === 'operatorDatabase') profiles.preview.operator = { ...profiles.production.runtime, user: 'other' };
        if (variant === 'credentials') profiles.production.operator.user = profiles.production.runtime.user;
        if (variant === 'missingDevelopment') delete profiles.development;
        rejected({ ...env, THESISHS_DATABASE_TARGETS_JSON: JSON.stringify(profiles) });
    }
});
test('operator cannot inherit runtime URL or omit explicit identity', () => {
    rejected({ ...remote(), THESISHS_DATABASE_ADMIN_URL: undefined }, 'operator');
    rejected({ NODE_ENV: 'development', DATABASE_URL: 'postgres://local:synthetic@localhost/app' }, 'operator');
});
test('strict identity validation never includes credentials in failures', () => {
    for (const raw of ['invalid-secret-value', 'http://user:secret@host/app', 'postgres://user:secret@host/',
        ' postgres://user:secret@host/app', 'postgres://user:secret@host/app?sslmode=require&sslmode=require'])
        rejected({ ...remote(), DATABASE_URL: raw });
});
test('complete, partial and conflicting canonical role mappings', () => {
    const canonical = [{ id: 1, name: 'Admin' }, { id: 2, name: 'Adviser' }, { id: 3, name: 'Student' }, { id: 4, name: 'Panel' }];
    assert.equal(missingCanonicalRoles([]).length, 4); assert.deepEqual(missingCanonicalRoles(canonical), []);
    assert.deepEqual(missingCanonicalRoles(canonical.slice(0, 3)), [canonical[3]]);
    for (const rows of [[{ id: 3, name: 'User' }], [{ id: 8, name: 'Student' }], [{ id: 1, name: 'Adviser' }]])
        assert.throws(() => missingCanonicalRoles(rows));
    assert.throws(() => missingCanonicalRoles([], true));
});
test('private terminal rejects piped input and redirected output', () => {
    assert.throws(() => requirePrivateTerminal({ isTTY: false }, { isTTY: true }));
    assert.throws(() => requirePrivateTerminal({ isTTY: true }, { isTTY: false }));
    requirePrivateTerminal({ isTTY: true }, { isTTY: true });
});
test('operator commands reject missing confirmation without connection or secret output', () => {
    for (const entry of ['db/seed/role.seed.ts', 'scripts/bootstrap-admin.ts']) {
        const result = spawnSync(process.execPath, ['--require', 'tsx/cjs', entry], { encoding: 'utf8' });
        assert.equal(result.status, 1); assert.equal(result.stdout, '');
        assert.match(result.stderr, /^Initialization not confirmed\./); assert.equal(result.stderr.includes('postgres:'), false);
    }
});
test('offline Drizzle config refuses direct database commands before reading credentials', () => {
    const result = spawnSync(process.execPath, ['--require', 'tsx/cjs', '-e',
        "process.argv[2]='migrate'; try {require('./drizzle.config.ts'); process.exitCode=9} catch(e) {if(e.message !== 'Direct Drizzle database commands are disabled. A separately reviewed operator migration procedure is required.') process.exitCode=8}"], { encoding: 'utf8' });
    assert.equal(result.status, 0); assert.equal(result.stdout, ''); assert.equal(result.stderr, '');
});
test('interactive input hides all credentials and restores terminal after completion, Ctrl+C and EOF (stream doubles)', async () => {
    for (const mode of ['complete', 'interrupt', 'eof']) {
        const input = new PassThrough(), output = new PassThrough();
        input.isTTY = output.isTTY = true; input.isRaw = false;
        input.setRawMode = value => { input.isRaw = value; return input; };
        const values = ['Synthetic', 'Administrator', 'synthetic@example.invalid', 'synthetic-private-password', 'synthetic-private-password'];
        let prompts = 0, rendered = '';
        output.on('data', data => {
            rendered += data.toString();
            if (data.toString().includes('(hidden):')) {
                const index = prompts++;
                setImmediate(() => mode === 'eof' ? input.end() : input.write(mode === 'interrupt' ? '\x03' : values[index] + '\n'));
            }
        });
        if (mode === 'complete') assert.deepEqual(await privateAdminInput(input, output), {
            firstName: values[0], lastName: values[1], email: values[2], password: values[3], confirmPassword: values[4],
        });
        else await assert.rejects(privateAdminInput(input, output));
        assert.equal(input.isRaw, false);
        for (const value of values) assert.equal(rendered.includes(value), false);
        input.destroy(); output.destroy();
    }
});
test('bootstrap validation and persistence failures stay controlled (repository double, real bcrypt)', async () => {
    const original = Module._load; let calls = 0, persisted;
    Module._load = function(id, ...args) {
        if (id === '@/lib/repositories/database-initialization.repository') return { insertInitialAdmin: async (_db, data) => {
            calls++; persisted = data; throw new Error('synthetic-secret-database-error');
        } };
        return original.call(this, id, ...args);
    };
    delete require.cache[require.resolve('../lib/services/database-initialization.service.ts')];
    const { bootstrapInitialAdmin } = require('../lib/services/database-initialization.service.ts');
    Module._load = original;
    const valid = { firstName: 'Synthetic', lastName: 'Admin', email: ' SYNTHETIC@EXAMPLE.INVALID ',
        password: 'synthetic-password', confirmPassword: 'synthetic-password' };
    for (const change of [{ email: 'invalid' }, { password: 'short', confirmPassword: 'short' },
        { password: 'é'.repeat(37), confirmPassword: 'é'.repeat(37) }, { confirmPassword: 'different' }])
        assert.equal((await bootstrapInitialAdmin({}, { ...valid, ...change })).success, false);
    assert.equal(calls, 0);
    const result = await bootstrapInitialAdmin({}, valid);
    assert.equal(result.success, false); assert.equal(calls, 1);
    assert.equal(persisted.email, 'synthetic@example.invalid'); assert.match(persisted.passwordHash, /^\$2[ab]\$12\$/);
    assert.equal(JSON.stringify(result).includes('secret'), false); assert.equal(JSON.stringify(persisted).includes(valid.password), false);
});
