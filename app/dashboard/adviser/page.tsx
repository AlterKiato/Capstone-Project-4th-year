import DashboardHeader from "@/components/dashboard/dashboard-header";
import Link from "next/link";
import styles from "@/components/dashboard/adviser-overview.module.css";
import { getAdviserDashboard } from "@/lib/services/adviser-dashboard.service";
import { Suspense } from "react";

/**
 * Adviser dashboard entry page.
 *
 * Only users with the Adviser role can access this page.
 */
export default function AdviserPage() {
    return <Suspense fallback={<main className="dashboard-page" aria-busy="true"><h1>Adviser Dashboard</h1><p role="status">Loading your research overview...</p></main>}><AdviserOverview /></Suspense>;
}

async function AdviserOverview() {
    const overview = await getAdviserDashboard();
    if (!overview) return <main className="dashboard-page"><h1>Adviser Dashboard</h1><p role="alert">Your dashboard could not be retrieved. Reload to try again.</p></main>;
    const metrics = [
        { label: "My Research Groups", value: overview.totalGroups, help: "Groups you manage" },
        { label: "Pending Reviews", value: overview.pending, help: "Submitted or under review" },
        { label: "Reviewed Submissions", value: overview.reviewed, help: "Approved or revision required" },
    ];

    return (
        <main className={`dashboard-page ${styles.overview}`}>
            <DashboardHeader title="Adviser Dashboard" email={overview.email} />

            <p className="dashboard-context">Overview of your research groups and submissions.</p>

            <dl className={styles.metrics} aria-label="Adviser workload">
                {metrics.map(metric => <div key={metric.label} className="dashboard-panel">
                    <dt>{metric.label}</dt><dd>{metric.value}</dd><dd className="form-help">{metric.help}</dd>
                </div>)}
            </dl>
            <section className={`dashboard-panel ${styles.section}`} aria-labelledby="attention-heading">
                <h2 id="attention-heading">Needs Your Attention</h2>
                <p className="form-help">Up to five submission versions, oldest first.</p>
                {overview.attention.length ? <ul className={styles.list}>{overview.attention.map(item => <li key={item.id} className={styles.row}>
                    <div className={styles.details}>
                        <h3>{item.researchTitle}</h3><p className="form-help">{item.groupName}</p>
                        <div className={styles.metadata}><span>{item.version}</span><span className={styles.badge}>{item.status}</span>
                            <span className="form-help">Submitted <time dateTime={item.submittedAt.toISOString()}>{item.submittedAt.toLocaleDateString("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Manila" })}</time></span>
                        </div>
                    </div>
                    <Link className={styles.action} href={`/dashboard/adviser/submissions/${item.id}`} aria-label={`View Details: ${item.researchTitle}, ${item.version}`}>View Details</Link>
                </li>)}</ul> : <p className={styles.empty}>You&apos;re all caught up. No submissions currently need your review.</p>}
            </section>
            <section className={`dashboard-panel ${styles.section}`} aria-labelledby="groups-heading">
                <div className={styles.sectionHeader}><h2 id="groups-heading">My Research Groups</h2><Link className={styles.action} href="/dashboard/adviser/groups">View All Groups</Link></div>
                {overview.groups.length ? <ul className={styles.list}>{overview.groups.map(group => <li key={group.id} className={styles.row}>
                    <div className={styles.details}><h3>{group.groupName}</h3><p className="form-help">{[group.strand, group.section].filter(Boolean).join(" · ")}</p>
                        <p className="form-help">{group.memberCount} {group.memberCount === 1 ? "member" : "members"} · {group.projectCount} {group.projectCount === 1 ? "research project" : "research projects"}</p>
                    </div><Link className={styles.action} href="/dashboard/adviser/groups" aria-label={`View Groups: ${group.groupName}`}>View Groups</Link>
                </li>)}</ul> : <p className={styles.empty}>You have no research groups yet. Your groups will appear here once created or assigned.</p>}
            </section>

        </main>
    );
}
