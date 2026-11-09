import "server-only";
import { getCurrentMainAdviser } from "@/lib/auth/main-adviser";
import {
    findResearchGroupsForMainAdviser,
} from "@/lib/repositories/research-group.repository";

import {
    findSubmissionsByGroupIds,
    findSubmissionForAdviser,
} from "@/lib/repositories/adviser-submission.repository";


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
    groupName: string;
    researchTitle: string;
    submittedBy: number;
    studentFirstName: string;
    studentLastName: string;
    version: string;
    fileUrl: string;
    remarks: string | null;
    status: string;
    submittedAt: Date;
}

/**
 * Verifies that the supplied user is an Adviser
 * and retrieves the research groups supervised by the current Main.
 */
async function getAdviserGroupIds(
    adviserId: number
): Promise<ServiceResult<number[]>> {
    if (!await getCurrentMainAdviser(adviserId)) return { success: false, message: "Current Main Research Adviser authority is required." };

    const groups =
        await findResearchGroupsForMainAdviser(
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
 * to research groups under Main supervision.
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
            groupIds,
            adviserId
        );

    if (!await getCurrentMainAdviser(adviserId)) return { success: false, message: "Current Main Research Adviser authority is required." };
    return {
        success: true,
        message:
            "Adviser submissions retrieved successfully.",
        data: submissions,
    };
}

/**
 * Retrieves one submission only when
 * the caller remains the current Main Adviser.
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
            groupIds,
            adviserId
        );

    if (!submission) {
        return {
            success: false,
            message:
                "Submission not found or you are not authorized to access it.",
        };
    }

    if (!await getCurrentMainAdviser(adviserId)) return { success: false, message: "Current Main Research Adviser authority is required." };
    return {
        success: true,
        message:
            "Adviser submission retrieved successfully.",
        data: submission,
    };
}