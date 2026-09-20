import { findSubmissionById } from "@/lib/repositories/submission.repository";
import { findResearchPaperById } from "@/lib/repositories/research-paper.repository";
import { findFeedbackBySubmissionId } from "@/lib/repositories/feedback.repository";
import type { ServiceResult } from "@/types/auth";

/**
 * Represents feedback that a Student is allowed
 * to view for one of their own submissions.
 */
export interface StudentFeedback {
    id: number;
    submissionId: number;
    teacherId: number;
    comments: string;
    decision: string;
    createdAt: Date;
}

/**
 * Retrieves all feedback belonging to a specific
 * Student submission.
 *
 * Authorization is enforced by checking that the
 * authenticated Student is the original submitter
 * of the submission.
 */
export async function getStudentFeedbackBySubmission(
    submissionId: number,
    studentId: number
): Promise<ServiceResult<StudentFeedback[]>> {
    /**
     * Retrieve the requested submission.
     */
    const submission =
        await findSubmissionById(
            submissionId
        );

    if (!submission) {
        return {
            success: false,
            message: "Submission not found.",
        };
    }

    /**
     * Retrieve the research paper associated
     * with the submission.
     */
    const paper =
        await findResearchPaperById(
            submission.paperId
        );

    if (!paper) {
        return {
            success: false,
            message:
                "Research paper associated with this submission was not found.",
        };
    }

    /**
     * Only the Student who submitted this
     * specific submission may view its feedback.
     */
    if (
        submission.submittedBy !==
        studentId
    ) {
        return {
            success: false,
            message:
                "You are not authorized to view feedback for this submission.",
        };
    }

    /**
     * Retrieve all feedback associated with
     * this specific submission version.
     */
    const feedback =
        await findFeedbackBySubmissionId(
            submissionId
        );

    return {
        success: true,
        message:
            "Student feedback retrieved successfully.",
        data: feedback,
    };
}