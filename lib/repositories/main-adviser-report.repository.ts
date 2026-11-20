import "server-only";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { mainAdviserDesignation, researchGroups, researchPapers, submissions } from "@/db/schema";
import { currentMainAdviserPredicate } from "./research-supervision.repository";
import { SUBMISSION_STATUS } from "@/lib/constants/submission-status";
import type { MainReportSectionId, MainReportSnapshot } from "@/lib/reporting/main-adviser-report";

export async function readMainAdviserReportSnapshot(actorId: number, sections: MainReportSectionId[]): Promise<MainReportSnapshot | null> {
    return db.transaction(async tx => {
        const scope = currentMainAdviserPredicate(actorId);
        const [authorized] = await tx.select({ id: mainAdviserDesignation.id }).from(mainAdviserDesignation)
            .where(and(eq(mainAdviserDesignation.id, 1), scope));
        if (!authorized) return null;
        const snapshot: MainReportSnapshot = {};
        if (sections.includes("groups")) snapshot.groups = await tx.select({ status: researchGroups.status, count: count() })
            .from(researchGroups).where(scope).groupBy(researchGroups.status);
        if (sections.includes("papers")) snapshot.papers = await tx.select({ status: researchPapers.status, count: count() })
            .from(researchPapers).innerJoin(researchGroups, eq(researchPapers.groupId, researchGroups.id))
            .where(scope).groupBy(researchPapers.status);
        if (sections.includes("submissions") || sections.includes("revisions")) snapshot.submissions = await tx.select({ status: submissions.status, count: count() })
            .from(submissions).innerJoin(researchPapers, eq(submissions.paperId, researchPapers.id))
            .innerJoin(researchGroups, eq(researchPapers.groupId, researchGroups.id)).where(scope).groupBy(submissions.status);
        if (sections.includes("group-summary")) snapshot.groupRows = await tx.select({
            id: researchGroups.id, status: researchGroups.status,
            // Independent subqueries avoid project/member/version join multiplication.
            projects: sql<number>`(select count(*) from ${researchPapers} where ${researchPapers.groupId} = ${researchGroups.id})`.mapWith(Number),
            pending: sql<number>`(select count(*) from ${submissions} inner join ${researchPapers} on ${submissions.paperId} = ${researchPapers.id}
                where ${researchPapers.groupId} = ${researchGroups.id} and ${inArray(submissions.status, [SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW])})`.mapWith(Number),
            revisionRequired: sql<number>`(select count(*) from ${submissions} inner join ${researchPapers} on ${submissions.paperId} = ${researchPapers.id}
                where ${researchPapers.groupId} = ${researchGroups.id} and ${eq(submissions.status, SUBMISSION_STATUS.REVISION_REQUIRED)})`.mapWith(Number),
        }).from(researchGroups).where(scope).orderBy(asc(researchGroups.id));
        return snapshot;
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
