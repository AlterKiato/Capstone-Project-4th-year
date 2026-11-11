"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import SwipeToast, { type SwipeToastCloseReason } from "@/components/react-bits/SwipeToast";
import styles from "./review-workspace.module.css";

type Placement = { left: number; top: number; width: number; height: number; inline: boolean };

/** One mounted instance per clean-to-dirty transition; dismissal never changes the draft. */
export default function UnsavedFeedbackToast() {
    const marker = useRef<HTMLDivElement>(null);
    const dock = useRef<HTMLDivElement>(null);
    const [dismissed, setDismissed] = useState(false);
    const [placement, setPlacement] = useState<Placement | null>(null);
    const placed = placement !== null;

    useLayoutEffect(() => {
        if (dismissed) return;
        let frame = 0;
        const update = () => {
            const anchor = marker.current;
            if (!anchor) return;
            // Review stays mounted in its tab. A portaled toast must not outlive
            // its hidden anchor or measure a zero-width inactive panel.
            if (!anchor.getClientRects().length) { setPlacement(null); return; }
            const viewport = window.visualViewport;
            const leftEdge = viewport?.offsetLeft ?? 0, topEdge = viewport?.offsetTop ?? 0;
            const rightEdge = leftEdge + (viewport?.width ?? window.innerWidth);
            const bottomEdge = topEdge + (viewport?.height ?? window.innerHeight);
            const main = anchor.closest("main")!;
            const bounds = main.getBoundingClientRect();
            const inset = 16 + (dock.current ? parseFloat(getComputedStyle(dock.current).paddingBottom) || 0 : 0);
            const safeLeft = dock.current ? parseFloat(getComputedStyle(dock.current).paddingLeft) || 0 : 0;
            const safeRight = dock.current ? parseFloat(getComputedStyle(dock.current).paddingRight) || 0 : 0;
            const left = Math.max(leftEdge + 16 + safeLeft, bounds.left + 12);
            const right = Math.min(rightEdge - 16 - safeRight, bounds.right - 12);
            const width = Math.max(1, Math.min(340, right - left));
            const height = Math.max(88, dock.current?.scrollHeight ?? 0);
            const obstacles = [...main.querySelectorAll('iframe, [contenteditable], button, select, input, a, [aria-labelledby="review-confirmation-heading"]')]
                .map(node => node.getBoundingClientRect()).filter(rect => rect.width && rect.height);
            const reserved = anchor.getBoundingClientRect();
            if (reserved.height) obstacles.push(reserved);
            let next: Placement | null = null;
            // Prefer the bottom-right free slot; never cover the editor, PDF or review controls.
            for (let top = bottomEdge - height - inset; top >= topEdge + inset && !next; top -= 24) {
                for (const x of [right - width, left]) {
                    if (obstacles.every(rect => x + width + 8 <= rect.left || x - 8 >= rect.right || top + height + 8 <= rect.top || top - 8 >= rect.bottom)) {
                        next = { left: x, top, width, height, inline: false }; break;
                    }
                }
            }
            // A filled/zoomed viewport has no safe floating slot: reserve compact space in the form.
            if (!next) {
                const rect = anchor.getBoundingClientRect();
                next = { left: Math.max(rect.left, left), top: rect.top + window.scrollY, width: Math.max(1, Math.min(rect.width, width)), height, inline: true };
            }
            const result = next;
            setPlacement(current => current && Object.keys(result).every(key => current[key as keyof Placement] === result[key as keyof Placement]) ? current : result);
        };
        const queue = () => { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(update); };
        const observer = new ResizeObserver(queue);
        observer.observe(marker.current!);
        observer.observe(marker.current!.closest("main")!);
        if (dock.current) observer.observe(dock.current);
        marker.current!.closest("main")!.querySelectorAll('iframe, [contenteditable], form').forEach(node => observer.observe(node));
        document.addEventListener("scroll", queue, true);
        document.addEventListener("focusin", queue);
        window.addEventListener("resize", queue);
        window.visualViewport?.addEventListener("resize", queue);
        window.visualViewport?.addEventListener("scroll", queue);
        queue();
        return () => {
            observer.disconnect(); window.cancelAnimationFrame(frame);
            document.removeEventListener("scroll", queue, true);
            document.removeEventListener("focusin", queue);
            window.removeEventListener("resize", queue);
            window.visualViewport?.removeEventListener("resize", queue);
            window.visualViewport?.removeEventListener("scroll", queue);
        };
    }, [dismissed, placed]);

    function closed(reason: SwipeToastCloseReason) {
        const focused = document.activeElement;
        if (reason !== "timeout" && (focused === document.body || focused && dock.current?.contains(focused))) {
            marker.current?.closest("form")?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus({ preventScroll: true });
        }
        setDismissed(true);
    }

    if (dismissed) return null;
    return <>
        <div ref={marker} className={styles.draftToastSpace} style={{ height: !dismissed && placement?.inline ? placement.height : 0 }} />
        {!dismissed && placement && createPortal(<div ref={dock} className={styles.draftToastDock}
            data-placement={placement.inline ? "inline" : "floating"}
            style={{ position: placement.inline ? "absolute" : "fixed", left: placement.left, top: placement.top, width: placement.width }}>
            <SwipeToast title="Unsaved feedback" description="Leaving this review may discard your changes."
                duration={7000} slideMs={350} settleBounce={0} closeButton pauseOnHover={false} inline announce={false}
                background="var(--surface)" color="var(--foreground)" fuseColor="var(--action)" radius={8} onClose={closed} />
        </div>, document.body)}
    </>;
}
