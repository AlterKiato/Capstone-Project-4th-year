import DashboardHeader from "@/components/dashboard/dashboard-header";
import StudentResearch from "@/components/dashboard/student-research";
import { getStudentWorkspace } from "@/lib/services/student-workspace.service";

export default async function StudentSubmissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const workspace = await getStudentWorkspace();
    if (!workspace) return <main className="dashboard-page"><h1>Research Submissions</h1><p role="alert">Your account access could not be verified.</p></main>;
    const query = await searchParams;
    return <main className="dashboard-page research-workspace">
        <DashboardHeader title="Research Submissions" email={workspace.email} />
        <p className="dashboard-context">Manage your group’s research projects and follow each version’s review.</p>
        <StudentResearch workspace={workspace} target={{ project: query.project, submission: query.submission, feedback: query.feedback }} />
    </main>;
}
