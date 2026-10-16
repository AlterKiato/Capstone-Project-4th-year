import LocalAIAssistance from "@/components/dashboard/local-ai-assistance";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import { AdminMetrics, AdminActivity } from "@/components/dashboard/admin-overview";
import styles from "@/components/dashboard/admin-overview.module.css";
import { getAdminDashboardStats, getAdminRecentActivities } from "@/lib/services/dashboard.service";

export default async function AdminReportsPage() {
    const session = await requireRole([ROLE_IDS.ADMIN]);
    const [statsResult, activityResult] = await Promise.all([
        getAdminDashboardStats(), getAdminRecentActivities(),
    ]);
    const stats = statsResult.success ? statsResult.data : undefined;
    return <main className={`dashboard-page ${styles.overview}`}>
        <DashboardHeader title="Admin Reports" email={session.email} />
        <p className="dashboard-context">System-wide research and user statistics.</p>
        {stats ? <>
            <section aria-labelledby="system-overview-heading">
                <h2 id="system-overview-heading">System Overview</h2>
                <AdminMetrics stats={stats} reports />
            </section>
            <div className={styles.breakdowns}>
                <section className={`dashboard-panel ${styles.section}`} aria-labelledby="users-heading">
                    <h2 id="users-heading">Users by Role</h2>
                    <dl className={styles.distribution}>{stats.usersByRole.map(row => <div key={row.role}><dt>{row.role}</dt><dd>{row.count}</dd></div>)}</dl>
                </section>
                <section className={`dashboard-panel ${styles.section}`} aria-labelledby="papers-heading">
                    <h2 id="papers-heading">Research Papers by Status</h2>
                    <dl className={styles.distribution}>{stats.papersByStatus.map(row => <div key={row.status}><dt>{row.status}</dt><dd>{row.count}</dd></div>)}</dl>
                    <p className="form-help">Statuses describe research papers, rather than individual submission versions. Other includes unrecognized statuses.</p>
                </section>
            </div>
        </> : <p className="form-message" role="alert">{statsResult.message}</p>}
        <AdminActivity title="Recent System Activity" result={activityResult} />
        <LocalAIAssistance feature="admin" />
    </main>;
}
