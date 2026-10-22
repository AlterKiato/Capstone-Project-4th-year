import "server-only";
import { createHash } from "node:crypto";
import { decodeJwt } from "jose";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { UPLOAD_BUCKET, UPLOAD_MAX_BYTES, UploadFailure } from "@/lib/uploads/contract";
import type { UploadStorage } from "@/lib/uploads/contract";

const staging = /^staging\/submissions\/[0-9a-f-]{36}\/upload\.pdf$/;
const final = /^research\/[1-9][0-9]*\/v[1-9][0-9]*\/[0-9a-f-]{36}-[a-zA-Z0-9_-]+\.pdf$/;
function pathCheck(path: string, finalOnly = false) {
    if (path.length > 500 || !(finalOnly ? final.test(path) : staging.test(path) || final.test(path))) throw new UploadFailure("unavailable");
}
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const pdfMime = (value: string | null | undefined) => value?.split(";")[0].trim().toLowerCase() === "application/pdf";
export function assertUploadPdf(bytes: Uint8Array, size: number) {
    if (!Number.isSafeInteger(size) || size < 1 || size > UPLOAD_MAX_BYTES || bytes.length !== size ||
        bytes.length < 5 || ![37, 80, 68, 70, 45].every((byte, index) => bytes[index] === byte)) throw new UploadFailure("invalid");
}
export function createSubmissionUploadStorage(fetcher: typeof fetch = fetch): UploadStorage {
    function client(signal: AbortSignal, expectedBodySize?: number) {
        const boundedFetch: typeof fetch = async (input, init) => {
            const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(20000), ...(init?.signal ? [init.signal] : [])]);
            const response = await fetcher(input, { ...init, signal: requestSignal, cache: "no-store", redirect: "error" });
            if (expectedBodySize !== undefined && response.ok) {
                const length = response.headers.get("content-length"), encoding = response.headers.get("content-encoding");
                if (!pdfMime(response.headers.get("content-type")) || encoding && encoding.toLowerCase() !== "identity" ||
                    length !== null && (!/^\d+$/.test(length) || Number(length) !== expectedBodySize || Number(length) > UPLOAD_MAX_BYTES)) {
                    await response.body?.cancel(); throw new UploadFailure("invalid");
                }
            }
            return response;
        };
        return getSupabaseServerClient(boundedFetch);
    }
    async function metadata(path: string, signal: AbortSignal) {
        pathCheck(path);
        const { data, error } = await client(signal).storage.from(UPLOAD_BUCKET).info(path);
        if (error) {
            const code = "code" in error ? error.code : undefined;
            if (String(error.statusCode) === "404" || error.status === 404 || code === "NoSuchKey" || code === "not_found") return null;
            throw new UploadFailure("unavailable");
        }
        return data;
    }
    async function read(path: string, declaredSize: number, signal: AbortSignal) {
        if (!Number.isSafeInteger(declaredSize) || declaredSize <= 0 || declaredSize > UPLOAD_MAX_BYTES) throw new UploadFailure("invalid");
        const meta = await metadata(path, signal);
        if (!meta) throw new UploadFailure("unavailable");
        // Top-level provider fields, never caller-controlled custom metadata.
        if (meta.size !== declaredSize || !pdfMime(meta.contentType)) throw new UploadFailure("invalid");
        const { data, error } = await client(signal, declaredSize).storage.from(UPLOAD_BUCKET)
            .download(path, {}, { signal }).asStream();
        if (error || !data) throw new UploadFailure("unavailable");
        const reader = data.getReader(), bytes = new Uint8Array(declaredSize);
        let offset = 0;
        try {
            while (true) {
                signal.throwIfAborted();
                const chunk = await reader.read();
                if (chunk.done) break;
                if (!(chunk.value instanceof Uint8Array) || offset + chunk.value.length > declaredSize || offset + chunk.value.length > UPLOAD_MAX_BYTES)
                    throw new UploadFailure("invalid");
                bytes.set(chunk.value, offset); offset += chunk.value.length;
            }
            if (offset !== declaredSize) throw new UploadFailure("invalid");
            assertUploadPdf(bytes, declaredSize); return bytes;
        } finally { try { await reader.cancel(); } catch { /* No buffer or error payload is logged. */ } reader.releaseLock(); }
    }
    return {
        async issue(path, signal) {
            pathCheck(path);
            if (!staging.test(path)) throw new UploadFailure("unavailable");
            const supabase = client(signal);
            const { data: bucket, error: bucketError } = await supabase.storage.getBucket(UPLOAD_BUCKET);
            if (bucketError || !bucket || bucket.public !== false || bucket.file_size_limit !== UPLOAD_MAX_BYTES ||
                bucket.allowed_mime_types?.length !== 1 || bucket.allowed_mime_types[0] !== "application/pdf") throw new UploadFailure("unavailable");
            const key = process.env.SUPABASE_PUBLISHABLE_KEY;
            if (!key || !/^sb_publishable_[A-Za-z0-9_-]{10,1024}$/.test(key)) throw new UploadFailure("unavailable");
            const { data, error } = await supabase.storage.from(UPLOAD_BUCKET).createSignedUploadUrl(path, { upsert: false });
            if (error || !data || data.path !== path || data.token.length > 8192) throw new UploadFailure("unavailable");
            const url = new URL(data.signedUrl), base = new URL(process.env.SUPABASE_URL ?? "");
            const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) && ["development", "test"].includes(process.env.NODE_ENV ?? "");
            if (url.origin !== base.origin || url.protocol !== "https:" && !local || url.username || url.password || url.hash ||
                url.pathname !== `/storage/v1/object/upload/sign/${UPLOAD_BUCKET}/${path}` ||
                [...url.searchParams].length !== 1 || url.searchParams.get("token") !== data.token) throw new UploadFailure("unavailable");
            // Decode only the HTTPS-authenticated provider response, never a client token. Supabase validates its signature.
            const claims = decodeJwt(data.token), exp = claims.exp;
            if (!Number.isSafeInteger(exp) || exp! * 1000 <= Date.now() || exp! * 1000 > Date.now() + 7260000) throw new UploadFailure("unavailable");
            return { url: url.toString(), publishableKey: key, expiresAt: new Date(exp! * 1000) };
        },
        async exists(path, signal) { return (await metadata(path, signal)) !== null; },
        read,
        async writeOrReconcile(path, bytes, digest, signal) {
            pathCheck(path, true); assertUploadPdf(bytes, bytes.length);
            if (hash(bytes) !== digest) throw new UploadFailure("conflict");
            const { data, error } = await client(signal).storage.from(UPLOAD_BUCKET).upload(path, bytes,
                { contentType: "application/pdf", cacheControl: "0", upsert: false });
            if (!error && data?.path === path) return;
            // Conflict and lost write acknowledgements are both resolved by exact content, never by overwrite/delete.
            try { if (hash(await read(path, bytes.length, signal)) === digest) return; } catch { throw new UploadFailure("unavailable"); }
            throw new UploadFailure("conflict");
        },
    };
}
