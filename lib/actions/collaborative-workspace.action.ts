"use server";

import { revalidatePath } from "next/cache";
import { collaborativeWorkspace } from "@/lib/services/collaborative-workspace.runtime";
import type { WorkspaceResult } from "@/lib/workspace/contract";

async function refreshed<T>(operation: Promise<WorkspaceResult<T>>): Promise<WorkspaceResult<T>> {
    const result = await operation;
    if (!result.success) return result;
    try { revalidatePath("/dashboard/student/workspace"); }
    catch { return { ...result, refreshRequired: true, message: "Workspace saved. Reload to view the latest information." }; }
    return result;
}

export async function listWorkspaceTasksAction(input: unknown) { return collaborativeWorkspace.listTasks(input); }
export async function createWorkspaceTaskAction(input: unknown) { return refreshed(collaborativeWorkspace.createTask(input)); }
export async function editWorkspaceTaskAction(input: unknown) { return refreshed(collaborativeWorkspace.editTask(input)); }
export async function assignWorkspaceTaskAction(input: unknown) { return refreshed(collaborativeWorkspace.assignTask(input)); }
export async function updateWorkspaceTaskStatusAction(input: unknown) { return refreshed(collaborativeWorkspace.updateTaskStatus(input)); }
export async function deleteWorkspaceTaskAction(input: unknown) { return refreshed(collaborativeWorkspace.deleteTask(input)); }
export async function listWorkspaceNotesAction(input: unknown) { return collaborativeWorkspace.listNotes(input); }
export async function createWorkspaceNoteAction(input: unknown) { return refreshed(collaborativeWorkspace.createNote(input)); }
export async function getWorkspaceNoteAction(input: unknown) { return collaborativeWorkspace.getNote(input); }
export async function editWorkspaceNoteAction(input: unknown) { return refreshed(collaborativeWorkspace.editNote(input)); }
export async function linkWorkspaceNoteAction(input: unknown) { return refreshed(collaborativeWorkspace.linkNote(input)); }
export async function deleteWorkspaceNoteAction(input: unknown) { return refreshed(collaborativeWorkspace.deleteNote(input)); }
export async function restoreWorkspaceNoteAction(input: unknown) { return refreshed(collaborativeWorkspace.restoreNote(input)); }
