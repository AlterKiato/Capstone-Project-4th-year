"use client";

import { useId, useState } from "react";
import { getSubmissionDownloadUrlAction } from "@/lib/actions/storage.action";

export default function DownloadSubmissionButton({ submissionId }: { submissionId: number }) {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState("");
    const messageId = useId();
    async function handleDownload() {
        setIsLoading(true);
        setMessage("");
        try {
            const url = await getSubmissionDownloadUrlAction(submissionId);
            if (!url) {
                setMessage("The research document could not be accessed.");
                return;
            }
            window.location.assign(url);
        } catch {
            setMessage("The research document could not be accessed.");
        } finally {
            setIsLoading(false);
        }
    }
    return (
        <div aria-busy={isLoading}>
            <button type="button" onClick={handleDownload} disabled={isLoading} aria-describedby={messageId}>
                {isLoading ? "Opening PDF..." : "View / Download PDF"}
            </button>
            <p id={messageId} className={message ? "form-message" : undefined} aria-live="polite" aria-atomic="true">{message}</p>
        </div>
    );
}
