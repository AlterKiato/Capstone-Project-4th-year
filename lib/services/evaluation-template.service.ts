import "server-only";
import { randomUUID } from "node:crypto";
import { getCurrentMainAdviser } from "@/lib/auth/main-adviser";
import { ROLE_IDS } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { createEvaluationTemplateRepository } from "@/lib/repositories/evaluation-template.repository";
import { templateListSchema, templateReadSchema, templateMutationSchema } from "@/lib/validations/evaluation-template";
import type { EvaluationTemplate, TemplateResult } from "@/lib/evaluation-templates";

const denied = { success: false, kind: "denied", message: "Evaluation templates are unavailable for this account or template." } as const;
export function createEvaluationTemplateService(repository: ReturnType<typeof createEvaluationTemplateRepository>, account = getCurrentMainAdviser) {
    return {
        async list(input: unknown): Promise<TemplateResult<EvaluationTemplate[]>> {
            try {
                const actor = await account(), parsed = templateListSchema.safeParse(input);
                if (!actor || actor.roleId !== ROLE_IDS.ADVISER || !parsed.success) return denied;
                return await repository.withOwner(actor.userId, async scope => ({ success: true, message: "Templates loaded.", data: await scope.list(parsed.data.includeArchived) })) ?? denied;
            } catch { return { success: false, kind: "unavailable", message: "Templates could not be loaded. Reload to try again." }; }
        },
        async read(input: unknown): Promise<TemplateResult<EvaluationTemplate>> {
            try {
                const actor = await account(), parsed = templateReadSchema.safeParse(input);
                if (!actor || actor.roleId !== ROLE_IDS.ADVISER || !parsed.success) return denied;
                return await repository.withOwner(actor.userId, async scope => {
                    const row = await scope.read(parsed.data.templateId);
                    return row ? { success: true, message: "Template loaded.", data: row } : denied;
                }) ?? denied;
            } catch { return { success: false, kind: "unavailable", message: "Template could not be loaded. Reload to try again." }; }
        },
        async mutate(input: unknown): Promise<TemplateResult<EvaluationTemplate>> {
            try {
                const actor = await account();
                if (!actor || actor.roleId !== ROLE_IDS.ADVISER) return denied;
                const parsed = templateMutationSchema.safeParse(input);
                if (!parsed.success) return { success: false, kind: "validation", message: parsed.error.issues[0]?.message ?? "Check the template fields." };
                const data = parsed.data;
                return await repository.withOwner(actor.userId, async scope => {
                    let saved: EvaluationTemplate;
                    if (data.operation === "create") saved = await scope.create(data.draft);
                    else {
                        const row = await scope.read(data.templateId);
                        if (!row || row.archivedAt) return denied;
                        if (row.revision !== data.expectedRevision) return { success: false, kind: "stale" as const,
                            message: "This template changed. Keep your draft and reload the saved template before trying again." };
                        if (data.operation === "duplicate") saved = await scope.create({ name: `${row.name.slice(0, 193)} (copy)`,
                            scale: structuredClone(row.scale), criteria: row.criteria.map(item => ({ ...item, key: randomUUID() })) });
                        else saved = await scope.update(row, data.operation === "update" ? data.draft : undefined);
                    }
                    await scope.log(`Evaluation Template ${data.operation === "create" ? "Created" : data.operation === "update" ? "Updated" : data.operation === "duplicate" ? "Duplicated" : "Archived"}`, saved);
                    return { success: true, message: data.operation === "archive" ? "Template archived." : data.operation === "duplicate" ? "Independent template copy created." : "Template saved.", data: saved };
                }) ?? denied;
            } catch { return { success: false, kind: "unavailable", message: "The change could not be confirmed. Reload and check the saved templates before retrying." }; }
        },
    };
}
const service = createEvaluationTemplateService(createEvaluationTemplateRepository(db));
export const listEvaluationTemplates = service.list;
export const readEvaluationTemplate = service.read;
export const mutateEvaluationTemplate = service.mutate;
