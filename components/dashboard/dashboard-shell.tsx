"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { mobileNavigation, type DashboardLink } from "@/lib/constants/dashboard-navigation";
import DashboardNavigation from "./dashboard-navigation";
import DashboardBottomNavigation from "./dashboard-bottom-navigation";
import NavigationIcon from "./navigation-icon";
import LogoutButton from "@/components/auth/logout-button";
import Sheet from "@/components/ui/sheet";
import { useDisplayMode, usePwaPlatform } from "@/lib/pwa/use-display-mode";
import { navigationProfile, selectSidebarMode, useSidebarPreference } from "@/lib/pwa/navigation-preferences";
import styles from "./dashboard-shell.module.css";

export default function DashboardShell({ links, children }: { links: DashboardLink[]; children: React.ReactNode }) {
    const displayMode = useDisplayMode();
    const platform = usePwaPlatform();
    const { primary, secondary } = mobileNavigation(links);
    const profile = navigationProfile(displayMode, platform, primary.length > 0);
    const preferenceProfile = profile === "desktop" ? "desktop" : "browser";
    const mode = useSidebarPreference(preferenceProfile);
    const [open, setOpen] = useState(false);
    const menu = useRef<HTMLButtonElement>(null);
    const content = useRef<HTMLDivElement>(null);
    const lastTrigger = useRef<HTMLButtonElement>(null);
    const navigating = useRef(false);

    function openDrawer(event: MouseEvent<HTMLButtonElement>) {
        lastTrigger.current = event.currentTarget;
        navigating.current = false;
        setOpen(true);
    }
    function closeAfterNavigation() {
        // Next Link calls this only after the document-capture draft guard accepts.
        navigating.current = true;
        setOpen(false);
    }

    useEffect(() => {
        const wide = typeof window.matchMedia === "function" ? window.matchMedia("(min-width: 1024px)") : null;
        const onChange = () => setOpen(false);
        const modern = typeof wide?.addEventListener === "function" && typeof wide.removeEventListener === "function";
        const legacy = typeof wide?.addListener === "function" && typeof wide.removeListener === "function";
        if (modern) wide.addEventListener("change", onChange);
        else if (legacy) wide.addListener(onChange);
        return () => {
            if (modern) wide.removeEventListener("change", onChange);
            else if (legacy) wide.removeListener(onChange);
        };
    }, []);

    return <div className={styles.shell} data-display-mode={displayMode} data-navigation-profile={profile} data-sidebar-mode={mode}>
        <aside className={styles.sidebar} aria-label="Workspace sidebar">
            <div className={styles.sidebarHeader}>
                <span className={styles.brand} aria-label="ThesiSHS AI"><NavigationIcon name="book" /><span className={styles.label}>ThesiSHS AI</span></span>
                <button className={styles.desktopToggle} type="button" aria-label={mode === "compact" ? "Expand sidebar" : "Collapse sidebar"} title={mode === "compact" ? "Expand sidebar" : "Collapse sidebar"}
                    aria-expanded={mode !== "compact"} aria-controls="desktop-navigation" onClick={() => selectSidebarMode(preferenceProfile, mode === "compact" ? "expanded" : "compact")}>
                    <NavigationIcon name={mode === "compact" ? "menu" : "collapse"} />
                </button>
            </div>
            <div id="desktop-navigation" className={styles.navigation}><DashboardNavigation links={links} /></div>
            <div className={styles.footer}>
                <LogoutButton className={styles.logout} icon={<NavigationIcon name="logout" />} labelClassName={styles.label} />
            </div>
        </aside>
        <div ref={content} tabIndex={-1} className={styles.content} id="workspace-content">
            <div className={styles.menuRow}>
                <button ref={menu} className={styles.mobileToggle} type="button" aria-label="Open navigation menu" title="Open navigation menu" aria-haspopup="dialog" aria-expanded={open} onClick={openDrawer}>
                    <NavigationIcon name="menu" />
                </button><span className={styles.menuBrand}>ThesiSHS AI</span>
            </div>
            {children}
        </div>
        {profile === "mobile" ? <DashboardBottomNavigation primary={primary} secondary={secondary} open={open} onMore={openDrawer} /> : null}
        <Sheet open={open} onOpenChange={setOpen} onCloseAutoFocus={event => {
            event.preventDefault();
            const trigger = lastTrigger.current;
            const target = navigating.current ? content.current : trigger?.isConnected && trigger.getClientRects().length ? trigger
                : menu.current?.getClientRects().length ? menu.current : content.current;
            target?.focus({ preventScroll: true });
            navigating.current = false;
        }}>
            <div className={styles.navigation}><DashboardNavigation links={profile === "mobile" ? secondary : links} onNavigate={closeAfterNavigation} /></div>
            <div className={styles.footer}>
                <LogoutButton className={styles.logout} icon={<NavigationIcon name="logout" />} labelClassName={styles.label} />
            </div>
        </Sheet>
    </div>;
}
