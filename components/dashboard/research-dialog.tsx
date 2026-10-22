"use client";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import styles from "./student-ui.module.css";

export default function ResearchDialog({ title, children, submitLabel, action, onSuccess, onClose, showCancel = false, submitDisabled = false, busy = false, transferControls }: {
    title: string; children: ReactNode; submitLabel: string;
    action: (data: FormData) => Promise<{ success: boolean; message: string; projectId?: number; keepOpen?: boolean }>;
    onSuccess: (projectId?: number) => void; onClose: () => void;
    showCancel?: boolean; submitDisabled?: boolean; busy?: boolean;
    transferControls?: ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const locked = useRef(false);
    const dirty = useRef(false);
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState("");
    const [positive, setPositive] = useState(false);
    const id = useId();
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        const dialog = ref.current!;
        dialog.showModal();
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus(); };
    }, []);
    useEffect(() => {
        const protect = (event: BeforeUnloadEvent) => { if (dirty.current || locked.current) event.preventDefault(); };
        window.addEventListener("beforeunload", protect);
        return () => window.removeEventListener("beforeunload", protect);
    }, []);
    useEffect(() => {
        const dialog = ref.current;
        if (!pending && !busy && dialog?.open && !dialog.contains(document.activeElement)) {
            dialog.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
        }
    }, [pending, busy]);
    function dismiss() {
        if (locked.current || busy) return;
        if (!dirty.current || window.confirm("Discard the information entered in this form?")) onClose();
    }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (locked.current || busy) return;
        const data = new FormData(event.currentTarget);
        locked.current = true; setPending(true); setMessage("");
        try {
            const result = await action(data);
            if (result.success && !result.keepOpen) { dirty.current = false; onSuccess(result.projectId); }
            else { setMessage(result.message); setPositive(result.success); }
        } catch { setMessage("The request could not be confirmed. Check your connection and reload before retrying."); }
        finally { locked.current = false; setPending(false); }
    }
    return <dialog ref={ref} className={styles.dialog} aria-labelledby={id} onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(element => element.getClientRects().length > 0);
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }} onCancel={event => { event.preventDefault(); dismiss(); }} onClick={event => {
        if (event.target !== ref.current) return;
        const bounds = ref.current.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dismiss();
    }}>
        <div className={styles.dialogHeader}><h2 id={id}>{title}</h2><button type="button" className={styles.toggle} onClick={dismiss} disabled={pending || busy} aria-label={`Close ${title}`}>Close</button></div>
        <form onSubmit={submit} onChange={() => { dirty.current = true; }} aria-busy={pending || busy}>
            <fieldset disabled={pending || busy}>{children}<button type="submit" disabled={submitDisabled}>{pending ? "Saving…" : submitLabel}</button>
                {showCancel && <button type="button" className={`${styles.toggle} ${styles.cancel}`} onClick={dismiss}>Cancel</button>}
            </fieldset>
            {transferControls}
            <p role="status" className={message ? positive ? "form-help" : "form-message" : undefined}>{message}</p>
        </form>
    </dialog>;
}
