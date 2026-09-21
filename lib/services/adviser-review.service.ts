import {
    findSubmissionForAdviser,
} from "@/lib/repositories/adviser-submission.repository";

import {
    findResearchGroupsByAdviserId,
} from "@/lib/repositories/research-group.repository";

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
 * Starts the Adviser review process
 * for a submitted research document.
 *
 * The Adviser can only review submissions
 * belonging to their own research groups.
 */
export async function startSubmissionReview(
    submissionId: number,
    adviserId: number
): Promise<
    ServiceResult<{
        id: number;
        status: string;
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
                "Only Adviser users can review submissions.",
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
                "Submission not found or you are not authorized to review it.",
        };
    }

    if (
        submission.status !==
        SUBMISSION_STATUS.SUBMITTED
    ) {
        return {
            success: false,
            message:
                "Only submitted research documents can be placed under review.",
        };
    }

    const updatedSubmission =
    await updateSubmissionStatus(
        submissionId,
        SUBMISSION_STATUS.UNDER_REVIEW
    );

    if (!updatedSubmission) {
        return {
            success: false,
            message:
                "The submission review status could not be updated.",
        };
    }

    return {
        success: true,
        message:
            "Submission is now under review.",
        data: {
            id: updatedSubmission.id,
            status:
                updatedSubmission.status,
        },
    };
}