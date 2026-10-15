import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import Link from "next/link";

import {
    getAdminDashboardStats,
    getAdminRecentActivities,
} from "@/lib/services/dashboard.service";


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

                <p className="form-message" role="alert">
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
            <p className="dashboard-context">Oversee accounts, research groups and approved repository publication.</p>
            <section className="dashboard-panel">
                <h2>Administration</h2>
                <ul className="dashboard-tasks">
                    <li><Link href="/dashboard/admin/users">Manage Users</Link><p>Manage existing user accounts and access.</p></li>
                    <li><Link href="/dashboard/admin/groups">Manage Groups</Link><p>View and manage research groups.</p></li>
                    <li><Link href="/dashboard/admin/repository">Repository Management</Link><p>Publish eligible approved research to the repository.</p></li>
                    <li><Link href="/dashboard/admin/reports">Reports</Link><p>View the existing read-only administrative overview.</p></li>
                    <li><Link href="/dashboard/guide">System Guide</Link><p>Read guidance on account management and publication.</p></li>
                </ul>
            </section>

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
                    <p role="alert" className="form-message">
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
                                    {activity.action}{" · "}
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
