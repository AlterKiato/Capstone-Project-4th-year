import { z } from "zod";
import type { TemplateScale } from "./evaluation-templates";

const id = z.number().int().positive().max(2147483647);
export const studentEvaluationRequestSchema = z.object({
    paperId: id, submissionId: id, feedbackId: id, version: z.string().min(1).max(20),
}).strict();
export type StudentEvaluationRequest = z.infer<typeof studentEvaluationRequestSchema>;
export type StudentEvaluation = {
    id: number; submissionId: number; feedbackId: number; version: string; finalizedAt: string;
    templateName: string; templateRevision: number; scale: TemplateScale; earned: number; possible: number;
    criteria: { name: string; description: string; rating: number | null; na: boolean; reason: string; comment: string }[];
};
export type StudentEvaluationResult =
    | { success: true; data: StudentEvaluation | null }
    | { success: false; message: string };
