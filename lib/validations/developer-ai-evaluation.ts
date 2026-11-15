import { z } from "zod";

const id = z.number().int().positive().max(2147483647);
export const developerEvaluationRequestSchema = z.discriminatedUnion("feature", [
    z.strictObject({ feature: z.literal("admin") }),
    z.strictObject({ feature: z.literal("adviser"), submissionId: id, assignmentId: id.optional(),
        questionId: z.enum(["primary", "explain-improvement", "verify-next"]) }),
]);
export type DeveloperEvaluationRequest = z.infer<typeof developerEvaluationRequestSchema>;
