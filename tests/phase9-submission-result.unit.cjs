/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated action and UI-result tests. No database/storage/environment access.
const assert = require('node:assert/strict');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
let session = { userId: 9, roleId: 3 };
let outcome = { success: true, message: 'PRIVATE_SERVICE_MESSAGE', data: { fileUrl: 'PRIVATE_STORAGE_PATH' } };
let failService = false, failRevalidation = false, uiState = { success: false, message: '' }, uiPending = false;
const calls = [], paths = [];
const mocks = {
    'server-only': {},
    '@/lib/auth/session': { getSession: async () => session },
    'next/navigation': { redirect: destination => { throw new Error('REDIRECT '+destination); } },
    'next/cache': { revalidatePath: path => { paths.push(path); if (failRevalidation) throw new Error('PRIVATE_CACHE_ERROR'); } },
    '@/lib/services/submission.service': { submitResearch: async (...args) => {
        calls.push(args); if (failService) throw new Error('PRIVATE_DATABASE_ERROR'); return outcome;
    } },
};
const original = Module._load;
Module._load = function(id, ...args) {
    if (Object.hasOwn(mocks,id)) return mocks[id];
    assert.ok(!/lib\/db|repositories|supabase|storage\.service/.test(id), 'No DB/storage dependencies in isolated test');
    return original.call(this,id,...args);
};
const { submitResearchAction } = require('../lib/actions/submission.action.ts');
// Only the hook's result is stubbed for static state presentation.
Module._load = function(id, ...args) {
    if (id === 'react') return { ...React, useActionState: () => [uiState, () => {}, uiPending] };
    if (Object.hasOwn(mocks,id)) return mocks[id];
    assert.ok(!/lib\/db|repositories|supabase|storage\.service/.test(id));
    return original.call(this,id,...args);
};
const SubmissionForm = require('../app/dashboard/student/submissions/SubmissionForm.tsx').default;
function input(paperId='7', withFile=true) {
    const data = new FormData();
    data.set('paperId',paperId); data.set('remarks','  Synthetic remarks  ');
    data.set('userId','999'); data.set('roleId','1'); // Ignored client identity.
    if (withFile) data.set('file',new File(['%PDF synthetic'],'synthetic.pdf',{ type:'application/pdf' }));
    return data;
}
function safe(result) {
    assert.deepEqual(Object.keys(result).sort(),['message','success']);
    assert.ok(!JSON.stringify(result).includes('PRIVATE_'));
    assert.equal(typeof result.message,'string');
}
async function main() {
    for (const bad of ['0','-1','not-a-paper']) {
        const before=calls.length;
        const result=await submitResearchAction(input(bad));
        assert.equal(result.success,false); safe(result); assert.equal(calls.length,before);
    }
    const long=input(); long.set('remarks','x'.repeat(501));
    assert.equal((await submitResearchAction(long)).success,false);
    const before=calls.length;
    assert.equal((await submitResearchAction(input('7',false))).success,false);
    assert.equal(calls.length,before);
    uiState=await submitResearchAction(input());
    safe(uiState); assert.equal(uiState.success,true);
    assert.equal(calls.length,1); assert.equal(calls[0][0],7); assert.equal(calls[0][1],9);
    assert.ok(calls[0][2] instanceof File); assert.equal(calls[0][3],'Synthetic remarks');
    assert.deepEqual(paths,['/dashboard/student','/dashboard/student/submissions']);
    let html=renderToStaticMarkup(React.createElement(SubmissionForm,{projects:[{id:7,title:'Synthetic project'}]}));
    assert.ok(html.includes('Research submitted successfully.') && html.includes('research-notice'));
    assert.ok(html.includes('aria-live="polite"'));
    const revalidated=paths.length;
    outcome={success:false,message:'PRIVATE_STORAGE_PATH PRIVATE_DATABASE_ERROR'};
    uiState=await submitResearchAction(input()); safe(uiState); assert.equal(uiState.success,false);
    assert.equal(paths.length,revalidated);
    html=renderToStaticMarkup(React.createElement(SubmissionForm,{projects:[{id:7,title:'Synthetic project'}]}));
    assert.ok(html.includes(uiState.message) && html.includes('form-message') && !html.includes('PRIVATE_'));
    failService=true;
    const failed=await submitResearchAction(input()); safe(failed); assert.equal(failed.success,false);
    assert.equal(paths.length,revalidated); failService=false;
    outcome={success:true,message:'PRIVATE_SUCCESS'};
    failRevalidation=true;
    const committed=await submitResearchAction(input()); safe(committed); assert.equal(committed.success,true);
    assert.ok(committed.message.includes('Reload this page')); failRevalidation=false;
    uiState={success:false,message:''}; uiPending=true;
    html=renderToStaticMarkup(React.createElement(SubmissionForm,{projects:[]}));
    assert.ok(html.includes('Submitting PDF...') && html.includes('aria-busy="true"'));
    assert.equal((html.match(/<(select|input|textarea|button)[^>]*disabled=""/g)||[]).length,4);
    for (const actor of [null,{userId:9,roleId:1},{userId:9,roleId:2},{userId:9,roleId:4}]) {
        session=actor;
        const before=calls.length;
        await assert.rejects(submitResearchAction(input()), /REDIRECT \/(login|dashboard)/);
        assert.equal(calls.length,before);
    }
    console.log('PASS isolated action: Zod/missing file, session identity, one service call per attempt, success-only revalidation, sanitized failure/exception, committed success on cache failure, unchanged role/anonymous redirects; real UI static success/error/pending presentation. No DB/storage operations or live upload success claimed.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
