"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { getSubmissionDownloadUrlAction } from "@/lib/actions/storage.action";
import { SubmissionPdfAccess } from "@/lib/utils/submission-pdf-access";
import styles from "./review-workspace.module.css";

function closePlaceholder(tab: Window | null) {
    try { if (tab && !tab.closed && tab.location.href === "about:blank") tab.close(); }
    catch { /* Never touch a tab the user has navigated elsewhere. */ }
}

function PdfActionIcon({ separate = false }: { separate?: boolean }) {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d={separate ? "M14 3h7v7 M21 3 10 14 M10 3H4v17h17v-6" : "M6 3h8l4 4v14H6Z M14 3v5h4 M9 12h6 M9 16h6"} />
    </svg>;
}

function PdfFrame({ url, title }: { url: string; title: string }) {
    const [event, setEvent] = useState("waiting");
    useEffect(() => {
        const timer = window.setTimeout(() => setEvent(current => current === "waiting" ? "slow" : current), 15_000);
        return () => window.clearTimeout(timer);
    }, []);
    return <>
        <iframe className={styles.frame} src={url} title={title} referrerPolicy="no-referrer"
            onLoad={() => setEvent("loaded")} onError={() => setEvent("error")} />
        <p className="form-help" role="status">{event === "error" ? "The preview could not load. Open the PDF separately." :
            event === "slow" ? "The viewer is taking longer to load. Open the PDF separately if needed." :
                event === "loaded" ? "If the PDF is not visible above, open it separately." : "Loading the PDF viewer..."}</p>
    </>;
}

export default function AuthorizedPdfPreview({ submissionId, version }: { submissionId: number; version: string }) {
    const access = useMemo(() => new SubmissionPdfAccess(submissionId,
        id => getSubmissionDownloadUrlAction(id, "adviser-review")), [submissionId]);
    const state = useSyncExternalStore(access.subscribe, access.snapshot, access.snapshot);
    const [previewFor, setPreviewFor] = useState<number | null>(null);
    const [popupError, setPopupError] = useState("");
    const pendingTab = useRef<Window | null>(null);
    useEffect(() => {
        access.activate();
        const foreground = () => { if (document.visibilityState !== "hidden") access.reassess(); };
        window.addEventListener("focus", foreground);
        window.addEventListener("pageshow", foreground);
        document.addEventListener("visibilitychange", foreground);
        return () => {
            window.removeEventListener("focus", foreground);
            window.removeEventListener("pageshow", foreground);
            document.removeEventListener("visibilitychange", foreground);
            access.dispose();
            closePlaceholder(pendingTab.current);
            pendingTab.current = null;
        };
    }, [access]);

    async function preview() {
        setPopupError("");
        setPreviewFor(submissionId);
        await access.request();
    }

    async function openSeparately() {
        setPopupError("");
        let tab: Window | null = null;
        let navigated = false;
        try {
            // Open during the click, before signing, to avoid delayed-popup blocking.
            tab = window.open("about:blank", "_blank");
            if (!tab) { setPopupError("The new tab was blocked. Allow this site's PDF window, or preview the PDF first and try again."); return; }
            closePlaceholder(pendingTab.current);
            pendingTab.current = tab;
            tab.opener = null;
            const policy = tab.document.createElement("meta");
            policy.name = "referrer"; policy.content = "no-referrer";
            tab.document.head.append(policy);
            tab.document.title = "Opening research PDF";
            tab.document.body.textContent = "Preparing authorized PDF access...";
            const url = access.validUrl() ?? await access.request();
            if (tab.closed || tab.location.href !== "about:blank") return;
            if (url && pendingTab.current === tab && access.validUrl() === url) {
                tab.location.replace(url);
                navigated = true;
            } else if (pendingTab.current === tab) {
                setPopupError("PDF access could not be opened. Try again or use Preview PDF.");
            }
        } catch {
            if (pendingTab.current === tab) setPopupError("PDF access could not be opened. Try again or use Preview PDF.");
        } finally {
            if (!navigated) closePlaceholder(tab);
            if (pendingTab.current === tab) pendingTab.current = null;
        }
    }

    const pending = state.phase === "requesting";
    return <div className={styles.pdfPreview} aria-busy={pending}>
        <div className={styles.pdfActions} role="group" aria-label="PDF access">
            <button type="button" disabled={pending} onClick={preview}><PdfActionIcon />{pending ? "Requesting PDF..." : state.phase === "expired" ? "Renew PDF Access" : "Preview PDF"}</button>
            <button type="button" disabled={pending} onClick={openSeparately}><PdfActionIcon separate />Open PDF Separately</button>
        <p className="form-help" role="status">{pending ? "Requesting authorized PDF access..." : state.phase === "expired" ? "The local PDF access window has ended. Renew access to continue viewing." :
            state.phase === "unavailable" ? "PDF access is unavailable. Try again or open the PDF separately." : state.phase === "idle" ? "Choose preview or separate view." : "Temporary PDF access is ready."}</p>
        </div>
        <div className={styles.pdfReading}>
        {popupError && <p role="alert" className="form-message">{popupError}</p>}
        {previewFor === submissionId && state.url && <PdfFrame key={state.deadline} url={state.url} title={`Research submission ${submissionId}, ${version} PDF`} />}
        </div>
    </div>;
}
