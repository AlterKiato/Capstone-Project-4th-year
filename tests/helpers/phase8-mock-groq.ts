// TEST ONLY. Injected in-process transport; no default/live transport or application imports.
import { z } from "zod";
import { minimizedAIDtoSchema, type MinimizedAIDto } from "../../lib/validations/ai-foundation";
export const mockRequestSchema = minimizedAIDtoSchema.refine(dto => Object.values(dto.metrics).some(value => value !== undefined));
const plain = (max: number) => z.string().min(1).max(max).refine(text => !/[<>]|https?:|www\.|\]\(|javascript:/i.test(text));
export const mockResponseSchema = z.strictObject({
    version: z.literal(1), overview: plain(800),
    explanations: z.array(z.strictObject({ metricId: z.string().min(1).max(40), text: plain(300) })).max(4),
});
export const mockConfig = Object.freeze({
    model: "openai/gpt-oss-20b", endpoint: "https://api.groq.com/openai/v1/chat/completions",
});
type Envelope = typeof mockConfig & { payload: MinimizedAIDto };
type WireResponse = { status: number; body: string };
type Timer = (delay: number, callback: () => void) => () => void;
const timer: Timer = (delay, callback) => { const id = setTimeout(callback, delay); return () => clearTimeout(id); };
export function createMockGroqAdapter(transport: (envelope: Envelope, signal: AbortSignal) => Promise<WireResponse>, schedule: Timer = timer) {
    return async (input: unknown) => {
        const controller = new AbortController();
        let cancel = () => {};
        try {
            const payload = mockRequestSchema.parse(input);
            const envelope = { ...mockConfig, payload };
            if (Buffer.byteLength(JSON.stringify(envelope), "utf8") > 4096) throw new Error("size");
            const deadline = new Promise<never>((_, reject) => {
                cancel = schedule(10000, () => { controller.abort(); reject(new Error("timeout")); });
            });
            const wire = await Promise.race([transport(envelope, controller.signal), deadline]);
            if (wire.status !== 200 || Buffer.byteLength(wire.body, "utf8") > 8192) throw new Error("response");
            const output = mockResponseSchema.parse(JSON.parse(wire.body));
            const ids = output.explanations.map(item => item.metricId);
            if (ids.length > (payload.feature === "admin" ? 4 : 3) || new Set(ids).size !== ids.length ||
                ids.some(id => !Object.entries(payload.metrics).some(([key, value]) => key === id && value !== undefined))) throw new Error("references");
            return { mode: "mock" as const, output };
        } catch {
            return { mode: "static" as const, message: "AI interpretation unavailable. Use verified static guidance." };
        } finally { cancel(); }
    };
}

// In-memory simulation only, not a restart-safe live-pilot ledger or deployment limiter.
export function createMockLimiter(now: () => number) {
    let day = -1, total = 0, busy = false;
    const accounts = new Map<number, { count: number; last: number }>();
    return {
        reserve(account: number): (() => void) | null {
            if (!Number.isSafeInteger(account) || account <= 0 || busy) return null;
            const time = now(), currentDay = Math.floor(time / 86400000);
            if (currentDay !== day) { day = currentDay; total = 0; accounts.clear(); }
            const prior = accounts.get(account);
            if (total >= 10 || (prior && (prior.count >= 3 || time - prior.last < 120000))) return null;
            accounts.set(account, { count: (prior?.count ?? 0) + 1, last: time }); total++; busy = true;
            let released = false;
            return () => { if (!released) { released = true; busy = false; } };
        },
    };
}
