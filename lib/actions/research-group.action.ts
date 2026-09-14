"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

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
): Promise<void> {
    // Ensure that only Advisers can create research groups.
    const session = await requireRole([
        ROLE_IDS.ADVISER,
    ]);

    // Validate the group information from the form.
    const parsed = createResearchGroupSchema.safeParse({
        groupName: formData.get("groupName"),
        strand: formData.get("strand"),
        section: formData.get("section"),
        schoolYear: formData.get("schoolYear"),
    });

    // Stop if validation fails.
    //
    // We will improve form error handling later.
    if (!parsed.success) {
        return;
    }

    // Create the research group using the logged-in
    // Adviser's ID from the authenticated session.
    const result = await createResearchGroup(
        parsed.data,
        session.userId
    );

    // Stop if creation fails.
    if (!result.success) {
        return;
    }

    // Refresh the Adviser's groups page.
    revalidatePath("/dashboard/adviser/groups");

    // Refresh the Admin Dashboard so recent activity
    // and statistics can reflect the new group.
    revalidatePath("/dashboard/admin");
}

/**
 * Changes the status of a research group.
 *
 * Only Admin users can archive or reactivate
 * research groups for system-wide oversight.
 */
/**
 * Changes the status of a research group.
 *
 * Only Admin users can archive or reactivate
 * research groups for system-wide oversight.
 */
export async function changeResearchGroupStatusAction(
    groupId: number,
    status: string
): Promise<void> {
    // Ensure only Admin users can change
    // research group statuses.
    const session = await requireRole([
        ROLE_IDS.ADMIN,
    ]);

    // Update the research group status and
    // record the Admin responsible for the action.
    const result = await changeResearchGroupStatus(
        groupId,
        status,
        session.userId
    );

    // Stop if the operation fails.
    if (!result.success) {
        return;
    }

    // Refresh the Admin groups page.
    revalidatePath("/dashboard/admin/groups");
}