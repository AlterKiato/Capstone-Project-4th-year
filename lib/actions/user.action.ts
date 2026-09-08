"use server";

import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

import { setUserStatus, changeUserRole } from "@/lib/services/user.service";

import type { ServiceResult } from "@/types/auth";

/**
 * Changes the active status of a user.
 *
 * Only Admin users can perform this action.
 */
export async function changeUserStatusAction(
    userId: number,
    isActive: boolean
): Promise<ServiceResult> {
    // Ensure only an Admin can change user status.
    const session = await requireRole([
        ROLE_IDS.ADMIN,
    ]);

    return setUserStatus(
        userId,
        isActive,
        session.userId
    );
}

/**
 * Changes the role assigned to a user.
 *
 * Only Admin users can perform this action.
 */
export async function changeUserRoleAction(
    userId: number,
    roleId: number
): Promise<ServiceResult> {
    // Ensure only Admin users can change roles.
    const session = await requireRole([
        ROLE_IDS.ADMIN,
    ]);

    return changeUserRole(
        userId,
        roleId,
        session.userId
    );
}