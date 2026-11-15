import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getSession } from "@/lib/auth/session";
import { getPendingVerification } from "@/lib/auth/pending-verification";
import { ROLE_IDS } from "@/lib/auth/roles";
import { emailOtpKey, OTP_COOLDOWN_MS, OTP_EXPIRY_MS, OTP_MAX_ATTEMPTS } from "@/lib/auth/email-otp-config";
import { verificationEmailSchema, verificationOtpSchema } from "@/lib/validations/email-verification";
import { withVerificationAccount, type VerificationRequest } from "@/lib/repositories/email-verification.repository";
import { allowAuthAttempt } from "./auth-rate-limit.service";
import type { VerificationCodeDelivery } from "@/lib/email/verification-delivery";
import type { ServiceResult } from "@/types/auth";

export type VerificationResult = ServiceResult<{ resendAt: number }>;
const HOUR = 3600000;
const unavailable = (): VerificationResult => ({ success: false, message: "Email verification is unavailable. Sign in again to resume, or try later." });

/** Identity comes only from a purpose-bound cookie or an eligible existing Student session. */
export async function getVerificationIdentity() {
    const pending = await getPendingVerification();
    if (pending) return pending;
    const session = await getSession();
    return session?.roleId === ROLE_IDS.STUDENT ? { userId: session.userId, email: session.email } : null;
}

function digestCode(userId: number, request: Pick<VerificationRequest, "requestedEmail" | "lastRequestedAt">, code: string) {
    return createHmac("sha256", emailOtpKey("code"))
        .update(JSON.stringify(["student-email-otp-v1", userId, request.requestedEmail, request.lastRequestedAt.toISOString(), code]))
        .digest("hex");
}

export async function requestStudentEmailVerification(delivery: VerificationCodeDelivery): Promise<VerificationResult> {
    try {
        const identity = await getVerificationIdentity();
        if (!identity || !await allowAuthAttempt("verificationRequest", String(identity.userId))) return unavailable();
        delivery.assertAvailable();
        emailOtpKey("code");
        const pending = await withVerificationAccount(identity.userId, async store => {
            const { account, now } = store;
            if (!Number.isFinite(now.getTime()) || !account?.isActive || account.roleId !== ROLE_IDS.STUDENT ||
                account.email !== identity.email || account.emailVerifiedAt || !verificationEmailSchema.safeParse(account.email).success) return null;
            const previous = await store.readRequest();
            const resendAt = previous ? previous.lastRequestedAt.getTime() + OTP_COOLDOWN_MS : 0;
            if (resendAt > now.getTime()) return { result: { success: false, message: "Wait 60 seconds between code requests.", data: { resendAt } } };
            const requestTimes = (previous?.requestTimes ?? []).filter(time => time.getTime() > now.getTime() - HOUR);
            if (requestTimes.some(time => time > now)) return null;
            if (requestTimes.length >= 5) return { result: { success: false, message: "Email limit reached. Try again after the oldest request is one hour old.",
                data: { resendAt: requestTimes[0].getTime() + HOUR } } };
            let code = randomInt(0, 1000000).toString().padStart(6, "0");
            // Even a random collision must not let the immediately previous code verify the resend.
            if (previous && digestCode(account.id, previous, code) === previous.tokenDigest)
                code = ((Number(code) + 1) % 1000000).toString().padStart(6, "0");
            const request = { userId: account.id, requestedEmail: account.email, lastRequestedAt: now,
                expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS), consumedAt: null, requestTimes: [...requestTimes, now], failedAttempts: 0 };
            await store.saveRequest({ ...request, tokenDigest: digestCode(account.id, request, code) });
            return { email: account.email, code, resendAt: now.getTime() + OTP_COOLDOWN_MS };
        });
        if (!pending) return unavailable();
        if ("result" in pending) return pending.result!;
        // No SMTP inside the lock. Failed/uncertain delivery keeps the challenge AND quota.
        try { await delivery.sendVerificationCode(pending.email, pending.code); }
        catch { return { success: false, message: "Email delivery could not be confirmed. Check your inbox, then request another code after the cooldown.", data: { resendAt: pending.resendAt } }; }
        return { success: true, message: "Code submitted for delivery. Check your inbox and spam folder.", data: { resendAt: pending.resendAt } };
    } catch { return unavailable(); }
}

export async function confirmStudentEmailVerification(input: unknown): Promise<VerificationResult> {
    try {
        const identity = await getVerificationIdentity();
        if (!identity || !await allowAuthAttempt("verificationConfirm")) return unavailable();
        const parsed = verificationOtpSchema.safeParse(input);
        return await withVerificationAccount(identity.userId, async store => {
            const { account, now } = store;
            if (!Number.isFinite(now.getTime()) || !account?.isActive || account.roleId !== ROLE_IDS.STUDENT ||
                account.email !== identity.email || account.emailVerifiedAt) return unavailable();
            const request = await store.readRequest();
            if (!request || request.consumedAt || request.requestedEmail !== account.email || request.lastRequestedAt > now)
                return { success: false, message: "This code is unavailable or already used. Request a new code." };
            if (request.failedAttempts >= OTP_MAX_ATTEMPTS) return { success: false, message: "Five incorrect attempts. Request a new code." };
            if (request.expiresAt <= now) return { success: false, message: "This code has expired. Request a new code." };
            const expected = Buffer.from(request.tokenDigest, "hex");
            const supplied = parsed.success ? Buffer.from(digestCode(account.id, request, parsed.data), "hex") : Buffer.alloc(32);
            if (!parsed.success || expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
                await store.recordFailure(request.tokenDigest);
                return { success: false, message: request.failedAttempts + 1 >= OTP_MAX_ATTEMPTS
                    ? "Five incorrect attempts. Request a new code." : "Incorrect code. Enter the newest six-digit code." };
            }
            await store.consume(request.tokenDigest, account.email);
            return { success: true, message: "Email verified. Continue to login with your password." };
        });
    } catch { return unavailable(); }
}
