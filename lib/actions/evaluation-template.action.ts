"use server";
import { revalidatePath } from "next/cache";
import { listEvaluationTemplates, readEvaluationTemplate, mutateEvaluationTemplate } from "@/lib/services/evaluation-template.service";
import { EVALUATION_CRITERIA_HREF } from "@/lib/constants/dashboard-navigation";

export async function listEvaluationTemplatesAction(input: unknown) { return listEvaluationTemplates(input); }
export async function readEvaluationTemplateAction(input: unknown) { return readEvaluationTemplate(input); }
export async function mutateEvaluationTemplateAction(input: unknown) {
    const result = await mutateEvaluationTemplate(input);
    if (result.success) {
        try { revalidatePath(EVALUATION_CRITERIA_HREF); revalidatePath("/dashboard/adviser/submissions"); }
        catch { return { ...result, message: `${result.message} Reload to see the saved list.` }; }
    }
    return result;
}
