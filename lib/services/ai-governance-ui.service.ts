import "server-only";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { withAIAccountLocks } from "@/lib/repositories/ai-governance.repository";
import { getVerifierAuthorizationRef } from "@/lib/auth/ai-verifier-config";
import { isInstitutionallyEligible } from "@/lib/auth/adult-eligibility";
import { getAIConsentTerms } from "@/lib/ai/consent-scope";
import { consentScopeSchema } from "@/lib/validations/ai-governance";
import type { EligibilityUI, ConsentUI } from "@/types/ai-governance-ui";
const unavailable: EligibilityUI = { available: false, decision: "Pending Verification", revoked: false, revision: 0, canDecide: false };
export async function getEligibilityUI(input: unknown): Promise<EligibilityUI> {
    try {
        const request = z.strictObject({ userId: z.number().int().positive().max(2147483647) }).safeParse(input);
        const session = await getSession();
        if (!request.success || !session || session.roleId !== 1 || !Number.isSafeInteger(session.userId) || session.userId <= 0) return unavailable;
        return await withAIAccountLocks([session.userId, request.data.userId], async store => {
            const actor = store.accounts.find(a => a.id === session.userId);
            const target = store.accounts.find(a => a.id === request.data.userId);
            if (!actor?.isActive || actor.roleId !== 1 || !target || ![1,2].includes(target.roleId)) return unavailable;
            const event = await store.latestEligibility(target.id);
            const valid = isInstitutionallyEligible(target, event);
            return { available: true, decision: valid ? "Eligible" : event?.decision === "Eligible" ? "Pending Verification" : event?.decision ?? "Pending Verification",
                revoked: event?.revoked ?? false, revision: event?.id ?? 0,
                canDecide: actor.id !== target.id && !!getVerifierAuthorizationRef(actor.id) && isInstitutionallyEligible(actor, await store.latestEligibility(actor.id)) };
        });
    } catch { return unavailable; }
}
export async function getConsentUI(input: unknown = "aggregate"): Promise<ConsentUI> {
    const parsed = consentScopeSchema.safeParse(input);
    const scope = parsed.success ? parsed.data : null;
    const terms = scope ? getAIConsentTerms(scope) : null;
    const fallback: ConsentUI = { available: false, eligible: false, accepted: false, consentRevision: 0,
        termsVersion: terms?.version ?? "Unavailable", termsText: terms?.text ?? "Finalized pilot consent is unavailable." };
    if (!scope) return fallback;
    try {
        const session = await getSession();
        if (!session || ![1,2].includes(session.roleId) || !Number.isSafeInteger(session.userId) || session.userId <= 0) return fallback;
        return await withAIAccountLocks([session.userId], async store => {
            const account = store.accounts[0];
            if (!account?.isActive || account.roleId !== session.roleId) return fallback;
            const event = await store.latestEligibility(account.id), consent = await store.latestConsent(account.id, scope);
            const eligible = !!terms && (scope !== "research-pilot" || account.roleId === 2) && isInstitutionallyEligible(account, event);
            return { ...fallback, available: !!terms, eligible, consentRevision: consent?.id ?? 0,
                accepted: !!terms && !!consent && eligible && consent.eventKind === "accepted" && consent.termsVersion === terms.version && consent.termsDigest === terms.digest && consent.eligibilityEventId === event?.id };
        });
    } catch { return fallback; }
}
