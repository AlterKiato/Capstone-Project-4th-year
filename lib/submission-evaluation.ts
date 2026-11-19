import { z } from "zod";
import type { EvaluationTemplateDraft } from "./evaluation-templates";
import { templateDraftSchema } from "./validations/evaluation-template";

export type EvaluationSnapshot = EvaluationTemplateDraft & { sourceTemplateId: number; sourceRevision: number; sourceOwnerId: number };
export type EvaluationAssignment = { revision: number; snapshot: EvaluationSnapshot | null };
const id = z.number().int().positive().max(2147483647);
const revision = z.number().int().nonnegative().max(2147483646);
export const evaluationSnapshotSchema = templateDraftSchema.safeExtend({ sourceTemplateId: id, sourceRevision: revision, sourceOwnerId: id });
export const assessmentSchema = z.object({
    criterionKey: z.string().uuid().transform(key => key.toLowerCase()),
    rating: z.number().int().min(1).max(5).nullable(),
    na: z.boolean(), reason: z.string().trim().max(2000), comment: z.string().trim().max(2000),
}).strict();
export type CriterionAssessment = z.infer<typeof assessmentSchema>;
export const evaluationDraftSchema = z.object({ assignmentRevision: revision, assessments: z.array(assessmentSchema).max(30) }).strict();
export type EvaluationDraft = z.infer<typeof evaluationDraftSchema>;
export const assignmentRequestSchema = z.object({ submissionId: id, expectedRevision: revision,
    template: z.object({ id, revision }).strict().nullable() }).strict();
export const assignmentReadSchema = z.object({ submissionId: id }).strict();

/** Shared validation for the preview; the transaction repeats it against its locked snapshot. */
export function assessEvaluation(assignment: EvaluationAssignment, input: unknown) {
    const draft = evaluationDraftSchema.parse(input);
    if (draft.assignmentRevision !== assignment.revision) throw new Error("Evaluation assignment changed. Reload before finalizing; keep your feedback draft.");
    if (!assignment.snapshot) {
        if (draft.assessments.length) throw new Error("No evaluation template is currently assigned.");
        return { earned: 0, possible: 0, items: [] as CriterionAssessment[] };
    }
    const snapshot = evaluationSnapshotSchema.parse(assignment.snapshot);
    const rows = new Map(draft.assessments.map(row => [row.criterionKey, row]));
    if (rows.size !== draft.assessments.length || rows.size !== snapshot.criteria.length ||
        snapshot.criteria.some(criterion => !rows.has(criterion.key.toLowerCase()))) throw new Error("Assess every assigned criterion exactly once.");
    let earned = 0, possible = 0;
    const maximum = snapshot.scale.levels.at(-1)!.points;
    const items = snapshot.criteria.map(criterion => {
        const row = rows.get(criterion.key.toLowerCase())!;
        if (row.na) {
            if (!criterion.allowsNa || row.rating !== null || !row.reason) throw new Error(`A permitted N/A needs a reason: ${criterion.name}.`);
        } else {
            if (row.reason || !snapshot.scale.levels.some(level => level.points === row.rating)) throw new Error(`Choose a rating: ${criterion.name}.`);
            earned += row.rating!; possible += maximum;
        }
        return row;
    });
    if (possible === 0) throw new Error("Select a numeric rating for at least one criterion. An all-N/A evaluation cannot be finalized.");
    return { earned, possible, items };
}

export function evaluationFromForm(value: FormDataEntryValue | null): unknown {
    if (value === null) return undefined; // Existing no-template callers remain compatible, checked under lock.
    if (typeof value !== "string" || value.length > 150000) throw new Error("Invalid evaluation draft.");
    return evaluationDraftSchema.parse(JSON.parse(value));
}
