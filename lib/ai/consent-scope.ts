import "server-only";
import { AI_TERMS_VERSION, AI_TERMS_TEXT, AI_TERMS_DIGEST } from "./consent-terms";
import { getFinalizedResearchPilotTerms } from "./groq-research-pilot-config";
export type AIConsentScope = "aggregate" | "research-pilot";
export function getAIConsentTerms(scope: AIConsentScope) {
    if (scope === "research-pilot") return getFinalizedResearchPilotTerms();
    return { version: AI_TERMS_VERSION, digest: AI_TERMS_DIGEST, text: AI_TERMS_TEXT };
}
