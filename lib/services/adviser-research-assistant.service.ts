import "server-only";
import { getCurrentMainAdviser } from "@/lib/auth/main-adviser";
import { getCurrentAccount } from "@/lib/auth/current-account";
import { canAccessResearchDemoSubmission } from "@/lib/repositories/adviser-submission.repository";
import { canAccessResearchDemoAssignment } from "@/lib/repositories/co-adviser.repository";
import { getResearchDemoAnswer, RESEARCH_DEMO_EXCERPT } from "@/lib/ai/adviser-research-demo";
import { researchDemoAnswerSchema, researchDemoRequestSchema, researchDemoScopeSchema, type ResearchDemoResult, type ResearchDemoScope } from "@/lib/validations/adviser-research-assistant";

// Research-purpose availability is independent of every legacy provider/consent flag.
// There is deliberately no live transport, key loader, entitlement or quota-write path.
const liveResearchEnabled = false as const;
const denied = { success: false, mode: "denied", message: "Current Adviser review access to this submission could not be verified. Temporary AI content has been cleared. Reload to verify access." } as const;
async function authorize(scope: ResearchDemoScope, expectedUserId?: number) {
    const actor = await getCurrentAccount();
    if (!actor || actor.roleId !== 2 || (expectedUserId !== undefined && actor.userId !== expectedUserId)) return null;
    const main = await getCurrentMainAdviser(actor.userId);
    const allowed = main ? scope.assignmentId === undefined && await canAccessResearchDemoSubmission(scope.submissionId, actor.userId)
        : scope.assignmentId !== undefined && await canAccessResearchDemoAssignment(actor.userId, scope.assignmentId, scope.submissionId);
    if (!allowed) return null;
    const current = await getCurrentAccount();
    if (!current || current.userId !== actor.userId || current.roleId !== 2) return null;
    const stillMain = await getCurrentMainAdviser(actor.userId);
    return !!main === !!stillMain ? current : null;
}
export async function getResearchDemoAvailability(input: unknown) {
    try {
        const parsed = researchDemoScopeSchema.safeParse(input);
        if (!parsed.success || !await authorize(parsed.data)) return denied;
        return { success: true, mode: "synthetic-only", liveResearchEnabled } as const;
    } catch { return denied; }
}
export async function analyzeResearchDemo(input: unknown): Promise<ResearchDemoResult> {
    try {
        const parsed = researchDemoRequestSchema.safeParse(input);
        if (!parsed.success || Buffer.byteLength(JSON.stringify(parsed.data), "utf8") > 24 * 1024)
            return { success: false, mode: "invalid", message: "Use a supported task, an excerpt up to 6,000 characters, a question up to 1,000 characters and at most four previous exchanges within 24 KiB." };
        const request = parsed.data;
        const actor = await authorize(request);
        if (!actor) return denied;
        const unsupported = { success: false, mode: "unsupported", message: "This demonstration supports only the bundled fictional excerpt and suggested questions. Edited text has not been analyzed or verified as synthetic. Load the fictional example to continue." } as const;
        if (request.excerpt !== RESEARCH_DEMO_EXCERPT) return unsupported;
        for (let index = 0; index < request.history.length; index += 2) {
            const previous = getResearchDemoAnswer(request.task, request.history[index].content);
            if (!previous || request.history[index + 1].content !== JSON.stringify(previous)) return unsupported;
        }
        const prepared = getResearchDemoAnswer(request.task, request.question);
        if (!prepared) return unsupported;
        const answer = researchDemoAnswerSchema.parse(prepared);
        if (!await authorize(request, actor.userId)) return denied;
        return { success: true, mode: "mock", answer };
    } catch {
        return { success: false, mode: "unavailable", message: "The synthetic demonstration is unavailable. No live AI analysis was performed. Reload to verify access before continuing." };
    }
}
