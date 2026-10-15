import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { feedbacks, submissions, researchPapers, researchGroups, users } from "@/db/schema";

/** Exact-version feedback, with current group ownership enforced in the read itself. */
export async function readOwnedSubmissionFeedback(submissionId: number, adviserId: number) {
    return db.select({ id: feedbacks.id, submissionId: feedbacks.submissionId, comments: feedbacks.comments,
        decision: feedbacks.decision, createdAt: feedbacks.createdAt, firstName: users.firstName, lastName: users.lastName })
        .from(feedbacks)
        .innerJoin(submissions, eq(feedbacks.submissionId, submissions.id))
        .innerJoin(researchPapers, eq(submissions.paperId, researchPapers.id))
        .innerJoin(researchGroups, eq(researchPapers.groupId, researchGroups.id))
        .leftJoin(users, eq(feedbacks.teacherId, users.id))
        .where(and(eq(submissions.id, submissionId), eq(researchGroups.adviserId, adviserId)))
        .orderBy(desc(feedbacks.createdAt), desc(feedbacks.id));
}
