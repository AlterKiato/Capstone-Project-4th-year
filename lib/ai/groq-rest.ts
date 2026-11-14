import "server-only";
import { z } from "zod";
import { bandSchema, minimizedAIDtoSchema, type MinimizedAIDto } from "@/lib/validations/ai-foundation";
import { getGroqAvailability } from "@/lib/ai/groq-provider";
import { loadGroqConfiguration } from "@/lib/ai/groq-key";
export const GROQ_MODEL = "openai/gpt-oss-20b";
export const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const requestSchema = minimizedAIDtoSchema.refine(dto => Object.values(dto.metrics).some(value => value !== undefined));
const plain = (max: number) => z.string().min(1).max(max).refine(value => !/[<>]|https?:|www\.|\]\(|javascript:|\b(?:grade|grading|approve|reject|rank|prioritize)\b/i.test(value));
export const groqOutputSchema = z.strictObject({
    version: z.literal(1), overview: plain(800),
    explanations: z.array(z.strictObject({ metricId: z.string().min(1).max(40), text: plain(300) })).min(1).max(4),
});
export const wireSchema = z.object({ choices: z.array(z.object({
    finish_reason: z.literal("stop"),
    message: z.object({ role: z.literal("assistant"), content: z.string().min(1).max(8192),
        // Omitted/null metadata carries no call. Every non-null call value still denies.
        tool_calls: z.null().optional(), function_call: z.null().optional(), refusal: z.null().optional() }),
})).length(1) });
export const configurationSchema = z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/) });
type Configuration = z.infer<typeof configurationSchema>;
export const groqFallback = { mode: "static", message: "AI interpretation unavailable. Use verified static guidance." } as const;
type Category = "ok" | "invalid" | "timeout" | "rate-limited" | "provider-error";
type Schedule = (delay: number, callback: () => void) => () => void;
export const scheduleTimer: Schedule = (delay, callback) => { const id = setTimeout(callback, delay); return () => clearTimeout(id); };
const instructions = "Explain only supplied aggregate bands for ThesiSHS AI. Bands are not exact counts; submission metrics count recorded versions, not latest-paper backlog. Do not infer missing metrics, trends, people, research quality or priorities. Do not grade, decide approvals or generate official Adviser feedback. Return a short neutral overview and explanations referencing supplied metric IDs only. For Admin reports, give no predictions or recommendations; the overview has no numbers and each explanation may repeat only its supplied band, never exact counts. No URLs, HTML, tools, browsing, function calls or reasoning text.";
const adminInstructions = "Explain only the meaning of the supplied ThesiSHS AI aggregate metrics. Return a short neutral overview and explanations using the supplied metricId references. The application attaches and displays each canonical band itself. Do not repeat band labels, digits, spelled-out numbers, quantities, percentages or band identifiers in overview or text. Explain what each referenced metric counts and that bands are coarse, not exact counts. Do not infer withheld metrics, people, research quality, comparisons, historical trends, predictions, priorities or administrative recommendations. Do not grade, decide approvals or generate official feedback. No URLs, HTML, tools, browsing, function calls or reasoning text.";
function normalizeAdminNumericRanges(text: string): string {
    // Compare only standalone integer ranges with an adjacent en/em dash. Leave the
    // displayed response intact; signs, decimals, spaced dashes and chains stay invalid.
    return text.replace(/(?<![\d.+\-\u2010-\u2015\u2212])(\d+)[\u2013\u2014](\d+)(?![\d+\-\u2010-\u2015\u2212]|[.,]\d)/g, "$1-$2");
}
function neutralAdminOutput(output: z.infer<typeof groqOutputSchema>, payload: MinimizedAIDto): boolean {
    if (payload.feature !== "admin") return true;
    const unsupported = /\b(?:trends?|predict\w*|forecast\w*|recommend\w*|should|prioriti\w*|increas\w*|decreas\w*|growth|declin\w*|improv\w*|will|yesterday|tomorrow|previous\w*|histor\w*|comparisons?|compared|versus|higher|lower|larger|smaller)\b/i;
    const numericWords = /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|dozen|half|quarter|twice|double|triple|percent(?:age)?)\b/i;
    if (unsupported.test(output.overview) || numericWords.test(output.overview) || /\p{N}/u.test(output.overview)) return false;
    return output.explanations.every(item => {
        const band = payload.metrics[item.metricId as keyof typeof payload.metrics];
        const normalized = normalizeAdminNumericRanges(item.text);
        const numbers = normalized.match(/\d+(?:-\d+|\+)?/g) ?? [];
        return !!band && !unsupported.test(item.text) && !numericWords.test(item.text) && !/%/.test(item.text) &&
            !/\p{N}/u.test(normalized.replace(/[0-9]/g, "")) && numbers.every(value => value === band);
    });
}
const outputJSONSchema = (metricIds?: string[]) => ({
    type: "object", additionalProperties: false, required: ["version", "overview", "explanations"],
    properties: { version: {type:"integer",enum:[1]}, overview:{type:"string"}, explanations:{type:"array",items:{type:"object",additionalProperties:false,required:["metricId","text"],properties:{metricId:{type:"string",...(metricIds ? {enum:metricIds} : {})},text:{type:"string"}}}} },
});
export async function readBounded(response: Response, signal: AbortSignal) {
    if (!response.body) throw new Error("invalid");
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    const abort = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener("abort", abort, { once: true });
    try {
        while (true) {
            const item = await reader.read(); if (item.done) break;
            size += item.value.byteLength;
            if (size > 32768) { await reader.cancel(); throw new Error("invalid"); }
            chunks.push(item.value);
        }
    } finally { signal.removeEventListener("abort", abort); reader.releaseLock(); }
    return new TextDecoder("utf-8", {fatal:true}).decode(Buffer.concat(chunks));
}
// Explicit injected fetch required: contract tests never receive an implicit live transport.
// This transport primitive is not an authorization API; only the guarded service may use the runtime wrapper.
export function createGroqRESTTransport(transport: typeof fetch, schedule: Schedule = scheduleTimer,
    log: (event: {category: Category; durationMs: number}) => void = () => {}) {
    return async (input: unknown, configuration: unknown) => {
        const controller = new AbortController(); const start = Date.now(); let cancel = () => {};
        let category: Category = "invalid";
        try {
            const payload = requestSchema.parse(input), config = configurationSchema.parse(configuration);
            const body = JSON.stringify({ model: GROQ_MODEL, messages: [{role:"system",content:payload.feature === "admin" ? adminInstructions : instructions},{role:"user",content:JSON.stringify(payload)}],
                response_format:{type:"json_schema",json_schema:{name:"aggregate_interpretation",strict:true,schema:outputJSONSchema(payload.feature === "admin" ? Object.keys(payload.metrics).filter(id => payload.metrics[id as keyof typeof payload.metrics] !== undefined) : undefined)}},
                reasoning_effort:"low", max_completion_tokens:1024, stream:false });
            if (Buffer.byteLength(body,"utf8") > 4096) return groqFallback;
            const deadline = new Promise<never>((_,reject) => {
                cancel = schedule(10000, () => { category = "timeout"; controller.abort(); reject(new Error("timeout")); });
            });
            const output = await Promise.race([(async () => {
                const response = await transport(GROQ_ENDPOINT, {method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${config.token}`},body,signal:controller.signal,redirect:"error",cache:"no-store"});
                if (response.status !== 200) { category = response.status === 429 ? "rate-limited" : "provider-error"; throw new Error("provider"); }
                if (response.redirected || (response.url && response.url !== GROQ_ENDPOINT) || !response.headers.get("content-type")?.startsWith("application/json")) throw new Error("invalid");
                const wire = wireSchema.parse(JSON.parse(await readBounded(response, controller.signal)));
                const parsed = groqOutputSchema.parse(JSON.parse(wire.choices[0].message.content));
                const ids = parsed.explanations.map(item => item.metricId);
                if (new Set(ids).size !== ids.length || ids.some(id => !Object.entries(payload.metrics).some(([key,value]) => key === id && value !== undefined))) throw new Error("invalid");
                if (!neutralAdminOutput(parsed, payload)) throw new Error("invalid");
                // The provider can reference a metric but cannot supply or override its band.
                if (payload.feature === "admin") return { ...parsed, explanations: parsed.explanations.map(item => ({
                    ...item, band: bandSchema.parse(payload.metrics[item.metricId as keyof typeof payload.metrics]),
                })) };
                return parsed;
            })(),deadline]);
            category = "ok"; return {mode:"generated" as const,output};
        } catch { return groqFallback; }
        finally { cancel(); controller.abort(); try { log({category,durationMs:Math.max(0,Date.now()-start)}); } catch { /* Logging cannot change the safe result. */ } }
    };
}
// The loader does not read a secret while activation remains unauthorized.
function getApprovedConfiguration(): Configuration | null { return loadGroqConfiguration("application"); }
export async function interpretGroqAggregate(input: unknown) {
    if (!getGroqAvailability().enabled) return groqFallback;
    const configuration = getApprovedConfiguration();
    if (!configuration) return groqFallback;
    return createGroqRESTTransport(fetch, scheduleTimer, event => console.info("ai-provider", event))(input, configuration);
}
