import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { feedbacks, groupMembers, researchGroups, researchPapers, submissions, users } from "@/db/schema";

/** Read-only batches. The service supplies the authenticated Student, never a client actor ID. */
export function createStudentWorkspaceRepository(database: Pick<typeof db, "select">) {
    const activeGroups = (studentId: number) => database.select({ id: groupMembers.groupId })
        .from(groupMembers).innerJoin(researchGroups, eq(groupMembers.groupId, researchGroups.id))
        .where(and(eq(groupMembers.userId, studentId), eq(researchGroups.status, "active")));
    return {
        groups(studentId: number) {
            return database.select({ id: researchGroups.id, groupName: researchGroups.groupName,
                strand: researchGroups.strand, section: researchGroups.section, schoolYear: researchGroups.schoolYear,
            }).from(researchGroups).where(inArray(researchGroups.id, activeGroups(studentId)));
        },
        async members(studentId: number, groupIds: number[]) {
            if (!groupIds.length) return [];
            return database.select({ id: groupMembers.id, groupId: groupMembers.groupId,
                firstName: users.firstName, lastName: users.lastName,
            }).from(groupMembers).leftJoin(users, eq(groupMembers.userId, users.id))
                .where(and(inArray(groupMembers.groupId, groupIds), inArray(groupMembers.groupId, activeGroups(studentId))));
        },
        async projects(studentId: number, groupIds: number[]) {
            if (!groupIds.length) return [];
            return database.select({ id: researchPapers.id, groupId: researchPapers.groupId,
                title: researchPapers.title, abstract: researchPapers.abstract, category: researchPapers.category,
                keywords: researchPapers.keywords, status: researchPapers.status,
                createdAt: researchPapers.createdAt, updatedAt: researchPapers.updatedAt,
            }).from(researchPapers)
                .where(and(inArray(researchPapers.groupId, groupIds), inArray(researchPapers.groupId, activeGroups(studentId))))
                .orderBy(desc(researchPapers.createdAt), desc(researchPapers.id));
        },
        async submissions(studentId: number, paperIds: number[]) {
            if (!paperIds.length) return [];
            return database.select({ id: submissions.id, paperId: submissions.paperId, submittedBy: submissions.submittedBy,
                version: submissions.version, status: submissions.status, remarks: submissions.remarks, submittedAt: submissions.submittedAt,
            }).from(submissions).innerJoin(researchPapers, eq(submissions.paperId, researchPapers.id))
                .where(and(inArray(submissions.paperId, paperIds), inArray(researchPapers.groupId, activeGroups(studentId))))
                .orderBy(desc(submissions.submittedAt), desc(submissions.id));
        },
        async feedback(studentId: number, submissionIds: number[]) {
            if (!submissionIds.length) return [];
            // A row without feedback still confirms that the own submission exists.
            // Missing/reassigned submissions can retain the unavailable-feedback state.
            return database.select({ submissionId: submissions.id, id: feedbacks.id, comments: feedbacks.comments,
                decision: feedbacks.decision, createdAt: feedbacks.createdAt,
            }).from(submissions).innerJoin(researchPapers, eq(submissions.paperId, researchPapers.id))
                .leftJoin(feedbacks, eq(feedbacks.submissionId, submissions.id))
                .where(and(inArray(submissions.id, submissionIds), eq(submissions.submittedBy, studentId),
                    inArray(researchPapers.groupId, activeGroups(studentId))))
                .orderBy(desc(feedbacks.createdAt), desc(feedbacks.id));
        },
    };
}

export const studentWorkspaceRepository = createStudentWorkspaceRepository(db);
