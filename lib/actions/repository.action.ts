"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import {
    createPublishedResearchDownloadUrl,
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

export async function getRepositoryDownloadUrlAction(
    paperIdInput: unknown
): Promise<string | null> {
    await requireRole(repositoryRoles);
    const parsed = idSchema.safeParse(paperIdInput);
    if (!parsed.success) return null;

    return createPublishedResearchDownloadUrl(parsed.data);
}
