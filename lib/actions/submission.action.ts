"use server";

import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

export type SubmissionActionResult = { success: boolean; message: string };

/** Retired transport: old clients cannot create submissions by posting a File. */
export async function submitResearchAction(_formData: FormData): Promise<SubmissionActionResult> {
    void _formData;
    await requireRole([ROLE_IDS.STUDENT]);
    return { success: false, message: "This upload form has been replaced. Reload Research Submissions and use the direct PDF upload." };
}
