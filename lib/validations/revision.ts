import { z } from "zod";

export const revisionDraftSchema = z.object({
    correction: z.string().trim().min(1, "Enter a correction.").max(2000),
    reference: z.string().trim().max(120).default(""),
}).strict();
export const revisionDraftsSchema = z.array(revisionDraftSchema).max(30, "Use at most 30 corrections per decision.");
export type RevisionDraft = z.infer<typeof revisionDraftSchema>;
export const revisionReadSchema = z.object({ paperId: z.number().int().positive(), submissionId: z.number().int().positive().optional() }).strict();
export const revisionResponseSchema = z.object({
    paperId: z.number().int().positive(), itemId: z.number().int().positive(),
    expectedRevision: z.number().int().nonnegative(), actionTaken: z.string().trim().max(2000),
}).strict();

// Missing field is a legacy feedback caller. Invalid JSON must never silently become [].
export function revisionDraftsFromForm(value: FormDataEntryValue | null): unknown {
    if (value === null) return [];
    if (typeof value !== "string" || value.length > 70000) return null;
    try { return JSON.parse(value); } catch { return null; }
}
