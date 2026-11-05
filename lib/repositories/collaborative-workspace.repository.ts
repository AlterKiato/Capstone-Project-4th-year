import "server-only";
import { and, asc, desc, eq, inArray, isNull, isNotNull, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import type { WorkspaceRepository, WorkspaceTransaction } from "@/lib/workspace/contract";
import { ROLE_IDS } from "@/lib/auth/roles";

type Database = PostgresJsDatabase<typeof schema>;
const { users, researchPapers, researchGroups, groupMembers, groupTasks: tasks, taskNotes: notes } = schema;

export function createCollaborativeWorkspaceRepository(database: Database): WorkspaceRepository {
    return {
        async withScope(studentId, paperId, mode, selection, operation) {
            return database.transaction(async tx => {
                await tx.execute(sql`set local lock_timeout = '3s'`);
                await tx.execute(sql`set local statement_timeout = '5s'`);
                // These are hints only. Recheck the paper and immutable task creator after locking.
                const [paperHint] = await tx.select({ groupId: researchPapers.groupId }).from(researchPapers).where(eq(researchPapers.id, paperId));
                const [taskHint] = selection.taskId === undefined ? [] : await tx.select({ createdBy: tasks.createdBy }).from(tasks)
                    .where(and(eq(tasks.id, selection.taskId), eq(tasks.paperId, paperId)));
                const accountIds = [...new Set([studentId, taskHint?.createdBy, selection.assignedStudentId]
                    .filter((id): id is number => id !== undefined && id !== null))].sort((a, b) => a - b);
                // Same ascending account order as Admin account changes. FOR UPDATE also conflicts
                // with the users FK KEY SHARE check of a concurrent membership insertion. This
                // protects an absent creator membership during orphan recovery, without a flag.
                const accounts = await tx.select({ id: users.id, roleId: users.roleId, isActive: users.isActive }).from(users)
                    .where(inArray(users.id, accountIds)).orderBy(asc(users.id)).for(mode === "write" ? "update" : "share");
                const [group] = paperHint ? await tx.select({ id: researchGroups.id, status: researchGroups.status }).from(researchGroups)
                    .where(eq(researchGroups.id, paperHint.groupId)).for("share") : [];
                const members = group ? await tx.select({ userId: groupMembers.userId }).from(groupMembers)
                    .where(and(eq(groupMembers.groupId, group.id), inArray(groupMembers.userId, accountIds)))
                    .orderBy(asc(groupMembers.id)).for("share") : [];
                const [paper] = await tx.select({ id: researchPapers.id, groupId: researchPapers.groupId }).from(researchPapers)
                    .where(eq(researchPapers.id, paperId)).for("share");
                const [task] = selection.taskId === undefined ? [] : await tx.select().from(tasks)
                    .where(and(eq(tasks.id, selection.taskId), eq(tasks.paperId, paperId))).for(mode === "write" ? "update" : "share");
                // Linking takes a task SHARE lock before touching the note. Deletion takes UPDATE
                // on that same task before unlinking notes, so a new link cannot slip past unlinking.
                const [linkedTask] = selection.linkTaskId == null ? [] : await tx.select().from(tasks)
                    .where(and(eq(tasks.id, selection.linkTaskId), eq(tasks.paperId, paperId))).for("share");
                const operations: WorkspaceTransaction = {
                    scope: { accounts, group, members, paper,
                        task: task && task.createdBy === taskHint?.createdBy ? task : undefined, linkedTask },
                    async listTasks() {
                        return tx.select().from(tasks).where(eq(tasks.paperId, paperId)).orderBy(desc(tasks.createdAt), desc(tasks.id));
                    },
                    async taskDirectory(peopleIds) {
                        // Called only after service scope authorization; never a global Student directory.
                        const members = group ? await tx.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
                            .from(groupMembers).innerJoin(users, eq(users.id, groupMembers.userId))
                            .where(and(eq(groupMembers.groupId, group.id), eq(users.isActive, true), eq(users.roleId, ROLE_IDS.STUDENT))) : [];
                        const people = peopleIds.length ? await tx.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
                            .from(users).where(inArray(users.id, [...new Set(peopleIds)])) : [];
                        const named = (user: { id: number; firstName: string; lastName: string }) => ({ id: user.id, name: `${user.firstName} ${user.lastName}` });
                        return { members: [...new Map(members.map(user => [user.id, named(user)])).values()].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id), people: people.map(named) };
                    },
                    async createTask(data) {
                        const [row] = await tx.insert(tasks).values(data).returning();
                        if (!row) throw new Error("Workspace write unconfirmed.");
                        return row;
                    },
                    async patchTask(id, data) {
                        const [row] = await tx.update(tasks).set({ ...data, updatedAt: sql`clock_timestamp()` })
                            .where(and(eq(tasks.id, id), eq(tasks.paperId, paperId))).returning();
                        return row;
                    },
                    async unlinkTaskNotes(id) {
                        // Include soft-deleted notes; preserve content, authorship, IDs and deletion state.
                        await tx.update(notes).set({ taskId: null, version: sql`${notes.version} + 1`, updatedAt: sql`clock_timestamp()` })
                            .where(and(eq(notes.taskId, id), eq(notes.paperId, paperId)));
                    },
                    async deleteTask(id) {
                        const rows = await tx.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.paperId, paperId))).returning({ id: tasks.id });
                        return rows.length === 1;
                    },
                    async listNotes(actorId, deletedOnly) {
                        return tx.select().from(notes).where(and(eq(notes.paperId, paperId), deletedOnly
                            ? and(eq(notes.createdBy, actorId), isNotNull(notes.deletedAt)) : isNull(notes.deletedAt)))
                            .orderBy(desc(notes.updatedAt), desc(notes.id));
                    },
                    async note(id) {
                        const [row] = await tx.select().from(notes).where(and(eq(notes.id, id), eq(notes.paperId, paperId)));
                        return row;
                    },
                    async createNote(data) {
                        const [row] = await tx.insert(notes).values(data).returning();
                        if (!row) throw new Error("Workspace write unconfirmed.");
                        return row;
                    },
                    async patchNote(id, creatorId, version, deleted, data) {
                        const { deleted: nextDeleted, ...content } = data;
                        const [row] = await tx.update(notes).set({ ...content, version: sql`${notes.version} + 1`, updatedAt: sql`clock_timestamp()`,
                            ...(nextDeleted === undefined ? {} : { deletedAt: nextDeleted ? sql`clock_timestamp()` : null }) })
                            .where(and(eq(notes.id, id), eq(notes.paperId, paperId), eq(notes.createdBy, creatorId), eq(notes.version, version),
                                deleted ? isNotNull(notes.deletedAt) : isNull(notes.deletedAt))).returning();
                        return row;
                    },
                };
                return operation(operations);
            });
        },
    };
}
