import { z } from "zod";

/**
 * Validates the information required when
 * a Student submits a research document.
 *
 * The server generates the submission version,
 * so version is intentionally not accepted here.
 */
export const createSubmissionSchema =
    z.object({
        paperId: z.coerce
            .number()
            .int()
            .positive(),

        fileUrl: z
            .string()
            .trim()
            .min(
                1,
                "A submission file is required."
            )
            .max(
                500,
                "The submission file reference is too long."
            ),

        remarks: z
            .string()
            .trim()
            .max(
                500,
                "Remarks must not exceed 500 characters."
            )
            .optional(),
    });

/**
 * Represents validated data for creating
 * a research submission.
 */
export type CreateSubmissionInput =
    z.infer<
        typeof createSubmissionSchema
    >;