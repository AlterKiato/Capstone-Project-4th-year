/* eslint-disable @typescript-eslint/no-require-imports */
// Installed Supabase SDK and real streaming validator; fetch is an in-memory provider double.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const Module = require('node:module'), original = Module._load;
Module._load = function(id, ...args) { return id === 'server-only' ? {} : original.call(this, id, ...args); };
const { createSubmissionUploadStorage } = require('../lib/services/submission-upload-storage.service.ts');
const { UPLOAD_MAX_BYTES } = require('../lib/uploads/contract.ts');
Module._load = original;
const previous = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY };
process.env.SUPABASE_URL = 'https://storage.example.invalid';
process.env.SUPABASE_SECRET_KEY = 'sb_secret_synthetic_server_fixture_only';
process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_synthetic_browser_fixture_only';
const pdf = () => new Uint8Array(Buffer.from('%PDF-1.7\nsynthetic SDK fixture'));
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
function fixture() {
    const path = `staging/submissions/${randomUUID()}/upload.pdf`;
    const state = { calls: [], bytes: pdf(), metaSize: pdf().length, mime: 'application/pdf', headerMime: 'application/pdf',
        encoding: null, length: null, missing: false, public: false, limit: UPLOAD_MAX_BYTES, allowed: ['application/pdf'],
        tokenExpiry: Math.floor(Date.now() / 1000) + 7200, existing: false, lostWriteAck: false, readerCancelled: false,
        custom: { size: 1, content_type: 'text/plain' } };
    const fetcher = async (input, init) => {
        const url = new URL(String(input)); state.calls.push({ method: init.method, path: url.pathname, headers: new Headers(init.headers), body: init.body, signal: init.signal });
        assert.equal(init.redirect, 'error'); assert.equal(init.cache, 'no-store'); assert.ok(init.signal);
        if (url.pathname === '/storage/v1/bucket/research-submissions') return json({ id: 'research-submissions', name: 'research-submissions', public: state.public,
            file_size_limit: state.limit, allowed_mime_types: state.allowed });
        if (url.pathname.includes('/object/upload/sign/')) {
            const token = [Buffer.from('{"alg":"HS256"}').toString('base64url'), Buffer.from(JSON.stringify({ exp: state.tokenExpiry })).toString('base64url'), Buffer.from('synthetic-signature').toString('base64url')].join('.');
            return json({ url: `/object/upload/sign/research-submissions/${path}?token=${token}`, token });
        }
        if (url.pathname.includes('/object/info/')) {
            if (state.missing) return json({ message: 'synthetic missing', statusCode: '404', code: 'NoSuchKey' }, 404);
            return json({ id: randomUUID(), name: path, size: state.metaSize, content_type: state.mime, metadata: state.custom });
        }
        if (init.method === 'POST') {
            if (state.existing) return json({ message: 'synthetic conflict', statusCode: '409', code: 'ResourceAlreadyExists' }, 409);
            state.existing = true; state.bytes = new Uint8Array(init.body); state.metaSize = state.bytes.length;
            if (state.lostWriteAck) throw Error('synthetic-provider-private-error');
            return json({ Id: randomUUID(), Key: 'research-submissions/' + url.pathname.split('/research-submissions/')[1] });
        }
        const headers = { 'content-type': state.headerMime };
        if (state.encoding) headers['content-encoding'] = state.encoding;
        if (state.length !== null) headers['content-length'] = state.length;
        // Close after one chunk; an unchecked .blob() would buffer it before validating the size.
        let sent = false;
        const body = new ReadableStream({ pull(controller) { if (!sent) { sent = true; controller.enqueue(state.bytes); } else controller.close(); }, cancel() { state.readerCancelled = true; } });
        return new Response(body, { headers });
    };
    return { state, path, storage: createSubmissionUploadStorage(fetcher), signal: AbortSignal.timeout(5000) };
}
test('real SDK mints an exact-path non-upsert capability only after private bucket restrictions pass', async () => {
    const f = fixture(), cap = await f.storage.issue(f.path, f.signal);
    assert.equal(cap.publishableKey, process.env.SUPABASE_PUBLISHABLE_KEY); assert.ok(cap.expiresAt > new Date());
    const mint = f.state.calls.find(c => c.path.includes('/upload/sign/'));
    assert.notEqual(mint.headers.get('x-upsert'), 'true');
    for (const change of [{ public: true }, { limit: null }, { limit: UPLOAD_MAX_BYTES + 1 }, { allowed: ['application/*'] }, { allowed: ['application/pdf', 'text/plain'] }, { tokenExpiry: 1 }, { tokenExpiry: Math.floor(Date.now() / 1000) + 10000 }]) {
        const g = fixture(); Object.assign(g.state, change); await assert.rejects(g.storage.issue(g.path, g.signal));
    }
});
test('real SDK download uses provider top-level metadata and actual bounded stream bytes', async () => {
    const f = fixture(); assert.deepEqual(await f.storage.read(f.path, pdf().length, f.signal), pdf());
    assert.ok(f.state.calls.some(c => c.path.includes('/object/info/'))); assert.ok(f.state.calls.some(c => /\/object\/research-submissions\//.test(c.path)));
});
test('MIME, metadata size, encoding, missing object, actual length and PDF signature reject safely', async () => {
    for (const change of [{ mime: 'text/plain' }, { metaSize: 1 }, { headerMime: 'text/plain' }, { encoding: 'gzip' },
        { length: String(UPLOAD_MAX_BYTES + 1) }, { missing: true }, { bytes: new Uint8Array() }, { bytes: new Uint8Array(UPLOAD_MAX_BYTES + 1) },
        { bytes: new Uint8Array(pdf().length).fill(65) }]) {
        const f = fixture(); Object.assign(f.state, change);
        await assert.rejects(f.storage.read(f.path, pdf().length, f.signal));
    }
});
test('exact 10 MiB succeeds and 10 MiB plus one is refused without an unbounded buffer', async () => {
    const f = fixture(); f.state.bytes = new Uint8Array(UPLOAD_MAX_BYTES); f.state.bytes.set(Buffer.from('%PDF-')); f.state.metaSize = UPLOAD_MAX_BYTES;
    assert.equal((await f.storage.read(f.path, UPLOAD_MAX_BYTES, f.signal)).length, UPLOAD_MAX_BYTES);
    await assert.rejects(f.storage.read(f.path, UPLOAD_MAX_BYTES + 1, f.signal));
});
test('write acknowledgement loss and existing final object reconcile by bytes without overwrite or deletion', async () => {
    const f = fixture(), bytes = pdf(), digest = require('node:crypto').createHash('sha256').update(bytes).digest('hex');
    const final = `research/10/v1/${randomUUID()}-synthetic.pdf`;
    f.state.lostWriteAck = true; await f.storage.writeOrReconcile(final, bytes, digest, f.signal);
    await f.storage.writeOrReconcile(final, bytes, digest, f.signal);
    assert.equal(f.state.calls.some(c => c.method === 'DELETE'), false);
    assert.ok(f.state.calls.filter(c => c.method === 'POST').every(c => c.headers.get('x-upsert') === 'false'));
    f.state.bytes = new Uint8Array(Buffer.from('%PDF-different-content')); f.state.metaSize = f.state.bytes.length;
    await assert.rejects(f.storage.writeOrReconcile(final, bytes, digest, f.signal));
});
test('arbitrary paths/final capability substitution and already-aborted downloads are refused', async () => {
    const f = fixture();
    for (const path of ['../other.pdf', 'research/10/v1/other.pdf', 'https://evil.example.invalid/path', f.path + '/../other.pdf'])
        await assert.rejects(f.storage.issue(path, f.signal));
    await assert.rejects(f.storage.read('../other.pdf', pdf().length, f.signal));
    const controller = new AbortController(); controller.abort();
    // Real fetch observes this abort; the test double explicitly enforces the same contract.
    const cancelled = createSubmissionUploadStorage(async (_input, init) => { init.signal.throwIfAborted(); throw Error('unreachable'); });
    await assert.rejects(cancelled.read(f.path, pdf().length, controller.signal));
});
test.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
