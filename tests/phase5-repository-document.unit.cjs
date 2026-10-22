/* eslint-disable @typescript-eslint/no-require-imports */
// node --import tsx tests/phase5-repository-document.unit.cjs
const assert = require('node:assert/strict');
const Module = require('node:module');
let user = { id: 3, roleId: 3, isActive: true };
let session = { userId: 3, roleId: 3 };
const valid = { id: 1, paperId: 20, submissionId: 10, version: 'v2', fileUrl: 'research/20/v2/test.pdf' };
let entry = valid;
let failure = false;
const signatures = [];
const downloads = [];
const mocks = {
    'server-only': {},
    'next/cache': { revalidatePath() {} },
    '@/lib/auth/session': { getSession: async () => session },
    'next/navigation': { redirect: path => { throw new Error('REDIRECT ' + path); } },
    '@/lib/repositories/user.repository': { findUserById: async () => user },
    '@/lib/services/repository-publication.service': {},
    '@/lib/repositories/repository.repository': {
        findPublishedRepositoryEntry: async () => entry,
        incrementRepositoryDownloadCount: async id => downloads.push(id),
    },
    '@/lib/services/storage.service': { createResearchDocumentSignedUrl: async (...args) => {
        signatures.push(args);
        if (failure) throw new Error('Sensitive synthetic storage detail');
        return 'synthetic-signed-url';
    } },
};
const originalLoad = Module._load;
Module._load = function(id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : originalLoad.call(this, id, ...args); };
const { createPublishedResearchDocumentUrl } = require('../lib/services/repository-document.service.ts');
const { getRepositoryDocumentUrlAction } = require('../lib/actions/repository.action.ts');
async function denied() {
    const before = signatures.length;
    const result = await getRepositoryDocumentUrlAction(20, 'view');
    assert.equal(result.success, false); assert.equal(result.url, null);
    assert.equal(signatures.length, before, 'Denied requests must not reach signing');
}
async function deniedSession() {
    const before = signatures.length;
    await assert.rejects(getRepositoryDocumentUrlAction(20, 'view'), /REDIRECT \/login/);
    assert.equal(signatures.length, before);
}
async function main() {
    for (const roleId of [1, 2, 3, 4]) {
        user = { id: 3, roleId, isActive: true }; session = { userId: 3, roleId };
        assert.equal((await getRepositoryDocumentUrlAction(20, 'view')).success, true);
        assert.deepEqual(signatures.pop(), [valid.fileUrl, 300, { download: false }]);
    }
    assert.equal((await getRepositoryDocumentUrlAction(20, 'download')).success, true);
    assert.deepEqual(signatures.pop(), [valid.fileUrl, 300, { download: true }]);
    assert.deepEqual(downloads, [valid.id]);
    user.isActive = false; await deniedSession(); user.isActive = true;
    user.roleId = 999; await deniedSession(); user = undefined; await deniedSession();
    user = { id: 3, roleId: 3, isActive: true };
    session = { userId: 3, roleId: 3 };
    // An eligible repository query returning no record covers unpublished/missing/nonapproved resources.
    entry = undefined; await denied();
    for (const value of [null, '', 'research/21/v2/test.pdf', 'research/20/v1/test.pdf', 'research/20/v2/../test.pdf', 'research/20/v2/%2e.pdf', 'research/20/v2/test.txt', 'https://example.invalid/test.pdf']) {
        entry = { ...valid, fileUrl: value }; await denied();
    }
    for (const change of [{ paperId: 21 }, { id: 0 }, { submissionId: 0 }, { version: 'v0' }]) {
        entry = { ...valid, ...change }; await denied();
    }
    entry = valid;
    for (const id of [null, '20', true, {}, [20], 0, -1, 1.5, Infinity, 2147483648, 'research/20/v2/test.pdf']) {
        assert.equal((await getRepositoryDocumentUrlAction(id, 'view')).success, false);
    }
    assert.equal((await getRepositoryDocumentUrlAction(20, { path: valid.fileUrl })).success, false);
    assert.equal((await createPublishedResearchDocumentUrl(20, 'view', 0)).success, false);
    session = null; await assert.rejects(getRepositoryDocumentUrlAction(20, 'view'), /REDIRECT \/login/);
    session = { userId: 3, roleId: 999 }; await deniedSession();
    session = { userId: 3, roleId: 3 };
    failure = true;
    const result = await getRepositoryDocumentUrlAction(20, 'download');
    assert.equal(result.success, false); assert.equal(result.url, null);
    assert.equal(JSON.stringify(result).includes('Sensitive'), false);
    assert.equal(JSON.stringify(result).includes(valid.fileUrl), false);
    assert.equal(downloads.length, 1); failure = false;
    const lookup = mocks['@/lib/repositories/repository.repository'].findPublishedRepositoryEntry;
    mocks['@/lib/repositories/repository.repository'].findPublishedRepositoryEntry = async () => { throw new Error('Sensitive database error'); };
    await denied(); mocks['@/lib/repositories/repository.repository'].findPublishedRepositoryEntry = lookup;
    console.log('PASS repository document action/session/roles, active DB identity, strict IDs/path binding, 300-second view/download signing, and controlled storage/database failures');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
