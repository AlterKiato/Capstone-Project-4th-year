import "server-only";
import { db } from "@/lib/db";
import { countUsers, countResearchGroups, countResearchPapers, groupPapersByStatus } from "@/lib/repositories/dashboard.repository";
import { countPublishedResearch } from "@/lib/repositories/repository.repository";
import { RESEARCH_STATUS } from "@/lib/constants/research-status";

// Reuse Phase 7 count/eligibility queries in one read-only consistent snapshot.
export async function getAdminAIOverviewAggregate() {
    return db.transaction(async tx => {
        const [totalUsers, totalGroups, totalResearchPapers, totalPublishedPapers, statuses] = await Promise.all([
            countUsers(tx), countResearchGroups(tx), countResearchPapers(tx), countPublishedResearch(tx), groupPapersByStatus(tx),
        ]);
        return {
            totalUsers, totalGroups, totalResearchPapers, totalPublishedPapers,
            approvedPapers: statuses.find(row => row.status === RESEARCH_STATUS.APPROVED)?.count ?? 0,
        };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
