"use server";

import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { createSubmissionDocumentUrl } from "@/lib/services/submission-document.service";
import { submissionDocumentIdSchema } from "@/lib/validations/submission-document";

export async function getSubmissionDownloadUrlAction(submissionId: number): Promise<string | null> {
    const session = await requireRole([ROLE_IDS.STUDENT, ROLE_IDS.ADVISER]);
    const parsed = submissionDocumentIdSchema.safeParse(submissionId);
    if (!parsed.success) return null;
    return createSubmissionDocumentUrl(parsed.data, session.userId);
}
