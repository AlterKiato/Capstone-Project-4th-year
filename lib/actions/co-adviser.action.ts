"use server";

import { getCurrentAccount } from "@/lib/auth/current-account";
import { cancelCoAdviserAssignment, delegateCoAdvisers, getCoAdviserAssignment, getCoAdviserWorkspace, getMainDelegationPanel, getRecommendationForOfficialDraft, submitCoAdviserRecommendation } from "@/lib/services/co-adviser.service";
import { createDelegatedSubmissionDocumentUrl } from "@/lib/services/submission-document.service";
import { delegatedDocumentSchema } from "@/lib/validations/co-adviser";

export async function getMainDelegationPanelAction(submissionId: unknown) { return getMainDelegationPanel(submissionId); }
export async function getCoAdviserWorkspaceAction() { return getCoAdviserWorkspace(); }
export async function getCoAdviserAssignmentAction(input: unknown) { return getCoAdviserAssignment(input); }
export async function getRecommendationForOfficialDraftAction(input: unknown) { return getRecommendationForOfficialDraft(input); }
export async function delegateCoAdvisersAction(input: unknown) { return delegateCoAdvisers(input); }
export async function cancelCoAdviserAssignmentAction(input: unknown) { return cancelCoAdviserAssignment(input); }
export async function submitCoAdviserRecommendationAction(input: unknown) { return submitCoAdviserRecommendation(input); }
export async function getDelegatedDocumentUrlAction(input: unknown) {
    const parsed = delegatedDocumentSchema.safeParse(input), actor = await getCurrentAccount();
    if (!parsed.success || !actor || actor.roleId !== 2) return null;
    return createDelegatedSubmissionDocumentUrl(parsed.data.assignmentId, parsed.data.submissionId, actor.userId);
}
