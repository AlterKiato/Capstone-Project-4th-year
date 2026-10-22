import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getCurrentStudentVerificationStatus } from "@/lib/services/email-verification-status.service";
import VerificationRequestForm from "@/components/auth/verification-request-form";

export const metadata: Metadata = { title: "Email verification | ThesiSHS AI", referrer: "no-referrer", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function VerificationStatusPage() {
    await requireRole([ROLE_IDS.STUDENT]);
    const status = await getCurrentStudentVerificationStatus();
    if (!status) return <main className="dashboard-page"><h1>Email verification unavailable</h1><p role="alert">Your account access could not be verified. Sign out and sign in again.</p></main>;
    const enabled = process.env.NODE_ENV === "development" && process.env.THESISHS_LOCAL_MAILPIT === "enabled";
    return <main className="dashboard-page">
        <h1>Email verification</h1>
        <p className="dashboard-context">Verification is optional during this stage. Your research workspace remains available.</p>
        <section className="dashboard-panel" aria-labelledby="verification-heading">
            <h2 id="verification-heading">{status.verified ? "Email verified" : "Email not verified"}</h2>
            <p className="verification-email">{status.email}</p>
            {status.verified ? <p>Your email ownership has been confirmed.</p> : <>
                <p>Links expire after 60 minutes. Wait at least 60 seconds between requests. You can request up to five emails per rolling hour.</p>
                <p>If a message does not arrive, check your inbox and spam folder, then request a new link after the wait. Only the newest link works.</p>
                {!enabled && <p role="status">Email delivery is currently unavailable. You can continue using your account.</p>}
                <VerificationRequestForm enabled={enabled} />
            </>}
        </section>
        <p><Link href="/dashboard/student">Return to Student dashboard</Link></p>
    </main>;
}
