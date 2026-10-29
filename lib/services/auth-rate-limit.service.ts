import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { sharedAuthLimitsEnabled, getAuthLimitConfiguration, type AuthLimitOperation } from "@/lib/auth/auth-rate-limit-config";
import { trustedAuthSource } from "@/lib/auth/request-source";
import { consumeAuthBuckets, type AuthLimitBucket } from "@/lib/repositories/auth-rate-limit.repository";

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
