/* eslint-disable @typescript-eslint/no-require-imports */
// Actual actions/services, synthetic persistence/storage failures. No DB or network.
const assert = require('node:assert/strict');
const Module = require('node:module');
let session = { userId: 10, roleId: 1 }, account = { id: 10, roleId: 1, isActive: true };
let reads = 0, writes = 0, logs = 0, notices = 0, failure = '', lockedKind = 'updated', signing = 0;
let paper = { id: 30, status: 'Approved' }, submission = { version: 'v1', fileUrl: 'research/30/v1/synthetic.pdf' }, entry;
const mocks = {
    'server-only': {},
    'next/cache': { revalidatePath: () => { if (failure === 'refresh') throw Error('PRIVATE_CACHE'); } },
    'next/navigation': { redirect: path => { throw Error('REDIRECT ' + path); } },
    '@/lib/auth/session': { getSession: async () => session },
    '@/lib/services/adviser-groups.service': { requireActiveGroupAdviser: async () => null },
    '@/lib/repositories/user.repository': { findUserById: async () => { if (failure === 'read') throw Error('PRIVATE_DB'); return account; } },
    '@/lib/services/activity-log.service': { logActivity: async () => { logs++; if (failure === 'sideEffect') throw Error('PRIVATE_LOG'); } },
    '@/lib/services/notification.service': { sendNotification: async () => { notices++; if (failure === 'sideEffect') throw Error('PRIVATE_NOTICE'); return { success: failure !== 'notificationResult' }; } },
    '@/lib/repositories/research-group.repository': {
        findAllResearchGroups: async () => { reads++; if (failure === 'list') throw Error('PRIVATE_DB'); return [{ id: 20 }]; },
        updateResearchGroupStatusForAdmin: async (actorId, id, status) => { assert.equal(actorId, 10); writes++; if (failure === 'write') throw Error('PRIVATE_WRITE'); return { kind: lockedKind, group: { id, status, groupName: 'Synthetic group', adviserId: 11 } }; },
    },
    '@/lib/repositories/repository.repository': {
        findApprovedPapersForRepository: async () => { reads++; if (failure === 'list') throw Error('PRIVATE_DB'); return [{ paperId: 30, title: 'Synthetic', version: 'v1', fileUrl: 'research/30/v1/synthetic.pdf' }, { paperId: 31, version: 'v1', fileUrl: 'research/30/v1/wrong.pdf' }]; },
        findRepositoryManagementEntries: async () => [{ id: 50, paperId: 32, isPublished: false }],
    },
    '@/lib/repositories/repository-publication.repository': {
        findPublicationById: async () => entry,
        withPublicationContext: async (id, actor, operation) => operation({ tx: {}, user: lockedKind === 'denied' ? { roleId: 2, isActive: true } : account, paper, submission, entry }),
        writePublication: async (tx, id, entryId, published) => { writes++; if (failure === 'write') throw Error('PRIVATE_COMMIT'); entry = { id: entryId || 50, paperId: id, isPublished: published }; return entry; },
    },
    '@/lib/services/storage.service': { createResearchDocumentSignedUrl: async (path, ttl) => { signing++; assert.equal(ttl, 300); assert.equal(path, submission.fileUrl); if (failure === 'storage') throw Error('PRIVATE_STORAGE'); return 'never-exposed'; } },
};
const load = Module._load;
Module._load = function(id, ...args) { return Object.hasOwn(mocks, id) ? mocks[id] : load.call(this, id, ...args); };
const groups = require('../lib/services/research-group.services.ts');
const groupActions = require('../lib/actions/research-group.action.ts');
const publications = require('../lib/services/repository-publication.service.ts');
const repo = require('../lib/services/repository.service.ts');
const repoActions = require('../lib/actions/repository.action.ts');
const form = (key, value, publish) => { const data = new FormData(); data.set(key, String(value)); if (publish !== undefined) data.set('publish', String(publish)); return data; };
const initial = { success: false, message: '' };
async function main() {
    for (const state of [null, { id: 10, roleId: 1, isActive: false }, { id: 10, roleId: 2, isActive: true }, { id: 10, roleId: 3, isActive: true }, { id: 10, roleId: 4, isActive: true }]) {
        account = state;
        assert.equal((await groups.getResearchGroups()).success, false);
        for (const fn of [groups.changeResearchGroupStatus, groupActions.changeResearchGroupStatusAction]) assert.equal((await fn(20, 'archived', 999)).kind, 'denied');
        assert.equal((await publications.publishResearch(30, 10)).success, false);
        assert.equal((await repoActions.publishRepositoryPaperAction(initial, form('paperId', 30))).success, false);
        assert.equal((await repoActions.updateRepositoryPublicationAction(initial, form('repositoryId', 50, false))).success, false);
    }
    account = { id: 10, roleId: 1, isActive: true };
    for (const state of [null, { userId: 10, roleId: 2 }, { userId: 10, roleId: 3 }, { userId: 10, roleId: 4 }, { userId: 0, roleId: 1 }]) {
        session = state;
        assert.equal((await groups.getResearchGroups()).success, false);
        assert.equal((await groupActions.changeResearchGroupStatusAction(20, 'archived')).kind, 'denied');
        if (!state || state.roleId !== 1) await assert.rejects(repoActions.publishRepositoryPaperAction(initial, form('paperId', 30)), /REDIRECT/);
    }
    assert.equal(reads, 0); assert.equal(writes, 0); assert.equal(signing, 0);
    session = { userId: 10, roleId: 1 };
    for (const id of [0, -1, 1.5, '20', 2147483648, NaN]) assert.equal((await groups.changeResearchGroupStatus(id, 'archived')).kind, 'validation');
    assert.equal((await groupActions.changeResearchGroupStatusAction(20, 'deleted')).kind, 'validation'); assert.equal(writes, 0);
    assert.equal((await groups.getResearchGroups()).success, true);
    for (const kind of ['denied', 'missing', 'invalid']) { lockedKind = kind; assert.equal((await groupActions.changeResearchGroupStatusAction(20, 'archived')).success, false); }
    assert.equal(logs, 0); assert.equal(notices, 0); lockedKind = 'updated';
    for (const status of ['archived', 'active']) assert.equal((await groupActions.changeResearchGroupStatusAction(20, status)).kind, 'success');
    failure = 'sideEffect'; const confirmed = await groups.changeResearchGroupStatus(20, 'archived'); assert.equal(confirmed.success, true); assert.match(confirmed.message, /unavailable/); assert.equal(logs, 3); assert.equal(notices, 3);
    failure = 'notificationResult'; const notificationWarning = await groups.changeResearchGroupStatus(20, 'active'); assert.equal(notificationWarning.success, true); assert.match(notificationWarning.message, /notification delivery was unavailable/);
    failure = 'write'; const unknown = await groupActions.changeResearchGroupStatusAction(20, 'active'); assert.equal(unknown.uncertain, true); assert.match(unknown.message, /Refresh and verify/); assert.ok(!unknown.message.includes('PRIVATE'));
    failure = 'list'; assert.equal((await groups.getResearchGroups()).data, undefined); assert.equal((await repo.getRepositoryManagementResult(10)).success, false);
    failure = ''; const directory = await repo.getRepositoryManagementData(10); assert.equal(directory.eligiblePapers.length, 1); assert.equal(directory.repositoryEntries[0].isPublished, false);
    const start = writes;
    paper.status = 'Draft'; assert.equal((await publications.publishResearch(30, 10)).success, false); paper.status = 'Approved';
    const valid = submission; submission = null; assert.equal((await publications.publishResearch(30, 10)).success, false);
    submission = { ...valid, fileUrl: 'research/31/v1/wrong.pdf' }; assert.equal((await publications.publishResearch(30, 10)).success, false); submission = valid;
    failure = 'storage'; assert.equal((await publications.publishResearch(30, 10)).success, false); assert.equal(writes, start);
    failure = ''; lockedKind = 'denied'; assert.equal((await publications.publishResearch(30, 10)).success, false); assert.equal(writes, start); lockedKind = 'updated';
    assert.equal((await repoActions.publishRepositoryPaperAction(initial, form('paperId', 30))).success, true);
    assert.equal((await publications.publishResearch(30, 10)).success, false); // Duplicate remains rejected.
    assert.equal((await repoActions.updateRepositoryPublicationAction(initial, form('repositoryId', 50, false))).success, true); assert.equal(entry.isPublished, false);
    assert.equal((await repoActions.updateRepositoryPublicationAction(initial, form('repositoryId', 50, true))).success, true); assert.equal(entry.isPublished, true);
    failure = 'write'; assert.equal((await publications.changeResearchPublication(50, false, 10)).uncertain, true);
    failure = 'refresh'; assert.equal((await groupActions.changeResearchGroupStatusAction(20, 'active')).success, true);
    console.log('PASS actual group/repository actions and services: current Admin; direct inactive/stale/missing/anonymous/non-Admin denial; no unauthorized reads/writes/signing; strict validation; transactional denial; both group transitions; side-effect warning; safe retrieval and uncertain writes; candidate path filter; approval/submission/path/object checks; duplicate rejection; Publish/Unpublish/Republish. Synthetic persistence only, zero DB/network.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
