import "server-only";
import { getSession } from "@/lib/auth/session";
import { findUserById } from "@/lib/repositories/user.repository";
import { ROLE_IDS } from "@/lib/auth/roles";

/** Uncached current authority. Existing verification state is deliberately not an access gate. */
export async function getCurrentAccount() {
    try {
        const session = await getSession();
        if (!session || !Number.isInteger(session.userId) || session.userId <= 0 || session.userId > 2147483647 ||
            !Object.values(ROLE_IDS).some(role => role === session.roleId)) return null;
        const account = await findUserById(session.userId);
        if (!account?.isActive || account.roleId !== session.roleId) return null;
        return { ...session, email: account.email };
    } catch { return null; }
}
