import "dotenv/config";

import { SignJWT, jwtVerify } from "jose";
import type { AuthTokenPayload } from "@/types/auth";

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    throw new Error("JWT_SECRET is not defined in the environment variables.");
}

const secret = new TextEncoder().encode(jwtSecret);

export async function createToken(payload: AuthTokenPayload) {
    return await new SignJWT(payload)
    .setProtectedHeader({alg: "HS256"})
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<AuthTokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, secret);
        return payload as AuthTokenPayload;
    } catch {
        return null;
    }
}