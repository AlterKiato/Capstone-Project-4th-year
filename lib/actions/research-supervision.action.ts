"use server";

import { revalidatePath } from "next/cache";
import { designateMainAdviser } from "@/lib/services/research-supervision.service";

export async function designateMainAdviserAction(input: unknown) {
    const result = await designateMainAdviser(input);
    if (result.success) {
        try { revalidatePath("/dashboard/admin/users"); }
        catch { return { ...result, message: "Main Research Adviser designation saved. Reload to view the current designation." }; }
    }
    return result;
}
