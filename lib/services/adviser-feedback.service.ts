import {
    findResearchGroupsByAdviserId,
} from "@/lib/repositories/research-group.repository";

import {
    findSubmissionForAdviser,
} from "@/lib/repositories/adviser-submission.repository";

import {
    createFeedback,
} from "@/lib/repositories/feedback.repository";

import {
    updateSubmissionStatus,
} from "@/lib/repositories/submission.repository";

import {
    updateResearchPaperStatus,
} from "@/lib/repositories/research-paper.repository";

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
    logActivity,
} from "@/lib/services/activity-log.service";

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

    const feedback =
        await createFeedback({
            submissionId,
            teacherId: adviserId,
            comments:
                trimmedComments,
            decision:
                trimmedDecision,
        });

    if (!feedback) {
        return {
            success: false,
            message:
                "The feedback could not be saved.",
        };
    }

    /**
     * Synchronizes the submission and research
     * status with the Adviser's review decision.
     */
    if (
        trimmedDecision ===
        SUBMISSION_STATUS.REVISION_REQUIRED
    ) {
        await updateSubmissionStatus(
            submissionId,
            SUBMISSION_STATUS.REVISION_REQUIRED
        );

        await updateResearchPaperStatus(
            submission.paperId,
            RESEARCH_STATUS.REVISION_REQUIRED
        );

        await logActivity(
            adviserId,
            ACTIVITY_ACTION.RESEARCH_SUBMISSION_REVISION_REQUIRED,
            `Submission ${submission.version} for research paper ${submission.paperId} was marked for revision.`
        );
        
        const notificationResult =
            await notifyStudentSubmissionRevisionRequired(
                submission.submittedBy,
                submission.version,
                submission.researchTitle
            );

        if (!notificationResult.success) {
            console.error(
                "Failed to notify student about revision-required decision:",
                notificationResult.message
            );
        }
    }

    if (
        trimmedDecision ===
        SUBMISSION_STATUS.APPROVED
    ) {
        await updateSubmissionStatus(
            submissionId,
            SUBMISSION_STATUS.APPROVED
        );

        await updateResearchPaperStatus(
            submission.paperId,
            RESEARCH_STATUS.APPROVED
        );

        await logActivity(
            adviserId,
            ACTIVITY_ACTION.RESEARCH_SUBMISSION_APPROVED,
            `Submission ${submission.version} for research paper ${submission.paperId} was approved.`
        );
        const notificationResult =
            await notifyStudentSubmissionApproved(
                submission.submittedBy,
                submission.version,
                submission.researchTitle
            );

        if (!notificationResult.success) {
            console.error(
                "Failed to notify student about approval decision:",
                notificationResult.message
            );
        }
        
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
