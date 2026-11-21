import { z } from "zod";
import { defaultReportPeriod, reportPeriodSchema, resolveReportPeriod, REPORT_TIMEZONE } from "./admin-report";
import type { SnapshotSection } from "./snapshot-report";

export const ACTIVITY_UNAVAILABLE = "Activity reporting is unavailable until an owner-approved reporting start is configured. Current snapshot reports remain available.";
export const ACTIVITY_COVERAGE_LIMITATION = "Limited Preview coverage: totals rely on eligible writers storing UTC timestamps. Older writers or backdated records can make counts inaccurate or incomplete. Historical accuracy and completeness are not guaranteed.";
export const activityTotalsSchema = z.strictObject({
    submissions: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    approved: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    revisionRequired: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export type ActivityTotals = z.infer<typeof activityTotalsSchema>;
export const activityPeriodSchema = reportPeriodSchema.refine(period => period.kind !== "weekly", "Choose a month or year.");
export const activityRequestSchema = z.strictObject({
    reportType: z.literal("period-activity"), period: activityPeriodSchema,
    format: z.enum(["preview", "xlsx", "pdf"]), expectedTotals: activityTotalsSchema.optional(),
});
export type ActivityRequest = z.infer<typeof activityRequestSchema>;
export type ActivityRole = "admin" | "main";
const reportingStartUtcSchema = z.iso.datetime({ precision: 3 }).refine(value => {
    const instant = Date.parse(value);
    return Number.isFinite(instant) && new Date(instant).toISOString() === value;
}, "Use a canonical UTC timestamp with exactly three fractional-second digits.");
export const activityActivationSchema = z.discriminatedUnion("status", [
    z.strictObject({ status: z.literal("unconfigured") }),
    z.strictObject({ status: z.literal("configured"), reportingStartUtc: reportingStartUtcSchema }),
]);
export type ActivityActivation = z.infer<typeof activityActivationSchema>;
export type ActivityAvailability = "configured" | "unconfigured" | "invalid";
export function activityAvailability(input: unknown): ActivityAvailability {
    const parsed = activityActivationSchema.safeParse(input);
    return !parsed.success ? "invalid" : parsed.data.status === "configured" ? "configured" : "unconfigured";
}
export type ActivityPeriod = ReturnType<typeof resolveReportPeriod>;
export type ActivityWindow = {
    period: ActivityPeriod; reportingStartUtc: string; effectiveStartInclusive: string;
    status: "full" | "partial";
};
export function resolveActivityWindow(period: ActivityPeriod, activation: unknown):
    { ok: true; window: ActivityWindow } | { ok: false; status: "unconfigured" | "invalid" | "before-start"; message: string } {
    const parsed = activityActivationSchema.safeParse(activation);
    if (!parsed.success) return { ok: false, status: "invalid", message: "Period activity activation is invalid. Snapshot reports remain available." };
    if (parsed.data.status === "unconfigured") return { ok: false, status: "unconfigured", message: ACTIVITY_UNAVAILABLE };
    const reportingStartUtc = parsed.data.reportingStartUtc;
    const reportingStart = Date.parse(reportingStartUtc), start = Date.parse(period.startInclusive), end = Date.parse(period.endExclusive);
    if (end <= reportingStart) return { ok: false, status: "before-start", message: "This period is entirely before the reporting start. Activity totals and downloads are unavailable." };
    return { ok: true, window: { period, reportingStartUtc, status: reportingStart > start ? "partial" : "full",
        effectiveStartInclusive: new Date(Math.max(start, reportingStart)).toISOString() } };
}
export function defaultActivityPeriods(now = new Date()) {
    return { monthly: defaultReportPeriod("monthly", now), yearly: defaultReportPeriod("yearly", now) };
}
export const coverageLabel = (status: ActivityWindow["status"]) => status === "partial" ? "PARTIAL COVERAGE" : "WITHIN REPORTING WINDOW";
export type PeriodActivityReport = {
    reportType: "period-activity"; title: string; generatedAt: string; scope: string; timezone: typeof REPORT_TIMEZONE;
    period: ActivityPeriod; coverage: Pick<ActivityWindow, "status" | "reportingStartUtc" | "effectiveStartInclusive">;
    totals: ActivityTotals; notes: string[];
    sections: (Omit<SnapshotSection<"activity">, "semantics"> & { semantics: "activity" })[];
};
export function buildActivityReport(role: ActivityRole, window: ActivityWindow, values: ActivityTotals, generatedAt: Date): PeriodActivityReport {
    const totals = activityTotalsSchema.parse(values);
    return { reportType: "period-activity", title: "ThesiSHS AI Period Activity", generatedAt: generatedAt.toISOString(),
        scope: role === "admin" ? "Admin: institution-wide event activity" : "Designated Main Adviser: institutional research event activity, including archived groups",
        timezone: REPORT_TIMEZONE, period: window.period,
        coverage: { status: window.status, reportingStartUtc: window.reportingStartUtc, effectiveStartInclusive: window.effectiveStartInclusive }, totals,
        notes: ["Events are included when their stored timestamp, interpreted as UTC, falls within the selected period and on or after the reporting start.",
            ACTIVITY_COVERAGE_LIMITATION,
            "Coverage describes reporting-window eligibility, not independent completeness or period completion. Totals reflect records available at generation time.",
            ...(window.status === "partial" ? ["PARTIAL COVERAGE: activity before the reporting start within this period is excluded."] : [])],
        sections: [{ id: "activity", label: "Activity totals", semantics: "activity", note: "Each successful submission version and official decision record counts once. Co-Adviser recommendations and review-start transitions are excluded.", rows: [
            { id: "submissions", label: "Submission versions", value: totals.submissions },
            { id: "approved", label: "Approved decisions", value: totals.approved },
            { id: "revision-required", label: "Revision Required decisions", value: totals.revisionRequired },
        ] }] };
}
