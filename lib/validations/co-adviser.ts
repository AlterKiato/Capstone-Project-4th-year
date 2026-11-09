import { z } from "zod";

export const supervisionId = z.number().int().positive().max(2147483647);
export const delegateReviewSchema = z.object({
    submissionId: supervisionId,
    coAdviserIds: z.array(supervisionId).min(1).max(20).refine(ids => new Set(ids).size === ids.length),
}).strict();
export const cancelDelegationSchema = z.object({ assignmentId: supervisionId, submissionId: supervisionId, confirmed: z.literal(true) }).strict();
export const recommendationSchema = z.object({
    assignmentId: supervisionId, submissionId: supervisionId,
    recommendation: z.string().trim().min(1).max(20000).refine(text => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)),
}).strict();
export const delegatedDocumentSchema = z.object({ assignmentId: supervisionId, submissionId: supervisionId }).strict();

export const isDelegatedReviewEligible = (status: string) => status === "Submitted" || status === "Under Review";
