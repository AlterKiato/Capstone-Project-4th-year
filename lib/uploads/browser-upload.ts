// Browser-only transport. The File is sent to Storage, never serialized into an application action.
import type { UploadResult } from "./contract";

export function uploadPdfDirect(file: File, capability: NonNullable<UploadResult["capability"]>,
    signal: AbortSignal, progress: (percent: number) => void, makeRequest = () => new XMLHttpRequest()): Promise<void> {
    return new Promise((resolve, reject) => {
        const request = makeRequest();
        const abort = () => request.abort();
        const finish = (error?: Error) => {
            signal.removeEventListener("abort", abort);
            request.onload = request.onerror = request.onabort = request.ontimeout = null;
            request.upload.onprogress = null;
            if (error) reject(error); else resolve();
        };
        request.open("PUT", capability.url);
        request.withCredentials = false; request.timeout = 120000;
        request.setRequestHeader("apikey", capability.publishableKey);
        request.setRequestHeader("Content-Type", "application/pdf");
        request.upload.onprogress = event => { if (event.lengthComputable) progress(Math.min(100, Math.round(event.loaded / event.total * 100))); };
        request.onload = () => finish(request.status >= 200 && request.status < 300 ? undefined : new Error("Transfer not confirmed. Check upload status."));
        request.onerror = request.ontimeout = () => finish(new Error("Transfer not confirmed. Check your connection and upload status."));
        request.onabort = () => finish(new Error("Transfer stopped. An upload already in flight may still reach private staging."));
        if (signal.aborted) { finish(new Error("Transfer cancelled.")); return; }
        signal.addEventListener("abort", abort, { once: true });
        request.send(file);
    });
}
