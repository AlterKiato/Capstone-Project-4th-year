import { PushFailure, pushError } from "./contract";
import type { PushConfiguration } from "./config";
import type { PushOperation } from "./subscription";

async function readJson(request: Request): Promise<unknown> {
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) throw new PushFailure("media_type");
    const reader = request.body?.getReader();
    if (!reader) throw new PushFailure("invalid");
    let length = 0;
    const chunks: Uint8Array[] = [];
    try {
        while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            length += chunk.value.byteLength;
            if (length > 4096) { void reader.cancel().catch(() => {}); throw new PushFailure("too_large"); }
            chunks.push(chunk.value);
        }
        try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
        catch { throw new PushFailure("invalid"); }
    } finally { reader.releaseLock(); }
}
export function createPushHttpHandler(
    service: (operation: PushOperation, input: unknown, headers: Headers) => Promise<unknown>,
    configuration: () => PushConfiguration,
) {
    return async (request: Request): Promise<Response> => {
        const headers = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" };
        try {
            const operation = request.method as PushOperation;
            if (operation !== "GET") {
                const origin = configuration().origin;
                if (!origin) throw new PushFailure("unavailable");
                if (request.headers.get("origin") !== origin || request.headers.get("sec-fetch-site") === "cross-site") throw new PushFailure("forbidden");
            }
            const body = operation === "GET" ? undefined : await readJson(request);
            return Response.json(await service(operation, body, request.headers), { headers });
        } catch (error) {
            const result = pushError(error);
            return Response.json(result.body, { status: result.status, headers: { ...headers, ...(result.status === 429 ? { "Retry-After": "900" } : {}) } });
        }
    };
}
