import { SUBMISSION_STATUS as STATUS } from "@/lib/constants/submission-status";
import styles from "./adviser-submissions.module.css";

export default function SubmissionStatus({ status }: { status: string }) {
    const tone = status === STATUS.APPROVED ? styles.approved : status === STATUS.REVISION_REQUIRED ? styles.revision : status === STATUS.UNDER_REVIEW ? styles.review : styles.submitted;
    return <span className={`${styles.badge} ${tone}`}>{status}</span>;
}
