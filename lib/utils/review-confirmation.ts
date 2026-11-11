import type { RevisionDraft } from "@/lib/validations/revision";
export type ReviewConfirmation = Readonly<{ submissionId: number; comments: string; decision: string; revisionItems?: readonly Readonly<RevisionDraft>[] }>;

export function createReviewConfirmation(draft: ReviewConfirmation): ReviewConfirmation {
    return Object.freeze({ submissionId: draft.submissionId, comments: draft.comments, decision: draft.decision,
        ...(draft.revisionItems ? { revisionItems: Object.freeze(draft.revisionItems.map(item => Object.freeze({ ...item }))) } : {}) });
}

export function matchesReviewConfirmation(confirmation: ReviewConfirmation, draft: ReviewConfirmation) {
    return confirmation.submissionId === draft.submissionId && confirmation.comments === draft.comments && confirmation.decision === draft.decision &&
        JSON.stringify(confirmation.revisionItems ?? []) === JSON.stringify(draft.revisionItems ?? []);
}
