import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import DashboardNavigation from "@/components/dashboard/dashboard-navigation";
import DashboardHeader from "@/components/dashboard/dashboard-header";

/**
 * Adviser dashboard entry page.
 *
 * Only users with the Adviser role can access this page.
 */
export default async function AdviserPage() {
    const session = await requireRole([
        ROLE_IDS.ADVISER,
    ]);

    return (
        <main className="dashboard-page">
            <DashboardHeader title="Adviser Dashboard" email={session.email} />

            <DashboardNavigation links={[
                { href: "/dashboard/adviser", label: "Overview" },
                { href: "/dashboard/adviser/groups", label: "Research Groups" },
                { href: "/dashboard/adviser/submissions", label: "Review Submissions" },
                { href: "/dashboard/adviser/notifications", label: "Notifications" },
                { href: "/dashboard/repository", label: "Browse Repository" },
            ]} />

            <section className="dashboard-panel">
                <h2>Your Research Workflow</h2>
                <p>Manage your research groups, review submissions, and provide feedback to your students.</p>
            </section>

        </main>
    );
}
