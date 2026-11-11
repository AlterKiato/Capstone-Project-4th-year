"use client";

import { useState } from "react";
import ResearchProgressWidget from "./research-progress-widget";
import RevisionWidget from "./revision-widget";
import GroupWorkspaceWidget from "./group-workspace-widget";
import styles from "./student-progress-widgets.module.css";

export default function StudentProgressWidgets({ projects, initialProjectId }: { projects: { id: number; title: string }[]; initialProjectId?: number }) {
    const [selected, setSelected] = useState(initialProjectId ?? projects[0]?.id);
    const project = projects.find(row => row.id === selected) ?? projects[0];
    return <div className={styles.widgets}>
        {projects.length > 1 && <div className={styles.selector}>
            <label htmlFor="dashboard-progress-project">Research project</label>
            <select id="dashboard-progress-project" value={project?.id} onChange={event => setSelected(Number(event.target.value))}>
                {projects.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}
            </select>
        </div>}
        <div className={styles.cards}>
            <ResearchProgressWidget key={`progress:${project?.id ?? "none"}`} project={project} />
            <RevisionWidget project={project} />
            <GroupWorkspaceWidget key={`workspace:${project?.id ?? "none"}`} project={project} />
        </div>
    </div>;
}
