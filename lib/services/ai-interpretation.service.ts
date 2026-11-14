import "server-only";
import { getGroqAvailability } from "@/lib/ai/groq-provider";
import { interpretGroqAggregate, createGroqRESTTransport } from "@/lib/ai/groq-rest";
import { getAdminReportConfiguration } from "@/lib/ai/groq-admin-report-config";
import { loadGroqConfiguration } from "@/lib/ai/groq-key";
import { getAIEntitlement } from "@/lib/auth/ai-entitlement";
import { reserveAIPilotAttempt } from "@/lib/auth/ai-pilot-limits";
import { prepareLocalAdminAggregate, prepareLocalAdviserAggregate } from "@/lib/services/ai-aggregation.service";
import { getLocalAdminAssistance, getLocalAdviserAssistance } from "@/lib/services/ai-foundation.service";
import { adminAIRequestSchema, adviserAIRequestSchema, bandSchema } from "@/lib/validations/ai-foundation";
import type { AdminAIResult, LocalAIResult } from "@/types/ai-foundation";

const adminUnavailable: LocalAIResult = { success: false, mode: "unavailable", message: "Live AI is unavailable. Verified static guidance remains available." };
const adminDenied = { success: false, mode: "denied", message: "Live AI access is not authorized. Verified static guidance remains available." } as const;
// No client aggregate/actor input. Only the Admin path has an independently gated action.
export async function getAdminInterpretation(input: unknown): Promise<AdminAIResult> {
    const result = await interpret(1,input);
    if (result.mode !== "generated") return result;
    try {
        const explanations = result.output.explanations.map(item => ({ ...item, band: bandSchema.parse("band" in item ? item.band : undefined) }));
        return { ...result, output: { ...result.output, explanations }, success: true, message: "AI-generated count-band interpretation. Human review required." };
    } catch { return adminUnavailable; }
}
export async function getAdviserInterpretation(input: unknown) { return interpret(2,input); }
// Availability loads no credential, aggregate or quota. Dispatch rechecks all gates.
export async function getAdminInterpretationAvailability(): Promise<{ available: boolean }> {
    try {
        const approval = getAdminReportConfiguration();
        if (!approval) return { available: false };
        const actor = await getAIEntitlement(1);
        return { available: !!actor && approval.participantIds.includes(actor.accountId) &&
            actor.termsVersion === approval.terms.version && JSON.stringify(getAdminReportConfiguration()) === JSON.stringify(approval) };
    } catch { return { available: false }; }
}
async function interpret(role: 1 | 2, input: unknown) {
    const local = role === 1 ? await getLocalAdminAssistance(input) : await getLocalAdviserAssistance(input);
    const fallback = role === 1 ? adminUnavailable : local;
    const parsed = role === 1 ? adminAIRequestSchema.safeParse(input) : adviserAIRequestSchema.safeParse(input);
    if (!parsed.success || local.mode !== "static") return role === 1 ? adminDenied : fallback;
    const approval = role === 1 ? getAdminReportConfiguration() : null;
    if (role === 1 ? !approval : !getGroqAvailability().enabled) return fallback;
    if (role === 2 && "topicId" in parsed.data && parsed.data.topicId !== "adviser-workflow-overview-v1") return fallback;
    let release: (() => Promise<void> | void) | null = null;
    try {
        const initial = await getAIEntitlement(role);
        if (!initial || (role === 1 && (!approval?.participantIds.includes(initial.accountId) || initial.termsVersion !== approval.terms.version)))
            return role === 1 ? adminDenied : fallback;
        const prepare = role === 1 ? prepareLocalAdminAggregate : prepareLocalAdviserAggregate;
        const aggregate = await prepare();
        if (!aggregate.success || !aggregate.payload || (role === 1 && aggregate.payload.feature !== "admin")) return fallback;
        const sameEntitlement = async () => {
            if (role === 1 && JSON.stringify(getAdminReportConfiguration()) !== JSON.stringify(approval)) return false;
            const current = await getAIEntitlement(role);
            return current && current.accountId === initial.accountId && current.roleId === initial.roleId &&
                current.eligibilityRevision === initial.eligibilityRevision && current.consentRevision === initial.consentRevision && current.termsVersion === initial.termsVersion;
        };
        if (!await sameEntitlement()) return fallback;
        // Preparation scopes Adviser SQL to the current Main's institutional supervision and applies k=5/complements.
        const currentScope = await prepare();
        if (!currentScope.success || JSON.stringify(currentScope.payload) !== JSON.stringify(aggregate.payload)) return fallback;
        release = await reserveAIPilotAttempt(initial.accountId, approval ? { startsAt: new Date(approval.startsAt), endsAt: new Date(approval.endsAt) } : undefined);
        if (!release) return fallback;
        if (!await sameEntitlement()) return fallback;
        const configuration = role === 1 ? loadGroqConfiguration("admin-report") : null;
        if (role === 1 && !configuration) return fallback;
        const result = role === 1 ? await createGroqRESTTransport(fetch)(aggregate.payload, configuration) : await interpretGroqAggregate(aggregate.payload);
        if (result.mode !== "generated" || !await sameEntitlement()) return fallback;
        const deliveryScope = await prepare();
        if (!deliveryScope.success || JSON.stringify(deliveryScope.payload) !== JSON.stringify(aggregate.payload) ||
            (role === 1 && !await sameEntitlement())) return fallback;
        return result;
    } catch { return fallback; }
    finally { try { await release?.(); } catch { /* Failed releases stay blocked; no payload/error logging. */ } }
}
