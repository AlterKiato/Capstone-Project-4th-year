import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { lockCurrentMainAdviser } from "./research-supervision.repository";
import { ROLE_IDS } from "@/lib/auth/roles";

const { users, researchGroups, groupMembers, researchPapers, researchMilestones: milestones, submissions, activityLogs } = schema;
type Database = PostgresJsDatabase<typeof schema>;
type Milestone = typeof milestones.$inferSelect;
export type ProgressScope = {
    canManage: boolean;
    list(): Promise<{ milestones: Milestone[]; submissions: { id: number; version: string; status: string }[] }>;
    milestone(id: number): Promise<Milestone | undefined>;
    evidence(id: number): Promise<{ id: number; status: string } | undefined>;
    create(title: string, dueDate: string): Promise<Milestone>;
    patch(row: Milestone, data: Partial<Pick<Milestone, "title" | "dueDate" | "submissionId" | "verifiedBy" | "verifiedAt">>): Promise<Milestone>;
    log(action: string, row: Milestone, previous?: Milestone): Promise<void>;
};

export function createResearchProgressRepository(database: Database) {
    return {
        async withPaper<T>(actorId: number, roleId: number, paperId: number, operation: (scope: ProgressScope) => Promise<T>): Promise<T | null> {
            return database.transaction(async tx => {
                await tx.execute(sql`set local lock_timeout = '3s'`);
                await tx.execute(sql`set local statement_timeout = '5s'`);
                if (roleId === ROLE_IDS.ADVISER) {
                    if (!await lockCurrentMainAdviser(tx, actorId)) return null;
                } else if (roleId === ROLE_IDS.STUDENT) {
                    const [actor] = await tx.select().from(users).where(eq(users.id, actorId)).for("update");
                    if (!actor?.isActive || actor.roleId !== ROLE_IDS.STUDENT) return null;
                } else return null;
                const [hint] = await tx.select({ groupId: researchPapers.groupId }).from(researchPapers).where(eq(researchPapers.id, paperId));
                if (!hint) return null;
                const [group] = await tx.select().from(researchGroups).where(eq(researchGroups.id, hint.groupId)).for("share");
                if (!group || group.status !== "active") return null;
                if (roleId === ROLE_IDS.STUDENT) {
                    const [member] = await tx.select({ id: groupMembers.id }).from(groupMembers)
                        .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, actorId))).for("share");
                    if (!member) return null;
                }
                // Official decisions lock a submission before updating its paper. Preserve that
                // order so evidence linking cannot deadlock with a concurrent review decision.
                await tx.select({ id: submissions.id }).from(submissions).where(eq(submissions.paperId, paperId)).orderBy(asc(submissions.id)).for("share");
                const [paper] = await tx.select({ groupId: researchPapers.groupId }).from(researchPapers).where(eq(researchPapers.id, paperId)).for("share");
                if (paper?.groupId !== group.id) return null;
                return operation({
                    canManage: roleId === ROLE_IDS.ADVISER,
                    async list() {
                        return { milestones: await tx.select().from(milestones).where(eq(milestones.paperId, paperId)).orderBy(asc(milestones.dueDate), asc(milestones.id)),
                            submissions: await tx.select({ id: submissions.id, version: submissions.version, status: submissions.status }).from(submissions)
                                .where(eq(submissions.paperId, paperId)).orderBy(desc(submissions.submittedAt), desc(submissions.id)) };
                    },
                    async milestone(id) {
                        const [row] = await tx.select().from(milestones).where(and(eq(milestones.id, id), eq(milestones.paperId, paperId))).for("update");
                        return row;
                    },
                    async evidence(id) {
                        const [row] = await tx.select({ id: submissions.id, status: submissions.status }).from(submissions)
                            .where(and(eq(submissions.id, id), eq(submissions.paperId, paperId))).for("share");
                        return row;
                    },
                    async create(title, dueDate) {
                        const [row] = await tx.insert(milestones).values({ paperId, title, dueDate }).returning();
                        if (!row) throw new Error("Milestone write unconfirmed.");
                        return row;
                    },
                    async patch(row, data) {
                        const [saved] = await tx.update(milestones).set({ ...data, revision: row.revision + 1, updatedAt: sql`clock_timestamp()` })
                            .where(and(eq(milestones.id, row.id), eq(milestones.paperId, paperId), eq(milestones.revision, row.revision))).returning();
                        if (!saved) throw new Error("Milestone write unconfirmed.");
                        return saved;
                    },
                    async log(action, row, previous) {
                        await tx.insert(activityLogs).values({ userId: actorId, action, description: `Paper ${paperId}; milestone ${row.id}; revision ${previous?.revision ?? "new"} -> ${row.revision}; evidence ${previous?.submissionId ?? "none"} -> ${row.submissionId ?? "none"}; verification ${previous?.verifiedBy ?? "none"}/${previous?.verifiedAt?.toISOString() ?? "none"} -> ${row.verifiedBy ?? "none"}/${row.verifiedAt?.toISOString() ?? "none"}.` });
                    },
                });
            });
        },
    };
}
