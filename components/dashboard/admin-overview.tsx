import type { AdminDashboardStats, RecentActivity } from "@/lib/services/dashboard.service";
import type { ServiceResult } from "@/types/auth";
import styles from "./admin-overview.module.css";

export function AdminMetrics({ stats, reports = false }: { stats: AdminDashboardStats; reports?: boolean }) {
    const metrics = [
        { label: "Total Users", value: stats.totalUsers, help: "Active and inactive accounts" },
        { label: reports ? "Total Research Groups" : "Research Groups", value: stats.totalGroups, help: "Includes archived groups" },
        { label: reports ? "Total Research Papers" : "Research Papers", value: stats.totalResearchPapers, help: "Projects, not submission versions" },
        { label: reports ? "Total Published Repository Papers" : "Published Repository Papers", value: stats.totalPublishedPapers, help: "Published approved papers with an approved submission" },
    ];
    return <dl className={`${styles.metrics} ${reports ? styles.reportMetrics : ""}`} aria-label="System statistics">
        {metrics.map(metric => <div key={metric.label} className="dashboard-panel">
            <dt>{metric.label}</dt><dd>{metric.value}</dd><dd className="form-help">{metric.help}</dd>
        </div>)}
    </dl>;
}

export function AdminActivity({ title, result }: { title: string; result: ServiceResult<RecentActivity[]> }) {
    return <section className={`dashboard-panel ${styles.section}`} aria-label={title}>
        <h2>{title}</h2>
        <p className="form-help">Latest five recorded events, newest first. This is not a complete audit of all system operations. Times shown in Philippine time.</p>
        {!result.success || !result.data ? <p className="form-message" role="alert">{result.message}</p>
            : result.data.length === 0 ? <p className={styles.empty}>No system activity has been recorded yet.</p>
                : <ul className={styles.activities}>{result.data.map(activity => <li key={activity.id}>
                    <span>{activity.action}</span>
                    <time dateTime={activity.createdAt.toISOString()}>{activity.createdAt.toLocaleString("en-PH", {
                        day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila",
                    })}</time>
                </li>)}</ul>}
    </section>;
}
