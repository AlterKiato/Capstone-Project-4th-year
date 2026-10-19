/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { configuration, validateRuntimeTarget, storagePath, pdfBytes, sha256, validateManifest, run, SLOTS } = require('./fixture-core.cjs');
const env = { DATABASE_URL: 'postgres://tester:sentinel-db-secret@localhost:5432/thesishs_ai',
    SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', SUPABASE_SECRET_KEY: 'sentinel-storage-secret' };
const migrations = Array.from({ length: 12 }, (_, i) => sha256(String(i)));
const config = configuration(env);
const runId = 'phase96-1234567890abcdef1234567890abcdef';
const time = '2026-10-20T00:00:00.000Z';
const clone = value => JSON.parse(JSON.stringify(value));
const expectCode = (fn, code) => assert.throws(fn, error => error.message === code);

function runtime() {
    const expected = { fingerprint: config.fingerprint, projectRef: config.projectRef, bucket: config.bucket,
        systemIdentifier: '1234567890123456789', databaseOid: 16384, schemaHash: sha256('catalog') };
    const observed = { ...expected, database: 'thesishs_ai', port: 5432, serverAddress: '::1/128',
        serverVersion: 180004, migrations, bucketPublic: false, availableConnections: 15 };
    return { expected, observed };
}

function manifest(created = false) {
    const resources = Object.entries(SLOTS).map(([slot, [kind, parents]]) => {
        const version = /1$/.test(slot) ? 'v1' : 'v2';
        return { slot, kind, parents, ownerRunId: runId, state: 'planned', cleanupEligible: false,
            ...(['pdf', 'storage', 'submissions'].includes(kind) ? { version, checksum: sha256(pdfBytes(version)) } : {}) };
    });
    if (created) {
        resources.forEach((r, i) => {
            Object.assign(r, { state: 'verified', createdAt: time, verifiedAt: time,
                creationProof: sha256(r.slot), verificationProof: sha256('verified:' + r.slot) });
            if (!['pdf', 'storage'].includes(r.kind)) r.id = i + 100;
        });
        for (const r of resources.filter(r => r.kind === 'storage'))
            r.path = storagePath(resources.find(r => r.slot === 'paper').id, r.version, runId);
    }
    return { schemaVersion: 1, runId, environmentFingerprint: config.fingerprint, createdAt: time, updatedAt: time, resources };
}

test('default is inspect; dry runs are deterministic and expose no credentials', () => {
    assert.equal(run(undefined, env, migrations).actualWrites, 0);
    const first = run('dry-run', env, migrations);
    assert.deepEqual(first, run('dry-run', env, migrations));
    assert.equal(first.writes.thisCommand, 0);
    assert.equal(first.counts.preparationSubmissions, 0);
    assert.equal(first.counts.preparationStorageObjects, 0);
    const output = JSON.stringify(first);
    for (const secret of [env.DATABASE_URL, env.SUPABASE_SECRET_KEY, 'sentinel-db-secret']) assert.ok(!output.includes(secret));
    assert.ok(!output.includes(config.projectRef));
});

test('provision rejects before even reading configuration; flags cannot enable it', () => {
    const unreadable = new Proxy({}, { get() { throw new Error('configuration touched'); } });
    expectCode(() => run('provision', unreadable, null), 'PROVISIONING_NOT_AUTHORIZED');
    const { main } = require('./prepare.cjs');
    for (const args of [['provision'], ['provision', '--enable'], ['provision', 'true']])
        expectCode(() => main(args), 'PROVISIONING_NOT_AUTHORIZED');
    expectCode(() => main(['--provision']), 'UNKNOWN_MODE');
});

test('missing config and production/deployment markers fail closed', () => {
    for (const key of Object.keys(env)) {
        const missing = { ...env }; delete missing[key];
        expectCode(() => configuration(missing), 'MISSING_CONFIGURATION');
    }
    for (const marker of [{ NODE_ENV: 'production' }, { VERCEL_ENV: 'preview' }, { VERCEL: '1' }, { CI: 'true' }])
        expectCode(() => configuration({ ...env, ...marker }), 'LOCAL_DEVELOPMENT_ONLY');
});

test('database identity rejects wrong host/port/name, production users and URL overrides', () => {
    for (const url of ['postgres://test:pw@remote:5432/thesishs_ai', 'postgres://test:pw@localhost:5433/thesishs_ai',
        'postgres://test:pw@localhost:5432/production', 'postgres://prod:pw@localhost:5432/thesishs_ai',
        env.DATABASE_URL + '?host=remote', env.DATABASE_URL + '#override', 'not a URL',
        'postgres://test:pw@127.0.0.2:5432/thesishs_ai']) assert.throws(() => configuration({ ...env, DATABASE_URL: url }));
    assert.equal(configuration({ ...env, DATABASE_URL: env.DATABASE_URL.replace('localhost', '[::1]') }).port, 5432);
});

test('storage shape rejects ambiguous projects, paths and credentials', () => {
    for (const url of ['http://abcdefghijklmnopqrst.supabase.co', 'https://storage.example.invalid',
        env.SUPABASE_URL + '/storage', env.SUPABASE_URL + '?project=other', 'https://user:pw@abcdefghijklmnopqrst.supabase.co'])
        expectCode(() => configuration({ ...env, SUPABASE_URL: url }), 'STORAGE_TARGET_REJECTED');
});

test('future runtime guard requires independent pins, exact instance/schema/ledger and headroom', () => {
    const { expected, observed } = runtime();
    assert.equal(validateRuntimeTarget(config, expected, observed, migrations), true);
    expectCode(() => validateRuntimeTarget(config, null, observed, migrations), 'TARGET_IDENTITY_UNVERIFIED');
    for (const change of [{ database: 'other' }, { port: 5433 }, { serverAddress: '10.0.0.1' },
        { serverAddress: '::1/64' }, { serverAddress: 'localhost' }, { systemIdentifier: '9999999999999999999' },
        { databaseOid: 42 }, { serverVersion: 170000 }, { schemaHash: sha256('wrong') },
        { migrations: migrations.slice(1) }, { projectRef: 'zzzzzzzzzzzzzzzzzzzz' },
        { bucket: 'public' }, { bucketPublic: true }])
        expectCode(() => validateRuntimeTarget(config, expected, { ...observed, ...change }, migrations), 'RUNTIME_TARGET_MISMATCH');
    for (const availableConnections of [9, -1, undefined, NaN])
        expectCode(() => validateRuntimeTarget(config, expected, { ...observed, availableConnections }, migrations), 'INSUFFICIENT_CONNECTION_HEADROOM');
    expectCode(() => validateRuntimeTarget(config, { ...expected, fingerprint: sha256('wrong') }, observed, migrations), 'RUNTIME_TARGET_MISMATCH');
    expectCode(() => validateRuntimeTarget(config, { ...expected, bucket: 'wrong' }, observed, migrations), 'RUNTIME_TARGET_MISMATCH');
});

test('PDF bytes have valid object/xref/stream structure and distinct deterministic checksums', () => {
    for (const version of ['v1', 'v2']) {
        const bytes = pdfBytes(version), text = bytes.toString('ascii');
        assert.ok(bytes.length < 2048 && bytes.length < 10 * 1024 * 1024);
        assert.ok(text.startsWith('%PDF-1.4\n') && text.endsWith('%%EOF\n'));
        const xref = Number(text.match(/startxref\n(\d+)/)[1]);
        assert.equal(text.slice(xref, xref + 4), 'xref');
        const lines = text.slice(xref).split('\n');
        for (let i = 1; i <= 5; i++) {
            const offset = Number(lines[i + 2].slice(0, 10));
            assert.ok(text.slice(offset).startsWith(`${i} 0 obj\n`));
        }
        const stream = text.match(/\/Length (\d+) >>\nstream\n([\s\S]*?)endstream/);
        assert.equal(Number(stream[1]), Buffer.byteLength(stream[2]));
        assert.equal((text.match(/endobj/g) || []).length, 5);
        assert.equal(sha256(bytes), sha256(pdfBytes(version)));
    }
    assert.notEqual(sha256(pdfBytes('v1')), sha256(pdfBytes('v2')));
});

test('owned path planning matches actual shared application validator', () => {
    const { isSubmissionDocumentPath } = require('../../../lib/validations/submission-document.ts');
    for (const version of ['v1', 'v2']) {
        const path = storagePath(123, version, runId);
        assert.ok(isSubmissionDocumentPath(path, 123, version));
        assert.ok(!isSubmissionDocumentPath(path, 124, version));
    }
    for (const args of [[0, 'v1', runId], [1, '1', runId], [1, 'v2', '../escape'], [2147483648, 'v1', runId]])
        expectCode(() => storagePath(...args), 'INVALID_OWNED_PATH');
});

test('manifest validates planned/created/verified/pending-cleanup/retained without credential fields', () => {
    assert.ok(validateManifest(manifest(), runId, config.fingerprint));
    const m = manifest(true);
    assert.ok(validateManifest(m, runId, config.fingerprint));
    m.resources[0].state = 'pending-cleanup'; m.resources[0].cleanupEligible = true;
    m.resources[1].state = 'retained';
    assert.ok(validateManifest(m, runId, config.fingerprint));
    m.resources[0].state = 'created'; m.resources[0].cleanupEligible = false; delete m.resources[0].verifiedAt;
    delete m.resources[0].verificationProof;
    assert.ok(validateManifest(m, runId, config.fingerprint));
    assert.ok(!JSON.stringify(m).includes('sentinel'));
});

test('manifest refuses conflicting ownership/IDs/parents/versions/paths/checksums and false creation', () => {
    const variants = [
        m => { m.runId = 'phase96-ffffffffffffffffffffffffffffffff'; },
        m => { m.environmentFingerprint = sha256('wrong'); },
        m => { m.resources[1].id = m.resources[0].id; },
        m => { m.resources[0].ownerRunId = 'phase96-ffffffffffffffffffffffffffffffff'; },
        m => { m.resources[4].parents = ['group', 'adviser']; },
        m => { m.resources[1] = clone(m.resources[0]); },
        m => { m.resources[8].version = 'v2'; },
        m => { m.resources[10].path = `research/999/v1/${runId}-v1.pdf`; },
        m => { m.resources[7].checksum = sha256('wrong'); },
        m => { m.resources[0].state = 'planned'; },
        m => { delete m.resources[0].creationProof; },
        m => { delete m.resources[0].verificationProof; },
        m => { m.resources[1].state = 'created'; delete m.resources[1].verifiedAt; m.resources[1].cleanupEligible = true; },
        m => { delete m.resources[2].id; },
        m => { m.resources[0].verifiedAt = '2026-10-21T00:00:00.000Z'; },
        m => { m.resources[1].kind = 'research_groups'; },
    ];
    for (const mutate of variants) { const m = manifest(true); mutate(m); assert.throws(() => validateManifest(m, runId, config.fingerprint)); }
    const m = manifest(true); m.resources[1].password = 'sentinel-account-secret';
    expectCode(() => validateManifest(m, runId, config.fingerprint), 'INVALID_PRIVATE_MANIFEST');
    delete m.resources[1].password; m.credentials = { password: 'sentinel-account-secret' };
    expectCode(() => validateManifest(m, runId, config.fingerprint), 'INVALID_PRIVATE_MANIFEST');
});

test('CLI repeated offline runs use only read mocks; no clients, network or filesystem writes', () => {
    const fs = require('node:fs'), Module = require('node:module');
    const { main } = require('./prepare.cjs');
    require('dotenv'); // Load before installing the I/O traps; module loading itself reads files.
    const originalLoad = Module._load, read = fs.readFileSync, exists = fs.existsSync;
    const savedEnv = process.env;
    const mutations = ['writeFileSync', 'appendFileSync', 'mkdirSync', 'renameSync', 'unlinkSync', 'openSync',
        'writeFile', 'appendFile', 'mkdir', 'rename', 'unlink', 'createWriteStream', 'rm', 'rmSync'];
    const saved = Object.fromEntries(mutations.map(name => [name, fs[name]]));
    let forbiddenCalls = 0;
    const forbid = () => { forbiddenCalls++; throw new Error('forbidden effect'); };
    const fetch = global.fetch;
    try {
        Module._load = function(id, ...args) {
            if (/postgres|supabase|lib[\\/]db|services|repositories|node:(net|tls|http|https|child_process)/.test(id)) return forbid();
            return originalLoad.call(this, id, ...args);
        };
        for (const name of mutations) fs[name] = forbid;
        global.fetch = forbid;
        process.env = { ...env };
        fs.existsSync = path => String(path).endsWith('.env');
        fs.readFileSync = path => {
            const p = String(path);
            if (p.endsWith('.env')) return Buffer.from('');
            if (p.endsWith('_journal.json')) return JSON.stringify({ entries: migrations.map((_, idx) => ({ idx, tag: String(idx).padStart(4, '0') + '_fixture' })) });
            if (/\d{4}_fixture\.sql$/.test(p)) return Buffer.from(p.match(/\d{4}_fixture/)[0]);
            return read(path);
        };
        const first = main(['dry-run']);
        assert.deepEqual(first, main(['dry-run']));
        assert.equal(main([]).actualWrites, 0);
        expectCode(() => main(['provision']), 'PROVISIONING_NOT_AUTHORIZED');
        assert.equal(forbiddenCalls, 0);
    } finally {
        process.env = savedEnv; Module._load = originalLoad; fs.readFileSync = read; fs.existsSync = exists;
        Object.assign(fs, saved); global.fetch = fetch;
    }
});
