import "server-only";
import { getActiveAIAccount } from "@/lib/auth/ai-authorization";
import { getGroqAvailability } from "@/lib/ai/groq-provider";
import { adminAIRequestSchema, adviserAIRequestSchema } from "@/lib/validations/ai-foundation";
import type { LocalAIResult } from "@/types/ai-foundation";

const unavailable: LocalAIResult = { success: false, mode: "unavailable", message: "Local assistance is unavailable. Please contact your Admin for access assistance." };
const unsupported: LocalAIResult = { success: false, mode: "unsupported", message: "Choose a supported question for your role." };
const adminGuidance = "Reports count all accounts and groups, research papers by their project status, and eligible published papers. Publication requires an Approved paper and approved submission. Counts are separate live reads, not a historical snapshot. Recent activity includes only the latest five recorded actions. No trends, rankings or academic decisions are inferred.";
const adviserGuidance = {
    "adviser-workflow-overview-v1": "Recorded submission versions include all versions from your currently owned groups, including archived groups. Submitted and Under Review describe submission versions, not distinct papers or the latest-paper backlog. Small cohorts receive static guidance only. The assistant cannot prioritize Students or make academic decisions.",
    "adviser-start-review-v1": "Open Review Submissions and select a Submitted version from one of your own groups. Use the existing Start review control to change that submission to Under Review. This assistant cannot start a review or open documents.",
    "adviser-record-decision-v1": "Open your group's Under Review submission and enter your own feedback with Revision Required or Approved using the existing form. Feedback belongs to that specific version. The assistant cannot generate official feedback, recommend decisions or grade research.",
    "adviser-revision-history-v1": "Previous submission versions and version-specific feedback are preserved. A Student may submit the next version only after the latest version is Revision Required. Adviser approval and Admin repository publication are separate operations.",
} as const;

function staticResult(guidance: string, overview: boolean): LocalAIResult {
    const provider = getGroqAvailability();
    // No aggregation/provider call can follow this gate. Neither environment flags nor client claims enable it.
    const message = overview && !provider.enabled
        ? "AI interpretation is disabled. Verified static guidance is available."
        : "Verified static procedural guidance. No AI provider is used.";
    return { success: true, mode: "static", message, guidance };
}
export async function getLocalAdminAssistance(input: unknown): Promise<LocalAIResult> {
    try {
        if (!await getActiveAIAccount(1)) return unavailable;
        if (!adminAIRequestSchema.safeParse(input).success) return unsupported;
        return staticResult(adminGuidance, true);
    } catch { return unavailable; }
}
export async function getLocalAdviserAssistance(input: unknown): Promise<LocalAIResult> {
    try {
        if (!await getActiveAIAccount(2)) return unavailable;
        const parsed = adviserAIRequestSchema.safeParse(input);
        if (!parsed.success) return unsupported;
        return staticResult(adviserGuidance[parsed.data.topicId], parsed.data.topicId === "adviser-workflow-overview-v1");
    } catch { return unavailable; }
}
