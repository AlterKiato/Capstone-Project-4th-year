import "server-only";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { isSubmissionDocumentPath } from "@/lib/validations/submission-document";
import { isActivePublicationAdmin } from "@/lib/services/repository-publication.service";
import {
    findApprovedPapersForRepository,
    findRepositoryManagementEntries,
    findPublishedRepositoryFilterOptions,
    findPublishedRepositoryEntry,
    findPublishedResearchPage,
    incrementRepositoryViewCount,
} from "@/lib/repositories/repository.repository";
import type { RepositorySearchCriteria } from "@/types/repository";

export async function getRepositoryManagementData(userId: number) {
    const result = await getRepositoryManagementResult(userId);
    return result.success ? result.data : null;
}

/** Keep failed retrieval distinct from an empty authorized directory. */
export async function getRepositoryManagementResult(userId: number) {
    try {
        if (!await isActivePublicationAdmin(userId)) return { success: false, message: "Repository management unavailable. An active Admin account is required." } as const;
        const [candidates, repositoryEntries] = await Promise.all([
            findApprovedPapersForRepository(), findRepositoryManagementEntries(),
        ]);
        const eligiblePapers = candidates
            .filter(paper => isSubmissionDocumentPath(paper.fileUrl, paper.paperId, paper.version))
            .map(({ paperId, title, groupName, createdAt }) => ({ paperId, title, groupName, createdAt }));
        return { success: true, data: { eligiblePapers, repositoryEntries } } as const;
    } catch {
        console.error("Repository management could not be retrieved.");
        return { success: false, message: "Repository management could not be retrieved. Refresh to try again." } as const;
    }
}

export { publishResearch as publishApprovedResearch, changeResearchPublication as updateResearchPublication } from "@/lib/services/repository-publication.service";

export async function getPublishedResearch(criteria: RepositorySearchCriteria) {
    await requireRole(Object.values(ROLE_IDS));
    return findPublishedResearchPage(criteria);
}

export async function getPublishedResearchFilterOptions() {
    await requireRole(Object.values(ROLE_IDS));
    return findPublishedRepositoryFilterOptions();
}

export async function getPublishedResearchDetails(paperId: number) {
    await requireRole(Object.values(ROLE_IDS));
    return findPublishedRepositoryEntry(paperId);
}

export async function recordResearchRepositoryView(repositoryId: number) {
    await requireRole(Object.values(ROLE_IDS));
    await incrementRepositoryViewCount(repositoryId);
}

export { createPublishedResearchDocumentUrl } from "@/lib/services/repository-document.service";
export type { RepositoryDocumentMode } from "@/lib/validations/repository-document";
