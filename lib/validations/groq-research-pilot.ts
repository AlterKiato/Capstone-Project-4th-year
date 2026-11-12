import { z } from "zod";
import { RESEARCH_DEMO_TASKS } from "@/lib/ai/adviser-research-demo";

const id = z.number().int().positive().max(2147483647);
export const researchPilotRequestSchema = z.strictObject({
    submissionId: id, assignmentId: id.optional(),
    fixtureId: z.literal("bundled-fictional-v1"), task: z.enum(RESEARCH_DEMO_TASKS),
    questionId: z.enum(["primary", "explain-improvement", "verify-next"]),
});
export const researchPilotTermsSchema = z.strictObject({
    finalized: z.literal(true), version: z.string().regex(/^ai-p1-fictional-v[1-9]\d*$/).max(64),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
});
export const researchPilotApprovalSchema = z.strictObject({
    runId: z.uuid(), authorityRef: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
    scope: z.literal("research-fictional-v1"),
    participantIds: z.array(id).min(1).max(8).refine(ids => new Set(ids).size === ids.length),
    startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), terms: researchPilotTermsSchema,
}).refine(value => {
    const duration = Date.parse(value.endsAt) - Date.parse(value.startsAt);
    return duration > 0 && duration <= 7200000;
});
const plain = z.string().trim().min(1).max(800).refine(value =>
    !/[<>]|https?:|www\.|\]\(|javascript:|[\u0000-\u001f\u007f]|\b(?:grade|grading|approve|reject|rank)\b/i.test(value));
export const researchPilotOutputSchema = z.strictObject({ observation: plain, explanation: plain, suggestion: plain });
export const RESEARCH_PILOT_LABEL = "AI-GENERATED — FICTIONAL-TEXT PILOT — ADVISORY ONLY";
export type ResearchPilotRequest = z.infer<typeof researchPilotRequestSchema>;
export type ResearchPilotTerms = z.infer<typeof researchPilotTermsSchema>;
export type ResearchPilotApproval = z.infer<typeof researchPilotApprovalSchema>;
