import "server-only";
import { headers } from "next/headers";
import { getDeveloperEvaluationConfiguration } from "@/lib/ai/developer-evaluation-config";
import { getCurrentAccount } from "@/lib/auth/current-account";
import { getCurrentMainAdviser } from "@/lib/auth/main-adviser";
import { canAccessResearchDemoSubmission } from "@/lib/repositories/adviser-submission.repository";
import { canAccessResearchDemoAssignment } from "@/lib/repositories/co-adviser.repository";
import { reserveAIPilotAttempt } from "@/lib/auth/ai-pilot-limits";
import { getPilotDailyUsage } from "@/lib/repositories/ai-pilot-quota.repository";
import { createGroqResearchPilotTransport } from "@/lib/ai/groq-research-pilot";
import { configurationSchema, createGroqRESTTransport } from "@/lib/ai/groq-rest";
import { getSyntheticPilotPayload } from "@/lib/ai/pilot-fixtures";
import { bandSchema } from "@/lib/validations/ai-foundation";
import { developerEvaluationRequestSchema, type DeveloperEvaluationRequest } from "@/lib/validations/developer-ai-evaluation";

const unavailable: { mode: "unavailable"; message: string } = {
    mode: "unavailable", message: "AI evaluation unavailable or request limit reached. No generated answer is shown. No automatic retry; Demo/static guidance remains separate.",
};
type Configuration = NonNullable<ReturnType<typeof getDeveloperEvaluationConfiguration>>;

async function authorize(request: DeveloperEvaluationRequest, config: Configuration) {
    // Next also enforces same-origin Server Actions. Missing Origin is explicitly denied here.
    const incoming = await headers();
    if (incoming.get("origin") !== config.origin ||
        (incoming.get("sec-fetch-site") && incoming.get("sec-fetch-site") !== "same-origin")) return null;
    const actor = await getCurrentAccount();
    const expectedRole = request.feature === "admin" ? 1 : 2;
    if (!actor || actor.roleId !== expectedRole || !config.allowedUserIds.includes(actor.userId)) return null;
    let main = false;
    if (request.feature === "adviser") {
        main = !!await getCurrentMainAdviser(actor.userId);
        const allowed = main ? request.assignmentId === undefined && await canAccessResearchDemoSubmission(request.submissionId, actor.userId)
            : request.assignmentId !== undefined && await canAccessResearchDemoAssignment(actor.userId, request.assignmentId, request.submissionId);
        if (!allowed) return null;
    }
    return { userId: actor.userId, roleId: actor.roleId, main };
}

export async function getDeveloperEvaluationAvailability(input: unknown) {
    try {
        const config = getDeveloperEvaluationConfiguration(), parsed = developerEvaluationRequestSchema.safeParse(input);
        if (!config || !parsed.success) return { available: false } as const;
        const actor = await authorize(parsed.data, config);
        if (!actor) return { available: false } as const;
        let budget: Awaited<ReturnType<typeof getPilotDailyUsage>> | null = null;
        let message: string | null = null;
        if (!configurationSchema.safeParse({ token: process.env.GROQ_API_KEY }).success)
            message = "Groq configuration is unavailable. Generate is disabled.";
        else {
            try { budget = await getPilotDailyUsage(actor.userId); }
            catch { message = "Request budget is unavailable. Generate is disabled."; }
        }
        if (JSON.stringify(config) !== JSON.stringify(getDeveloperEvaluationConfiguration()) ||
            JSON.stringify(actor) !== JSON.stringify(await authorize(parsed.data, config))) return { available: false } as const;
        const syntheticBands = parsed.data.feature === "admin" ? getSyntheticPilotPayload("admin-overview-v1")?.metrics : undefined;
        return { available: true, budget, message, syntheticBands } as const;
    } catch { return { available: false } as const; }
}

export async function runDeveloperEvaluation(input: unknown) {
    let release: (() => Promise<void>) | null = null;
    try {
        const config = getDeveloperEvaluationConfiguration(), parsed = developerEvaluationRequestSchema.safeParse(input);
        if (!config || !parsed.success) return unavailable;
        const request = parsed.data, actor = await authorize(request, config);
        if (!actor) return unavailable;
        const unchanged = async () => JSON.stringify(config) === JSON.stringify(getDeveloperEvaluationConfiguration()) &&
            JSON.stringify(actor) === JSON.stringify(await authorize(request, config)) &&
            JSON.stringify(config) === JSON.stringify(getDeveloperEvaluationConfiguration());
        const key = configurationSchema.safeParse({ token: process.env.GROQ_API_KEY });
        if (!key.success) return unavailable;
        // Existing PostgreSQL reservation owns the global slot through response delivery.
        release = await reserveAIPilotAttempt(actor.userId);
        if (!release || !await unchanged()) return unavailable;
        const result = request.feature === "adviser"
            ? await createGroqResearchPilotTransport(fetch)({ submissionId: request.submissionId,
                fixtureId: "bundled-fictional-v1", task: "writing", questionId: request.questionId }, key.data)
            : await createGroqRESTTransport(fetch)(getSyntheticPilotPayload("admin-overview-v1"), key.data);
        if (!await unchanged() || result.mode !== "generated" || JSON.stringify(result).includes(key.data.token)) return unavailable;
        if ("answer" in result) return { mode: "generated", feature: "adviser", answer: result.answer } as const;
        const explanations = result.output.explanations.map(item => ({ ...item,
            band: bandSchema.parse("band" in item ? item.band : undefined) }));
        return { mode: "generated", feature: "admin", output: { ...result.output, explanations } } as const;
    } catch { return unavailable; }
    finally { try { await release?.(); } catch { /* Leave failed release blocked. Never log payloads/errors. */ } }
}
export type DeveloperEvaluationResult = Awaited<ReturnType<typeof runDeveloperEvaluation>>;
