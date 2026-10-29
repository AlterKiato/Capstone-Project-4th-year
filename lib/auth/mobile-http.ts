import "server-only";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import type { AuthUser } from "@/types/auth";

export const MOBILE_LOGIN_BODY_BYTES = 4096;
export const MOBILE_BEARER_CHARACTERS = 8192;
export const MOBILE_BODY_READ_TIMEOUT_MS = 10000;

const errors = {
    INVALID_REQUEST: [400, "Invalid request."],
    INVALID_CREDENTIALS: [401, "Invalid email or password."],
    SESSION_INVALID: [401, "Your session is invalid or expired."],
    STUDENT_ACCESS_REQUIRED: [403, "This action requires an active Student account."],
    PAYLOAD_TOO_LARGE: [413, "Request body is too large."],
    UNSUPPORTED_MEDIA_TYPE: [415, "UTF-8 JSON is required."],
    AUTH_RATE_LIMITED: [429, "Too many authentication requests. Please try again later."],
    AUTH_UNAVAILABLE: [503, "Authentication is temporarily unavailable."],
    INTERNAL_ERROR: [500, "Unable to process the request."],
} as const;
export type MobileErrorCode = keyof typeof errors;

function responseHeaders(session: boolean) {
    return {
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        ...(session ? { Vary: "Authorization" } : {}),
    };
}
export function mobileError(code: MobileErrorCode, session = false) {
    const [status, message] = errors[code];
    return Response.json({ success: false, code, message }, { status, headers: responseHeaders(session) });
}
export function mobileSuccess(code: "AUTHENTICATED" | "SESSION_VALID", data: unknown) {
    return Response.json({ success: true, code,
        message: code === "AUTHENTICATED" ? "Login successful." : "Session valid.", data },
    { headers: responseHeaders(code === "SESSION_VALID") });
}

/** Explicit whitelist even if an internal service later returns extra fields. */
export function safeStudent(user: AuthUser) {
    return { id: user.id, roleId: user.roleId, firstName: user.firstName, lastName: user.lastName, email: user.email };
}

class RequestRejection extends Error {
    constructor(readonly code: MobileErrorCode) { super("Invalid mobile request."); }
}

/** Only the approved flat object of two JSON strings, not a general JSON parser. */
function credentialsObject(text: string): LoginInput {
    let position = 0;
    const whitespace = () => { while (/[ \t\r\n]/.test(text[position] ?? "!")) position++; };
    const expect = (character: string) => {
        whitespace();
        if (text[position++] !== character) throw new RequestRejection("INVALID_REQUEST");
    };
    const literal = /"(?:[^"\\\u0000-\u001f]|\\(?:["\\/bfnrt]|u[0-9a-fA-F]{4}))*"/y;
    const string = (): string => {
        whitespace(); literal.lastIndex = position;
        const match = literal.exec(text);
        if (!match) throw new RequestRejection("INVALID_REQUEST");
        position = literal.lastIndex;
        return JSON.parse(match[0]) as string;
    };
    const fields: Partial<LoginInput> = {};
    const seen = new Set<string>();
    expect("{");
    for (;;) {
        const key = string();
        if ((key !== "email" && key !== "password") || seen.has(key)) throw new RequestRejection("INVALID_REQUEST");
        seen.add(key); expect(":"); fields[key] = string();
        whitespace();
        if (text[position] === "}") { position++; break; }
        expect(",");
    }
    whitespace();
    const parsed = loginSchema.safeParse(fields);
    if (position !== text.length || !parsed.success) throw new RequestRejection("INVALID_REQUEST");
    return parsed.data;
}

export async function readMobileCredentials(request: Request): Promise<
    { status: "valid"; input: LoginInput } | { status: "invalid"; code: MobileErrorCode }
> {
    const contentType = request.headers.get("content-type") ?? "";
    if (!/^application\/json(?:[ \t]*;[ \t]*charset[ \t]*=[ \t]*(?:utf-8|"utf-8"))?[ \t]*$/i.test(contentType) ||
        ![null, "identity"].includes(request.headers.get("content-encoding")))
        return { status: "invalid", code: "UNSUPPORTED_MEDIA_TYPE" };
    const length = request.headers.get("content-length");
    if (length !== null && !/^\d+$/.test(length)) return { status: "invalid", code: "INVALID_REQUEST" };
    if (length !== null && Number(length) > MOBILE_LOGIN_BODY_BYTES) return { status: "invalid", code: "PAYLOAD_TOO_LARGE" };
    if (!request.body || request.bodyUsed) return { status: "invalid", code: "INVALID_REQUEST" };
    if (request.body.locked) return { status: "invalid", code: "INVALID_REQUEST" };
    const reader = request.body.getReader();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new RequestRejection("INVALID_REQUEST")), MOBILE_BODY_READ_TIMEOUT_MS);
    });
    try {
        const bytes = new Uint8Array(MOBILE_LOGIN_BODY_BYTES);
        let size = 0;
        for (;;) {
            const { value, done } = await Promise.race([reader.read(), timeout]);
            if (done) break;
            size += value.byteLength;
            if (size > MOBILE_LOGIN_BODY_BYTES) throw new RequestRejection("PAYLOAD_TOO_LARGE");
            bytes.set(value, size - value.byteLength);
        }
        if (length !== null && Number(length) !== size) throw new RequestRejection("INVALID_REQUEST");
        const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, size));
        return { status: "valid", input: credentialsObject(text) };
    } catch (error) {
        void reader.cancel().catch(() => {});
        return { status: "invalid", code: error instanceof RequestRejection ? error.code : "INVALID_REQUEST" };
    } finally { clearTimeout(timer); reader.releaseLock(); }
}

/** Headers combines duplicate Authorization values with commas; this grammar rejects them. */
export function mobileBearer(request: Request): string | null {
    const authorization = request.headers.get("authorization");
    if (!authorization || authorization.length > MOBILE_BEARER_CHARACTERS + 7) return null;
    const match = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/i.exec(authorization);
    return match?.[1] && match[1].length <= MOBILE_BEARER_CHARACTERS ? match[1] : null;
}
