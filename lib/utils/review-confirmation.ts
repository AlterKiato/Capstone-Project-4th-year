import type { RevisionDraft } from "@/lib/validations/revision";
import type { EvaluationAssignment, EvaluationDraft } from "@/lib/submission-evaluation";
export type ReviewConfirmation = Readonly<{ submissionId: number; comments: string; decision: string; revisionItems?: readonly Readonly<RevisionDraft>[];
    evaluation?: { assignment: EvaluationAssignment; draft: EvaluationDraft } }>;
function freezeEvaluation(value: NonNullable<ReviewConfirmation["evaluation"]>) {
    const copy = structuredClone(value);
    function freeze(object: object) { Object.values(object).forEach(value => { if (value && typeof value === "object") freeze(value); }); Object.freeze(object); }
    freeze(copy); return copy;
}

export function createReviewConfirmation(draft: ReviewConfirmation): ReviewConfirmation {
    return Object.freeze({ submissionId: draft.submissionId, comments: draft.comments, decision: draft.decision,
        ...(draft.evaluation ? { evaluation: freezeEvaluation(draft.evaluation) } : {}),
        ...(draft.revisionItems ? { revisionItems: Object.freeze(draft.revisionItems.map(item => Object.freeze({ ...item }))) } : {}) });
}

export function matchesReviewConfirmation(confirmation: ReviewConfirmation, draft: ReviewConfirmation) {
    return confirmation.submissionId === draft.submissionId && confirmation.comments === draft.comments && confirmation.decision === draft.decision &&
        JSON.stringify(confirmation.revisionItems ?? []) === JSON.stringify(draft.revisionItems ?? []) &&
        JSON.stringify(confirmation.evaluation ?? null) === JSON.stringify(draft.evaluation ?? null);
}
