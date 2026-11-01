"use server";

import { revalidatePath } from "next/cache";
import { submissionUploads } from "@/lib/services/submission-upload.service";
import type { UploadResult } from "@/lib/uploads/contract";
import { requestResearchPush } from "@/lib/push/request";

export async function initiateSubmissionUploadAction(input: unknown): Promise<UploadResult> { return submissionUploads.initiate(input); }
export async function renewSubmissionUploadAction(id: unknown): Promise<UploadResult> { return submissionUploads.renew(id); }
export async function getSubmissionUploadStatusAction(id: unknown): Promise<UploadResult> { return submissionUploads.status(id); }
export async function cancelSubmissionUploadAction(id: unknown): Promise<UploadResult> { return submissionUploads.cancel(id); }
export async function finalizeSubmissionUploadAction(id: unknown): Promise<UploadResult> {
    const push = requestResearchPush();
    const result = await submissionUploads.finalize(id, (recipientId, version) => push({ recipientId,
        event: version === "v1" ? "initial-submission" : "revised-submission" }));
    if (result.code === "completed") {
        try { revalidatePath("/dashboard/student"); revalidatePath("/dashboard/student/submissions"); }
        catch { return { ...result, message: "Research submitted successfully. Reload to view its version." }; }
    }
    return result;
}
