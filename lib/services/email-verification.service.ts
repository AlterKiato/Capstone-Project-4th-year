import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getSession } from "@/lib/auth/session";
import { ROLE_IDS } from "@/lib/auth/roles";
import { verificationEmailSchema, verificationTokenSchema, verificationUserIdSchema } from "@/lib/validations/email-verification";
import { findVerificationUserId, withVerificationAccount } from "@/lib/repositories/email-verification.repository";
import type { VerificationDelivery } from "@/lib/email/verification-delivery";
import type { ServiceResult } from "@/types/auth";

const HOUR = 60 * 60 * 1000;
const COOLDOWN = 60 * 1000;
const unavailable = (): ServiceResult => ({ success: false, message: "Email verification is unavailable. Please try again later." });
const invalid = (): ServiceResult => ({ success: false, message: "This verification link is invalid or expired. Request a new link." });
const digestToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Internal server entry: self-service only, no caller-supplied account ID or email. */
export async function requestStudentEmailVerification(delivery: VerificationDelivery): Promise<ServiceResult> {
    try {
        delivery.assertAvailable();
        const session = await getSession();
        if (!session || session.roleId !== ROLE_IDS.STUDENT || !verificationUserIdSchema.safeParse(session.userId).success)
            return unavailable();
        const pending = await withVerificationAccount(session.userId, async store => {
            const { account, now } = store;
            if (!account?.isActive || account.roleId !== ROLE_IDS.STUDENT || account.emailVerifiedAt ||
                !verificationEmailSchema.safeParse(account.email).success) return null;
            const previous = await store.readRequest();
            if (previous && now.getTime() - previous.lastRequestedAt.getTime() < COOLDOWN) return null;
            const requestTimes = (previous?.requestTimes ?? []).filter(time => time.getTime() > now.getTime() - HOUR);
            if (requestTimes.length >= 5) return null;
            const token = randomBytes(32).toString("hex");
            await store.saveRequest({ userId: account.id, requestedEmail: account.email, tokenDigest: digestToken(token),
                expiresAt: new Date(now.getTime() + HOUR), consumedAt: null, lastRequestedAt: now,
                requestTimes: [...requestTimes, now] });
            return { email: account.email, token };
        });
        if (!pending) return unavailable();
        // Delivery occurs only after commit, outside the account lock. Failed/uncertain sends
        // retain their request and quota; the next allowed resend replaces the token safely.
        await delivery.sendVerificationLink(pending.email, pending.token);
        return { success: true, message: "Verification instructions were submitted for delivery. Check your email." };
    } catch { return unavailable(); }
}

/** Explicit confirmation only. No GET route, session creation, or automatic login. */
export async function confirmStudentEmailVerification(input: unknown): Promise<ServiceResult> {
    const parsed = verificationTokenSchema.safeParse(input);
    if (!parsed.success) return invalid();
    try {
        const digest = digestToken(parsed.data);
        const userId = await findVerificationUserId(digest);
        const parsedUserId = verificationUserIdSchema.safeParse(userId);
        if (!parsedUserId.success) return invalid();
        return await withVerificationAccount(parsedUserId.data, async store => {
            const { account, now } = store;
            if (!account?.isActive || account.roleId !== ROLE_IDS.STUDENT || account.emailVerifiedAt) return invalid();
            const request = await store.readRequest();
            if (!request || request.tokenDigest !== digest || request.consumedAt || request.expiresAt <= now ||
                request.lastRequestedAt > now || request.requestedEmail !== account.email) return invalid();
            await store.consume(digest, account.email);
            return { success: true, message: "Email verified. You can sign in using your existing password." };
        });
    } catch { return invalid(); }
}
