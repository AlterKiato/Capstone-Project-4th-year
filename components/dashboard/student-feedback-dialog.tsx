"use client";
import { useEffect, useId, useRef } from "react";
import FeedbackContent from "@/components/feedback-content";
import styles from "./student-ui.module.css";

export default function StudentFeedbackDialog({ version, decision, reviewedAt, comments, onClose }: {
    version: string; decision: string; reviewedAt: string; comments: string; onClose: () => void;
}) {
    const ref = useRef<HTMLDialogElement>(null), heading = useId();
    useEffect(() => {
        const dialog = ref.current!, previous = document.activeElement as HTMLElement | null;
        const overflow = document.body.style.overflow;
        dialog.showModal(); document.body.style.overflow = "hidden";
        return () => { dialog.close(); document.body.style.overflow = overflow; previous?.focus(); };
    }, []);
    return <dialog ref={ref} className={styles.feedbackDialog} aria-labelledby={heading}
        onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
            if (event.target !== ref.current) return;
            const rect = ref.current.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
        }}>
        <div className={styles.dialogHeader}><h2 id={heading}>Adviser feedback · {version}</h2><button type="button" className={styles.toggle} onClick={onClose} aria-label="Close full feedback">Close</button></div>
        <p className={styles.feedbackMeta}><strong>{decision}</strong> · Reviewed <time dateTime={reviewedAt}>{new Date(reviewedAt).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}</time></p>
        <div className={styles.feedbackScroll} tabIndex={0} aria-label="Full adviser feedback"><FeedbackContent value={comments} /></div>
    </dialog>;
}
