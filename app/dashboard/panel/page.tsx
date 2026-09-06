import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

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
            <h1>Panel Area</h1>

            <p>
                Welcome, {session.email}
            </p>

            <p>
                You have Panel access.
            </p>
        </main>
    );
}