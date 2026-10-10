import { sql, type SQL } from "drizzle-orm";
import { SUBMISSION_STATUS } from "@/lib/constants/submission-status";
import {
    desc,
    eq,
    inArray,
} from "drizzle-orm";

import { db } from "@/lib/db";

import {
    submissions,
    researchPapers,
    researchGroups,
    users,
} from "@/db/schema";

/**
 * Retrieves all submissions belonging
 * to research papers from the specified
 * research groups.
 *
 * The group IDs must already be verified
 * to belong to the authenticated Adviser.
 */
export async function findSubmissionsByGroupIds(
    groupIds: number[]
) {
    if (groupIds.length === 0) {
        return [];
    }

    return db
        .select({
            id: submissions.id,

            paperId:
                submissions.paperId,

            groupId:
                researchPapers.groupId,

            groupName:
                researchGroups.groupName,

            researchTitle:
                researchPapers.title,

            submittedBy:
                submissions.submittedBy,

            studentFirstName:
                users.firstName,

            studentLastName:
                users.lastName,

            version:
                submissions.version,

            fileUrl:
                submissions.fileUrl,

            remarks:
                submissions.remarks,

            status:
                submissions.status,

            submittedAt:
                submissions.submittedAt,
        })
        .from(submissions)
        .innerJoin(
            researchPapers,
            eq(
                submissions.paperId,
                researchPapers.id
            )
        )
        .innerJoin(
            researchGroups,
            eq(
                researchPapers.groupId,
                researchGroups.id
            )
        )
        .innerJoin(
            users,
            eq(
                submissions.submittedBy,
                users.id
            )
        )
        .where(
            inArray(
                researchPapers.groupId,
                groupIds
            )
        )
        .orderBy(
            desc(
                submissions.submittedAt
            )
        );
}

/**
 * Retrieves a single submission belonging
 * to one of the Adviser's research groups.
 */
export async function findSubmissionForAdviser(
    submissionId: number,
    groupIds: number[]
) {
    if (groupIds.length === 0) {
        return undefined;
    }

    const [submission] =
        await db
            .select({
                id: submissions.id,

                paperId:
                    submissions.paperId,

                groupId:
                    researchPapers.groupId,

                groupName:
                    researchGroups.groupName,

                researchTitle:
                    researchPapers.title,

                submittedBy:
                    submissions.submittedBy,

                studentFirstName:
                    users.firstName,

                studentLastName:
                    users.lastName,

                version:
                    submissions.version,

                fileUrl:
                    submissions.fileUrl,

                remarks:
                    submissions.remarks,

                status:
                    submissions.status,

                submittedAt:
                    submissions.submittedAt,
            })
            .from(submissions)
            .innerJoin(
                researchPapers,
                eq(
                    submissions.paperId,
                    researchPapers.id
                )
            )
            .innerJoin(
                researchGroups,
                eq(
                    researchPapers.groupId,
                    researchGroups.id
                )
            )
            .innerJoin(
                users,
                eq(
                    submissions.submittedBy,
                    users.id
                )
            )
            .where(
                eq(
                    submissions.id,
                    submissionId
                )
            );

    if (!submission) {
        return undefined;
    }

    if (
        !groupIds.includes(
            submission.groupId
        )
    ) {
        return undefined;
    }

    return submission;
}


// Counts only, scoped in SQL to the verified Adviser's current ownership.
// All historical versions and archived owned groups match the existing list semantics.
export async function getAdviserAIWorkflowAggregate(adviserId: number) {
    if (!Number.isSafeInteger(adviserId) || adviserId <= 0) throw new Error("Invalid account");
    const cohort = (predicate: SQL = sql`true`) => ({
        versions: sql<number>`count(*) filter (where ${predicate})`.mapWith(Number),
        contributors: sql<number>`count(distinct ${submissions.submittedBy}) filter (where ${predicate})`.mapWith(Number),
        papers: sql<number>`count(distinct ${submissions.paperId}) filter (where ${predicate})`.mapWith(Number),
    });
    const submitted = eq(submissions.status, SUBMISSION_STATUS.SUBMITTED);
    const review = eq(submissions.status, SUBMISSION_STATUS.UNDER_REVIEW);
    const [aggregate] = await db.select({
        total: cohort(), submitted: cohort(submitted), review: cohort(review),
        notSubmitted: cohort(sql`not (${submitted})`),
        notReview: cohort(sql`not (${review})`),
        neither: cohort(sql`not (${submitted}) and not (${review})`),
    }).from(submissions)
        .innerJoin(researchPapers, eq(submissions.paperId, researchPapers.id))
        .innerJoin(researchGroups, eq(researchPapers.groupId, researchGroups.id))
        .innerJoin(users, eq(submissions.submittedBy, users.id))
        .where(eq(researchGroups.adviserId, adviserId));
    return aggregate;
}
