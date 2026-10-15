import "server-only";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { groupMembers, researchGroups, researchPapers, submissions } from "@/db/schema";
import { SUBMISSION_STATUS } from "@/lib/constants/submission-status";

const pendingStatuses = [SUBMISSION_STATUS.SUBMITTED, SUBMISSION_STATUS.UNDER_REVIEW];
const reviewedStatuses = [SUBMISSION_STATUS.REVISION_REQUIRED, SUBMISSION_STATUS.APPROVED];

// Version-level actions match start-review and feedback. Include historical versions
// and all currently owned groups, as the existing Adviser listing does.
export async function readAdviserDashboard(adviserId: number) {
    const owned = eq(researchGroups.adviserId, adviserId);
    const [groupTotals, versionTotals, attention, groups] = await Promise.all([
        db.select({ total: count() }).from(researchGroups).where(owned),
        db.select({
            pending: sql<number>`count(*) filter (where ${inArray(submissions.status, pendingStatuses)})`.mapWith(Number),
            reviewed: sql<number>`count(*) filter (where ${inArray(submissions.status, reviewedStatuses)})`.mapWith(Number),
        }).from(submissions)
            .innerJoin(researchPapers, eq(submissions.paperId, researchPapers.id))
            .innerJoin(researchGroups, eq(researchPapers.groupId, researchGroups.id)).where(owned),
        db.select({
            id: submissions.id, researchTitle: researchPapers.title, groupName: researchGroups.groupName,
            version: submissions.version, status: submissions.status, submittedAt: submissions.submittedAt,
        }).from(submissions)
            .innerJoin(researchPapers, eq(submissions.paperId, researchPapers.id))
            .innerJoin(researchGroups, eq(researchPapers.groupId, researchGroups.id))
            .where(and(owned, inArray(submissions.status, pendingStatuses)))
            .orderBy(asc(submissions.submittedAt), asc(submissions.id)).limit(5),
        db.select({
            id: researchGroups.id, groupName: researchGroups.groupName,
            strand: researchGroups.strand, section: researchGroups.section,
            // Independent counts prevent member x project join multiplication.
            memberCount: db.$count(groupMembers, eq(groupMembers.groupId, researchGroups.id)),
            projectCount: db.$count(researchPapers, eq(researchPapers.groupId, researchGroups.id)),
        }).from(researchGroups).where(owned)
            .orderBy(desc(researchGroups.createdAt), desc(researchGroups.id)).limit(3),
    ]);
    return { totalGroups: groupTotals[0].total, ...versionTotals[0], attention, groups };
}
