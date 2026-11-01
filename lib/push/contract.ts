import { ECDH } from "node:crypto";
import { z } from "zod";

export function validPublicKey(value: string): boolean {
    try {
        if (!/^[A-Za-z0-9_-]{87}$/.test(value)) return false;
        const bytes = Buffer.from(value, "base64url");
        return bytes.length === 65 && bytes[0] === 4 && bytes.toString("base64url") === value &&
            ECDH.convertKey(bytes, "prime256v1", undefined, undefined, "uncompressed").length === 65;
    } catch { return false; }
}

// Registration policy only. Sender-side DNS, redirects and TLS controls belong to P.3D.
export function safePushEndpoint(value: string): boolean {
    try {
        if (Buffer.byteLength(value) > 2048 || !/^[\x21-\x7e]+$/.test(value) || !value.startsWith("https://") || value.includes("\\") || value.includes("#")) return false;
        const url = new URL(value);
        return url.href === value && url.hostname.length <= 253 && url.hostname.split(".").every(label => label.length <= 63) &&
            !url.username && !url.password && !url.port && !url.hash &&
            (url.hostname === "fcm.googleapis.com" || /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+push\.apple\.com$/.test(url.hostname));
    } catch { return false; }
}

const uuid = z.uuid().transform(value => value.toLowerCase());
export const registrationSchema = z.strictObject({
    expectedGeneration: uuid.nullable(),
    registrationId: uuid,
    subscription: z.strictObject({
        endpoint: z.string().max(2048).refine(safePushEndpoint),
        expirationTime: z.number().int().positive().max(8640000000000000).nullable(),
        keys: z.strictObject({
            p256dh: z.string().refine(validPublicKey),
            auth: z.string().regex(/^[A-Za-z0-9_-]{22}$/).refine(value => Buffer.from(value, "base64url").toString("base64url") === value),
        }),
    }),
});
export const removalSchema = z.strictObject({ generations: z.array(uuid).min(1).max(2).refine(values => new Set(values).size === values.length) });
export type Registration = z.infer<typeof registrationSchema>;
export type Removal = z.infer<typeof removalSchema>;
export type PushActor = { userId: number; roleId: number; expiresAt: Date };
export type Enrollment = { generation: string; enabled: boolean; endpointFingerprint: string | null; authorizedUntil: string | null; vapidKeyId: string | null };
export type PushRepository = {
    read(actor: PushActor): Promise<Enrollment | null>;
    register(actor: PushActor, input: Registration, keyId: string): Promise<Enrollment>;
    disable(actor: PushActor, input: Removal): Promise<Enrollment>;
};
export type PushCode = "invalid" | "unauthenticated" | "forbidden" | "conflict" | "too_large" | "media_type" | "limited" | "unavailable";
const statuses: Record<PushCode, number> = { invalid: 400, unauthenticated: 401, forbidden: 403, conflict: 409, too_large: 413, media_type: 415, limited: 429, unavailable: 503 };
const messages: Record<PushCode, string> = {
    invalid: "Invalid notification enrollment request.", unauthenticated: "Sign in again to manage notifications.",
    forbidden: "Notification enrollment is not permitted.", conflict: "Enrollment changed. Refresh its status before trying again.",
    too_large: "Notification enrollment request is too large.", media_type: "A JSON request is required.",
    limited: "Too many requests. Try again later.", unavailable: "Notification enrollment is temporarily unavailable.",
};
export class PushFailure extends Error {
    constructor(readonly code: PushCode) { super(messages[code]); }
}
export function pushError(error: unknown) {
    const code = error instanceof PushFailure ? error.code : "unavailable";
    return { status: statuses[code], body: { ok: false as const, code, message: messages[code] } };
}
