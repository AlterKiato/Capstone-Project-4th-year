export type RevisionResponse = {
    studentId: number; studentName: string; actionTaken: string; revision: number;
    frozenBySubmissionId: number | null; updatedAt: string;
};
export type RevisionItem = {
    id: number; correction: string; reference: string; position: number;
    responses: RevisionResponse[];
};
export type RevisionCycle = {
    feedbackId: number; submissionId: number; version: string; createdAt: string;
    editable: boolean; items: RevisionItem[];
};
export type RevisionChecklist = { canManage: boolean; cycles: RevisionCycle[] };
export function revisionCounts(cycle: RevisionCycle | undefined) {
    const total = cycle?.items.length ?? 0;
    const addressed = cycle?.items.filter(item => item.responses.some(response => response.actionTaken.trim().length > 0)).length ?? 0;
    return { total, addressed, pending: total - addressed };
}
