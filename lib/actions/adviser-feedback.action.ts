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
    createAdviserFeedback,
} from "@/lib/services/adviser-feedback.service";

import {
    createFeedbackSchema,
} from "@/lib/validations/feedback";

/**
 * Saves Adviser feedback for a research
 * submission and updates the submission
 * workflow when revision is required.
 */
export async function createAdviserFeedbackAction(
    formData: FormData
): Promise<{
    success: boolean;
    message: string;
}> {
    const session =
        await requireRole([
            ROLE_IDS.ADVISER,
        ]);

    const parsed =
        createFeedbackSchema.safeParse({
            submissionId:
                formData.get(
                    "submissionId"
                ),

            comments:
                formData.get(
                    "comments"
                ),

            decision:
                formData.get(
                    "decision"
                ),
        });

    if (!parsed.success) {
        return {
            success: false,
            message:
                parsed.error.issues[0]
                    ?.message ??
                "Invalid feedback information.",
        };
    }

    const result =
        await createAdviserFeedback(
            parsed.data.submissionId,
            session.userId,
            parsed.data.comments,
            parsed.data.decision
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
        `/dashboard/adviser/submissions/${parsed.data.submissionId}`
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