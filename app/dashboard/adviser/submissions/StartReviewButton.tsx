"use client";

import {
    useState,
} from "react";

import {
    startSubmissionReviewAction,
} from "@/lib/actions/adviser-review.action";

/**
 * Allows an Adviser to move a submitted
 * research document into the review state.
 */
export default function StartReviewButton({
    submissionId,
}: {
    submissionId: number;
}) {
    const [
        isLoading,
        setIsLoading,
    ] = useState(false);

    async function handleStartReview() {
        setIsLoading(true);

        try {
            const result =
                await startSubmissionReviewAction(
                    submissionId
                );

            if (!result.success) {
                alert(
                    result.message
                );

                return;
            }

            window.location.reload();
        } catch (error) {
            console.error(
                "Failed to start submission review:",
                error
            );

            alert(
                "The submission review could not be started."
            );
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <button
            type="button"
            onClick={
                handleStartReview
            }
            disabled={isLoading}
        >
            {isLoading
                ? "Starting Review..."
                : "Start Review"}
        </button>
    );
}