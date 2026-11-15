"use client";

import { useActionState, useEffect, useState } from "react";
import { requestVerificationAction } from "@/lib/actions/email-verification.action";
import type { VerificationResult } from "@/lib/services/email-verification.service";

const initial: VerificationResult = { success: false, message: "" };

export default function VerificationRequestForm({ enabled, resendAt = 0 }: { enabled: boolean; resendAt?: number }) {
    const [state, action, pending] = useActionState(requestVerificationAction, initial);
    const until = Math.max(resendAt, state.data?.resendAt ?? 0);
    const [seconds, setSeconds] = useState<number | null>(null);
    useEffect(() => {
        const update = () => setSeconds(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
        const timer = window.setInterval(update, 1000);
        // Schedule the first refresh alongside subsequent ticks; no synchronous effect update.
        const first = window.setTimeout(update, 0);
        return () => { window.clearInterval(timer); window.clearTimeout(first); };
    }, [until]);
    return <form action={action} className="dashboard-form auth-form" aria-busy={pending}>
        <button type="submit" disabled={pending || !enabled || (seconds === null ? until > 0 : seconds > 0)}>
            {pending ? "Sending..." : seconds === null && until > 0 ? "Checking resend cooldown..." : seconds !== null && seconds > 0 ? `Resend available in ${seconds}s` : "Resend code"}
        </button>
        <p className="form-help">Wait at least 60 seconds between requests. Up to five emails per rolling hour.</p>
        <p role="status" aria-live="polite" aria-atomic="true"
            className={state.message ? state.success ? "verification-message" : "form-message" : undefined}>{state.message}</p>
    </form>;
}
