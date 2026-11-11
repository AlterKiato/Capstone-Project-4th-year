"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignWorkspaceTaskAction, createWorkspaceTaskAction, deleteWorkspaceTaskAction, editWorkspaceTaskAction, updateWorkspaceTaskStatusAction } from "@/lib/actions/collaborative-workspace.action";
import type { TaskBoard, TaskBoardTask, WorkspaceResult } from "@/lib/workspace/contract";
import { TASK_STATUSES, taskDueDate, type TaskProject } from "@/lib/workspace/task-board-view";
import ResearchDialog from "./research-dialog";
import shared from "./student-ui.module.css";
import styles from "./student-task-board.module.css";

type Modal = { kind: "create" } | { kind: "edit" | "assign" | "status" | "delete"; task: TaskBoardTask };
type Props = { projects: TaskProject[]; project: TaskProject | null; invalidProject: boolean; board: WorkspaceResult<TaskBoard> | null;
    hideProjectSelector?: boolean; navigationBusy?: boolean; onBusyChange?: (busy: boolean) => void };
export default function StudentTaskBoard({ projects, project, invalidProject, board, hideProjectSelector = false, navigationBusy = false, onBusyChange }: Props) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const locked = useRef(false);
    const opener = useRef<HTMLElement | null>(null);
    const heading = useRef<HTMLHeadingElement>(null);
    const [modal, setModal] = useState<Modal | null>(null);
    const [notice, setNotice] = useState("");
    const [unconfirmed, setUnconfirmed] = useState(false);
    const data = board?.success ? board.data : null;
    const blocked = pending || unconfirmed || navigationBusy;
    useEffect(() => { onBusyChange?.(modal !== null || pending || unconfirmed); }, [modal, pending, unconfirmed, onBusyChange]);
    useEffect(() => {
        if (!modal && !pending && opener.current) {
            (opener.current.isConnected ? opener.current : heading.current)?.focus();
        }
    }, [modal, pending]);
    function openModal(next: Modal) {
        opener.current = document.activeElement as HTMLElement | null;
        setModal(next);
    }

    async function invoke<T>(operation: () => Promise<WorkspaceResult<T>>): Promise<WorkspaceResult<T>> {
        if (locked.current || unconfirmed) return { success: false, kind: "infrastructure", message: "Reload the workspace and verify the latest tasks before another change." };
        locked.current = true;
        return new Promise(resolve => startTransition(async () => {
            try {
                const result = await operation();
                if (result.kind === "infrastructure" || result.success && result.refreshRequired) setUnconfirmed(true);
                resolve(result);
            } catch {
                setUnconfirmed(true);
                resolve({ success: false, kind: "infrastructure", message: "The change could not be confirmed. Reload and check the task before retrying." });
            } finally { locked.current = false; }
        }));
    }
    function completed() {
        const message = modal?.kind === "create" ? "Task created." : modal?.kind === "delete" ? "Task deleted. Linked notes were preserved." : "Task updated.";
        setModal(null); setNotice(message); router.refresh();
    }
    const activeTask = modal && modal.kind !== "create" ? modal.task : null;
    const labels = { create: "New Task", edit: "Edit Task", assign: activeTask?.permissions.recovery ? "Recover Assignment" : "Assign Task", status: "Change Task Status", delete: "Delete Task" };
    return <>
        <div className={shared.toolbar}>
            {!hideProjectSelector && projects.length > 0 && <div className={shared.selector}><label htmlFor="workspace-project">Research project</label>
                <select id="workspace-project" value={project?.id ?? ""} disabled={modal !== null || blocked} onChange={event => {
                    const id = Number(event.target.value);
                    if (projects.some(item => item.id === id)) startTransition(() => router.push(`/dashboard/student/workspace?project=${id}`));
                }}>
                    {!project && <option value="" disabled>Choose a research project</option>}
                    {projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select></div>}
            {project && data && <button type="button" disabled={blocked} onClick={() => { setNotice(""); openModal({ kind: "create" }); }}>New Task</button>}
        </div>
        <p role="status" className={styles.notice}>{pending ? "Updating workspace…" : notice}</p>
        {unconfirmed && <div role="alert" className={styles.warning}><p>Further changes are paused. Reload and verify the latest tasks before retrying.</p><button type="button" onClick={() => window.location.reload()}>Reload workspace</button></div>}
        {invalidProject ? <section className="dashboard-panel"><h2>Project unavailable</h2><p>Choose one of your group’s projects or return to the default selection.</p><Link href="/dashboard/student/workspace">Open your workspace</Link></section> :
            !project ? <section className="dashboard-panel"><h2>No research projects yet</h2><p>Your active group’s projects will appear here. Create a project in Research Submissions, or ask your Adviser to check your group membership.</p><Link href="/dashboard/student/submissions">Open Research Submissions</Link></section> :
                !data ? <section className="dashboard-panel"><h2>{project.title}</h2><p role="alert">Tasks are unavailable or your access has changed. Reload to check your current workspace.</p><button type="button" onClick={() => window.location.reload()}>Reload workspace</button></section> :
                    <div className={styles.board} aria-busy={pending}>
                        <h2 ref={heading} tabIndex={-1} className={styles.projectTitle}>{project.title}</h2>
                        {TASK_STATUSES.map(status => {
                            const tasks = data.tasks.filter(task => task.status === status);
                            return <section key={status} className={styles.category} aria-label={status}>
                                <h3>{status} <span aria-label={`${tasks.length} tasks`}>{tasks.length}</span></h3>
                                {!tasks.length ? <p className={styles.empty}>No tasks {status === "To Do" ? "to do" : status === "In Progress" ? "in progress" : "completed"} yet.</p> :
                                    <ul className={styles.tasks}>{tasks.map(task => <li key={task.id}>
                                        <details><summary aria-label={`Details: ${task.title}`}>
                                            <span className={styles.taskTitle}>{task.title}</span>
                                            {task.description && <span className={styles.preview}>{task.description}</span>}
                                            <span className={styles.meta}>{task.assignee?.name ?? "Unassigned"}{task.assignee && !task.assignee.eligible && " · Needs reassignment"} · {taskDueDate(task.dueDate)}</span>
                                            <span className={shared.badge}>{task.status}</span><span className={styles.expand}>Expand details</span>
                                        </summary>
                                            <div className={styles.details}>
                                                <p className={styles.description}>{task.description || "No description provided."}</p>
                                                <dl><div><dt>Created by</dt><dd>{task.creator.name}{!task.creator.eligible && " (no longer eligible)"}</dd></div><div><dt>Status</dt><dd>{task.status}</dd></div><div><dt>Due date</dt><dd>{taskDueDate(task.dueDate)}</dd></div></dl>
                                                <div className={styles.controls}>
                                                    {task.permissions.edit && <button type="button" disabled={blocked} onClick={() => openModal({ kind: "edit", task })}>Edit</button>}
                                                    {task.permissions.assign && <button type="button" disabled={blocked} onClick={() => openModal({ kind: "assign", task })}>{task.permissions.recovery ? "Recover assignment" : "Assign"}</button>}
                                                    {task.permissions.status && <button type="button" disabled={blocked} onClick={() => openModal({ kind: "status", task })}>Change status</button>}
                                                    {task.permissions.delete && <button type="button" disabled={blocked} onClick={() => openModal({ kind: "delete", task })}>Delete</button>}
                                                    {!Object.values(task.permissions).some(Boolean) && <p className="form-help">Only the creator or assigned Student can update this task.</p>}
                                                </div>
                                            </div>
                                        </details>
                                    </li>)}</ul>}
                            </section>;
                        })}
                    </div>}
        {modal && project && data && <TaskDialog key={`${project.id}:${modal.kind}:${activeTask?.id ?? "new"}`} modal={modal} title={labels[modal.kind]}
            paperId={project.id} members={data.members} busy={pending} unconfirmed={unconfirmed} invoke={invoke} onSuccess={completed} onClose={() => setModal(null)} />}
    </>;
}

function TaskDialog({ modal, title, paperId, members, busy, unconfirmed, invoke, onSuccess, onClose }: {
    modal: Modal; title: string; paperId: number; members: TaskBoard["members"]; busy: boolean; unconfirmed: boolean;
    invoke: <T>(operation: () => Promise<WorkspaceResult<T>>) => Promise<WorkspaceResult<T>>; onSuccess: () => void; onClose: () => void;
}) {
    const task = modal.kind === "create" ? null : modal.task;
    const [changed, setChanged] = useState(false);
    const fields = modal.kind === "create" || modal.kind === "edit";
    const assignment = modal.kind === "create" || modal.kind === "assign";
    const needsChoice = modal.kind === "assign" || modal.kind === "status";
    return <ResearchDialog title={title} submitLabel={modal.kind === "delete" ? "Permanently delete task" : modal.kind === "create" ? "Create task" : "Save changes"}
        showCancel busy={busy} submitDisabled={unconfirmed || needsChoice && !changed} onClose={onClose} onSuccess={onSuccess}
        action={async form => {
            const text = (name: string) => String(form.get(name) ?? "");
            const assignedStudentId = text("assignedStudentId") === "" ? null : Number(text("assignedStudentId"));
            if (modal.kind === "create") return invoke(() => createWorkspaceTaskAction({ paperId, title: text("title"), description: text("description") || null, dueDate: text("dueDate") || null, assignedStudentId }));
            const target = { paperId, taskId: modal.task.id };
            if (modal.kind === "edit") return invoke(() => editWorkspaceTaskAction({ ...target, title: text("title"), description: text("description") || null, dueDate: text("dueDate") || null }));
            if (modal.kind === "assign") return invoke(() => assignWorkspaceTaskAction({ ...target, assignedStudentId }));
            if (modal.kind === "status") return invoke(() => updateWorkspaceTaskStatusAction({ ...target, status: text("status") }));
            return invoke(() => deleteWorkspaceTaskAction(target));
        }}>
        {task && <p className={styles.dialogTask}>{task.title}</p>}
        {fields && <>
            <div><label htmlFor="task-title">Title</label><input id="task-title" name="title" required maxLength={200} defaultValue={task?.title ?? ""} /></div>
            <div><label htmlFor="task-description">Description (optional)</label><textarea id="task-description" name="description" rows={4} maxLength={5000} defaultValue={task?.description ?? ""} /></div>
            <div><label htmlFor="task-due">Due date (optional)</label><input id="task-due" name="dueDate" type="date" defaultValue={task?.dueDate ?? ""} /></div>
        </>}
        {assignment && <>
            {task?.permissions.recovery && <p className="form-help">The original creator is no longer an eligible group member. You can reassign this task; its details and ownership stay unchanged.</p>}
            <div><label htmlFor="task-assignee">Assigned Student (optional)</label><select id="task-assignee" name="assignedStudentId" defaultValue={task?.assignedStudentId ?? ""} onChange={() => setChanged(true)}>
                <option value="">Unassigned</option>
                {task?.assignedStudentId && !task.assignee?.eligible && <option value={task.assignedStudentId} disabled>{task.assignee?.name ?? "Former member"} — Needs reassignment</option>}
                {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select></div>
        </>}
        {modal.kind === "status" && <div><label htmlFor="task-status">Task status</label><select id="task-status" name="status" defaultValue={task?.status} onChange={() => setChanged(true)}>{TASK_STATUSES.map(status => <option key={status}>{status}</option>)}</select><p className="form-help">This changes only the task, not research progress or Adviser decisions.</p></div>}
        {modal.kind === "delete" && <p>The task will be permanently deleted. Associated Shared Research Notes, including deleted notes, will be preserved and unlinked.</p>}
        {unconfirmed && <div role="alert"><p>Further changes are paused until you reload and verify the workspace.</p><button type="button" onClick={() => window.location.reload()}>Reload workspace</button></div>}
    </ResearchDialog>;
}
