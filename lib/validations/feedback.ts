import { z } from "zod";
import { SUBMISSION_STATUS } from "@/lib/constants/submission-status";
import { feedbackCommentsSchema } from "@/lib/utils/feedback-content";
import { revisionDraftsSchema } from "./revision";

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

        comments: feedbackCommentsSchema,

        decision: z.enum([
            SUBMISSION_STATUS.REVISION_REQUIRED,
            SUBMISSION_STATUS.APPROVED,
        ]),
        revisionItems: revisionDraftsSchema.default([]),
    });

export type CreateFeedbackInput =
    z.infer<
        typeof createFeedbackSchema
    >;
