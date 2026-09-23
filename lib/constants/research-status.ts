/**
 * Research project workflow statuses.
 *
 * These statuses describe the current state
 * of the overall research project.
 */
export const RESEARCH_STATUS = {
    DRAFT: "Draft",
    IN_REVIEW: "In Review",
    REVISION_REQUIRED: "Revision Required",
    APPROVED: "Approved",
} as const;

/**
 * Type representing a valid research status.
 */
export type ResearchStatus =
    (typeof RESEARCH_STATUS)[keyof typeof RESEARCH_STATUS];