import "server-only";
import { getResearchPilotConfiguration } from "@/lib/ai/groq-research-pilot-config";
import { createGroqResearchPilotTransport, prepareResearchPilotBody, researchPilotFallback } from "@/lib/ai/groq-research-pilot";
import { loadGroqConfiguration } from "@/lib/ai/groq-key";
import { getResearchPilotEntitlement } from "@/lib/auth/ai-entitlement";
import { getCurrentAccount } from "@/lib/auth/current-account";
import { getCurrentMainAdviser } from "@/lib/auth/main-adviser";
import { canAccessResearchDemoSubmission } from "@/lib/repositories/adviser-submission.repository";
import { canAccessResearchDemoAssignment } from "@/lib/repositories/co-adviser.repository";
import { reserveAIPilotAttempt } from "@/lib/auth/ai-pilot-limits";
import { researchPilotRequestSchema, type ResearchPilotRequest, type ResearchPilotApproval } from "@/lib/validations/groq-research-pilot";

async function authorize(request: ResearchPilotRequest, approval: ResearchPilotApproval) {
    const actor = await getCurrentAccount();
    if (!actor || actor.roleId !== 2 || !approval.participantIds.includes(actor.userId)) return null;
    const entitlement = await getResearchPilotEntitlement(approval.terms);
    if (!entitlement || entitlement.accountId !== actor.userId || entitlement.roleId !== 2) return null;
    const main = await getCurrentMainAdviser(actor.userId);
    const allowed = main ? request.assignmentId === undefined && await canAccessResearchDemoSubmission(request.submissionId, actor.userId)
        : request.assignmentId !== undefined && await canAccessResearchDemoAssignment(actor.userId, request.assignmentId, request.submissionId);
    if (!allowed) return null;
    const current = await getCurrentAccount();
    if (!current || current.userId !== actor.userId || current.roleId !== 2 ||
        !!await getCurrentMainAdviser(actor.userId) !== !!main) return null;
    return { ...entitlement, main: !!main };
}
export async function runGroqResearchPilot(input: unknown) {
    let release: (() => Promise<void>) | null = null;
    try {
        const approval = getResearchPilotConfiguration();
        if (!approval) return researchPilotFallback;
        const parsed = researchPilotRequestSchema.safeParse(input);
        if (!parsed.success || !prepareResearchPilotBody(parsed.data)) return researchPilotFallback;
        const initial = await authorize(parsed.data, approval);
        if (!initial) return researchPilotFallback;
        const unchanged = async () => {
            if (JSON.stringify(getResearchPilotConfiguration()) !== JSON.stringify(approval)) return false;
            const current = await authorize(parsed.data, approval);
            return current !== null && JSON.stringify(current) === JSON.stringify(initial) &&
                JSON.stringify(getResearchPilotConfiguration()) === JSON.stringify(approval);
        };
        const configuration = loadGroqConfiguration("research-pilot");
        if (!configuration) return researchPilotFallback;
        release = await reserveAIPilotAttempt(initial.accountId, { startsAt: new Date(approval.startsAt), endsAt: new Date(approval.endsAt) });
        // The reservation owns the quota slot through delivery; never reserve a second attempt for the response.
        if (!release || !await unchanged()) return researchPilotFallback;
        const result = await createGroqResearchPilotTransport(fetch)(parsed.data, configuration);
        return result.success && await unchanged() ? result : researchPilotFallback;
    } catch { return researchPilotFallback; }
    finally { try { await release?.(); } catch { /* Keep a failed release blocked; no payload/error logging. */ } }
}
