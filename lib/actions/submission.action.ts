"use server";

import { revalidatePath } from "next/cache";

import {
    requireRole,
} from "@/lib/auth/authorization";

import {
    ROLE_IDS,
} from "@/lib/auth/roles";

import {
    submitResearch,
} from "@/lib/services/submission.service";

import {
    createSubmissionSchema,
} from "@/lib/validations/submission";

/**
 * Creates a new research submission
 * for the currently authenticated Student.
 *
 * The Student identity is taken from the
 * authentication session instead of the
 * submitted form data.
 */
export async function submitResearchAction(
    formData: FormData
): Promise<void> {
    const session = await requireRole([
        ROLE_IDS.STUDENT,
    ]);

    const parsed =
        createSubmissionSchema.safeParse({
            paperId:
                formData.get("paperId"),

            fileUrl:
                formData.get("fileUrl"),

            remarks:
                formData.get("remarks"),
        });

    if (!parsed.success) {
        return;
    }

    const result =
        await submitResearch(
            parsed.data.paperId,
            session.userId,
            parsed.data.fileUrl,
            parsed.data.remarks
        );

    if (!result.success) {
        return;
    }

    revalidatePath(
        "/dashboard/student"
    );

    revalidatePath(
        "/dashboard/student/submissions"
    );
}