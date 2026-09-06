import "server-only";

import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import type { AuthTokenPayload } from "@/types/auth";

/**
 * Gets the current authenticated session.
 *
 * Redirects unauthenticated users to the login page.
 * Returns the authenticated session when successful.
 */
export async function requireAuth(): Promise<AuthTokenPayload> {
    const session = await getSession();

    if (!session) {
        redirect("/login");
    }

    return session;
}

/**
 * Checks whether a role ID is included in the allowed roles.
 *
 * This is a reusable boolean helper for cases where
 * a redirect is not required.
 */
export function hasRole(
    roleId: number,
    allowedRoles: readonly number[]
): boolean {
    return allowedRoles.includes(roleId);
}

/**
 * Verifies that the authenticated user has one of
 * the required role IDs.
 *
 * Redirects unauthenticated users to /login.
 * Redirects authenticated but unauthorized users
 * to /dashboard.
 *
 * Returns the authenticated session when access is allowed.
 */
export async function requireRole(
    allowedRoles: readonly number[]
): Promise<AuthTokenPayload> {
    const session = await requireAuth();

    if (!hasRole(session.roleId, allowedRoles)) {
        redirect("/dashboard");
    }

    return session;
}