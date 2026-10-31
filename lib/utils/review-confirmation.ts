export type ReviewConfirmation = Readonly<{ submissionId: number; comments: string; decision: string }>;

export function createReviewConfirmation(draft: ReviewConfirmation): ReviewConfirmation {
    return Object.freeze({ submissionId: draft.submissionId, comments: draft.comments, decision: draft.decision });
}

export function matchesReviewConfirmation(confirmation: ReviewConfirmation, draft: ReviewConfirmation) {
    return confirmation.submissionId === draft.submissionId && confirmation.comments === draft.comments && confirmation.decision === draft.decision;
}
