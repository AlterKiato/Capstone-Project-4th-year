import "server-only";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getDashboardAccount } from "./dashboard-account.service";
import { getStudentResearchGroups, getStudentResearchProjects } from "./student-research.service";
import { getSubmissionsByPaper } from "./submission.service";
import { getStudentFeedbackBySubmission } from "./student-feedback.service";
import { findGroupMembersByGroupId } from "@/lib/repositories/group-member.repository";
import { findUserById } from "@/lib/repositories/user.repository";

// Resolve ownership before using group/paper IDs. Never accept a client-selected ID here.
export async function getStudentWorkspace() {
    const session = await requireRole([ROLE_IDS.STUDENT]);
    const account = await getDashboardAccount();
    if (!account || account.roleId !== ROLE_IDS.STUDENT) return null;
    const [groupsResult, projectsResult] = await Promise.all([
        getStudentResearchGroups(session.userId), getStudentResearchProjects(session.userId),
    ]);
    if (!groupsResult.success || !projectsResult.success) throw new Error("Workspace unavailable");
    const groups = await Promise.all((groupsResult.data ?? []).map(async group => {
        const memberships = await findGroupMembersByGroupId(group.id);
        const members = await Promise.all(memberships.map(async member => {
            const user = await findUserById(member.userId);
            return { id: member.id, name: user ? `${user.firstName} ${user.lastName}` : "Member name unavailable" };
        }));
        return { id: group.id, groupName: group.groupName, strand: group.strand, section: group.section, schoolYear: group.schoolYear, members };
    }));
    const projects = [...(projectsResult.data ?? [])].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);
    const histories = await Promise.all(projects.map(async project => {
        const result = await getSubmissionsByPaper(project.id);
        if (!result.success) throw new Error("History unavailable");
        return Promise.all((result.data ?? []).map(async submission => {
            // Preserve the existing submitter-only feedback policy, including within a group.
            const feedbackResult = submission.submittedBy === session.userId
                ? await getStudentFeedbackBySubmission(submission.id, session.userId) : null;
            return {
                id: submission.id, paperId: submission.paperId, version: submission.version,
                status: submission.status, remarks: submission.remarks, submittedAt: submission.submittedAt.toISOString(),
                feedbackUnavailable: feedbackResult !== null && !feedbackResult.success,
                feedbackRestricted: submission.submittedBy !== session.userId,
                feedback: (feedbackResult?.data ?? []).map(item => ({ id: item.id, comments: item.comments, decision: item.decision, createdAt: item.createdAt.toISOString() })),
            };
        }));
    }));
    const submissions = histories.flat().sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt) || b.id - a.id);
    return { email: account.email, groups, projects: projects.map(project => ({ ...project, createdAt: project.createdAt.toISOString(), updatedAt: project.updatedAt.toISOString() })), submissions };
}
export type StudentWorkspace = NonNullable<Awaited<ReturnType<typeof getStudentWorkspace>>>;
