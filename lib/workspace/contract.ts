import type { groupTasks } from "@/db/schema/group-task";
import type { taskNotes } from "@/db/schema/task-note";

export type TaskRow = typeof groupTasks.$inferSelect;
export type NoteRow = typeof taskNotes.$inferSelect;
export type TaskData = Omit<TaskRow, "createdAt" | "updatedAt"> & { createdAt: string; updatedAt: string };
export type NoteData = Omit<NoteRow, "createdAt" | "updatedAt" | "deletedAt"> & { createdAt: string; updatedAt: string; deletedAt: string | null };
export type TaskBoardMember = { id: number; name: string };
export type TaskBoardTask = TaskData & {
    creator: { name: string; eligible: boolean };
    assignee: { name: string; eligible: boolean } | null;
    permissions: { edit: boolean; assign: boolean; status: boolean; delete: boolean; recovery: boolean };
};
export type TaskBoard = { tasks: TaskBoardTask[]; members: TaskBoardMember[] };
export type NotesBoardNote = NoteData & {
    creatorName: string;
    linkedTask: { id: number; title: string } | null;
    permissions: { edit: boolean; link: boolean; delete: boolean; restore: boolean };
};
export type NotesBoard = { notes: NotesBoardNote[]; tasks: { id: number; title: string }[] };
export type WorkspaceContext = { studentId: number; groupId: number; paperId: number };
export type WorkspaceResult<T> =
    | { success: true; kind: "success"; message: string; data: T; refreshRequired?: boolean }
    | { success: false; kind: "validation" | "unavailable" | "conflict" | "infrastructure"; message: string };
export type WorkspaceAccount = { id: number; roleId: number; isActive: boolean };
export type WorkspaceScope = {
    accounts: WorkspaceAccount[];
    group?: { id: number; status: string };
    paper?: { id: number; groupId: number };
    members: { userId: number }[];
    task?: TaskRow;
    linkedTask?: TaskRow;
};
export type WorkspaceSelection = { taskId?: number; assignedStudentId?: number | null; linkTaskId?: number | null };
export type TaskInsert = Pick<TaskRow, "paperId" | "title" | "description" | "dueDate" | "assignedStudentId" | "createdBy">;
export type TaskPatch = Partial<Pick<TaskRow, "title" | "description" | "dueDate" | "assignedStudentId" | "status">>;
export type NoteInsert = Pick<NoteRow, "paperId" | "title" | "content" | "taskId" | "createdBy">;
export type NotePatch = Partial<Pick<NoteRow, "title" | "content" | "taskId">> & { deleted?: boolean };

// Every operation runs within its authorized transaction. No network/provider work belongs here.
export interface WorkspaceTransaction {
    scope: WorkspaceScope;
    listTasks(): Promise<TaskRow[]>;
    taskDirectory(peopleIds: number[]): Promise<{ members: TaskBoardMember[]; people: TaskBoardMember[] }>;
    createTask(data: TaskInsert): Promise<TaskRow>;
    patchTask(id: number, data: TaskPatch): Promise<TaskRow | undefined>;
    unlinkTaskNotes(id: number): Promise<void>;
    deleteTask(id: number): Promise<boolean>;
    listNotes(studentId: number, deletedOnly: boolean): Promise<NoteRow[]>;
    note(id: number): Promise<NoteRow | undefined>;
    createNote(data: NoteInsert): Promise<NoteRow>;
    patchNote(id: number, creatorId: number, version: number, deleted: boolean, data: NotePatch): Promise<NoteRow | undefined>;
}
export interface WorkspaceRepository {
    withScope<T>(studentId: number, paperId: number, mode: "read" | "write", selection: WorkspaceSelection,
        operation: (tx: WorkspaceTransaction) => Promise<T>): Promise<T>;
}
