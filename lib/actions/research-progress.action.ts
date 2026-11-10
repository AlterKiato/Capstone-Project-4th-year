"use server";
import { revalidatePath } from "next/cache";
import { readResearchProgress, mutateResearchProgress } from "@/lib/services/research-progress.service";

export async function readResearchProgressAction(input: unknown) {
    return readResearchProgress(input);
}
export async function mutateResearchProgressAction(input: unknown) {
    const result = await mutateResearchProgress(input);
    if (result.success) {
        try {
            revalidatePath("/dashboard/student/submissions");
            revalidatePath("/dashboard/adviser/groups");
        } catch { return { ...result, message: "Research progress saved. Reload progress to see the current state." }; }
    }
    return result;
}
