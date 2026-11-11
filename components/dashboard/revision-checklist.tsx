"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { readRevisionsAction, respondToRevisionAction } from "@/lib/actions/revision.action";
import { revisionCounts, type RevisionChecklist as Checklist, type RevisionItem } from "@/lib/revisions";
import ContextHelp from "./context-help";
import styles from "./revisions.module.css";

function ResponseEditor({ item, paperId, editable, onSaved }: { item: RevisionItem; paperId: number; editable: boolean; onSaved: (data: Checklist) => void }) {
    const saved = item.responses[0];
    const [value, setValue] = useState(saved?.actionTaken ?? "");
    const [message, setMessage] = useState("");
    const [uncertain, setUncertain] = useState(false);
    const [pending, startTransition] = useTransition();
    const lock = useRef(false);
    return <form className={styles.response} aria-busy={pending} onSubmit={event => {
        event.preventDefault(); if (lock.current || uncertain) return;
        lock.current = true;
        startTransition(async () => {
            try {
                const result = await respondToRevisionAction({ paperId, itemId: item.id, expectedRevision: saved?.revision ?? 0, actionTaken: value });
                setMessage(result.message);
                if (result.success && result.data) onSaved(result.data); else setUncertain(true);
            } catch { setUncertain(true); setMessage("The save could not be confirmed. Reload revisions before retrying."); }
            finally { lock.current = false; }
        });
    }}>
        <label htmlFor={`action-taken-${item.id}`}>Action Taken</label>
        {editable && !saved?.frozenBySubmissionId ? <><textarea id={`action-taken-${item.id}`} value={value} maxLength={2000} rows={3} disabled={pending || uncertain} onChange={event => setValue(event.target.value)} />
            <button disabled={pending || uncertain || value === (saved?.actionTaken ?? "")} type="submit">{pending ? "Saving..." : "Save response"}</button></> : <p className={styles.text}>{saved?.actionTaken || "No action recorded."}</p>}
        <p role="status">{message}</p>
    </form>;
}

export default function RevisionChecklist({ paperId, submissionId }: { paperId: number; submissionId?: number }) {
    // Parent keys isolate project changes. Effect also clears previous scope before an async read.
    const [data, setData] = useState<Checklist | null>(null);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [generation, setGeneration] = useState(0);
    useEffect(() => {
        let active = true;
        readRevisionsAction({ paperId, ...(submissionId === undefined ? {} : { submissionId }) }).then(result => {
            if (!active) return;
            setData(result.success ? result.data ?? null : null); setMessage(result.success ? "" : result.message); setLoading(false);
        }).catch(() => { if (active) { setData(null); setMessage("Revisions could not be loaded. Reload to try again."); setLoading(false); } });
        return () => { active = false; };
    }, [paperId, submissionId, generation]);
    function reload() { setData(null); setLoading(true); setGeneration(value => value + 1); }
    return <section id="revision-checklist" className={styles.checklist} aria-labelledby="revision-checklist-heading" aria-busy={loading}>
        <div className={styles.heading}><h3 id="revision-checklist-heading">Revision Checklist</h3>
            <ContextHelp label="About Action Taken">Each group member records their own response. Addressed means a response was saved; it does not mean Approved. Responses become read-only when the next manuscript version is submitted.</ContextHelp>
            <button type="button" disabled={loading} onClick={reload}>Reload revisions</button></div>
        {loading ? <p role="status">Loading revisions...</p> : message ? <p role="alert">{message}</p> : !data?.cycles.length ? <p>No finalized revision items for this {submissionId ? "version" : "project"}.</p> : data.cycles.map(cycle => {
            const counts = revisionCounts(cycle);
            return <details key={cycle.feedbackId} open={data.cycles[0] === cycle} className={styles.cycle}>
                <summary>{cycle.version} · {cycle.items.length} corrections{!data.canManage && ` · ${counts.addressed} Addressed`}</summary>
                {!cycle.editable && <p className="form-help">Recorded cycle · Read-only</p>}
                <ol className={styles.items}>{cycle.items.map(item => <li key={item.id} className={styles.item}>
                    <p className={styles.text}><strong>{item.position + 1}. {item.correction}</strong></p>
                    {item.reference && <p className="form-help">{item.reference}</p>}
                    {data.canManage ? (item.responses.length ? item.responses.map(response => <div key={response.studentId}>
                        <p className="form-help">{response.studentName} · {response.actionTaken ? "Addressed" : "Pending"}{response.frozenBySubmissionId ? " · Frozen" : ""}</p><p className={styles.text}>{response.actionTaken || "No action recorded."}</p>
                    </div>) : <p className="form-help">No Student responses yet.</p>) : <>
                        <p className="form-help">{item.responses[0]?.actionTaken ? "Addressed" : "Pending"}</p>
                        <ResponseEditor key={item.id} item={item} paperId={paperId} editable={cycle.editable} onSaved={setData} />
                    </>}
                </li>)}</ol>
            </details>;
        })}
    </section>;
}
