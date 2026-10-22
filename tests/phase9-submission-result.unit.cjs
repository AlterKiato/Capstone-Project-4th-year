/* eslint-disable @typescript-eslint/no-require-imports */
// Retired File action and metadata-only action/cache contracts. No database, Storage or environment access.
const assert = require('node:assert/strict');
const Module = require('node:module'), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
let session = { userId: 9, roleId: 3 }, outcome = { success: true, code: 'completed', message: 'Research submitted successfully.', submissionId: 1, version: 'v1' };
let failCache = false, uiState, uiPending = false;
const calls = [], paths = [];
const mocks = {
    'server-only': {},
    '@/lib/auth/current-account': { getCurrentAccount: async () => session },
    'next/navigation': { redirect: path => { throw Error('REDIRECT ' + path); } },
    'next/cache': { revalidatePath: path => { if (failCache) throw Error('synthetic-cache-failure'); paths.push(path); } },
    '@/lib/services/submission-upload.service': { submissionUploads: Object.fromEntries(['initiate', 'renew', 'status', 'cancel', 'finalize'].map(name => [name, async input => { calls.push([name, input]); return outcome; }])) },
};
const original = Module._load;
Module._load = function(id, ...args) {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    assert.ok(!/lib\/db|repositories|supabase|storage\.service/.test(id), 'No DB/Storage dependencies in isolated action test');
    return original.call(this, id, ...args);
};
const { submitResearchAction } = require('../lib/actions/submission.action.ts');
const actions = require('../lib/actions/submission-upload.action.ts');
mocks.react = { ...React, useActionState: () => [uiState, () => {}, uiPending] };
const SubmissionForm = require('../app/dashboard/student/submissions/SubmissionForm.tsx').default;
async function main() {
    const legacy = new FormData(); legacy.set('file', new File(['%PDF-synthetic'], 'synthetic.pdf', { type: 'application/pdf' })); legacy.set('paperId', '7');
    uiState = await submitResearchAction(legacy);
    assert.equal(uiState.success, false); assert.match(uiState.message, /replaced/); assert.equal(calls.length, 0); assert.equal(paths.length, 0);
    assert.ok(renderToStaticMarkup(React.createElement(SubmissionForm, { projects: [{ id: 7, title: 'Synthetic' }] })).includes(uiState.message));
    outcome = { success: true, code: 'pending', message: 'Prepared.' };
    const metadata = { paperId: 7, fileName: 'synthetic.pdf', size: 20, contentType: 'application/pdf', requestKey: 'synthetic-request-id' };
    await actions.initiateSubmissionUploadAction(metadata); assert.deepEqual(calls.at(-1), ['initiate', metadata]); assert.equal(paths.length, 0);
    for (const [name, action] of [['status', actions.getSubmissionUploadStatusAction], ['renew', actions.renewSubmissionUploadAction], ['cancel', actions.cancelSubmissionUploadAction]]) {
        await action('opaque-intent'); assert.deepEqual(calls.at(-1), [name, 'opaque-intent']);
    }
    outcome = { success: false, code: 'unavailable', message: 'Check upload status.' };
    assert.equal((await actions.finalizeSubmissionUploadAction('opaque-intent')).success, false); assert.equal(paths.length, 0);
    outcome = { success: true, code: 'completed', message: 'Research submitted successfully.', submissionId: 1, version: 'v1' };
    assert.equal((await actions.finalizeSubmissionUploadAction('opaque-intent')).success, true);
    assert.deepEqual(paths, ['/dashboard/student', '/dashboard/student/submissions']);
    failCache = true; const committed = await actions.finalizeSubmissionUploadAction('opaque-intent'); assert.equal(committed.success, true); assert.match(committed.message, /Reload/);
    for (const value of [null, { userId: 9, roleId: 1 }, { userId: 9, roleId: 2 }, { userId: 9, roleId: 4 }]) {
        session = value; await assert.rejects(submitResearchAction(legacy), /REDIRECT \/(login|dashboard)/);
    }
    uiPending = true; const html = renderToStaticMarkup(React.createElement(SubmissionForm, { projects: [] })); assert.ok(html.includes('aria-busy="true"'));
    console.log('PASS retired File action refuses submission; metadata-only action delegation, completed-only cache refresh, durable success on cache failure and legacy role/presentation boundaries. No external I/O.');
}
void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Module._load = original; });
