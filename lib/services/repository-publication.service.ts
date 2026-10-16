import "server-only";
import { ROLE_IDS } from "@/lib/auth/roles";
import { publicationIdSchema } from "@/lib/validations/repository-publication";
import { isSubmissionDocumentPath } from "@/lib/validations/submission-document";
import { findUserById } from "@/lib/repositories/user.repository";
import { findPublicationById, withPublicationContext, writePublication } from "@/lib/repositories/repository-publication.repository";
import { createResearchDocumentSignedUrl } from "@/lib/services/storage.service";

export interface PublicationResult { success: boolean; message: string; uncertain?: boolean; }
const denied = (): PublicationResult => ({ success: false, message: "The publication request could not be completed." });

export async function isActivePublicationAdmin(userId: number): Promise<boolean> {
    if (!publicationIdSchema.safeParse(userId).success) return false;
    const user = await findUserById(userId);
    return Boolean(user?.isActive && user.roleId === ROLE_IDS.ADMIN);
}

/** Identity comes exclusively from the authenticated action session. */
export async function publishResearch(paperId: number, userId: number, published = true, repositoryId?: number): Promise<PublicationResult> {
    let writeAttempted = false;
    if (!publicationIdSchema.safeParse(paperId).success || !publicationIdSchema.safeParse(userId).success ||
        typeof published !== "boolean") return denied();
    try {
        // Reject unauthorized callers before looking up the resource; recheck under lock as well.
        if (!await isActivePublicationAdmin(userId)) return denied();
        return await withPublicationContext(paperId, userId, async ({ tx, user, paper, submission, entry }) => {
            if (!user?.isActive || user.roleId !== ROLE_IDS.ADMIN || !paper ||
                (repositoryId !== undefined && entry?.id !== repositoryId)) return denied();
            if (entry?.isPublished === published) return {
                success: false, message: published ? "This research is already published." : "This research is already hidden."
            };
            if (published) {
                if (paper.status !== "Approved" || !submission ||
                    !isSubmissionDocumentPath(submission.fileUrl, paper.id, submission.version)) return {
                    success: false, message: "Only approved research with a valid approved PDF can be published."
                };
                // Supabase signing verifies that the persisted private object exists; URL stays server-side.
                await createResearchDocumentSignedUrl(submission.fileUrl, 300);
            } else if (!entry) return denied();
            writeAttempted = true;
            const saved = await writePublication(tx, paper.id, entry?.id, published);
            if (!saved) return denied();
            return { success: true, message: published ? "Research published successfully." : "Research hidden successfully." };
        });
    } catch {
        console.error("Repository publication could not be completed.");
        return writeAttempted ? { success: false, uncertain: true, message: "Publication could not be confirmed. Refresh and verify repository visibility before retrying." } : denied();
    }
}

export async function changeResearchPublication(repositoryId: number, published: boolean, userId: number): Promise<PublicationResult> {
    if (!publicationIdSchema.safeParse(repositoryId).success) return denied();
    try {
        if (!await isActivePublicationAdmin(userId)) return denied();
        const entry = await findPublicationById(repositoryId);
        if (!entry) return denied();
        return publishResearch(entry.paperId, userId, published, entry.id);
    } catch { return denied(); }
}
