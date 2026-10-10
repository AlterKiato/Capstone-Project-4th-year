import "server-only";
import { getSession } from "@/lib/auth/session";
import { withAIAccountLocks } from "@/lib/repositories/ai-governance.repository";
import { isInstitutionallyEligible } from "@/lib/auth/adult-eligibility";
import { AI_TERMS_VERSION, AI_TERMS_DIGEST } from "@/lib/ai/consent-terms";
import { getGroqAvailability } from "@/lib/ai/groq-provider";
import type { AuthTokenPayload } from "@/types/auth";

// Internal authorization only. Never return revisions/identity to the provider/client.
export async function getAIEntitlement(expectedRole: 1 | 2) {
    try { return await entitlementForSession(await getSession(), expectedRole); }
    catch { return null; }
}

// CLI identity must be cryptographically verified, never a supplied account/role assertion.
export async function getCLIAIEntitlement(expectedRole: 1 | 2) {
    try {
        const token = process.env.THESISHS_AI_PILOT_SESSION_TOKEN;
        if (!token || token.length > 8192 || !/^[A-Za-z0-9_.-]+$/.test(token)) return null;
        const { verifyToken } = await import("@/lib/auth/jwt");
        return await entitlementForSession(await verifyToken(token), expectedRole);
    } catch { return null; }
}

async function entitlementForSession(session: AuthTokenPayload | null, expectedRole: 1 | 2) {
    try {
        if (!session || session.roleId !== expectedRole || !Number.isSafeInteger(session.userId) || session.userId <= 0) return null;
        return await withAIAccountLocks([session.userId], async store => {
            const account = store.accounts.find(item => item.id === session.userId);
            if (!account?.isActive || account.roleId !== expectedRole) return null;
            const eligibility = await store.latestEligibility(account.id);
            if (!isInstitutionallyEligible(account, eligibility)) return null;
            const consent = await store.latestConsent(account.id);
            if (!consent || consent.eventKind !== "accepted" || consent.termsVersion !== AI_TERMS_VERSION ||
                consent.termsDigest !== AI_TERMS_DIGEST || consent.eligibilityEventId !== eligibility!.id) return null;
            return { accountId: account.id, roleId: expectedRole, eligibilityRevision: eligibility!.id,
                consentRevision: consent.id, termsVersion: AI_TERMS_VERSION };
        });
    } catch { return null; }
}
export async function getAIProviderAccount(expectedRole: 1 | 2): Promise<number | null> {
    const entitlement = await getAIEntitlement(expectedRole);
    // Even a valid institutional decision AND consent cannot enable a provider.
    return entitlement && getGroqAvailability().enabled ? entitlement.accountId : null;
}
