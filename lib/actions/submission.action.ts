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

export type SubmissionActionResult = {
    success: boolean;
    message: string;
};

/**
 * Creates a new research submission
 * for the currently authenticated Student.
 *
 * The Student identity comes from the
 * authentication session.
 */
export async function submitResearchAction(
    formData: FormData
): Promise<SubmissionActionResult> {
    const session =
        await requireRole([
            ROLE_IDS.STUDENT,
        ]);

    const parsed =
        createSubmissionSchema.safeParse({
            paperId:
                formData.get(
                    "paperId"
                ),
            remarks:
                formData.get(
                    "remarks"
                ),
        });

    if (!parsed.success) {
        return { success: false, message: "Select a research project and keep remarks within 500 characters." };
    }

    const file =
        formData.get("file");

    if (!(file instanceof File)) {
        return { success: false, message: "Choose a PDF file to submit." };
    }

    let result;
    try {
        result = await submitResearch(
            parsed.data.paperId,
            session.userId,
            file,
            parsed.data.remarks
        );
    } catch {
        return { success: false, message: "The research submission could not be completed. Please try again." };
    }

    if (!result.success) {
        // Service failures may contain internal storage/database error details.
        return { success: false, message: "The research submission could not be completed. Check the PDF requirements and latest review status before trying again." };
    }

    try {
        revalidatePath(
            "/dashboard/student"
        );

        revalidatePath(
            "/dashboard/student/submissions"
        );
    } catch {
        // The submission already succeeded. Do not invite a duplicate upload.
        return { success: true, message: "Research submitted successfully. Reload this page to view the new version." };
    }
    return { success: true, message: "Research submitted successfully." };
}
