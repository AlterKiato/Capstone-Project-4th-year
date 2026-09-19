import { z } from "zod";

/**
 * Validates Adviser feedback submitted
 * for a research submission.
 */
export const createFeedbackSchema =
    z.object({
        submissionId: z.coerce
            .number()
            .int()
            .positive(),

        comments: z
            .string()
            .trim()
            .min(
                1,
                "Feedback comments are required."
            )
            .max(
                5000,
                "Feedback comments must not exceed 5000 characters."
            ),

        decision: z
            .string()
            .trim()
            .min(
                1,
                "A review decision is required."
            )
            .max(
                30,
                "Review decision must not exceed 30 characters."
            ),
    });

export type CreateFeedbackInput =
    z.infer<
        typeof createFeedbackSchema
    >;