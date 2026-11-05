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
const { createCollaborativeWorkspaceRepository } = require('../lib/repositories/collaborative-workspace.repository.ts');
const { selectTaskProject, taskDueDate } = require('../lib/workspace/task-board-view.ts');
const { dashboardLinks } = require('../lib/constants/dashboard-navigation.ts');
const { drizzle } = require('drizzle-orm/pg-proxy');
const schema = require('../db/schema/index.ts');

test('project selection defaults deterministically and rejects foreign, malformed, array and out-of-range IDs', () => {
    const projects = [{ id: 20, title: 'Second' }, { id: 10, title: 'First' }];
    assert.equal(selectTaskProject(projects).project.id, 20);
    assert.equal(selectTaskProject(projects, '10').project.id, 10);
    for (const bad of ['999', '0', '-1', '01', '', '10.0', '2147483648', ['10', '20']]) assert.deepEqual(selectTaskProject(projects, bad), { project: null, invalid: true });
    assert.deepEqual(selectTaskProject([], undefined), { project: null, invalid: false });
    assert.match(taskDueDate('2026-11-06'), /Nov 6, 2026/);
});
test('workspace navigation is Student-only and existing submission navigation is preserved', () => {
    assert.equal(dashboardLinks(3).find(l => l.href === '/dashboard/student/workspace').label, 'Group Workspace');
    assert.ok(dashboardLinks(3).some(l => l.href === '/dashboard/student/submissions'));
    for (const role of [1, 2, 4]) assert.ok(!dashboardLinks(role).some(l => l.href === '/dashboard/student/workspace'));
});
function fixture() {
    let session = { userId: 1, roleId: 3 }, directoryCalls = 0;
    const scope = { accounts: [{ id: 1, roleId: 3, isActive: true }], members: [{ userId: 1 }], group: { id: 50, status: 'active' }, paper: { id: 100, groupId: 50 } };
    const at = new Date('2026-11-05T00:00:00Z');
    const tasks = [[10, 1, 2], [11, 2, 1], [12, 4, 5]].map(([id, createdBy, assignedStudentId]) => ({ id, paperId: 100, title: 'Task', description: null, dueDate: null, status: 'To Do', createdBy, assignedStudentId, createdAt: at, updatedAt: at }));
    const service = createCollaborativeWorkspaceService({ session: async () => session, repository: { withScope: async (_actor, _paper, _mode, _selection, work) => work({ scope,
        listTasks: async () => tasks, taskDirectory: async ids => { directoryCalls++; assert.deepEqual(ids, [1, 2, 2, 1, 4, 5]); return {
            members: [{ id: 1, name: 'Actor' }, { id: 2, name: 'Current member' }], people: [{ id: 4, name: 'Former creator' }, { id: 5, name: 'Former assignee' }],
        }; } }) } });
    return { service, scope, session(value) { session = value; }, calls: () => directoryCalls };
}
test('server board capabilities match creator, assignee and recovery rules without transferring ownership', async () => {
    const f = fixture(), result = await f.service.taskBoard({ paperId: 100 });
    assert.equal(result.kind, 'success');
    const [own, assigned, orphan] = result.data.tasks;
    assert.deepEqual(own.permissions, { edit: true, assign: true, status: true, delete: true, recovery: false });
    assert.deepEqual(assigned.permissions, { edit: false, assign: false, status: true, delete: false, recovery: false });
    assert.deepEqual(orphan.permissions, { edit: false, assign: true, status: false, delete: false, recovery: true });
    assert.deepEqual(orphan.creator, { name: 'Former creator', eligible: false }); assert.deepEqual(orphan.assignee, { name: 'Former assignee', eligible: false });
    assert.equal(orphan.createdBy, 4); assert.equal(orphan.assignedStudentId, 5);
    assert.deepEqual(result.data.members.map(m => Object.keys(m).sort()), [['id', 'name'], ['id', 'name']]);
});
test('unauthorized board requests cannot reach directory/task metadata; strict input rejects supplied actor IDs', async () => {
    for (const mutate of [f => f.session(null), f => f.session({ userId: 1, roleId: 1 }), f => f.scope.accounts[0].isActive = false,
        f => f.scope.members = [], f => f.scope.group.status = 'inactive', f => f.scope.paper.groupId = 99]) {
        const f = fixture(); mutate(f); const r = await f.service.taskBoard({ paperId: 100 }); assert.equal(r.kind, 'unavailable'); assert.equal(f.calls(), 0); assert.ok(!r.data);
    }
    const f = fixture(); assert.equal((await f.service.taskBoard({ paperId: 100, userId: 2 })).kind, 'validation'); assert.equal(f.calls(), 0);
});
test('repository directory selects only active Student group members and task-attribution IDs, never credentials', async () => {
    const queries = [];
    const db = drizzle(async (query, params) => {
        queries.push({ query, params });
        if (query.startsWith('select')) {
            if (query.includes('inner join "users"')) return { rows: [[2, 'Eligible', 'Student']] };
            if (query.includes('"first_name"')) return { rows: [[4, 'Former', 'Creator']] };
            if (query.includes('from "users"')) return { rows: [[1, 3, true]] };
            if (query.includes('from "research_groups"')) return { rows: [[50, 'active']] };
            if (query.includes('from "group_members"')) return { rows: [[1]] };
            if (query.includes('from "research_papers"')) return { rows: query.includes('for share') ? [[100, 50]] : [[50]] };
        }
        return { rows: [] };
    }, { schema });
    db.transaction = work => work(db);
    const result = await createCollaborativeWorkspaceRepository(db).withScope(1, 100, 'read', {}, tx => tx.taskDirectory([4]));
    assert.deepEqual(result.members, [{ id: 2, name: 'Eligible Student' }]);
    const members = queries.find(q => q.query.includes('inner join "users"'));
    assert.match(members.query, /"group_members"\."group_id" =/); assert.match(members.query, /"users"\."is_active" =/); assert.match(members.query, /"users"\."role_id" =/);
    assert.deepEqual(members.params, [50, true, 3]);
    const attribution = queries.find(q => q.query.includes('"first_name"') && !q.query.includes('inner join'));
    assert.deepEqual(attribution.params, [4]); assert.match(attribution.query, /"users"\."id" in/);
    for (const q of [members, attribution]) assert.doesNotMatch(q.query, /"email"|"password"|"profile_image"/);
});

function loadPage(mocks) {
    const sandboxModule = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync('app/dashboard/student/workspace/page.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext(code, { module: sandboxModule, exports: sandboxModule.exports, require: id => Object.hasOwn(mocks, id) ? mocks[id] : require(id) });
    return sandboxModule.exports.default;
}
test('server route checks Student/account access and never loads tasks for an unauthorized selection', async () => {
    const calls = [], Board = () => null;
    const mocks = {
        '@/lib/auth/authorization': { requireRole: async roles => { calls.push(['role', ...roles]); } }, '@/lib/auth/roles': { ROLE_IDS: { STUDENT: 3 } },
        '@/lib/services/dashboard-account.service': { getDashboardAccount: async () => ({ id: 1, roleId: 3, email: 'test@example.invalid' }) },
        '@/lib/services/student-research.service': { getStudentResearchProjects: async () => ({ success: true, data: [{ id: 10, title: 'Older', createdAt: new Date(0) }, { id: 20, title: 'Newer', createdAt: new Date(10) }] }) },
        '@/lib/services/collaborative-workspace.runtime': { collaborativeWorkspace: { taskBoard: async input => { calls.push(['board', input.paperId]); return { success: true, data: { tasks: [], members: [] } }; } } },
        '@/lib/workspace/task-board-view': { selectTaskProject }, '@/lib/workspace/workspace-view': require('../lib/workspace/workspace-view.ts'), '@/components/dashboard/dashboard-header': { default: () => null },
        '@/components/dashboard/student-group-workspace': { default: Board },
    };
    const page = loadPage(mocks);
    await page({ searchParams: Promise.resolve({ project: '999' }) }); assert.deepEqual(calls, [['role', 3]]);
    calls.length = 0; const rendered = await page({ searchParams: Promise.resolve({}) });
    assert.deepEqual(calls, [['role', 3], ['board', 20]]);
    const board = rendered.props.children.find(c => c?.type === Board);
    assert.equal(board.key, '20'); assert.equal(board.props.project.id, 20);
    assert.deepEqual(Object.keys(board.props.projects[0]).sort(), ['id', 'title']);
    calls.length = 0; mocks['@/lib/services/dashboard-account.service'].getDashboardAccount = async () => null;
    await loadPage(mocks)({ searchParams: Promise.resolve({}) }); assert.deepEqual(calls, [['role', 3]]);
});
