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
import AdviserResearchAssistant from "./adviser-research-assistant";
import CoAdviserEvaluation, { CoAssessmentDetails, useCoEvaluation } from "./co-adviser-evaluation";
import { EvaluationConfirmation } from "./evaluation-workspace";
import { assessEvaluation } from "@/lib/submission-evaluation";
import type { z } from "zod";

export default function CoAdviserReview({ initial, email }: { initial: CoAssignment; email: string }) {
    return <ReviewDraftBoundary key={initial.id} draftLabel="recommendation"><CoReviewContent initial={initial} email={email} /></ReviewDraftBoundary>;
}

function CoReviewContent({ initial, email }: { initial: CoAssignment; email: string }) {
    const [assignment,setAssignment] = useState<CoAssignment | null>(initial);
    const [text,setText] = useState("");
    const [confirming,setConfirming] = useState(false);
    const [message,setMessage] = useState("");
    const [uncertain,setUncertain] = useState(false);
    const [loading,setLoading] = useState(false);
    const [includeRatings,setIncludeRatings] = useState(false);
    const confirmed = useRef<z.infer<typeof recommendationSchema> | null>(null);
    const pending = useRef(false), draft = useReviewDraft(), input = useId();
    const available = !!assignment?.reviewAvailable;
    const evaluation = useCoEvaluation(initial.id, initial.submissionId, available && !uncertain);
    useEffect(() => { draft?.setDirty(text !== "" || includeRatings || evaluation.assessments.length > 0); },[text,includeRatings,evaluation.assessments.length,draft]);
    useEffect(() => () => draft?.setDirty(false),[draft]);
    useEffect(() => draft?.registerConfirmationCancel(() => { setConfirming(false); confirmed.current = null; }), [draft]);
    async function reload() {
        if (pending.current || !draft?.confirmLeave()) return;
        setLoading(true);setConfirming(false);
        try {
            const result = await getCoAdviserAssignmentAction({ assignmentId: initial.id,submissionId: initial.submissionId });
            setAssignment(result.success ? result.data?.assignment ?? null : null);setMessage(result.message);
            setText("");setIncludeRatings(false);evaluation.reset();confirmed.current=null;setUncertain(false);
        } catch { setAssignment(null);setMessage("Assignment could not be loaded. Reload to try again."); }
        finally { setLoading(false); }
    }
    return <AdviserResearchAssistant submissionId={initial.submissionId} assignmentId={initial.id} enabled={available && !uncertain}><main className={`dashboard-page research-workspace ${styles.page}`}>
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
                    const parsed = recommendationSchema.safeParse({assignmentId:assignment.id,submissionId:assignment.submissionId,recommendation:text,evaluation:includeRatings ? evaluation.draft : null});
                    if (!parsed.success) {setMessage("Enter 1 to 20,000 plain-text characters without control characters.");return;}
                    if (includeRatings) {
                        if (!evaluation.assignment?.snapshot || evaluation.busy || evaluation.error) {setMessage("Reload the assigned criteria before including ratings, or submit narrative only.");return;}
                        try { assessEvaluation(evaluation.assignment,evaluation.draft); }
                        catch (error) {setMessage(error instanceof Error ? error.message : "Complete the included criterion ratings.");return;}
                    }
                    confirmed.current=parsed.data;
                    setConfirming(true);
                }}>
                    <p>Only the Main Adviser receives your recommendation. Submitting completes this assignment; it cannot be edited afterward.</p>
                    <label htmlFor={input}>Plain-text recommendation</label>
                    <textarea id={input} rows={14} maxLength={20000} required value={text} disabled={uncertain || loading || confirming} onChange={event=>setText(event.target.value)} />
                    <p className="form-help">{text.length.toLocaleString()} / 20,000 characters. This does not publish Student feedback.</p>
                    <p className="form-help">Your draft is not automatically saved. Browser Back and programmatic navigation may discard it.</p>
                    {(text || evaluation.assessments.length > 0) && <p className={styles.draftIndicator}>Unsaved changes</p>}
                    <CoAdviserEvaluation state={evaluation} include={includeRatings} onInclude={setIncludeRatings} disabled={uncertain || loading || confirming} hidden={confirming} />
                    <button type="submit" disabled={uncertain || loading || confirming}>Review recommendation</button>
                    {uncertain && <p role="alert">The outcome could not be confirmed. Copy your draft, then reload the assignment before retrying.</p>}
                </form> : <>
                    <p>This assignment is {assignment.state}. Recommendations are read-only and new PDF access is closed.</p>
                    {assignment.recommendation && <section aria-label="Your recorded recommendation"><h3>Your recorded recommendation</h3><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{assignment.recommendation}</p></section>}
                    {assignment.assessment && <CoAssessmentDetails value={assignment.assessment} />}
                </>}
                <button type="button" className={styles.reloadAssignment} disabled={loading || confirming} onClick={()=>void reload()}>Reload assignment</button>
            </div>
        </ReviewWorkspace>
        {confirming && assignment && <ResearchDialog title="Submit private recommendation" submitLabel="Submit recommendation" showCancel onClose={()=>setConfirming(false)}
            action={async()=>{
                if (pending.current || !confirmed.current) return {success:false,message:"Review the recommendation before submitting."};
                const payload=confirmed.current;
                const current=recommendationSchema.safeParse({assignmentId:assignment.id,submissionId:assignment.submissionId,recommendation:text,evaluation:includeRatings ? evaluation.draft : null});
                if (!current.success || JSON.stringify(payload) !== JSON.stringify(current.data)) {
                    setConfirming(false);confirmed.current=null;return {success:false,message:"The draft changed. Review it again before submitting."};
                }
                pending.current=true;draft?.setPending(true);
                try {
                    const result=await submitCoAdviserRecommendationAction(payload);
                    if (!result.success) {setUncertain(true);setConfirming(false);return result;}
                    setAssignment({...assignment,state:"completed",reviewAvailable:false,recommendation:payload.recommendation,assessment:result.data?.assessment??null});setText("");setIncludeRatings(false);evaluation.setAssessments([]);confirmed.current=null;setMessage(result.message);return result;
                } catch {setUncertain(true);setConfirming(false);return {success:false,message:"The outcome is unknown. Reload the assignment before retrying."};}
                finally {pending.current=false;draft?.setPending(false);}
            }} onSuccess={()=>setConfirming(false)}>
            <p>{initial.title} · {initial.version}</p><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{text}</p>
            {includeRatings && evaluation.assignment && <EvaluationConfirmation assignment={evaluation.assignment} draft={evaluation.draft} privateRecommendation />}
            <p className="form-help">Submit this private recommendation? It cannot be changed after submission.</p>
        </ResearchDialog>}
    </main></AdviserResearchAssistant>;
}
