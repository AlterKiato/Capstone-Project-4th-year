"use client";

import { useActionState } from "react";
import { requestVerificationAction } from "@/lib/actions/email-verification.action";

export default function VerificationRequestForm({ enabled }: { enabled: boolean }) {
    const [state, action, pending] = useActionState(requestVerificationAction, { success: false, message: "" });
    return <form action={action} className="dashboard-form auth-form" aria-busy={pending}>
        <button type="submit" disabled={pending || !enabled}>{pending ? "Requesting email..." : state.success ? "Resend verification email" : "Request verification email"}</button>
        <p role="status" aria-live="polite" className={state.message ? state.success ? "verification-message" : "form-message" : undefined}>{state.message}</p>
    </form>;
}
