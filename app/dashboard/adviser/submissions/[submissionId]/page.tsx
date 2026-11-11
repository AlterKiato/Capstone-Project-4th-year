import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdviserReviewDetails } from "@/lib/services/adviser-submissions-ui.service";
import { SUBMISSION_STATUS as STATUS } from "@/lib/constants/submission-status";
import SubmissionStatus from "@/components/dashboard/submission-status";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import { SubmissionDate } from "@/components/dashboard/adviser-submissions";
import styles from "@/components/dashboard/adviser-submissions.module.css";
import AuthorizedPdfPreview from "../AuthorizedPdfPreview";
import ReviewDraftBoundary from "../ReviewDraftBoundary";
import SubmissionVersionNavigator from "../SubmissionVersionNavigator";
import workspace from "../review-workspace.module.css";
import StartReviewButton from "../StartReviewButton";
import FeedbackForm from "../FeedbackForm";
import FeedbackContent from "@/components/feedback-content";
import CoAdviserReview from "@/components/dashboard/co-adviser-review";
import { getCoAdviserAssignment } from "@/lib/services/co-adviser.service";
import OfficialFeedbackDraft from "../OfficialFeedbackDraft";
import ReviewWorkspace from "../ReviewWorkspace";
import ReviewTabs from "../ReviewTabs";
import RevisionDraftProvider from "../RevisionDraft";

export const runtime = "nodejs";
export const maxDuration = 60;

export default async function AdviserSubmissionDetailsPage({ params, searchParams }: { params: Promise<{ submissionId: string }>; searchParams?: Promise<{ assignment?: string | string[] }> }) {
    const { submissionId } = await params;
    const parsedSubmissionId = Number(submissionId);
    if (!Number.isSafeInteger(parsedSubmissionId) || parsedSubmissionId <= 0) notFound();
    const details = await getAdviserReviewDetails(parsedSubmissionId);
    if (!details) {
        const assignmentId = Number((await searchParams)?.assignment);
        const delegated = await getCoAdviserAssignment({submissionId:parsedSubmissionId,assignmentId});
        if (!delegated.success || !delegated.data) notFound();
        return <CoAdviserReview key={delegated.data.assignment.id} initial={delegated.data.assignment} email={delegated.data.email} />;
    }
    const { submission, feedback, feedbackUnavailable } = details;
    const completed = submission.status === STATUS.APPROVED || submission.status === STATUS.REVISION_REQUIRED;
    const versions = details.versions.some(version => version.id === submission.id) ? details.versions :
        [{ id: submission.id, version: submission.version, status: submission.status }, ...details.versions];
    return <ReviewDraftBoundary key={submission.id}><OfficialFeedbackDraft><RevisionDraftProvider><main className={`dashboard-page research-workspace ${styles.page} ${styles.detailPage} ${workspace.page}`}>
        <p><Link href="/dashboard/adviser/submissions" className="research-back context-back"><span aria-hidden="true">←</span>Back to Submissions</Link></p>
        <DashboardHeader title={submission.researchTitle} email={details.email} />
        <div className={workspace.summary}><p className="dashboard-context">{submission.groupName} · {submission.version}</p><SubmissionStatus status={submission.status} /></div>
        <section className={`dashboard-panel ${workspace.information}`} aria-labelledby="submission-info-heading">
            <h2 id="submission-info-heading">Submission Information</h2>
            <dl className={workspace.metadata}>
                <div><dt>Submitting Student</dt><dd>{submission.studentFirstName} {submission.studentLastName}</dd></div>
                <div><dt>Submitted</dt><dd><SubmissionDate value={submission.submittedAt.toISOString()} /></dd></div>
                <div><dt>Version</dt><dd>{submission.version}</dd></div>
            </dl>
            <div className={workspace.remarks}><h3>Student remarks</h3><p>{submission.remarks?.trim() ? submission.remarks : "No remarks provided for this version."}</p></div>
        </section>
        <div className={workspace.toolbar}><SubmissionVersionNavigator submissionId={submission.id} versions={versions} />
        {details.versionsUnavailable && <p role="status" className="form-help">Version history is unavailable. The selected submission remains open.</p>}
        </div>
        <ReviewWorkspace version={submission.version} document={<AuthorizedPdfPreview key={submission.id} submissionId={submission.id} version={submission.version} />}>
            <ReviewTabs submissionId={submission.id} paperId={submission.paperId} editable={submission.status === STATUS.UNDER_REVIEW}>
            <div className={workspace.reviewStatus}><p className="form-help">Review status</p><SubmissionStatus status={submission.status} /></div>
            <div className={workspace.reviewBody} tabIndex={0} role="region" aria-label="Adviser review content">
            {submission.status === STATUS.SUBMITTED ? <><p className="dashboard-context">Start review before recording feedback. This changes the submission to Under Review; it does not issue a decision.</p><StartReviewButton submissionId={submission.id} /></> :
                submission.status === STATUS.UNDER_REVIEW ? <FeedbackForm key={submission.id} submissionId={submission.id} /> :
                    <p className="dashboard-context">{completed ? `Review complete for ${submission.version}. The recorded decision is read-only.` : `This version is ${submission.status}. Feedback is available only while Under Review.`}</p>}
            {completed && <section className={workspace.history} aria-labelledby="recorded-feedback-heading">
                <h3 id="recorded-feedback-heading">Recorded feedback for {submission.version}</h3>
                {feedbackUnavailable ? <p role="alert" className="form-message">Recorded feedback could not be retrieved. Reload to try again.</p> : feedback.length ? feedback.map(entry => <article className={styles.feedback} key={entry.id}>
                    <div className={styles.feedbackHeader}><SubmissionStatus status={entry.decision} /><span className="form-help">{entry.firstName || entry.lastName ? `${entry.firstName ?? ""} ${entry.lastName ?? ""}`.trim() : "Reviewer unavailable"}</span><span className="form-help"><SubmissionDate value={entry.createdAt.toISOString()} /></span></div>
                    <FeedbackContent value={entry.comments} />
                </article>) : <p>No recorded feedback is available for this submission version.</p>}
            </section>}
            </div>
            </ReviewTabs>
        </ReviewWorkspace>
    </main></RevisionDraftProvider></OfficialFeedbackDraft></ReviewDraftBoundary>;
}
