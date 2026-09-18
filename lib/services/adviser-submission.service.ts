import {
    findResearchGroupsByAdviserId,
} from "@/lib/repositories/research-group.repository";

import {
    findSubmissionsByGroupIds,
    findSubmissionForAdviser,
} from "@/lib/repositories/adviser-submission.repository";

import {
    findUserById,
} from "@/lib/repositories/user.repository";

import {
    ROLE_IDS,
} from "@/lib/auth/roles";

import type {
    ServiceResult,
} from "@/types/auth";

/**
 * Represents a research submission
 * visible to an Adviser.
 */
export interface AdviserSubmission {
    id: number;
    paperId: number;
    groupId: number;
    submittedBy: number;
    version: string;
    fileUrl: string;
    remarks: string | null;
    status: string;
    submittedAt: Date;
}

/**
 * Verifies that the supplied user is an Adviser
 * and retrieves the research groups owned by them.
 */
async function getAdviserGroupIds(
    adviserId: number
): Promise<ServiceResult<number[]>> {
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
                "Only Adviser users can access Adviser submissions.",
        };
    }

    const groups =
        await findResearchGroupsByAdviserId(
            adviserId
        );

    return {
        success: true,
        message:
            "Adviser research groups retrieved successfully.",
        data: groups.map(
            (group) => group.id
        ),
    };
}

/**
 * Retrieves all submissions belonging
 * to research groups owned by the Adviser.
 */
export async function getAdviserSubmissions(
    adviserId: number
): Promise<
    ServiceResult<AdviserSubmission[]>
> {
    const groupResult =
        await getAdviserGroupIds(
            adviserId
        );

    if (!groupResult.success) {
        return {
            success: false,
            message:
                groupResult.message,
        };
    }

    const groupIds =
        groupResult.data ?? [];

    if (groupIds.length === 0) {
        return {
            success: true,
            message:
                "No research groups found.",
            data: [],
        };
    }

    const submissions =
        await findSubmissionsByGroupIds(
            groupIds
        );

    return {
        success: true,
        message:
            "Adviser submissions retrieved successfully.",
        data: submissions,
    };
}

/**
 * Retrieves one submission only when
 * its research group belongs to the Adviser.
 */
export async function getAdviserSubmission(
    submissionId: number,
    adviserId: number
): Promise<
    ServiceResult<AdviserSubmission>
> {
    const groupResult =
        await getAdviserGroupIds(
            adviserId
        );

    if (!groupResult.success) {
        return {
            success: false,
            message:
                groupResult.message,
        };
    }

    const groupIds =
        groupResult.data ?? [];

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
                "Submission not found or you are not authorized to access it.",
        };
    }

    return {
        success: true,
        message:
            "Adviser submission retrieved successfully.",
        data: submission,
    };
}