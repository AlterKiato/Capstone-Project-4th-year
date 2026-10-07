import "server-only";

import { ROLE_IDS } from "@/lib/auth/roles";
import { findSubmissionById } from "@/lib/repositories/submission.repository";
import { findResearchPaperById } from "@/lib/repositories/research-paper.repository";
import { findResearchGroupById } from "@/lib/repositories/research-group.repository";
import { findGroupMember } from "@/lib/repositories/group-member.repository";
import { findUserById } from "@/lib/repositories/user.repository";
import { createResearchDocumentSignedUrl } from "@/lib/services/storage.service";
import { isSubmissionDocumentPath, submissionDocumentIdSchema } from "@/lib/validations/submission-document";

/** The caller supplies only the authenticated session's user ID, never a client identity. */
export async function createSubmissionDocumentUrl(submissionId: number, authenticatedUserId: number): Promise<string | null> {
    if (!submissionDocumentIdSchema.safeParse(submissionId).success ||
        !submissionDocumentIdSchema.safeParse(authenticatedUserId).success) return null;

    try {
        // A stale session must not retain a revoked role or disabled account's access.
        const user = await findUserById(authenticatedUserId);
        if (!user?.isActive || !([ROLE_IDS.STUDENT, ROLE_IDS.ADVISER] as number[]).includes(user.roleId)) return null;
        const submission = await findSubmissionById(submissionId);
        if (!submission) return null;
        const paper = await findResearchPaperById(submission.paperId);
        if (!paper) return null;
        const group = await findResearchGroupById(paper.groupId);
        if (!group) return null;
        if (user.roleId === ROLE_IDS.STUDENT) {
            if (!await findGroupMember(group.id, user.id)) return null;
        } else if (group.adviserId !== user.id) {
            return null;
        }
        // Bind the persisted object to this exact paper/version before using the privileged client.
        if (!isSubmissionDocumentPath(submission.fileUrl, paper.id, submission.version)) return null;
        return await createResearchDocumentSignedUrl(submission.fileUrl, 300);
    } catch {
        console.error("Submission document access could not be prepared.");
        return null;
    }
}
