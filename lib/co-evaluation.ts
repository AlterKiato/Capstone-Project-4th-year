import { z } from "zod";
import { assessmentSchema, assessEvaluation, type EvaluationAssignment, type EvaluationDraft } from "./submission-evaluation";
export const coAssessmentSchema = z.object({ version: z.literal(1), earned: z.number().int().min(1).max(150),
    possible: z.number().int().min(1).max(150), items: z.array(assessmentSchema).min(1).max(30) }).strict();
export type CoAssessment = z.infer<typeof coAssessmentSchema>;
export type CoAssessmentView = { assignment: EvaluationAssignment; draft: EvaluationDraft; earned: number; possible: number; stale: boolean };
export function coAssessmentView(assignment: EvaluationAssignment, input: unknown, currentRevision: number): CoAssessmentView {
    const data = coAssessmentSchema.parse(input);
    const draft = { assignmentRevision: assignment.revision, assessments: data.items };
    const points = assessEvaluation(assignment, draft);
    if (points.earned !== data.earned || points.possible !== data.possible) throw Error("Recorded recommendation points do not match the frozen definition.");
    return { assignment, draft, earned: points.earned, possible: points.possible, stale: currentRevision !== assignment.revision };
}
