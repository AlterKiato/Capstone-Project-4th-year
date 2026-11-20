import "server-only";
import { db } from "@/lib/db";
import { countUsers, countResearchGroups, countResearchPapers, groupUsersByRole, groupPapersByStatus } from "./dashboard.repository";
import { countPublishedResearch } from "./repository.repository";
import type { AdminReportSnapshot, ReportSectionId } from "@/lib/reporting/admin-report";

export async function readAdminReportSnapshot(sections: ReportSectionId[]): Promise<AdminReportSnapshot> {
    return db.transaction(async tx => {
        const snapshot: AdminReportSnapshot = {};
        if (sections.includes("users")) {
            snapshot.users = await countUsers(tx);
            snapshot.roles = await groupUsersByRole(tx);
        }
        if (sections.includes("groups")) snapshot.groups = await countResearchGroups(tx);
        if (sections.includes("papers")) {
            snapshot.papers = await countResearchPapers(tx);
            snapshot.statuses = await groupPapersByStatus(tx);
        }
        if (sections.includes("repository")) snapshot.published = await countPublishedResearch(tx);
        return snapshot;
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
