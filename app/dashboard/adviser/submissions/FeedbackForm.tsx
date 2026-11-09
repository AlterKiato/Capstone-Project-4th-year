"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createAdviserFeedbackAction } from "@/lib/actions/adviser-feedback.action";
import { createReviewConfirmation, matchesReviewConfirmation, type ReviewConfirmation } from "@/lib/utils/review-confirmation";
import { useReviewDraft, useReviewDraftStatus } from "./ReviewDraftBoundary";
import styles from "./review-workspace.module.css";
import FeedbackEditor from "./FeedbackEditor";
import FeedbackContent from "@/components/feedback-content";
import { validateFeedback } from "@/lib/utils/feedback-content";
import UnsavedFeedbackToast from "./UnsavedFeedbackToast";
import { useOfficialFeedbackDraft } from "./OfficialFeedbackDraft";
import { appendRecommendation } from "@/lib/utils/recommendation-import";

export default function FeedbackForm({ submissionId }: { submissionId: number }) {
    const router = useRouter();
    const [phase, setPhase] = useState<"editing" | "confirming" | "submitting" | "submitted" | "unknown">("editing");
    const [confirmation, setConfirmation] = useState<ReviewConfirmation | null>(null);
    const [comments, setComments] = useState("");
    const [decision, setDecision] = useState("Revision Required");
    const [message, setMessage] = useState("");
    const [failed, setFailed] = useState(false);
    const [editorError, setEditorError] = useState("");
    const draft = useReviewDraft();
    const draftStatus = useReviewDraftStatus();
    const submitting = useRef(false);
    const active = useRef(false);
    const generation = useRef(0);
    const confirmed = useRef<ReviewConfirmation | null>(null);
    const submitButton = useRef<HTMLButtonElement>(null);
    const backButton = useRef<HTMLButtonElement>(null);
    const sendingStatus = useRef<HTMLParagraphElement>(null);
    const focusSubmit = useRef(false);
    const isSubmitting = phase === "submitting";
    const locked = isSubmitting || phase === "submitted" || phase === "unknown";
    const dirty = comments !== "" || decision !== "Revision Required";
    const { register } = useOfficialFeedbackDraft();
    const imported = useRef(new Set<number>());

    useEffect(() => {
        register(phase === "editing" && !editorError ? source => {
            if (source.submissionId !== submissionId) return { success: false, message: "This recommendation belongs to another submission. Your draft has not changed." };
            if (imported.current.has(source.assignmentId)) return { success: false, message: "This recommendation has already been added to this draft." };
            const result = appendRecommendation(comments, source);
            if (!result.success) return result;
            imported.current.add(source.assignmentId);
            setComments(result.value);draft?.setDirty(true);
            return { success: true, message: "Recommendation appended to your editable draft. No feedback has been saved." };
        } : null);
        return () => register(null);
    },[register,phase,editorError,submissionId,comments,draft]);

    useEffect(() => {
        draft?.setDirty(dirty);
    }, [draft, dirty]);

    useEffect(() => {
        active.current = true;
        const invalidate = () => { generation.current++; };
        const unregister = draft?.registerConfirmationCancel(() => {
            if (!confirmed.current) return;
            invalidate();
            confirmed.current = null; setConfirmation(null);
            setPhase("editing"); setMessage("Confirmation closed. Your feedback has not been submitted.");
        });
        return () => {
            if (confirmed.current) { setPhase("editing"); setMessage("Confirmation closed. Your feedback has not been submitted."); }
            else if (submitting.current) { setPhase("unknown"); setMessage("The previous request may have been sent. Reload this submission to check its status."); }
            active.current = false; invalidate();
            confirmed.current = null; setConfirmation(null);
            submitting.current = false;
            unregister?.(); draft?.setDirty(false); draft?.setPending(false);
        };
    }, [draft, submissionId]);

    useEffect(() => {
        if (phase === "confirming") backButton.current?.focus();
        if (phase === "submitting") sendingStatus.current?.focus();
        if (phase === "editing" && focusSubmit.current) { focusSubmit.current = false; submitButton.current?.focus(); }
    }, [phase]);

    function closeConfirmation(focus = true) {
        if (!confirmed.current) return;
        generation.current++;
        confirmed.current = null; setConfirmation(null);
        setPhase("editing"); setMessage("Confirmation closed. Your feedback has not been submitted.");
        focusSubmit.current = focus;
    }

    function changeDraft(nextComments: string, nextDecision: string) {
        closeConfirmation(false);
        setComments(nextComments);
        setDecision(nextDecision);
        draft?.setDirty(nextComments !== "" || nextDecision !== "Revision Required");
    }

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (phase !== "editing" || submitting.current || confirmed.current || !event.currentTarget.reportValidity()) return;
        const validation = editorError || validateFeedback(comments);
        if (validation) { setFailed(true); setMessage(validation); return; }
        const payload = createReviewConfirmation({ submissionId, comments, decision });
        generation.current++;
        confirmed.current = payload;
        setConfirmation(payload); setPhase("confirming");
        setMessage("");
        setFailed(false);
    }

    function confirmAndSubmit() {
        const payload = confirmed.current;
        if (!active.current || phase !== "confirming" || submitting.current || !payload) return;
        if (!matchesReviewConfirmation(payload, { submissionId, comments, decision })) { closeConfirmation(); return; }
        submitting.current = true;
        confirmed.current = null; setConfirmation(null);
        const attempt = ++generation.current;
        void send(payload, attempt);
    }

    async function send(payload: ReviewConfirmation, attempt: number) {
        draft?.setPending(true);
        setPhase("submitting");
        const current = () => active.current && attempt === generation.current;
        try {
            const formData = new FormData();
            formData.set("submissionId", String(payload.submissionId));
            formData.set("comments", payload.comments);
            formData.set("decision", payload.decision);
            const result = await createAdviserFeedbackAction(formData);
            if (!current()) return;
            setMessage(result.message);
            setFailed(!result.success);
            if (result.success) {
                setPhase("submitted"); changeDraft("", "Revision Required");
                try { router.refresh(); } catch { setMessage("Feedback was saved. Reload this submission to view the recorded decision."); }
            }
            else { focusSubmit.current = true; setPhase("editing"); }
        } catch {
            if (!current()) return;
            focusSubmit.current = true; setPhase("editing");
            setFailed(true);
            setMessage("The feedback could not be submitted.");
        } finally {
            if (current()) { submitting.current = false; draft?.setPending(false); }
        }
    }

    return (
        <form onSubmit={handleSubmit} className={`dashboard-form ${styles.reviewForm}`} aria-busy={isSubmitting} aria-describedby="feedback-instructions feedback-message">
            <p id="feedback-instructions">Record feedback for this version. Comments and a decision are required.</p>
            <p className={styles.draftIndicator} hidden={!draftStatus.dirty} aria-describedby="feedback-draft-guard-help">Unsaved changes</p>
            <span id="feedback-draft-guard-help" className={styles.srOnly}>Page links, logout and the version selector ask before discarding feedback. Browser Back and other programmatic navigation may discard this draft. Feedback is not automatically saved.</span>
            <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">{draftStatus.dirty ? "Unsaved feedback. Leaving this review may discard your changes." : ""}</span>
            {draftStatus.dirty && <UnsavedFeedbackToast key={draftStatus.session} />}
            <FeedbackEditor value={comments} onChange={value => changeDraft(value, decision)} disabled={locked} onError={message => { setEditorError(message); if (message) closeConfirmation(false); }} />
            <div className={styles.reviewDecision}>
                <label htmlFor="decision">Review Decision</label>
                <select id="decision" name="decision" value={decision} onChange={event => changeDraft(comments, event.target.value)}
                    required disabled={locked} aria-describedby="decision-help">
                    <option value="Revision Required">Revision Required</option>
                    <option value="Approved">Approved</option>
                </select>
                <p id="decision-help" className="form-help">Revision Required allows a revised submission. Approved records your approval of this version.</p>
            </div>
            {phase === "confirming" && confirmation && <section className={styles.confirmation} aria-labelledby="review-confirmation-heading">
                <h3 id="review-confirmation-heading">Confirm decision: {confirmation.decision}</h3>
                <p role="status">Submission {confirmation.submissionId}. Review your feedback before submitting.</p>
                <h4>Feedback to submit</h4>
                <FeedbackContent value={confirmation.comments} />
                <div className={styles.confirmationActions}>
                    <button ref={backButton} type="button" className={styles.neutral} onClick={() => closeConfirmation()}>Back to Edit</button>
                    <button type="button" onClick={confirmAndSubmit}>Confirm &amp; Submit</button>
                </div>
            </section>}
            {isSubmitting && <p ref={sendingStatus} tabIndex={-1} role="status">Submitting feedback. The request has been sent and can no longer be canceled.</p>}
            <p id="feedback-message" aria-live="polite" aria-atomic="true" className={message ? (failed ? "form-message" : "research-notice") : undefined}>{message}</p>
            {phase !== "confirming" && <button ref={submitButton} type="submit" disabled={phase !== "editing"}>{isSubmitting ? "Submitting Feedback..." : phase === "submitted" ? "Feedback submitted" : phase === "unknown" ? "Review outcome unknown" : "Review & Confirm Decision"}</button>}
        </form>
    );
}
