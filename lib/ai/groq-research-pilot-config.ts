import "server-only";
import { researchPilotApprovalSchema, researchPilotTermsSchema, type ResearchPilotTerms, type ResearchPilotApproval } from "@/lib/validations/groq-research-pilot";

// Code checkpoint gates: no environment value can authorize this unfinished pilot.
export const GROQ_RESEARCH_PILOT_ENABLED = false;
export const FINALIZED_RESEARCH_PILOT_TERMS: ResearchPilotTerms | null = null;

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
    // Development, test, CI and Preview never dispatch. Any future target requires separate review.
    try {
        if (process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV !== "production" || process.env.CI) return null;
        return parseResearchPilotApproval(JSON.parse(process.env.GROQ_RESEARCH_PILOT_APPROVAL_JSON ?? "null"), FINALIZED_RESEARCH_PILOT_TERMS);
    } catch { return null; }
}
