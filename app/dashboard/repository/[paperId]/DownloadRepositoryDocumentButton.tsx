"use client";

import { useState } from "react";

import { getRepositoryDocumentUrlAction } from "@/lib/actions/repository.action";

export default function DownloadRepositoryDocumentButton({
    paperId,
}: {
    paperId: number;
}) {
    const [loading, setLoading] = useState<"view" | "download" | null>(null);
    const [error, setError] = useState("");

    async function accessDocument(mode: "view" | "download") {
        setLoading(mode);
        setError("");

        // Open synchronously so popup blockers allow the signed PDF to load in a new tab.
        const viewWindow = mode === "view" ? window.open("about:blank", "_blank") : null;
        if (viewWindow) viewWindow.opener = null;

        try {
            const result = await getRepositoryDocumentUrlAction(paperId, mode);
            if (!result.success || !result.url) {
                viewWindow?.close();
                setError(result.message ?? "The document could not be opened.");
                return;
            }

            if (mode === "view") {
                if (viewWindow) {
                    viewWindow.location.replace(result.url);
                } else {
                    window.location.assign(result.url);
                }
            } else {
                window.location.assign(result.url);
            }
        } catch {
            viewWindow?.close();
            setError("Your session may have expired, or the document service is unavailable. Sign in again and retry.");
        } finally {
            setLoading(null);
        }
    }

    return (
        <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <button type="button" onClick={() => accessDocument("view")} disabled={loading !== null}>
                    {loading === "view" ? "Opening PDF…" : "View PDF"}
                </button>
                <button type="button" onClick={() => accessDocument("download")} disabled={loading !== null}>
                    {loading === "download" ? "Preparing download…" : "Download PDF"}
                </button>
            </div>
            <p>Document links expire after five minutes. Request a new link if one expires.</p>
            {error && <p role="alert">{error}</p>}
        </div>
    );
}
