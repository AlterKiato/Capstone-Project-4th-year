import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import DashboardNavigation from "@/components/dashboard/dashboard-navigation";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import Link from "next/link";

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
            <p className="dashboard-context">Manage your assigned groups and review their submitted research.</p>

            <section className="dashboard-panel">
                <h2>Your Research Workflow</h2>
                <ul className="dashboard-tasks">
                    <li><Link href="/dashboard/adviser/submissions">Review Submissions</Link><p>Open submitted versions, start a review and provide feedback or a decision.</p></li>
                    <li><Link href="/dashboard/adviser/groups">Research Groups</Link><p>Create and manage your groups and their Student membership.</p></li>
                    <li><Link href="/dashboard/adviser/notifications">Notifications</Link><p>Read new-submission updates from your groups.</p></li>
                    <li><Link href="/dashboard/guide">System Guide</Link><p>Read guidance on group management and the review workflow.</p></li>
                </ul>
            </section>

        </main>
    );
}
