import Link from "next/link";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import GroupMembers from "@/components/dashboard/group-members";
import styles from "@/components/dashboard/student-ui.module.css";
import { getStudentWorkspace } from "@/lib/services/student-workspace.service";
import { getCurrentStudentVerificationStatus } from "@/lib/services/email-verification-status.service";

export default async function StudentPage() {
    const workspace = await getStudentWorkspace();
    if (!workspace) return <main className="dashboard-page"><h1>Student Dashboard</h1><p role="alert">Your account access could not be verified.</p></main>;
    const verification = await getCurrentStudentVerificationStatus();
    const { groups, projects, submissions } = workspace;
    const latestFeedback = submissions.flatMap(submission => submission.feedback.map(feedback => ({ submission, feedback })))
        .sort((a, b) => Date.parse(b.feedback.createdAt) - Date.parse(a.feedback.createdAt) || b.feedback.id - a.feedback.id)[0];
    return <main className="dashboard-page student-overview">
        <DashboardHeader title="Student Dashboard" email={workspace.email} />
        {verification && !verification.verified && <aside className="research-notice" aria-label="Optional email verification">
            <p>Email verification is optional. Your research workspace remains available.</p>
            <p><Link href="/dashboard/student/verify-email">Check email verification</Link> to request a verification email when delivery is available. Registration does not send one automatically.</p>
        </aside>}
        {!verification && <p className="research-notice" role="status">Email verification status is temporarily unavailable. Your research workspace remains available. <Link href="/dashboard/student/verify-email">Check verification status</Link>.</p>}
        {!groups.length ? <section className="dashboard-panel"><h2>No Research Group Assigned</h2><p>Research group details and adviser feedback will appear after your Adviser assigns you to a group.</p></section> :
            <div className={styles.overview}>
                <section className="dashboard-panel"><h2>Research Group</h2>{groups.map(group => {
                    const groupProjects = projects.filter(project => project.groupId === group.id);
                    const latest = submissions.find(submission => groupProjects.some(project => project.id === submission.paperId));
                    return <div key={group.id}>
                        <h3>{group.groupName}</h3><p className="dashboard-context">{[group.strand, group.section, group.schoolYear].filter(Boolean).join(" · ")}</p>
                        <GroupMembers members={group.members} />
                        <p className="form-help">Latest submission</p><span className={styles.badge}>{latest?.status ?? (groupProjects.length ? "Not yet submitted" : "No research project yet")}</span>
                        {latest && <p className="form-help">{projects.find(project => project.id === latest.paperId)?.title} · {latest.version}</p>}
                    </div>;
                })}</section>
                <section className="dashboard-panel"><h2>Latest Feedback</h2>{latestFeedback ? <>
                    <p className={styles.excerpt}>{latestFeedback.feedback.comments}</p>
                    <p className="form-help">{latestFeedback.submission.version} · Reviewed <time dateTime={latestFeedback.feedback.createdAt}>{new Date(latestFeedback.feedback.createdAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}</time></p>
                    <Link href={`/dashboard/student/submissions?project=${latestFeedback.submission.paperId}&submission=${latestFeedback.submission.id}&feedback=${latestFeedback.feedback.id}#feedback-${latestFeedback.feedback.id}`}>View Full Feedback</Link>
                </> : <p>{submissions.some(item => item.feedbackUnavailable) ? "Feedback could not be retrieved. Reload to try again." : "No adviser feedback yet."}</p>}</section>
            </div>}
    </main>;
}
