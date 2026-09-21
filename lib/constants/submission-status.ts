/**
 * Submission workflow statuses.
 *
 * These statuses describe the current state of
 * an individual research submission version.
 */
export const SUBMISSION_STATUS = {
    SUBMITTED: "Submitted",
    UNDER_REVIEW: "Under Review",
    REVISION_REQUIRED: "Revision Required",
    APPROVED: "Approved",
} as const;

/**
 * Type representing a valid submission status.
 */
export type SubmissionStatus =
    (typeof SUBMISSION_STATUS)[keyof typeof SUBMISSION_STATUS];