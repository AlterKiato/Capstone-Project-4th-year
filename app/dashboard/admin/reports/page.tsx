import LocalAIAssistance from "@/components/dashboard/local-ai-assistance";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import { AdminMetrics, AdminActivity } from "@/components/dashboard/admin-overview";
import styles from "@/components/dashboard/admin-overview.module.css";
import { getAdminDashboardStats, getAdminRecentActivities } from "@/lib/services/dashboard.service";
import AdminReportControls from "@/components/dashboard/admin-report-controls";
import { getAdminReport } from "@/lib/services/admin-report.service";

export default async function AdminReportsPage() {
    const session = await requireRole([ROLE_IDS.ADMIN]);
    const [statsResult, activityResult, reportResult] = await Promise.all([
        getAdminDashboardStats(), getAdminRecentActivities(),
        getAdminReport({ reportType: "current-summary", selection: "all", sections: [], format: "preview" }),
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
            <p className="form-help">Current snapshot at generation time. The overview and report tables are separate live reads.</p>
        </> : <p className="form-message" role="alert">{statsResult.message}</p>}
        <AdminReportControls initialReport={reportResult.ok ? reportResult.report : null} initialError={reportResult.ok ? undefined : reportResult.message} />
        <AdminActivity title="Recent System Activity" result={activityResult} />
        <LocalAIAssistance feature="admin" />
    </main>;
}
