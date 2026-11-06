import "server-only";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getDashboardAccount } from "./dashboard-account.service";
import { studentWorkspaceRepository as repository } from "@/lib/repositories/student-workspace.repository";

// Resolve ownership before using group/paper IDs. Never accept a client-selected ID here.
export async function getStudentWorkspace() {
    const session = await requireRole([ROLE_IDS.STUDENT]);
    const account = await getDashboardAccount();
    if (!account || account.roleId !== ROLE_IDS.STUDENT) return null;
    const ownedGroups = await repository.groups(session.userId);
    const groupIds = ownedGroups.map(group => group.id);
    // Member names do not block project/history/feedback retrieval.
    const [members, research] = await Promise.all([
        repository.members(session.userId, groupIds),
        (async () => {
            const projects = await repository.projects(session.userId, groupIds);
            const history = await repository.submissions(session.userId, projects.map(project => project.id));
            const ownIds = history.filter(submission => submission.submittedBy === session.userId).map(submission => submission.id);
            const feedback = await repository.feedback(session.userId, ownIds);
            return { projects, history, feedback };
        })(),
    ]);
    const membersByGroup = new Map<number, { id: number; name: string }[]>();
    for (const member of members) {
        const list = membersByGroup.get(member.groupId) ?? [];
        list.push({ id: member.id, name: member.firstName !== null && member.lastName !== null
            ? `${member.firstName} ${member.lastName}` : "Member name unavailable" });
        membersByGroup.set(member.groupId, list);
    }
    const groups = ownedGroups.map(group => ({ ...group, members: membersByGroup.get(group.id) ?? [] }));
    const feedbackBySubmission = new Map<number, { id: number; comments: string; decision: string; createdAt: string }[]>();
    for (const item of research.feedback) {
        const list = feedbackBySubmission.get(item.submissionId) ?? [];
        if (item.id !== null && item.comments !== null && item.decision !== null && item.createdAt !== null)
            list.push({ id: item.id, comments: item.comments, decision: item.decision, createdAt: item.createdAt.toISOString() });
        feedbackBySubmission.set(item.submissionId, list);
    }
    const projects = research.projects;
    const submissions = research.history.map(submission => ({
        id: submission.id, paperId: submission.paperId, version: submission.version,
        status: submission.status, remarks: submission.remarks, submittedAt: submission.submittedAt.toISOString(),
        feedbackUnavailable: submission.submittedBy === session.userId && !feedbackBySubmission.has(submission.id),
        feedbackRestricted: submission.submittedBy !== session.userId,
        feedback: submission.submittedBy === session.userId ? feedbackBySubmission.get(submission.id) ?? [] : [],
    }));
    return { email: account.email, groups, projects: projects.map(project => ({ ...project, createdAt: project.createdAt.toISOString(), updatedAt: project.updatedAt.toISOString() })), submissions };
}
export type StudentWorkspace = NonNullable<Awaited<ReturnType<typeof getStudentWorkspace>>>;
