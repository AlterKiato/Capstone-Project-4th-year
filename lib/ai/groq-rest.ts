import "server-only";
import { z } from "zod";
import { minimizedAIDtoSchema } from "@/lib/validations/ai-foundation";
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
const wireSchema = z.object({ choices: z.array(z.object({
    finish_reason: z.literal("stop"),
    message: z.object({ role: z.literal("assistant"), content: z.string().min(1).max(8192),
        tool_calls: z.never().optional(), function_call: z.never().optional(), refusal: z.null().optional() }),
})).length(1) });
const configurationSchema = z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{1,256}$/) });
type Configuration = z.infer<typeof configurationSchema>;
export const groqFallback = { mode: "static", message: "AI interpretation unavailable. Use verified static guidance." } as const;
type Category = "ok" | "invalid" | "timeout" | "rate-limited" | "provider-error";
type Schedule = (delay: number, callback: () => void) => () => void;
const scheduleTimer: Schedule = (delay, callback) => { const id = setTimeout(callback, delay); return () => clearTimeout(id); };
const instructions = "Explain only supplied aggregate bands for ThesiSHS AI. Bands are not exact counts; submission metrics count recorded versions, not latest-paper backlog. Do not infer missing metrics, trends, people, research quality or priorities. Do not grade, decide approvals or generate official Adviser feedback. Return a short neutral overview and explanations referencing supplied metric IDs only. No URLs, HTML, tools, browsing, function calls or reasoning text.";
const outputJSONSchema = {
    type: "object", additionalProperties: false, required: ["version", "overview", "explanations"],
    properties: { version: {type:"integer",enum:[1]}, overview:{type:"string"}, explanations:{type:"array",items:{type:"object",additionalProperties:false,required:["metricId","text"],properties:{metricId:{type:"string"},text:{type:"string"}}}} },
};
async function readBounded(response: Response, signal: AbortSignal) {
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
            const body = JSON.stringify({ model: GROQ_MODEL, messages: [{role:"system",content:instructions},{role:"user",content:JSON.stringify(payload)}],
                response_format:{type:"json_schema",json_schema:{name:"aggregate_interpretation",strict:true,schema:outputJSONSchema}},
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
