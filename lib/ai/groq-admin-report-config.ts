import "server-only";
import { z } from "zod";
import { AI_TERMS_VERSION, AI_TERMS_DIGEST } from "@/lib/ai/consent-terms";
import { isApprovedResearchPreview } from "@/lib/ai/groq-research-pilot-config";

// Independent code gates. A key or environment manifest cannot enable unfinished consent.
export const GROQ_ADMIN_REPORT_ENABLED = false;
const termsSchema = z.strictObject({
    finalized: z.literal(true), version: z.string().regex(/^ai-assistance-v[1-9]\d*$/).max(64),
    digest: z.string().regex(/^[a-f0-9]{64}$/),
});
// A future approved aggregate consent version must first be registered in the existing
// consent machinery. Pin that exact version/digest here; draft acceptances never qualify.
export const FINALIZED_ADMIN_REPORT_TERMS: z.infer<typeof termsSchema> | null = null;
const approvalSchema = z.strictObject({
    runId: z.uuid(), authorityRef: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
    scope: z.literal("admin-count-bands-v1"),
    participantIds: z.array(z.number().int().positive().max(2147483647)).min(1).max(8)
        .refine(ids => new Set(ids).size === ids.length),
    startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), terms: termsSchema,
}).refine(value => {
    const duration = Date.parse(value.endsAt) - Date.parse(value.startsAt);
    return duration > 0 && duration <= 7200000;
});

// Trusted server/operator manifests only, never browser input. Protection evidence is
// independently verified by the operator; runtime identity alone does not attest it.
export function getAdminReportConfiguration() {
    if (!GROQ_ADMIN_REPORT_ENABLED) return null;
    const terms = termsSchema.safeParse(FINALIZED_ADMIN_REPORT_TERMS);
    if (!terms.success || terms.data.version !== AI_TERMS_VERSION || terms.data.digest !== AI_TERMS_DIGEST) return null;
    try {
        if (!isApprovedResearchPreview(process.env, JSON.parse(process.env.GROQ_ADMIN_REPORT_TARGET_JSON ?? "null"))) return null;
        const approval = approvalSchema.safeParse(JSON.parse(process.env.GROQ_ADMIN_REPORT_APPROVAL_JSON ?? "null"));
        if (!approval.success) return null;
        const value = approval.data, now = Date.now();
        return value.terms.version === terms.data.version && value.terms.digest === terms.data.digest &&
            now >= Date.parse(value.startsAt) && now < Date.parse(value.endsAt) ? value : null;
    } catch { return null; }
}
