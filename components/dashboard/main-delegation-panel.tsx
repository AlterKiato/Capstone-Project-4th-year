"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cancelCoAdviserAssignmentAction, delegateCoAdvisersAction, getMainDelegationPanelAction, getRecommendationForOfficialDraftAction } from "@/lib/actions/co-adviser.action";
import { useOfficialFeedbackDraft } from "@/app/dashboard/adviser/submissions/OfficialFeedbackDraft";
import type { MainDelegationPanel as Panel } from "@/types/co-adviser";
import ResearchDialog from "./research-dialog";
import styles from "./co-adviser.module.css";
import ContextHelp from "./context-help";

export default function MainDelegationPanel({ submissionId }: { submissionId: number }) {
    const [panel, setPanel] = useState<Panel | null>(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [dialog, setDialog] = useState<"delegate" | Panel["assignments"][number] | null>(null);
    const [requiresReload, setRequiresReload] = useState(false);
    const heading = useId(), selection = useId();
    const draft = useOfficialFeedbackDraft();
    const [importing,setImporting] = useState<number | null>(null);
    const [imported,setImported] = useState<number[]>([]);
    const importLock = useRef(false);
    async function importRecommendation(assignmentId: number) {
        if (importLock.current || imported.includes(assignmentId) || !draft.available) return;
        importLock.current=true;setImporting(assignmentId);
        try {
            const result=await getRecommendationForOfficialDraftAction({assignmentId,submissionId});
            if (!result.success || !result.data) {setMessage(result.message);return;}
            if (result.data.assignmentId !== assignmentId || result.data.submissionId !== submissionId) {setMessage("Recommendation scope changed. Reload assignments before retrying.");return;}
            const added=draft.append(result.data);setMessage(added.message);
            if (added.success) setImported(previous=>[...previous,assignmentId]);
        } catch {setMessage("Recommendation could not be imported. Your draft has not changed.");}
        finally {importLock.current=false;setImporting(null);}
    }
    useEffect(() => {
        let active = true;
        getMainDelegationPanelAction(submissionId).then(result => {
            if (!active) return;
            setPanel(result.success ? result.data ?? null : null); setMessage(result.message); setLoading(false);
        }).catch(() => { if (active) { setPanel(null); setMessage("Assignments could not be loaded. Reload assignments to try again."); setLoading(false); } });
        return () => { active = false; };
    }, [submissionId]);
    async function reload(successMessage?: string) {
        setDialog(null); setRequiresReload(false); setLoading(true);
        try {
            const result = await getMainDelegationPanelAction(submissionId);
            setPanel(result.success ? result.data ?? null : null); setMessage(result.success && successMessage ? successMessage : result.message);
        } catch { setPanel(null); setMessage("Assignments could not be loaded. Reload assignments to try again."); }
        finally { setLoading(false); }
    }
    const choices = panel?.advisers.filter(adviser => !panel.assignments.some(row => row.coAdviserId === adviser.id && row.state === "open")) ?? [];
    return <section className={`dashboard-panel ${styles.section}`} aria-labelledby={heading} aria-busy={loading}>
        <div className={styles.heading}><h2 id={heading}>Co-Adviser recommendations</h2><button type="button" onClick={() => void reload()} disabled={loading}>Reload assignments</button></div>
        <ContextHelp label="About Co-Adviser recommendations">Private recommendations support your review. You can issue an official decision without waiting for them.</ContextHelp>
        <p role="status" aria-live="polite">{loading ? "Loading assignments…" : message}</p>
        {panel && !loading && <>
            {panel.eligible ? <><button type="button" className={styles.primary} disabled={!choices.length} onClick={() => { setRequiresReload(false); setDialog("delegate"); }}>Delegate this version</button>
                {!choices.length && <p className="form-help">No additional active Advisers are available for this version.</p>}</> : <p className="form-help">This version is finalized. New delegation is unavailable.</p>}
            {panel.assignments.length ? <ul className={styles.list}>{panel.assignments.map(row => <li key={row.id}>
                <div className={styles.heading}><h3>{row.name}</h3><span>{row.state === "closed" && row.closureReason === "main-cancelled" ? "Cancelled" : row.state === "closed" ? "Closed" : row.state === "completed" ? "Completed" : "Open"}</span></div>
                {row.state === "completed" && <><p className="form-help">Private recommendation</p><p className={styles.recommendation}>{row.recommendation}</p>
                    <button type="button" disabled={!draft.available || importing !== null || imported.includes(row.id)} onClick={()=>void importRecommendation(row.id)}>
                        {importing === row.id ? "Loading recommendation..." : imported.includes(row.id) ? "Added to Official Feedback" : "Use in Official Feedback"}
                    </button>{!draft.available && <p className="form-help">Import is available while editing official feedback under review.</p>}
                </>}
                {row.state === "open" && <button type="button" onClick={() => { setRequiresReload(false); setDialog(row); }}>Cancel assignment for {row.name}</button>}
            </li>)}</ul> : <p>No Co-Adviser assignments for this version.</p>}
        </>}
        {dialog && <ResearchDialog title={dialog === "delegate" ? "Delegate submission version" : "Cancel Co-Adviser assignment"}
            submitLabel={dialog === "delegate" ? "Assign selected Advisers" : "Confirm cancellation"} showCancel submitDisabled={requiresReload}
            onClose={() => setDialog(null)} onSuccess={() => void reload(dialog === "delegate" ? "Co-Adviser review assigned for this version." : "Assignment cancelled.")}
            action={async data => {
                try {
                    const result = dialog === "delegate" ? await delegateCoAdvisersAction({ submissionId, coAdviserIds: data.getAll("coAdviserIds").map(Number) })
                        : await cancelCoAdviserAssignmentAction({ submissionId, assignmentId: dialog.id, confirmed: true });
                    if (!result.success) setRequiresReload(true);
                    return result;
                } catch { setRequiresReload(true); return { success: false, message: "The result could not be confirmed. Reload assignments before retrying." }; }
            }}>
            {dialog === "delegate" ? <><label htmlFor={selection}>Eligible Co-Advisers</label><select id={selection} name="coAdviserIds" multiple required size={Math.min(6, Math.max(2, choices.length))}>
                {choices.map(row => <option key={row.id} value={row.id}>{row.name} ({row.email})</option>)}
            </select><p className="form-help">Select up to twenty Advisers. On a desktop, use Ctrl or Command to select more than one. Each assignment covers only this submission version.</p></> : <>
                <p>Cancel the open assignment for <strong>{dialog.name}</strong>?</p><p className="form-help">The Co-Adviser will no longer be able to submit a recommendation or request a new PDF link. A previously issued link may work until it expires.</p>
            </>}
            {requiresReload && <button type="button" onClick={() => void reload()}>Reload assignments before retrying</button>}
        </ResearchDialog>}
    </section>;
}
