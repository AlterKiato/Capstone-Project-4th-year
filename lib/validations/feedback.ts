import { z } from "zod";
import { SUBMISSION_STATUS } from "@/lib/constants/submission-status";

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

        decision: z.enum([
            SUBMISSION_STATUS.REVISION_REQUIRED,
            SUBMISSION_STATUS.APPROVED,
        ]),
    });

export type CreateFeedbackInput =
    z.infer<
        typeof createFeedbackSchema
    >;
