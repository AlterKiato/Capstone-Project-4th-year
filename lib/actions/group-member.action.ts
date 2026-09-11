"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

import { addGroupMember, removeGroupMember, } from "@/lib/services/group-member.service";

/**
 * Adds a student to a research group.
 *
 * Only Admin users can manage research group members.
 */
export async function addGroupMemberAction(
    groupId: number,
    userId: number
): Promise<void> {
    // Ensure only Admin users can manage group members.
    await requireRole([
        ROLE_IDS.ADMIN,
    ]);

    // Add the student through the service layer.
    const result = await addGroupMember(
        groupId,
        userId
    );

    // Refresh the relevant group pages only if successful.
    if (result.success) {
        revalidatePath("/dashboard/admin/groups");
    }
}

/**
 * Removes a student from a research group.
 *
 * Only Admin users can manage research group members.
 */
export async function removeGroupMemberAction(
    groupId: number,
    userId: number
): Promise<void> {
    // Ensure only Admin users can manage group members.
    await requireRole([
        ROLE_IDS.ADMIN,
    ]);

    // Remove the student through the service layer.
    const result = await removeGroupMember(
        groupId,
        userId
    );

    // Refresh the relevant group pages only if successful.
    if (result.success) {
        revalidatePath("/dashboard/admin/groups");
    }
}