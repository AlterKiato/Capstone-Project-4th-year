import { z } from "zod";
import { TEMPLATE_LIMITS as limits } from "@/lib/evaluation-templates";

const id = z.number().int().positive().max(2147483647);
const revision = z.number().int().nonnegative().max(2147483646);
const name = z.string().trim().min(1, "Enter a name.").max(limits.name);
export const templateScaleSchema = z.object({
    version: z.literal(1),
    levels: z.array(z.object({ points: z.number().int().min(1).max(5),
        label: z.string().trim().min(1, "Enter a label for every rating.").max(limits.label),
        description: z.string().trim().max(limits.scaleDescription),
    }).strict()).min(2).max(5),
}).strict().refine(scale => scale.levels.every((level, index) => level.points === index + 1),
    "Rating points must be consecutive, starting at 1.");
export const templateDraftSchema = z.object({
    name,
    scale: templateScaleSchema,
    criteria: z.array(z.object({ key: z.string().uuid(), position: z.number().int().min(0).max(limits.criteria - 1),
        name, description: z.string().trim().max(limits.description), allowsNa: z.boolean(),
    }).strict()).min(1, "Add at least one criterion.").max(limits.criteria),
}).strict().superRefine((draft, context) => {
    if (new Set(draft.criteria.map(row => row.key.toLowerCase())).size !== draft.criteria.length)
        context.addIssue({ code: "custom", path: ["criteria"], message: "Each criterion must have a unique identifier." });
    if (draft.criteria.some((row, index) => row.position !== index))
        context.addIssue({ code: "custom", path: ["criteria"], message: "Criteria must be ordered consecutively, starting at 0." });
});
export const templateListSchema = z.object({ includeArchived: z.boolean().default(false) }).strict();
export const templateReadSchema = z.object({ templateId: id }).strict();
export const templateMutationSchema = z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("create"), draft: templateDraftSchema }).strict(),
    z.object({ operation: z.literal("update"), templateId: id, expectedRevision: revision, draft: templateDraftSchema }).strict(),
    z.object({ operation: z.literal("duplicate"), templateId: id, expectedRevision: revision }).strict(),
    z.object({ operation: z.literal("archive"), templateId: id, expectedRevision: revision }).strict(),
]);
