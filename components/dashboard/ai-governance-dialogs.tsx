"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { getEligibilityUIAction, getConsentUIAction, recordAIEligibilityAction, recordAIConsentAction } from "@/lib/actions/ai-governance.action";
import type { EligibilityUI, ConsentUI } from "@/types/ai-governance-ui";

export function EligibilityDialog({ userId, initiallyOpen = false }: { userId: number; initiallyOpen?: boolean }) {
    const dialog = useRef<HTMLDialogElement>(null);
    const [status, setStatus] = useState<EligibilityUI | null>(null);
    const initiallyShown = useRef(false);
    const [decision, setDecision] = useState("Pending Verification");
    const [confirmed, setConfirmed] = useState(false);
    const [message, setMessage] = useState("");
    const [pending, start] = useTransition();
    function open() {
        setConfirmed(false); setDecision("Pending Verification"); setMessage(""); dialog.current?.showModal();
        start(async () => { try { setStatus(await getEligibilityUIAction({ userId })); } catch { setStatus(null); setMessage("Eligibility is unavailable. Account access is unaffected."); } });
    }
    function save(revoke: boolean) {
        if (!status || !confirmed) return;
        start(async () => {
            try {
                const result = await recordAIEligibilityAction({ userId, decision: revoke ? "Not Eligible" : decision, revoke, confirmation: confirmed, expectedRevision: status.revision });
                setMessage(result.message); setConfirmed(false); setStatus(await getEligibilityUIAction({ userId }));
            } catch { setMessage("Eligibility update unavailable. Account access is unaffected."); }
        });
    }
    return <>
        <button type="button" ref={node => { if (node && initiallyOpen && !initiallyShown.current) { initiallyShown.current = true; queueMicrotask(open); } }} onClick={open}>AI eligibility</button>
        <dialog ref={dialog} className="governance-dialog" aria-labelledby={`eligibility-title-${userId}`} onCancel={() => setConfirmed(false)}>
            <h2 id={`eligibility-title-${userId}`}>Institutional AI eligibility</h2>
            <p>Current status: {status?.decision ?? "Pending Verification"}{status?.revoked ? " (revoked)" : ""}</p>
            <p>Normal account access is unaffected. Only an institutionally designated, independently verified Admin can certify another account.</p>
            {!status?.canDecide && <p>Certification unavailable: designated verifier authority is required. Self-approval is prohibited.</p>}
            <label>Eligibility decision <select aria-label="Eligibility decision" value={decision} disabled={pending || !status?.canDecide} onChange={e => { setDecision(e.target.value); setConfirmed(false); }}>
                <option>Pending Verification</option><option>Eligible</option><option>Not Eligible</option>
            </select></label>
            <label style={{display:"block"}}><input type="checkbox" checked={confirmed} disabled={pending || !status?.canDecide} onChange={e => setConfirmed(e.target.checked)} /> I confirm independent institutional verification and authorization for this decision or revocation.</label>
            <button type="button" disabled={pending || !status?.canDecide || !confirmed} onClick={() => save(false)}>Record eligibility</button>
            <button type="button" disabled={pending || !status?.canDecide || !confirmed} onClick={() => save(true)}>Revoke eligibility</button>
            <p role="status">{message}</p>
            <button type="button" disabled={pending} onClick={() => dialog.current?.close()}>Close</button>
        </dialog>
    </>;
}

export function ConsentDialog() {
    const dialog = useRef<HTMLDialogElement>(null);
    const [status, setStatus] = useState<ConsentUI | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [message, setMessage] = useState("");
    const [pending, start] = useTransition();
    useEffect(() => {
        let cancelled = false;
        // First eligible use requires explicit consent; closing keeps static guidance usable.
        void getConsentUIAction().then(current => {
            if (cancelled) return;
            setStatus(current);
            if (current.available && current.eligible && !current.accepted && !dialog.current?.open) dialog.current?.showModal();
        }).catch(() => { /* No registry/status response must not block static workflows. */ });
        return () => { cancelled = true; };
    }, []);
    function open() {
        setConfirmed(false); setMessage(""); dialog.current?.showModal();
        start(async () => { try { setStatus(await getConsentUIAction()); } catch { setStatus(null); setMessage("Consent settings unavailable. Static guidance remains available."); } });
    }
    function save(action: "accept" | "decline" | "withdraw") {
        if (!status || (action === "accept" && !confirmed)) return;
        start(async () => {
            try {
                const request = action === "withdraw" ? { action, expectedRevision: status.consentRevision }
                    : action === "accept" ? { action, termsVersion: status.termsVersion, acceptance: confirmed, expectedRevision: status.consentRevision }
                    : { action, termsVersion: status.termsVersion, expectedRevision: status.consentRevision };
                const result = await recordAIConsentAction(request);
                setMessage(result.message); setConfirmed(false); setStatus(await getConsentUIAction());
            } catch { setMessage("Consent update unavailable. Static guidance remains available."); }
        });
    }
    return <>
        <button type="button" onClick={open}>AI Terms &amp; Consent</button>
        <dialog ref={dialog} className="governance-dialog" aria-labelledby="ai-consent-title" onCancel={() => setConfirmed(false)}>
            <h2 id="ai-consent-title">AI Terms &amp; Consent</h2>
            <p>Groq is disabled. Accepting does not enable AI or affect normal system access.</p>
            <p>Consent: {status?.accepted ? "Accepted current version" : "Not accepted for current eligibility and terms"}</p>
            <p>Version: {status?.termsVersion ?? "Loading"}</p><p style={{maxWidth:680,whiteSpace:"pre-wrap"}}>{status?.termsText}</p>
            {!status?.eligible && <p>Institutional eligibility is pending, denied or unavailable. Static guidance remains available.</p>}
            <label style={{display:"block"}}><input type="checkbox" checked={confirmed} disabled={pending || !status?.available || !status.eligible} onChange={e => setConfirmed(e.target.checked)} /> I explicitly accept this version for optional AI preparation.</label>
            <button type="button" disabled={pending || !confirmed || !status?.eligible} onClick={() => save("accept")}>Accept terms</button>
            <button type="button" disabled={pending || !status?.available} onClick={() => save("decline")}>Decline / use static guidance</button>
            <button type="button" disabled={pending || !status?.available || status.consentRevision === 0} onClick={() => save("withdraw")}>Withdraw consent</button>
            <p role="status">{message}</p>
            <button type="button" disabled={pending} onClick={() => dialog.current?.close()}>Close</button>
        </dialog>
    </>;
}
