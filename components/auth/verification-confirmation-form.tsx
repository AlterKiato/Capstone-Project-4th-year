"use client";

import { useActionState } from "react";
import { confirmVerificationAction } from "@/lib/actions/email-verification.action";
import VerificationRequestForm from "./verification-request-form";
import type { VerificationResult } from "@/lib/services/email-verification.service";

const initial: VerificationResult = { success: false, message: "" };

export default function VerificationConfirmationForm({ enabled, resendAt = 0 }: { enabled: boolean; resendAt?: number }) {
    const [state, action, pending] = useActionState(confirmVerificationAction, initial);
    return <>
        <form action={action} className="dashboard-form auth-form" aria-busy={pending}>
            <label htmlFor="verification-code">Six-digit code</label>
            <input id="verification-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code"
                pattern="[0-9]{6}" minLength={6} maxLength={6} required
                aria-describedby="verification-code-help verification-code-result" disabled={pending || state.success} />
            <p id="verification-code-help" className="form-help">Paste the complete code, including any leading zeros. Five incorrect attempts require a new code.</p>
            <button type="submit" disabled={pending || state.success}>{pending ? "Verifying..." : "Verify email"}</button>
            <p id="verification-code-result" role="status" aria-live="polite" aria-atomic="true"
                className={state.message ? state.success ? "verification-message" : "form-message" : undefined}>{state.message}</p>
        </form>
        {!state.success && <VerificationRequestForm enabled={enabled} resendAt={resendAt} />}
    </>;
}
