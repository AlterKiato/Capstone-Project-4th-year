"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startSubmissionReviewAction } from "@/lib/actions/adviser-review.action";

export default function StartReviewButton({ submissionId }: { submissionId: number }) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState("");

    async function handleStartReview() {
        setIsLoading(true);
        setMessage("");
        try {
            const result = await startSubmissionReviewAction(submissionId);
            if (!result.success) {
                setMessage(result.message);
                return;
            }
            router.refresh();
        } catch {
            setMessage("The submission review could not be started.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div aria-busy={isLoading}>
            <button type="button" onClick={handleStartReview} disabled={isLoading} aria-describedby="start-review-message">
                {isLoading ? "Starting Review..." : "Start Review"}
            </button>
            <p id="start-review-message" className={message ? "form-message" : undefined} aria-live="polite" aria-atomic="true">{message}</p>
        </div>
    );
}
