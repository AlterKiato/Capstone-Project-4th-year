"use client";

import { useEffect, useId, useState } from "react";
import { readResearchProgressAction, mutateResearchProgressAction } from "@/lib/actions/research-progress.action";
import { completedMilestones, milestoneCompleted, milestoneOverdue, milestoneStatus, type ProgressMilestone, type ResearchProgress as Progress } from "@/lib/research-progress";
import { taskDueDate } from "@/lib/workspace/task-board-view";
import ResearchDialog from "./research-dialog";
import styles from "./student-ui.module.css";
import local from "./research-progress.module.css";

export default function ResearchProgress({ paperId }: { paperId: number }) {
    return <ProgressPanel key={paperId} paperId={paperId} />;
}

function ProgressPanel({ paperId }: { paperId: number }) {
    const heading = useId();
    const [progress, setProgress] = useState<Progress | null>(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [modal, setModal] = useState<{ operation: "create" | "edit" | "link" | "verify"; row?: ProgressMilestone } | null>(null);
    const [reload, setReload] = useState(0);
    useEffect(() => {
        let active = true;
        readResearchProgressAction({ paperId }).then(result => {
            if (!active) return;
            setProgress(result.success ? result.data ?? null : null);
            setMessage(result.success ? "" : result.message); setLoading(false);
        }).catch(() => { if (active) { setProgress(null); setMessage("Research progress could not be loaded. Reload to try again."); setLoading(false); } });
        return () => { active = false; };
    }, [paperId, reload]);
    function refresh() { setLoading(true); setProgress(null); setModal(null); setReload(value => value + 1); }
    return <section className={`dashboard-panel ${styles.section} ${local.panel}`} aria-labelledby={heading} aria-busy={loading}>
        <div className={styles.toolbar}><h2 id={heading}>Research Progress</h2><button type="button" disabled={loading} onClick={refresh}>Reload progress</button></div>
        <p role="status" aria-live="polite">{loading ? "Loading research progress..." : message}</p>
        {progress && <>
            <p>{progress.milestones.length ? `${completedMilestones(progress.milestones)} of ${progress.milestones.length} milestones completed` : "Milestones not configured."}</p>
            <p className="form-help">Completion requires Main Adviser verification of an Approved version. Deadlines use Asia/Manila dates.</p>
            {progress.canManage && <button type="button" onClick={() => setModal({ operation: "create" })}>Create milestone</button>}
            <ul className={local.list}>{progress.milestones.map(row => <li key={row.id}>
                <h3>{row.title}</h3>
                <p>Due <time dateTime={row.dueDate}>{taskDueDate(row.dueDate)}</time>{milestoneOverdue(row, progress.today) && <strong> · Overdue</strong>}</p>
                <p>{row.evidence ? `Evidence: ${row.evidence.version} · ${row.evidence.status}` : "No evidence linked"}</p>
                <p><strong>{milestoneStatus(row)}</strong>{row.verifiedAt && <> · Verified <time dateTime={row.verifiedAt}>{new Date(row.verifiedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</time></>}</p>
                <div className={local.actions}>{progress.canManage ? <>
                    <button type="button" onClick={() => setModal({ operation: "edit", row })} aria-label={`Edit milestone: ${row.title}`}>Edit</button>
                    {!milestoneCompleted(row) && <button type="button" disabled={row.evidence?.status !== "Approved"} onClick={() => setModal({ operation: "verify", row })} aria-label={`Verify completion: ${row.title}`}>Verify completion</button>}
                </> : <button type="button" disabled={!progress.submissions.length} onClick={() => setModal({ operation: "link", row })} aria-label={`Link submission: ${row.title}`}>{row.submissionId ? "Change linked version" : "Link submission"}</button>}</div>
            </li>)}</ul>
            {!progress.canManage && !progress.submissions.length && <p className="form-help">Submit a PDF through Submission History before linking evidence.</p>}
        </>}
        {modal && progress && <ResearchDialog title={modal.operation === "create" ? "Create milestone" : modal.operation === "edit" ? "Edit milestone" : modal.operation === "link" ? "Link submission evidence" : "Verify milestone completion"}
            submitLabel={modal.operation === "verify" ? "Confirm completion" : "Save milestone"} showCancel onClose={() => setModal(null)} onSuccess={refresh}
            action={async form => mutateResearchProgressAction({ operation: modal.operation, paperId,
                ...(modal.row ? { milestoneId: modal.row.id, expectedRevision: modal.row.revision } : {}),
                ...(["create", "edit"].includes(modal.operation) ? { title: form.get("title"), dueDate: form.get("dueDate") } : {}),
                ...(modal.operation === "link" ? { submissionId: Number(form.get("submissionId")) } : {}) })}>
            {modal.row && <p>{modal.row.title}</p>}
            {["create", "edit"].includes(modal.operation) && <>
                <div><label htmlFor={`${heading}-title`}>Milestone title</label><input id={`${heading}-title`} name="title" required maxLength={200} defaultValue={modal.row?.title} /></div>
                <div><label htmlFor={`${heading}-due`}>Deadline (Asia/Manila)</label><input id={`${heading}-due`} name="dueDate" type="date" required min="1900-01-01" max="9999-12-31" defaultValue={modal.row?.dueDate} /></div>
            </>}
            {modal.operation === "link" && <div><label htmlFor={`${heading}-evidence`}>Existing submission version</label><select id={`${heading}-evidence`} name="submissionId" required defaultValue={modal.row?.submissionId ?? progress.submissions[0]?.id}>
                {progress.submissions.map(row => <option key={row.id} value={row.id}>{row.version} · {row.status}</option>)}
            </select></div>}
            {["edit", "link"].includes(modal.operation) && <p className="form-help">Changing the title, deadline or evidence clears completion and requires Main Adviser verification again.</p>}
            {modal.operation === "verify" && <p>Confirm completion using {modal.row?.evidence?.version} ({modal.row?.evidence?.status}). This records verification for this version only.</p>}
        </ResearchDialog>}
    </section>;
}
