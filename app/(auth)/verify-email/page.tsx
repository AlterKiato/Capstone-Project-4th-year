import type { Metadata } from "next";
import Link from "next/link";
import VerificationConfirmationForm from "@/components/auth/verification-confirmation-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirm email | ThesiSHS AI", referrer: "no-referrer", robots: { index: false, follow: false } };

export default function ConfirmEmailPage() {
    const enabled = process.env.NODE_ENV === "development" && process.env.THESISHS_LOCAL_MAILPIT === "enabled";
    return <main className="auth-page">
        <p className="product-name">ThesiSHS AI</p>
        <h1>Confirm your email</h1>
        <p>Press Confirm my email to verify ownership of your registered email address. Opening this page does not verify it.</p>
        {!enabled && <p role="status">Email confirmation is currently unavailable. You can continue using your account.</p>}
        <VerificationConfirmationForm enabled={enabled} />
        <p className="auth-switch"><Link href="/login">Continue to password login</Link></p>
        <p className="auth-switch">If your link is invalid, expired or already used, <Link href="/dashboard/student/verify-email">sign in to check verification status or request a new link</Link>.</p>
    </main>;
}
