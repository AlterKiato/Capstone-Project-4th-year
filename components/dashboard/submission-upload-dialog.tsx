"use client";
import { useEffect, useRef, useState } from "react";
import ResearchDialog from "./research-dialog";
import { initiateSubmissionUploadAction, renewSubmissionUploadAction, getSubmissionUploadStatusAction,
    cancelSubmissionUploadAction, finalizeSubmissionUploadAction } from "@/lib/actions/submission-upload.action";
import { UPLOAD_MAX_BYTES, safeUploadFileName, uploadIdSchema } from "@/lib/uploads/contract";
import type { UploadResult } from "@/lib/uploads/contract";
import { uploadPdfDirect } from "@/lib/uploads/browser-upload";

type Phase = "choose" | "uploading" | "retry" | "ready" | "finalizing" | "unknown";
export default function SubmissionUploadDialog({ project, onSuccess, onClose }: {
    project: { id: number; title: string }; onSuccess: () => void; onClose: () => void;
}) {
    const storageKey = `thesishs.pending-upload.${project.id}`;
    const [intentId, setIntentId] = useState<string | undefined>(() => {
        try { const saved = sessionStorage.getItem(storageKey); return saved && uploadIdSchema.safeParse(saved).success ? saved : undefined; }
        catch { return undefined; }
    });
    const [phase, setPhase] = useState<Phase>(intentId ? "unknown" : "choose"), [percent, setPercent] = useState<number>();
    const [message, setMessage] = useState(intentId ? "An unfinished upload is available. Check its status before continuing." : "");
    const [fileLabel, setFileLabel] = useState("");
    const [hasFile, setHasFile] = useState(false), [canStop, setCanStop] = useState(false), [cancelPending, setCancelPending] = useState(false);
    const file = useRef<File | null>(null), requestKey = useRef<string | null>(null);
    const currentId = useRef<string | undefined>(intentId), transfer = useRef<AbortController | null>(null), cancelling = useRef(false);
    const expected = useRef<{ size?: number; fileName?: string }>({});
    const busy = phase === "uploading" || phase === "finalizing" || cancelPending;
    useEffect(() => () => transfer.current?.abort(), []);
    function remember(result: UploadResult) {
        if (!result.intentId) return;
        currentId.current = result.intentId; setIntentId(result.intentId);
        expected.current = { size: result.size ?? expected.current.size, fileName: result.fileName ?? expected.current.fileName };
        if (result.fileName) setFileLabel(result.fileName);
        try { sessionStorage.setItem(storageKey, result.intentId); } catch { /* Never store capabilities or files. */ }
    }
    function forget() {
        currentId.current = undefined; setIntentId(undefined); requestKey.current = null; file.current = null; expected.current = {}; setHasFile(false); setFileLabel("");
        try { sessionStorage.removeItem(storageKey); } catch { /* Locator only, never an authorization credential. */ }
    }
    function resultState(result: UploadResult) {
        setMessage(result.message);
        if (result.code === "completed") { forget(); return { success: true, message: result.message }; }
        remember(result);
        if (result.code === "closed") { forget(); setPhase("choose"); }
        else if (result.uploaded || result.code === "ready") setPhase("ready");
        else if (result.success) setPhase("retry");
        else setPhase(currentId.current ? "unknown" : "choose");
        return { success: result.success, message: result.message, keepOpen: true };
    }
    async function submit(data: FormData) {
        setMessage(""); cancelling.current = false;
        try {
            if (phase === "unknown" && currentId.current) return resultState(await getSubmissionUploadStatusAction(currentId.current));
            if (phase === "ready" && currentId.current) {
                setPhase("finalizing"); return resultState(await finalizeSubmissionUploadAction(currentId.current));
            }
            const selected = file.current ?? data.get("file");
            if (!(selected instanceof File) || selected.type !== "application/pdf" || selected.size < 1 || selected.size > UPLOAD_MAX_BYTES) {
                return { success: false, message: "Choose a nonempty PDF no larger than 10 MiB.", keepOpen: true };
            }
            if (intentId && (expected.current.size !== undefined && selected.size !== expected.current.size ||
                expected.current.fileName !== undefined && safeUploadFileName(selected.name) !== expected.current.fileName))
                return { success: false, message: "Select the original file, or cancel this upload before choosing a different PDF.", keepOpen: true };
            file.current = selected; setHasFile(true); setPhase("uploading"); setPercent(undefined);
            requestKey.current ??= crypto.randomUUID();
            const result = currentId.current ? await renewSubmissionUploadAction(currentId.current) : await initiateSubmissionUploadAction({
                requestKey: requestKey.current, paperId: project.id, fileName: selected.name, size: selected.size,
                contentType: selected.type, remarks: String(data.get("remarks") ?? ""),
            });
            remember(result);
            if (!result.success || !result.capability) return resultState(result);
            transfer.current = new AbortController();
            setCanStop(true);
            await uploadPdfDirect(selected, result.capability, transfer.current.signal, setPercent);
            setPhase("ready"); setMessage("PDF uploaded. It has not been submitted yet. Select Submit research to continue.");
            return { success: true, keepOpen: true, message: "PDF uploaded. Select Submit research to create the submission." };
        } catch {
            if (!cancelling.current) { setPhase(currentId.current ? "unknown" : "choose"); setMessage("The result could not be confirmed. Check upload status before retrying."); }
            return { success: false, keepOpen: true, message: cancelling.current ? "Transfer stopped." : "The result could not be confirmed. Check upload status before retrying." };
        } finally { transfer.current = null; setCanStop(false); }
    }
    async function cancel() {
        setCancelPending(true);
        try {
        cancelling.current = true; transfer.current?.abort();
        if (!currentId.current) return;
        const result = await cancelSubmissionUploadAction(currentId.current).catch(() => null);
        if (result?.code === "completed") { forget(); onSuccess(); return; }
        if (result?.success) { forget(); setPhase("choose"); setMessage(result.message); }
        else { setPhase("unknown"); setMessage("Cancellation could not be confirmed. Check upload status before continuing."); }
        } finally { setCancelPending(false); }
    }
    const label = phase === "ready" ? "Submit research" : phase === "unknown" ? "Check upload status" : phase === "retry" ? "Retry PDF upload" : "Upload PDF";
    return <ResearchDialog title="Submit Research PDF" submitLabel={label} action={submit} onSuccess={onSuccess} onClose={onClose}
        busy={busy} transferControls={intentId && phase !== "finalizing" ? <>
            <button type="button" onClick={cancel} disabled={cancelPending || phase === "uploading" && !canStop}>Cancel upload</button>
            {phase === "unknown" && <button type="button" disabled={busy} onClick={() => {
                if (window.confirm("Check Submission History first if the previous result was uncertain. Start a new upload?")) {
                    forget(); setPhase("choose"); setMessage("Choose a PDF for the new upload. An unfinished upload will expire separately.");
                }
            }}>Start new upload</button>}
        </> : undefined}>
        <p><strong>Research project:</strong> {project.title}</p>
        <p className="form-help">Submit a revised version only after the latest version is marked Revision Required.</p>
        <div><label htmlFor="direct-research-pdf">Research PDF</label><input id="direct-research-pdf" name="file" type="file" accept="application/pdf,.pdf"
            disabled={!!intentId && (hasFile || phase === "unknown" || phase === "ready")} required={!intentId} aria-describedby="direct-pdf-help" onChange={event => {
                const selected = event.target.files?.[0] ?? null; file.current = selected; setHasFile(!!selected);
                if (!intentId) requestKey.current = null;
                setMessage(selected && (selected.type !== "application/pdf" || selected.size < 1 || selected.size > UPLOAD_MAX_BYTES)
                    ? "Choose a nonempty PDF no larger than 10 MiB." : "");
            }} /><p id="direct-pdf-help" className="form-help">PDF files only. Maximum size: 10 MiB. Upload first, then explicitly submit.</p></div>
        {intentId && fileLabel && <p className="form-help">PDF: {fileLabel}</p>}
        <div><label htmlFor="direct-research-remarks">Remarks (optional)</label><textarea id="direct-research-remarks" name="remarks" maxLength={500} rows={4} disabled={!!intentId} /></div>
        {phase === "uploading" && <p><label htmlFor="direct-upload-progress">{percent === undefined ? canStop ? "Uploading PDF…" : "Preparing PDF upload…" : `Uploading PDF: ${percent}%`}</label><progress id="direct-upload-progress" max={100} value={percent} /></p>}
        <p role="status" aria-live="polite">{phase === "finalizing" ? "Validating and finalizing your PDF. This may take up to a minute." : message}</p>
    </ResearchDialog>;
}
