import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import DashboardNavigation from "@/components/dashboard/dashboard-navigation";
import { getAdminDashboardStats, getAdminRecentActivities } from "@/lib/services/dashboard.service";

export default async function AdminReportsPage() {
    await requireRole([ROLE_IDS.ADMIN]);
    const [statsResult, activityResult] = await Promise.all([
        getAdminDashboardStats(), getAdminRecentActivities(),
    ]);
    const stats = statsResult.data;
    return (
        <main>
            <h1>Admin Reports</h1>
            <DashboardNavigation links={[
                { href: "/dashboard/admin", label: "Admin Dashboard" },
                { href: "/dashboard/admin/repository", label: "Repository Management" },
            ]} />
            {!statsResult.success || !stats ? <p>{statsResult.message}</p> : <>
                <section>
                    <h2>System Overview</h2>
                    <p>Total Users: {stats.totalUsers}</p>
                    <p>Total Research Groups: {stats.totalGroups}</p>
                    <p>Total Research Papers: {stats.totalResearchPapers}</p>
                    <p>Total Published Repository Papers: {stats.totalPublishedPapers}</p>
                    <p>User totals include active and inactive accounts. Group totals include all groups.
                        Published totals count papers currently eligible for the repository.</p>
                </section>
                <section>
                    <h2>Users by Role</h2>
                    <ul>{stats.usersByRole.map(row => <li key={row.role}>{row.role}: {row.count}</li>)}</ul>
                </section>
                <section>
                    <h2>Research Papers by Status</h2>
                    <ul>{stats.papersByStatus.map(row => <li key={row.status}>{row.status}: {row.count}</li>)}</ul>
                    <p>Statuses describe each research paper, rather than individual submission versions.</p>
                </section>
            </>}
            <section>
                <h2>Recent System Activity</h2>
                <p>Latest five recorded events. This is not a complete audit of all system operations.</p>
                {!activityResult.success ? <p>{activityResult.message}</p> : !activityResult.data?.length ?
                    <p>No recent activity found.</p> :
                    <ul>{activityResult.data.map(activity => <li key={activity.id}>
                        {activity.action}{" — "}<time dateTime={activity.createdAt.toISOString()}>
                            {activity.createdAt.toISOString()}
                        </time>
                    </li>)}</ul>}
            </section>
        </main>
    );
}
