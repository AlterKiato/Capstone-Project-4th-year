/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const Module = require('node:module');
const original = Module._load;
Module._load = function(id, ...args) { return id === 'server-only' ? {} : original.call(this, id, ...args); };
const { createCollaborativeWorkspaceService } = require('../lib/services/collaborative-workspace.service.ts');
const { workspaceView, workspaceHref } = require('../lib/workspace/workspace-view.ts');
const { selectTaskProject } = require('../lib/workspace/task-board-view.ts');

test('URL view defaults safely and serializes project/tab/deleted state without retaining foreign input', () => {
    for (const tab of [undefined, 'tasks', 'invalid', ['notes'], 'NOTES']) assert.deepEqual(workspaceView(tab, '1'), { tab: 'tasks', deletedOnly: false });
    assert.deepEqual(workspaceView('notes', '1'), { tab: 'notes', deletedOnly: true });
    assert.deepEqual(workspaceView('notes', ['1']), { tab: 'notes', deletedOnly: false });
    assert.equal(workspaceHref(22, 'notes', true), '/dashboard/student/workspace?project=22&tab=notes&deleted=1');
    assert.equal(workspaceHref(11, 'tasks', true), '/dashboard/student/workspace?project=11&tab=tasks');
    assert.equal(workspaceHref(null, 'notes'), '/dashboard/student/workspace?tab=notes');
});
function fixture() {
    let session = { userId: 1, roleId: 3 };
    const calls = [], at = new Date('2026-11-05T00:00:00Z');
    const scope = { accounts: [{ id: 1, roleId: 3, isActive: true }], members: [{ userId: 1 }], group: { id: 50, status: 'active' }, paper: { id: 100, groupId: 50 } };
    const note = (id, createdBy, deletedAt, taskId) => ({ id, paperId: 100, createdBy, deletedAt, taskId, version: 4, title: 'Literal <b>title</b>', content: 'Plain text', createdAt: at, updatedAt: at });
    const notes = [note(10, 1, null, 7), note(11, 2, null, null), note(12, 1, at, null), note(13, 2, at, null), note(14, 4, null, 99)];
    const service = createCollaborativeWorkspaceService({ session: async () => session, repository: { withScope: async (actor, paper, mode, selection, work) => {
        calls.push(['scope', actor, paper, mode, selection]);
        return work({ scope, listNotes: async (actor, deleted) => {
            calls.push(['notes', actor, deleted]); return notes.filter(n => deleted ? n.createdBy === actor && n.deletedAt : !n.deletedAt);
        }, listTasks: async () => { calls.push(['tasks']); return [{ id: 7, title: 'Scoped task', description: 'private detail' }]; },
        taskDirectory: async ids => { calls.push(['names', ids]); return { members: [{ id: 1, name: 'Creator' }], people: [{ id: 2, name: 'Peer' }, { id: 4, name: 'Former member' }] }; } });
    } } });
    return { service, scope, calls, session(value) { session = value; } };
}
test('authorized notes view derives creator controls, names and current scoped task titles', async () => {
    const f = fixture(), r = await f.service.notesBoard({ paperId: 100 });
    assert.ok(r.success); assert.deepEqual(r.data.notes.map(n => n.id), [10, 11, 14]);
    const [own, peer, former] = r.data.notes;
    assert.deepEqual(own.permissions, { edit: true, link: true, delete: true, restore: false });
    assert.deepEqual(peer.permissions, { edit: false, link: false, delete: false, restore: false });
    assert.equal(peer.creatorName, 'Peer'); assert.equal(former.creatorName, 'Former member');
    assert.deepEqual(own.linkedTask, { id: 7, title: 'Scoped task' }); assert.equal(former.linkedTask, null);
    assert.deepEqual(r.data.tasks, [{ id: 7, title: 'Scoped task' }]); assert.equal(own.version, 4);
    assert.equal(own.createdAt, '2026-11-05T00:00:00.000Z'); assert.ok(!JSON.stringify(r.data).match(/email|password|private detail/));
    assert.deepEqual(f.calls[0], ['scope', 1, 100, 'read', {}]);
});
test('Recently Deleted uses current verified actor and enables restore only for their deleted notes', async () => {
    const f = fixture(), r = await f.service.notesBoard({ paperId: 100, deletedOnly: true });
    assert.ok(r.success); assert.deepEqual(r.data.notes.map(n => n.id), [12]);
    assert.deepEqual(r.data.notes[0].permissions, { edit: false, link: false, delete: false, restore: true });
    assert.deepEqual(f.calls.find(c => c[0] === 'notes'), ['notes', 1, true]);
});
test('authorization failures and strict input prevent notes/tasks/attribution reads', async () => {
    for (const mutate of [f => f.session(null), f => f.session({ userId: 1, roleId: 2 }), f => f.scope.accounts[0].isActive = false,
        f => f.scope.members = [], f => f.scope.group.status = 'inactive', f => f.scope.paper.groupId = 99, f => f.scope.paper.id = 999]) {
        const f = fixture(); mutate(f); const r = await f.service.notesBoard({ paperId: 100 });
        assert.equal(r.kind, 'unavailable'); assert.ok(!r.data); assert.ok(!f.calls.some(c => ['notes', 'tasks', 'names'].includes(c[0])));
    }
    const f = fixture(); assert.equal((await f.service.notesBoard({ paperId: 100, studentId: 2 })).kind, 'validation'); assert.equal(f.calls.length, 0);
});
test('server route reads only selected view of an authorized project, including direct/deleted/invalid URL state', async () => {
    const calls = [], Workspace = () => null;
    const mocks = {
        '@/lib/auth/authorization': { requireRole: async () => {} }, '@/lib/auth/roles': { ROLE_IDS: { STUDENT: 3 } },
        '@/lib/services/dashboard-account.service': { getDashboardAccount: async () => ({ id: 1, roleId: 3 }) },
        '@/lib/services/student-research.service': { getStudentResearchProjects: async () => ({ success: true, data: [{ id: 100, title: 'A', createdAt: new Date(0) }] }) },
        '@/lib/services/collaborative-workspace.runtime': { collaborativeWorkspace: { taskBoard: async input => { calls.push(['tasks', input]); return {}; }, notesBoard: async input => { calls.push(['notes', input]); return {}; } } },
        '@/lib/workspace/task-board-view': { selectTaskProject }, '@/lib/workspace/workspace-view': { workspaceView },
        '@/components/dashboard/dashboard-header': { default: () => null }, '@/components/dashboard/student-group-workspace': { default: Workspace },
    };
    const sandboxModule = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync('app/dashboard/student/workspace/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext(code, { module: sandboxModule, exports: sandboxModule.exports, require: id => Object.hasOwn(mocks, id) ? mocks[id] : require(id) });
    const page = sandboxModule.exports.default;
    for (const tab of ['notes', undefined, 'bad']) {
        calls.length = 0;
        const rendered = await page({ searchParams: Promise.resolve({ project: '100', tab, deleted: '1' }) });
        assert.equal(calls.length, 1); assert.equal(calls[0][0], tab === 'notes' ? 'notes' : 'tasks'); assert.equal(calls[0][1].paperId, 100);
        const view = rendered.props.children.find(c => c?.type === Workspace);
        assert.equal(view.props.tab, tab === 'notes' ? 'notes' : 'tasks'); assert.equal(view.props.deletedOnly, tab === 'notes');
    }
    calls.length = 0;
    for (const project of ['999', ['100'], '0']) await page({ searchParams: Promise.resolve({ project, tab: 'notes' }) });
    assert.equal(calls.length, 0);
});
