import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import DashboardNavigation from "@/components/dashboard/dashboard-navigation";

/**
 * Temporary Adviser-only page used to test RBAC.
 *
 * Only users with the Adviser role can access this page.
 */
export default async function AdviserPage() {
    const session = await requireRole([
        ROLE_IDS.ADVISER,
    ]);

    return (
        <main>
            <h1>Adviser Area</h1>

            <DashboardNavigation links={[
                { href: "/dashboard/adviser/groups", label: "Research Groups" },
                { href: "/dashboard/adviser/submissions", label: "Review Submissions" },
                { href: "/dashboard/adviser/notifications", label: "Notifications" },
                { href: "/dashboard/repository", label: "Browse Repository" },
            ]} />

            <p>
                Welcome, {session.email}
            </p>

            <p>
                You have Adviser access.
            </p>

        </main>
    );
}
