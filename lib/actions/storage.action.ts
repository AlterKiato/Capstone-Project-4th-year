"use server";

import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { createSubmissionDocumentUrl } from "@/lib/services/submission-document.service";
import { submissionDocumentIdSchema, submissionDocumentPurposeSchema, type SubmissionDocumentPurpose } from "@/lib/validations/submission-document";

export async function getSubmissionDownloadUrlAction(submissionId: number, purpose: SubmissionDocumentPurpose = "download"): Promise<string | null> {
    const session = await requireRole([ROLE_IDS.STUDENT, ROLE_IDS.ADVISER]);
    const parsed = submissionDocumentIdSchema.safeParse(submissionId);
    const parsedPurpose = submissionDocumentPurposeSchema.safeParse(purpose);
    if (!parsed.success || !parsedPurpose.success) return null;
    return createSubmissionDocumentUrl(parsed.data, session.userId, parsedPurpose.data);
}
