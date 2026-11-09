import "server-only";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getCurrentMainAdviser } from "@/lib/auth/main-adviser";
import { readAdviserDashboard } from "@/lib/repositories/adviser-dashboard.repository";

export async function getAdviserDashboard() {
    const session = await requireRole([ROLE_IDS.ADVISER]);
    const account = await getCurrentMainAdviser(session.userId);
    if (!account || account.roleId !== ROLE_IDS.ADVISER ||
        !Number.isSafeInteger(session.userId) || session.userId <= 0) return null;
    try {
        const overview = await readAdviserDashboard(session.userId);
        return await getCurrentMainAdviser(session.userId) ? { email: account.email, ...overview } : null;
    } catch {
        // Failed reads must never masquerade as zero workload or an empty queue.
        return null;
    }
}
