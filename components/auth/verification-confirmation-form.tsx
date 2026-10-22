"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { confirmVerificationAction } from "@/lib/actions/email-verification.action";

export default function VerificationConfirmationForm({ enabled }: { enabled: boolean }) {
    const [link, setLink] = useState<{ token: string | null; revision: number }>({ token: null, revision: 0 });
    const captured = useRef(false);
    useEffect(() => {
        const capture = () => {
            const fragment = window.location.hash;
            if (!fragment && captured.current) return; // Strict Mode must not erase the captured link.
            captured.current = true;
            const values = fragment.length <= 80 ? new URLSearchParams(fragment.slice(1)).getAll("token") : [];
            window.history.replaceState(null, "", window.location.pathname);
            setLink(previous => ({ token: values.length === 1 && /^[a-f0-9]{64}$/.test(values[0]) ? values[0] : "", revision: previous.revision + 1 }));
        };
        capture();
        window.addEventListener("hashchange", capture);
        return () => window.removeEventListener("hashchange", capture);
    }, []);
    return <ConfirmationSubmit key={link.revision} token={link.token} enabled={enabled} />;
}

function ConfirmationSubmit({ token, enabled }: { token: string | null; enabled: boolean }) {
    const [state, action, pending] = useActionState(confirmVerificationAction, { success: false, message: "" });
    return <form action={action} className="dashboard-form auth-form" aria-busy={pending}>
        <input type="hidden" name="token" value={state.success ? "" : token ?? ""} />
        <noscript>Enable JavaScript in this browser to confirm this private link.</noscript>
        {token === null && <p role="status">Reading your private link...</p>}
        {token === "" && <p role="status">This link is missing or invalid. Sign in to request a new verification email.</p>}
        <button type="submit" disabled={!token || !enabled || pending || state.success}>{pending ? "Confirming email..." : "Confirm my email"}</button>
        <p role="status" aria-live="polite" className={state.message ? state.success ? "verification-message" : "form-message" : undefined}>{state.message}</p>
    </form>;
}
