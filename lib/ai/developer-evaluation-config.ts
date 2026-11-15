import "server-only";
import { z } from "zod";
import { isApprovedResearchPreview } from "@/lib/ai/groq-research-pilot-config";

const id = z.number().int().positive().max(2147483647);
const schema = z.strictObject({
    // The existing identity validator strictly checks every field of this target.
    target: z.unknown(),
    // Stable protected branch alias only: immutable/older deployment origins deny.
    // A flag-off redeployment moves this alias; old deployment URLs cannot keep evaluating.
    origin: z.literal("https://thesishs-ai-git-feature-development-thesi-shs-ai.vercel.app"),
    adminUserId: id, adviserUserId: id,
    startsAt: z.iso.datetime(), endsAt: z.iso.datetime(),
}).refine(value => value.adminUserId !== value.adviserUserId &&
    Date.parse(value.endsAt) > Date.parse(value.startsAt) &&
    Date.parse(value.endsAt) - Date.parse(value.startsAt) <= 7200000);

// Distinct synthetic developer capability. Never satisfies institutional consent/eligibility.
// Missing settings disable it; a key alone never grants permission.
export function getDeveloperEvaluationConfiguration() {
    if (process.env.GROQ_DEVELOPER_EVALUATION_ENABLED !== "1") return null;
    try {
        const parsed = schema.safeParse(JSON.parse(process.env.GROQ_DEVELOPER_EVALUATION_JSON ?? "null"));
        if (!parsed.success || !isApprovedResearchPreview(process.env, parsed.data.target)) return null;
        const value = parsed.data, now = Date.now();
        return now >= Date.parse(value.startsAt) && now < Date.parse(value.endsAt) ? value : null;
    } catch { return null; }
}
