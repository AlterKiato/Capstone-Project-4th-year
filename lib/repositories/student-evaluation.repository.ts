import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { feedbacks, groupMembers, researchGroups, researchPapers, submissions, users,
    submissionEvaluationAssignments as assignments, submissionEvaluations as evaluations,
    submissionEvaluationItems as items } from "@/db/schema";
import { ROLE_IDS } from "@/lib/auth/roles";
import type { StudentEvaluationRequest } from "@/lib/student-evaluation";

/** One SELECT binds the actor, active project membership and original submission to official feedback.
 * No current templates, latest working generation or private Co-Adviser data participate. */
export async function readStudentEvaluation(studentId: number, request: StudentEvaluationRequest) {
    return db.select({ submissionId: submissions.id, version: submissions.version, feedbackId: feedbacks.id,
        evaluationId: evaluations.id, finalizedAt: evaluations.finalizedAt, earned: evaluations.earned,
        possible: evaluations.possible, snapshot: assignments.snapshot, revision: assignments.revision,
        criterionKey: items.criterionKey, rating: items.rating, na: items.na, reason: items.reason, comment: items.comment,
    }).from(submissions)
        .innerJoin(users, and(eq(users.id, studentId), eq(users.isActive, true), eq(users.roleId, ROLE_IDS.STUDENT)))
        .innerJoin(researchPapers, eq(researchPapers.id, submissions.paperId))
        .innerJoin(researchGroups, and(eq(researchGroups.id, researchPapers.groupId), eq(researchGroups.status, "active")))
        .innerJoin(groupMembers, and(eq(groupMembers.groupId, researchGroups.id), eq(groupMembers.userId, studentId)))
        .innerJoin(feedbacks, and(eq(feedbacks.submissionId, submissions.id), eq(feedbacks.id, request.feedbackId),
            eq(feedbacks.decision, submissions.status)))
        .leftJoin(evaluations, eq(evaluations.feedbackId, feedbacks.id))
        .leftJoin(assignments, and(eq(assignments.id, evaluations.assignmentId), eq(assignments.submissionId, submissions.id)))
        .leftJoin(items, eq(items.evaluationId, evaluations.id))
        .where(and(eq(submissions.id, request.submissionId), eq(submissions.paperId, request.paperId),
            eq(submissions.version, request.version), eq(submissions.submittedBy, studentId),
            inArray(submissions.status, ["Approved", "Revision Required"])))
        .orderBy(asc(items.criterionKey));
}
