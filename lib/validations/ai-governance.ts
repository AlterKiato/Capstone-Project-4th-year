import { z } from "zod";
const revision = z.number().int().nonnegative().max(2147483647);
export const eligibilityDecisionSchema = z.strictObject({
    userId: z.number().int().positive().max(2147483647),
    decision: z.enum(["Eligible", "Not Eligible", "Pending Verification"]),
    revoke: z.boolean(), confirmation: z.literal(true), expectedRevision: revision,
}).refine(input => !input.revoke || input.decision === "Not Eligible");
export const consentRequestSchema = z.discriminatedUnion("action", [
    z.strictObject({ action: z.literal("accept"), termsVersion: z.string().min(1).max(64), acceptance: z.literal(true), expectedRevision: revision }),
    z.strictObject({ action: z.literal("decline"), termsVersion: z.string().min(1).max(64), expectedRevision: revision }),
    z.strictObject({ action: z.literal("withdraw"), expectedRevision: revision }),
]);
