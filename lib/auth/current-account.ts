import "server-only";
import { getSession } from "@/lib/auth/session";

/** Preserve the cookie-facing web result and fail-closed redirects on infrastructure failure. */
export async function getCurrentAccount() {
    try {
        const session = await getSession();
        if (!session) return null;
        return session;
    } catch { return null; }
}
