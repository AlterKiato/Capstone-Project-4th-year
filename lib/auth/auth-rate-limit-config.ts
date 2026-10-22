import "server-only";
import { z } from "zod";

export const AUTH_LIMIT_WINDOW_SECONDS = 900;
export const AUTH_RETRY_MESSAGE = "This request is temporarily unavailable. Please wait up to 15 minutes and try again.";
export type AuthLimitOperation = "login" | "registration" | "verificationRequest" | "verificationConfirm";
type Thresholds = { global: number; source: number; account?: number };
const defaults: Record<AuthLimitOperation, Thresholds> = {
    login: { account: 10, source: 300, global: 1200 },
    registration: { account: 5, source: 60, global: 120 },
    verificationRequest: { account: 10, source: 120, global: 600 },
    verificationConfirm: { source: 120, global: 600 },
};
const count = z.number().int().min(1).max(10000);
const thresholds = z.strictObject({ global: count.optional(), source: count.optional(), account: count.optional() });
const overrideSchema = z.strictObject({
    login: thresholds.optional(), registration: thresholds.optional(), verificationRequest: thresholds.optional(),
    verificationConfirm: z.strictObject({ global: count.optional(), source: count.optional() }).optional(),
});

export function sharedAuthLimitsEnabled() {
    // An absent/unrecognized runtime never creates a production bypass.
    return !["development", "test"].includes(process.env.NODE_ENV ?? "") ||
        process.env.THESISHS_SHARED_AUTH_LIMITS === "enabled";
}

export function getAuthLimitConfiguration(operation: AuthLimitOperation) {
    const secret = process.env.THESISHS_AUTH_LIMIT_SECRET;
    if (!secret || secret.trim() !== secret || new TextEncoder().encode(secret).length < 32 || secret.length > 4096)
        throw new Error("Authentication limiting unavailable.");
    const raw = process.env.THESISHS_AUTH_LIMITS_JSON;
    if (raw && raw.length > 4096) throw new Error("Authentication limiting unavailable.");
    const overrides = overrideSchema.parse(raw ? JSON.parse(raw) : {});
    const limits = { ...defaults[operation], ...overrides[operation] };
    if (limits.source > limits.global || (limits.account ?? 0) > limits.global)
        throw new Error("Authentication limiting unavailable.");
    return { secret, limits };
}
