import { z } from "zod";
import { defaultReportPeriod, reportPeriodSchema, resolveReportPeriod, REPORT_TIMEZONE } from "./admin-report";
import type { SnapshotSection } from "./snapshot-report";

export const ACTIVITY_UNAVAILABLE = "Period activity reporting awaits verified activation. Current snapshot reports remain available.";
export const activityTotalsSchema = z.strictObject({
    submissions: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    approved: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    revisionRequired: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export type ActivityTotals = z.infer<typeof activityTotalsSchema>;
export const activityRequestSchema = z.strictObject({
    reportType: z.literal("period-activity"), period: reportPeriodSchema,
    format: z.enum(["preview", "xlsx", "pdf"]), expectedTotals: activityTotalsSchema.optional(),
});
export type ActivityRequest = z.infer<typeof activityRequestSchema>;
export type ActivityRole = "admin" | "main";
const legacyId = z.number().int().min(0).max(2_147_483_647);
const cutoverUtcSchema = z.iso.datetime({ precision: 3 }).refine(value => {
    const instant = Date.parse(value);
    return Number.isFinite(instant) && new Date(instant).toISOString() === value;
}, "Use a canonical UTC timestamp with exactly three fractional-second digits.");
export const activityActivationSchema = z.discriminatedUnion("status", [
    z.strictObject({ status: z.literal("unconfigured") }),
    z.strictObject({ status: z.literal("verified"), cutoverUtc: cutoverUtcSchema,
        legacySubmissionMaxId: legacyId, legacyFeedbackMaxId: legacyId }),
]);
export type ActivityActivation = z.infer<typeof activityActivationSchema>;
export type ActivityAvailability = "configured" | "unconfigured" | "invalid";
export function activityAvailability(input: unknown): ActivityAvailability {
    const parsed = activityActivationSchema.safeParse(input);
    return !parsed.success ? "invalid" : parsed.data.status === "verified" ? "configured" : "unconfigured";
}
export type ActivityPeriod = ReturnType<typeof resolveReportPeriod>;
export type ActivityWindow = {
    period: ActivityPeriod; cutoverUtc: string; effectiveStartInclusive: string;
    status: "full" | "partial"; legacySubmissionMaxId: number; legacyFeedbackMaxId: number;
};
export function resolveActivityWindow(period: ActivityPeriod, activation: unknown):
    { ok: true; window: ActivityWindow } | { ok: false; status: "unconfigured" | "invalid" | "before-cutover"; message: string } {
    const parsed = activityActivationSchema.safeParse(activation);
    if (!parsed.success) return { ok: false, status: "invalid", message: "Period activity activation is invalid. Snapshot reports remain available." };
    if (parsed.data.status === "unconfigured") return { ok: false, status: "unconfigured", message: ACTIVITY_UNAVAILABLE };
    const policy = parsed.data, cutoverUtc = policy.cutoverUtc;
    const cutover = Date.parse(cutoverUtc), start = Date.parse(period.startInclusive), end = Date.parse(period.endExclusive);
    if (end <= cutover) return { ok: false, status: "before-cutover", message: "This period is entirely before the verified cutover. Activity totals and downloads are unavailable." };
    return { ok: true, window: { period, cutoverUtc, status: cutover > start ? "partial" : "full",
        effectiveStartInclusive: new Date(Math.max(start, cutover)).toISOString(),
        legacySubmissionMaxId: policy.legacySubmissionMaxId, legacyFeedbackMaxId: policy.legacyFeedbackMaxId } };
}
export function defaultActivityPeriods(now = new Date()) {
    return { weekly: defaultReportPeriod("weekly", now), monthly: defaultReportPeriod("monthly", now), yearly: defaultReportPeriod("yearly", now) };
}
export const coverageLabel = (status: ActivityWindow["status"]) => status === "partial" ? "PARTIAL COVERAGE" : "FULL COVERAGE";
export type PeriodActivityReport = {
    reportType: "period-activity"; title: string; generatedAt: string; scope: string; timezone: typeof REPORT_TIMEZONE;
    period: ActivityPeriod; coverage: Pick<ActivityWindow, "status" | "cutoverUtc" | "effectiveStartInclusive">;
    totals: ActivityTotals; notes: string[];
    sections: (Omit<SnapshotSection<"activity">, "semantics"> & { semantics: "activity" })[];
};
export function buildActivityReport(role: ActivityRole, window: ActivityWindow, values: ActivityTotals, generatedAt: Date): PeriodActivityReport {
    const totals = activityTotalsSchema.parse(values);
    return { reportType: "period-activity", title: "ThesiSHS AI Period Activity", generatedAt: generatedAt.toISOString(),
        scope: role === "admin" ? "Admin: institution-wide event activity" : "Designated Main Adviser: institutional research event activity, including archived groups",
        timezone: REPORT_TIMEZONE, period: window.period,
        coverage: { status: window.status, cutoverUtc: window.cutoverUtc, effectiveStartInclusive: window.effectiveStartInclusive }, totals,
        notes: ["Only verified post-cutover submission versions and official decisions are included; ambiguous historical records are excluded.",
            "Coverage describes timestamp eligibility, not period completion. Totals reflect records available at generation time.",
            ...(window.status === "partial" ? ["PARTIAL COVERAGE: activity before the cutover within this period is excluded."] : [])],
        sections: [{ id: "activity", label: "Activity totals", semantics: "activity", note: "Each successful submission version and official decision record counts once. Co-Adviser recommendations and review-start transitions are excluded.", rows: [
            { id: "submissions", label: "Submission versions", value: totals.submissions },
            { id: "approved", label: "Approved decisions", value: totals.approved },
            { id: "revision-required", label: "Revision Required decisions", value: totals.revisionRequired },
        ] }] };
}
