"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import NavigationIcon from "./navigation-icon";
import { useNotifications } from "./notification-provider";
import styles from "./notification-bell.module.css";

export default function NotificationBell() {
    const { data, loading, error, pending, refresh, markRead, historyHref } = useNotifications();
    const [openPath, setOpenPath] = useState<string | null>(null);
    const pathname = usePathname();
    const open = openPath === pathname;
    const container = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const panel = useRef<HTMLDivElement>(null);
    const id = useId();
    const count = data?.unreadCount;

    useEffect(() => {
        if (!open) return;
        panel.current?.focus();
        function outside(event: Event) {
            if (event.target instanceof Node && !container.current?.contains(event.target)) setOpenPath(null);
        }
        function escape(event: KeyboardEvent) {
            if (event.key === "Escape") {
                event.preventDefault(); setOpenPath(null); trigger.current?.focus();
            }
        }
        document.addEventListener("pointerdown", outside);
        document.addEventListener("focusin", outside);
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("pointerdown", outside);
            document.removeEventListener("focusin", outside);
            document.removeEventListener("keydown", escape);
        };
    }, [open]);

    useEffect(() => {
        if (open && pending === null && document.activeElement === document.body) panel.current?.focus();
    }, [open, pending]);

    return <div ref={container} className={styles.control} onKeyDown={event => {
        if (event.key === "Escape" && open) {
            event.preventDefault(); event.stopPropagation(); setOpenPath(null); trigger.current?.focus();
        }
    }}>
        <button ref={trigger} type="button" className={styles.trigger} aria-label="Notifications"
            aria-describedby={`${id}-count`} aria-haspopup="dialog" aria-expanded={open}
            aria-controls={open ? `${id}-panel` : undefined} onClick={() => {
                setOpenPath(open ? null : pathname);
                if (!open && pending === null) void refresh();
            }}>
            <NavigationIcon name="bell" />
            {count !== undefined && count > 0 && <span className={styles.badge} aria-hidden="true">{count > 9 ? "9+" : count}</span>}
        </button>
        <span id={`${id}-count`} className={styles.srOnly} role="status">{count === undefined ? "Unread count unavailable" : `${count} unread notifications`}{loading ? ", updating" : ""}</span>
        {open && <div ref={panel} id={`${id}-panel`} role="dialog" aria-labelledby={`${id}-heading`} tabIndex={-1} className={styles.panel}>
            <div className={styles.heading}><h2 id={`${id}-heading`}>Notifications</h2>
                {count !== undefined && <p>{count} unread</p>}
                <button className={styles.markAll} type="button" disabled={loading || pending !== null || count === undefined || count === 0}
                    onClick={() => void markRead("all")}>{pending === "all" ? "Marking all as read..." : "Mark all as read"}</button>
            </div>
            {loading && <p className={styles.status} role="status">Loading notifications...</p>}
            {error && <div className={styles.status}><p role="alert">{error}</p><button type="button" disabled={loading || pending !== null} onClick={() => void refresh()}>Retry</button></div>}
            {data && <>
                {data.recent.length === 0 ? <p className={styles.status}>You&apos;re all caught up.</p> : <ul className={styles.list}>
                    {data.recent.map(item => <li key={item.id} className={item.isRead ? undefined : styles.unread}>
                        <h3>{item.title}</h3><p className={styles.message}>{item.message}</p>
                        <p className={styles.meta}>{item.isRead ? "Read" : "Unread"} · <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</time></p>
                        {!item.isRead && <button type="button" disabled={pending !== null || loading} onClick={async event => {
                            const button = event.currentTarget;
                            await markRead(item.id);
                            if (!button.isConnected && container.current?.contains(document.activeElement) === false && document.activeElement === document.body) panel.current?.focus();
                        }}>{pending === item.id ? "Marking as read..." : "Mark as Read"}</button>}
                    </li>)}
                </ul>}
            </>}
            {historyHref && <Link className={styles.footer} href={historyHref} onClick={() => setOpenPath(null)}>View all notifications</Link>}
        </div>}
    </div>;
}
