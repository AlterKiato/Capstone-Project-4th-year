import "server-only";
import { getSession } from "@/lib/auth/session";
import { ROLE_IDS } from "@/lib/auth/roles";
import { verificationUserIdSchema } from "@/lib/validations/email-verification";
import { readVerificationAccount } from "@/lib/repositories/email-verification.repository";

export async function getCurrentStudentVerificationStatus() {
    try {
        const session = await getSession();
        if (session?.roleId !== ROLE_IDS.STUDENT || !verificationUserIdSchema.safeParse(session.userId).success) return null;
        const account = await readVerificationAccount(session.userId);
        if (!account?.isActive || account.roleId !== ROLE_IDS.STUDENT) return null;
        return { email: account.email, verified: account.emailVerifiedAt !== null };
    } catch { return null; }
}
