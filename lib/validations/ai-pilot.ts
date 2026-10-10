import { z } from "zod";

export const pilotRequestSchema = z.strictObject({ topicId: z.enum(["admin-overview-v1", "adviser-workflow-overview-v1"]) });
const id = z.number().int().positive().max(2147483647);
export const pilotWindowSchema = z.strictObject({ startsAt: z.date(), endsAt: z.date() })
    .refine(value => value.endsAt.getTime() > value.startsAt.getTime() && value.endsAt.getTime() - value.startsAt.getTime() <= 7200000);
export const pilotApprovalSchema = z.strictObject({
    runId: z.uuid(), authorityRef: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
    scope: z.literal("synthetic-v1"), adminUserId: id, adviserUserId: id,
    startsAt: z.iso.datetime(), endsAt: z.iso.datetime(),
    termsVersion: z.string().min(1).max(64), termsDigest: z.string().regex(/^[a-f0-9]{64}$/),
}).refine(value => value.adminUserId !== value.adviserUserId && pilotWindowSchema.safeParse({ startsAt:new Date(value.startsAt), endsAt:new Date(value.endsAt) }).success);
export type PilotWindow = z.infer<typeof pilotWindowSchema>;
