"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import {
    createPublishedResearchDocumentUrl,
    publishApprovedResearch,
    updateResearchPublication,
} from "@/lib/services/repository.service";

import { publicationIdSchema, publicationStateSchema } from "@/lib/validations/repository-publication";
import type { PublicationResult } from "@/lib/services/repository-publication.service";

const idSchema = z.coerce.number().int().positive().safe();
const repositoryRoles = [
    ROLE_IDS.ADMIN,
    ROLE_IDS.ADVISER,
    ROLE_IDS.STUDENT,
    ROLE_IDS.PANEL,
] as const;

export async function publishRepositoryPaperAction(previous: PublicationResult, formData: FormData): Promise<PublicationResult> {
    void previous;
    const session = await requireRole([ROLE_IDS.ADMIN]);
    if (!(formData instanceof FormData)) return { success: false, message: "The publication request is invalid." };
    const parsed = publicationIdSchema.safeParse(formData.get("paperId"));
    if (!parsed.success) return { success: false, message: "The publication request is invalid." };
    const result = await publishApprovedResearch(parsed.data, session.userId);
    if (result.success) refreshRepository();
    return result;
}

export async function updateRepositoryPublicationAction(previous: PublicationResult, formData: FormData): Promise<PublicationResult> {
    void previous;
    const session = await requireRole([ROLE_IDS.ADMIN]);
    if (!(formData instanceof FormData)) return { success: false, message: "The publication request is invalid." };
    const id = publicationIdSchema.safeParse(formData.get("repositoryId"));
    const state = publicationStateSchema.safeParse(formData.get("publish"));
    if (!id.success || !state.success) return { success: false, message: "The publication request is invalid." };
    const result = await updateResearchPublication(id.data, state.data, session.userId);
    if (result.success) refreshRepository();
    return result;
}

function refreshRepository() {
    revalidatePath("/dashboard/admin/repository");
    revalidatePath("/dashboard/repository", "layout");
}

const documentRequestSchema = z.object({
    paperId: idSchema,
    mode: z.enum(["view", "download"]),
});

export async function getRepositoryDocumentUrlAction(
    paperIdInput: unknown,
    modeInput: unknown
) {
    await requireRole(repositoryRoles);
    const parsed = documentRequestSchema.safeParse({
        paperId: paperIdInput,
        mode: modeInput,
    });
    if (!parsed.success) {
        return {
            success: false as const,
            url: null,
            message: "The document request is invalid. Refresh the page and try again.",
        };
    }

    return createPublishedResearchDocumentUrl(
        parsed.data.paperId,
        parsed.data.mode
    );
}
