import "server-only";
import { getLocalPilotApproval } from "@/lib/ai/groq-pilot-config";
import { loadGroqConfiguration } from "@/lib/ai/groq-key";
import { createGroqRESTTransport, groqFallback } from "@/lib/ai/groq-rest";
import { getSyntheticPilotPayload } from "@/lib/ai/pilot-fixtures";
import { getCLIAIEntitlement } from "@/lib/auth/ai-entitlement";
import { reserveAIPilotAttempt } from "@/lib/auth/ai-pilot-limits";
import { AI_TERMS_VERSION, AI_TERMS_DIGEST } from "@/lib/ai/consent-terms";
import { pilotRequestSchema } from "@/lib/validations/ai-pilot";
import { minimizedAIDtoSchema } from "@/lib/validations/ai-foundation";

export async function runSyntheticGroqPilot(input: unknown) {
    let release: (() => Promise<void>) | null = null;
    try {
        const request = pilotRequestSchema.safeParse(input), approval = getLocalPilotApproval();
        if (!request.success || !approval || /draft|foundation/i.test(AI_TERMS_VERSION) ||
            approval.termsVersion !== AI_TERMS_VERSION || approval.termsDigest !== AI_TERMS_DIGEST) return groqFallback;
        const role = request.data.topicId === "admin-overview-v1" ? 1 : 2;
        const initial = await getCLIAIEntitlement(role);
        if (!initial || initial.roleId !== role || initial.termsVersion !== AI_TERMS_VERSION ||
            initial.accountId !== (role === 1 ? approval.adminUserId : approval.adviserUserId)) return groqFallback;
        const prepared = getSyntheticPilotPayload(request.data.topicId);
        if (!prepared) return groqFallback;
        const payload = minimizedAIDtoSchema.parse(prepared);
        if (!Object.values(payload.metrics).some(value => value !== undefined)) return groqFallback;
        if (payload.topicId !== request.data.topicId || payload.feature !== (role === 1 ? "admin" : "adviser")) return groqFallback;
        const configuration = loadGroqConfiguration("local-pilot"); if (!configuration) return groqFallback;
        const unchanged = async () => {
            const current = await getCLIAIEntitlement(role);
            return JSON.stringify(getLocalPilotApproval()) === JSON.stringify(approval) && current &&
                current.accountId === initial.accountId && current.roleId === initial.roleId &&
                current.eligibilityRevision === initial.eligibilityRevision && current.consentRevision === initial.consentRevision;
        };
        release = await reserveAIPilotAttempt(initial.accountId, {startsAt:new Date(approval.startsAt),endsAt:new Date(approval.endsAt)});
        if (!release || !await unchanged()) return groqFallback;
        const result = await createGroqRESTTransport(fetch)(payload, configuration);
        return await unchanged() ? result : groqFallback;
    } catch { return groqFallback; }
    finally { await release?.(); }
}
