import {
    findSubmissionsByPaperId,
    findSubmissionsByUserId,
    createSubmission,
    withPaperSubmissionLock,
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
    deleteResearchDocument,
} from "@/lib/services/storage.service";

import {
    SUBMISSION_STATUS,
} from "@/lib/constants/submission-status";

import type { ServiceResult } from "@/types/auth";

import {
    notifyAdviserNewSubmission,
} from "@/lib/services/notification.service";

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
 * Determines the next submission version number
 * from the highest existing version for the research paper.
 */
function getNextSubmissionVersion(submissions: ManagedSubmission[]): string {
    let highestVersion = 0;

    for (const submission of submissions) {
        const match = /^v(\d+)$/.exec(submission.version);

        if (!match) {
            continue;
        }

        const versionNumber = Number(match[1]);

        if (versionNumber > highestVersion) {
            highestVersion = versionNumber;
        }
    }

    return `v${highestVersion + 1}`;
}

/**
 * Retrieves the submission with the highest
 * version number for a research paper.
 */
async function getLatestSubmission(
    submissions: ManagedSubmission[]
): Promise<ManagedSubmission | undefined> {
    let latestSubmission: ManagedSubmission | undefined;
    let highestVersion = 0;

    for (const submission of submissions) {
        const match = /^v(\d+)$/.exec(submission.version);

        if (!match) {
            continue;
        }

        const versionNumber = Number(match[1]);

        if (versionNumber > highestVersion) {
            highestVersion = versionNumber;
            latestSubmission = submission;
        }
    }

    return latestSubmission;
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

    let uploadedPath: string | undefined;
    try {
        const submission = await withPaperSubmissionLock(
            paperId,
            async (tx) => {
                const existingSubmissions =
                    await findSubmissionsByPaperId(paperId, tx);
                const latestSubmission =
                    await getLatestSubmission(existingSubmissions);

                if (
                    latestSubmission &&
                    latestSubmission.status !==
                        SUBMISSION_STATUS.REVISION_REQUIRED
                ) {
                    throw new Error(
                        "A new submission version cannot be submitted until the current version has been reviewed and marked for revision."
                    );
                }

                const version =
                    getNextSubmissionVersion(existingSubmissions);
                const uploadedDocument =
                    await uploadResearchDocument(
                        file,
                        paperId,
                        version
                    );
                uploadedPath = uploadedDocument.path;

                return createSubmission(
                    {
                        paperId,
                        submittedBy: studentId,
                        version,
                        fileUrl: uploadedDocument.path,
                        remarks: remarks?.trim() || null,
                        status: SUBMISSION_STATUS.SUBMITTED,
                    },
                    tx
                );
            }
        );

        // The database commit succeeded, so cleanup is no longer appropriate.
        uploadedPath = undefined;

        const notificationResult =
            await notifyAdviserNewSubmission(
                group.adviserId,
                submission.version,
                paper.title
            );

        if (!notificationResult.success) {
            console.error(
                "Failed to notify adviser about new submission:",
                notificationResult.message
            );
        }

        return {
            success: true,
            message:
                "Research submitted successfully.",
            data: submission,
        };
    } catch (error) {
        if (uploadedPath) {
            try {
                await deleteResearchDocument(uploadedPath);
            } catch (cleanupError) {
                console.error(
                    "Failed to clean up research document after submission transaction failure:",
                    cleanupError
                );
            }
        }

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
