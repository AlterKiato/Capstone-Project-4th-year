import type { CoAssignment } from "@/types/co-adviser";

export const coReviewHref = (assignment: Pick<CoAssignment, "id" | "submissionId">) =>
    `/dashboard/adviser/submissions/${assignment.submissionId}?assignment=${assignment.id}`;

export function coAssignmentSummary(assignments: CoAssignment[]) {
    return { total: assignments.length, open: assignments.filter(row => row.reviewAvailable).length,
        completed: assignments.filter(row => row.state === "completed").length };
}

export function delegatedGroups(assignments: CoAssignment[]) {
    const groups = new Map<number, CoAssignment[]>();
    for (const row of assignments) groups.set(row.groupId, [...groups.get(row.groupId) ?? [], row]);
    return Array.from(groups, ([id, assignments]) => ({ id, assignments }));
}
