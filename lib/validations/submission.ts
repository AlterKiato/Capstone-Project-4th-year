import { z } from "zod";

/**
 * Validates the information required when
 * a Student submits a research document.
 *
 * The uploaded File itself is validated
 * separately by the Storage Service.
 */
export const createSubmissionSchema =
    z.object({
        paperId: z.coerce
            .number()
            .int()
            .positive(),

        remarks: z
            .string()
            .trim()
            .max(
                500,
                "Remarks must not exceed 500 characters."
            )
            .optional(),
    });

export type CreateSubmissionInput =
    z.infer<
        typeof createSubmissionSchema
    >;