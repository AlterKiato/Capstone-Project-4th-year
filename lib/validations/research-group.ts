import { z } from "zod";

export const researchGroupStatusSchema = z.object({
    groupId: z.number().int().positive().max(2147483647),
    status: z.enum(["active", "archived"]),
}).strict();

/**
 * Validates research group information.
 */
export const createResearchGroupSchema = z.object({
    groupName: z
        .string()
        .trim()
        .min(2, "Group name must be at least 2 characters long")
        .max(100, "Group name must not exceed 100 characters"),

    strand: z
        .string()
        .trim()
        .min(2, "Strand must be at least 2 characters long")
        .max(50, "Strand must not exceed 50 characters"),

    section: z
        .string()
        .trim()
        .min(1, "Section is required")
        .max(50, "Section must not exceed 50 characters"),

    schoolYear: z
        .string()
        .trim()
        .min(4, "School year is required")
        .max(20, "School year must not exceed 20 characters"),


});

export type CreateResearchGroupInput = z.infer<
    typeof createResearchGroupSchema
>;
