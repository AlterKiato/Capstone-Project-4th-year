import "server-only";
import { getSession } from "@/lib/auth/session";
import { ROLE_IDS } from "@/lib/auth/roles";
import { verificationUserIdSchema } from "@/lib/validations/email-verification";
import { readVerificationAccount } from "@/lib/repositories/email-verification.repository";
import { getVerificationIdentity } from "./email-verification.service";
import { withVerificationAccount } from "@/lib/repositories/email-verification.repository";
import { OTP_COOLDOWN_MS } from "@/lib/auth/email-otp-config";

export async function getCurrentStudentVerificationStatus() {
    try {
        const session = await getSession();
        if (session?.roleId !== ROLE_IDS.STUDENT || !verificationUserIdSchema.safeParse(session.userId).success) return null;
        const account = await readVerificationAccount(session.userId);
        if (!account?.isActive || account.roleId !== ROLE_IDS.STUDENT) return null;
        return { email: account.email, verified: account.emailVerifiedAt !== null };
    } catch { return null; }
}

export async function getStudentOtpStatus() {
    try {
        const identity = await getVerificationIdentity();
        if (!identity) return null;
        return await withVerificationAccount(identity.userId, async store => {
            const { account, now } = store;
            if (!account?.isActive || account.roleId !== ROLE_IDS.STUDENT || account.email !== identity.email) return null;
            const request = await store.readRequest();
            const times = (request?.requestTimes ?? []).filter(time => time.getTime() > now.getTime() - 3600000);
            return { email: account.email, verified: account.emailVerifiedAt !== null,
                resendAt: Math.max(request ? request.lastRequestedAt.getTime() + OTP_COOLDOWN_MS : 0,
                    times.length >= 5 ? times[0].getTime() + 3600000 : 0) };
        });
    } catch { return null; }
}
