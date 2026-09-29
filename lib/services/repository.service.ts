import {
    findApprovedPapersForRepository,
    findRepositoryManagementEntries,
    findPublishedRepositoryFilterOptions,
    findPublishedRepositoryEntry,
    findPublishedResearchPage,
    incrementRepositoryDownloadCount,
    incrementRepositoryViewCount,
    publishApprovedPaper,
    setRepositoryPublished,
} from "@/lib/repositories/repository.repository";
import { createResearchDocumentSignedUrl } from "@/lib/services/storage.service";
import type { RepositorySearchCriteria } from "@/types/repository";

export async function getRepositoryManagementData() {
    const [eligiblePapers, repositoryEntries] = await Promise.all([
        findApprovedPapersForRepository(),
        findRepositoryManagementEntries(),
    ]);

    return { eligiblePapers, repositoryEntries };
}

export async function publishApprovedResearch(paperId: number) {
    return publishApprovedPaper(paperId);
}

export async function updateResearchPublication(
    repositoryId: number,
    isPublished: boolean
) {
    return setRepositoryPublished(repositoryId, isPublished);
}

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
