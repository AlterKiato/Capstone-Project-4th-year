import {
    findGroupMembersByGroupId,
    findGroupMember,
    createGroupMember,
    deleteGroupMember,
} from "@/lib/repositories/group-member.repository";

import {
    findResearchGroupById,
} from "@/lib/repositories/research-group.repository";

import {
    findUserById,
} from "@/lib/repositories/user.repository";

import { ROLE_IDS } from "@/lib/auth/roles";

import type { ServiceResult } from "@/types/auth";

/**
 * Group member information used by the
 * research group management module.
 */
export interface ManagedGroupMember {
    id: number;
    groupId: number;
    userId: number;
    joinedAt: Date;
}

/**
 * Retrieves all members belonging to a research group.
 */
export async function getGroupMembers(
    groupId: number
): Promise<ServiceResult<ManagedGroupMember[]>> {
    // Check whether the research group exists.
    const group = await findResearchGroupById(groupId);

    if (!group) {
        return {
            success: false,
            message: "Research group not found.",
        };
    }

    // Retrieve the group's members.
    const members = await findGroupMembersByGroupId(groupId);

    return {
        success: true,
        message: "Group members retrieved successfully.",
        data: members,
    };
}

/**
 * Adds a student to a research group.
 *
 * Business rules:
 * - The research group must exist.
 * - The user must exist.
 * - The user must have the Student role.
 * - The user cannot be added to the same group twice.
 */
export async function addGroupMember(
    groupId: number,
    userId: number
): Promise<ServiceResult<ManagedGroupMember>> {
    // Check whether the research group exists.
    const group = await findResearchGroupById(groupId);

    if (!group) {
        return {
            success: false,
            message: "Research group not found.",
        };
    }

    // Check whether the user exists.
    const user = await findUserById(userId);

    if (!user) {
        return {
            success: false,
            message: "User not found.",
        };
    }

    // Only students can be added as group members.
    if (user.roleId !== ROLE_IDS.STUDENT) {
        return {
            success: false,
            message: "Only students can be added to a research group.",
        };
    }

    // Check whether the user is already a member of this group.
    const existingMember = await findGroupMember(
        groupId,
        userId
    );

    if (existingMember) {
        return {
            success: false,
            message: "This student is already a member of the research group.",
        };
    }

    // Create the group membership.
    const member = await createGroupMember(
        groupId,
        userId
    );

    return {
        success: true,
        message: "Student added to research group successfully.",
        data: member,
    };
}

/**
 * Removes a student from a research group.
 */
export async function removeGroupMember(
    groupId: number,
    userId: number
): Promise<ServiceResult> {
    // Check whether the research group exists.
    const group = await findResearchGroupById(groupId);

    if (!group) {
        return {
            success: false,
            message: "Research group not found.",
        };
    }

    // Check whether the membership exists.
    const existingMember = await findGroupMember(
        groupId,
        userId
    );

    if (!existingMember) {
        return {
            success: false,
            message: "Group membership not found.",
        };
    }

    // Remove the membership.
    await deleteGroupMember(
        groupId,
        userId
    );

    return {
        success: true,
        message: "Student removed from research group successfully.",
    };
}