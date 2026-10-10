import "server-only";
import { getSession } from "@/lib/auth/session";
import { findUserById } from "@/lib/repositories/user.repository";

// Never accept an account ID or role supplied by a caller/client.
export async function getActiveAIAccount(expectedRole: 1 | 2): Promise<number | null> {
    const session = await getSession();
    if (!session || session.roleId !== expectedRole ||
        !Number.isSafeInteger(session.userId) || session.userId <= 0) return null;
    const user = await findUserById(session.userId);
    return user?.isActive && user.roleId === expectedRole ? session.userId : null;
}

// Optional interpretation uses persisted eligibility/current consent; static guidance does not.
export async function getAIInterpretationAuthorization(expectedRole: 1 | 2) {
    const { getAIEntitlement } = await import("@/lib/auth/ai-entitlement");
    return getAIEntitlement(expectedRole);
}
