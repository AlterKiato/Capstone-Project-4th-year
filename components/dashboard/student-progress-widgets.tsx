"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import NavigationIcon from "./navigation-icon";
import ResearchProgressWidget from "./research-progress-widget";
import RevisionWidget from "./revision-widget";
import GroupWorkspaceWidget from "./group-workspace-widget";
import styles from "./student-progress-widgets.module.css";

type DashboardProject = { id: number; title: string; status: string; submissionCount: number; latestVersion: string | null };

export default function StudentProgressWidgets({ projects, initialProjectId, children }: { projects: DashboardProject[]; initialProjectId?: number; children: ReactNode }) {
    const [selected, setSelected] = useState(initialProjectId ?? projects[0]?.id);
    const project = projects.find(row => row.id === selected) ?? projects[0];
    return <div className={styles.widgets}>
        <div className={styles.projectContext}>
            <div className={styles.selector}>
                {projects.length > 1 ? <><label htmlFor="dashboard-progress-project">Research project</label>
                    <select id="dashboard-progress-project" value={project?.id} onChange={event => setSelected(Number(event.target.value))}>
                        {projects.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}
                    </select></> : <><p className="form-help">Research project</p><h2>{project?.title ?? "No active research project"}</h2></>}
            </div>
            {project && <Link className="context-detail" href={`/dashboard/student/submissions?project=${project.id}`}>View submissions</Link>}
        </div>
        {project && <dl className={styles.summary} aria-label="Selected project summary">
            <div><dt className="dashboard-label"><NavigationIcon name="document" size={18} />Research status</dt><dd><span className="academic-status" data-status={project.status}>{project.status}</span></dd></div>
            <div><dt className="dashboard-label"><NavigationIcon name="history" size={18} />Submissions</dt><dd className={styles.summaryValue}>{project.submissionCount}</dd><dd className="form-help">{project.latestVersion ? `Latest ${project.latestVersion}` : "Not yet submitted"}</dd></div>
        </dl>}
        <div className={styles.primary}>
            <ResearchProgressWidget key={`progress:${project?.id ?? "none"}`} project={project} />
            {children}
        </div>
        <div className={styles.secondary}>
            <RevisionWidget project={project} />
            <GroupWorkspaceWidget key={`workspace:${project?.id ?? "none"}`} project={project} />
        </div>
    </div>;
}
