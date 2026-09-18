import {
    findGroupMembersByGroupId,
    findGroupMember,
    findGroupsByUserId,
    createGroupMember,
    deleteGroupMember,
} from "@/lib/repositories/group-member.repository";

import {
    findResearchGroupById,
} from "@/lib/repositories/research-group.repository";

import {
    findUserById,
} from "@/lib/repositories/user.repository";

import {
    ROLE_IDS,
} from "@/lib/auth/roles";

import type { ServiceResult } from "@/types/auth";

/**
 * Represents a Student who belongs
 * to a research group.
 */
export interface ManagedGroupMember {
    id: number;
    groupId: number;
    userId: number;
    joinedAt: Date;
}

/**
 * Retrieves all members belonging
 * to a research group.
 */
export async function getGroupMembers(
    groupId: number
): Promise<ServiceResult<ManagedGroupMember[]>> {
    const group = await findResearchGroupById(
        groupId
    );

    if (!group) {
        return {
            success: false,
            message: "Research group not found.",
        };
    }

    const members =
        await findGroupMembersByGroupId(
            groupId
        );

    return {
        success: true,
        message:
            "Group members retrieved successfully.",
        data: members,
    };
}

/**
 * Adds a Student to a research group.
 *
 * A Student may belong to only one active
 * research group at a time.
 */
export async function addGroupMember(
    groupId: number,
    userId: number
): Promise<ServiceResult<ManagedGroupMember>> {
    const group =
        await findResearchGroupById(
            groupId
        );

    if (!group) {
        return {
            success: false,
            message: "Research group not found.",
        };
    }

    const user =
        await findUserById(userId);

    if (!user) {
        return {
            success: false,
            message: "User not found.",
        };
    }

    if (
        user.roleId !==
        ROLE_IDS.STUDENT
    ) {
        return {
            success: false,
            message:
                "Only Student users can be added to research groups.",
        };
    }

    /*
     * Prevent adding a Student to an archived
     * research group.
     */
    if (group.status !== "active") {
        return {
            success: false,
            message:
                "Students can only be added to active research groups.",
        };
    }

    /*
     * Check whether the Student is already
     * a member of this specific group.
     */
    const existingMember =
        await findGroupMember(
            groupId,
            userId
        );

    if (existingMember) {
        return {
            success: false,
            message:
                "Student is already a member of this research group.",
        };
    }

    /*
     * Check all research groups belonging
     * to this Student.
     *
     * Only active groups prevent a new
     * active-group assignment.
     */
    const studentGroups =
        await findGroupsByUserId(
            userId
        );

    const activeGroup =
        studentGroups.find(
            (studentGroup) =>
                studentGroup.status ===
                    "active" &&
                studentGroup.id !==
                    groupId
        );

    if (activeGroup) {
        return {
            success: false,
            message:
                `Student is already assigned to the active research group "${activeGroup.groupName}".`,
        };
    }

    const member =
        await createGroupMember(
            groupId,
            userId
        );

    return {
        success: true,
        message:
            "Student added to research group successfully.",
        data: member,
    };
}

/**
 * Removes a Student from a research group.
 */
export async function removeGroupMember(
    groupId: number,
    userId: number
): Promise<ServiceResult> {
    const group =
        await findResearchGroupById(
            groupId
        );

    if (!group) {
        return {
            success: false,
            message: "Research group not found.",
        };
    }

    const existingMember =
        await findGroupMember(
            groupId,
            userId
        );

    if (!existingMember) {
        return {
            success: false,
            message:
                "Student is not a member of this research group.",
        };
    }

    await deleteGroupMember(
        groupId,
        userId
    );

    return {
        success: true,
        message:
            "Student removed from research group successfully.",
    };
}