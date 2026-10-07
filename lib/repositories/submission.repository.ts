import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";

import { submissions } from "@/db/schema";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const SUBMISSION_LOCK_NAMESPACE = 1296388936;

/**
 * Serializes submission version decisions for a paper. The lock is held
 * until the callback commits or rolls back.
 */
export async function withPaperSubmissionLock<T>(
    paperId: number,
    operation: (tx: DbTransaction) => Promise<T>
): Promise<T> {
    return db.transaction(async (tx) => {
        await tx.execute(
            sql`select pg_advisory_xact_lock(${SUBMISSION_LOCK_NAMESPACE}, ${paperId})`
        );

        return operation(tx);
    });
}

/**
 * Retrieves all submissions.
 *
 * Submissions are ordered from newest
 * to oldest.
 */
export async function findAllSubmissions() {
    return await db
        .select()
        .from(submissions)
        .orderBy(
            desc(
                submissions.submittedAt
            )
        );
}

/**
 * Retrieves all submissions belonging
 * to a specific research paper.
 *
 * This allows the system to display
 * the complete submission/version history.
 */
export async function findSubmissionsByPaperId(
    paperId: number,
    executor: typeof db | DbTransaction = db
) {
    return await executor
        .select()
        .from(submissions)
        .where(
            eq(
                submissions.paperId,
                paperId
            )
        )
        .orderBy(
            desc(
                submissions.submittedAt
            )
        );
}

/**
 * Retrieves all submissions made by
 * a specific user.
 */
export async function findSubmissionsByUserId(
    userId: number
) {
    return await db
        .select()
        .from(submissions)
        .where(
            eq(
                submissions.submittedBy,
                userId
            )
        )
        .orderBy(
            desc(
                submissions.submittedAt
            )
        );
}

/**
 * Retrieves a submission by its ID.
 */
export async function findSubmissionById(
    id: number
) {
    const [submission] = await db
        .select()
        .from(submissions)
        .where(
            eq(
                submissions.id,
                id
            )
        );

    return submission;
}

/**
 * Creates a new submission record.
 */
export async function createSubmission(
    data: typeof submissions.$inferInsert,
    executor: typeof db | DbTransaction = db
) {
    const [submission] = await executor
        .insert(submissions)
        .values(data)
        .returning();

    return submission;
}

/**
 * Updates an existing submission.
 */
export async function updateSubmission(
    id: number,
    data: Partial<
        typeof submissions.$inferInsert
    >
) {
    const [submission] = await db
        .update(submissions)
        .set(data)
        .where(
            eq(
                submissions.id,
                id
            )
        )
        .returning();

    return submission;
}

/**
 * Updates the status of a submission.
 */
export async function updateSubmissionStatus(
    id: number,
    status: string
) {
    const [submission] = await db
        .update(submissions)
        .set({
            status,
        })
        .where(
            eq(
                submissions.id,
                id
            )
        )
        .returning();

    return submission;
}
