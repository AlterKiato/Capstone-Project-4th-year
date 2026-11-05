"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWorkspaceNoteAction, deleteWorkspaceNoteAction, editWorkspaceNoteAction, getWorkspaceNoteAction, linkWorkspaceNoteAction, restoreWorkspaceNoteAction } from "@/lib/actions/collaborative-workspace.action";
import type { NoteData, NotesBoard, NotesBoardNote, WorkspaceResult } from "@/lib/workspace/contract";
import type { TaskProject } from "@/lib/workspace/task-board-view";
import { workspaceHref } from "@/lib/workspace/workspace-view";
import ResearchDialog from "./research-dialog";
import shared from "./student-ui.module.css";
import styles from "./student-research-notes.module.css";

type Modal = { kind: "create" } | { kind: "edit" | "link" | "delete" | "restore"; note: NotesBoardNote };
const labels = { create: "New Note", edit: "Edit Note", link: "Link Task", delete: "Delete Note", restore: "Restore Note" };
const updated = (value: string) => new Date(value).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

export default function StudentResearchNotes({ project, invalidProject, result, deletedOnly, navigationBusy, onBusyChange }: {
    project: TaskProject | null; invalidProject: boolean; result: WorkspaceResult<NotesBoard> | null;
    deletedOnly: boolean; navigationBusy: boolean; onBusyChange: (busy: boolean) => void;
}) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [modal, setModal] = useState<Modal | null>(null);
    const [notice, setNotice] = useState("");
    const [unconfirmed, setUnconfirmed] = useState(false);
    const locked = useRef(false), opener = useRef<HTMLElement | null>(null);
    const heading = useRef<HTMLHeadingElement>(null);
    const data = result?.success ? result.data : null;
    const blocked = pending || navigationBusy || unconfirmed;
    useEffect(() => { onBusyChange(modal !== null || pending || unconfirmed); }, [modal, pending, unconfirmed, onBusyChange]);
    useEffect(() => {
        if (!modal && !pending && opener.current) (opener.current.isConnected ? opener.current : heading.current)?.focus();
    }, [modal, pending]);
    function open(next: Modal) { opener.current = document.activeElement as HTMLElement; setNotice(""); setModal(next); }
    function invoke(operation: () => Promise<WorkspaceResult<NoteData>>): Promise<WorkspaceResult<NoteData>> {
        if (locked.current || unconfirmed) return Promise.resolve({ success: false, kind: "infrastructure", message: "Reload and verify the workspace before another change." });
        locked.current = true;
        return new Promise(resolve => startTransition(async () => {
            try {
                const response = await operation();
                if (response.kind === "infrastructure" || response.success && response.refreshRequired) setUnconfirmed(true);
                resolve(response);
            } catch {
                setUnconfirmed(true);
                resolve({ success: false, kind: "infrastructure", message: "The change could not be confirmed. Reload and check the note before retrying." });
            } finally { locked.current = false; }
        }));
    }
    return <>
        {project && data && <div className={shared.toolbar}>
            {!deletedOnly && <button type="button" disabled={blocked} onClick={() => open({ kind: "create" })}>New Note</button>}
            <button type="button" className={shared.toggle} disabled={blocked} onClick={() => startTransition(() => router.push(workspaceHref(project.id, "notes", !deletedOnly)))}>
                {deletedOnly ? "Active Notes" : "Recently Deleted"}
            </button>
        </div>}
        <p role="status" className={styles.notice}>{pending ? "Updating notes…" : notice}</p>
        {unconfirmed && <div role="alert" className={styles.warning}><p>Further changes are paused. Reload and verify the latest notes before retrying.</p><button type="button" onClick={() => window.location.reload()}>Reload workspace</button></div>}
        {invalidProject ? <section className="dashboard-panel"><h2>Project unavailable</h2><p>Choose one of your group’s projects.</p><Link href={workspaceHref(null, "notes")}>Open your workspace</Link></section> :
            !project ? <section className="dashboard-panel"><h2>No research projects yet</h2><p>Your active group’s projects will appear here.</p><Link href="/dashboard/student/submissions">Open Research Submissions</Link></section> :
                !data ? <section className="dashboard-panel"><h2>{project.title}</h2><p role="alert">Notes are unavailable or your access has changed. Reload to check your current workspace.</p><button type="button" onClick={() => window.location.reload()}>Reload workspace</button></section> :
                    <section aria-busy={pending} className={styles.notes}>
                        <h2 ref={heading} tabIndex={-1}>{deletedOnly ? "Recently Deleted" : "Shared Research Notes"}</h2>
                        <p className="form-help">{project.title}{deletedOnly ? " · Only your deleted notes are shown. Restoring returns them to the shared list." : " · Shared with your group. Only the creator can change a note."}</p>
                        {!data.notes.length ? <p className={styles.empty}>{deletedOnly ? "You have no deleted notes in this project." : "No notes yet. Add a shared research note for this project."}</p> :
                            <ul className={styles.list}>{data.notes.map(note => <li key={note.id}>
                                <details><summary aria-label={`Read note: ${note.title}`}>
                                    <span className={styles.title}>{note.title}</span><span className={styles.preview}>{note.content}</span>
                                    <span className={styles.meta}>{note.creatorName} · Updated {updated(note.updatedAt)} · {note.linkedTask?.title ?? "Unlinked"}</span>
                                </summary>
                                    <div className={styles.details}><p className={styles.content}>{note.content}</p>
                                        <dl><div><dt>Creator</dt><dd>{note.creatorName}</dd></div><div><dt>Updated</dt><dd>{updated(note.updatedAt)}</dd></div><div><dt>Linked task</dt><dd>{note.linkedTask?.title ?? "Unlinked"}</dd></div></dl>
                                        <div className={styles.controls}>
                                            {note.permissions.edit && <button type="button" disabled={blocked} onClick={() => open({ kind: "edit", note })}>Edit</button>}
                                            {note.permissions.link && <button type="button" disabled={blocked} onClick={() => open({ kind: "link", note })}>Link / unlink task</button>}
                                            {note.permissions.delete && <button type="button" disabled={blocked} onClick={() => open({ kind: "delete", note })}>Delete</button>}
                                            {note.permissions.restore && <button type="button" disabled={blocked} onClick={() => open({ kind: "restore", note })}>Restore</button>}
                                            {!Object.values(note.permissions).some(Boolean) && <p className="form-help">Read only · Only the creator can change this note.</p>}
                                        </div>
                                    </div>
                                </details>
                            </li>)}</ul>}
                    </section>}
        {modal && project && data && <NoteDialog modal={modal} paperId={project.id} tasks={data.tasks} busy={pending} unconfirmed={unconfirmed} invoke={invoke}
            onClose={() => setModal(null)} onSuccess={() => {
                setNotice(modal.kind === "create" ? "Note created." : modal.kind === "delete" ? "Note moved to Recently Deleted." : modal.kind === "restore" ? "Note restored." : "Note updated.");
                setModal(null);
                if (modal.kind === "restore") router.push(workspaceHref(project.id, "notes"));
                router.refresh();
            }} />}
    </>;
}

function NoteDialog({ modal, paperId, tasks, busy, unconfirmed, invoke, onClose, onSuccess }: {
    modal: Modal; paperId: number; tasks: NotesBoard["tasks"]; busy: boolean; unconfirmed: boolean;
    invoke: (operation: () => Promise<WorkspaceResult<NoteData>>) => Promise<WorkspaceResult<NoteData>>;
    onClose: () => void; onSuccess: () => void;
}) {
    const [source, setSource] = useState<NoteData | null>(modal.kind === "create" ? null : modal.note);
    const [title, setTitle] = useState(source?.title ?? "");
    const [content, setContent] = useState(source?.content ?? "");
    const choice = (id: number | null | undefined) => id && tasks.some(task => task.id === id) ? String(id) : "";
    const [taskId, setTaskId] = useState(choice(source?.taskId));
    const [conflict, setConflict] = useState(false), [reloading, setReloading] = useState(false);
    const [reloadMessage, setReloadMessage] = useState("");
    const [generation, setGeneration] = useState(0);
    const dirty = useRef(false), readLocked = useRef(false);
    const fields = modal.kind === "create" || modal.kind === "edit";
    const linking = modal.kind === "create" || modal.kind === "link";
    // Native dialogs protect close/Escape and document unload. This also protects
    // cancelable same-document history navigation on browsers with Navigation API.
    useEffect(() => {
        const navigation = (window as Window & { navigation?: EventTarget }).navigation;
        const protect = (event: Event) => {
            if (event.cancelable && (busy || readLocked.current || dirty.current && !window.confirm("Discard this note draft and leave the workspace?"))) event.preventDefault();
        };
        navigation?.addEventListener("navigate", protect);
        return () => navigation?.removeEventListener("navigate", protect);
    }, [busy]);
    async function reloadLatest() {
        if (!source || readLocked.current || busy || unconfirmed) return;
        if (!window.confirm("Reload the latest server version? This replaces the current draft, including any unsaved text or task selection.")) return;
        readLocked.current = true; setReloading(true); setReloadMessage("");
        try {
            const response = await getWorkspaceNoteAction({ paperId, noteId: source.id });
            if (!response.success) { setReloadMessage(response.message); return; }
            if (Boolean(response.data.deletedAt) !== (modal.kind === "restore")) {
                setReloadMessage("This note was already deleted or restored. Close this dialog and reload the workspace to check its current state.");
                return;
            }
            setSource(response.data); setTitle(response.data.title); setContent(response.data.content); setTaskId(choice(response.data.taskId));
            setConflict(false); dirty.current = false; setGeneration(value => value + 1);
            setReloadMessage("Latest version loaded. Review it before submitting.");
        } catch { setReloadMessage("The latest version could not be loaded. Your draft is still here."); }
        finally { readLocked.current = false; setReloading(false); }
    }
    return <ResearchDialog key={generation} title={labels[modal.kind]} submitLabel={modal.kind === "create" ? "Create note" : modal.kind === "delete" ? "Move to Recently Deleted" : modal.kind === "restore" ? "Restore note" : "Save changes"}
        showCancel busy={busy || reloading} submitDisabled={conflict || unconfirmed} onClose={onClose} onSuccess={onSuccess}
        transferControls={<>
            {conflict && <div className={styles.warning}><p role="alert">This note changed while you were editing. Your draft is still here. Review the latest version before saving again.</p>
                <p className="form-help">Reloading replaces your draft with the server version.</p><button type="button" disabled={busy || reloading || unconfirmed} onClick={reloadLatest}>Reload latest version</button></div>}
            {reloadMessage && <p role="status">{reloadMessage}</p>}
        </>}
        action={async () => {
            const target = source ? { paperId, noteId: source.id, expectedVersion: source.version } : null;
            const response = await invoke(() => {
                if (modal.kind === "create") return createWorkspaceNoteAction({ paperId, title, content, taskId: taskId ? Number(taskId) : null });
                if (!target) throw new Error("Note unavailable.");
                if (modal.kind === "edit") return editWorkspaceNoteAction({ ...target, title, content });
                if (modal.kind === "link") return linkWorkspaceNoteAction({ ...target, taskId: taskId ? Number(taskId) : null });
                if (modal.kind === "delete") return deleteWorkspaceNoteAction(target);
                return restoreWorkspaceNoteAction(target);
            });
            if (response.kind === "conflict") setConflict(true);
            if (response.success && response.refreshRequired) return { ...response, keepOpen: true, message: "The change was saved, but the refreshed list could not be confirmed. Reload and verify before another change." };
            if (response.success) dirty.current = false;
            return response;
        }}>
        {source && <p className={styles.title}>{source.title}</p>}
        {fields && <>
            <div><label htmlFor="note-title">Title</label><input id="note-title" name="title" required maxLength={200} value={title} onChange={event => { dirty.current = true; setTitle(event.target.value); }} /></div>
            <div><label htmlFor="note-content">Content</label><textarea id="note-content" name="content" required maxLength={20000} rows={8} value={content} onChange={event => { dirty.current = true; setContent(event.target.value); }} /></div>
            <p className="form-help">Plain text · No formatting or attachments.</p>
        </>}
        {linking && <div><label htmlFor="note-task">Linked task (optional)</label><select id="note-task" name="taskId" value={taskId} onChange={event => { dirty.current = true; setTaskId(event.target.value); }}>
            <option value="">Unlinked</option>{tasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}
        </select><p className="form-help">Only tasks in this research project are available.</p></div>}
        {modal.kind === "delete" && <p>This removes the note from the shared list. Its stored content is preserved, and you can restore it from Recently Deleted.</p>}
        {modal.kind === "restore" && <p>Restore this note to the shared list so your group can read it again.</p>}
        {unconfirmed && <div role="alert"><p>Further changes are paused until you reload and verify the workspace.</p><button type="button" onClick={() => window.location.reload()}>Reload workspace</button></div>}
    </ResearchDialog>;
}
