"use client";

import {
    useState,
} from "react";

import {
    createAdviserFeedbackAction,
} from "@/lib/actions/adviser-feedback.action";

/**
 * Allows an Adviser to submit feedback
 * and a review decision for a submission.
 */
export default function FeedbackForm({
    submissionId,
}: {
    submissionId: number;
}) {
    const [
        isSubmitting,
        setIsSubmitting,
    ] = useState(false);

    const [
        comments,
        setComments,
    ] = useState("");

    const [
        decision,
        setDecision,
    ] = useState(
        "Revision Required"
    );

    async function handleSubmit(
        event: React.FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        setIsSubmitting(true);

        try {
            const formData =
                new FormData();

            formData.set(
                "submissionId",
                String(
                    submissionId
                )
            );

            formData.set(
                "comments",
                comments
            );

            formData.set(
                "decision",
                decision
            );

            const result =
                await createAdviserFeedbackAction(
                    formData
                );

            if (!result.success) {
                alert(
                    result.message
                );

                return;
            }

            alert(
                result.message
            );

            window.location.reload();
        } catch (error) {
            console.error(
                "Failed to submit Adviser feedback:",
                error
            );

            alert(
                "The feedback could not be submitted."
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <form
            onSubmit={
                handleSubmit
            }
            style={{
                marginTop: "30px",
            }}
        >
            <h2>
                Adviser Feedback
            </h2>

            <div
                style={{
                    marginBottom:
                        "20px",
                }}
            >
                <label
                    htmlFor="comments"
                >
                    Feedback Comments
                </label>

                <textarea
                    id="comments"
                    value={comments}
                    onChange={(event) =>
                        setComments(
                            event.target
                                .value
                        )
                    }
                    rows={8}
                    maxLength={5000}
                    required
                    style={{
                        display:
                            "block",
                        width:
                            "100%",
                        marginTop:
                            "8px",
                    }}
                />
            </div>

            <div
                style={{
                    marginBottom:
                        "20px",
                }}
            >
                <label
                    htmlFor="decision"
                >
                    Decision
                </label>

                <select
                    id="decision"
                    value={decision}
                    onChange={(event) =>
                        setDecision(
                            event.target
                                .value
                        )
                    }
                    style={{
                        display:
                            "block",
                        marginTop:
                            "8px",
                    }}
                >
                    <option value="Revision Required">
                        Revision Required
                    </option>

                    <option value="Approved">
                        Approved
                    </option>
                </select>
            </div>

            <button
                type="submit"
                disabled={
                    isSubmitting
                }
            >
                {isSubmitting
                    ? "Submitting..."
                    : "Submit Feedback"}
            </button>
        </form>
    );
}