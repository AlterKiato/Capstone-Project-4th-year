"use server";

import {
    revalidatePath,
} from "next/cache";

import {
    requireRole,
} from "@/lib/auth/authorization";

import {
    ROLE_IDS,
} from "@/lib/auth/roles";

import {
    startSubmissionReview,
} from "@/lib/services/adviser-review.service";

/**
 * Starts the review workflow for a
 * specific research submission.
 *
 * Authorization is enforced server-side
 * through the authenticated Adviser session.
 */
export async function startSubmissionReviewAction(
    submissionId: number
): Promise<{
    success: boolean;
    message: string;
}> {
    const session =
        await requireRole([
            ROLE_IDS.ADVISER,
        ]);

    if (
        !Number.isInteger(
            submissionId
        ) ||
        submissionId <= 0
    ) {
        return {
            success: false,
            message:
                "Invalid submission ID.",
        };
    }

    const result =
        await startSubmissionReview(
            submissionId,
            session.userId
        );

    if (!result.success) {
        return {
            success: false,
            message:
                result.message,
        };
    }

    revalidatePath(
        "/dashboard/adviser/submissions"
    );

    revalidatePath(
        `/dashboard/adviser/submissions/${submissionId}`
    );

    revalidatePath(
        "/dashboard/student/submissions"
    );

    return {
        success: true,
        message:
            result.message,
    };
}