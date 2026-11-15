import "server-only";
import { createHmac } from "node:crypto";

export const OTP_EXPIRY_MS = 5 * 60 * 1000;
export const OTP_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export function emailOtpKey(purpose: "code" | "pending-cookie") {
    const secret = process.env.THESISHS_EMAIL_OTP_SECRET;
    if (!secret || secret.trim() !== secret || Buffer.byteLength(secret) < 32 || secret.length > 4096 ||
        secret === process.env.JWT_SECRET || secret === process.env.THESISHS_AUTH_LIMIT_SECRET)
        throw new Error("Email verification is unavailable.");
    return createHmac("sha256", secret).update(`thesishs-email-otp-v1:${purpose}`).digest();
}

/** Gmail activation is Preview-only. Development uses synthetic Mailpit capture. */
export function emailOtpDeliveryMode(): "gmail" | "mailpit" | null {
    if (process.env.NODE_ENV === "development" && !process.env.VERCEL && process.env.THESISHS_LOCAL_MAILPIT === "enabled")
        return "mailpit";
    if (process.env.NODE_ENV === "production" && process.env.VERCEL === "1" && process.env.VERCEL_ENV === "preview" &&
        process.env.THESISHS_EMAIL_OTP_ENABLED === "enabled") return "gmail";
    return null;
}
