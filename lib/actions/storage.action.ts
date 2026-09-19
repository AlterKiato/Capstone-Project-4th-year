"use server";

import {
    requireRole,
} from "@/lib/auth/authorization";

import {
    ROLE_IDS,
} from "@/lib/auth/roles";

import {
    findSubmissionById,
} from "@/lib/repositories/submission.repository";

import {
    findResearchPaperById,
} from "@/lib/repositories/research-paper.repository";

import {
    findGroupMember,
} from "@/lib/repositories/group-member.repository";

import {
    createResearchDocumentSignedUrl,
} from "@/lib/services/storage.service";

import {
    getAdviserSubmission,
} from "@/lib/services/adviser-submission.service";

/**
 * Creates a temporary signed URL for a
 * research submission document accessed
 * by a Student.
 */
async function getStudentSubmissionDownloadUrl(
    submissionId: number,
    studentId: number
): Promise<string | null> {
    const submission =
        await findSubmissionById(
            submissionId
        );

    if (!submission) {
        return null;
    }

    const paper =
        await findResearchPaperById(
            submission.paperId
        );

    if (!paper) {
        return null;
    }

    const membership =
        await findGroupMember(
            paper.groupId,
            studentId
        );

    if (!membership) {
        return null;
    }

    if (!submission.fileUrl.trim()) {
        return null;
    }

    try {
        return await createResearchDocumentSignedUrl(
            submission.fileUrl,
            300
        );
    } catch (error) {
        console.error(
            "Failed to create student submission download URL:",
            error
        );

        return null;
    }
}

/**
 * Creates a temporary signed URL for a
 * research submission accessed by an Adviser.
 *
 * The Adviser can only access submissions
 * belonging to their own research groups.
 */
async function getAdviserSubmissionDownloadUrl(
    submissionId: number,
    adviserId: number
): Promise<string | null> {
    const result = await getAdviserSubmission(
        submissionId,
        adviserId
    );

    if (!result.success || !result.data) {
        return null;
    }

    const submission = result.data;

    if (!submission.fileUrl.trim()) {
        return null;
    }

    try {
        return await createResearchDocumentSignedUrl(
            submission.fileUrl,
            300
        );
    } catch (error) {
        console.error(
            "Failed to create adviser submission download URL:",
            error
        );

        return null;
    }
}

/**
 * Creates a temporary signed URL for a
 * research submission document.
 *
 * Students can access documents belonging
 * to their research groups.
 *
 * Advisers can access documents belonging
 * to their own research groups.
 */
export async function getSubmissionDownloadUrlAction(
    submissionId: number
): Promise<string | null> {
    const session =
        await requireRole([
            ROLE_IDS.STUDENT,
            ROLE_IDS.ADVISER,
        ]);

    if (
        session.roleId ===
        ROLE_IDS.STUDENT
    ) {
        return getStudentSubmissionDownloadUrl(
            submissionId,
            session.userId
        );
    }

    if (
        session.roleId ===
        ROLE_IDS.ADVISER
    ) {
        return getAdviserSubmissionDownloadUrl(
            submissionId,
            session.userId
        );
    }

    return null;
}