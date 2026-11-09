import Link from "next/link";
import DashboardHeader from "./dashboard-header";
import { coAssignmentSummary, coReviewHref } from "@/lib/utils/co-adviser-workspace";
import type { CoWorkspace } from "@/types/co-adviser";
import styles from "./adviser-overview.module.css";

export default function CoAdviserOverview({ workspace, error }: { workspace: CoWorkspace | null; error?: string }) {
    const summary = coAssignmentSummary(workspace?.assignments ?? []);
    const recent = [...workspace?.assignments ?? []].sort((a,b) => b.createdAt.localeCompare(a.createdAt) || b.id-a.id).slice(0,5);
    return <main className={`dashboard-page ${styles.overview}`}>
        <DashboardHeader title="Co-Adviser Dashboard" email={workspace?.email ?? ""} />
        <p className="dashboard-context">Your delegated submission versions and private recommendations.</p>
        {!workspace ? <p role="alert" className="form-message">{error || "Assignments could not be loaded. Reload to try again."}</p> : <>
            <dl className={`${styles.metrics} dashboard-metrics`} aria-label="Co-Adviser assignments">
                {[{label:"Total Assigned",value:summary.total},{label:"Open / Pending Review",value:summary.open},{label:"Completed Recommendations",value:summary.completed}].map(metric =>
                    <div className="dashboard-panel" key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}
            </dl>
            <section className={`dashboard-panel ${styles.section}`} aria-labelledby="delegated-recent-heading">
                <div className={styles.sectionHeader}><h2 id="delegated-recent-heading">Recent delegated manuscripts</h2><Link href="/dashboard/adviser/submissions" className={styles.action}>View All Assignments</Link></div>
                {recent.length ? <ul className={styles.list}>{recent.map(row => <li key={row.id} className={styles.row}>
                    <div className={styles.details}><h3>{row.title}</h3><p className="form-help">Group {row.groupId} · {row.version} · {row.state}</p>
                        <p className="form-help">Assigned <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleDateString("en-PH",{timeZone:"Asia/Manila"})}</time></p></div>
                    <Link href={coReviewHref(row)} className={styles.action} aria-label={`View assignment: ${row.title}, ${row.version}`}>View assignment</Link>
                </li>)}</ul> : <p className={styles.empty}>You have no delegated assignments.</p>}
            </section>
        </>}
    </main>;
}
