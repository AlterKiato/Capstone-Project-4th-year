import type { UserRole } from "@/types/auth";

/**
 * Centralized role IDs based on the current database role table.
 *
 * These values should correspond to:
 * 1 = Admin
 * 2 = Adviser
 * 3 = Student
 * 4 = Panel
 */
export const ROLE_IDS = {
    ADMIN: 1,
    ADVISER: 2,
    STUDENT: 3,
    PANEL: 4,
} as const;

/**
 * Maps role IDs from the database to their role names.
 */
export const ROLE_NAMES: Record<number, UserRole> = {
    [ROLE_IDS.ADMIN]: "Admin",
    [ROLE_IDS.ADVISER]: "Adviser",
    [ROLE_IDS.STUDENT]: "Student",
    [ROLE_IDS.PANEL]: "Panel",
};

/**
 * Returns the role name associated with a role ID.
 *
 * Returns null if the role ID is not recognized.
 */
export function getRoleName(roleId: number): UserRole | null {
    return ROLE_NAMES[roleId] ?? null;
}