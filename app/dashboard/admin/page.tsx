import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

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
            <main>
                <h1>Admin Dashboard</h1>

                <p>
                    Welcome, {session.email}
                </p>

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
        <main>
            <h1>Admin Dashboard</h1>

            <p>
                Welcome, {session.email}
            </p>

            <section>
                <h2>System Statistics</h2>

                <div>
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

            <section>
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
                    <ul>
                        {recentActivities.map(
                            (activity) => (
                                <li key={activity.id}>
                                    <strong>
                                        {activity.firstName}{" "}
                                        {activity.lastName}
                                    </strong>

                                    {" — "}

                                    {activity.action}

                                    {activity.description && (
                                        <>
                                            {": "}
                                            {
                                                activity.description
                                            }
                                        </>
                                    )}
                                </li>
                            )
                        )}
                    </ul>
                )}
            </section>
        </main>
    );
}