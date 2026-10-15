import "server-only";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getDashboardAccount } from "./dashboard-account.service";
import { readAdviserDashboard } from "@/lib/repositories/adviser-dashboard.repository";

export async function getAdviserDashboard() {
    const session = await requireRole([ROLE_IDS.ADVISER]);
    const account = await getDashboardAccount();
    if (!account || account.roleId !== ROLE_IDS.ADVISER ||
        !Number.isSafeInteger(session.userId) || session.userId <= 0) return null;
    try {
        return { email: account.email, ...await readAdviserDashboard(session.userId) };
    } catch {
        // Failed reads must never masquerade as zero workload or an empty queue.
        return null;
    }
}
