"use client";

import {
    useState,
} from "react";

import {
    getSubmissionDownloadUrlAction,
} from "@/lib/actions/storage.action";

/**
 * Generates a temporary signed URL
 * and opens the research document.
 */
export default function DownloadSubmissionButton({
    submissionId,
}: {
    submissionId: number;
}) {
    const [
        isLoading,
        setIsLoading,
    ] = useState(false);

    async function handleDownload() {
        setIsLoading(true);

        try {
            const url =
                await getSubmissionDownloadUrlAction(
                    submissionId
                );

            if (!url) {
                alert(
                    "The research document could not be accessed."
                );

                return;
            }

            window.open(
                url,
                "_blank",
                "noopener,noreferrer"
            );
        } catch {
            alert(
                "The research document could not be accessed."
            );
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <button
            type="button"
            onClick={handleDownload}
            disabled={isLoading}
        >
            {isLoading
                ? "Opening..."
                : "View / Download"}
        </button>
    );
}