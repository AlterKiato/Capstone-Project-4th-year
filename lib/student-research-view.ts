import type { StudentWorkspace } from "@/lib/services/student-workspace.service";
export type ResearchTarget = Record<"project" | "submission" | "feedback", string | string[] | undefined>;
export function resolveResearchTarget(workspace: StudentWorkspace, target: ResearchTarget) {
    const id = (value: string | string[] | undefined) => typeof value === "string" && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : undefined;
    const project = workspace.projects.find(item => item.id === id(target.project)) ?? workspace.projects[0];
    const submissions = workspace.submissions.filter(item => item.paperId === project?.id)
        .sort((a, b) => Number(b.version.replace(/^v/, "")) - Number(a.version.replace(/^v/, "")) || Date.parse(b.submittedAt) - Date.parse(a.submittedAt) || b.id - a.id);
    const submission = submissions.find(item => item.id === id(target.submission));
    const feedback = submission?.feedback.find(item => item.id === id(target.feedback));
    return { project, submissions, expandedId: submission?.id ?? submissions[0]?.id ?? null, feedbackId: feedback?.id };
}
