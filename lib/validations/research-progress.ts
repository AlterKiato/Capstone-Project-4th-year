import { z } from "zod";

const id = z.number().int().positive().max(2147483647);
const dueDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= "1900-01-01" && value <= "9999-12-31";
}, "Enter a valid deadline.");
export const progressPaperSchema = z.object({ paperId: id });
const existing = { paperId: id, milestoneId: id, expectedRevision: z.number().int().nonnegative().max(2147483646) };
export const progressMutationSchema = z.discriminatedUnion("operation", [
    z.object({ operation: z.literal("create"), paperId: id, title: z.string().trim().min(1).max(200), dueDate }),
    z.object({ operation: z.literal("edit"), ...existing, title: z.string().trim().min(1).max(200), dueDate }),
    z.object({ operation: z.literal("link"), ...existing, submissionId: id }),
    z.object({ operation: z.literal("verify"), ...existing }),
]);
export type ProgressMutation = z.infer<typeof progressMutationSchema>;
