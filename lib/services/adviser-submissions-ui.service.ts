import "server-only";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getDashboardAccount } from "./dashboard-account.service";
import { getAdviserSubmission, getAdviserSubmissions } from "./adviser-submission.service";
import { readOwnedSubmissionFeedback } from "@/lib/repositories/adviser-review-details.repository";
import { findSubmissionVersionsForAdviser } from "@/lib/repositories/adviser-submission.repository";

async function currentAdviser() {
    const session = await requireRole([ROLE_IDS.ADVISER]);
    const account = await getDashboardAccount();
    return account?.roleId === ROLE_IDS.ADVISER && Number.isSafeInteger(session.userId) && session.userId > 0 ? session : null;
}

export async function getAdviserSubmissionsDirectory() {
    const session = await currentAdviser();
    if (!session) return null;
    try {
        const result = await getAdviserSubmissions(session.userId);
        if (!result.success) return null;
        // No storage paths or remarks cross the client directory boundary.
        return { email: session.email, submissions: (result.data ?? []).map(item => ({
            id: item.id, paperId: item.paperId, researchTitle: item.researchTitle, groupName: item.groupName,
            studentFirstName: item.studentFirstName, studentLastName: item.studentLastName,
            version: item.version, status: item.status, submittedAt: item.submittedAt.toISOString(),
        })) };
    } catch { return null; }
}

export async function getAdviserReviewDetails(submissionId: number) {
    const session = await currentAdviser();
    if (!session || !Number.isSafeInteger(submissionId) || submissionId <= 0) return null;
    const result = await getAdviserSubmission(submissionId, session.userId);
    if (!result.success || !result.data) return null;
    const [feedback, versions] = await Promise.allSettled([
        readOwnedSubmissionFeedback(submissionId, session.userId),
        findSubmissionVersionsForAdviser(result.data.paperId, session.userId),
    ]);
    return {
        email: session.email, submission: result.data,
        feedback: feedback.status === "fulfilled" ? feedback.value : [], feedbackUnavailable: feedback.status === "rejected",
        versions: versions.status === "fulfilled" ? versions.value.map(({ id, version, status }) => ({ id, version, status })) : [],
        versionsUnavailable: versions.status === "rejected",
    };
}
