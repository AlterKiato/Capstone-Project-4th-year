import LocalAIAssistance from "@/components/dashboard/local-ai-assistance";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import { getAdminDashboardStats, getAdminRecentActivities } from "@/lib/services/dashboard.service";

export default async function AdminReportsPage() {
    const session = await requireRole([ROLE_IDS.ADMIN]);
    const [statsResult, activityResult] = await Promise.all([
        getAdminDashboardStats(), getAdminRecentActivities(),
    ]);
    const stats = statsResult.data;
    return (
        <main className="dashboard-page admin-surface">
            <DashboardHeader title="Admin Reports" email={session.email} />
            <p className="dashboard-context">Read-only counts and recorded activity from the existing system data.</p>
            {!statsResult.success || !stats ? <p className="form-message" role="alert">{statsResult.message}</p> : <>
                <section className="dashboard-panel">
                    <h2>System Overview</h2>
                    <p>Total Users: {stats.totalUsers}</p>
                    <p>Total Research Groups: {stats.totalGroups}</p>
                    <p>Total Research Papers: {stats.totalResearchPapers}</p>
                    <p>Total Published Repository Papers: {stats.totalPublishedPapers}</p>
                    <p>User totals include active and inactive accounts. Group totals include all groups.
                        Published totals count papers currently eligible for the repository.</p>
                </section>
                <section className="dashboard-panel">
                    <h2>Users by Role</h2>
                    <dl className="report-breakdown">{stats.usersByRole.map(row => <div key={row.role}><dt>{row.role}</dt><dd>{row.count}</dd></div>)}</dl>
                </section>
                <section className="dashboard-panel">
                    <h2>Research Papers by Status</h2>
                    <dl className="report-breakdown">{stats.papersByStatus.map(row => <div key={row.status}><dt>{row.status}</dt><dd>{row.count}</dd></div>)}</dl>
                    <p>Statuses describe each research paper, rather than individual submission versions.</p>
                </section>
            </>}
            <LocalAIAssistance feature="admin" />
            <section className="dashboard-panel">
                <h2>Recent System Activity</h2>
                <p>Latest five recorded events. This is not a complete audit of all system operations.</p>
                {!activityResult.success ? <p>{activityResult.message}</p> : !activityResult.data?.length ?
                    <p>No recent activity found.</p> :
                    <ul className="dashboard-activities">{activityResult.data.map(activity => <li key={activity.id}>
                        {activity.action}{" · "}<time dateTime={activity.createdAt.toISOString()}>
                            {activity.createdAt.toISOString()}
                        </time>
                    </li>)}</ul>}
            </section>
        </main>
    );
}
