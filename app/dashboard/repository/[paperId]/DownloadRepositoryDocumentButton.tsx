"use client";

import { useState } from "react";

import { getRepositoryDownloadUrlAction } from "@/lib/actions/repository.action";

export default function DownloadRepositoryDocumentButton({
    paperId,
}: {
    paperId: number;
}) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function downloadDocument() {
        setLoading(true);
        setError("");
        const url = await getRepositoryDownloadUrlAction(paperId);
        if (url) {
            window.location.assign(url);
        } else {
            setError("The document is currently unavailable.");
            setLoading(false);
        }
    }

    return (
        <div>
            <button type="button" onClick={downloadDocument} disabled={loading}>
                {loading ? "Preparing document…" : "Download research PDF"}
            </button>
            {error && <p role="alert">{error}</p>}
        </div>
    );
}
