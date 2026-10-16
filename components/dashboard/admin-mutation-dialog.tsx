"use client";
import { useRef, useState } from "react";
import ResearchDialog from "./research-dialog";
import styles from "./admin-management.module.css";

/** Confirmed writes refresh through the parent; uncertain writes require state verification. */
export default function AdminMutationDialog({ title, explanation, label, action, onClose, onComplete, onUncertain }: {
    title: string; explanation: string; label: string;
    action: () => Promise<{ success: boolean; message: string; uncertain?: boolean }>;
    onClose: () => void; onComplete: (message: string) => void; onUncertain: () => void;
}) {
    const [uncertain, setUncertain] = useState(false);
    const message = useRef("");
    return <ResearchDialog title={title} submitLabel={`Confirm ${label.toLowerCase()}`} showCancel submitDisabled={uncertain}
        onClose={onClose} onSuccess={() => onComplete(message.current)} action={async () => {
            let result;
            try { result = await action(); }
            catch { result = { success: false, uncertain: true, message: "The request could not be confirmed. Refresh and verify the current state before retrying." }; }
            message.current = result.message;
            if (result.uncertain) { setUncertain(true); onUncertain(); }
            return result;
        }}>
        <p className={styles.confirmation}>{explanation}</p>
        {uncertain && <div role="alert"><p>Further changes are paused. Refresh and verify the current state before retrying.</p><button type="button" onClick={() => window.location.reload()}>Refresh and verify</button></div>}
    </ResearchDialog>;
}
