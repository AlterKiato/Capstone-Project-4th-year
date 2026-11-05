import "server-only";
import type { z } from "zod";
import { ROLE_IDS } from "@/lib/auth/roles";
import type { AuthTokenPayload } from "@/types/auth";
import * as inputs from "@/lib/validations/collaborative-workspace";
import type { NoteData, NotePatch, NoteRow, TaskData, TaskRow, WorkspaceContext, WorkspaceRepository, WorkspaceResult,
    WorkspaceScope, WorkspaceSelection, WorkspaceTransaction, TaskBoard, NotesBoard } from "@/lib/workspace/contract";

const unavailable = (): WorkspaceResult<never> => ({ success: false, kind: "unavailable", message: "This workspace resource is unavailable or you do not have permission." });
const success = <T>(data: T): WorkspaceResult<T> => ({ success: true, kind: "success", message: "Workspace request completed.", data });
const taskData = (row: TaskRow): TaskData => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() });
const noteData = (row: NoteRow): NoteData => ({ ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), deletedAt: row.deletedAt?.toISOString() ?? null });

function eligibleStudent(scope: WorkspaceScope, userId: number) {
    return scope.accounts.some(user => user.id === userId && user.isActive && user.roleId === ROLE_IDS.STUDENT)
        && scope.members.some(member => member.userId === userId);
}

/** Claims must come from getSession's JWT verifier, never action/form input. Scope is read in the same transaction. */
export function authorizeStudentWorkspace(session: AuthTokenPayload, paperId: number, scope: WorkspaceScope): WorkspaceContext | null {
    if (session.roleId !== ROLE_IDS.STUDENT || !eligibleStudent(scope, session.userId) || scope.group?.status !== "active"
        || scope.paper?.id !== paperId || scope.paper.groupId !== scope.group.id) return null;
    return { studentId: session.userId, groupId: scope.group.id, paperId };
}

export function createCollaborativeWorkspaceService(deps: { session(): Promise<AuthTokenPayload | null>; repository: WorkspaceRepository }) {
    // One authorization path for every read and write; there is no caller-supplied actor/group identity.
    async function run<I extends { paperId: number }, T>(schema: z.ZodType<I>, raw: unknown, mode: "read" | "write",
        selection: (input: I) => WorkspaceSelection,
        operation: (input: I, context: WorkspaceContext, tx: WorkspaceTransaction) => Promise<WorkspaceResult<T>>): Promise<WorkspaceResult<T>> {
        const parsed = schema.safeParse(raw);
        if (!parsed.success) return { success: false, kind: "validation", message: "Check the workspace fields and length limits." };
        try {
            const session = await deps.session();
            if (!session || session.roleId !== ROLE_IDS.STUDENT || !Number.isInteger(session.userId) || session.userId <= 0 || session.userId > 2147483647)
                return unavailable();
            return await deps.repository.withScope(session.userId, parsed.data.paperId, mode, selection(parsed.data), async tx => {
                const context = authorizeStudentWorkspace(session, parsed.data.paperId, tx.scope);
                return context ? operation(parsed.data, context, tx) : unavailable();
            });
        } catch {
            // Driver/commit failures can be uncertain. Do not expose SQL or encourage blind retries.
            return { success: false, kind: "infrastructure", message: "The workspace request could not be confirmed. Reload and verify before retrying." };
        }
    }

    async function changeNote(input: { noteId: number; expectedVersion: number }, context: WorkspaceContext, tx: WorkspaceTransaction,
        deleted: boolean, patch: NotePatch): Promise<WorkspaceResult<NoteData>> {
        const row = await tx.patchNote(input.noteId, context.studentId, input.expectedVersion, deleted, patch);
        if (row) return success(noteData(row));
        // Zero rows can mean missing, foreign ownership, deletion-state change, or a stale version.
        const current = await tx.note(input.noteId);
        if (!current || current.createdBy !== context.studentId || Boolean(current.deletedAt) !== deleted) return unavailable();
        return current.version !== input.expectedVersion
            ? { success: false, kind: "conflict", message: "This note changed since you loaded it. Keep your draft and reload the latest note before saving." }
            : unavailable();
    }

    return {
        taskBoard(raw: unknown) {
            return run(inputs.workspaceProjectSchema, raw, "read", () => ({}), async (_input, context, tx): Promise<WorkspaceResult<TaskBoard>> => {
                const tasks = await tx.listTasks();
                const directory = await tx.taskDirectory(tasks.flatMap(task => [task.createdBy, ...(task.assignedStudentId === null ? [] : [task.assignedStudentId])]));
                const eligible = new Set(directory.members.map(member => member.id));
                const names = new Map([...directory.people, ...directory.members].map(member => [member.id, member.name]));
                return success({ members: directory.members, tasks: tasks.map(task => {
                    const own = task.createdBy === context.studentId, creatorEligible = eligible.has(task.createdBy);
                    return { ...taskData(task), creator: { name: names.get(task.createdBy) ?? "Former member", eligible: creatorEligible },
                        assignee: task.assignedStudentId === null ? null : { name: names.get(task.assignedStudentId) ?? "Former member", eligible: eligible.has(task.assignedStudentId) },
                        permissions: { edit: own, assign: own || !creatorEligible, status: own || task.assignedStudentId === context.studentId,
                            delete: own, recovery: !own && !creatorEligible } };
                }) });
            });
        },
        listTasks(raw: unknown) {
            return run(inputs.workspaceProjectSchema, raw, "read", () => ({}), async (_input, _context, tx) => success((await tx.listTasks()).map(taskData)));
        },
        createTask(raw: unknown) {
            return run(inputs.workspaceCreateTaskSchema, raw, "write", input => ({ assignedStudentId: input.assignedStudentId }), async (input, context, tx) => {
                if (input.assignedStudentId !== null && !eligibleStudent(tx.scope, input.assignedStudentId)) return unavailable();
                return success(taskData(await tx.createTask({ ...input, createdBy: context.studentId })));
            });
        },
        editTask(raw: unknown) {
            return run(inputs.workspaceEditTaskSchema, raw, "write", input => ({ taskId: input.taskId }), async (input, context, tx) => {
                if (tx.scope.task?.createdBy !== context.studentId) return unavailable();
                const row = await tx.patchTask(input.taskId, { title: input.title, description: input.description, dueDate: input.dueDate });
                return row ? success(taskData(row)) : unavailable();
            });
        },
        assignTask(raw: unknown) {
            return run(inputs.workspaceAssignmentSchema, raw, "write", input => ({ taskId: input.taskId, assignedStudentId: input.assignedStudentId }), async (input, context, tx) => {
                const task = tx.scope.task;
                if (!task || task.createdBy !== context.studentId && eligibleStudent(tx.scope, task.createdBy)) return unavailable();
                if (input.assignedStudentId !== null && !eligibleStudent(tx.scope, input.assignedStudentId)) return unavailable();
                const row = await tx.patchTask(input.taskId, { assignedStudentId: input.assignedStudentId });
                return row ? success(taskData(row)) : unavailable();
            });
        },
        updateTaskStatus(raw: unknown) {
            return run(inputs.workspaceTaskStatusSchema, raw, "write", input => ({ taskId: input.taskId }), async (input, context, tx) => {
                const task = tx.scope.task;
                if (!task || task.createdBy !== context.studentId && task.assignedStudentId !== context.studentId) return unavailable();
                const row = await tx.patchTask(input.taskId, { status: input.status });
                return row ? success(taskData(row)) : unavailable();
            });
        },
        deleteTask(raw: unknown) {
            return run(inputs.workspaceTaskSchema, raw, "write", input => ({ taskId: input.taskId }), async (input, context, tx) => {
                if (tx.scope.task?.createdBy !== context.studentId) return unavailable();
                await tx.unlinkTaskNotes(input.taskId);
                if (!await tx.deleteTask(input.taskId)) throw new Error("Task deletion unconfirmed.");
                return success({ id: input.taskId });
            });
        },
        notesBoard(raw: unknown) {
            return run(inputs.workspaceNotesSchema, raw, "read", () => ({}), async (input, context, tx): Promise<WorkspaceResult<NotesBoard>> => {
                const notes = await tx.listNotes(context.studentId, input.deletedOnly);
                const tasks = (await tx.listTasks()).map(({ id, title }) => ({ id, title }));
                const directory = await tx.taskDirectory(notes.map(note => note.createdBy));
                const names = new Map([...directory.people, ...directory.members].map(person => [person.id, person.name]));
                const linked = new Map(tasks.map(task => [task.id, task]));
                return success({ tasks, notes: notes.map(note => {
                    const own = note.createdBy === context.studentId, deleted = note.deletedAt !== null;
                    return { ...noteData(note), creatorName: names.get(note.createdBy) ?? "Former member",
                        linkedTask: note.taskId === null ? null : linked.get(note.taskId) ?? null,
                        permissions: { edit: own && !deleted, link: own && !deleted, delete: own && !deleted, restore: own && deleted } };
                }) });
            });
        },
        listNotes(raw: unknown) {
            return run(inputs.workspaceNotesSchema, raw, "read", () => ({}), async (input, context, tx) => success((await tx.listNotes(context.studentId, input.deletedOnly)).map(noteData)));
        },
        createNote(raw: unknown) {
            return run(inputs.workspaceCreateNoteSchema, raw, "write", input => ({ linkTaskId: input.taskId }), async (input, context, tx) => {
                if (input.taskId !== null && tx.scope.linkedTask?.id !== input.taskId) return unavailable();
                return success(noteData(await tx.createNote({ ...input, createdBy: context.studentId })));
            });
        },
        getNote(raw: unknown) {
            return run(inputs.workspaceNoteSchema, raw, "read", () => ({}), async (input, context, tx) => {
                const row = await tx.note(input.noteId);
                return row && (!row.deletedAt || row.createdBy === context.studentId) ? success(noteData(row)) : unavailable();
            });
        },
        editNote(raw: unknown) {
            return run(inputs.workspaceEditNoteSchema, raw, "write", () => ({}), (input, context, tx) => changeNote(input, context, tx, false, { title: input.title, content: input.content }));
        },
        linkNote(raw: unknown) {
            return run(inputs.workspaceNoteLinkSchema, raw, "write", input => ({ linkTaskId: input.taskId }), (input, context, tx) => {
                if (input.taskId !== null && tx.scope.linkedTask?.id !== input.taskId) return Promise.resolve(unavailable());
                return changeNote(input, context, tx, false, { taskId: input.taskId });
            });
        },
        deleteNote(raw: unknown) {
            return run(inputs.workspaceNoteVersionSchema, raw, "write", () => ({}), (input, context, tx) => changeNote(input, context, tx, false, { deleted: true }));
        },
        restoreNote(raw: unknown) {
            return run(inputs.workspaceNoteVersionSchema, raw, "write", () => ({}), (input, context, tx) => changeNote(input, context, tx, true, { deleted: false }));
        },
    };
}
