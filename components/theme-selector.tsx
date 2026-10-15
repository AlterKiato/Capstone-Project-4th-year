"use client";

import { useTheme } from "@/components/theme-provider";
import { useEffect, useId, useRef, useState } from "react";
import type { ThemePreference } from "@/lib/theme";
import styles from "./theme-selector.module.css";

const choices = ["light", "dark", "system"] as const;
const labels = { light: "Light", dark: "Dark", system: "System" };

function ThemeIcon({ preference }: { preference: ThemePreference }) {
    return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        {preference === "light" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>
            : preference === "dark" ? <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" />
            : <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M12 16v4m-4 0h8" /></>}
    </svg>;
}

export default function ThemeSelector() {
    const { preference, ready, select } = useTheme();
    const [open, setOpen] = useState(false);
    const container = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const options = useRef<(HTMLButtonElement | null)[]>([]);
    const initialFocus = useRef(0);
    const id = useId();

    useEffect(() => {
        if (!open) return;
        options.current[initialFocus.current]?.focus();
        function outside(event: Event) {
            if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
        }
        document.addEventListener("pointerdown", outside);
        document.addEventListener("focusin", outside);
        return () => {
            document.removeEventListener("pointerdown", outside);
            document.removeEventListener("focusin", outside);
        };
    }, [open]);

    function close() {
        setOpen(false);
        trigger.current?.focus();
    }

    return <div ref={container} className={styles.control} data-theme-preference={preference}>
        <button ref={trigger} type="button" className={styles.trigger} aria-label="Change theme" title={`Theme: ${labels[preference]}`} aria-describedby={`${id}-preference`} aria-haspopup="menu" aria-expanded={open} aria-controls={open ? `${id}-menu` : undefined} disabled={!ready}
            onClick={() => { initialFocus.current = choices.indexOf(preference); setOpen(!open); }}
            onKeyDown={event => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    initialFocus.current = event.key === "ArrowDown" ? 0 : choices.length - 1;
                    setOpen(true);
                }
            }}>
            <ThemeIcon preference={preference} />
        </button>
        <span id={`${id}-preference`} className={styles.srOnly}>Current preference: {labels[preference]}</span>
        {open && <div id={`${id}-menu`} role="menu" aria-label="Theme" className={styles.menu} onKeyDown={event => {
            const index = options.current.indexOf(document.activeElement as HTMLButtonElement);
            let next: number | undefined;
            if (event.key === "ArrowDown") next = (index + 1) % choices.length;
            if (event.key === "ArrowUp") next = (index + choices.length - 1) % choices.length;
            if (event.key === "Home") next = 0;
            if (event.key === "End") next = choices.length - 1;
            if (next !== undefined) { event.preventDefault(); options.current[next]?.focus(); }
            if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
            if (event.key === "Tab") close();
        }}>
            {choices.map((choice, index) => <button key={choice} ref={node => { options.current[index] = node; }} type="button" role="menuitemradio" aria-checked={preference === choice} tabIndex={-1} className={styles.option} onClick={() => { select(choice); close(); }}>
                <ThemeIcon preference={choice} /><span>{labels[choice]}</span>
                <svg className={styles.check} style={{ visibility: preference === choice ? "visible" : "hidden" }} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" focusable="false"><path d="m5 12 4 4L19 6" /></svg>
            </button>)}
        </div>}
    </div>;
}
