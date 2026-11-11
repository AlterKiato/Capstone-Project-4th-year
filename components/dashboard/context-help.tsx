"use client";
import { useId } from "react";
import styles from "./revisions.module.css";

export default function ContextHelp({ label, children }: { label: string; children: React.ReactNode }) {
    const id = useId();
    return <span className={styles.help}><button type="button" popoverTarget={id} aria-label={label} className={styles.helpButton}>?</button>
        <span id={id} popover="auto" role="note" className={styles.popover}>{children}</span></span>;
}
