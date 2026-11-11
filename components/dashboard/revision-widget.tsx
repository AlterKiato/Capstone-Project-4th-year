"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { readRevisionsAction } from "@/lib/actions/revision.action";
import { revisionCounts, type RevisionChecklist } from "@/lib/revisions";
import ContextHelp from "./context-help";
import styles from "./revisions.module.css";

function ProjectWidget({ project }: { project: { id: number; title: string } }) {
    const [state, setState] = useState<{ data?: RevisionChecklist; error?: string } | null>(null);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let active = true;
        readRevisionsAction({ paperId: project.id }).then(result => { if (active) setState(result.success && result.data ? { data: result.data } : { error: result.message }); })
            .catch(() => { if (active) setState({ error: "Revisions could not be loaded." }); });
        return () => { active = false; };
    }, [project.id, attempt]);
    const cycle = state?.data?.cycles[0];
    const counts = revisionCounts(cycle);
    return <div aria-busy={!state}>
        <h3>{project.title}</h3>
        {!state ? <p role="status">Loading revisions...</p> : state.error ? <><p role="alert">{state.error}</p><button type="button" onClick={() => { setState(null); setAttempt(value => value + 1); }}>Retry revisions</button></> : counts.total ? <>
            <p><strong>{counts.addressed} / {counts.total} Addressed</strong> · {counts.pending} Pending</p>
            <progress className={styles.progress} max={counts.total} value={counts.addressed} aria-label="Revision items addressed" />
            <p className="form-help">{cycle?.version} correction cycle{counts.pending === 0 ? " · All responses recorded" : ""}</p>
        </> : <p>No revision items yet.</p>}
        <Link className="context-detail" href={`/dashboard/student/submissions?project=${project.id}#revision-checklist`}>View revisions</Link>
    </div>;
}
export default function RevisionWidget({ project }: { project?: { id: number; title: string } }) {
    return <section className={`dashboard-panel ${styles.widget}`} aria-labelledby="revision-widget-heading">
        <div className={styles.heading}><h2 id="revision-widget-heading">Revision Checklist</h2>
            <ContextHelp label="About revision progress">Counts cover your saved Action Taken responses in this project&apos;s latest correction cycle. Addressed does not mean Approved. Select a project to view its own counts.</ContextHelp></div>
        {project ? <ProjectWidget key={project.id} project={project} /> : <p>No active research project.</p>}
    </section>;
}
