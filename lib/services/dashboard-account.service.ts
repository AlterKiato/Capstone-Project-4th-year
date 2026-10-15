import "server-only";
import { cache } from "react";
import { requireAuth } from "@/lib/auth/authorization";
import { findUserById } from "@/lib/repositories/user.repository";

// Per-render memoization only; account authorization is never persistently cached.
export const getDashboardAccount = cache(async () => {
    const session = await requireAuth();
    if (!Number.isSafeInteger(session.userId) || session.userId <= 0) return null;
    try {
        const user = await findUserById(session.userId);
        if (!user?.isActive || user.roleId !== session.roleId) return null;
        return { roleId: user.roleId, email: user.email };
    } catch {
        return null;
    }
});
