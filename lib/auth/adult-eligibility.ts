import "server-only";
import type { AIAccount, EligibilityEvent } from "@/lib/repositories/ai-governance.repository";

// The legacy no-account probe stays fail-closed. A role/JWT/assertion never grants eligibility.
export function getAdultAIEligibility(): { eligible: false; reason: "registry-unapproved" } {
    return { eligible: false, reason: "registry-unapproved" };
}
// Only trusted repository records may be supplied here. No automatic expiry.
export function isInstitutionallyEligible(account: AIAccount, event: EligibilityEvent | null): boolean {
    if (!account.isActive || ![1,2].includes(account.roleId) || !event || event.userId !== account.id ||
        event.decision !== "Eligible" || event.revoked || event.decisionRoleId !== account.roleId ||
        !event.accountUpdatedAt || event.accountUpdatedAt.getTime() !== account.updatedAt.getTime()) return false;
    return event.eventKind === "bootstrap"
        ? account.roleId === 1 && event.verifierUserId === null && !!event.externalAuthorityRef
        : event.eventKind === "certification" && event.verifierUserId !== null &&
            event.verifierUserId !== account.id && !!event.verifierAuthorizationRef;
}
