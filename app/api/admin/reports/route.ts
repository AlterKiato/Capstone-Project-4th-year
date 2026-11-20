import { currentReportAdmin, getAdminReport } from "@/lib/services/admin-report.service";
import { renderReportPdf, renderReportXlsx, reportFileName } from "@/lib/reporting/admin-report-export";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Vary": "Cookie" };
function failure(message: string, status: number) {
    return Response.json({ message }, { status, headers: privateHeaders });
}

export async function POST(request: Request) {
    try {
        if (!await currentReportAdmin()) return failure("Admin reporting access is required.", 403);
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
        const result = await getAdminReport(input);
        if (!result.ok) return failure(result.message, result.status);
        if (result.format === "preview") return Response.json(result.report, { headers: privateHeaders });
        const bytes = result.format === "xlsx" ? await renderReportXlsx(result.report) : await renderReportPdf(result.report);
        // Formatting can take time; revoked or changed accounts must not receive a file.
        if (await currentReportAdmin() !== result.actor) return failure("Admin reporting access is required.", 403);
        return new Response(new Uint8Array(bytes), { headers: {
            ...privateHeaders,
            "Content-Type": result.format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf",
            "Content-Disposition": `attachment; filename="${reportFileName(result.report, result.format)}"`,
        } });
    } catch { return failure("Admin reporting is unavailable. Please try again.", 503); }
}
