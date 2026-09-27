import {
    findApprovedPapersForRepository,
    findRepositoryManagementEntries,
    findPublishedRepositoryEntries,
    findPublishedRepositoryEntry,
    incrementRepositoryDownloadCount,
    incrementRepositoryViewCount,
    publishApprovedPaper,
    setRepositoryPublished,
} from "@/lib/repositories/repository.repository";
import { createResearchDocumentSignedUrl } from "@/lib/services/storage.service";

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

export async function getPublishedResearch() {
    return findPublishedRepositoryEntries();
}

export async function getPublishedResearchDetails(paperId: number) {
    return findPublishedRepositoryEntry(paperId);
}

export async function recordResearchRepositoryView(repositoryId: number) {
    await incrementRepositoryViewCount(repositoryId);
}

export async function createPublishedResearchDownloadUrl(paperId: number) {
    const entry = await findPublishedRepositoryEntry(paperId);
    if (!entry?.fileUrl) return null;

    try {
        const signedUrl = await createResearchDocumentSignedUrl(
            entry.fileUrl,
            300
        );
        await incrementRepositoryDownloadCount(entry.id);
        return signedUrl;
    } catch (error) {
        console.error("Failed to create repository document URL:", error);
        return null;
    }
}
