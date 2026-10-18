import "server-only";

import { getSession } from "@/lib/auth/session";
import { findUserById } from "@/lib/repositories/user.repository";

/** Session identity plus an uncached current account check for research mutations. */
export async function getActiveResearchActor(expectedRole: 2 | 3, actorId: number) {
    const session = await getSession();
    if (!session || session.roleId !== expectedRole ||
        !Number.isSafeInteger(session.userId) || session.userId <= 0 ||
        session.userId !== actorId) return null;

    const account = await findUserById(session.userId);
    return account?.isActive && account.roleId === expectedRole ? session.userId : null;
}
