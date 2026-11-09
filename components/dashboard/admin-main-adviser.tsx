"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { designateMainAdviserAction } from "@/lib/actions/research-supervision.action";
import type { MainAdviserChoice, MainAdviserConfiguration } from "@/types/research-supervision";
import ResearchDialog from "./research-dialog";
import styles from "./admin-users.module.css";

const label = (adviser: MainAdviserChoice) => `${adviser.firstName} ${adviser.lastName} (${adviser.email})`;

export default function AdminMainAdviser({ configuration }: { configuration: MainAdviserConfiguration }) {
    const router = useRouter();
    const [refreshing, startRefresh] = useTransition();
    const [selectedId, setSelectedId] = useState("");
    const [confirmation, setConfirmation] = useState<{ target: MainAdviserChoice; current: MainAdviserConfiguration["current"]; revision: number } | null>(null);
    const [requiresRefresh, setRequiresRefresh] = useState(false);
    const [notice, setNotice] = useState("");
    const trigger = useRef<HTMLButtonElement>(null);
    const selected = configuration.eligibleAdvisers.find(adviser => adviser.id === Number(selectedId));
    function close() { setConfirmation(null); requestAnimationFrame(() => trigger.current?.focus()); }
    function refresh() { close(); setRequiresRefresh(false); setSelectedId(""); startRefresh(() => router.refresh()); }
    return <section className={`dashboard-panel ${styles.directory} ${styles.designation}`} aria-labelledby="main-adviser-heading" aria-busy={refreshing}>
        <h2 id="main-adviser-heading">Main Research Adviser</h2>
        <p className={styles.account}>{configuration.current ? <>Currently designated: <strong>{label(configuration.current)}</strong></> : "No Main Research Adviser has been designated."}</p>
        {configuration.current && !configuration.current.eligible && <p role="alert" className="form-message">The designated account is no longer an active Adviser. Select an eligible replacement.</p>}
        <div className={styles.designationControls}>
            <label>Eligible Adviser<select value={selectedId} disabled={refreshing || requiresRefresh || !configuration.eligibleAdvisers.length} onChange={event => setSelectedId(event.target.value)}>
                <option value="">Select an active Adviser</option>
                {configuration.eligibleAdvisers.map(adviser => <option key={adviser.id} value={adviser.id}>{label(adviser)}</option>)}
            </select></label>
            <button ref={trigger} disabled={refreshing || requiresRefresh || !selected || selected.id === configuration.current?.id} onClick={() => {
                if (!selected) return;
                setConfirmation({ target: selected, current: configuration.current, revision: configuration.revision });
            }}>Review designation</button>
        </div>
        {!configuration.eligibleAdvisers.length && <p className="form-help">No active Adviser accounts are available. Create or activate an Adviser account first.</p>}
        <p role="status" className={notice || refreshing ? "research-notice" : undefined}>{refreshing ? "Updating Main Research Adviser..." : notice}</p>
        {requiresRefresh && !confirmation && <button type="button" onClick={refresh}>Refresh designation</button>}
        {confirmation && <ResearchDialog title={confirmation.current ? "Replace Main Research Adviser" : "Designate Main Research Adviser"}
            submitLabel="Confirm designation" showCancel submitDisabled={requiresRefresh} onClose={close}
            action={async () => {
                try {
                    const result = await designateMainAdviserAction({ mainAdviserId: confirmation.target.id, expectedRevision: confirmation.revision, confirmed: true });
                    if (!result.success && result.kind !== "validation") setRequiresRefresh(true);
                    if (result.success) setNotice(result.message);
                    return result;
                } catch {
                    setRequiresRefresh(true);
                    return { success: false, message: "The designation could not be confirmed. Refresh and verify the current Main Research Adviser before retrying." };
                }
            }} onSuccess={refresh}>
            <div className={styles.confirmation}>
                <p>Current: {confirmation.current ? label(confirmation.current) : "Unconfigured"}</p>
                <p>{confirmation.current ? "Replace with" : "Designate"}: <strong>{label(confirmation.target)}</strong>?</p>
            </div>
            <p className="form-help">Historical research group associations and recorded feedback remain unchanged.</p>
            {requiresRefresh && <><p role="alert">Further changes are paused until you refresh and verify the current designation.</p><button type="button" onClick={refresh}>Refresh designation</button></>}
        </ResearchDialog>}
    </section>;
}
