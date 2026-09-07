import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

import { getAdminDashboardData } from "@/lib/services/dashboard.service";

/**
 * Admin-only dashboard.
 *
 * Displays real-time system statistics retrieved
 * from the database.
 */
export default async function AdminPage() {
    // Ensure only Admin users can access this page.
    const session = await requireRole([
        ROLE_IDS.ADMIN,
    ]);

    // Retrieve dashboard statistics and recent activities.
    const {
        statistics,
        recentActivities,
    } = await getAdminDashboardData();

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
                        Total Research Papers: {statistics.totalPapers}
                    </p>
                </div>
            </section>

            <section>
                <h2>Recent Activity</h2>

                {recentActivities.length === 0 ? (
                    <p>
                        No recent activity found.
                    </p>
                ) : (
                    <ul>
                        {recentActivities.map((activity) => (
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
                                        {activity.description}
                                    </>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </main>
    );
}