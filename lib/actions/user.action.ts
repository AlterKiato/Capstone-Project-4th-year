"use server";

import { setUserStatus, changeUserRole, createManagedAccount } from "@/lib/services/user.service";

// Services derive the actor from the session and verify current database authority.
export async function changeUserStatusAction(userId: number, isActive: boolean) {
    return setUserStatus(userId, isActive);
}
export async function changeUserRoleAction(userId: number, roleId: number) {
    return changeUserRole(userId, roleId);
}
export async function createManagedAccountAction(input: unknown) {
    return createManagedAccount(input);
}
