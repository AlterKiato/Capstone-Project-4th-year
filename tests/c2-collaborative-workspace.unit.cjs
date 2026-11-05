/* eslint-disable @typescript-eslint/no-require-imports */
// Isolated service/transaction models and real Drizzle SQL against a driver double.
// No environment loading, sockets, live database, migration generation or provider calls.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const originalLoad = Module._load;
Module._load = function(id, ...args) {
    if (id === 'server-only') return {};
    if (['@/lib/db', 'postgres', 'dotenv/config'].includes(id)) throw new Error('Live dependency forbidden in C2 isolated tests.');
    return originalLoad.call(this, id, ...args);
};
const { createCollaborativeWorkspaceService } = require('../lib/services/collaborative-workspace.service.ts');
const { createCollaborativeWorkspaceRepository } = require('../lib/repositories/collaborative-workspace.repository.ts');
const schema = require('../db/schema/index.ts');
const inputs = require('../lib/validations/collaborative-workspace.ts');
const { getTableConfig, PgDialect } = require('drizzle-orm/pg-core');
const { drizzle } = require('drizzle-orm/pg-proxy');
const { previewMigrationSource, verifyPreviewLedger } = require('../scripts/preview-migration-source.ts');
const at = new Date('2026-11-05T00:00:00Z');
const taskRow = (id = 10, paperId = 100, createdBy = 1) => ({ id, paperId, createdBy, title: 'Task', description: null,
    assignedStudentId: 2, status: 'To Do', dueDate: null, createdAt: at, updatedAt: at });
const noteRow = (id = 20, paperId = 100, createdBy = 1) => ({ id, paperId, createdBy, taskId: 10, title: 'Note', content: 'Plain text',
    version: 1, deletedAt: null, createdAt: at, updatedAt: at });

// This model makes permission and transaction outcomes observable, not a claim of real SQL locks.
function fixture() {
    let actorId = 1, sessionRole = 3, signedIn = true, fail = '', queue = Promise.resolve();
    const state = {
        accounts: new Map([1, 2, 3, 4, 5].map(id => [id, { id, roleId: 3, isActive: true }])),
        groups: new Map([[50, { id: 50, status: 'active' }], [60, { id: 60, status: 'active' }]]),
        papers: new Map([[100, { id: 100, groupId: 50 }], [101, { id: 101, groupId: 50 }], [200, { id: 200, groupId: 60 }]]),
        members: new Map([[50, [1, 2, 3]], [60, [4]]]),
        tasks: new Map([[10, taskRow()], [11, taskRow(11, 101)], [12, taskRow(12, 200, 4)]]),
        notes: new Map([[20, noteRow()], [21, noteRow(21, 100, 2)], [22, { ...noteRow(22), deletedAt: at }], [23, { ...noteRow(23, 101), taskId: 11 }]]),
    };
    const trace = [];
    const repository = { withScope(studentId, paperId, mode, selection, work) {
        const result = queue.then(async () => {
            const before = structuredClone(state);
            trace.push('begin');
            const paper = state.papers.get(paperId), group = state.groups.get(paper?.groupId);
            const task = state.tasks.get(selection.taskId), linkedTask = state.tasks.get(selection.linkTaskId);
            const scoped = row => row?.paperId === paperId ? { ...row } : undefined;
            const patchNote = async (id, creatorId, version, deleted, patch) => {
                trace.push('patchNote');
                if (fail === 'no-note-update') return;
                const row = state.notes.get(id);
                if (!row || row.paperId !== paperId || row.createdBy !== creatorId || row.version !== version || Boolean(row.deletedAt) !== deleted) return;
                const { deleted: nextDeleted, ...content } = patch;
                const saved = { ...row, ...content, version: row.version + 1, updatedAt: new Date(at.getTime() + 1000),
                    ...(nextDeleted === undefined ? {} : { deletedAt: nextDeleted ? at : null }) };
                state.notes.set(id, saved); return { ...saved };
            };
            const tx = {
                scope: { accounts: [...state.accounts.values()], paper, group,
                    members: (state.members.get(group?.id) ?? []).map(userId => ({ userId })), task: scoped(task), linkedTask: scoped(linkedTask) },
                async listTasks() { return [...state.tasks.values()].filter(row => row.paperId === paperId); },
                async createTask(data) { trace.push('createTask'); const row = { ...taskRow(30), ...data }; state.tasks.set(30, row); return row; },
                async patchTask(id, patch) { trace.push('patchTask'); const row = scoped(state.tasks.get(id)); if (row) { const saved = { ...row, ...patch }; state.tasks.set(id, saved); return saved; } },
                async unlinkTaskNotes(id) {
                    trace.push('unlink');
                    for (const [key, row] of state.notes) if (row.paperId === paperId && row.taskId === id)
                        state.notes.set(key, { ...row, taskId: null, version: row.version + 1, updatedAt: new Date(at.getTime() + 1000) });
                    if (fail === 'unlink') throw new Error('PRIVATE_SQL');
                },
                async deleteTask(id) { trace.push('delete'); if (fail === 'delete') throw new Error('PRIVATE_SQL'); if (fail === 'missing-delete') return false; return state.tasks.delete(id); },
                async listNotes(student, deletedOnly) { return [...state.notes.values()].filter(row => row.paperId === paperId &&
                    (deletedOnly ? Boolean(row.deletedAt) && row.createdBy === student : !row.deletedAt)); },
                async note(id) { return scoped(state.notes.get(id)); },
                async createNote(data) { trace.push('createNote'); const row = { ...noteRow(30), ...data }; state.notes.set(30, row); return row; },
                patchNote,
            };
            try {
                const output = await work(tx);
                if (fail === 'commit') throw new Error('PRIVATE_COMMIT');
                trace.push('commit'); return output;
            } catch (error) { Object.assign(state, before); trace.push('rollback'); throw error; }
        });
        queue = result.catch(() => {}); return result;
    } };
    const service = createCollaborativeWorkspaceService({ repository, session: async () => signedIn
        ? { userId: actorId, roleId: sessionRole, email: 'synthetic@example.invalid' } : null });
    return { state, service, trace, actor(id, role = 3) { actorId = id; sessionRole = role; }, signOut() { signedIn = false; }, fail(value) { fail = value; } };
}
const expectKind = (result, kind) => { assert.equal(result.kind, kind); assert.equal(result.success, kind === 'success'); return result; };

test('schema defines only two new project-scoped tables, restrictive composite FK, bounded text and intended indexes', () => {
    const tasks = getTableConfig(schema.groupTasks), notes = getTableConfig(schema.taskNotes);
    assert.equal(tasks.name, 'group_tasks'); assert.equal(notes.name, 'task_notes');
    assert.equal(tasks.columns.find(c => c.name === 'id').getSQLType(), 'serial');
    assert.equal(tasks.columns.find(c => c.name === 'title').getSQLType(), 'varchar(200)');
    assert.equal(tasks.columns.find(c => c.name === 'due_date').getSQLType(), 'date');
    for (const table of [tasks, notes]) for (const name of ['paper_id', 'title', 'created_by', 'created_at', 'updated_at'])
        assert.equal(table.columns.find(c => c.name === name).notNull, true);
    assert.equal(notes.columns.find(c => c.name === 'content').notNull, true);
    assert.equal(notes.columns.find(c => c.name === 'task_id').notNull, false);
    assert.equal(notes.columns.find(c => c.name === 'version').default, 1);
    for (const table of [tasks, notes]) for (const name of ['created_at', 'updated_at'])
        assert.equal(table.columns.find(c => c.name === name).withTimezone, true);
    assert.deepEqual(tasks.uniqueConstraints.map(c => c.columns.map(col => col.name)), [['id', 'paper_id']]);
    const composite = notes.foreignKeys.find(fk => fk.reference().columns.length === 2);
    assert.deepEqual(composite.reference().columns.map(c => c.name), ['task_id', 'paper_id']);
    assert.deepEqual(composite.reference().foreignColumns.map(c => c.name), ['id', 'paper_id']);
    assert.equal(composite.reference().foreignTable, schema.groupTasks);
    for (const fk of [...tasks.foreignKeys, ...notes.foreignKeys]) assert.equal(fk.onDelete, 'restrict');
    assert.deepEqual(tasks.indexes.map(i => i.config.columns.map(c => c.name)), [['paper_id', 'created_at', 'id']]);
    assert.deepEqual(notes.indexes.map(i => i.config.columns.map(c => c.name)), [['paper_id', 'updated_at', 'id'], ['task_id', 'paper_id']]);
    const dialect = new PgDialect(), checks = [...tasks.checks, ...notes.checks].map(c => dialect.sqlToQuery(c.value).sql).join('\n');
    assert.match(checks, /5000/); assert.match(checks, /20000/); assert.match(checks, /"version" > 0/);
    assert.match(checks, /'To Do', 'In Progress', 'Done'/); assert.match(checks, /\[\^\[:space:\]\]/);
});

test('validation rejects identity injection, oversized/blank fields, invalid IDs/status/dates and missing expected version', () => {
    assert.equal(inputs.workspaceCreateTaskSchema.safeParse({ paperId: 100, title: 'ok' }).success, true);
    const invalidTasks = [
        { paperId: '100', title: 'ok' }, { paperId: 2147483648, title: 'ok' }, { paperId: 100, title: ' \n ' },
        { paperId: 100, title: 'x'.repeat(201) }, { paperId: 100, title: 'ok', description: 'x'.repeat(5001) },
        { paperId: 100, title: 'ok', dueDate: '2026-02-30' }, { paperId: 100, title: 'ok', createdBy: 99 },
        { paperId: 100, title: 'ok', groupId: 50 }, { paperId: 100, title: 'ok', assignedStudentId: 0 },
    ];
    for (const raw of invalidTasks) assert.equal(inputs.workspaceCreateTaskSchema.safeParse(raw).success, false);
    for (const content of ['', ' \n ', 'x'.repeat(20001)]) assert.equal(inputs.workspaceCreateNoteSchema.safeParse({ paperId: 100, title: 'ok', content }).success, false);
    assert.equal(inputs.workspaceTaskStatusSchema.safeParse({ paperId: 100, taskId: 10, status: 'Approved' }).success, false);
    assert.equal(inputs.workspaceNoteVersionSchema.safeParse({ paperId: 100, noteId: 20 }).success, false);
});

test('same-group students list/create scoped tasks and notes; actor attribution and plain text are server-controlled', async () => {
    const f = fixture();
    assert.deepEqual((await f.service.listTasks({ paperId: 100 })).data.map(row => row.id), [10]);
    const task = expectKind(await f.service.createTask({ paperId: 100, title: ' New ', assignedStudentId: 2 }), 'success');
    assert.equal(task.data.createdBy, 1); assert.equal(task.data.title, 'New'); assert.equal(task.data.status, 'To Do');
    f.actor(2);
    const note = expectKind(await f.service.createNote({ paperId: 100, title: 'Note', content: '<script>plain text</script>', taskId: null }), 'success');
    assert.equal(note.data.createdBy, 2); assert.equal(note.data.taskId, null); assert.equal(note.data.content, '<script>plain text</script>');
    assert.equal(typeof note.data.updatedAt, 'string');
    assert.ok((await f.service.listTasks({ paperId: 100 })).data.some(row => row.id === task.data.id));
    assert.equal(JSON.stringify(note).includes('synthetic@example.invalid'), false);
});

test('every operation independently rejects anonymous, foreign-group, inactive, removed, changed-role and archived-group access', async () => {
    const calls = s => [
        () => s.listTasks({ paperId: 100 }), () => s.createTask({ paperId: 100, title: 'x' }),
        () => s.editTask({ paperId: 100, taskId: 10, title: 'x', description: null, dueDate: null }),
        () => s.assignTask({ paperId: 100, taskId: 10, assignedStudentId: null }),
        () => s.updateTaskStatus({ paperId: 100, taskId: 10, status: 'Done' }), () => s.deleteTask({ paperId: 100, taskId: 10 }),
        () => s.listNotes({ paperId: 100 }), () => s.getNote({ paperId: 100, noteId: 20 }),
        () => s.createNote({ paperId: 100, title: 'x', content: 'x' }),
        () => s.editNote({ paperId: 100, noteId: 20, expectedVersion: 1, title: 'x', content: 'x' }),
        () => s.linkNote({ paperId: 100, noteId: 20, expectedVersion: 1, taskId: null }),
        () => s.deleteNote({ paperId: 100, noteId: 20, expectedVersion: 1 }),
        () => s.restoreNote({ paperId: 100, noteId: 22, expectedVersion: 1 }),
    ];
    for (const deny of [f => f.signOut(), f => f.actor(4), f => f.actor(1, 2), f => f.state.accounts.get(1).isActive = false,
        f => f.state.accounts.get(1).roleId = 1, f => f.state.members.set(50, [2, 3]), f => f.state.groups.get(50).status = 'archived']) {
        const f = fixture(), before = structuredClone(f.state); deny(f);
        for (const call of calls(f.service)) expectKind(await call(), 'unavailable');
        assert.deepEqual(f.state.tasks, before.tasks); assert.deepEqual(f.state.notes, before.notes);
    }
    const f = fixture();
    expectKind(await f.service.listTasks({ paperId: 100 }), 'success');
    f.state.members.set(50, [2, 3]);
    expectKind(await f.service.listTasks({ paperId: 100 }), 'unavailable');
    expectKind(await f.service.createTask({ paperId: 100, title: 'x', userId: 2 }), 'validation');
});

test('assignment requires an active current same-group Student and allows null', async () => {
    for (const target of [4, 5, 99]) {
        const f = fixture();
        expectKind(await f.service.createTask({ paperId: 100, title: 'x', assignedStudentId: target }), 'unavailable');
        expectKind(await f.service.assignTask({ paperId: 100, taskId: 10, assignedStudentId: target }), 'unavailable');
    }
    for (const change of [u => u.isActive = false, u => u.roleId = 2]) {
        const f = fixture(); change(f.state.accounts.get(2));
        expectKind(await f.service.assignTask({ paperId: 100, taskId: 10, assignedStudentId: 2 }), 'unavailable');
    }
    const f = fixture();
    assert.equal(expectKind(await f.service.assignTask({ paperId: 100, taskId: 10, assignedStudentId: null }), 'success').data.assignedStudentId, null);
});

test('creator alone edits/deletes; eligible assignee may change status but other members cannot', async () => {
    const f = fixture(); f.actor(2);
    expectKind(await f.service.updateTaskStatus({ paperId: 100, taskId: 10, status: 'In Progress' }), 'success');
    expectKind(await f.service.editTask({ paperId: 100, taskId: 10, title: 'x', description: null, dueDate: null }), 'unavailable');
    expectKind(await f.service.deleteTask({ paperId: 100, taskId: 10 }), 'unavailable');
    expectKind(await f.service.assignTask({ paperId: 100, taskId: 10, assignedStudentId: 3 }), 'unavailable');
    f.actor(3); expectKind(await f.service.updateTaskStatus({ paperId: 100, taskId: 10, status: 'Done' }), 'unavailable');
    f.actor(1); expectKind(await f.service.editTask({ paperId: 100, taskId: 10, title: 'Updated', description: 'Detail', dueDate: '2026-11-06' }), 'success');
    expectKind(await f.service.updateTaskStatus({ paperId: 100, taskId: 10, status: 'Done' }), 'success');
});

test('orphan recovery permits only reassign/unassign after creator removal, inactivity or role change; recovery is recomputed', async () => {
    for (const orphan of [f => f.state.members.set(50, [2, 3]), f => f.state.accounts.get(1).isActive = false, f => f.state.accounts.get(1).roleId = 2]) {
        const f = fixture(); f.actor(3); orphan(f);
        expectKind(await f.service.assignTask({ paperId: 100, taskId: 10, assignedStudentId: 2 }), 'success');
        expectKind(await f.service.assignTask({ paperId: 100, taskId: 10, assignedStudentId: null }), 'success');
        expectKind(await f.service.editTask({ paperId: 100, taskId: 10, title: 'x', description: null, dueDate: null }), 'unavailable');
        expectKind(await f.service.deleteTask({ paperId: 100, taskId: 10 }), 'unavailable');
        expectKind(await f.service.updateTaskStatus({ paperId: 100, taskId: 10, status: 'Done' }), 'unavailable');
        Object.assign(f.state.accounts.get(1), { isActive: true, roleId: 3 }); f.state.members.set(50, [1, 2, 3]);
        expectKind(await f.service.assignTask({ paperId: 100, taskId: 10, assignedStudentId: 2 }), 'unavailable');
    }
    const f = fixture(); f.state.members.set(50, [1, 3]);
    assert.equal((await f.service.listTasks({ paperId: 100 })).data[0].assignedStudentId, 2);
    f.actor(2); expectKind(await f.service.updateTaskStatus({ paperId: 100, taskId: 10, status: 'Done' }), 'unavailable');
});

test('cross-project IDs and note/task associations fail even between two authorized papers in one group', async () => {
    const f = fixture();
    expectKind(await f.service.deleteTask({ paperId: 100, taskId: 11 }), 'unavailable');
    expectKind(await f.service.updateTaskStatus({ paperId: 100, taskId: 12, status: 'Done' }), 'unavailable');
    expectKind(await f.service.getNote({ paperId: 100, noteId: 23 }), 'unavailable');
    expectKind(await f.service.editNote({ paperId: 100, noteId: 23, expectedVersion: 1, title: 'x', content: 'x' }), 'unavailable');
    expectKind(await f.service.createNote({ paperId: 100, title: 'x', content: 'x', taskId: 11 }), 'unavailable');
    expectKind(await f.service.linkNote({ paperId: 100, noteId: 20, expectedVersion: 1, taskId: 11 }), 'unavailable');
    expectKind(await f.service.createNote({ paperId: 100, title: 'x', content: 'x', taskId: 10 }), 'success');
});

test('note ownership, atomic versioning and controlled conflicts preserve unsaved content', async () => {
    const f = fixture();
    for (const method of ['editNote', 'linkNote', 'deleteNote', 'restoreNote']) {
        const raw = { paperId: 100, noteId: 21, expectedVersion: 1,
            ...(method === 'editNote' ? { title: 'x', content: 'x' } : method === 'linkNote' ? { taskId: null } : {}) };
        expectKind(await f.service[method](raw), 'unavailable');
    }
    const results = await Promise.all(['First', 'Second'].map(content => f.service.editNote({ paperId: 100, noteId: 20, expectedVersion: 1, title: 'Title', content })));
    assert.deepEqual(results.map(r => r.kind), ['success', 'conflict']);
    assert.equal(f.state.notes.get(20).content, 'First'); assert.equal(f.state.notes.get(20).version, 2);
    expectKind(await f.service.editNote({ paperId: 100, noteId: 999, expectedVersion: 1, title: 'x', content: 'x' }), 'unavailable');
    const linked = expectKind(await f.service.linkNote({ paperId: 100, noteId: 20, expectedVersion: 2, taskId: null }), 'success');
    assert.equal(linked.data.version, 3); assert.equal(linked.data.taskId, null);
    f.fail('no-note-update');
    expectKind(await f.service.editNote({ paperId: 100, noteId: 20, expectedVersion: 3, title: 'x', content: 'x' }), 'unavailable');
});

test('soft deletion/restoration requires ownership, correct state and expected version; trash is creator-only', async () => {
    const f = fixture();
    expectKind(await f.service.deleteNote({ paperId: 100, noteId: 20, expectedVersion: 9 }), 'conflict');
    assert.equal(expectKind(await f.service.deleteNote({ paperId: 100, noteId: 20, expectedVersion: 1 }), 'success').data.version, 2);
    assert.equal((await f.service.listNotes({ paperId: 100 })).data.some(n => n.id === 20), false);
    expectKind(await f.service.editNote({ paperId: 100, noteId: 20, expectedVersion: 1, title: 'x', content: 'x' }), 'unavailable');
    assert.deepEqual((await f.service.listNotes({ paperId: 100, deletedOnly: true })).data.map(n => n.id), [20, 22]);
    f.actor(2);
    assert.deepEqual((await f.service.listNotes({ paperId: 100, deletedOnly: true })).data, []);
    expectKind(await f.service.getNote({ paperId: 100, noteId: 20 }), 'unavailable');
    expectKind(await f.service.restoreNote({ paperId: 100, noteId: 20, expectedVersion: 2 }), 'unavailable');
    f.actor(1); expectKind(await f.service.getNote({ paperId: 100, noteId: 20 }), 'success');
    expectKind(await f.service.restoreNote({ paperId: 100, noteId: 20, expectedVersion: 1 }), 'conflict');
    const restored = expectKind(await f.service.restoreNote({ paperId: 100, noteId: 20, expectedVersion: 2 }), 'success');
    assert.equal(restored.data.deletedAt, null); assert.equal(restored.data.version, 3); assert.equal(restored.data.content, 'Plain text');
});

test('task deletion unlinks every associated note, advances versions, preserves author/content/deletion state and invalidates old saves', async () => {
    const f = fixture(), before = structuredClone(f.state.notes);
    expectKind(await f.service.deleteTask({ paperId: 100, taskId: 10 }), 'success');
    assert.deepEqual(f.trace.slice(-4), ['begin', 'unlink', 'delete', 'commit']);
    assert.equal(f.state.tasks.has(10), false);
    for (const id of [20, 21, 22]) {
        const row = f.state.notes.get(id), old = before.get(id);
        assert.equal(row.taskId, null); assert.equal(row.version, 2);
        assert.equal(row.content, old.content); assert.equal(row.createdBy, old.createdBy); assert.deepEqual(row.deletedAt, old.deletedAt);
    }
    assert.deepEqual(f.state.notes.get(23), before.get(23));
    expectKind(await f.service.editNote({ paperId: 100, noteId: 20, expectedVersion: 1, title: 'x', content: 'x' }), 'conflict');
});

test('transaction model rolls back task and note changes on unlink/delete failure or a missing deletion result', async () => {
    for (const failure of ['unlink', 'delete', 'missing-delete']) {
        const f = fixture(), before = structuredClone(f.state); f.fail(failure);
        const result = expectKind(await f.service.deleteTask({ paperId: 100, taskId: 10 }), 'infrastructure');
        assert.deepEqual(f.state, before); assert.equal(f.trace.at(-1), 'rollback'); assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
    }
    const f = fixture(); f.fail('commit');
    expectKind(await f.service.createTask({ paperId: 100, title: 'x' }), 'infrastructure');
});

function sqlFixture({ failDelete = false, noteUpdate = true, paperGroup = 50, taskCreator = 3 } = {}) {
    const queries = [], events = [], encode = (table, row) => getTableConfig(table).columns.map(c => {
        const value = row[Object.keys(table).find(k => table[k] === c)];
        return value instanceof Date ? value.toISOString() : value;
    });
    const db = drizzle(async (query, params) => {
        queries.push({ query, params });
        if (query.startsWith('select')) {
            if (query.includes('from "users"')) return { rows: [...new Set(params)].sort((a, b) => a - b).map(id => [id, 3, true]) };
            if (query.includes('from "research_groups"')) return { rows: [[50, 'active']] };
            if (query.includes('from "group_members"')) return { rows: [[1], [2], [3]] };
            if (query.includes('from "research_papers"')) return { rows: [query.includes('for share') ? [100, paperGroup] : [50]] };
            if (query.includes('from "group_tasks"')) return { rows: query.includes('select "created_by"') ? [[3]] : [encode(schema.groupTasks, { ...taskRow(), createdBy: taskCreator })] };
            if (query.includes('from "task_notes"')) return { rows: [encode(schema.taskNotes, noteRow())] };
        }
        if (query.startsWith('update "task_notes"') && query.includes('returning'))
            return { rows: noteUpdate ? [encode(schema.taskNotes, { ...noteRow(), content: 'Changed', version: 2 })] : [] };
        if (query.startsWith('insert into "group_tasks"') || query.startsWith('update "group_tasks"')) return { rows: [encode(schema.groupTasks, taskRow())] };
        if (query.startsWith('insert into "task_notes"')) return { rows: [encode(schema.taskNotes, noteRow())] };
        if (query.startsWith('delete from "group_tasks"')) {
            if (failDelete) throw new Error('synthetic delete failure');
            return { rows: [[10]] };
        }
        return { rows: [] };
    }, { schema });
    db.transaction = async work => {
        events.push('begin');
        try { const value = await work(db); events.push('commit'); return value; }
        catch (error) { events.push('rollback'); throw error; }
    };
    return { repository: createCollaborativeWorkspaceRepository(db), queries, events };
}

test('real Drizzle SQL locks sorted actor/creator/assignee accounts before group/membership/paper/task and new links', async () => {
    const f = sqlFixture();
    await f.repository.withScope(2, 100, 'write', { taskId: 10, assignedStudentId: 1 }, async tx => {
        assert.equal(tx.scope.task.createdBy, 3); assert.equal(tx.scope.group.id, 50);
    });
    const account = f.queries.find(q => q.query.includes('from "users"'));
    assert.deepEqual(account.params, [1, 2, 3]); assert.match(account.query, /order by "users"\."id" asc for update/);
    const locks = f.queries.filter(q => /for (update|share)/.test(q.query)).map(q => q.query.match(/from "(\w+)"/)[1]);
    assert.deepEqual(locks, ['users', 'research_groups', 'group_members', 'research_papers', 'group_tasks']);
    assert.match(f.queries.find(q => q.query.includes('from "group_members"')).query, /for share/);
    assert.match(f.queries[0].query, /lock_timeout/); assert.match(f.queries[1].query, /statement_timeout/);
    assert.deepEqual(f.events, ['begin', 'commit']);
    const link = sqlFixture();
    await link.repository.withScope(1, 100, 'write', { linkTaskId: 10 }, tx => tx.patchNote(20, 1, 1, false, { taskId: 10 }));
    const taskLock = link.queries.findIndex(q => q.query.includes('from "group_tasks"') && q.query.includes('for share'));
    assert.ok(taskLock >= 0 && taskLock < link.queries.findIndex(q => q.query.startsWith('update "task_notes"')));
});

test('real Drizzle note CAS includes scope, creator, expected version, deletion state, SQL increment and returning', async () => {
    const f = sqlFixture();
    await f.repository.withScope(1, 100, 'write', {}, async tx => {
        const row = await tx.patchNote(20, 1, 1, false, { content: 'Changed' }); assert.equal(row.version, 2);
        await tx.patchNote(20, 1, 2, false, { deleted: true });
        await tx.patchNote(20, 1, 3, true, { deleted: false });
    });
    const updates = f.queries.filter(q => q.query.startsWith('update "task_notes"'));
    for (const { query, params } of updates) {
        assert.match(query, /"version" = "task_notes"\."version" \+ 1/); assert.match(query, /"updated_at" = clock_timestamp\(\)/);
        for (const name of ['id', 'paper_id', 'created_by', 'version']) assert.match(query, new RegExp('"task_notes"\\."' + name + '" = \\$'));
        assert.ok(params.includes(100)); assert.ok(params.includes(20)); assert.match(query, /returning/);
    }
    assert.match(updates[0].query, /"deleted_at" is null/);
    assert.match(updates[1].query, /"deleted_at" = clock_timestamp\(\)/);
    assert.match(updates[2].query, /"deleted_at" is not null/); assert.ok(updates[2].params.includes(null));
    const zero = sqlFixture({ noteUpdate: false });
    await zero.repository.withScope(1, 100, 'write', {}, async tx => assert.equal(await tx.patchNote(20, 1, 1, false, { content: 'x' }), undefined));
});

test('authorization rejects changed paper/creator hints before a mutation, using locked current scope', async () => {
    for (const change of [{ paperGroup: 60 }, { taskCreator: 4 }]) {
        const f = sqlFixture(change);
        const service = createCollaborativeWorkspaceService({ repository: f.repository,
            session: async () => ({ userId: 3, roleId: 3, email: 'synthetic@example.invalid' }) });
        expectKind(await service.editTask({ paperId: 100, taskId: 10, title: 'x', description: null, dueDate: null }), 'unavailable');
        assert.equal(f.queries.some(q => /^(update|delete|insert)/.test(q.query)), false);
    }
});

test('real Drizzle create/patch SQL persists only workspace fields and scopes task updates by paper', async () => {
    const f = sqlFixture();
    await f.repository.withScope(1, 100, 'write', { linkTaskId: 10 }, async tx => {
        const task = await tx.createTask({ paperId: 100, title: 'New task', description: null, dueDate: '2026-11-06', assignedStudentId: null, createdBy: 1 });
        assert.equal(task.paperId, 100);
        await tx.patchTask(10, { title: 'Changed', description: 'Details', dueDate: null });
        await tx.patchTask(10, { assignedStudentId: 2 }); await tx.patchTask(10, { status: 'Done' });
        await tx.createNote({ paperId: 100, title: 'New note', content: 'Text', taskId: 10, createdBy: 1 });
    });
    const updates = f.queries.filter(q => q.query.startsWith('update "group_tasks"'));
    for (const q of updates) {
        assert.match(q.query, /"group_tasks"\."id" = \$/); assert.match(q.query, /"group_tasks"\."paper_id" = \$/);
        assert.doesNotMatch(q.query.split(' where ')[0], /"paper_id" =|"created_by" =/);
        assert.ok(q.params.includes(100)); assert.match(q.query, /returning/);
    }
    assert.ok(f.queries.some(q => q.query.startsWith('insert into "task_notes"')));
});

test('real Drizzle task deletion SQL unlinks all notes before delete; failure propagates to transaction rollback', async () => {
    for (const failDelete of [false, true]) {
        const f = sqlFixture({ failDelete });
        const operation = f.repository.withScope(1, 100, 'write', { taskId: 10 }, async tx => { await tx.unlinkTaskNotes(10); return tx.deleteTask(10); });
        if (failDelete) await assert.rejects(operation); else assert.equal(await operation, true);
        assert.deepEqual(f.events, ['begin', failDelete ? 'rollback' : 'commit']);
        const unlink = f.queries.find(q => q.query.startsWith('update "task_notes"'));
        assert.match(unlink.query, /"task_id" = \$/); assert.ok(unlink.params.includes(null));
        assert.match(unlink.query, /"version" = "task_notes"\."version" \+ 1/);
        assert.doesNotMatch(unlink.query, /deleted_at|content|created_by/);
        assert.ok(f.queries.indexOf(unlink) < f.queries.findIndex(q => q.query.startsWith('delete from "group_tasks"')));
        for (const q of f.queries) assert.doesNotMatch(q.query, /\b(submissions|feedbacks|repositories|notifications|push_subscriptions)\b/);
    }
});

test('real Drizzle note reads enforce project scope, visible-only ordinary lists and creator-only deleted lists', async () => {
    const f = sqlFixture();
    await f.repository.withScope(1, 100, 'read', {}, async tx => { await tx.listNotes(1, false); await tx.listNotes(1, true); await tx.note(20); });
    const reads = f.queries.filter(q => q.query.includes('from "task_notes"'));
    assert.match(reads[0].query, /"deleted_at" is null/);
    assert.match(reads[1].query, /"deleted_at" is not null/); assert.match(reads[1].query, /"created_by" = \$/); assert.ok(reads[1].params.includes(1));
    for (const q of reads) { assert.match(q.query, /"paper_id" = \$/); assert.ok(q.params.includes(100)); }
});

test('Server Actions preserve structured failures and saved results when revalidation fails; only workspace is invalidated', async () => {
    const calls = [], paths = []; let refreshFails = false, outcome = { success: true, kind: 'success', data: { id: 10 }, message: 'Saved' };
    const source = ts.transpileModule(readFileSync('lib/actions/collaborative-workspace.action.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const exported = {}, runtime = new Proxy({}, { get: (_target, operation) => async raw => { calls.push({ operation, raw }); return outcome; } });
    vm.runInNewContext(source, { exports: exported, require(id) {
        if (id === 'next/cache') return { revalidatePath(path) { paths.push(path); if (refreshFails) throw new Error('private'); } };
        if (id === '@/lib/services/collaborative-workspace.runtime') return { collaborativeWorkspace: runtime };
        throw new Error('Unexpected action dependency: ' + id);
    } });
    const raw = { paperId: 100, title: 'x' };
    assert.equal((await exported.createWorkspaceTaskAction(raw)).success, true);
    assert.deepEqual(calls[0], { operation: 'createTask', raw }); assert.deepEqual(paths, ['/dashboard/student/workspace']);
    await exported.listWorkspaceTasksAction({ paperId: 100 }); assert.equal(paths.length, 1);
    outcome = { success: false, kind: 'conflict', message: 'Conflict' };
    assert.equal((await exported.editWorkspaceNoteAction({})).kind, 'conflict'); assert.equal(paths.length, 1);
    refreshFails = true; outcome = { success: true, kind: 'success', data: { id: 10 }, message: 'Saved' };
    const saved = await exported.deleteWorkspaceTaskAction({ paperId: 100, taskId: 10 });
    assert.equal(saved.success, true); assert.equal(saved.refreshRequired, true); assert.equal(saved.data.id, 10);
});

test('migration history stays at 0015 with exact pin; workspace has no provider or academic mutation imports', () => {
    const source = previewMigrationSource(); assert.equal(source.migrations.length, 16);
    const ledger = source.migrations.map(m => ({ hash: m.hash, created_at: String(m.folderMillis) }));
    assert.doesNotThrow(() => verifyPreviewLedger(ledger));
    assert.throws(() => verifyPreviewLedger([...ledger, { hash: 'invented', created_at: '0' }]));
    assert.throws(() => verifyPreviewLedger(ledger.map((r, i) => i ? r : { ...r, hash: 'tampered' })));
    for (const path of ['lib/services/collaborative-workspace.service.ts', 'lib/services/collaborative-workspace.runtime.ts', 'lib/actions/collaborative-workspace.action.ts']) {
        const code = readFileSync(path, 'utf8');
        assert.doesNotMatch(code, /from ["'][^"']*(push|notification|submission|feedback|publication|groq|supabase)/);
        assert.doesNotMatch(code, /\b(fetch|WebSocket)\(/);
    }
});
