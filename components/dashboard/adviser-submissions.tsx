"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { filterAdviserProjects, groupAdviserSubmissions, matchesSubmissionFilter, submissionDetailsHref, type SubmissionDirectoryItem, type SubmissionFilter } from "@/lib/utils/adviser-submissions";
import SubmissionStatus from "./submission-status";
import styles from "./adviser-submissions.module.css";

export function SubmissionDate({ value }: { value: string }) {
    return <time dateTime={value}>{new Date(value).toLocaleString("en-PH", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" })}</time>;
}

function VersionRow({ item }: { item: SubmissionDirectoryItem }) {
    return <div className={styles.versionRow}><div className={styles.versionMeta}><strong>{item.version}</strong><SubmissionStatus status={item.status} /><span className="form-help"><SubmissionDate value={item.submittedAt} /></span></div>
        <Link className={styles.link} href={submissionDetailsHref(item.id)} aria-label={`View Details: ${item.researchTitle}, ${item.version}`}>View Details</Link></div>;
}

export default function AdviserSubmissions({ submissions }: { submissions: SubmissionDirectoryItem[] }) {
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<SubmissionFilter>("all");
    const [expanded, setExpanded] = useState<number | null>(null);
    const { projects, counts } = useMemo(() => groupAdviserSubmissions(submissions), [submissions]);
    const visible = filterAdviserProjects(projects, search, filter);
    return <>
        <dl className={styles.metrics} aria-label="Submission versions">
            {[["Submitted", counts.submitted], ["Under Review", counts.underReview], ["Reviewed", counts.reviewed]].map(([label, count]) => <div className="dashboard-panel" key={label}><dt>{label}</dt><dd>{count}</dd></div>)}
        </dl>
        <section className={`dashboard-panel ${styles.directory}`} aria-labelledby="directory-heading">
            <h2 id="directory-heading">Research projects</h2>
            <p className="form-help">Projects needing review first, then newest submission. Counts above include all submission versions.</p>
            <div className={styles.toolbar}><div className={styles.search}><label htmlFor="submission-search">Search submissions</label>
                <input id="submission-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Research, group or student" /></div>
                <div><label htmlFor="submission-filter">Status filter</label><select id="submission-filter" value={filter} onChange={event => setFilter(event.target.value as SubmissionFilter)}>
                    <option value="all">All Submissions</option><option value="pending">Needs Review</option><option value="reviewed">Reviewed</option>
                </select></div>
                {(search || filter !== "all") && <button className={styles.clear} onClick={() => { setSearch(""); setFilter("all"); }}>Clear filters</button>}
            </div>
            <p className="form-help" role="status">{visible.length} {visible.length === 1 ? "project" : "projects"}</p>
            {!visible.length ? <p className={styles.empty}>{!projects.length ? "No research submissions from your groups yet. Submitted versions will appear when a Student uploads a document." : search.trim() ? "No projects match your search and filters." : filter === "pending" ? "No submissions currently require review." : "No reviewed submissions yet."}</p> :
                <ul className={styles.projects}>{visible.map(project => {
                    const open = expanded === project.paperId;
                    const matchingHistory = filter === "all" ? [] : project.history.filter(item => matchesSubmissionFilter(item.status, filter));
                    return <li key={project.paperId} className={styles.project}>
                        <div className={styles.projectHeader}><div><h3>{project.latest.researchTitle}</h3><p className="form-help">{project.latest.groupName}</p></div><span className="form-help">Latest submission</span></div>
                        <VersionRow item={project.latest} />
                        {matchingHistory.length > 0 && !open && <div className={styles.matching}><h4>{filter === "pending" ? "Earlier versions needing review" : "Earlier reviewed versions"}</h4>{matchingHistory.map(item => <VersionRow key={item.id} item={item} />)}</div>}
                        {project.history.length > 0 ? <>
                            <button id={`history-toggle-${project.paperId}`} className={styles.toggle} aria-expanded={open} aria-controls={`submission-history-${project.paperId}`} onClick={() => setExpanded(open ? null : project.paperId)}>{open ? "Hide" : "Show"} version history ({project.history.length})<span className="sr-only"> for {project.latest.researchTitle}</span></button>
                            <div id={`submission-history-${project.paperId}`} role="region" aria-labelledby={`history-toggle-${project.paperId}`} hidden={!open}>
                                <h4 className={styles.historyHeading}>Earlier submissions</h4>
                                {project.history.map(item => <div key={item.id}>{filter !== "all" && matchesSubmissionFilter(item.status, filter) && <p className={styles.matchLabel}>Matches {filter === "pending" ? "Needs Review" : "Reviewed"}</p>}<VersionRow item={item} /></div>)}
                            </div>
                        </> : <p className="form-help">No earlier versions.</p>}
                    </li>;
                })}</ul>}
        </section>
    </>;
}
