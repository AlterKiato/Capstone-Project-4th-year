"use server";
import { recordAIEligibility, recordAIConsent } from "@/lib/services/ai-governance.service";
export async function recordAIEligibilityAction(input: unknown) { return recordAIEligibility(input); }
export async function recordAIConsentAction(input: unknown) { return recordAIConsent(input); }

export async function getEligibilityUIAction(input: unknown) {
    const { getEligibilityUI } = await import("@/lib/services/ai-governance-ui.service");
    return getEligibilityUI(input);
}
export async function getConsentUIAction() {
    const { getConsentUI } = await import("@/lib/services/ai-governance-ui.service");
    return getConsentUI();
}
