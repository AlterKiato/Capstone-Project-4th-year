import "server-only";

import { cookies } from "next/headers";

import { createToken, verifyToken } from "./jwt";

import type { AuthTokenPayload } from "@/types/auth";
import { resolveCurrentAccount } from "./account-principal";

const COOKIE_NAME = "thesishs_session";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * Creates an authentication session and stores
 * the JWT inside a secure HTTP-only cookie.
 */
export async function createSession(
    payload: AuthTokenPayload
): Promise<void> {
    if ((await resolveCurrentAccount(payload)).status !== "active") throw new Error("Account access unavailable.");
    const token = await createToken(payload);

    const cookieStore = await cookies();

    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
    });
}

/**
 * Retrieves and verifies the current authentication session.
 *
 * Returns null when the session cookie does not exist
 * or when the JWT/account is invalid, inactive, expired or pending verification.
 */
export async function getSession(): Promise<AuthTokenPayload | null> {
    const cookieStore = await cookies();

    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
        return null;
    }

    const claims = await verifyToken(token);
    if (!claims) return null;
    const account = await resolveCurrentAccount(claims);
    return account.status === "active" ? { ...claims, email: account.user.email } : null;
}

/**
 * Deletes the current authentication session cookie.
 */
export async function deleteSession(): Promise<void> {
    const cookieStore = await cookies();

    cookieStore.delete(COOKIE_NAME);
}
