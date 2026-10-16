import "server-only";
import { getActiveAIAccount } from "@/lib/auth/ai-authorization";
import { researchGroupStatusSchema } from "@/lib/validations/research-group";
import {
    findAllResearchGroups,
    createResearchGroup as createResearchGroupRecord,
    updateResearchGroupStatusForAdmin,
    findResearchGroupsByAdviserId,
} from "@/lib/repositories/research-group.repository";

import {
    findUsersByRoleId,
} from "@/lib/repositories/user.repository";

import { ROLE_IDS } from "@/lib/auth/roles";

import { logActivity } from "@/lib/services/activity-log.service";

import { sendNotification } from "@/lib/services/notification.service";

import type { ServiceResult } from "@/types/auth";

/**
 * Research group information used by the
 * Research Group Management module.
 */
export interface ManagedResearchGroup {
    id: number;
    groupName: string;
    strand: string;
    section: string;
    schoolYear: string;
    adviserId: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Data required for an Adviser to create
 * a research group.
 *
 * The adviser ID is intentionally excluded
 * because it comes from the authenticated session.
 */
export interface CreateManagedResearchGroupInput {
    groupName: string;
    strand: string;
    section: string;
    schoolYear: string;
}

/**
 * Retrieves all research groups for
 * the Admin Group Management module.
 */
export async function getResearchGroups(): Promise<
    ServiceResult<ManagedResearchGroup[]>
> {
    try {
        if (!await getActiveAIAccount(ROLE_IDS.ADMIN)) return groupDenied;
        return { success: true, message: "Research groups retrieved successfully.", data: await findAllResearchGroups() };
    } catch { return { success: false, message: "Research groups could not be retrieved. Refresh to try again." }; }
}

export type GroupStatusResult = ServiceResult & { kind: "success" | "validation" | "denied" | "invalid" | "uncertain"; uncertain?: boolean };
const groupDenied = { success: false, kind: "denied", message: "Research group management unavailable. An active Admin account is required." } as const;

/**
 * Creates a research group for the authenticated Adviser.
 *
 * After successful creation:
 * - An activity log is recorded.
 * - All Admin users receive a notification.
 */
export async function createResearchGroup(
    data: CreateManagedResearchGroupInput,
    adviserId: number
): Promise<ServiceResult<ManagedResearchGroup>> {
    // Create the research group.
    const group = await createResearchGroupRecord({
        groupName: data.groupName,
        strand: data.strand,
        section: data.section,
        schoolYear: data.schoolYear,
        adviserId,
    });

    // Record the successful research group creation.
    await logActivity(
        adviserId,
        "Research Group Created",
        `Created research group "${group.groupName}".`
    );

    // Find all users with the Admin role.
    const admins = await findUsersByRoleId(
        ROLE_IDS.ADMIN
    );

    // Notify every Admin about the new research group.
    await Promise.all(
        admins.map((admin) =>
            sendNotification(
                admin.id,
                "New Research Group Created",
                `A new research group named "${group.groupName}" was created.`
            )
        )
    );

    return {
        success: true,
        message: "Research group created successfully.",
        data: group,
    };
}

/**
 * Updates the status of a research group.
 *
 * Derives the acting Admin from the authenticated session and rechecks
 * current account authority inside the group mutation transaction.
 *
 * The group's Adviser is notified after the
 * status is successfully changed.
 */
export async function changeResearchGroupStatus(
    id: number,
    status: string
): Promise<GroupStatusResult> {
    let attempted = false;
    try {
        const actorId = await getActiveAIAccount(ROLE_IDS.ADMIN);
        if (!actorId) return groupDenied;
        const parsed = researchGroupStatusSchema.safeParse({ groupId: id, status });
        if (!parsed.success) return { success: false, kind: "validation", message: "Invalid group or status. Refresh and check the selected group." };
        attempted = true;
        const result = await updateResearchGroupStatusForAdmin(actorId, parsed.data.groupId, parsed.data.status);
        if (result.kind === "denied") return groupDenied;
        if (result.kind === "missing") return { success: false, kind: "invalid", message: "Research group not found. Refresh the directory." };
        if (result.kind === "invalid") return { success: false, kind: "invalid", message: "This group status transition is not available. Refresh and verify the current status." };
        const group = result.group;
        // The group transaction is confirmed. Both existing side effects are still attempted.
        const effects = await Promise.allSettled([
            logActivity(actorId, status === "active" ? "Research Group Activated" : "Research Group Archived", `Research group "${group.groupName}" was ${status}.`),
            sendNotification(group.adviserId, status === "active" ? "Research Group Reactivated" : "Research Group Archived", status === "active"
                ? `Your research group "${group.groupName}" has been reactivated by an Administrator.`
                : `Your research group "${group.groupName}" has been archived by an Administrator.`),
        ]);
        return { success: true, kind: "success", message: "Research group status updated successfully." +
            (effects.some(effect => effect.status === "rejected" || (effect.value && !effect.value.success)) ? " Activity recording or notification delivery was unavailable." : "") };
    } catch {
        return attempted ? { success: false, kind: "uncertain", uncertain: true, message: "The group update could not be confirmed. Refresh and verify its status before retrying." } : groupDenied;
    }
}

/**
 * Retrieves all research groups belonging
 * to a specific Adviser.
 */
export async function getResearchGroupsByAdviser(
    adviserId: number
): Promise<ServiceResult<ManagedResearchGroup[]>> {
    const groups = await findResearchGroupsByAdviserId(
        adviserId
    );

    return {
        success: true,
        message: "Research groups retrieved successfully.",
        data: groups,
    };
}
