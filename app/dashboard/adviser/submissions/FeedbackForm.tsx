"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAdviserFeedbackAction } from "@/lib/actions/adviser-feedback.action";

export default function FeedbackForm({ submissionId }: { submissionId: number }) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [comments, setComments] = useState("");
    const [decision, setDecision] = useState("Revision Required");
    const [message, setMessage] = useState("");
    const [failed, setFailed] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSubmitting(true);
        setMessage("");
        setFailed(false);
        try {
            const formData = new FormData();
            formData.set("submissionId", String(submissionId));
            formData.set("comments", comments);
            formData.set("decision", decision);
            const result = await createAdviserFeedbackAction(formData);
            setMessage(result.message);
            setFailed(!result.success);
            if (result.success) router.refresh();
        } catch {
            setFailed(true);
            setMessage("The feedback could not be submitted.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="dashboard-form" aria-busy={isSubmitting} aria-describedby="feedback-instructions feedback-message">
            <p id="feedback-instructions">Record feedback for this version. Comments and a decision are required.</p>
            <div>
                <label htmlFor="comments">Feedback Comments</label>
                <textarea id="comments" name="comments" value={comments} onChange={event => setComments(event.target.value)}
                    rows={8} maxLength={5000} required disabled={isSubmitting} aria-describedby="comments-help" />
                <p id="comments-help" className="form-help">Explain the revisions needed or the basis for approval, up to 5,000 characters.</p>
            </div>
            <div>
                <label htmlFor="decision">Review Decision</label>
                <select id="decision" name="decision" value={decision} onChange={event => setDecision(event.target.value)}
                    required disabled={isSubmitting} aria-describedby="decision-help">
                    <option value="Revision Required">Revision Required</option>
                    <option value="Approved">Approved</option>
                </select>
                <p id="decision-help" className="form-help">Revision Required allows a revised submission. Approved records your approval of this version.</p>
            </div>
            <p id="feedback-message" aria-live="polite" aria-atomic="true" className={message ? (failed ? "form-message" : "research-notice") : undefined}>{message}</p>
            <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Submitting Feedback..." : "Submit Feedback & Decision"}</button>
        </form>
    );
}
