import { SUBMISSION_STATUS } from "@/lib/constants/submission-status";

export type ProgressEvidence = { id: number; version: string; status: string };
export type ProgressMilestone = {
    id: number; paperId: number; title: string; dueDate: string; revision: number;
    submissionId: number | null; verifiedBy: number | null; verifiedAt: string | null;
    evidence: ProgressEvidence | null;
};
export type ResearchProgress = { milestones: ProgressMilestone[]; submissions: ProgressEvidence[]; canManage: boolean; today: string };

export function milestoneCompleted(milestone: Pick<ProgressMilestone, "verifiedBy" | "verifiedAt" | "submissionId">) {
    return milestone.verifiedBy !== null && milestone.verifiedAt !== null && milestone.submissionId !== null;
}
export function milestoneStatus(milestone: ProgressMilestone) {
    if (milestoneCompleted(milestone)) return "Completed";
    if (milestone.evidence?.status === SUBMISSION_STATUS.APPROVED) return "Awaiting verification";
    return milestone.evidence?.status ?? "Pending";
}
export function milestoneOverdue(milestone: ProgressMilestone, today: string) {
    return !milestoneCompleted(milestone) && milestone.dueDate < today;
}
export function manilaToday(now = new Date()) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function completedMilestones(milestones: ProgressMilestone[]) {
    return milestones.filter(milestoneCompleted).length;
}

export function researchProgressSummary({ milestones, today }: Pick<ResearchProgress, "milestones" | "today">) {
    const incomplete = milestones.filter(milestone => !milestoneCompleted(milestone));
    const upcoming = incomplete.filter(milestone => milestone.dueDate >= today)
        .sort((a, b) => a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : a.id - b.id);
    return {
        completed: completedMilestones(milestones),
        total: milestones.length,
        overdue: milestones.filter(milestone => milestoneOverdue(milestone, today)).length,
        next: upcoming[0] ?? null,
    };
}
