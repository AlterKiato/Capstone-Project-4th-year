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

const idSchema = z.coerce.number().int().positive().safe();
const repositoryRoles = [
    ROLE_IDS.ADMIN,
    ROLE_IDS.ADVISER,
    ROLE_IDS.STUDENT,
    ROLE_IDS.PANEL,
] as const;

export async function publishRepositoryPaperAction(formData: FormData) {
    await requireRole([ROLE_IDS.ADMIN]);
    const parsed = idSchema.safeParse(formData.get("paperId"));
    if (!parsed.success) return;

    await publishApprovedResearch(parsed.data);
    revalidatePath("/dashboard/admin/repository");
    revalidatePath("/dashboard/repository");
}

export async function updateRepositoryPublicationAction(formData: FormData) {
    await requireRole([ROLE_IDS.ADMIN]);
    const parsedId = idSchema.safeParse(formData.get("repositoryId"));
    const publish = formData.get("publish") === "true";
    if (!parsedId.success) return;

    await updateResearchPublication(parsedId.data, publish);
    revalidatePath("/dashboard/admin/repository");
    revalidatePath("/dashboard/repository");
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
