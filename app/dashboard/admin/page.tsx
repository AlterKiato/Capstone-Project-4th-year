import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import { AdminMetrics, AdminActivity } from "@/components/dashboard/admin-overview";
import styles from "@/components/dashboard/admin-overview.module.css";
import { getAdminDashboardStats, getAdminRecentActivities } from "@/lib/services/dashboard.service";

export default async function AdminPage() {
    const session = await requireRole([ROLE_IDS.ADMIN]);
    const [statisticsResult, activitiesResult] = await Promise.all([
        getAdminDashboardStats(), getAdminRecentActivities(),
    ]);
    const statistics = statisticsResult.success ? statisticsResult.data : undefined;
    return <main className={`dashboard-page ${styles.overview}`}>
        <DashboardHeader title="Admin Dashboard" email={session.email} />
        <p className="dashboard-context">Oversee users, research groups, repository publication, and reports.</p>
        {statistics ? <>
            <AdminMetrics stats={statistics} />
            <dl className={styles.secondary} aria-label="Additional user statistics">
                <div><dt>Total Students</dt><dd>{statistics.totalStudents}</dd></div>
                <div><dt>Total Advisers</dt><dd>{statistics.totalAdvisers}</dd></div>
            </dl>
        </> : <p className="form-message" role="alert">{statisticsResult.message}</p>}
        <AdminActivity title="Recent Activity" result={activitiesResult} />
    </main>;
}
