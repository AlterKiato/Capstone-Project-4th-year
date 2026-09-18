import { z } from "zod";

/**
 * Validates the information required to
 * create a Student research project.
 *
 * The Student ID is intentionally excluded
 * because it comes from the authenticated
 * session on the server.
 */
export const createStudentResearchSchema =
    z.object({
        groupId: z.coerce
            .number()
            .int()
            .positive(),

        title: z
            .string()
            .trim()
            .min(
                1,
                "Research title is required."
            )
            .max(
                200,
                "Research title must not exceed 200 characters."
            ),

        abstract: z
            .string()
            .trim()
            .min(
                1,
                "Research abstract is required."
            ),

        category: z
            .string()
            .trim()
            .max(
                100,
                "Category must not exceed 100 characters."
            )
            .optional(),

        keywords: z
            .string()
            .trim()
            .max(
                500,
                "Keywords must not exceed 500 characters."
            )
            .optional(),
    });

/**
 * Represents validated input for creating
 * a Student research project.
 */
export type CreateStudentResearchInput =
    z.infer<
        typeof createStudentResearchSchema
    >;