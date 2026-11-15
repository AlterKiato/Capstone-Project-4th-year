"use server";

import { emailOtpDeliveryMode } from "@/lib/auth/email-otp-config";
import { createMailpitVerificationDelivery } from "@/lib/email/mailpit-delivery";
import { createGmailVerificationDelivery } from "@/lib/email/gmail-delivery";
import { requestStudentEmailVerification, confirmStudentEmailVerification, type VerificationResult } from "@/lib/services/email-verification.service";

export async function requestVerificationAction(_previous: VerificationResult, _formData: FormData): Promise<VerificationResult> {
    void _previous; void _formData;
    try {
        const mode = emailOtpDeliveryMode();
        if (!mode) return { success: false, message: "Email delivery is currently unavailable. Your account is saved. Sign in again to resume verification later." };
        return await requestStudentEmailVerification(mode === "mailpit" ? createMailpitVerificationDelivery() : createGmailVerificationDelivery());
    } catch { return { success: false, message: "Email delivery is unavailable. Sign in again to resume verification later." }; }
}

export async function confirmVerificationAction(_previous: VerificationResult, formData: FormData): Promise<VerificationResult> {
    void _previous;
    const result = await confirmStudentEmailVerification(formData.get("code"));
    // Keep the restricted identity until password login so refresh can show success.
    // It grants no dashboard access, and verified/consumed challenges cannot be reused.
    return result;
}
