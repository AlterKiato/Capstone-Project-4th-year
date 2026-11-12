import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityLogs, coAdviserReviewAssignments as assignments, mainAdviserDesignation, researchPapers, submissions, users } from "@/db/schema";
import { lockCurrentMainAdviser } from "./research-supervision.repository";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Like S3.2: accounts ascending -> singleton -> submission -> assignments.
// Co mutations never acquire the Main account after locking a submission.
async function lockCoAdviser(tx: Transaction, actorId: number) {
    const [account] = await tx.select({ roleId: users.roleId, isActive: users.isActive }).from(users).where(eq(users.id, actorId)).for("update");
    if (!account?.isActive || account.roleId !== 2) return false;
    const [designation] = await tx.select({ mainAdviserId: mainAdviserDesignation.mainAdviserId }).from(mainAdviserDesignation)
        .where(eq(mainAdviserDesignation.id, 1)).for("share");
    if (!designation?.mainAdviserId || designation.mainAdviserId === actorId) return false;
    const [main] = await tx.select({ roleId: users.roleId, isActive: users.isActive }).from(users).where(eq(users.id, designation.mainAdviserId));
    return main?.isActive && main.roleId === 2;
}

function coAuthority(actorId: number) {
    return sql`exists (select 1 from ${users} where ${users.id} = ${actorId} and ${users.roleId} = 2 and ${users.isActive} = true)
        and exists (select 1 from ${mainAdviserDesignation} inner join ${users} on ${users.id} = ${mainAdviserDesignation.mainAdviserId}
        where ${mainAdviserDesignation.id} = 1 and ${mainAdviserDesignation.mainAdviserId} <> ${actorId}
        and ${users.roleId} = 2 and ${users.isActive} = true)`;
}

export async function readMainDelegationPanel(actorId: number, submissionId: number) {
    return db.transaction(async tx => {
        if (!await lockCurrentMainAdviser(tx, actorId)) return null;
        const [submission] = await tx.select({ status: submissions.status }).from(submissions).where(eq(submissions.id, submissionId)).for("share");
        if (!submission) return null;
        const rows = await tx.select({ id: assignments.id, coAdviserId: assignments.coAdviserId, firstName: users.firstName, lastName: users.lastName,
            state: assignments.state, recommendation: assignments.recommendation, createdAt: assignments.createdAt,
            completedAt: assignments.completedAt, closedAt: assignments.closedAt, closureReason: assignments.closureReason })
            .from(assignments).innerJoin(users, eq(users.id, assignments.coAdviserId)).where(eq(assignments.submissionId, submissionId)).orderBy(asc(assignments.id));
        const advisers = await tx.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email }).from(users)
            .where(and(eq(users.roleId, 2), eq(users.isActive, true), ne(users.id, actorId))).orderBy(asc(users.lastName), asc(users.id));
        return { submission, assignments: rows, advisers };
    });
}

export async function withMainDelegationScope<T>(actorId: number, submissionId: number, coIds: number[], operation: (scope: {
    accounts: NonNullable<Awaited<ReturnType<typeof lockCurrentMainAdviser>>>;
    submission: typeof submissions.$inferSelect;
    assignments: typeof assignments.$inferSelect[];
    create(coAdviserId: number): Promise<void>;
    cancel(assignmentId: number): Promise<void>;
}) => Promise<T>) {
    return db.transaction(async tx => {
        const accounts = await lockCurrentMainAdviser(tx, actorId, coIds);
        if (!accounts) return null;
        const [submission] = await tx.select().from(submissions).where(eq(submissions.id, submissionId)).for("update");
        if (!submission) return null;
        const rows = await tx.select().from(assignments).where(eq(assignments.submissionId, submissionId)).orderBy(asc(assignments.id)).for("update");
        return operation({ accounts, submission, assignments: rows,
            async create(coAdviserId) {
                const [created] = await tx.insert(assignments).values({ submissionId, coAdviserId, assignedBy: actorId }).returning({ id: assignments.id });
                if (!created) throw Error("Assignment could not be saved.");
                await tx.insert(activityLogs).values({ userId: actorId, action: "Co-Adviser Review Delegated", description: `Assignment ${created.id}; submission ${submissionId}; Co-Adviser ${coAdviserId}.` });
            },
            async cancel(assignmentId) {
                const [closed] = await tx.update(assignments).set({ state: "closed", closedBy: actorId,
                    closedAt: sql`greatest(clock_timestamp(), ${assignments.createdAt})`, closureReason: "main-cancelled" })
                    .where(and(eq(assignments.id, assignmentId), eq(assignments.submissionId, submissionId), eq(assignments.state, "open"))).returning({ id: assignments.id });
                if (!closed) throw Error("Assignment changed before cancellation.");
                await tx.insert(activityLogs).values({ userId: actorId, action: "Co-Adviser Assignment Closed", description: `Assignment ${assignmentId}; submission ${submissionId}; main-cancelled.` });
            },
        });
    });
}

export async function withCoRecommendationScope<T>(actorId: number, submissionId: number, assignmentId: number, operation: (scope: {
    submission: typeof submissions.$inferSelect;
    assignment: typeof assignments.$inferSelect;
    complete(text: string): Promise<void>;
}) => Promise<T>) {
    return db.transaction(async tx => {
        if (!await lockCoAdviser(tx, actorId)) return null;
        const [submission] = await tx.select().from(submissions).where(eq(submissions.id, submissionId)).for("update");
        if (!submission) return null;
        const [assignment] = await tx.select().from(assignments).where(and(eq(assignments.id, assignmentId),
            eq(assignments.submissionId, submissionId), eq(assignments.coAdviserId, actorId))).for("update");
        if (!assignment) return null;
        return operation({ submission, assignment,
            async complete(text) {
                const [saved] = await tx.update(assignments).set({ state: "completed", recommendation: text,
                    completedAt: sql`greatest(clock_timestamp(), ${assignments.createdAt})` })
                    .where(and(eq(assignments.id, assignmentId), eq(assignments.coAdviserId, actorId), eq(assignments.submissionId, submissionId), eq(assignments.state, "open")))
                    .returning({ id: assignments.id });
                if (!saved) throw Error("Assignment changed before completion.");
                await tx.insert(activityLogs).values({ userId: actorId, action: "Co-Adviser Recommendation Completed", description: `Assignment ${assignmentId}; submission ${submissionId}.` });
            },
        });
    });
}

/** Called only after the decision transaction has locked Main, singleton and submission. */
export async function closeOpenDelegationsForDecision(tx: Transaction, submissionId: number, actorId: number) {
    const closed = await tx.update(assignments).set({ state: "closed", closedBy: actorId,
        closedAt: sql`greatest(clock_timestamp(), ${assignments.createdAt})`, closureReason: "official-decision" })
        .where(and(eq(assignments.submissionId, submissionId), eq(assignments.state, "open"))).returning({ id: assignments.id });
    if (closed.length) await tx.insert(activityLogs).values(closed.map(row => ({ userId: actorId, action: "Co-Adviser Assignment Closed",
        description: `Assignment ${row.id}; submission ${submissionId}; official-decision.` })));
}

// Assignment-owned metadata only: a group identifier, never its Student directory or other versions.
const coProjection = { id: assignments.id, submissionId: submissions.id, title: researchPapers.title, groupId: researchPapers.groupId,
    version: submissions.version, state: assignments.state, recommendation: assignments.recommendation,
    submissionStatus: submissions.status, createdAt: assignments.createdAt, completedAt: assignments.completedAt, closedAt: assignments.closedAt };

export async function readCoAssignments(actorId: number) {
    return db.select(coProjection)
        .from(assignments).innerJoin(submissions, eq(submissions.id, assignments.submissionId)).innerJoin(researchPapers, eq(researchPapers.id, submissions.paperId))
        .where(and(eq(assignments.coAdviserId, actorId), coAuthority(actorId))).orderBy(desc(assignments.createdAt), desc(assignments.id));
}

export async function readCoAssignment(actorId: number, assignmentId: number, submissionId: number) {
    const [row] = await db.select(coProjection).from(assignments).innerJoin(submissions, eq(submissions.id, assignments.submissionId))
        .innerJoin(researchPapers, eq(researchPapers.id, submissions.paperId))
        .where(and(eq(assignments.coAdviserId, actorId), eq(assignments.id, assignmentId), eq(assignments.submissionId, submissionId), coAuthority(actorId)));
    return row ?? null;
}

/** Fresh Main authority and exact-version scope for a draft-only copy. No feedback/status writes. */
export async function readRecommendationForDraft(actorId: number, assignmentId: number, submissionId: number) {
    return db.transaction(async tx => {
        if (!await lockCurrentMainAdviser(tx, actorId)) return null;
        const [submission] = await tx.select({ status: submissions.status }).from(submissions).where(eq(submissions.id, submissionId)).for("share");
        if (submission?.status !== "Under Review") return null;
        const [row] = await tx.select({ recommendation: assignments.recommendation, firstName: users.firstName, lastName: users.lastName })
            .from(assignments).innerJoin(users, eq(users.id, assignments.coAdviserId))
            .where(and(eq(assignments.id, assignmentId), eq(assignments.submissionId, submissionId), eq(assignments.state, "completed")));
        return row ?? null;
    });
}

/** Internal signing scope only; never serialize this path-bearing result to a client. */
export async function readDelegatedDocument(actorId: number, assignmentId: number, submissionId: number) {
    const [row] = await db.select({ paperId: submissions.paperId, version: submissions.version, fileUrl: submissions.fileUrl })
        .from(assignments).innerJoin(submissions, eq(submissions.id, assignments.submissionId))
        .where(and(eq(assignments.id, assignmentId), eq(assignments.coAdviserId, actorId), eq(assignments.submissionId, submissionId),
            eq(assignments.state, "open"), inArray(submissions.status, ["Submitted", "Under Review"]), coAuthority(actorId)));
    return row ?? null;
}

/** Synthetic research demo only. Same exact-version eligibility as delegated review; no content projection. */
export async function canAccessResearchDemoAssignment(actorId: number, assignmentId: number, submissionId: number) {
    const [row] = await db.select({ id: assignments.id }).from(assignments)
        .innerJoin(submissions, eq(submissions.id, assignments.submissionId))
        .innerJoin(researchPapers, eq(researchPapers.id, submissions.paperId))
        .where(and(eq(assignments.id, assignmentId), eq(assignments.coAdviserId, actorId), eq(assignments.submissionId, submissionId),
            eq(assignments.state, "open"), inArray(submissions.status, ["Submitted", "Under Review"]), coAuthority(actorId))).limit(1);
    return row?.id === assignmentId;
}
