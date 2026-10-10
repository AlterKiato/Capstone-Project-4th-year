import "server-only";

// No provider implementation: an enabled flag still cannot trigger a network call.
// Age eligibility, privacy terms, cost and owner approval remain pending.
export function getGuideProviderNotice(): string {
    return process.env.AI_GUIDE_ENABLED === "true"
        ? "AI explanations are unavailable pending provider approval. These are verified static system steps."
        : "AI explanations are disabled. These are verified static system steps.";
}
