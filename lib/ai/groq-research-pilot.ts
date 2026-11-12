import "server-only";
import { GROQ_ENDPOINT, GROQ_MODEL, wireSchema, configurationSchema, readBounded, scheduleTimer } from "@/lib/ai/groq-rest";
import { RESEARCH_DEMO_EXCERPT, RESEARCH_DEMO_QUESTIONS, RESEARCH_DEMO_FOLLOWUPS } from "@/lib/ai/adviser-research-demo";
import { researchPilotRequestSchema, researchPilotOutputSchema, RESEARCH_PILOT_LABEL } from "@/lib/validations/groq-research-pilot";

export const researchPilotFallback = { success: false, mode: "unavailable", message: "Live research assistance is unavailable. The separate synthetic demonstration remains available; no live answer is shown." } as const;
export const RESEARCH_PILOT_BUDGET = Object.freeze({ requestBytes: 4096, inputTokens: 2048, framingTokens: 256, completionTokens: 1024 });
const instructions = "Provide bounded academic assistance for the supplied FICTIONAL example only. Task writing: explain clearer academic wording. Task consistency: explain alignment of objective, question and method. Task methodology: explain methodological options and limitations. Answer the supplied reviewed question using only this example; each request is independent. Do not infer real people, manuscripts or prior conversation. No grading, approval/rejection, official feedback, tools, browsing, citations, URLs, HTML or reasoning text. Return only observation, explanation and suggestion as short plain-text JSON strings. Human review is required.";
const outputSchema = {
    type: "object", additionalProperties: false, required: ["observation", "explanation", "suggestion"],
    properties: { observation: { type: "string" }, explanation: { type: "string" }, suggestion: { type: "string" } },
};
// Byte-per-token upper bound for this fixed text corpus, plus conservative message framing.
// This is deliberately stricter than character/serialized-request limits; no client text is tokenized.
export function researchPilotInputWithinBudget(messages: unknown) {
    return Buffer.byteLength(JSON.stringify(messages), "utf8") + RESEARCH_PILOT_BUDGET.framingTokens <= RESEARCH_PILOT_BUDGET.inputTokens;
}
export function prepareResearchPilotBody(input: unknown) {
    const parsed = researchPilotRequestSchema.safeParse(input);
    if (!parsed.success || Buffer.byteLength(JSON.stringify(parsed.data), "utf8") > 512) return null;
    const { task, questionId } = parsed.data;
    const question = questionId === "primary" ? RESEARCH_DEMO_QUESTIONS[task]
        : RESEARCH_DEMO_FOLLOWUPS[questionId === "explain-improvement" ? 0 : 1];
    const messages = [{ role: "system", content: instructions },
        { role: "user", content: JSON.stringify({ task, excerpt: RESEARCH_DEMO_EXCERPT, question }) }];
    if (!researchPilotInputWithinBudget(messages)) return null;
    const body = JSON.stringify({ model: GROQ_MODEL, messages,
        response_format: { type: "json_schema", json_schema: { name: "fictional_research_assistance", strict: true, schema: outputSchema } },
        reasoning_effort: "low", max_completion_tokens: RESEARCH_PILOT_BUDGET.completionTokens, stream: false });
    return Buffer.byteLength(body, "utf8") <= RESEARCH_PILOT_BUDGET.requestBytes ? { body, task } : null;
}

// Explicit transport injection only. The service owns authorization, keys and quota reservation.
export function createGroqResearchPilotTransport(transport: typeof fetch, schedule = scheduleTimer) {
    return async (input: unknown, configuration: unknown) => {
        const controller = new AbortController(); let cancel = () => {};
        try {
            const prepared = prepareResearchPilotBody(input), config = configurationSchema.safeParse(configuration);
            if (!prepared || !config.success) return researchPilotFallback;
            const deadline = new Promise<never>((_, reject) => {
                cancel = schedule(10000, () => { controller.abort(); reject(new Error("timeout")); });
            });
            return await Promise.race([(async () => {
                const response = await transport(GROQ_ENDPOINT, { method: "POST", headers: {
                    "Content-Type": "application/json", Authorization: `Bearer ${config.data.token}`,
                }, body: prepared.body, redirect: "error", cache: "no-store", signal: controller.signal });
                if (response.status !== 200 || response.redirected || (response.url && response.url !== GROQ_ENDPOINT) ||
                    !response.headers.get("content-type")?.startsWith("application/json")) return researchPilotFallback;
                if (controller.signal.aborted) { await response.body?.cancel(); return researchPilotFallback; }
                const wire = wireSchema.parse(JSON.parse(await readBounded(response, controller.signal)));
                const output = researchPilotOutputSchema.parse(JSON.parse(wire.choices[0].message.content));
                if (JSON.stringify(output).includes(config.data.token)) return researchPilotFallback;
                return { success: true, mode: "generated", answer: { ...output, task: prepared.task, label: RESEARCH_PILOT_LABEL,
                    limitation: "Fictional material only. AI may be inaccurate. This is not official feedback or an academic decision." } } as const;
            })(), deadline]);
        } catch { return researchPilotFallback; }
        finally { cancel(); controller.abort(); }
    };
}
