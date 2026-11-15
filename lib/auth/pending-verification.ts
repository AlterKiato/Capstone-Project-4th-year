import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { emailOtpKey } from "./email-otp-config";

const COOKIE = "thesishs_pending_verification";
const PURPOSE = "thesishs-email-verification";
const MAX_AGE = 3600;
const identitySchema = z.object({ userId: z.number().int().positive().max(2147483647), email: z.email().max(255) });
export type VerificationIdentity = z.infer<typeof identitySchema>;

export async function createPendingVerification(identity: VerificationIdentity) {
    const value = identitySchema.parse(identity);
    const token = await new SignJWT(value).setProtectedHeader({ alg: "HS256", typ: "email-verification+jwt" })
        .setIssuer(PURPOSE).setAudience(PURPOSE).setIssuedAt().setExpirationTime(`${MAX_AGE}s`)
        .sign(emailOtpKey("pending-cookie"));
    (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production",
        sameSite: "lax", path: "/", maxAge: MAX_AGE });
}

export async function getPendingVerification(): Promise<VerificationIdentity | null> {
    try {
        const token = (await cookies()).get(COOKIE)?.value;
        if (!token) return null;
        const { payload, protectedHeader } = await jwtVerify(token, emailOtpKey("pending-cookie"), {
            algorithms: ["HS256"], issuer: PURPOSE, audience: PURPOSE, requiredClaims: ["iat", "exp"],
        });
        if (protectedHeader.typ !== "email-verification+jwt" || !Number.isSafeInteger(payload.iat) ||
            !Number.isSafeInteger(payload.exp) || payload.iat! > Math.floor(Date.now() / 1000) ||
            payload.exp! - payload.iat! !== MAX_AGE) return null;
        const parsed = identitySchema.safeParse(payload);
        return parsed.success ? parsed.data : null;
    } catch { return null; }
}

export async function deletePendingVerification() { (await cookies()).delete(COOKIE); }
