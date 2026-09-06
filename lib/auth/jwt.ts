import "server-only";
import "dotenv/config";

import { SignJWT, jwtVerify } from "jose";

import type { AuthTokenPayload } from "@/types/auth";

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
    throw new Error(
        "JWT_SECRET is not defined in the environment variables."
    );
}

const secret = new TextEncoder().encode(jwtSecret);

const JWT_ALGORITHM = "HS256";

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
        });

        return payload as AuthTokenPayload;
    } catch {
        return null;
    }
}