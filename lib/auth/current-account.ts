import "server-only";
import { getSession } from "@/lib/auth/session";
import { resolveCurrentAccount } from "@/lib/auth/account-principal";

/** Preserve the cookie-facing web result and fail-closed redirects on infrastructure failure. */
export async function getCurrentAccount() {
    try {
        const session = await getSession();
        if (!session) return null;
        const result = await resolveCurrentAccount(session);
        if (result.status !== "active") return null;
        return { ...session, email: result.user.email };
    } catch { return null; }
}
