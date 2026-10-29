import { ROLE_IDS } from "@/lib/auth/roles";
import { verifyMobileToken } from "@/lib/auth/mobile-jwt";
import { resolveCurrentAccount } from "@/lib/auth/account-principal";
import { mobileBearer, mobileError, mobileSuccess, safeStudent } from "@/lib/auth/mobile-http";
import { checkMobileSessionIngress, checkMobileSessionAccount } from "@/lib/services/auth-rate-limit.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const ingress = await checkMobileSessionIngress(request.headers);
        if (ingress.status !== "allowed") return mobileError(ingress.status === "limited" ? "AUTH_RATE_LIMITED" : "AUTH_UNAVAILABLE", true);
        const token = mobileBearer(request);
        if (!token) return mobileError("SESSION_INVALID", true);
        const verified = await verifyMobileToken(token);
        if (verified.status !== "valid") return mobileError(verified.status === "invalid" ? "SESSION_INVALID" : "AUTH_UNAVAILABLE", true);
        const accountAdmission = await checkMobileSessionAccount(verified.claims);
        if (accountAdmission.status !== "allowed")
            return mobileError(accountAdmission.status === "limited" ? "AUTH_RATE_LIMITED" : "AUTH_UNAVAILABLE", true);
        const account = await resolveCurrentAccount(verified.claims);
        if (account.status !== "active") return mobileError(account.status === "invalid" ? "SESSION_INVALID" : "AUTH_UNAVAILABLE", true);
        if (account.user.roleId !== ROLE_IDS.STUDENT) return mobileError("STUDENT_ACCESS_REQUIRED", true);
        return mobileSuccess("SESSION_VALID", {
            user: safeStudent(account.user), expiresAt: new Date(verified.claims.exp * 1000).toISOString(),
        });
    } catch { return mobileError("INTERNAL_ERROR", true); }
}
