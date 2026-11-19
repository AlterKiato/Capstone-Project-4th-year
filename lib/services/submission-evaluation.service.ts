import "server-only";
import { getCurrentMainAdviser } from "@/lib/auth/main-adviser";
import { assignmentReadSchema, assignmentRequestSchema, type EvaluationAssignment } from "@/lib/submission-evaluation";
import { changeEvaluationAssignment, readLockedEvaluationAssignment, withMainEvaluation } from "@/lib/repositories/submission-evaluation.repository";
import type { TemplateResult } from "@/lib/evaluation-templates";

export async function submissionEvaluation(input: unknown, mutate = false): Promise<TemplateResult<EvaluationAssignment>> {
    try {
        const actor = await getCurrentMainAdviser();
        if (!actor) return { success: false, message: "Current Main Adviser authority is required." };
        const parsed = mutate ? assignmentRequestSchema.safeParse(input) : assignmentReadSchema.safeParse(input);
        if (!parsed.success) return { success: false, message: "Invalid evaluation request." };
        const data = mutate ? await changeEvaluationAssignment(actor.userId, assignmentRequestSchema.parse(parsed.data)) :
            await withMainEvaluation(actor.userId, parsed.data.submissionId, async tx => (await readLockedEvaluationAssignment(tx, parsed.data.submissionId)).assignment);
        return data ? { success: true, message: mutate ? "Assignment saved. Ratings remain unsaved until your official decision." : "Assignment loaded.", data } :
            { success: false, message: "This version is unavailable or is no longer Under Review." };
    } catch {
        return { success: false, message: "Evaluation could not be confirmed. Keep your draft and reload the assignment before continuing." };
    }
}
