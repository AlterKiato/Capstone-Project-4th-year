import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getDashboardAccount } from "@/lib/services/dashboard-account.service";
import { getStudentResearchProjects } from "@/lib/services/student-research.service";
import { collaborativeWorkspace } from "@/lib/services/collaborative-workspace.runtime";
import { selectTaskProject } from "@/lib/workspace/task-board-view";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import StudentGroupWorkspace from "@/components/dashboard/student-group-workspace";
import { workspaceView } from "@/lib/workspace/workspace-view";

export const runtime = "nodejs";
export const maxDuration = 60;

export default async function StudentWorkspacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    await requireRole([ROLE_IDS.STUDENT]);
    const account = await getDashboardAccount();
    if (!account || account.roleId !== ROLE_IDS.STUDENT) return <main className="dashboard-page"><h1>Group Workspace</h1><p role="alert">Your account access could not be verified.</p></main>;
    const directory = await getStudentResearchProjects(account.id);
    if (!directory.success) throw new Error("Group workspace unavailable.");
    const projects = [...(directory.data ?? [])].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)
        .map(project => ({ id: project.id, title: project.title }));
    const query = await searchParams;
    const selection = selectTaskProject(projects, query.project);
    const view = workspaceView(query.tab, query.deleted);
    const board = selection.project && view.tab === "tasks" ? await collaborativeWorkspace.taskBoard({ paperId: selection.project.id }) : null;
    const notes = selection.project && view.tab === "notes" ? await collaborativeWorkspace.notesBoard({ paperId: selection.project.id, deletedOnly: view.deletedOnly }) : null;
    return <main className="dashboard-page research-workspace">
        <DashboardHeader title="Group Workspace" email={account.email} />
        <p className="dashboard-context">Plan your group’s work for each research project. Tasks do not change submission or review status.</p>
        <StudentGroupWorkspace key={selection.project?.id ?? "unselected"} projects={projects} project={selection.project} invalidProject={selection.invalid} board={board} notes={notes} {...view} />
    </main>;
}
