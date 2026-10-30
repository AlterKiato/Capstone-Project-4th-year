import "server-only";
import { managedAccountSchema, userRoleChangeSchema, userStatusChangeSchema } from "@/lib/validations/user";
import { getSession } from "@/lib/auth/session";
import { getActiveAIAccount } from "@/lib/auth/ai-authorization";
import { hashPassword } from "@/lib/auth/hash";
import { findUserById, findUserByEmail, createManagedUserForAdmin, findAllUsers, updateManagedUserForAdmin } from "@/lib/repositories/user.repository";
import { logActivity } from "@/lib/services/activity-log.service";
import type { ServiceResult } from "@/types/auth";

/** Existing safe projection; password hashes are excluded by the repository. */
export interface ManagedUser {
    id: number; firstName: string; lastName: string; email: string; roleId: number;
    emailVerifiedAt: Date | null;
    profileImage: string | null; isActive: boolean; lastLogin: Date | null; createdAt: Date; updatedAt: Date;
}
type MutationResult = ServiceResult & { uncertain?: boolean };
const denied = { success: false, message: "User management unavailable. An active Admin account is required." } as const;
const uncertain = { success: false, uncertain: true, message: "The account update could not be confirmed. Refresh and verify the account before retrying." } as const;

export async function getUsers(): Promise<ServiceResult<ManagedUser[]>> {
    try {
        if (!await getActiveAIAccount(1)) return denied;
        return { success: true, message: "Users retrieved successfully.", data: await findAllUsers() };
    } catch { return { success: false, message: "Registered users could not be retrieved. Refresh to try again." }; }
}

async function updateAccount(userId: number, change: { roleId: number } | { isActive: boolean }): Promise<MutationResult> {
    let attempted = false;
    try {
        const actorId = await getActiveAIAccount(1);
        if (!actorId) return denied;
        const roleChange = "roleId" in change;
        if (userId === actorId) return { success: false, message: roleChange ? "You cannot change your own role." : "You cannot change your own account status." };
        const parsed = roleChange ? userRoleChangeSchema.safeParse({ userId, ...change }) : userStatusChangeSchema.safeParse({ userId, ...change });
        if (!parsed.success) return { success: false, message: "Invalid account update. Check the selected user and value." };
        attempted = true;
        const result = await updateManagedUserForAdmin(actorId, userId, change);
        if (result.kind === "denied") return denied;
        if (result.kind === "missing") return { success: false, message: "User not found. Refresh the directory." };
        const action = roleChange ? "User Role Changed" : change.isActive ? "User Activated" : "User Deactivated";
        const message = roleChange ? "User role updated successfully." : change.isActive ? "User activated successfully." : "User deactivated successfully.";
        try {
            await logActivity(actorId, action, roleChange
                ? `${result.user.firstName} ${result.user.lastName}'s role was changed to role ID ${change.roleId}.`
                : `${result.user.firstName} ${result.user.lastName} was ${change.isActive ? "activated" : "deactivated"}.`);
        } catch {
            // The transaction already confirmed the mutation. Do not invite a duplicate write.
            return { success: true, message: `${message} Activity recording was unavailable.` };
        }
        return { success: true, message };
    } catch { return attempted ? uncertain : denied; }
}

export async function setUserStatus(userId: number, isActive: boolean): Promise<MutationResult> {
    return updateAccount(userId, { isActive });
}
export async function changeUserRole(userId: number, roleId: number): Promise<MutationResult> {
    return updateAccount(userId, { roleId });
}

/** Account creation never requires eligibility or consent; no automatic certification. */
export async function createManagedAccount(input: unknown) {
    let attempted = false;
    try {
        const parsed = managedAccountSchema.safeParse(input);
        const session = await getSession();
        if (!session || session.roleId !== 1 || !Number.isSafeInteger(session.userId) || session.userId <= 0)
            return { success: false, message: "Account creation unavailable." } as const;
        const actor = await findUserById(session.userId);
        if (!actor?.isActive || actor.roleId !== 1) return { success: false, message: "Account creation unavailable." } as const;
        if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Check the supplied details." } as const;
        const data = parsed.data, email = data.email.trim().toLowerCase();
        if (await findUserByEmail(email)) return { success: false, message: "Unable to create account. Check the supplied details." } as const;
        const password = await hashPassword(data.password);
        attempted = true;
        const created = await createManagedUserForAdmin({firstName:data.firstName,lastName:data.lastName,email,password,roleId:data.roleId},session.userId);
        if (!created) return { success: false, message: "Account creation unavailable." } as const;
        return { success: true, message: "Account created. AI eligibility is Pending Verification.", data: { id: created.id } } as const;
    } catch { return attempted ? { ...uncertain, message: "Account creation could not be confirmed. Refresh and verify the directory before retrying." } : { success: false, message: "Unable to create account. Check the supplied details." } as const; }
}
