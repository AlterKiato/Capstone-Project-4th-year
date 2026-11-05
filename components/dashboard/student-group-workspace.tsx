"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { NotesBoard, TaskBoard, WorkspaceResult } from "@/lib/workspace/contract";
import type { TaskProject } from "@/lib/workspace/task-board-view";
import { workspaceHref, type WorkspaceTab } from "@/lib/workspace/workspace-view";
import StudentTaskBoard from "./student-task-board";
import StudentResearchNotes from "./student-research-notes";
import shared from "./student-ui.module.css";
import styles from "./student-research-notes.module.css";

export default function StudentGroupWorkspace({ projects, project, invalidProject, tab, deletedOnly, board, notes }: {
    projects: TaskProject[]; project: TaskProject | null; invalidProject: boolean; tab: WorkspaceTab; deletedOnly: boolean;
    board: WorkspaceResult<TaskBoard> | null; notes: WorkspaceResult<NotesBoard> | null;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [childBusy, setChildBusy] = useState(false);
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);
    const focusTab = useRef<number | null>(null);
    const blocked = pending || childBusy;
    const choices = ["tasks", "notes"] as const;
    useEffect(() => {
        if (!pending && focusTab.current !== null) {
            tabs.current[focusTab.current]?.focus(); focusTab.current = null;
        }
    }, [pending, tab]);
    return <>
        {projects.length > 0 && <div className={shared.toolbar}><div className={shared.selector}>
            <label htmlFor="workspace-project">Research project</label>
            <select id="workspace-project" value={project?.id ?? ""} disabled={blocked} onChange={event => {
                const id = Number(event.target.value);
                if (projects.some(item => item.id === id)) startTransition(() => router.push(workspaceHref(id, tab, deletedOnly)));
            }}>
                {!project && <option value="" disabled>Choose a research project</option>}
                {projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
        </div></div>}
        <div role="tablist" aria-label="Group workspace" className={styles.tabs}>
            {choices.map((choice, index) => <button key={choice} ref={element => { tabs.current[index] = element; }} type="button" role="tab"
                id={`workspace-${choice}-tab`} aria-controls={`workspace-${choice}-panel`} aria-selected={tab === choice} tabIndex={tab === choice ? 0 : -1}
                disabled={blocked} onClick={() => {
                    if (choice !== tab) { focusTab.current = index; startTransition(() => router.push(workspaceHref(project?.id ?? null, choice))); }
                }} onKeyDown={event => {
                    const next = event.key === "ArrowRight" ? (index + 1) % 2 : event.key === "ArrowLeft" ? (index + 1) % 2 : event.key === "Home" ? 0 : event.key === "End" ? 1 : null;
                    if (next !== null) { event.preventDefault(); tabs.current[next]?.focus(); }
                }}>{choice === "tasks" ? "Tasks" : "Notes"}</button>)}
        </div>
        <p role="status" className={styles.notice}>{pending ? "Loading workspace…" : ""}</p>
        {choices.map(choice => <div key={choice} role="tabpanel" id={`workspace-${choice}-panel`} aria-labelledby={`workspace-${choice}-tab`} hidden={choice !== tab}>
            {choice === tab && (tab === "tasks" ? <StudentTaskBoard projects={projects} project={project} invalidProject={invalidProject} board={board}
                hideProjectSelector navigationBusy={pending} onBusyChange={setChildBusy} /> :
                <StudentResearchNotes key={String(deletedOnly)} project={project} invalidProject={invalidProject} result={notes} deletedOnly={deletedOnly} navigationBusy={pending} onBusyChange={setChildBusy} />)}
        </div>)}
    </>;
}
