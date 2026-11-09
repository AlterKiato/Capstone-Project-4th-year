import "server-only";

import { ROLE_IDS } from "@/lib/auth/roles";
import { getCurrentMainAdviser } from "@/lib/auth/main-adviser";
import { getCurrentAccount } from "@/lib/auth/current-account";
import { readDelegatedDocument } from "@/lib/repositories/co-adviser.repository";
import { delegatedDocumentSchema } from "@/lib/validations/co-adviser";
import { findSubmissionById } from "@/lib/repositories/submission.repository";
import { findResearchPaperById } from "@/lib/repositories/research-paper.repository";
import { findResearchGroupById } from "@/lib/repositories/research-group.repository";
import { findGroupMember } from "@/lib/repositories/group-member.repository";
import { findUserById } from "@/lib/repositories/user.repository";
import { createResearchDocumentSignedUrl } from "@/lib/services/storage.service";
import { isSubmissionDocumentPath, submissionDocumentIdSchema, submissionDocumentPurposeSchema, type SubmissionDocumentPurpose } from "@/lib/validations/submission-document";

const ADVISER_REVIEW_PDF_SIGNED_URL_SECONDS = 1800;

/** The caller supplies only the authenticated session's user ID, never a client identity. */
export async function createSubmissionDocumentUrl(submissionId: number, authenticatedUserId: number, purpose: SubmissionDocumentPurpose = "download"): Promise<string | null> {
    if (!submissionDocumentIdSchema.safeParse(submissionId).success ||
        !submissionDocumentIdSchema.safeParse(authenticatedUserId).success ||
        !submissionDocumentPurposeSchema.safeParse(purpose).success) return null;

    try {
        // A stale session must not retain a revoked role or disabled account's access.
        const user = await findUserById(authenticatedUserId);
        if (!user?.isActive || !([ROLE_IDS.STUDENT, ROLE_IDS.ADVISER] as number[]).includes(user.roleId)) return null;
        if (purpose === "adviser-review" && user.roleId !== ROLE_IDS.ADVISER) return null;
        const submission = await findSubmissionById(submissionId);
        if (!submission) return null;
        const paper = await findResearchPaperById(submission.paperId);
        if (!paper) return null;
        const group = await findResearchGroupById(paper.groupId);
        if (!group) return null;
        if (user.roleId === ROLE_IDS.STUDENT) {
            if (!await findGroupMember(group.id, user.id)) return null;
        } else if (!await getCurrentMainAdviser(user.id)) {
            return null;
        }
        // Bind the persisted object to this exact paper/version before using the privileged client.
        if (!isSubmissionDocumentPath(submission.fileUrl, paper.id, submission.version)) return null;
        if (user.roleId === ROLE_IDS.ADVISER && !await getCurrentMainAdviser(user.id)) return null;
        const url = await createResearchDocumentSignedUrl(submission.fileUrl,
            purpose === "adviser-review" ? ADVISER_REVIEW_PDF_SIGNED_URL_SECONDS : 300);
        return user.roleId === ROLE_IDS.ADVISER && !await getCurrentMainAdviser(user.id) ? null : url;
    } catch {
        console.error("Submission document access could not be prepared.");
        return null;
    }
}

/** Exact-assignment capability; terminal assignments cannot mint a new URL. */
export async function createDelegatedSubmissionDocumentUrl(assignmentId: number, submissionId: number, authenticatedUserId: number): Promise<string | null> {
    if (!delegatedDocumentSchema.safeParse({ assignmentId, submissionId }).success) return null;
    try {
        const account = await getCurrentAccount();
        if (!account || account.userId !== authenticatedUserId || account.roleId !== ROLE_IDS.ADVISER) return null;
        const document = await readDelegatedDocument(account.userId, assignmentId, submissionId);
        if (!document || !isSubmissionDocumentPath(document.fileUrl, document.paperId, document.version)) return null;
        const url = await createResearchDocumentSignedUrl(document.fileUrl, 300);
        const current = await getCurrentAccount();
        if (!current || current.userId !== account.userId || current.roleId !== ROLE_IDS.ADVISER) return null;
        const fresh = await readDelegatedDocument(account.userId, assignmentId, submissionId);
        return fresh && fresh.paperId === document.paperId && fresh.version === document.version && fresh.fileUrl === document.fileUrl ? url : null;
    } catch { return null; }
}
