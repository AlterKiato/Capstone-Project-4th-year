import "server-only";
import { getSession } from "@/lib/auth/session";
import { getVerifierAuthorizationRef } from "@/lib/auth/ai-verifier-config";
import { isInstitutionallyEligible } from "@/lib/auth/adult-eligibility";
import { withAIAccountLocks } from "@/lib/repositories/ai-governance.repository";
import { eligibilityDecisionSchema, consentRequestSchema } from "@/lib/validations/ai-governance";
import { AI_TERMS_VERSION, AI_TERMS_DIGEST } from "@/lib/ai/consent-terms";
const denied = { success: false, message: "AI authorization update unavailable." } as const;
const saved = { success: true, message: "AI authorization preference recorded. Provider remains disabled." } as const;

export async function recordAIEligibility(input: unknown) {
    try {
        const parsed = eligibilityDecisionSchema.safeParse(input);
        const session = await getSession();
        if (!parsed.success || !session || session.roleId !== 1 || !Number.isSafeInteger(session.userId) || session.userId <= 0) return denied;
        const request = parsed.data, actorId = session.userId;
        const authorizationRef = getVerifierAuthorizationRef(actorId);
        if (!authorizationRef || request.userId === actorId) return denied;
        return await withAIAccountLocks([actorId, request.userId], async store => {
            const actor = store.accounts.find(account => account.id === actorId);
            const target = store.accounts.find(account => account.id === request.userId);
            if (!actor?.isActive || actor.roleId !== 1 || !target || getVerifierAuthorizationRef(actorId) !== authorizationRef) return denied;
            if (!isInstitutionallyEligible(actor, await store.latestEligibility(actorId))) return denied;
            const current = await store.latestEligibility(target.id);
            if ((current?.id ?? 0) !== request.expectedRevision) return denied;
            if (!request.revoke && request.decision !== "Pending Verification" &&
                (![1,2].includes(target.roleId) || (request.decision === "Eligible" && !target.isActive))) return denied;
            await store.appendEligibility({
                userId: target.id, decision: request.decision,
                eventKind: request.revoke ? "revocation" : request.decision === "Pending Verification" ? "reset" : "certification",
                decisionRoleId: [1,2].includes(target.roleId) ? target.roleId : null,
                accountUpdatedAt: target.updatedAt, verifierUserId: actorId,
                verifierAuthorizationRef: authorizationRef, revoked: request.revoke,
            });
            // Recertification/reset/revocation invalidates old consent atomically, preserving history.
            const consent = await store.latestConsent(target.id);
            if (consent?.eventKind === "accepted") await store.appendConsent({
                userId: target.id, eligibilityEventId: consent.eligibilityEventId,
                termsVersion: consent.termsVersion, termsDigest: consent.termsDigest, eventKind: "withdrawn",
            });
            return saved;
        });
    } catch { return denied; }
}

export async function recordAIConsent(input: unknown) {
    try {
        const parsed = consentRequestSchema.safeParse(input), session = await getSession();
        if (!parsed.success || !session || !Number.isSafeInteger(session.userId) || session.userId <= 0) return denied;
        const request = parsed.data;
        return await withAIAccountLocks([session.userId], async store => {
            const account = store.accounts.find(item => item.id === session.userId);
            if (!account?.isActive || account.roleId !== session.roleId) return denied;
            const previous = await store.latestConsent(account.id);
            if ((previous?.id ?? 0) !== request.expectedRevision) return denied;
            if (request.action === "withdraw") {
                // Withdrawal is allowed after role/eligibility loss and never requires provider entitlement.
                if (!previous || previous.eventKind === "withdrawn") return saved;
                await store.appendConsent({ userId: account.id, eligibilityEventId: previous.eligibilityEventId,
                    termsVersion: previous.termsVersion, termsDigest: previous.termsDigest, eventKind: "withdrawn" });
                return saved;
            }
            if (![1,2].includes(account.roleId) || request.termsVersion !== AI_TERMS_VERSION) return denied;
            const eligibility = await store.latestEligibility(account.id);
            if (request.action === "accept" && !isInstitutionallyEligible(account, eligibility)) return denied;
            await store.appendConsent({ userId: account.id, eligibilityEventId: request.action === "accept" ? eligibility!.id : null,
                termsVersion: AI_TERMS_VERSION, termsDigest: AI_TERMS_DIGEST,
                eventKind: request.action === "accept" ? "accepted" : "declined" });
            return saved;
        });
    } catch { return denied; }
}
