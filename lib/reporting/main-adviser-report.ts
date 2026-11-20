import { z } from "zod";
import { RESEARCH_STATUS } from "@/lib/constants/research-status";
import { SUBMISSION_STATUS } from "@/lib/constants/submission-status";
import { ACTIVITY_LIMITATION, REPORT_TIMEZONE } from "./admin-report";
import type { GroupReportRow, SnapshotReport, SnapshotRow, SnapshotSection } from "./snapshot-report";

export const MAIN_REPORT_SECTIONS = [
    { id: "groups", label: "Supervised Groups" },
    { id: "papers", label: "Supervised Papers" },
    { id: "submissions", label: "Submission Workload" },
    { id: "revisions", label: "Revision Workload" },
    { id: "group-summary", label: "Group Summary" },
] as const;
export const mainReportRequestSchema = z.strictObject({
    reportType: z.literal("current-supervision-summary"), selection: z.enum(["all", "custom"]),
    sections: z.array(z.enum(["groups", "papers", "submissions", "revisions", "group-summary"])).max(5),
    format: z.enum(["preview", "xlsx", "pdf"]),
}).superRefine((value, context) => {
    if (new Set(value.sections).size !== value.sections.length || (value.selection === "custom" && !value.sections.length)) {
        context.addIssue({ code: "custom", path: ["sections"], message: "Select one or more distinct supported sections." });
    }
});
export type MainReportRequest = z.infer<typeof mainReportRequestSchema>;
export type MainReportSectionId = MainReportRequest["sections"][number];
const knownSubmissionStatuses: readonly string[] = Object.values(SUBMISSION_STATUS);
export type MainAdviserReport = SnapshotReport<"current-supervision-summary", MainReportSectionId>;
type StatusCount = { status: string; count: number };
export type MainReportSnapshot = {
    groups?: StatusCount[]; papers?: StatusCount[]; submissions?: StatusCount[];
    groupRows?: { id: number; status: string; projects: number; pending: number; revisionRequired: number }[];
};
export function selectedMainReportSections(request: MainReportRequest): MainReportSectionId[] {
    return MAIN_REPORT_SECTIONS.filter(section => request.selection === "all" || request.sections.includes(section.id)).map(section => section.id);
}
function row(id: string, label: string, value: number): SnapshotRow {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid report count");
    return { id, label, value };
}
function statusRows(counts: StatusCount[] | undefined, statuses: readonly string[], totalLabel: string) {
    if (!counts) throw new Error("Missing report data");
    counts.forEach(item => row("validation", "", item.count));
    return [row("total", totalLabel, counts.reduce((sum, item) => sum + item.count, 0)),
        ...statuses.map((status, index) => row(`status-${index}`, status, counts.find(item => item.status === status)?.count ?? 0)),
        row("other", "Other statuses", counts.filter(item => !statuses.includes(item.status)).reduce((sum, item) => sum + item.count, 0))];
}
export function buildMainAdviserReport(request: MainReportRequest, snapshot: MainReportSnapshot, generatedAt: Date): MainAdviserReport {
    const versionCount = (statuses: string[]) => {
        if (!snapshot.submissions) throw new Error("Missing submission counts");
        return snapshot.submissions.filter(item => statuses.includes(item.status)).reduce((sum, item) => sum + row("validation", "", item.count).value, 0);
    };
    const sections = selectedMainReportSections(request).map(id => {
        const section: SnapshotSection<MainReportSectionId> = {
            id, label: MAIN_REPORT_SECTIONS.find(item => item.id === id)!.label, semantics: "snapshot", rows: [], note: "",
        };
        switch (id) {
            case "groups": {
                const counts = statusRows(snapshot.groups, ["active", "archived"], "Total supervised groups");
                counts[1].label = "Active groups"; counts[2].label = "Archived groups";
                section.rows = counts;
                section.note = "Institutional Main supervision includes all groups, including archived groups. Historical group adviser attribution does not limit this scope.";
                break;
            }
            case "papers":
                section.rows = statusRows(snapshot.papers, Object.values(RESEARCH_STATUS), "Total supervised research papers");
                section.note = "Current paper statuses across all supervised groups. These are projects, not submission versions.";
                break;
            case "submissions":
                section.rows = [row("total", "Total submission versions", versionCount(snapshot.submissions?.map(item => item.status) ?? [])),
                    row("pending", "Pending submission versions", versionCount([SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW])),
                    row("reviewed", "Reviewed submission versions", versionCount([SUBMISSION_STATUS.REVISION_REQUIRED, SUBMISSION_STATUS.APPROVED])),
                    row("other", "Other submission statuses", versionCount((snapshot.submissions ?? []).filter(item => !knownSubmissionStatuses.includes(item.status)).map(item => item.status)))];
                section.note = "All versions: pending means Submitted or Under Review; reviewed means Approved or Revision Required. Reviewed versions are not actions personally performed by the current Main Adviser.";
                break;
            case "revisions":
                section.rows = [row("revision-required", "Revision Required submission versions", versionCount([SUBMISSION_STATUS.REVISION_REQUIRED]))];
                section.note = "Version-level current status, including older versions. This overlaps reviewed workload and is not an additional total, a paper count, or a count of unresolved revision items.";
                break;
            case "group-summary":
                if (!snapshot.groupRows) throw new Error("Missing group summary");
                section.groupRows = snapshot.groupRows.map(group => {
                    if (!Number.isSafeInteger(group.id) || group.id <= 0) throw new Error("Invalid group identifier");
                    const result: GroupReportRow = { id: `group-${group.id}`, label: `Group ${group.id}`,
                        status: group.status === "active" ? "Active" : group.status === "archived" ? "Archived" : "Other",
                        projects: row("projects", "", group.projects).value, pending: row("pending", "", group.pending).value,
                        revisionRequired: row("revision-required", "", group.revisionRequired).value };
                    return result;
                });
                section.note = "Complete group list, identified by group ID. Projects count papers; pending and revision columns count submission versions. Includes archived groups and groups with no projects.";
        }
        return section;
    });
    return { title: "ThesiSHS AI Current Research Supervision Summary", reportType: "current-supervision-summary",
        generatedAt: generatedAt.toISOString(), timezone: REPORT_TIMEZONE,
        scope: "Current Main Research Adviser: institutional supervision of all research groups, including archived groups",
        notes: [ACTIVITY_LIMITATION, "No personal review attribution, grades, academic performance or review-duration statistics are inferred."], sections };
}
