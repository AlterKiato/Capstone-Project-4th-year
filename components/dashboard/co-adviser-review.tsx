"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import DashboardHeader from "./dashboard-header";
import ResearchDialog from "./research-dialog";
import AuthorizedPdfPreview from "@/app/dashboard/adviser/submissions/AuthorizedPdfPreview";
import ReviewWorkspace from "@/app/dashboard/adviser/submissions/ReviewWorkspace";
import ReviewDraftBoundary, { useReviewDraft } from "@/app/dashboard/adviser/submissions/ReviewDraftBoundary";
import { getCoAdviserAssignmentAction, submitCoAdviserRecommendationAction } from "@/lib/actions/co-adviser.action";
import { recommendationSchema } from "@/lib/validations/co-adviser";
import type { CoAssignment } from "@/types/co-adviser";
import styles from "@/app/dashboard/adviser/submissions/review-workspace.module.css";

export default function CoAdviserReview({ initial, email }: { initial: CoAssignment; email: string }) {
    return <ReviewDraftBoundary draftLabel="recommendation"><CoReviewContent initial={initial} email={email} /></ReviewDraftBoundary>;
}

function CoReviewContent({ initial, email }: { initial: CoAssignment; email: string }) {
    const [assignment,setAssignment] = useState<CoAssignment | null>(initial);
    const [text,setText] = useState("");
    const [confirming,setConfirming] = useState(false);
    const [message,setMessage] = useState("");
    const [uncertain,setUncertain] = useState(false);
    const [loading,setLoading] = useState(false);
    const pending = useRef(false), draft = useReviewDraft(), input = useId();
    useEffect(() => { draft?.setDirty(text !== ""); },[text,draft]);
    useEffect(() => () => draft?.setDirty(false),[draft]);
    const available = !!assignment?.reviewAvailable;
    async function reload() {
        if (pending.current || !draft?.confirmLeave()) return;
        setLoading(true);setConfirming(false);
        try {
            const result = await getCoAdviserAssignmentAction({ assignmentId: initial.id,submissionId: initial.submissionId });
            setAssignment(result.success ? result.data?.assignment ?? null : null);setMessage(result.message);
            setText("");setUncertain(false);
        } catch { setAssignment(null);setMessage("Assignment could not be loaded. Reload to try again."); }
        finally { setLoading(false); }
    }
    return <main className={`dashboard-page research-workspace ${styles.page}`}>
        <p><Link href="/dashboard/adviser/submissions" className="research-back context-back">← Back to Assignments</Link></p>
        <DashboardHeader title={initial.title} email={email} />
        <p className="dashboard-context">Group {initial.groupId} · {initial.version} · Private Co-Adviser review</p>
        <p className="form-help">Assigned <time dateTime={initial.createdAt}>{new Date(initial.createdAt).toLocaleDateString("en-PH",{timeZone:"Asia/Manila"})}</time></p>
        <ReviewWorkspace version={initial.version} reviewTitle="Private recommendation" document={available ? <AuthorizedPdfPreview key={assignment.id} submissionId={assignment.submissionId} version={assignment.version} assignmentId={assignment.id} /> : <p className="form-help">New PDF access is closed or unavailable for this assignment.</p>}>
            <div className={styles.reviewStatus}><p className="form-help">Assignment status</p><span>{assignment?.state ?? "Unavailable"}</span></div>
            <div className={styles.reviewBody}>
                <p role="status">{loading ? "Loading assignment..." : message}</p>
                {!assignment ? <p role="alert">Current assignment authority could not be verified.</p> : available ? <form className={`dashboard-form ${styles.reviewForm}`} onSubmit={event => {
                    event.preventDefault();if (pending.current || uncertain) return;
                    if (!recommendationSchema.safeParse({assignmentId:assignment.id,submissionId:assignment.submissionId,recommendation:text}).success) {setMessage("Enter 1 to 20,000 plain-text characters without control characters.");return;}
                    setConfirming(true);
                }}>
                    <p>Only the Main Adviser receives your recommendation. Submitting completes this assignment; it cannot be edited afterward.</p>
                    <label htmlFor={input}>Plain-text recommendation</label>
                    <textarea id={input} rows={14} maxLength={20000} required value={text} disabled={uncertain || loading || confirming} onChange={event=>setText(event.target.value)} />
                    <p className="form-help">{text.length.toLocaleString()} / 20,000 characters. This does not publish Student feedback.</p>
                    <p className="form-help">Your draft is not automatically saved. Browser Back and programmatic navigation may discard it.</p>
                    {text && <p className={styles.draftIndicator}>Unsaved changes</p>}
                    <button type="submit" disabled={uncertain || loading || confirming}>Review recommendation</button>
                    {uncertain && <p role="alert">The outcome could not be confirmed. Copy your draft, then reload the assignment before retrying.</p>}
                </form> : <>
                    <p>This assignment is {assignment.state}. Recommendations are read-only and new PDF access is closed.</p>
                    {assignment.recommendation && <section aria-label="Your recorded recommendation"><h3>Your recorded recommendation</h3><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{assignment.recommendation}</p></section>}
                </>}
                <button type="button" className={styles.reloadAssignment} disabled={loading || confirming} onClick={()=>void reload()}>Reload assignment</button>
            </div>
        </ReviewWorkspace>
        {confirming && assignment && <ResearchDialog title="Submit private recommendation" submitLabel="Submit recommendation" showCancel onClose={()=>setConfirming(false)}
            action={async()=>{
                if (pending.current) return {success:false,message:"Recommendation is being submitted."};
                pending.current=true;draft?.setPending(true);
                try {
                    const result=await submitCoAdviserRecommendationAction({assignmentId:assignment.id,submissionId:assignment.submissionId,recommendation:text});
                    if (!result.success) {setUncertain(true);setConfirming(false);return result;}
                    setAssignment({...assignment,state:"completed",reviewAvailable:false,recommendation:text.trim()});setText("");setMessage(result.message);return result;
                } catch {setUncertain(true);setConfirming(false);return {success:false,message:"The outcome is unknown. Reload the assignment before retrying."};}
                finally {pending.current=false;draft?.setPending(false);}
            }} onSuccess={()=>setConfirming(false)}>
            <p>{initial.title} · {initial.version}</p><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{text}</p>
            <p className="form-help">Submit this private recommendation? It cannot be changed after submission.</p>
        </ResearchDialog>}
    </main>;
}
