import {
    findResearchGroupsByAdviserId,
} from "@/lib/repositories/research-group.repository";

import {
    findSubmissionForAdviser,
} from "@/lib/repositories/adviser-submission.repository";

import {
    persistAdviserDecision,
} from "@/lib/repositories/feedback.repository";

import {
    findUserById,
} from "@/lib/repositories/user.repository";

import {
    ROLE_IDS,
} from "@/lib/auth/roles";

import type {
    ServiceResult,
} from "@/types/auth";

import {
    SUBMISSION_STATUS,
} from "@/lib/constants/submission-status";

import {
    RESEARCH_STATUS,
} from "@/lib/constants/research-status";

import {
    ACTIVITY_ACTION,
} from "@/lib/constants/activity-action";

import {
    notifyStudentSubmissionApproved,
    notifyStudentSubmissionRevisionRequired,
} from "@/lib/services/notification.service";

/**
 * Creates Adviser feedback for a specific
 * research submission.
 *
 * The Adviser can only provide feedback
 * for submissions belonging to their own
 * research groups.
 */
export async function createAdviserFeedback(
    submissionId: number,
    adviserId: number,
    comments: string,
    decision: string
): Promise<
    ServiceResult<{
        id: number;
        submissionId: number;
        teacherId: number;
        comments: string;
        decision: string;
    }>
> {
    const adviser =
        await findUserById(
            adviserId
        );

    if (!adviser) {
        return {
            success: false,
            message:
                "Adviser account not found.",
        };
    }

    if (
        adviser.roleId !==
        ROLE_IDS.ADVISER
    ) {
        return {
            success: false,
            message:
                "Only Adviser users can provide feedback.",
        };
    }

    const groups =
        await findResearchGroupsByAdviserId(
            adviserId
        );

    const groupIds =
        groups.map(
            (group) => group.id
        );

    if (groupIds.length === 0) {
        return {
            success: false,
            message:
                "You do not have any research groups.",
        };
    }

    const submission =
        await findSubmissionForAdviser(
            submissionId,
            groupIds
        );

    if (!submission) {
        return {
            success: false,
            message:
                "Submission not found or you are not authorized to provide feedback.",
        };
    }

    if (
        submission.status !==
        SUBMISSION_STATUS.UNDER_REVIEW
    ) {
        return {
            success: false,
            message:
                "This submission must be under review before feedback can be submitted.",
        };
    }

    const trimmedComments =
        comments.trim();

    const trimmedDecision =
        decision.trim();

    if (
        trimmedDecision !== SUBMISSION_STATUS.REVISION_REQUIRED &&
        trimmedDecision !== SUBMISSION_STATUS.APPROVED
    ) {
        return {
            success: false,
            message:
                "A valid review decision is required.",
        };
    }

    if (!trimmedComments) {
        return {
            success: false,
            message:
                "Feedback comments are required.",
        };
    }

    if (!trimmedDecision) {
        return {
            success: false,
            message:
                "A review decision is required.",
        };
    }

    const isRevisionRequired =
        trimmedDecision ===
        SUBMISSION_STATUS.REVISION_REQUIRED;
    const activityAction = isRevisionRequired
        ? ACTIVITY_ACTION.RESEARCH_SUBMISSION_REVISION_REQUIRED
        : ACTIVITY_ACTION.RESEARCH_SUBMISSION_APPROVED;
    const researchStatus = isRevisionRequired
        ? RESEARCH_STATUS.REVISION_REQUIRED
        : RESEARCH_STATUS.APPROVED;

    // Persist feedback, statuses, and the activity entry atomically.
    const feedback = await persistAdviserDecision({
        submissionId,
        paperId: submission.paperId,
        teacherId: adviserId,
        comments: trimmedComments,
        decision: trimmedDecision,
        expectedSubmissionStatus: SUBMISSION_STATUS.UNDER_REVIEW,
        researchStatus,
        activityAction,
        activityDescription: isRevisionRequired
            ? `Submission ${submission.version} for research paper ${submission.paperId} was marked for revision.`
            : `Submission ${submission.version} for research paper ${submission.paperId} was approved.`,
    });

    const notificationResult = isRevisionRequired
        ? await notifyStudentSubmissionRevisionRequired(
            submission.submittedBy,
            submission.version,
            submission.researchTitle
        )
        : await notifyStudentSubmissionApproved(
            submission.submittedBy,
            submission.version,
            submission.researchTitle
        );

    if (!notificationResult.success) {
        console.error(
            `Failed to notify student about ${isRevisionRequired ? "revision-required decision" : "approval"}:`,
            notificationResult.message
        );
    }

    return {
        success: true,
        message:
            "Feedback submitted successfully.",
        data: {
            id: feedback.id,
            submissionId:
                feedback.submissionId,
            teacherId:
                feedback.teacherId,
            comments:
                feedback.comments,
            decision:
                feedback.decision,
        },
    };
}
