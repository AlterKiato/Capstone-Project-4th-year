import { db } from "@/lib/db";
import { users, researchPapers, submissions, repositories } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function findPublicationById(id: number) {
    const [entry] = await db.select().from(repositories).where(eq(repositories.id, id));
    return entry;
}

/** Hold the account and paper locks through eligibility checks and the publication write. */
export async function withPublicationContext<T>(paperId: number, userId: number, operation: (context: {
    tx: Transaction;
    user: Pick<typeof users.$inferSelect, "roleId" | "isActive"> | undefined;
    paper: typeof researchPapers.$inferSelect | undefined;
    submission: typeof submissions.$inferSelect | undefined;
    entry: typeof repositories.$inferSelect | undefined;
}) => Promise<T>): Promise<T> {
    return db.transaction(async tx => {
        const [user] = await tx.select({ roleId: users.roleId, isActive: users.isActive })
            .from(users).where(eq(users.id, userId)).for("share");
        const [paper] = await tx.select().from(researchPapers).where(eq(researchPapers.id, paperId)).for("update");
        const [submission] = await tx.select().from(submissions).where(and(
            eq(submissions.paperId, paperId), eq(submissions.status, "Approved")
        )).orderBy(desc(submissions.submittedAt), desc(submissions.id)).limit(1);
        const [entry] = await tx.select().from(repositories).where(eq(repositories.paperId, paperId));
        return operation({ tx, user, paper, submission, entry });
    });
}

export async function writePublication(tx: Transaction, paperId: number, entryId: number | undefined, published: boolean) {
    const state = { isPublished: published, publishedAt: published ? new Date() : null };
    if (entryId !== undefined) {
        const [entry] = await tx.update(repositories).set(state).where(and(
            eq(repositories.id, entryId), eq(repositories.paperId, paperId)
        )).returning({ id: repositories.id, paperId: repositories.paperId });
        return entry;
    }
    const [entry] = await tx.insert(repositories).values({ paperId, ...state })
        .onConflictDoNothing({ target: repositories.paperId })
        .returning({ id: repositories.id, paperId: repositories.paperId });
    return entry;
}
