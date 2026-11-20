import "server-only";
import { getCurrentMainAdviser } from "@/lib/auth/main-adviser";
import { readMainAdviserReportSnapshot } from "@/lib/repositories/main-adviser-report.repository";
import { buildMainAdviserReport, mainReportRequestSchema, selectedMainReportSections } from "@/lib/reporting/main-adviser-report";

export async function currentReportMainAdviser(expectedUserId?: number) {
    const account = await getCurrentMainAdviser(expectedUserId);
    return account && Number.isSafeInteger(account.userId) && account.userId > 0 ? account.userId : null;
}
export async function getMainAdviserReport(input: unknown) {
    try {
        const actor = await currentReportMainAdviser();
        if (!actor) return { ok: false, status: 403, message: "Current Main Research Adviser access is required." } as const;
        const parsed = mainReportRequestSchema.safeParse(input);
        if (!parsed.success) return { ok: false, status: 400, message: "Choose Current Research Supervision Summary, a supported format and one or more report sections." } as const;
        const generatedAt = new Date();
        const snapshot = await readMainAdviserReportSnapshot(actor, selectedMainReportSections(parsed.data));
        if (!snapshot || await currentReportMainAdviser(actor) !== actor) return { ok: false, status: 403, message: "Current Main Research Adviser access is required." } as const;
        return { ok: true, actor, format: parsed.data.format, report: buildMainAdviserReport(parsed.data, snapshot, generatedAt) } as const;
    } catch {
        return { ok: false, status: 503, message: "Supervision reporting is unavailable. Please try again." } as const;
    }
}
