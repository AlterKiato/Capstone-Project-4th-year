"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listWorkspaceTasksAction } from "@/lib/actions/collaborative-workspace.action";
import { workspaceTaskCounts } from "@/lib/student-experience-view";
import { TASK_STATUSES } from "@/lib/workspace/task-board-view";
import { workspaceHref } from "@/lib/workspace/workspace-view";
import ContextHelp from "./context-help";
import common from "./revisions.module.css";
import styles from "./student-progress-widgets.module.css";

export default function GroupWorkspaceWidget({ project }: { project?: { id: number; title: string } }) {
    const [state, setState] = useState<{ counts?: ReturnType<typeof workspaceTaskCounts>; error?: string } | null>(null);
    const [attempt, setAttempt] = useState(0);
    const paperId = project?.id;
    useEffect(() => {
        if (!paperId) return;
        let active = true;
        listWorkspaceTasksAction({ paperId }).then(result => {
            if (active) setState(result.success ? { counts: workspaceTaskCounts(result.data) } : { error: result.message });
        }).catch(() => { if (active) setState({ error: "Workspace could not be loaded." }); });
        return () => { active = false; };
    }, [paperId, attempt]);
    return <section className={`dashboard-panel ${common.widget}`} aria-labelledby="group-workspace-widget-heading">
        <div className={common.heading}><h2 id="group-workspace-widget-heading">Group Workspace</h2>
            <ContextHelp label="About group workspace">Tasks track your group&apos;s work. Done does not mean a research milestone is verified or a manuscript is Approved.</ContextHelp></div>
        {!project ? <p>No active research project.</p> : <div aria-busy={!state}>
            <h3>{project.title}</h3>
            {!state ? <p role="status">Loading workspace...</p> : state.error ? <><p role="alert">{state.error}</p><button type="button" onClick={() => { setState(null); setAttempt(value => value + 1); }}>Retry workspace</button></> : <>
                <dl className={styles.taskCounts}>{TASK_STATUSES.map(status => <div key={status}><dt>{status}</dt><dd>{state.counts?.[status]}</dd></div>)}</dl>
                {state.counts && Object.values(state.counts).every(count => count === 0) && <p className="form-help">No tasks yet.</p>}
            </>}
            <Link className={`context-detail ${styles.progressLink}`} href={workspaceHref(project.id, "tasks")}>Open workspace</Link>
        </div>}
    </section>;
}
