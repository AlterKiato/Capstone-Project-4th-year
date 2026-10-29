import { ROLE_IDS } from "@/lib/auth/roles";
import { createMobileToken, MobileAuthenticationUnavailableError } from "@/lib/auth/mobile-jwt";
import { mobileError, mobileSuccess, readMobileCredentials, safeStudent } from "@/lib/auth/mobile-http";
import { validateCredentials } from "@/lib/services/auth.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const body = await readMobileCredentials(request);
        if (body.status !== "valid") return mobileError(body.code);
        const result = await validateCredentials(body.input, ROLE_IDS.STUDENT);
        switch (result.status) {
            case "invalid_credentials": return mobileError("INVALID_CREDENTIALS");
            case "ineligible_account": return mobileError("STUDENT_ACCESS_REQUIRED");
            case "rate_limited": return mobileError("AUTH_RATE_LIMITED");
            case "unavailable": return mobileError("AUTH_UNAVAILABLE");
            case "authenticated": {
                if (result.user.roleId !== ROLE_IDS.STUDENT) return mobileError("STUDENT_ACCESS_REQUIRED");
                const issued = await createMobileToken(result.user);
                return mobileSuccess("AUTHENTICATED", { user: safeStudent(result.user), ...issued });
            }
        }
    } catch (error) {
        return mobileError(error instanceof MobileAuthenticationUnavailableError ? "AUTH_UNAVAILABLE" : "INTERNAL_ERROR");
    }
}
