import { z } from "zod";

const id = z.number().int().positive().max(2147483647);
const title = z.string().trim().min(1).max(200);
const description = z.string().max(5000).nullable();
const dueDate = z.iso.date().nullable();
const content = z.string().min(1).max(20000).refine(value => value.trim().length > 0);
export const workspaceProjectSchema = z.object({ paperId: id }).strict();
export const workspaceTaskSchema = workspaceProjectSchema.extend({ taskId: id });
export const workspaceCreateTaskSchema = workspaceProjectSchema.extend({
    title, description: description.default(null), dueDate: dueDate.default(null), assignedStudentId: id.nullable().default(null),
});
export const workspaceEditTaskSchema = workspaceTaskSchema.extend({ title, description, dueDate });
export const workspaceAssignmentSchema = workspaceTaskSchema.extend({ assignedStudentId: id.nullable() });
export const workspaceTaskStatusSchema = workspaceTaskSchema.extend({ status: z.enum(["To Do", "In Progress", "Done"]) });
export const workspaceNoteSchema = workspaceProjectSchema.extend({ noteId: id });
export const workspaceNotesSchema = workspaceProjectSchema.extend({ deletedOnly: z.boolean().default(false) });
export const workspaceCreateNoteSchema = workspaceProjectSchema.extend({ title, content, taskId: id.nullable().default(null) });
export const workspaceNoteVersionSchema = workspaceNoteSchema.extend({ expectedVersion: id });
export const workspaceEditNoteSchema = workspaceNoteVersionSchema.extend({ title, content });
export const workspaceNoteLinkSchema = workspaceNoteVersionSchema.extend({ taskId: id.nullable() });
