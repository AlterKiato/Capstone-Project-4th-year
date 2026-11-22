import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import { AdminMetrics, AdminActivity, AdminUserDistribution } from "@/components/dashboard/admin-overview";
import styles from "@/components/dashboard/admin-overview.module.css";
import { getAdminDashboardStats, getAdminRecentActivities } from "@/lib/services/dashboard.service";
import { Suspense } from "react";
import DashboardSkeleton from "@/components/dashboard/dashboard-skeleton";
import Link from "next/link";

export default async function AdminPage() {
    const session = await requireRole([ROLE_IDS.ADMIN]);
    return <Suspense fallback={<DashboardSkeleton page="admin" />}><AdminOverview email={session.email} /></Suspense>;
}

async function AdminOverview({ email }: { email: string }) {
    const [statisticsResult, activitiesResult] = await Promise.all([
        getAdminDashboardStats(), getAdminRecentActivities(),
    ]);
    const statistics = statisticsResult.success ? statisticsResult.data : undefined;
    return <main className={`dashboard-page ${styles.overview}`}>
        <DashboardHeader title="Admin Dashboard" email={email} />
        <p className="dashboard-context">Oversee users, research groups, repository publication, and reports.</p>
        {statistics ? <>
            <AdminMetrics stats={statistics} />
            <dl className={styles.secondary} aria-label="Additional user statistics">
                <div><dt>Total Students</dt><dd>{statistics.totalStudents}</dd></div>
                <div><dt>Total Advisers</dt><dd>{statistics.totalAdvisers}</dd></div>
            </dl>
            <AdminUserDistribution stats={statistics} />
        </> : <p className="form-message" role="alert">{statisticsResult.message}</p>}
        <section className={`dashboard-panel ${styles.assistanceEntry}`} aria-labelledby="admin-assistance-entry">
            <div>
                <h2 id="admin-assistance-entry">Admin Report Assistance</h2>
                <p>Reviewed guidance to help you understand report metrics.</p>
            </div>
            <Link className="context-detail" href="/dashboard/admin/reports#admin-report-assistance" prefetch={false}>Open report assistance</Link>
        </section>
        <AdminActivity title="Recent Activity" result={activitiesResult} />
    </main>;
}
