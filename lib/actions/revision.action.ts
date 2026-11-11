"use server";
import { revalidatePath } from "next/cache";
import { readRevisions, respondToRevision } from "@/lib/services/revision.service";

export async function readRevisionsAction(input: unknown) { return readRevisions(input); }
export async function respondToRevisionAction(input: unknown) {
    const result = await respondToRevision(input);
    if (result.success) {
        try {
            revalidatePath("/dashboard/student");
            revalidatePath("/dashboard/student/submissions");
            revalidatePath("/dashboard/adviser/submissions", "layout");
        } catch { /* A refresh failure cannot turn an acknowledged write into a failed save. */ }
    }
    return result;
}
