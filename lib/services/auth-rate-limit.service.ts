import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { sharedAuthLimitsEnabled, getAuthLimitConfiguration, type AuthLimitOperation } from "@/lib/auth/auth-rate-limit-config";
import { trustedAuthSource } from "@/lib/auth/request-source";
import { consumeAuthBuckets, type AuthLimitBucket } from "@/lib/repositories/auth-rate-limit.repository";
import type { MobileTokenClaims } from "@/lib/auth/mobile-jwt";

export type AuthAttemptOutcome = { status: "allowed" } | { status: "limited" } | { status: "unavailable" };

/** Internal request boundary. No state is kept in this process and no credential/token is accepted. */
export async function checkAuthAttempt(operation: AuthLimitOperation, accountIdentifier?: string): Promise<AuthAttemptOutcome> {
    if (!sharedAuthLimitsEnabled()) return { status: "allowed" }; // Explicit local/test compatibility gate only.
    try {
        const { secret, limits } = getAuthLimitConfiguration(operation);
        const digest = (dimension: string, value: string) => createHmac("sha256", secret)
            .update(JSON.stringify(["thesishs-auth-limit-v1", operation, dimension, value])).digest("hex");
        const global = { keyDigest: digest("global", "all"), limit: limits.global };
        const identities: AuthLimitBucket[] = [];
        const source = trustedAuthSource(await headers());
        if (source) identities.push({ keyDigest: digest("source", source), limit: limits.source });
        if (limits.account) {
            const account = accountIdentifier && accountIdentifier.length <= 320 ? accountIdentifier.trim().toLowerCase() : "invalid";
            identities.push({ keyDigest: digest("account", account), limit: limits.account });
        }
        return { status: await consumeAuthBuckets(global, identities) ? "allowed" : "limited" };
    } catch {
        // Includes invalid configuration, missing migration, connection/transaction failure.
        return { status: "unavailable" };
    }
}

/** Compatibility wrapper: all existing callers still fail closed on any denied admission. */
export async function allowAuthAttempt(operation: AuthLimitOperation, accountIdentifier?: string): Promise<boolean> {
    return (await checkAuthAttempt(operation, accountIdentifier)).status === "allowed";
}

function mobileSessionDigest(secret: string, dimension: string, value: string) {
    return createHmac("sha256", secret)
        .update(JSON.stringify(["thesishs-auth-limit-v1", "mobileSession", dimension, value])).digest("hex");
}

/** Ingress only: never decode a token or allocate an account bucket here. */
export async function checkMobileSessionIngress(requestHeaders: Headers): Promise<AuthAttemptOutcome> {
    if (!sharedAuthLimitsEnabled()) return { status: "allowed" };
    try {
        const { secret, limits } = getAuthLimitConfiguration("mobileSession");
        const global = { keyDigest: mobileSessionDigest(secret, "global", "all"), limit: limits.global };
        const source = trustedAuthSource(requestHeaders);
        const identities = source ? [{ keyDigest: mobileSessionDigest(secret, "source", source), limit: limits.source }] : [];
        return { status: await consumeAuthBuckets(global, identities) ? "allowed" : "limited" };
    } catch { return { status: "unavailable" }; }
}

/** Internal: claims MUST be the successful mobile verifier result, never decoded/request IDs. */
export async function checkMobileSessionAccount(claims: MobileTokenClaims): Promise<AuthAttemptOutcome> {
    if (!Number.isInteger(claims.userId) || claims.userId <= 0 || claims.userId > 2147483647 || claims.roleId !== 3)
        return { status: "unavailable" };
    if (!sharedAuthLimitsEnabled()) return { status: "allowed" };
    try {
        const { secret, limits } = getAuthLimitConfiguration("mobileSession");
        if (!limits.account) return { status: "unavailable" };
        const account = { keyDigest: mobileSessionDigest(secret, "account", String(claims.userId)), limit: limits.account };
        // A single-bucket transaction reuses the existing atomic upsert/DB clock.
        // Global/source were already consumed; neither is passed a second time.
        return { status: await consumeAuthBuckets(account, []) ? "allowed" : "limited" };
    } catch { return { status: "unavailable" }; }
}
