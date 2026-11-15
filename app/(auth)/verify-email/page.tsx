import type { Metadata } from "next";
import Link from "next/link";
import VerificationConfirmationForm from "@/components/auth/verification-confirmation-form";
import { getStudentOtpStatus } from "@/lib/services/email-verification-status.service";
import { emailOtpDeliveryMode } from "@/lib/auth/email-otp-config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Verify email | ThesiSHS AI", referrer: "no-referrer", robots: { index: false, follow: false } };

export default async function ConfirmEmailPage({ searchParams }: { searchParams: Promise<{ delivery?: string }> }) {
    const [status, query] = await Promise.all([getStudentOtpStatus(), searchParams]);
    const enabled = emailOtpDeliveryMode() !== null;
    return <main className="auth-page">
        <p className="product-name">ThesiSHS AI</p>
        <h1>Verify your email</h1>
        {!status ? <p role="status">Sign in with your email and password to resume verification. No new account is needed.</p>
            : status.verified ? <p role="status">Email verified. Continue to login with your password.</p> : <>
                <p>Your account is saved. Enter the six-digit code sent to <strong className="verification-email">{status.email}</strong> to confirm your email.</p>
                <p>Codes expire after five minutes. Only the newest code works.</p>
                {query.delivery === "unconfirmed" && <p role="status">Email delivery could not be confirmed. Check your inbox and spam folder, then use Resend code after the cooldown.</p>}
                {!enabled && <p role="status">Email delivery is currently unavailable. Your account is saved; sign in again to resume when delivery is available.</p>}
                <VerificationConfirmationForm enabled={enabled} resendAt={status.resendAt} />
            </>}
        <p className="auth-switch"><Link href="/login">Continue to password login</Link></p>
        <p className="auth-switch"><Link href="/">Back to home</Link></p>
    </main>;
}
