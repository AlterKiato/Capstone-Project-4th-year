import {
    findAllUsers,
    updateUserStatus,
    updateUserRole,
} from "@/lib/repositories/user.repository";

import { ROLE_IDS } from "@/lib/auth/roles";

import { logActivity } from "@/lib/services/activity-log.service";

import type { ServiceResult } from "@/types/auth";

/**
 * Safe user information used for user management.
 *
 * Password hashes are intentionally excluded.
 */
export interface ManagedUser {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    roleId: number;
    profileImage: string | null;
    isActive: boolean;
    lastLogin: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Retrieves all users for the Admin User Management module.
 *
 * Password hashes are never returned.
 */
export async function getUsers(): Promise<
    ServiceResult<ManagedUser[]>
> {
    const users = await findAllUsers();

    return {
        success: true,
        message: "Users retrieved successfully.",
        data: users,
    };
}

/**
 * Updates whether a user account is active.
 *
 * Prevents an Admin from changing their own
 * account status.
 */
export async function setUserStatus(
    userId: number,
    isActive: boolean,
    currentUserId: number
): Promise<ServiceResult> {
    // Prevent administrators from changing
    // their own account status.
    if (userId === currentUserId) {
        return {
            success: false,
            message: "You cannot change your own account status.",
        };
    }

    // Update the user's account status.
    const updatedUser = await updateUserStatus(
        userId,
        isActive
    );

    if (!updatedUser) {
        return {
            success: false,
            message: "User not found.",
        };
    }

    // Record the successful administrative action.
    await logActivity(
        currentUserId,
        isActive
            ? "User Activated"
            : "User Deactivated",
        `${updatedUser.firstName} ${updatedUser.lastName} was ${
            isActive
                ? "activated"
                : "deactivated"
        }.`
    );

    return {
        success: true,
        message: isActive
            ? "User activated successfully."
            : "User deactivated successfully.",
    };
}

/**
 * Changes the role assigned to a user.
 *
 * Prevents administrators from changing their
 * own role and rejects invalid role IDs.
 */
export async function changeUserRole(
    userId: number,
    roleId: number,
    currentUserId: number
): Promise<ServiceResult> {
    // Prevent administrators from changing their own role.
    if (userId === currentUserId) {
        return {
            success: false,
            message: "You cannot change your own role.",
        };
    }

    // Get the valid role IDs from the centralized roles object.
    const validRoleIds: number[] = Object.values(
        ROLE_IDS
    );

    // Reject invalid role IDs.
    if (!validRoleIds.includes(roleId)) {
        return {
            success: false,
            message: "Invalid role selected.",
        };
    }

    // Update the user's role.
    const updatedUser = await updateUserRole(
        userId,
        roleId
    );

    if (!updatedUser) {
        return {
            success: false,
            message: "User not found.",
        };
    }

    // Record the successful administrative action.
    await logActivity(
        currentUserId,
        "User Role Changed",
        `${updatedUser.firstName} ${updatedUser.lastName}'s role was changed to role ID ${roleId}.`
    );

    return {
        success: true,
        message: "User role updated successfully.",
    };
}