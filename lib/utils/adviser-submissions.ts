import { SUBMISSION_STATUS as STATUS } from "@/lib/constants/submission-status";

export interface SubmissionDirectoryItem {
    id: number;
    paperId: number;
    researchTitle: string;
    groupName: string;
    studentFirstName: string;
    studentLastName: string;
    version: string;
    status: string;
    submittedAt: string;
}
export type SubmissionFilter = "all" | "pending" | "reviewed";
export const normalizeSubmissionSearch = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
export const isPendingSubmission = (status: string) => status === STATUS.SUBMITTED || status === STATUS.UNDER_REVIEW;
export const isReviewedSubmission = (status: string) => status === STATUS.APPROVED || status === STATUS.REVISION_REQUIRED;
export const matchesSubmissionFilter = (status: string, filter: SubmissionFilter) => filter === "all" || (filter === "pending" ? isPendingSubmission(status) : isReviewedSubmission(status));
export const submissionDetailsHref = (id: number) => `/dashboard/adviser/submissions/${id}`;
const newestFirst = (a: SubmissionDirectoryItem, b: SubmissionDirectoryItem) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt) || b.id - a.id;

export function groupAdviserSubmissions(items: SubmissionDirectoryItem[]) {
    const versions = [...new Map(items.map(item => [item.id, item])).values()];
    const counts = {
        submitted: versions.filter(item => item.status === STATUS.SUBMITTED).length,
        underReview: versions.filter(item => item.status === STATUS.UNDER_REVIEW).length,
        reviewed: versions.filter(item => isReviewedSubmission(item.status)).length,
    };
    const byPaper = new Map<number, SubmissionDirectoryItem[]>();
    for (const item of versions) {
        const group = byPaper.get(item.paperId) ?? [];
        group.push(item);
        byPaper.set(item.paperId, group);
    }
    const projects = [...byPaper.entries()].map(([paperId, submissions]) => {
        submissions.sort(newestFirst);
        return { paperId, latest: submissions[0], history: submissions.slice(1), submissions, pending: submissions.some(item => isPendingSubmission(item.status)) };
    }).sort((a, b) => Number(b.pending) - Number(a.pending) || newestFirst(a.latest, b.latest));
    return { projects, counts };
}

export function filterAdviserProjects(projects: ReturnType<typeof groupAdviserSubmissions>["projects"], search: string, filter: SubmissionFilter) {
    const query = normalizeSubmissionSearch(search);
    return projects.filter(project => project.submissions.some(item => matchesSubmissionFilter(item.status, filter)) &&
        (!query || project.submissions.some(item => normalizeSubmissionSearch(`${item.researchTitle} ${item.groupName} ${item.studentFirstName} ${item.studentLastName}`).includes(query))));
}
