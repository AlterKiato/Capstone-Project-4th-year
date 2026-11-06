"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEventHandler } from "react";
import { isDashboardLinkActive, type DashboardLink } from "@/lib/constants/dashboard-navigation";
import NavigationIcon from "./navigation-icon";
import styles from "./dashboard-shell.module.css";

export default function DashboardBottomNavigation({ primary, secondary, open, onMore }: {
    primary: DashboardLink[];
    secondary: DashboardLink[];
    open: boolean;
    onMore: MouseEventHandler<HTMLButtonElement>;
}) {
    const pathname = usePathname();
    const secondaryActive = secondary.some(link => isDashboardLinkActive(pathname, link));
    return <nav className={styles.bottomNavigation} aria-label="Primary dashboard pages">
        {primary.map(link => <Link key={link.href} href={link.href} prefetch={false} aria-label={link.label} title={link.label}
            aria-current={isDashboardLinkActive(pathname, link) ? "page" : undefined}>
            <NavigationIcon name={link.icon} /><span>{link.bottomLabel}</span>
        </Link>)}
        <button type="button" aria-label="More navigation" title="More navigation" aria-haspopup="dialog" aria-expanded={open}
            data-active={secondaryActive || undefined} onClick={onMore}>
            <NavigationIcon name="menu" /><span>More</span>
        </button>
    </nav>;
}
