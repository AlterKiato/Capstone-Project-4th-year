import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";

import { submissions } from "@/db/schema";

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
    paperId: number
) {
    return await db
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
    data: typeof submissions.$inferInsert
) {
    const [submission] = await db
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