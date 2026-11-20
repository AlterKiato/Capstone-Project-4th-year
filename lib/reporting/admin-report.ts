import { z } from "zod";
import { ROLE_NAMES } from "@/lib/auth/roles";
import { RESEARCH_STATUS } from "@/lib/constants/research-status";

export const REPORT_TIMEZONE = "Asia/Manila";
export const SNAPSHOT_LABEL = "Current snapshot at generation time";
export const ACTIVITY_LIMITATION = "Weekly, monthly and yearly activity reporting is unavailable while historical reporting dates are being verified.";
export const ADMIN_REPORT_SECTIONS = [
    { id: "users", label: "User Statistics" },
    { id: "groups", label: "Research Groups" },
    { id: "papers", label: "Research Papers" },
    { id: "repository", label: "Repository Statistics" },
] as const;
export const sectionIdSchema = z.enum(["users", "groups", "papers", "repository"]);
export type ReportSectionId = z.infer<typeof sectionIdSchema>;

// Retained helpers for deferred activity reporting; the summary request accepts no period.
const year = z.string().regex(/^(19|20|21)\d{2}$/);
export const reportPeriodSchema = z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("weekly"), value: z.string().regex(/^(19|20|21)\d{2}-W\d{2}$/) }),
    z.strictObject({ kind: z.literal("monthly"), value: z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/) }),
    z.strictObject({ kind: z.literal("yearly"), value: year }),
]);
export const adminReportRequestSchema = z.strictObject({
    reportType: z.literal("current-summary"),
    selection: z.enum(["all", "custom"]),
    sections: z.array(sectionIdSchema).max(ADMIN_REPORT_SECTIONS.length),
    format: z.enum(["preview", "xlsx", "pdf"]),
}).superRefine((value, context) => {
    if (new Set(value.sections).size !== value.sections.length ||
        (value.selection === "custom" && value.sections.length === 0)) {
        context.addIssue({ code: "custom", path: ["sections"], message: "Select one or more distinct supported sections." });
    }
});
export type AdminReportRequest = z.infer<typeof adminReportRequestSchema>;
export type ReportPeriod = z.infer<typeof reportPeriodSchema>;

const day = 86_400_000;
const isoDate = (value: number) => new Date(value).toISOString().slice(0, 10);
function weekMonday(year: number) {
    const fourth = Date.UTC(year, 0, 4);
    return fourth - ((new Date(fourth).getUTCDay() + 6) % 7) * day;
}

export function resolveReportPeriod(period: ReportPeriod) {
    const year = Number(period.value.slice(0, 4));
    let start: number, end: number;
    if (period.kind === "weekly") {
        const week = Number(period.value.slice(6));
        start = weekMonday(year) + (week - 1) * 7 * day;
        if (week < 1 || start >= weekMonday(year + 1)) throw new Error("Invalid week");
        end = start + 7 * day;
    } else if (period.kind === "monthly") {
        const month = Number(period.value.slice(5));
        start = Date.UTC(year, month - 1, 1);
        end = Date.UTC(year, month, 1);
    } else {
        start = Date.UTC(year, 0, 1);
        end = Date.UTC(year + 1, 0, 1);
    }
    return {
        ...period, label: `${isoDate(start)} to ${isoDate(end - day)} (${REPORT_TIMEZONE})`,
        // Manila calendar midnight is 16:00 UTC on the preceding day.
        startInclusive: new Date(start - 8 * 3_600_000).toISOString(),
        endExclusive: new Date(end - 8 * 3_600_000).toISOString(),
    };
}

export function defaultReportPeriod(kind: ReportPeriod["kind"] = "monthly", now = new Date()): ReportPeriod {
    const date = new Intl.DateTimeFormat("en-CA", { timeZone: REPORT_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const [year, month, dateOfMonth] = date.split("-").map(Number);
    if (kind === "monthly") return { kind, value: `${year}-${String(month).padStart(2, "0")}` };
    if (kind === "yearly") return { kind, value: String(year) };
    const today = Date.UTC(year, month - 1, dateOfMonth);
    const thursday = today + (3 - (new Date(today).getUTCDay() + 6) % 7) * day;
    const weekYear = new Date(thursday).getUTCFullYear();
    return { kind, value: `${weekYear}-W${String(Math.floor((today - weekMonday(weekYear)) / (7 * day)) + 1).padStart(2, "0")}` };
}

export function selectedReportSections(request: AdminReportRequest): ReportSectionId[] {
    return ADMIN_REPORT_SECTIONS.filter(section => request.selection === "all" || request.sections.includes(section.id)).map(section => section.id);
}

export type ReportRow = { id: string; label: string; value: number };
export type ReportSection = { id: ReportSectionId; label: string; semantics: "snapshot"; note: string; rows: ReportRow[] };
export type AdminReport = {
    title: string; reportType: "current-summary"; generatedAt: string; scope: string; timezone: string;
    notes: string[]; sections: ReportSection[];
};
export type AdminReportSnapshot = {
    users?: number; roles?: { roleId: number; count: number }[];
    groups?: number; papers?: number; statuses?: { status: string; count: number }[]; published?: number;
};
const row = (id: string, label: string, value: number): ReportRow => {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid report count");
    return { id, label, value };
};
export function buildAdminReport(request: AdminReportRequest, snapshot: AdminReportSnapshot, generatedAt: Date): AdminReport {
    const sections = selectedReportSections(request).map(id => {
        let rows: ReportRow[], note: string;
        switch (id) {
            case "users": {
                if (!snapshot.roles) throw new Error("Missing role counts");
                const roles = snapshot.roles;
                rows = [row("total", "Total users", snapshot.users!),
                    ...Object.entries(ROLE_NAMES).map(([roleId, label]) => row(`role-${roleId}`, label, roles.find(role => role.roleId === Number(roleId))?.count ?? 0)),
                    row("other", "Other roles", roles.filter(role => !ROLE_NAMES[role.roleId]).reduce((sum, role) => sum + role.count, 0))];
                note = "Includes active and inactive accounts. Role counts describe current records.";
                break;
            }
            case "groups":
                rows = [row("total", "Total research groups", snapshot.groups!)];
                note = "Includes active and archived groups.";
                break;
            case "papers": {
                if (!snapshot.statuses) throw new Error("Missing status counts");
                const statuses = snapshot.statuses, known: string[] = Object.values(RESEARCH_STATUS);
                rows = [row("total", "Total research papers", snapshot.papers!),
                    ...known.map((status, index) => row(`status-${index}`, status, statuses.find(item => item.status === status)?.count ?? 0)),
                    row("other", "Other statuses", statuses.filter(item => !known.includes(item.status)).reduce((sum, item) => sum + item.count, 0))];
                note = "Current project statuses, not submission versions or historical period-end statuses.";
                break;
            }
            case "repository":
                rows = [row("published", "Eligible published research papers", snapshot.published!)];
                note = "Published Approved papers with at least one Approved submission. This is a current total.";
        }
        return { id, label: ADMIN_REPORT_SECTIONS.find(section => section.id === id)!.label, semantics: "snapshot" as const, note, rows };
    });
    return { title: "ThesiSHS AI Current Research Summary", reportType: "current-summary", generatedAt: generatedAt.toISOString(),
        scope: "Admin: institution-wide aggregate statistics", timezone: REPORT_TIMEZONE,
        notes: [ACTIVITY_LIMITATION], sections };
}

export function reportGenerationLabel(iso: string) {
    return new Intl.DateTimeFormat("en-PH", { timeZone: REPORT_TIMEZONE, year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso));
}
