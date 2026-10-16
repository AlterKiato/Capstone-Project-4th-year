"use server";

import { revalidatePath } from "next/cache";

import { requireActiveGroupAdviser } from "@/lib/services/adviser-groups.service";

import {
    createResearchGroup,
    changeResearchGroupStatus,
} from "@/lib/services/research-group.services";

import {
    createResearchGroupSchema,
} from "@/lib/validations/research-group";

/**
 * Creates a new research group.
 *
 * Only Adviser users can create research groups.
 * The logged-in Adviser's user ID is automatically
 * assigned as the group's adviserId.
 */
export async function createResearchGroupAction(
    formData: FormData
): Promise<{ success: boolean; message: string }> {
    // Ensure that only Advisers can create research groups.
    const session = await requireActiveGroupAdviser();
    if (!session) return { success: false, message: "An active Adviser account is required." };

    // Validate the group information from the form.
    const parsed = createResearchGroupSchema.safeParse({
        groupName: formData.get("groupName"),
        strand: formData.get("strand"),
        section: formData.get("section"),
        schoolYear: formData.get("schoolYear"),
    });

    // Keep the existing schema messages visible in the creation dialog.
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues.map(issue => issue.message).join(". ") };
    }

    // Create the research group using the logged-in
    // Adviser's ID from the authenticated session.
    try {
        const result = await createResearchGroup(parsed.data, session.userId);
        if (!result.success) return { success: false, message: "The research group could not be created." };
        revalidatePath("/dashboard/adviser/groups");
        revalidatePath("/dashboard/admin");
        revalidatePath("/dashboard/adviser");
        return { success: true, message: result.message };
    } catch {
        return { success: false, message: "Creation could not be confirmed. Reload and check your groups before retrying." };
    }
}

/** The service independently derives and rechecks the acting Admin identity. */
export async function changeResearchGroupStatusAction(
    groupId: number,
    status: string
) {
    const result = await changeResearchGroupStatus(groupId, status);
    if (result.success) {
        try { revalidatePath("/dashboard/admin/groups"); }
        catch { return { ...result, message: `${result.message} Refresh the directory to see the current status.` }; }
    }
    return result;
}
