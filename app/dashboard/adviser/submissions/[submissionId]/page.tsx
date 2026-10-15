import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdviserReviewDetails } from "@/lib/services/adviser-submissions-ui.service";
import { SUBMISSION_STATUS as STATUS } from "@/lib/constants/submission-status";
import SubmissionStatus from "@/components/dashboard/submission-status";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import { SubmissionDate } from "@/components/dashboard/adviser-submissions";
import styles from "@/components/dashboard/adviser-submissions.module.css";
import DownloadSubmissionButton from "../DownloadSubmissionButton";
import StartReviewButton from "../StartReviewButton";
import FeedbackForm from "../FeedbackForm";

export default async function AdviserSubmissionDetailsPage({ params }: { params: Promise<{ submissionId: string }> }) {
    const { submissionId } = await params;
    const parsedSubmissionId = Number(submissionId);
    if (!Number.isSafeInteger(parsedSubmissionId) || parsedSubmissionId <= 0) notFound();
    const details = await getAdviserReviewDetails(parsedSubmissionId);
    if (!details) notFound();
    const { submission, feedback, feedbackUnavailable } = details;
    const completed = submission.status === STATUS.APPROVED || submission.status === STATUS.REVISION_REQUIRED;
    return <main className={`dashboard-page research-workspace ${styles.page} ${styles.detailPage}`}>
        <p><Link href="/dashboard/adviser/submissions" className="research-back">Back to Submissions</Link></p>
        <DashboardHeader title={submission.researchTitle} email={details.email} />
        <div className={styles.detailHeader}><p className="dashboard-context">{submission.groupName} · {submission.version}</p><SubmissionStatus status={submission.status} /></div>
        <section className="dashboard-panel" aria-labelledby="submission-info-heading">
            <h2 id="submission-info-heading">Submission Information</h2>
            <dl className={styles.metadata}>
                <div><dt>Submitting Student</dt><dd>{submission.studentFirstName} {submission.studentLastName}</dd></div>
                <div><dt>Submitted</dt><dd><SubmissionDate value={submission.submittedAt.toISOString()} /></dd></div>
                <div><dt>Version</dt><dd>{submission.version}</dd></div>
            </dl>
            <div className={styles.remarks}><h3>Student remarks</h3><p>{submission.remarks?.trim() ? submission.remarks : "No remarks provided for this version."}</p></div>
        </section>
        <section className={`dashboard-panel ${styles.document}`} aria-labelledby="document-heading">
            <div><h2 id="document-heading">Research Document</h2><p className="form-help">PDF for {submission.version}. The temporary link expires after five minutes.</p></div>
            <DownloadSubmissionButton submissionId={submission.id} />
        </section>
        <section className="dashboard-panel" aria-labelledby="review-heading">
            <h2 id="review-heading">Adviser Review</h2>
            {submission.status === STATUS.SUBMITTED ? <><p className="dashboard-context">Start review before recording feedback. This changes the submission to Under Review; it does not issue a decision.</p><StartReviewButton submissionId={submission.id} /></> :
                submission.status === STATUS.UNDER_REVIEW ? <FeedbackForm submissionId={submission.id} /> :
                    <p className="dashboard-context">{completed ? `Review complete for ${submission.version}. The recorded decision is read-only.` : `This version is ${submission.status}. Feedback is available only while Under Review.`}</p>}
            {completed && <>
                <h3 className={styles.historyHeading}>Recorded feedback for {submission.version}</h3>
                {feedbackUnavailable ? <p role="alert" className="form-message">Recorded feedback could not be retrieved. Reload to try again.</p> : feedback.length ? feedback.map(entry => <article className={styles.feedback} key={entry.id}>
                    <div className={styles.feedbackHeader}><SubmissionStatus status={entry.decision} /><span className="form-help">{entry.firstName || entry.lastName ? `${entry.firstName ?? ""} ${entry.lastName ?? ""}`.trim() : "Reviewer unavailable"}</span><span className="form-help"><SubmissionDate value={entry.createdAt.toISOString()} /></span></div>
                    <p>{entry.comments}</p>
                </article>) : <p>No recorded feedback is available for this submission version.</p>}
            </>}
        </section>
    </main>;
}
