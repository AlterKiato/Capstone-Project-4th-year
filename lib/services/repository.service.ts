import { isSubmissionDocumentPath } from "@/lib/validations/submission-document";
import { isActivePublicationAdmin } from "@/lib/services/repository-publication.service";
import {
    findApprovedPapersForRepository,
    findRepositoryManagementEntries,
    findPublishedRepositoryFilterOptions,
    findPublishedRepositoryEntry,
    findPublishedResearchPage,
    incrementRepositoryDownloadCount,
    incrementRepositoryViewCount,
} from "@/lib/repositories/repository.repository";
import { createResearchDocumentSignedUrl } from "@/lib/services/storage.service";
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

export type RepositoryDocumentMode = "view" | "download";

export async function createPublishedResearchDocumentUrl(
    paperId: number,
    mode: RepositoryDocumentMode
) {
    let entry;
    try {
        entry = await findPublishedRepositoryEntry(paperId);
    } catch (error) {
        console.error("Failed to retrieve approved repository document:", error);
        return {
            success: false as const,
            url: null,
            message: "The research document could not be retrieved. Please try again.",
        };
    }

    if (!entry) {
        return {
            success: false as const,
            url: null,
            message: "This research document is not currently available in the repository.",
        };
    }

    const expectedPathPrefix = `research/${entry.paperId}/${entry.version}/`;
    if (
        !entry.fileUrl.trim() ||
        entry.fileUrl.startsWith("/") ||
        entry.fileUrl.includes("\\") ||
        entry.fileUrl.split("/").includes("..") ||
        !entry.fileUrl.startsWith(expectedPathPrefix) ||
        entry.fileUrl.length <= expectedPathPrefix.length
    ) {
        return {
            success: false as const,
            url: null,
            message: "The approved document has an invalid storage path. Please contact an administrator.",
        };
    }

    try {
        const signedUrl = await createResearchDocumentSignedUrl(
            entry.fileUrl,
            300,
            { download: mode === "download" }
        );
        if (mode === "download") {
            await incrementRepositoryDownloadCount(entry.id);
        }
        return { success: true as const, url: signedUrl, message: null };
    } catch (error) {
        console.error("Failed to create repository document URL:", error);
        return {
            success: false as const,
            url: null,
            message: "The document could not be prepared. It may be missing from storage; please try again or contact an administrator.",
        };
    }
}
