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

/**
 * Creates a temporary signed URL for a
 * research submission document.
 *
 * Only the Student who belongs to the
 * research group may access the document
 * through this action at this stage.
 */
export async function getSubmissionDownloadUrlAction(
    submissionId: number
): Promise<string | null> {
    const session =
        await requireRole([
            ROLE_IDS.STUDENT,
        ]);

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
            session.userId
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
            "Failed to create submission download URL:",
            error
        );

        return null;
    }
}