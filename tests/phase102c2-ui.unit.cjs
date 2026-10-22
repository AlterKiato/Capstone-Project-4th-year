/* eslint-disable @typescript-eslint/no-require-imports */
// Actual upload controller, deterministic React hook/Server Action/XMLHttpRequest doubles. No browser or network.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const React = require('react'), Module = require('node:module');
const original = Module._load;
let hooks = [], cursor = 0, mode = 'normal', calls = [], saved = new Map();
const intent = randomUUID(), capability = { url: 'https://storage.example.invalid/upload?token=synthetic', publishableKey: 'sb_publishable_synthetic', expiresAt: new Date().toISOString() };
const actions = {
    initiateSubmissionUploadAction: async input => { calls.push(['initiate', input]); return { success: true, code: 'pending', intentId: intent, size: 10, fileName: 'synthetic.pdf', capability, message: 'Prepared.' }; },
    renewSubmissionUploadAction: async id => { calls.push(['renew', id]); return { success: true, code: 'pending', intentId: id, capability, message: 'Prepared.' }; },
    finalizeSubmissionUploadAction: async id => { calls.push(['finalize', id]); return { success: true, code: 'completed', intentId: id, submissionId: 1, version: 'v1', message: 'Research submitted successfully.' }; },
    getSubmissionUploadStatusAction: async id => { calls.push(['status', id]); return { success: true, code: 'pending', intentId: id, uploaded: true, message: 'Uploaded; confirm.' }; },
    cancelSubmissionUploadAction: async id => ({ success: true, code: 'closed', intentId: id, message: 'Cancelled.' }),
};
Module._load = function(id, ...args) {
    if (id.endsWith('.module.css')) return {};
    if (id === 'react') return { ...React, useState(initial) { const index = cursor++; if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
        return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }]; },
    useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial }; }, useEffect() {} };
    if (id === '@/lib/actions/submission-upload.action') return actions;
    return original.call(this, id, ...args);
};
const UploadDialog = require('../components/dashboard/submission-upload-dialog.tsx').default;
Module._load = original;
const previous = { storage: globalThis.sessionStorage, xhr: globalThis.XMLHttpRequest };
globalThis.sessionStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
globalThis.XMLHttpRequest = class {
    constructor() { this.upload = {}; this.status = 200; }
    open(method, url) { calls.push(['transport', method, url]); }
    setRequestHeader() {}
    send(file) { calls.push(['file', file]); queueMicrotask(() => mode === 'failed' ? this.onerror() : this.onload()); }
    abort() { this.onabort?.(); }
};
const render = () => { cursor = 0; return UploadDialog({ project: { id: 10, title: 'Synthetic project' }, onSuccess() {}, onClose() {} }); };
function data() { const form = new FormData(); form.set('file', new File(['%PDF-12345'], 'synthetic.pdf', { type: 'application/pdf' })); form.set('remarks', 'Synthetic remarks'); return form; }
function reset() { hooks = []; cursor = 0; calls = []; saved = new Map(); mode = 'normal'; }
test('upload completion remains in dialog and requires a second explicit finalization; only metadata reaches actions', async () => {
    reset(); let dialog = render(); assert.equal(dialog.props.submitLabel, 'Upload PDF');
    const first = await dialog.props.action(data()); assert.equal(first.keepOpen, true);
    assert.equal(calls.some(c => c[0] === 'finalize'), false);
    const input = calls.find(c => c[0] === 'initiate')[1]; assert.equal(input.size, 10); assert.equal(Object.values(input).some(value => value instanceof File), false);
    assert.ok([...saved.values()].every(value => value === intent)); assert.equal([...saved.values()].some(value => value.includes('token')), false);
    dialog = render(); assert.equal(dialog.props.submitLabel, 'Submit research');
    assert.equal((await dialog.props.action(new FormData())).success, true); assert.deepEqual(calls.find(c => c[0] === 'finalize'), ['finalize', intent]); assert.equal(saved.size, 0);
});
test('failed upload and reload recover the same intent through status without automatically finalizing', async () => {
    reset(); mode = 'failed'; await render().props.action(data());
    assert.equal(render().props.submitLabel, 'Check upload status');
    hooks = []; await render().props.action(new FormData());
    assert.equal(calls.find(c => c[0] === 'status')[1], intent); assert.equal(calls.some(c => c[0] === 'finalize'), false);
    assert.equal(render().props.submitLabel, 'Submit research');
});
test('invalid local files are rejected before initiation or direct transfer', async () => {
    reset(); const form = new FormData(); form.set('file', new File(['not PDF'], 'bad.txt', { type: 'text/plain' }));
    assert.equal((await render().props.action(form)).success, false); assert.equal(calls.length, 0);
});
test.after(() => { if (previous.storage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = previous.storage;
    if (previous.xhr === undefined) delete globalThis.XMLHttpRequest; else globalThis.XMLHttpRequest = previous.xhr; });
