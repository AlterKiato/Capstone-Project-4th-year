import {
    findAllResearchGroups,
    createResearchGroup as createResearchGroupRecord,
    updateResearchGroupStatus,
    findResearchGroupById,
    findResearchGroupsByAdviserId,
} from "@/lib/repositories/research-group.repository";

import { logActivity } from "@/lib/services/activity-log.service";

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
    const groups = await findAllResearchGroups();

    return {
        success: true,
        message: "Research groups retrieved successfully.",
        data: groups,
    };
}

/**
 * Creates a research group for the authenticated Adviser.
 *
 * The adviser ID comes from the authenticated session
 * and is also used to record the activity.
 */
export async function createResearchGroup(
    data: CreateManagedResearchGroupInput,
    adviserId: number
): Promise<ServiceResult<ManagedResearchGroup>> {
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

    return {
        success: true,
        message: "Research group created successfully.",
        data: group,
    };
}

/**
 * Updates the status of a research group.
 *
 * The current user ID represents the Admin
 * performing the action and is used for
 * activity logging.
 */
export async function changeResearchGroupStatus(
    id: number,
    status: string,
    currentUserId: number
): Promise<ServiceResult> {
    // Check if the research group exists.
    const existingGroup = await findResearchGroupById(id);

    if (!existingGroup) {
        return {
            success: false,
            message: "Research group not found.",
        };
    }

    // Only allow supported statuses.
    const allowedStatuses = [
        "active",
        "archived",
    ];

    if (!allowedStatuses.includes(status)) {
        return {
            success: false,
            message: "Invalid research group status.",
        };
    }

    // Update the research group status.
    await updateResearchGroupStatus(
        id,
        status
    );

    // Record the successful administrative action.
    await logActivity(
        currentUserId,
        status === "active"
            ? "Research Group Activated"
            : "Research Group Archived",
        `Research group "${existingGroup.groupName}" was ${status}.`
    );

    return {
        success: true,
        message: "Research group status updated successfully.",
    };
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