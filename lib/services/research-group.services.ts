import { findAllResearchGroups, createResearchGroup as createResearchGroupRecord, updateResearchGroupStatus, findResearchGroupById, findResearchGroupsByAdviserId } from "@/lib/repositories/research-group.repository";

import type { ServiceResult } from "@/types/auth";


/**
 * Research group information used by the
 * Admin Research Group Management module.
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
 * Creates a research group for a specific Adviser.
 *
 * The adviser ID should come from the authenticated
 * session and must not come from the client form.
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

    return {
        success: true,
        message: "Research group created successfully.",
        data: group,
    };
}
/**
 * Updates the status of a research group.
 */
export async function changeResearchGroupStatus(
    id: number,
    status: string
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

    await updateResearchGroupStatus(
        id,
        status
    );

    return {
        success: true,
        message: "Research group status updated successfully.",
    };
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