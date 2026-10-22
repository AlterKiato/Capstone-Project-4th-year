"use server";

import { headers } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { allowVerificationEndpoint } from "@/lib/auth/verification-endpoint-limit";
import { createMailpitVerificationDelivery } from "@/lib/email/mailpit-delivery";
import { requestStudentEmailVerification, confirmStudentEmailVerification } from "@/lib/services/email-verification.service";
import { getCurrentStudentVerificationStatus } from "@/lib/services/email-verification-status.service";
import { verificationUserIdSchema } from "@/lib/validations/email-verification";
import type { ServiceResult } from "@/types/auth";

const unavailable = (): ServiceResult => ({ success: false, message: "Email verification is unavailable. Wait a minute and try again, or return later." });
async function localRequest() {
    if (process.env.NODE_ENV !== "development" || process.env.THESISHS_LOCAL_MAILPIT !== "enabled") return false;
    try {
        const origin = new URL(process.env.THESISHS_VERIFICATION_ORIGIN ?? "");
        if (origin.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) ||
            origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/") return false;
        const requestHeaders = await headers();
        return requestHeaders.get("origin") === origin.origin && requestHeaders.get("host") === origin.host;
    } catch { return false; }
}

export async function requestVerificationAction(_previous: ServiceResult, _formData: FormData): Promise<ServiceResult> {
    void _previous; void _formData;
    try {
        if (!await localRequest()) return unavailable();
        const session = await getSession();
        const id = verificationUserIdSchema.safeParse(session?.userId);
        if (!allowVerificationEndpoint("request", id.success ? id.data : undefined)) return unavailable();
        const status = await getCurrentStudentVerificationStatus();
        if (!status) return unavailable();
        if (status.verified) return { success: true, message: "Your email is already verified." };
        return await requestStudentEmailVerification(createMailpitVerificationDelivery());
    } catch { return unavailable(); }
}

export async function confirmVerificationAction(_previous: ServiceResult, formData: FormData): Promise<ServiceResult> {
    void _previous;
    try {
        if (!await localRequest() || !allowVerificationEndpoint("confirm")) return unavailable();
        // The core validates length/format before database lookup; no identity comes from this form.
        return await confirmStudentEmailVerification(formData.get("token"));
    } catch { return unavailable(); }
}
