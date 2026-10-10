import "server-only";
import { getGroqAvailability } from "@/lib/ai/groq-provider";
import { interpretGroqAggregate } from "@/lib/ai/groq-rest";
import { getAIEntitlement } from "@/lib/auth/ai-entitlement";
import { reserveAIPilotAttempt } from "@/lib/auth/ai-pilot-limits";
import { prepareLocalAdminAggregate, prepareLocalAdviserAggregate } from "@/lib/services/ai-aggregation.service";
import { getLocalAdminAssistance, getLocalAdviserAssistance } from "@/lib/services/ai-foundation.service";
import { adminAIRequestSchema, adviserAIRequestSchema } from "@/lib/validations/ai-foundation";

// Internal only: existing UI/actions remain entirely static. No client aggregate/actor input.
export async function getAdminInterpretation(input: unknown) { return interpret(1,input); }
export async function getAdviserInterpretation(input: unknown) { return interpret(2,input); }
async function interpret(role: 1 | 2, input: unknown) {
    const fallback = role === 1 ? await getLocalAdminAssistance(input) : await getLocalAdviserAssistance(input);
    const parsed = role === 1 ? adminAIRequestSchema.safeParse(input) : adviserAIRequestSchema.safeParse(input);
    if (!parsed.success || fallback.mode !== "static" || !getGroqAvailability().enabled) return fallback;
    if (role === 2 && "topicId" in parsed.data && parsed.data.topicId !== "adviser-workflow-overview-v1") return fallback;
    let release: (() => Promise<void> | void) | null = null;
    try {
        const initial = await getAIEntitlement(role); if (!initial) return fallback;
        const prepare = role === 1 ? prepareLocalAdminAggregate : prepareLocalAdviserAggregate;
        const aggregate = await prepare(); if (!aggregate.success || !aggregate.payload) return fallback;
        const sameEntitlement = async () => {
            const current = await getAIEntitlement(role);
            return current && current.accountId === initial.accountId && current.roleId === initial.roleId &&
                current.eligibilityRevision === initial.eligibilityRevision && current.consentRevision === initial.consentRevision && current.termsVersion === initial.termsVersion;
        };
        if (!await sameEntitlement()) return fallback;
        // Preparation scopes Adviser SQL to the session's current owned groups and applies k=5/complements.
        const currentScope = await prepare();
        if (!currentScope.success || JSON.stringify(currentScope.payload) !== JSON.stringify(aggregate.payload)) return fallback;
        release = await reserveAIPilotAttempt(initial.accountId); if (!release) return fallback;
        if (!await sameEntitlement()) return fallback;
        const result = await interpretGroqAggregate(aggregate.payload);
        if (result.mode !== "generated" || !await sameEntitlement()) return fallback;
        const deliveryScope = await prepare();
        if (!deliveryScope.success || JSON.stringify(deliveryScope.payload) !== JSON.stringify(aggregate.payload)) return fallback;
        return result;
    } catch { return fallback; }
    finally { await release?.(); }
}
