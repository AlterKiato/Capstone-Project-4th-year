import "server-only";
import { cache } from "react";
import { requireAuth } from "@/lib/auth/authorization";

// Per-render memoization only; account authorization is never persistently cached.
export const getDashboardAccount = cache(async () => {
    const session = await requireAuth();
    if (!Number.isSafeInteger(session.userId) || session.userId <= 0) return null;
    // requireAuth already checked the active database account and current role,
    // and replaced the JWT email with the current account email.
    return { id: session.userId, roleId: session.roleId, email: session.email, expiresAt: (session.exp ?? 0) * 1000 };
});
