"use client";
import { useEffect, useId, useRef } from "react";
import { helpPopoverPosition } from "@/lib/student-experience-view";
import styles from "./revisions.module.css";

export default function ContextHelp({ label, children }: { label: string; children: React.ReactNode }) {
    const id = useId();
    const trigger = useRef<HTMLButtonElement>(null), popover = useRef<HTMLSpanElement>(null);
    useEffect(() => {
        const note = popover.current!;
        let frame = 0;
        function position() {
            if (!note.matches(":popover-open") || !trigger.current) return;
            const viewport = window.visualViewport;
            const point = helpPopoverPosition(trigger.current.getBoundingClientRect(), note.getBoundingClientRect(), {
                left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0,
                width: viewport?.width ?? window.innerWidth, height: viewport?.height ?? window.innerHeight,
            });
            note.style.left = `${point.left}px`; note.style.top = `${point.top}px`;
        }
        function schedule() { cancelAnimationFrame(frame); frame = requestAnimationFrame(position); }
        function toggle() { position(); schedule(); }
        note.addEventListener("toggle", toggle);
        window.addEventListener("scroll", schedule, true);
        window.addEventListener("resize", schedule);
        window.visualViewport?.addEventListener("resize", schedule);
        window.visualViewport?.addEventListener("scroll", schedule);
        const observer = new ResizeObserver(schedule); observer.observe(note);
        return () => {
            cancelAnimationFrame(frame); observer.disconnect(); note.removeEventListener("toggle", toggle);
            window.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule);
            window.visualViewport?.removeEventListener("resize", schedule); window.visualViewport?.removeEventListener("scroll", schedule);
        };
    }, []);
    return <span className={styles.help}><button ref={trigger} type="button" popoverTarget={id} aria-label={label} title={label} className={styles.helpButton}>?</button>
        <span ref={popover} id={id} popover="auto" role="note" className={styles.popover}>{children}</span></span>;
}
