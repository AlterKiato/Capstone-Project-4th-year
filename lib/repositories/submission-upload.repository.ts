// Explicit database injection also permits read-only operator inspection without runtime credentials.
import { and, eq, gt, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import type { UploadContext, UploadIntent, UploadRepository, UploadTransaction } from "@/lib/uploads/contract";
import { UploadFailure } from "@/lib/uploads/contract";
import { SUBMISSION_LOCK_NAMESPACE } from "@/lib/constants/submission-lock";

type Database = PostgresJsDatabase<typeof schema>;
const intents = schema.submissionUploadIntents;
export function createSubmissionUploadRepository(database: Database): UploadRepository {
    return {
        async owned(id, studentId) {
            const [intent] = await database.select().from(intents).where(and(eq(intents.id, id), eq(intents.studentId, studentId)));
            return intent;
        },
        async locked(studentId, paperId, operation, signal) {
            const checkDeadline = () => { if (signal?.aborted) throw new UploadFailure("unavailable"); };
            checkDeadline();
            return database.transaction(async tx => {
                await tx.execute(sql`set local lock_timeout = '3s'`);
                await tx.execute(sql`set local statement_timeout = '5s'`);
                // Same namespace as withPaperSubmissionLock; no Storage I/O occurs in this callback.
                await tx.execute(sql`select pg_advisory_xact_lock(${SUBMISSION_LOCK_NAMESPACE}, ${paperId})`);
                checkDeadline();
                const [account] = await tx.select({ roleId: schema.users.roleId, isActive: schema.users.isActive })
                    .from(schema.users).where(eq(schema.users.id, studentId)).for("update");
                const [scope] = await tx.select({ groupId: schema.researchPapers.groupId }).from(schema.researchPapers).where(eq(schema.researchPapers.id, paperId));
                const [group] = scope ? await tx.select({ id: schema.researchGroups.id, status: schema.researchGroups.status, adviserId: schema.researchGroups.adviserId })
                    .from(schema.researchGroups).where(eq(schema.researchGroups.id, scope.groupId)).for("share") : [];
                const members = group ? await tx.select({ id: schema.groupMembers.id }).from(schema.groupMembers)
                    .where(and(eq(schema.groupMembers.groupId, group.id), eq(schema.groupMembers.userId, studentId))).for("share") : [];
                // Match Adviser decision ordering: submission rows before the paper row.
                const existing = await tx.select().from(schema.submissions).where(eq(schema.submissions.paperId, paperId)).for("share");
                const [paper] = await tx.select({ id: schema.researchPapers.id, groupId: schema.researchPapers.groupId, title: schema.researchPapers.title })
                    .from(schema.researchPapers).where(eq(schema.researchPapers.id, paperId)).for("share");
                const context: UploadContext = { account, group, paper, member: members.length > 0 && paper?.groupId === group?.id, submissions: existing };
                const clock = async () => {
                    checkDeadline();
                    const [row] = await tx.execute<{ now: Date | string }>(sql`select clock_timestamp() as now`);
                    const now = new Date(row.now); if (!Number.isFinite(now.getTime())) throw new UploadFailure("unavailable");
                    return now;
                };
                const operations: UploadTransaction = {
                    context, now: clock,
                    async intent(id) {
                        checkDeadline();
                        const [row] = await tx.select().from(intents).where(and(eq(intents.id, id), eq(intents.studentId, studentId), eq(intents.paperId, paperId))).for("update");
                        return row;
                    },
                    async byRequest(key) {
                        const [row] = await tx.select().from(intents).where(and(eq(intents.studentId, studentId), eq(intents.requestKey, key))).for("update");
                        return row;
                    },
                    async recent() {
                        const cutoff = new Date((await clock()).getTime() - 3600000);
                        return tx.select().from(intents).where(and(eq(intents.studentId, studentId), gt(intents.createdAt, cutoff)));
                    },
                    async insert(intent) {
                        checkDeadline();
                        const [row] = await tx.insert(intents).values(intent).returning();
                        if (!row) throw new UploadFailure("unavailable"); return row;
                    },
                    async patch(id, data) {
                        checkDeadline();
                        const [row] = await tx.update(intents).set(data).where(and(eq(intents.id, id), eq(intents.studentId, studentId), eq(intents.paperId, paperId))).returning();
                        if (!row) throw new UploadFailure("unavailable"); return row;
                    },
                    async submit(intent: UploadIntent, version) {
                        checkDeadline();
                        if (!intent.finalPath) throw new UploadFailure("unavailable");
                        const [row] = await tx.insert(schema.submissions).values({ paperId, submittedBy: studentId, version, fileUrl: intent.finalPath,
                            remarks: intent.remarks, status: "Submitted" }).returning();
                        if (!row) throw new UploadFailure("unavailable"); return row;
                    },
                };
                const result = await operation(operations);
                checkDeadline();
                return result;
            });
        },
    };
}
