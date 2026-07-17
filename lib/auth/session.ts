import "server-only";

import { cookies } from "next/headers";
import { createToken, verifyToken } from "./jwt";
import type { AuthTokenPayload } from "@/types/auth";

const COOKIE_NAME = "thesishs_session";

export async function createSession(payload: AuthTokenPayload) {
    const token = await createToken(payload);
    
    const cookieStore = await cookies();

    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
  });
        
}

export async function getSession() {
    const cookieStore = await cookies();

    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
        return null;
    }
    return verifyToken(token);
}

export async function deleteSession(){
    const cookieStore = await cookies();

    cookieStore.delete(COOKIE_NAME);
}