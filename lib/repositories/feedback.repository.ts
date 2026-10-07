import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";

import {
    activityLogs,
    feedbacks,
    researchPapers,
    submissions,
} from "@/db/schema";

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

/** Persists an Adviser decision and its related status/log records atomically. */
export async function persistAdviserDecision(data: {
    submissionId: number;
    paperId: number;
    teacherId: number;
    comments: string;
    decision: string;
    expectedSubmissionStatus: string;
    researchStatus: string;
    activityAction: string;
    activityDescription: string;
}) {
    return db.transaction(async (tx) => {
        const [feedback] = await tx
            .insert(feedbacks)
            .values({
                submissionId: data.submissionId,
                teacherId: data.teacherId,
                comments: data.comments,
                decision: data.decision,
            })
            .returning();

        if (!feedback) {
            throw new Error("The feedback could not be saved.");
        }

        const [updatedSubmission] = await tx
            .update(submissions)
            .set({ status: data.decision })
            .where(
                and(
                    eq(submissions.id, data.submissionId),
                    eq(submissions.status, data.expectedSubmissionStatus)
                )
            )
            .returning({ id: submissions.id });

        if (!updatedSubmission) {
            throw new Error("The submission status could not be updated.");
        }

        const [updatedPaper] = await tx
            .update(researchPapers)
            .set({
                status: data.researchStatus,
                updatedAt: new Date(),
            })
            .where(eq(researchPapers.id, data.paperId))
            .returning({ id: researchPapers.id });

        if (!updatedPaper) {
            throw new Error("The research status could not be updated.");
        }

        await tx.insert(activityLogs).values({
            userId: data.teacherId,
            action: data.activityAction,
            description: data.activityDescription,
        });

        return feedback;
    });
}
