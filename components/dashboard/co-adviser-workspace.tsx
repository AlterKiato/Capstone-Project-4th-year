"use client";
import Link from "next/link";
import { coReviewHref } from "@/lib/utils/co-adviser-workspace";

import { useId, useRef, useState } from "react";
import { getCoAdviserWorkspaceAction, getDelegatedDocumentUrlAction, submitCoAdviserRecommendationAction } from "@/lib/actions/co-adviser.action";
import type { CoAssignment, CoWorkspace } from "@/types/co-adviser";
import ResearchDialog from "./research-dialog";
import styles from "./co-adviser.module.css";

function CoPdfButton({ assignment }: { assignment: CoAssignment }) {
    const [pending, setPending] = useState(false), [message, setMessage] = useState("");
    const locked = useRef(false), id = useId();
    async function open() {
        if (locked.current) return;
        locked.current = true; setPending(true); setMessage("");
        try {
            const url = await getDelegatedDocumentUrlAction({ assignmentId: assignment.id, submissionId: assignment.submissionId });
            if (url) window.location.assign(url);
            else setMessage("PDF access is unavailable or this assignment changed. Reload assignments to check its state.");
        } catch { setMessage("The PDF could not be opened. Check your connection and reload assignments."); }
        finally { locked.current = false; setPending(false); }
    }
    return <div aria-busy={pending}><button type="button" onClick={() => void open()} disabled={pending} aria-describedby={id}>{pending ? "Opening PDF…" : `Open PDF (${assignment.version})`}</button>
        <p id={id} role="status" className="form-help">{message}</p></div>;
}

export default function CoAdviserWorkspace({ initial, error = "" }: { initial: CoWorkspace | null; error?: string }) {
    const [workspace, setWorkspace] = useState(initial), [message, setMessage] = useState(error), [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<CoAssignment | null>(null), [requiresReload, setRequiresReload] = useState(false);
    const heading = useId(), editor = useId();
    async function reload(successMessage?: string) {
        setSelected(null); setRequiresReload(false); setLoading(true);
        try { const result = await getCoAdviserWorkspaceAction(); setWorkspace(result.success ? result.data ?? null : null); setMessage(result.success && successMessage ? successMessage : result.message); }
        catch { setWorkspace(null); setMessage("Assignments could not be loaded. Check your connection and reload assignments."); }
        finally { setLoading(false); }
    }
    const active = workspace?.assignments.filter(row => row.reviewAvailable) ?? [], history = workspace?.assignments.filter(row => !row.reviewAvailable) ?? [];
    return <section className={`dashboard-panel ${styles.section}`} aria-labelledby={heading} aria-busy={loading}>
        <div className={styles.heading}><h2 id={heading}>Your Co-Adviser assignments</h2><button type="button" onClick={() => void reload()} disabled={loading}>Reload assignments</button></div>
        <p className="form-help">Review only the delegated version. Recommendations are private to the Main Adviser and do not issue an academic decision.</p>
        <p role="status" aria-live="polite">{loading ? "Loading assignments…" : message}</p>
        {workspace && !loading && <>
            <h3>Active assignments</h3>
            {active.length ? <ul className={styles.list}>{active.map(row => <li key={row.id}>
                <div className={styles.heading}><h4>{row.title}</h4><span>{row.version} · Open</span></div>
                <div className={styles.actions}><Link href={coReviewHref(row)} className="context-row">Review workspace for {row.version}</Link><CoPdfButton assignment={row} /><button type="button" className={styles.primary} onClick={() => { setRequiresReload(false); setSelected(row); }}>Write recommendation for {row.version}</button></div>
            </li>)}</ul> : <p>You have no open assignments available for review.</p>}
            <h3>Assignment history</h3>
            {history.length ? <ul className={styles.list}>{history.map(row => <li key={row.id}><h4>{row.title}</h4><p>{row.version} · {row.state === "completed" ? "Completed" : row.state === "closed" ? "Closed" : "Review unavailable"}</p>
                <p className="form-help">Assigned <time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}</time></p><Link href={coReviewHref(row)} className="context-row">View assignment for {row.version}</Link>
            </li>)}</ul> : <p>No completed or closed assignments.</p>}
        </>}
        {selected && <ResearchDialog title="Submit private recommendation" submitLabel="Submit recommendation" showCancel submitDisabled={requiresReload}
            onClose={() => setSelected(null)} onSuccess={() => void reload("Private recommendation submitted. This assignment is complete.")}
            action={async data => {
                try {
                    const result = await submitCoAdviserRecommendationAction({ assignmentId: selected.id, submissionId: selected.submissionId, recommendation: data.get("recommendation") });
                    if (!result.success) setRequiresReload(true);
                    return result;
                } catch { setRequiresReload(true); return { success: false, message: "The result could not be confirmed. Reload assignments to check whether it completed before retrying." }; }
            }}>
            <p>{selected.title} · {selected.version}</p><p className="form-help">Only the Main Adviser receives this recommendation. Submitting completes this assignment and closes new delegated PDF access. You cannot edit it afterward.</p>
            <label htmlFor={editor}>Plain-text recommendation</label><textarea id={editor} name="recommendation" rows={10} required maxLength={20000} />
            <p className="form-help">Maximum 20,000 characters. This does not create Student-facing feedback.</p>
            {requiresReload && <><p className="form-help">Copy your draft before reloading if you need to keep it.</p><button type="button" onClick={() => void reload()}>Reload assignments before retrying</button></>}
        </ResearchDialog>}
    </section>;
}
