import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { researchPilotApprovalSchema, researchPilotTermsSchema, type ResearchPilotTerms, type ResearchPilotApproval } from "@/lib/validations/groq-research-pilot";

// Code checkpoint gates: no environment value can authorize this unfinished pilot.
export const GROQ_RESEARCH_PILOT_ENABLED = false;
export const FINALIZED_RESEARCH_PILOT_TERMS: ResearchPilotTerms | null = null;
// Approved exact text must accompany the immutable version/digest at a future checkpoint.
export const FINALIZED_RESEARCH_PILOT_TEXT: string | null = null;
const targetSchema = z.strictObject({
    projectId: z.string().regex(/^prj_[A-Za-z0-9]+$/), deploymentId: z.string().regex(/^dpl_[A-Za-z0-9]+$/),
    commitSha: z.string().regex(/^[a-f0-9]{40}$/), branch: z.literal("feature/development"),
    protectionEvidenceRef: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
});
// Server-only operator manifest; no browser headers or Preview label can supply approval.
export function isApprovedResearchPreview(env: Record<string, string | undefined>, input: unknown): boolean {
    const target = targetSchema.safeParse(input);
    if (!target.success || env.NODE_ENV !== "production" || env.VERCEL !== "1" || env.VERCEL_ENV !== "preview" || env.CI ||
        env.VERCEL_TARGET_ENV !== "preview") return false;
    return env.VERCEL_PROJECT_ID === target.data.projectId && env.VERCEL_DEPLOYMENT_ID === target.data.deploymentId &&
        env.VERCEL_GIT_COMMIT_SHA === target.data.commitSha && env.VERCEL_GIT_COMMIT_REF === target.data.branch;
}
export function getFinalizedResearchPilotTerms() {
    const terms = researchPilotTermsSchema.safeParse(FINALIZED_RESEARCH_PILOT_TERMS);
    if (!terms.success || !FINALIZED_RESEARCH_PILOT_TEXT ||
        createHash("sha256").update(FINALIZED_RESEARCH_PILOT_TEXT, "utf8").digest("hex") !== terms.data.digest) return null;
    return { ...terms.data, text: FINALIZED_RESEARCH_PILOT_TEXT };
}

// Trusted operator input only; this validator is not evidence of institutional approval.
export function parseResearchPilotApproval(input: unknown, terms: unknown, now = Date.now()): ResearchPilotApproval | null {
    const required = researchPilotTermsSchema.safeParse(terms), approval = researchPilotApprovalSchema.safeParse(input);
    if (!required.success || !approval.success || !Number.isFinite(now)) return null;
    const value = approval.data;
    return value.terms.version === required.data.version && value.terms.digest === required.data.digest &&
        now >= Date.parse(value.startsAt) && now < Date.parse(value.endsAt) ? value : null;
}
export function getResearchPilotConfiguration(): ResearchPilotApproval | null {
    if (!GROQ_RESEARCH_PILOT_ENABLED || !FINALIZED_RESEARCH_PILOT_TERMS) return null;
    // The target manifest requires independently verified Deployment Protection evidence.
    // Matching identity is not a runtime attestation that Protection is still enabled.
    try {
        if (!getFinalizedResearchPilotTerms() || !isApprovedResearchPreview(process.env,
            JSON.parse(process.env.GROQ_RESEARCH_PILOT_TARGET_JSON ?? "null"))) return null;
        return parseResearchPilotApproval(JSON.parse(process.env.GROQ_RESEARCH_PILOT_APPROVAL_JSON ?? "null"), FINALIZED_RESEARCH_PILOT_TERMS);
    } catch { return null; }
}
