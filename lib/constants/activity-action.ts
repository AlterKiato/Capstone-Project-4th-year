/**
 * Activity actions recorded by the system.
 *
 * Centralizing action names keeps activity logs
 * consistent across services.
 */
export const ACTIVITY_ACTION = {
    RESEARCH_SUBMISSION_APPROVED:
        "Research Submission Approved",

    RESEARCH_SUBMISSION_REVISION_REQUIRED:
        "Research Submission Revision Required",
} as const;

/**
 * Type representing a valid activity action.
 */
export type ActivityAction =
    (typeof ACTIVITY_ACTION)[keyof typeof ACTIVITY_ACTION];