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
    try {
        if (!await isActivePublicationAdmin(userId)) return null;
        const [candidates, repositoryEntries] = await Promise.all([
            findApprovedPapersForRepository(), findRepositoryManagementEntries(),
        ]);
        const eligiblePapers = candidates
            .filter(paper => isSubmissionDocumentPath(paper.fileUrl, paper.paperId, paper.version))
            .map(({ paperId, title, groupName, createdAt }) => ({ paperId, title, groupName, createdAt }));
        return { eligiblePapers, repositoryEntries };
    } catch {
        console.error("Repository management could not be retrieved.");
        return null;
    }
}

export { publishResearch as publishApprovedResearch, changeResearchPublication as updateResearchPublication } from "@/lib/services/repository-publication.service";

export async function getPublishedResearch(criteria: RepositorySearchCriteria) {
    return findPublishedResearchPage(criteria);
}

export async function getPublishedResearchFilterOptions() {
    return findPublishedRepositoryFilterOptions();
}

export async function getPublishedResearchDetails(paperId: number) {
    return findPublishedRepositoryEntry(paperId);
}

export async function recordResearchRepositoryView(repositoryId: number) {
    await incrementRepositoryViewCount(repositoryId);
}

export { createPublishedResearchDocumentUrl } from "@/lib/services/repository-document.service";
export type { RepositoryDocumentMode } from "@/lib/validations/repository-document";
