import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import DashboardHeader from "@/components/dashboard/dashboard-header";

/**
 * Temporary Panel-only page used to test RBAC.
 *
 * Only users with the Panel role can access this page.
 */
export default async function PanelPage() {
    const session = await requireRole([
        ROLE_IDS.PANEL,
    ]);

    return (
        <main>
            <DashboardHeader title="Panel Area" email={session.email} />

            <p>
                You have Panel access.
            </p>
        </main>
    );
}
