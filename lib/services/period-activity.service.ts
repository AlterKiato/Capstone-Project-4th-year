import "server-only";
import { currentReportAdmin } from "./admin-report.service";
import { currentReportMainAdviser } from "./main-adviser-report.service";
import { ACTIVITY_ACTIVATION } from "@/lib/reporting/activity-coverage";
import { activityRequestSchema, buildActivityReport, resolveActivityWindow, type ActivityRole } from "@/lib/reporting/period-activity";
import { resolveReportPeriod } from "@/lib/reporting/admin-report";
import { readPeriodActivity } from "@/lib/repositories/period-activity.repository";

export async function getPeriodActivityReport(input: unknown, role: ActivityRole) {
    const authorize = role === "main" ? currentReportMainAdviser : currentReportAdmin;
    try {
        const actor = await authorize();
        if (!actor) return { ok: false, status: 403, message: "This role cannot access this activity report." } as const;
        const parsed = activityRequestSchema.safeParse(input);
        if (!parsed.success) return { ok: false, status: 400, message: "Choose a valid week, month or year and report format." } as const;
        let period;
        try { period = resolveReportPeriod(parsed.data.period); }
        catch { return { ok: false, status: 400, message: "Choose a valid ISO week." } as const; }
        const coverage = resolveActivityWindow(period, ACTIVITY_ACTIVATION);
        if (!coverage.ok) return { ok: false, status: coverage.status === "before-cutover" ? 422 : 503, message: coverage.message, coverageStatus: coverage.status } as const;
        if (parsed.data.format !== "preview" && !parsed.data.expectedTotals)
            return { ok: false, status: 400, message: "Update activity tables before downloading." } as const;
        const generatedAt = new Date();
        const totals = await readPeriodActivity({ id: actor, role }, coverage.window);
        if (!totals || await authorize() !== actor) return { ok: false, status: 403, message: "Activity reporting authority changed. Reload the page." } as const;
        const expected = parsed.data.expectedTotals;
        if (parsed.data.format !== "preview" && expected && (expected.submissions !== totals.submissions || expected.approved !== totals.approved || expected.revisionRequired !== totals.revisionRequired))
            return { ok: false, status: 409, message: "Activity changed. Update activity tables before downloading." } as const;
        return { ok: true, actor, format: parsed.data.format, report: buildActivityReport(role, coverage.window, totals, generatedAt) } as const;
    } catch { return { ok: false, status: 503, message: "Period activity reporting is unavailable. Please try again." } as const; }
}
