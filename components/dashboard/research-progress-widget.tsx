"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readResearchProgressAction } from "@/lib/actions/research-progress.action";
import { researchProgressSummary, type ResearchProgress } from "@/lib/research-progress";
import { taskDueDate } from "@/lib/workspace/task-board-view";
import ContextHelp from "./context-help";
import NavigationIcon from "./navigation-icon";
import common from "./revisions.module.css";
import styles from "./student-progress-widgets.module.css";

export default function ResearchProgressWidget({ project }: { project?: { id: number; title: string } }) {
    const [state, setState] = useState<{ data?: ResearchProgress; error?: string } | null>(null);
    const [attempt, setAttempt] = useState(0);
    const paperId = project?.id;
    useEffect(() => {
        if (!paperId) return;
        let active = true;
        readResearchProgressAction({ paperId }).then(result => {
            if (active) setState(result.success && result.data ? { data: result.data } : { error: result.message });
        }).catch(() => { if (active) setState({ error: "Research progress could not be loaded." }); });
        return () => { active = false; };
    }, [paperId, attempt]);
    const summary = state?.data ? researchProgressSummary(state.data) : null;
    return <section className={`dashboard-panel ${common.widget}`} aria-labelledby="research-progress-widget-heading">
        <div className={common.heading}>
            <h2 id="research-progress-widget-heading" className="dashboard-label"><NavigationIcon name="report" size={18} />Research Progress</h2>
            <ContextHelp label="About research progress">Completion requires Main Adviser verification. Submitting or linking a PDF alone does not complete a milestone. Deadlines use Manila dates.</ContextHelp>
        </div>
        {!project ? <p>No active research project.</p> : <div aria-busy={!state}>
            <h3>{project.title}</h3>
            {!state ? <p role="status">Loading research progress...</p> : state.error ? <>
                <p role="alert">{state.error}</p>
                <button type="button" onClick={() => { setState(null); setAttempt(value => value + 1); }}>Retry progress</button>
            </> : summary && (summary.total ? <>
                <p className={styles.count}><strong>{summary.completed} / {summary.total} completed</strong></p>
                <progress className={common.progress} max={summary.total} value={summary.completed} aria-label="Verified milestones completed" />
                <dl className={styles.deadlines}>
                    <div><dt>Next deadline</dt><dd>{summary.next ? <>
                        <time dateTime={summary.next.dueDate}>{taskDueDate(summary.next.dueDate)}</time>
                        <span className={styles.deadlineTitle}>{summary.next.title}</span>
                    </> : "No upcoming deadline"}</dd></div>
                    <div><dt>Overdue</dt><dd>{summary.overdue}</dd></div>
                </dl>
            </> : <p>Milestones not configured.</p>)}
            <Link className={`context-detail ${styles.progressLink}`} href={`/dashboard/student/submissions?project=${project.id}#research-progress`}>View progress</Link>
        </div>}
    </section>;
}
