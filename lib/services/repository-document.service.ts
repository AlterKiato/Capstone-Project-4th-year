import "server-only";

import { ROLE_IDS } from "@/lib/auth/roles";
import { findUserById } from "@/lib/repositories/user.repository";
import { findPublishedRepositoryEntry, incrementRepositoryDownloadCount } from "@/lib/repositories/repository.repository";
import { createResearchDocumentSignedUrl } from "@/lib/services/storage.service";
import { isSubmissionDocumentPath, submissionDocumentIdSchema } from "@/lib/validations/submission-document";
import { repositoryDocumentRequestSchema, type RepositoryDocumentMode } from "@/lib/validations/repository-document";

const repositoryRoles: readonly number[] = [ROLE_IDS.ADMIN, ROLE_IDS.ADVISER, ROLE_IDS.STUDENT, ROLE_IDS.PANEL];
const unavailable = () => ({ success: false as const, url: null, message: "The repository document is unavailable or you do not have access. Please try again." });

/** Identity comes from the authenticated Server Action, never a client parameter. */
export async function createPublishedResearchDocumentUrl(paperId: number, mode: RepositoryDocumentMode, authenticatedUserId: number) {
    if (!repositoryDocumentRequestSchema.safeParse({ paperId, mode }).success ||
        !submissionDocumentIdSchema.safeParse(authenticatedUserId).success) return unavailable();
    try {
        const user = await findUserById(authenticatedUserId);
        if (!user?.isActive || !repositoryRoles.includes(user.roleId)) return unavailable();
        // The query requires a published repository row, approved paper, and approved submission.
        const entry = await findPublishedRepositoryEntry(paperId);
        if (!entry || entry.paperId !== paperId ||
            !submissionDocumentIdSchema.safeParse(entry.id).success ||
            !submissionDocumentIdSchema.safeParse(entry.submissionId).success ||
            !isSubmissionDocumentPath(entry.fileUrl, entry.paperId, entry.version)) return unavailable();
        const url = await createResearchDocumentSignedUrl(entry.fileUrl, 300, { download: mode === "download" });
        if (mode === "download") await incrementRepositoryDownloadCount(entry.id);
        return { success: true as const, url, message: null };
    } catch {
        console.error("Repository document access could not be prepared.");
        return unavailable();
    }
}
