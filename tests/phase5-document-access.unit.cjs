/* eslint-disable @typescript-eslint/no-require-imports */
// node --import tsx tests/phase5-document-access.unit.cjs
const assert = require('node:assert/strict');
const Module = require('node:module');
let actor = { id: 3, roleId: 3, isActive: true };
let submission = { id: 10, paperId: 20, version: 'v1', fileUrl: 'research/20/v1/test.pdf' };
let paper = { id: 20, groupId: 30 };
let group = { id: 30, adviserId: 2 };
let member = true;
let failure = false;
let session = { userId: 3, roleId: 3 };
let mainAdviserId = 2;
const calls = [];
const mocks = {
    'server-only': {},
    '@/lib/repositories/co-adviser.repository': { readDelegatedDocument: async () => { throw Error('Legacy document access must not use delegation'); } },
    '@/lib/repositories/research-supervision.repository': { findCurrentMainAdviserId: async () => mainAdviserId },
    '@/lib/repositories/user.repository': { findUserById: async () => actor },
    '@/lib/repositories/submission.repository': { findSubmissionById: async () => submission },
    '@/lib/repositories/research-paper.repository': { findResearchPaperById: async () => paper },
    '@/lib/repositories/research-group.repository': { findResearchGroupById: async () => group },
    '@/lib/repositories/group-member.repository': { findGroupMember: async () => member },
    '@/lib/services/storage.service': { createResearchDocumentSignedUrl: async (...args) => {
        calls.push(args); if (failure) throw new Error('Synthetic failure'); return 'synthetic-signed-url';
    } },
    '@/lib/auth/session': { getSession: async () => session },
    'next/navigation': { redirect: path => { throw new Error('REDIRECT ' + path); } },
};
const original = Module._load;
Module._load = function (id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : original.call(this, id, ...args); };
const { createSubmissionDocumentUrl } = require('../lib/services/submission-document.service.ts');
const { getSubmissionDownloadUrlAction } = require('../lib/actions/storage.action.ts');
const { isSubmissionDocumentPath } = require('../lib/validations/submission-document.ts');
async function denied() {
    const before = calls.length;
    assert.equal(await createSubmissionDocumentUrl(10, actor?.id ?? 3), null);
    assert.equal(await createSubmissionDocumentUrl(10, actor?.id ?? 3, 'adviser-review'), null);
    assert.equal(calls.length, before, 'Denied metadata/identity must never reach storage');
}
async function main() {
    assert.equal(await getSubmissionDownloadUrlAction(10), 'synthetic-signed-url');
    assert.deepEqual(calls.pop(), ['research/20/v1/test.pdf', 300]);
    assert.equal(await getSubmissionDownloadUrlAction(10, 'adviser-review'), null, 'A Student cannot select the Adviser duration');
    member = false; await denied(); member = true;
    actor = { id: 2, roleId: 2, isActive: true };
    session = { userId: 2, roleId: 2 };
    assert.equal(await createSubmissionDocumentUrl(10, 2), 'synthetic-signed-url');
    assert.deepEqual(calls.pop(), ['research/20/v1/test.pdf', 300], 'Legacy Adviser download stays at 300 seconds');
    session = { userId: 2, roleId: 2 };
    assert.equal(await getSubmissionDownloadUrlAction(10, 'adviser-review'), 'synthetic-signed-url');
    assert.deepEqual(calls.pop(), ['research/20/v1/test.pdf', 1800]);
    // Neither the existing action nor an internal caller can supply an arbitrary TTL.
    for (const purpose of [1800, 7200, null, {}, { purpose: 'adviser-review', expiresIn: 7200 }, 'repository', '1800']) {
        const before = calls.length;
        assert.equal(await getSubmissionDownloadUrlAction(10, purpose), null);
        assert.equal(await createSubmissionDocumentUrl(10, 2, purpose), null);
        assert.equal(calls.length, before);
    }
    assert.equal(await getSubmissionDownloadUrlAction(10, 'adviser-review', 7200), 'synthetic-signed-url');
    assert.deepEqual(calls.pop(), ['research/20/v1/test.pdf', 1800], 'Extra input cannot increase the fixed server TTL');
    group = { id: 30, adviserId: 4 };
    assert.equal(await createSubmissionDocumentUrl(10, 2), 'synthetic-signed-url', 'historical Adviser no longer limits the current Main'); calls.pop();
    mainAdviserId = 4; await denied(); mainAdviserId = 2;
    group = { id: 30, adviserId: 2 };
    submission = { ...submission, version: 'v2' }; await denied();
    submission = { ...submission, version: 'v1' };
    const adviserSubmission = submission;
    for (const fileUrl of [null, '', 'research/21/v1/test.pdf', 'research/20/v2/test.pdf', 'research/20/v1/../test.pdf', 'https://example.invalid/test.pdf']) {
        submission = { ...adviserSubmission, fileUrl }; await denied();
    }
    submission = adviserSubmission;
    failure = true;
    assert.equal(await getSubmissionDownloadUrlAction(10, 'adviser-review'), null);
    failure = false;
    actor.isActive = false; await denied(); actor.isActive = true;
    session = null; await assert.rejects(getSubmissionDownloadUrlAction(10, 'adviser-review'), /REDIRECT \/login/);
    session = { userId: 3, roleId: 3 };
    actor = { id: 4, roleId: 2, isActive: true }; await denied();
    for (const roleId of [1, 4, 999]) { actor = { id: 3, roleId, isActive: true }; await denied(); }
    actor = { id: 3, roleId: 3, isActive: false }; await denied();
    actor = undefined; await denied(); actor = { id: 3, roleId: 3, isActive: true };
    const originalSubmission = submission;
    submission = undefined; await denied(); submission = originalSubmission;
    paper = undefined; await denied(); paper = { id: 20, groupId: 30 };
    group = undefined; await denied(); group = { id: 30, adviserId: 2 };
    for (const fileUrl of [null, undefined, '', ' ', 'research/21/v1/test.pdf', 'research/20/v2/test.pdf', 'research/20/v1/../test.pdf', 'research/20/v1/test.pdf/other', 'research/20/v1/%2e.pdf', 'research/20/v1/test.pdf?x=1', 'research/20/v1/test.txt', 'https://example.invalid/test.pdf']) {
        submission = { ...originalSubmission, fileUrl }; await denied();
    }
    submission = originalSubmission;
    for (const version of [null, '', 'v0', '../v1']) {
        assert.equal(isSubmissionDocumentPath(submission.fileUrl, 20, version), false);
    }
    for (const id of [null, undefined, '10', 0, -1, 1.5, NaN, Infinity, {}, 2147483648]) {
        const before = calls.length;
        assert.equal(await getSubmissionDownloadUrlAction(id), null);
        assert.equal(calls.length, before);
    }
    session = null; await assert.rejects(getSubmissionDownloadUrlAction(10), /REDIRECT \/login/);
    for (const roleId of [1, 4]) {
        session = { userId: 3, roleId };
        actor = { id: 3, roleId, isActive: true };
        await assert.rejects(getSubmissionDownloadUrlAction(10), /REDIRECT \/dashboard/);
    }
    session = { userId: 3, roleId: 3 };
    actor = { id: 3, roleId: 3, isActive: true };
    for (const purpose of ['download', 'adviser-review']) {
        const before = calls.length;
        session = null; await assert.rejects(getSubmissionDownloadUrlAction(10, purpose), /REDIRECT \/login/);
        assert.equal(calls.length, before);
    }
    session = { userId: 3, roleId: 3 };
    failure = true; assert.equal(await getSubmissionDownloadUrlAction(10), null); failure = false;
    const repository = mocks['@/lib/repositories/submission.repository'];
    const lookup = repository.findSubmissionById;
    repository.findSubmissionById = async () => { throw new Error('Synthetic database failure'); };
    await denied(); repository.findSubmissionById = lookup;
    console.log('PASS isolated action authentication/roles/input, ownership/version/path binding, failures, fixed Adviser-review 1800-second signing, and unchanged 300-second defaults');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
