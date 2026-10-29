import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { ROLE_IDS } from "@/lib/auth/roles";
import type { AuthUser } from "@/types/auth";

export const MOBILE_TOKEN_LIFETIME_SECONDS = 24 * 60 * 60;
export const MOBILE_TOKEN_AUDIENCE = "thesishs-student-mobile";
export const MOBILE_TOKEN_TYPE = "thesishs-mobile+jwt";
const ALGORITHM = "HS256";
const identity = z.object({
    userId: z.number().int().positive().max(2147483647),
    email: z.email().max(255),
    roleId: z.literal(ROLE_IDS.STUDENT),
});
const timestamp = z.number().int().nonnegative().safe();
const claimsSchema = identity.extend({
    iss: z.string(),
    aud: z.literal(MOBILE_TOKEN_AUDIENCE),
    iat: timestamp,
    exp: timestamp,
}).strict();
export type MobileTokenClaims = z.infer<typeof claimsSchema>;
export type MobileTokenOutcome =
    | { status: "valid"; claims: MobileTokenClaims }
    | { status: "invalid" }
    | { status: "unavailable" };

/** Lazy and server-only: missing mobile configuration must not break web startup. */
function configuration() {
    const value = process.env.THESISHS_MOBILE_JWT_SECRET;
    const issuer = process.env.THESISHS_MOBILE_JWT_ISSUER;
    const webSecret = process.env.JWT_SECRET;
    if (!value || value.trim() !== value || new TextEncoder().encode(value).length < 32 ||
        value.length > 4096 || !webSecret || value === webSecret ||
        !issuer || issuer.length > 255 || /\s/.test(issuer))
        throw new Error("Mobile authentication unavailable.");
    return { key: new TextEncoder().encode(value), issuer };
}

/**
 * Internal signing primitive: user MUST come from successful server credential
 * validation/current-account resolution, never a request body or decoded token.
 * Whitelisting prevents caller-supplied role, expiry or profile overrides.
 */
export async function createMobileToken(user: AuthUser): Promise<{ token: string; expiresAt: string }> {
    const principal = identity.parse({ userId: user.id, email: user.email, roleId: user.roleId });
    const { key, issuer } = configuration();
    const now = Math.floor(Date.now() / 1000);
    const expires = now + MOBILE_TOKEN_LIFETIME_SECONDS;
    const token = await new SignJWT(principal)
        .setProtectedHeader({ alg: ALGORITHM, typ: MOBILE_TOKEN_TYPE })
        .setIssuer(issuer)
        .setAudience(MOBILE_TOKEN_AUDIENCE)
        .setIssuedAt(now)
        .setExpirationTime(expires)
        .sign(key);
    return { token, expiresAt: new Date(expires * 1000).toISOString() };
}

/** Cryptographic profile only; every authorized request still needs fresh account resolution. */
export async function verifyMobileToken(token: string): Promise<MobileTokenOutcome> {
    let config: ReturnType<typeof configuration>;
    try { config = configuration(); }
    catch { return { status: "unavailable" }; }
    try {
        const { payload, protectedHeader } = await jwtVerify(token, config.key, {
            algorithms: [ALGORITHM],
            issuer: config.issuer,
            audience: MOBILE_TOKEN_AUDIENCE,
            typ: MOBILE_TOKEN_TYPE,
            requiredClaims: ["iss", "aud", "iat", "exp"],
            clockTolerance: 0,
        });
        const claims = claimsSchema.safeParse(payload);
        if (!claims.success || protectedHeader.typ !== MOBILE_TOKEN_TYPE ||
            claims.data.iat > Math.floor(Date.now() / 1000) ||
            claims.data.exp - claims.data.iat !== MOBILE_TOKEN_LIFETIME_SECONDS)
            return { status: "invalid" };
        return { status: "valid", claims: claims.data };
    } catch {
        return { status: "invalid" };
    }
}
