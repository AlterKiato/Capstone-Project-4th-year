"use client";
import ThemeSelector from "@/components/theme-selector";

import { useEffect, useRef, useState } from "react";
import type { DashboardLink } from "@/lib/constants/dashboard-navigation";
import DashboardNavigation from "./dashboard-navigation";
import NavigationIcon from "./navigation-icon";
import LogoutButton from "@/components/auth/logout-button";
import styles from "./dashboard-shell.module.css";

export default function DashboardShell({ links, children }: { links: DashboardLink[]; children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    const [open, setOpen] = useState(false);
    const drawer = useRef<HTMLDialogElement>(null);
    const menu = useRef<HTMLButtonElement>(null);
    const content = useRef<HTMLDivElement>(null);
    const previousOverflow = useRef("");
    const navigating = useRef(false);

    function closeDrawer(isNavigating = false) {
        navigating.current = isNavigating;
        drawer.current?.close();
    }

    function openDrawer() {
        previousOverflow.current = document.body.style.overflow;
        drawer.current?.showModal();
        document.body.style.overflow = "hidden";
        setOpen(true);
    }

    useEffect(() => {
        const dialog = drawer.current;
        const desktop = window.matchMedia("(min-width: 1024px)");
        const onChange = () => { if (desktop.matches) dialog?.close(); };
        desktop.addEventListener("change", onChange);
        return () => {
            desktop.removeEventListener("change", onChange);
            if (dialog?.open) document.body.style.overflow = previousOverflow.current;
        };
    }, []);

    function logout() {
        return <LogoutButton className={styles.logout} icon={<NavigationIcon name="logout" />} labelClassName={styles.label} />;
    }

    return <div className={`${styles.shell} ${collapsed ? styles.collapsed : ""}`}>
        <aside className={styles.sidebar} aria-label="Workspace sidebar">
            <span className={styles.brand} aria-label="ThesiSHS AI"><NavigationIcon name="book" /><span className={styles.label}>ThesiSHS AI</span></span>
            <button className={styles.desktopToggle} type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls="desktop-navigation" onClick={() => setCollapsed(!collapsed)}>
                <NavigationIcon name={collapsed ? "menu" : "collapse"} /><span className={styles.label}>Collapse sidebar</span>
            </button>
            <button ref={menu} className={styles.mobileToggle} type="button" aria-label="Open navigation menu" title="Open navigation menu" aria-expanded={open} aria-controls="mobile-navigation-drawer" onClick={openDrawer}><NavigationIcon name="menu" /></button>
            <div id="desktop-navigation" className={styles.navigation}><DashboardNavigation links={links} /></div>
            <div className={styles.footer}>{logout()}</div>
        </aside>
        <div ref={content} tabIndex={-1} className={styles.content} id="workspace-content">
            <header className="workspace-appearance" aria-label="Workspace theme"><ThemeSelector /></header>
            {children}
        </div>
        <dialog ref={drawer} id="mobile-navigation-drawer" className={styles.drawer} aria-labelledby="navigation-heading" onKeyDown={event => {
            if (event.key !== "Tab") return;
            const stops = event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
            const first = stops[0];
            const last = stops[stops.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        }} onCancel={() => closeDrawer()} onClose={() => {
            setOpen(false);
            document.body.style.overflow = previousOverflow.current;
            (navigating.current ? content.current : menu.current)?.focus();
            navigating.current = false;
        }} onClick={event => {
            if (event.target === event.currentTarget) {
                const bounds = event.currentTarget.getBoundingClientRect();
                if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDrawer();
            }
        }}>
            <div className={styles.drawerHeading}><h2 id="navigation-heading">Navigation</h2><button type="button" aria-label="Close navigation menu" onClick={() => closeDrawer()} autoFocus><NavigationIcon name="close" /></button></div>
            <div className={styles.navigation}><DashboardNavigation links={links} onNavigate={() => closeDrawer(true)} /></div>
            <div className={styles.footer}>{logout()}</div>
        </dialog>
    </div>;
}
