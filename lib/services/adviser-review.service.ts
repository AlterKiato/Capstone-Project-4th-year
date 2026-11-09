import "server-only";
import { getCurrentMainAdviser } from "@/lib/auth/main-adviser";

import {
    findSubmissionForAdviser,
} from "@/lib/repositories/adviser-submission.repository";

import {
    findResearchGroupsForMainAdviser,
} from "@/lib/repositories/research-group.repository";

import {
    updateSubmissionStatusForAdviser,
} from "@/lib/repositories/submission.repository";


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
 * The current Main Adviser can review submissions
 * under current Main supervision across all research groups.
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
    if (!await getCurrentMainAdviser(adviserId)) {
        return {
            success: false,
            message:
                "Current Main Research Adviser authority is required to review submissions.",
        };
    }

    const groups =
        await findResearchGroupsForMainAdviser(
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
            groupIds,
            adviserId
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
    await updateSubmissionStatusForAdviser(
        submissionId,
        SUBMISSION_STATUS.UNDER_REVIEW,
        adviserId
    );

    if (!updatedSubmission) {
        return {
            success: false,
            message:
                "The submission has changed or review is unavailable. Refresh before starting review.",
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
