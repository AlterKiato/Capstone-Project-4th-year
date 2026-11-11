import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { lockCurrentMainAdviser } from "./research-supervision.repository";
import { SUBMISSION_LOCK_NAMESPACE } from "@/lib/constants/submission-lock";
import { ROLE_IDS } from "@/lib/auth/roles";
import type { RevisionChecklist } from "@/lib/revisions";

type Database = PostgresJsDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
const { users, researchPapers, researchGroups, groupMembers, submissions, feedbacks, revisionItems: items, revisionResponses: responses, activityLogs } = schema;
export type RevisionScope = {
    read(submissionId?: number): Promise<RevisionChecklist>;
    respond(itemId: number, expectedRevision: number, actionTaken: string): Promise<"saved" | "stale" | "closed">;
};

/** Called by BOTH existing manuscript persistence paths inside their paper advisory lock.
 * No Storage work and no extra submission lifecycle. Failure rolls back the manuscript too. */
export async function freezeRevisionResponses(tx: Transaction, paperId: number, submissionId: number) {
    const origins = await tx.select({ id: items.id }).from(items)
        .innerJoin(feedbacks, eq(feedbacks.id, items.feedbackId))
        .innerJoin(submissions, eq(submissions.id, feedbacks.submissionId))
        .where(and(eq(submissions.paperId, paperId), eq(feedbacks.decision, "Revision Required")));
    if (origins.length) await tx.update(responses).set({ frozenBySubmissionId: submissionId })
        .where(and(inArray(responses.itemId, origins.map(row => row.id)), isNull(responses.frozenBySubmissionId)));
}

export function createRevisionRepository(database: Database) {
    return {
        async withPaper<T>(actorId: number, roleId: number, paperId: number, operation: (scope: RevisionScope) => Promise<T>): Promise<T | null> {
            if (roleId !== ROLE_IDS.STUDENT && roleId !== ROLE_IDS.ADVISER) return null;
            return database.transaction(async tx => {
                await tx.execute(sql`set local lock_timeout = '3s'`);
                await tx.execute(sql`set local statement_timeout = '5s'`);
                // Same lock and order as upload finalization: advisory -> account -> group -> submission -> paper.
                await tx.execute(sql`select pg_advisory_xact_lock(${SUBMISSION_LOCK_NAMESPACE}, ${paperId})`);
                const main = roleId === ROLE_IDS.ADVISER;
                if (main) { if (!await lockCurrentMainAdviser(tx, actorId)) return null; }
                else {
                    const [actor] = await tx.select({ roleId: users.roleId, isActive: users.isActive }).from(users).where(eq(users.id, actorId)).for("update");
                    if (!actor?.isActive || actor.roleId !== ROLE_IDS.STUDENT) return null;
                }
                const [hint] = await tx.select({ groupId: researchPapers.groupId }).from(researchPapers).where(eq(researchPapers.id, paperId));
                if (!hint) return null;
                const [group] = await tx.select({ id: researchGroups.id, status: researchGroups.status }).from(researchGroups).where(eq(researchGroups.id, hint.groupId)).for("share");
                if (!group || group.status !== "active") return null;
                if (!main) {
                    const [member] = await tx.select({ id: groupMembers.id }).from(groupMembers).where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, actorId))).for("share");
                    if (!member) return null;
                }
                const history = await tx.select({ id: submissions.id, version: submissions.version, status: submissions.status }).from(submissions)
                    .where(eq(submissions.paperId, paperId)).orderBy(asc(submissions.id)).for("share");
                const latest = history.reduce<typeof history[number] | undefined>((best, row) => {
                    const version = /^v(\d+)$/.exec(row.version);
                    return version && (!best || Number(version[1]) > Number(best.version.slice(1))) ? row : best;
                }, undefined);
                const [paper] = await tx.select({ groupId: researchPapers.groupId }).from(researchPapers).where(eq(researchPapers.id, paperId)).for("share");
                if (paper?.groupId !== group.id) return null;
                const rows = await tx.select({ item: items, feedbackId: feedbacks.id, submissionId: submissions.id, version: submissions.version, createdAt: feedbacks.createdAt })
                    .from(items).innerJoin(feedbacks, eq(feedbacks.id, items.feedbackId)).innerJoin(submissions, eq(submissions.id, feedbacks.submissionId))
                    .where(and(eq(submissions.paperId, paperId), eq(feedbacks.decision, "Revision Required"), eq(submissions.status, "Revision Required")))
                    .orderBy(desc(submissions.id), desc(feedbacks.id), asc(items.position));
                return operation({
                    async read(submissionId) {
                        const selected = rows.filter(row => submissionId === undefined || row.submissionId === submissionId);
                        const saved = selected.length ? await tx.select({ response: responses, firstName: users.firstName, lastName: users.lastName }).from(responses)
                            .innerJoin(users, eq(users.id, responses.studentId))
                            .where(and(inArray(responses.itemId, selected.map(row => row.item.id)), main ? undefined : eq(responses.studentId, actorId)))
                            .orderBy(asc(responses.studentId)) : [];
                        const cycles: RevisionChecklist["cycles"] = [];
                        for (const row of selected) {
                            let cycle = cycles.find(c => c.feedbackId === row.feedbackId);
                            if (!cycle) {
                                cycle = { feedbackId: row.feedbackId, submissionId: row.submissionId, version: row.version, createdAt: row.createdAt.toISOString(),
                                    editable: !main && latest?.id === row.submissionId && latest.status === "Revision Required", items: [] };
                                cycles.push(cycle);
                            }
                            cycle.items.push({ id: row.item.id, correction: row.item.correction, reference: row.item.reference, position: row.item.position,
                                responses: saved.filter(r => r.response.itemId === row.item.id).map(r => ({ studentId: r.response.studentId,
                                    studentName: main ? `${r.firstName} ${r.lastName}` : "Your response", actionTaken: r.response.actionTaken,
                                    revision: r.response.revision, frozenBySubmissionId: r.response.frozenBySubmissionId, updatedAt: r.response.updatedAt.toISOString() })) });
                        }
                        return { canManage: main, cycles };
                    },
                    async respond(itemId, expectedRevision, actionTaken) {
                        const item = rows.find(row => row.item.id === itemId);
                        if (main || !item || latest?.id !== item.submissionId || latest.status !== "Revision Required") return "closed";
                        const [old] = await tx.select().from(responses).where(and(eq(responses.itemId, itemId), eq(responses.studentId, actorId))).for("update");
                        if (old?.frozenBySubmissionId) return "closed";
                        if ((old?.revision ?? 0) !== expectedRevision) return "stale";
                        if (old?.actionTaken === actionTaken || !old && !actionTaken) return "saved";
                        if (old) await tx.update(responses).set({ actionTaken, revision: old.revision + 1, updatedAt: sql`clock_timestamp()` })
                            .where(and(eq(responses.id, old.id), eq(responses.studentId, actorId), eq(responses.revision, expectedRevision), isNull(responses.frozenBySubmissionId)));
                        else await tx.insert(responses).values({ itemId, studentId: actorId, actionTaken });
                        await tx.insert(activityLogs).values({ userId: actorId, action: "Revision Action Taken Saved",
                            description: `Paper ${paperId}; feedback ${item.feedbackId}; correction ${itemId}; response revision ${expectedRevision} -> ${expectedRevision + 1}; ${actionTaken ? "Addressed" : "Pending"}.` });
                        return "saved";
                    },
                });
            });
        },
    };
}
