import "server-only";
import "dotenv/config";

import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

import type { AuthTokenPayload } from "@/types/auth";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
    throw new Error(
        "JWT_SECRET is not defined in the environment variables."
    );
}

const secret = new TextEncoder().encode(jwtSecret);

const JWT_ALGORITHM = "HS256";
const timestamp = z.number().int().nonnegative().safe();
const claimsSchema = z.object({
    userId: z.number().int().positive().max(2147483647),
    roleId: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    email: z.email().max(255),
    iat: timestamp,
    exp: timestamp,
}).passthrough();

/**
 * Creates a signed JWT containing the authenticated user's
 * ID, email, and role ID.
 *
 * The token expires after 7 days.
 */
export async function createToken(
    payload: AuthTokenPayload
): Promise<string> {
    return await new SignJWT(payload)
        .setProtectedHeader({
            alg: JWT_ALGORITHM,
        })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secret);
}

/**
 * Verifies a JWT and returns its payload when valid.
 *
 * Invalid, expired, or tampered tokens return null
 * instead of crashing the application.
 */
export async function verifyToken(
    token: string
): Promise<AuthTokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, secret, {
            algorithms: [JWT_ALGORITHM],
            requiredClaims: ["exp", "iat"],
        });

        const claims = claimsSchema.safeParse(payload);
        if (!claims.success || claims.data.iat > Math.floor(Date.now() / 1000) || claims.data.exp <= claims.data.iat)
            return null;
        return claims.data;
    } catch {
        return null;
    }
}
