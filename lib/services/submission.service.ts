import {
    findSubmissionsByPaperId,
    findSubmissionsByUserId,
    createSubmission,
} from "@/lib/repositories/submission.repository";

import {
    findResearchPaperById,
} from "@/lib/repositories/research-paper.repository";

import {
    findResearchGroupById,
} from "@/lib/repositories/research-group.repository";

import {
    findGroupMember,
} from "@/lib/repositories/group-member.repository";

import {
    uploadResearchDocument,
} from "@/lib/services/storage.service";

import type { ServiceResult } from "@/types/auth";

/**
 * Represents a research submission
 * stored in the database.
 */
export interface ManagedSubmission {
    id: number;
    paperId: number;
    submittedBy: number;
    version: string;
    fileUrl: string;
    remarks: string | null;
    status: string;
    submittedAt: Date;
}

/**
 * Retrieves all submissions belonging
 * to a research paper.
 */
export async function getSubmissionsByPaper(
    paperId: number
): Promise<
    ServiceResult<ManagedSubmission[]>
> {
    const paper =
        await findResearchPaperById(
            paperId
        );

    if (!paper) {
        return {
            success: false,
            message:
                "Research paper not found.",
        };
    }

    const submissions =
        await findSubmissionsByPaperId(
            paperId
        );

    return {
        success: true,
        message:
            "Submissions retrieved successfully.",
        data: submissions,
    };
}

/**
 * Retrieves all submissions made
 * by a specific Student.
 */
export async function getSubmissionsByStudent(
    studentId: number
): Promise<
    ServiceResult<ManagedSubmission[]>
> {
    const submissions =
        await findSubmissionsByUserId(
            studentId
        );

    return {
        success: true,
        message:
            "Student submissions retrieved successfully.",
        data: submissions,
    };
}

/**
 * Determines the next submission version
 * for a research paper.
 */
async function getNextSubmissionVersion(
    paperId: number
): Promise<string> {
    const submissions =
        await findSubmissionsByPaperId(
            paperId
        );

    return `v${submissions.length + 1}`;
}

/**
 * Creates a new research submission
 * for a Student.
 *
 * The uploaded File is stored in Supabase
 * before its Storage path is saved to the
 * PostgreSQL submissions table.
 */
export async function submitResearch(
    paperId: number,
    studentId: number,
    file: File,
    remarks?: string
): Promise<
    ServiceResult<ManagedSubmission>
> {
    const paper =
        await findResearchPaperById(
            paperId
        );

    if (!paper) {
        return {
            success: false,
            message:
                "Research paper not found.",
        };
    }

    const group =
        await findResearchGroupById(
            paper.groupId
        );

    if (!group) {
        return {
            success: false,
            message:
                "Research group associated with this paper was not found.",
        };
    }

    if (group.status !== "active") {
        return {
            success: false,
            message:
                "Research group is not currently active.",
        };
    }

    const membership =
        await findGroupMember(
            paper.groupId,
            studentId
        );

    if (!membership) {
        return {
            success: false,
            message:
                "Student is not a member of this research group.",
        };
    }

    if (!(file instanceof File)) {
        return {
            success: false,
            message:
                "A research submission file is required.",
        };
    }

    if (file.size <= 0) {
        return {
            success: false,
            message:
                "The research submission file is empty.",
        };
    }

    /*
     * Generate the version before
     * creating the Storage path.
     */
    const version =
        await getNextSubmissionVersion(
            paperId
        );

    try {
        /*
         * Upload the actual document to
         * Supabase Storage.
         */
        const uploadedDocument =
            await uploadResearchDocument(
                file,
                paperId,
                version
            );

        /*
         * Save the returned Storage path
         * in the database.
         */
        const submission =
            await createSubmission({
                paperId,
                submittedBy: studentId,
                version,
                fileUrl:
                    uploadedDocument.path,
                remarks:
                    remarks?.trim() ||
                    null,
                status: "Submitted",
            });

        return {
            success: true,
            message:
                "Research submitted successfully.",
            data: submission,
        };
    } catch (error) {
        console.error(
            "Research submission failed:",
            error
        );

        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "The research submission could not be completed.",
        };
    }
}