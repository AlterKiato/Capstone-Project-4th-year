import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import DashboardNavigation from "@/components/dashboard/dashboard-navigation";
import DashboardHeader from "@/components/dashboard/dashboard-header";

import {
    getAdminDashboardStats,
    getAdminRecentActivities,
} from "@/lib/services/dashboard.service";

const adminLinks = [
    { href: "/dashboard/admin", label: "Overview" },
    { href: "/dashboard/admin/groups", label: "Manage Groups" },
    { href: "/dashboard/admin/users", label: "Manage Users" },
    { href: "/dashboard/admin/reports", label: "Reports" },
    { href: "/dashboard/admin/notifications", label: "Notifications" },
    { href: "/dashboard/admin/repository", label: "Repository Management" },
    { href: "/dashboard/repository", label: "Browse Repository" },
];

/**
 * Admin-only dashboard.
 *
 * Displays real-time system statistics and
 * recent system activities.
 */
export default async function AdminPage() {
    // Ensure only Admin users can access this page.
    const session = await requireRole([
        ROLE_IDS.ADMIN,
    ]);

    // Retrieve dashboard data concurrently.
    const [
        statisticsResult,
        activitiesResult,
    ] = await Promise.all([
        getAdminDashboardStats(),
        getAdminRecentActivities(),
    ]);

    // Handle dashboard statistics retrieval failure.
    if (
        !statisticsResult.success ||
        !statisticsResult.data
    ) {
        return (
            <main className="dashboard-page">
                <DashboardHeader title="Admin Dashboard" email={session.email} />
                <DashboardNavigation links={adminLinks} />

                <p>
                    {statisticsResult.message}
                </p>
            </main>
        );
    }

    const statistics = statisticsResult.data;

    // Use an empty array if recent activities
    // cannot be retrieved.
    const recentActivities =
        activitiesResult.data ?? [];

    return (
        <main className="dashboard-page">
            <DashboardHeader title="Admin Dashboard" email={session.email} />
            <DashboardNavigation links={adminLinks} />

            <section className="dashboard-panel">
                <h2>System Statistics</h2>

                <div className="dashboard-statistics">
                    <p>
                        Total Users: {statistics.totalUsers}
                    </p>

                    <p>
                        Total Students: {statistics.totalStudents}
                    </p>

                    <p>
                        Total Advisers: {statistics.totalAdvisers}
                    </p>

                    <p>
                        Total Research Groups: {statistics.totalGroups}
                    </p>

                    <p>
                        Total Research Papers:{" "}
                        {statistics.totalResearchPapers}
                    </p>
                </div>
            </section>

            <section className="dashboard-panel">
                <h2>Recent Activity</h2>

                {!activitiesResult.success ? (
                    <p>
                        {activitiesResult.message}
                    </p>
                ) : recentActivities.length === 0 ? (
                    <p>
                        No recent activity found.
                    </p>
                ) : (
                    <ul className="dashboard-activities">
                        {recentActivities.map(
                            (activity) => (
                                <li key={activity.id}>
                                    {activity.action}{" — "}
                                    <time dateTime={activity.createdAt.toISOString()}>
                                        {activity.createdAt.toISOString()}
                                    </time>
                                </li>
                            )
                        )}
                    </ul>
                )}
            </section>
        </main>
    );
}
