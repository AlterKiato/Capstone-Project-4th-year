import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getAdviserSubmission } from "@/lib/services/adviser-submission.service";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import DownloadSubmissionButton from "../DownloadSubmissionButton";
import StartReviewButton from "../StartReviewButton";
import FeedbackForm from "../FeedbackForm";

export default async function AdviserSubmissionDetailsPage({ params }: { params: Promise<{ submissionId: string }> }) {
    const session = await requireRole([ROLE_IDS.ADVISER]);
    const { submissionId } = await params;
    const parsedSubmissionId = Number(submissionId);
    if (!Number.isInteger(parsedSubmissionId) || parsedSubmissionId <= 0) notFound();
    const result = await getAdviserSubmission(parsedSubmissionId, session.userId);
    if (!result.success || !result.data) notFound();
    const submission = result.data;

    return (
        <main className="dashboard-page research-workspace">
            <DashboardHeader title="Submission Details" email={session.email} />
            <p><Link href="/dashboard/adviser/submissions" className="research-back">Back to Submissions</Link></p>
            <section className="dashboard-panel">
                <h2>{submission.researchTitle}</h2>
                <dl className="research-metadata">
                    <div><dt>Research group</dt><dd>{submission.groupName}</dd></div>
                    <div><dt>Student</dt><dd>{submission.studentFirstName} {submission.studentLastName}</dd></div>
                    <div><dt>Version</dt><dd>{submission.version}</dd></div>
                    <div><dt>Submission status</dt><dd>{submission.status}</dd></div>
                    <div><dt>Submitted</dt><dd><time dateTime={submission.submittedAt.toISOString()}>{submission.submittedAt.toLocaleString()}</time></dd></div>
                    <div><dt>Student remarks</dt><dd className="research-comments">{submission.remarks || "No remarks provided."}</dd></div>
                </dl>
            </section>
            <section className="dashboard-panel">
                <h2>Research Document · {submission.version}</h2>
                <p className="dashboard-context">Open this version’s PDF through the existing authorized link. The temporary link expires after five minutes.</p>
                <DownloadSubmissionButton submissionId={submission.id} />
            </section>
            <section className="dashboard-panel">
                <h2>Review This Version</h2>
                {submission.status === "Submitted" ? (
                    <>
                        <p className="dashboard-context">Start review before recording feedback. This changes the submission to Under Review; it does not issue a decision.</p>
                        <StartReviewButton submissionId={submission.id} />
                    </>
                ) : submission.status === "Under Review" ? (
                    <FeedbackForm submissionId={submission.id} />
                ) : (
                    <p>This version is {submission.status}. Feedback and decisions can only be submitted while a version is Under Review.</p>
                )}
            </section>
        </main>
    );
}
