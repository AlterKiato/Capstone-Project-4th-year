import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

/**
 * Temporary Admin-only page used to test RBAC.
 *
 * Only users with the Admin role can access this page.
 */
export default async function AdminPage() {
    const session = await requireRole([
        ROLE_IDS.ADMIN,
    ]);

    return (
        <main>
            <h1>Admin Area</h1>

            <p>
                Welcome, {session.email}
            </p>

            <p>
                You have Admin access.
            </p>
        </main>
    );
}