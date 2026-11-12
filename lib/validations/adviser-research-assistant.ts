import { z } from "zod";
import { RESEARCH_DEMO_LABEL, RESEARCH_DEMO_TASKS } from "@/lib/ai/adviser-research-demo";

const text = (max: number) => z.string().trim().min(1).max(max)
    .refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value));
const submissionId = z.number().int().positive().max(2147483647);
const scope = { submissionId, assignmentId: submissionId.optional() };
export const researchDemoScopeSchema = z.strictObject(scope);
export const researchDemoRequestSchema = z.strictObject({
    ...scope, task: z.enum(RESEARCH_DEMO_TASKS), excerpt: text(6000), question: text(1000),
    history: z.array(z.strictObject({ role: z.enum(["user", "assistant"]), content: text(4000) })).max(8)
        .refine(messages => messages.length % 2 === 0 && messages.every((message, index) => message.role === (index % 2 === 0 ? "user" : "assistant"))),
});
export const researchDemoAnswerSchema = z.strictObject({
    label: z.literal(RESEARCH_DEMO_LABEL), task: z.enum(RESEARCH_DEMO_TASKS),
    observation: text(1000), explanation: text(1000), suggestion: text(1000), limitation: text(1000),
});
export type ResearchDemoRequest = z.infer<typeof researchDemoRequestSchema>;
export type ResearchDemoScope = z.infer<typeof researchDemoScopeSchema>;
export type ResearchDemoAnswer = z.infer<typeof researchDemoAnswerSchema>;
export type ResearchDemoResult = { success: true; mode: "mock"; answer: ResearchDemoAnswer } |
    { success: false; mode: "denied" | "invalid" | "unsupported" | "unavailable"; message: string };
