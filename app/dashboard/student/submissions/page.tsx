import Link from "next/link";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getStudentResearchProjects } from "@/lib/services/student-research.service";
import { getSubmissionsByStudent } from "@/lib/services/submission.service";
import { getStudentFeedbackBySubmission } from "@/lib/services/student-feedback.service";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import DashboardNavigation from "@/components/dashboard/dashboard-navigation";
import DownloadSubmissionButton from "./DownloadSubmissionButton";
import SubmissionForm from "./SubmissionForm";

export default async function StudentSubmissionsPage() {
    const session = await requireRole([ROLE_IDS.STUDENT]);
    const projectsResult = await getStudentResearchProjects(session.userId);
    const projects = projectsResult.data ?? [];
    const submissionsResult = await getSubmissionsByStudent(session.userId);
    const submissions = submissionsResult.data ?? [];
    const submissionsWithFeedback = await Promise.all(submissions.map(async submission => {
        const feedbackResult = await getStudentFeedbackBySubmission(submission.id, session.userId);
        return { submission, feedbackResult };
    }));

    return (
        <main className="dashboard-page research-workspace">
            <DashboardHeader title="Research Submissions" email={session.email} />
            <DashboardNavigation links={[
                { href: "/dashboard/student", label: "Overview" },
                { href: "/dashboard/student/submissions", label: "My Research & Submissions" },
                { href: "/dashboard/student/notifications", label: "Notifications" },
                { href: "/dashboard/repository", label: "Browse Repository" },
            ]} />
            <p className="dashboard-context">Submit a PDF and follow each version’s review status and Adviser feedback.</p>
            <section className="dashboard-panel">
                <h2>Your Research Projects</h2>
                {!projectsResult.success ? (
                    <p className="form-message" role="alert">{projectsResult.message}</p>
                ) : projects.length === 0 ? (
                    <p>No research projects are available. <Link href="/dashboard/student">Return to Overview to create a project</Link>, or contact your Adviser about your group assignment.</p>
                ) : (
                    <ul className="research-projects">
                        {projects.map(project => (
                            <li key={project.id}>
                                <h3>{project.title}</h3>
                                <dl className="research-metadata">
                                    <div><dt>Research status</dt><dd>{project.status}</dd></div>
                                    <div><dt>Research group ID</dt><dd>{project.groupId}</dd></div>
                                    <div><dt>Category</dt><dd>{project.category || "Not specified"}</dd></div>
                                    <div><dt>Keywords</dt><dd>{project.keywords || "Not specified"}</dd></div>
                                </dl>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            <section className="dashboard-panel" aria-labelledby="upload-heading">
                <h2 id="upload-heading">Submit Research PDF</h2>
                <p>For your first submission, select a project and upload its PDF. Submit a revised version only after your Adviser marks the latest version Revision Required.</p>
                {!projectsResult.success ? (
                    <p>Project information is unavailable. Reload this page before submitting.</p>
                ) : projects.length === 0 ? (
                    <p>Create a research project before submitting a document.</p>
                ) : (
                    <SubmissionForm projects={projects.map(({ id, title }) => ({ id, title }))} />
                )}
            </section>
            <section className="dashboard-panel" aria-labelledby="history-heading">
                <h2 id="history-heading">Submission History</h2>
                <p className="dashboard-context">Newest submissions appear first. Feedback belongs to the version shown with it.</p>
                {!submissionsResult.success ? (
                    <p className="form-message" role="alert">{submissionsResult.message}</p>
                ) : submissions.length === 0 ? (
                    <p>You have not submitted a research document yet. Use the PDF form above for your first version.</p>
                ) : (
                    <ol className="submission-history">
                        {submissionsWithFeedback.map(({ submission, feedbackResult }) => (
                            <li key={submission.id}>
                                <article aria-labelledby={`submission-${submission.id}`}>
                                    <h3 id={`submission-${submission.id}`}>
                                        {projects.find(project => project.id === submission.paperId)?.title ?? `Research ${submission.paperId}`} · {submission.version}
                                    </h3>
                                    <dl className="research-metadata">
                                        <div><dt>Submission status</dt><dd>{submission.status}</dd></div>
                                        <div><dt>Submitted</dt><dd><time dateTime={submission.submittedAt.toISOString()}>{submission.submittedAt.toLocaleString()}</time></dd></div>
                                        <div><dt>Remarks</dt><dd className="research-comments">{submission.remarks || "No remarks provided."}</dd></div>
                                    </dl>
                                    <DownloadSubmissionButton submissionId={submission.id} />
                                    <section className="submission-feedback" aria-label={`Adviser feedback for ${submission.version}`}>
                                        <h4>Adviser Feedback · {submission.version}</h4>
                                        {!feedbackResult.success ? (
                                            <p className="form-message" role="alert">Feedback could not be retrieved for this version.</p>
                                        ) : !feedbackResult.data?.length ? (
                                            <p>No feedback recorded for this version yet.</p>
                                        ) : feedbackResult.data.map(item => (
                                            <div key={item.id} className="feedback-entry">
                                                <p><strong>Decision: {item.decision}</strong></p>
                                                <p className="research-comments">{item.comments}</p>
                                                <p className="form-help">Reviewed <time dateTime={item.createdAt.toISOString()}>{item.createdAt.toLocaleString()}</time></p>
                                            </div>
                                        ))}
                                    </section>
                                </article>
                            </li>
                        ))}
                    </ol>
                )}
            </section>
        </main>
    );
}
