import "server-only";
import { findUserById } from "@/lib/repositories/user.repository";
import { ROLE_IDS } from "@/lib/auth/roles";
import type { AuthTokenPayload, AuthUser } from "@/types/auth";

export type CurrentAccountOutcome =
    | { status: "active"; user: AuthUser }
    | { status: "invalid" }
    | { status: "unavailable" };

/**
 * Uncached current authority, called ONLY after the appropriate JWT verifier.
 * This is not a client actor-ID lookup. Verification remains optional.
 */
export async function resolveCurrentAccount(claims: AuthTokenPayload): Promise<CurrentAccountOutcome> {
    if (!claims || !Number.isInteger(claims.userId) || claims.userId <= 0 || claims.userId > 2147483647 ||
        !Object.values(ROLE_IDS).some(role => role === claims.roleId)) return { status: "invalid" };
    try {
        const account = await findUserById(claims.userId);
        if (!account?.isActive || account.id !== claims.userId || account.roleId !== claims.roleId)
            return { status: "invalid" };
        return {
            status: "active",
            user: {
                id: account.id, email: account.email, roleId: account.roleId,
                firstName: account.firstName, lastName: account.lastName,
            },
        };
    } catch {
        return { status: "unavailable" };
    }
}
