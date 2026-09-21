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

import {
    SUBMISSION_STATUS,
} from "@/lib/constants/submission-status";

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
 * Retrieves the latest submission version
 * for a research paper.
 *
 * The submission repository already orders
 * submissions from newest to oldest.
 */
async function getLatestSubmission(
    paperId: number
): Promise<ManagedSubmission | undefined> {
    const submissions =
        await findSubmissionsByPaperId(
            paperId
        );

    return submissions[0];
}

/**
 * Creates a new research submission
 * for a Student.
 *
 * A first submission is always allowed.
 * Additional versions are allowed only when
 * the latest submission requires revision.
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

    /**
     * Check the latest submission before
     * allowing another version to be created.
     */
    const latestSubmission =
        await getLatestSubmission(
            paperId
        );

    /**
     * No previous submission means this
     * will be the initial version.
     */
    if (latestSubmission) {
        /**
         * A new version is only allowed when
         * the Adviser has requested a revision.
         */
        if (
            latestSubmission.status !==
            SUBMISSION_STATUS.REVISION_REQUIRED
        ) {
            return {
                success: false,
                message:
                    "A new submission version cannot be submitted until the current version has been reviewed and marked for revision.",
            };
        }
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
                status:
                    SUBMISSION_STATUS.SUBMITTED,
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