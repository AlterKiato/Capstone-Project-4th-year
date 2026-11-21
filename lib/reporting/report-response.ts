import "server-only";
import { renderReportPdf, renderReportXlsx, reportFileName } from "./admin-report-export";
import type { SnapshotReport } from "./snapshot-report";
import type { PeriodActivityReport } from "./period-activity";

type ReportResult = { ok: false; status: number; message: string; coverageStatus?: "unconfigured" | "invalid" | "before-cutover" } |
    { ok: true; actor: number; format: "preview" | "xlsx" | "pdf"; report: SnapshotReport | PeriodActivityReport };
const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Vary": "Cookie" };
function failure(message: string, status: number, coverageStatus?: string) {
    return Response.json({ message, ...(coverageStatus ? { coverageStatus } : {}) }, { status, headers: privateHeaders });
}

/** Shared bounded request and private download delivery; role authority stays in each service. */
export async function reportResponse(request: Request, handlers: {
    authorize: () => Promise<number | null>; getReport: (input: unknown) => Promise<ReportResult>;
    deniedMessage: string; unavailableMessage: string;
}) {
    try {
        const actor = await handlers.authorize();
        if (!actor) return failure(handlers.deniedMessage, 403);
        if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return failure("Send a valid report selection.", 400);
        const reader = request.body?.getReader();
        if (!reader) return failure("Send a valid report selection.", 400);
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
            while (true) {
                const chunk = await reader.read();
                if (chunk.done) break;
                size += chunk.value.byteLength;
                if (size > 4096) { await reader.cancel(); return failure("Report selection is too large.", 413); }
                chunks.push(chunk.value);
            }
        } finally { reader.releaseLock(); }
        let input: unknown;
        try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
        catch { return failure("Send a valid report selection.", 400); }
        const result = await handlers.getReport(input);
        if (!result.ok) return failure(result.message, result.status, result.coverageStatus);
        if (result.actor !== actor) return failure(handlers.deniedMessage, 403);
        const bytes = result.format === "preview" ? null : result.format === "xlsx" ? await renderReportXlsx(result.report) : await renderReportPdf(result.report);
        if (await handlers.authorize() !== actor) return failure(handlers.deniedMessage, 403);
        if (result.format === "preview") return Response.json(result.report, { headers: privateHeaders });
        return new Response(new Uint8Array(bytes!), { headers: {
            ...privateHeaders,
            "Content-Type": result.format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
            "Content-Disposition": `attachment; filename="${reportFileName(result.report, result.format)}"`,
        } });
    } catch { return failure(handlers.unavailableMessage, 503); }
}
