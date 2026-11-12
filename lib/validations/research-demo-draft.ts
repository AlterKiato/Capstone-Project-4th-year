import { z } from "zod";
import { RESEARCH_DEMO_TASKS } from "@/lib/ai/adviser-research-demo";

const id = z.number().int().positive().max(2147483647);
const scope = { accountId: id, submissionId: id, version: z.string().regex(/^v[1-9]\d{0,17}$/), mode: z.literal("synthetic") };
export const researchDemoRecoveryContextSchema = z.discriminatedUnion("authority", [
    z.strictObject({ ...scope, authority: z.literal("main") }),
    z.strictObject({ ...scope, authority: z.literal("co"), assignmentId: id }),
]);
export const researchDemoQuestionIdSchema = z.enum(["primary", "explain", "verify"]);
export const researchDemoDraftSchema = z.strictObject({
    schemaVersion: z.literal(1), context: researchDemoRecoveryContextSchema,
    updatedAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    task: z.enum(RESEARCH_DEMO_TASKS), questions: z.array(researchDemoQuestionIdSchema).min(1).max(4),
});
export type ResearchDemoRecoveryContext = z.infer<typeof researchDemoRecoveryContextSchema>;
export type ResearchDemoQuestionId = z.infer<typeof researchDemoQuestionIdSchema>;
