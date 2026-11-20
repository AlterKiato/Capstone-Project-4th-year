export type SnapshotRow = { id: string; label: string; value: number };
export type GroupReportRow = {
    id: string; label: string; status: string; projects: number; pending: number; revisionRequired: number;
};
export const GROUP_REPORT_COLUMNS = ["Group", "Status", "Projects", "Pending versions", "Revision versions"] as const;
export function groupReportValues(group: GroupReportRow): (string | number)[] {
    return [group.label, group.status, group.projects, group.pending, group.revisionRequired];
}
export type SnapshotSection<Id extends string = string> = {
    id: Id; label: string; semantics: "snapshot"; note: string; rows: SnapshotRow[]; groupRows?: GroupReportRow[];
};
export type SnapshotReport<Type extends string = "current-summary" | "current-supervision-summary", Id extends string = string> = {
    title: string; reportType: Type; generatedAt: string; scope: string; timezone: string;
    notes: string[]; sections: SnapshotSection<Id>[];
};
export function reportTypeLabel(report: Pick<SnapshotReport, "reportType">) {
    return report.reportType === "current-supervision-summary" ? "Current Research Supervision Summary" : "Current Research Summary";
}
