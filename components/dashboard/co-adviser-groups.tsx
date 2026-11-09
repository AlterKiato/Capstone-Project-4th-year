import Link from "next/link";
import DashboardHeader from "./dashboard-header";
import { coReviewHref, delegatedGroups } from "@/lib/utils/co-adviser-workspace";
import type { CoWorkspace } from "@/types/co-adviser";
import styles from "./adviser-groups.module.css";

export default function CoAdviserGroups({ workspace, error }: { workspace: CoWorkspace | null; error?: string }) {
    const groups = delegatedGroups(workspace?.assignments ?? []);
    return <main className={`dashboard-page ${styles.page}`}>
        <DashboardHeader title="Delegated Research Groups" email={workspace?.email ?? ""} />
        <p className="dashboard-context">Read-only groups represented by your delegated versions. Group management and Student directories are unavailable.</p>
        {!workspace ? <p role="alert" className="form-message">{error || "Assignments could not be loaded. Reload to try again."}</p> : <section className={`dashboard-panel ${styles.directory}`} aria-label="Delegated groups">
            {groups.length ? <ul className={styles.groups}>{groups.map(group => <li key={group.id} className={styles.details}>
                <h2>Group {group.id}</h2><ul className={styles.projects}>{group.assignments.map(row => <li key={row.id}>
                    <div><h3>{row.title}</h3><p className="form-help">{row.version} · {row.state}{row.reviewAvailable ? " · Review available" : " · PDF access closed"}</p></div>
                    <Link href={coReviewHref(row)} className="context-row" aria-label={`View assignment: ${row.title}, ${row.version}`}>View assignment</Link>
                </li>)}</ul>
            </li>)}</ul> : <p>No groups have delegated versions assigned to you.</p>}
        </section>}
    </main>;
}
