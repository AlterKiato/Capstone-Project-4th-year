import "server-only";
import { createECDH } from "node:crypto";
import { z } from "zod";
import { validPublicKey } from "./contract";

export type PushConfiguration = { available: boolean; origin: string | null; publicKey: string | null; keyId: string | null };
export type PushDeliveryConfiguration = { origin: string; publicKey: string; keyId: string; privateKey: string; subject: string };
function trustedOrigin(env: NodeJS.ProcessEnv): string | null {
    let origin: string | null = null;
    try {
        const url = new URL(env.THESISHS_PUSH_ORIGIN ?? "");
        const local = env.NODE_ENV === "development" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
        if (url.origin === env.THESISHS_PUSH_ORIGIN && !url.username && !url.password &&
            (url.protocol === "https:" || local && url.protocol === "http:")) origin = url.origin;
    } catch { /* Missing/untrusted origin never enables mutation. */ }
    return origin;
}

/** The enrollment response and sender share one key pair/identity; secrets never enter public DTOs. */
export function pushDeliveryConfiguration(env: NodeJS.ProcessEnv = process.env): PushDeliveryConfiguration | null {
    if (env.THESISHS_WEB_PUSH_ENABLED !== "true" || env.NODE_TLS_REJECT_UNAUTHORIZED === "0") return null;
    const origin = trustedOrigin(env), publicKey = env.THESISHS_WEB_PUSH_PUBLIC_KEY ?? "";
    const keyId = env.THESISHS_WEB_PUSH_KEY_ID ?? "", privateKey = env.THESISHS_WEB_PUSH_PRIVATE_KEY ?? "";
    const subject = env.THESISHS_WEB_PUSH_SUBJECT ?? "";
    try {
        if (!origin || !validPublicKey(publicKey) || !/^[A-Za-z0-9_-]{1,64}$/.test(keyId) ||
            !/^[A-Za-z0-9_-]{43}$/.test(privateKey) || subject.length > 256 || /\s/.test(subject)) return null;
        const bytes = Buffer.from(privateKey, "base64url");
        if (bytes.length !== 32 || bytes.toString("base64url") !== privateKey) return null;
        const pair = createECDH("prime256v1");
        pair.setPrivateKey(bytes);
        if (pair.getPublicKey().toString("base64url") !== publicKey) return null;
        if (subject.startsWith("mailto:")) {
            if (!z.email().safeParse(subject.slice(7)).success) return null;
        } else {
            const url = new URL(subject);
            if (url.protocol !== "https:" || url.href !== subject || url.username || url.password || url.hash ||
                !url.hostname.includes(".") || url.hostname.endsWith(".localhost")) return null;
        }
        return { origin, publicKey, keyId, privateKey, subject };
    } catch { return null; }
}

export function pushConfiguration(env: NodeJS.ProcessEnv = process.env): PushConfiguration {
    const config = pushDeliveryConfiguration(env);
    return { available: !!config, origin: trustedOrigin(env), publicKey: config?.publicKey ?? null, keyId: config?.keyId ?? null };
}
