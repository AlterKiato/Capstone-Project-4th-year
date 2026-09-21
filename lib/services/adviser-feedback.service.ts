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
                SUBMISSION_STATUS.UNDER_REVIEW &&
            submission.status !==
                SUBMISSION_STATUS.SUBMITTED
        ) {
        return {
            success: false,
            message:
                "This submission is not currently available for Adviser review.",
        };
    }

    const trimmedComments =
        comments.trim();

    const trimmedDecision =
        decision.trim();

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
     * A revision-required decision moves
     * the submission into the revision state.
     *
     * Other decisions are preserved in the
     * feedback record and will be handled by
     * the later approval workflow.
     */
        if (
        trimmedDecision ===
        SUBMISSION_STATUS.REVISION_REQUIRED
    ) {
        await updateSubmissionStatus(
            submissionId,
            SUBMISSION_STATUS.REVISION_REQUIRED
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