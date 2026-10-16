"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { getEligibilityUIAction, getConsentUIAction, recordAIEligibilityAction, recordAIConsentAction } from "@/lib/actions/ai-governance.action";
import type { EligibilityUI, ConsentUI } from "@/types/ai-governance-ui";
import ResearchDialog from "./research-dialog";
import styles from "./admin-users.module.css";
import shared from "./student-ui.module.css";

export function EligibilityDialog({ userId, userName, initiallyOpen = false, onClose }: { userId: number; userName?: string; initiallyOpen?: boolean; onClose?: () => void }) {
    const [open, setOpen] = useState(initiallyOpen);
    return <>
        {!onClose && <button type="button" onClick={() => setOpen(true)}>AI eligibility</button>}
        {open && <EligibilityForm userId={userId} userName={userName} onClose={() => { setOpen(false); onClose?.(); }} />}
    </>;
}

function EligibilityForm({ userId, userName, onClose }: { userId: number; userName?: string; onClose: () => void }) {
    const [status, setStatus] = useState<EligibilityUI | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [decision, setDecision] = useState("Pending Verification");
    const [confirmed, setConfirmed] = useState(false);
    const [revoking, setRevoking] = useState(false);
    const [uncertain, setUncertain] = useState(false);
    const [notice, setNotice] = useState("");
    useEffect(() => {
        let current = true;
        getEligibilityUIAction({ userId }).then(result => { if (current) setStatus(result); })
            .catch(() => { if (current) setStatus(null); }).finally(() => { if (current) setLoaded(true); });
        return () => { current = false; };
    }, [userId]);
    return <ResearchDialog title="Institutional AI eligibility" submitLabel={revoking ? "Confirm revocation" : "Record eligibility"} showCancel onClose={onClose}
        submitDisabled={!loaded || !status?.canDecide || !confirmed || uncertain}
        action={async () => {
            if (!status?.canDecide || !confirmed || uncertain) return { success: false, message: "Independent verifier authorization and confirmation are required." };
            try {
                const result = await recordAIEligibilityAction({ userId, decision: revoking ? "Not Eligible" : decision, revoke: revoking, confirmation: confirmed, expectedRevision: status.revision });
                setNotice(result.success ? result.message : ""); setConfirmed(false); setRevoking(false);
                setStatus(await getEligibilityUIAction({ userId }));
                return result;
            } catch {
                setUncertain(true);
                return { success: false, message: "Eligibility update could not be confirmed. Close and reopen to verify the current status before retrying. Account access is unaffected." };
            }
        }} onSuccess={() => {}}>
        {userName && <p className={styles.account}><strong>{userName}</strong></p>}
        <p className={styles.status} role="status">{!loaded ? "Loading eligibility..." : status?.available ? <>Current status: <strong>{status.decision}{status.revoked ? " (revoked)" : ""}</strong></> : "Eligibility is unavailable. Account access is unaffected."}</p>
        <p className="form-help">Normal account access is unaffected. Only an institutionally designated, independently verified Admin can certify another account. Self-approval is prohibited.</p>
        {loaded && !status?.canDecide && <p>Certification unavailable: designated verifier authority is required.</p>}
        <label>Eligibility decision<select aria-label="Eligibility decision" value={decision} disabled={!status?.canDecide || uncertain || revoking} onChange={event => { setDecision(event.target.value); setConfirmed(false); }}><option>Pending Verification</option><option>Eligible</option><option>Not Eligible</option></select></label>
        <label className={styles.checkbox}><input type="checkbox" checked={confirmed} disabled={!status?.canDecide || uncertain} onChange={event => setConfirmed(event.target.checked)} /> <span>I confirm independent institutional verification and authorization for this decision or revocation.</span></label>
        {revoking && <p className={styles.confirmation}>Revoke eligibility for this account? Existing consent will be invalidated.</p>}
        <button type="button" className={shared.toggle} disabled={!status?.canDecide || uncertain || !confirmed} onClick={() => setRevoking(!revoking)}>{revoking ? "Cancel revocation" : "Revoke eligibility"}</button>
        <p className="form-help">Groq is disabled. Eligibility does not activate AI.</p>
        <p role="status">{notice}</p>
    </ResearchDialog>;
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
