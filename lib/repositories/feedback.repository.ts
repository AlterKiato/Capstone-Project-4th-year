import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";

import { feedbacks } from "@/db/schema";

/**
 * Retrieves all feedback records belonging
 * to a specific submission.
 *
 * Feedback is ordered from newest
 * to oldest.
 */
export async function findFeedbackBySubmissionId(
    submissionId: number
) {
    return await db
        .select()
        .from(feedbacks)
        .where(
            eq(
                feedbacks.submissionId,
                submissionId
            )
        )
        .orderBy(
            desc(
                feedbacks.createdAt
            )
        );
}

/**
 * Retrieves a feedback record by its ID.
 */
export async function findFeedbackById(
    id: number
) {
    const [feedback] =
        await db
            .select()
            .from(feedbacks)
            .where(
                eq(
                    feedbacks.id,
                    id
                )
            );

    return feedback;
}

/**
 * Creates a new feedback record.
 */
export async function createFeedback(
    data: typeof feedbacks.$inferInsert
) {
    const [feedback] =
        await db
            .insert(feedbacks)
            .values(data)
            .returning();

    return feedback;
}