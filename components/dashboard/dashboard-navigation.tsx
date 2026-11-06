"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isDashboardLinkActive, type DashboardLink } from "@/lib/constants/dashboard-navigation";
import NavigationIcon from "./navigation-icon";

type DashboardNavigationProps = {
    links: DashboardLink[];
    onNavigate?: () => void;
};

export default function DashboardNavigation({ links, onNavigate }: DashboardNavigationProps) {
    const pathname = usePathname();
    return (
        <nav aria-label="Dashboard pages">
            {links.map(link => {
                const { href, label, icon } = link;
                return (
                    <Link key={href} href={href} prefetch={false} aria-label={label} title={label} onNavigate={onNavigate}
                        aria-current={isDashboardLinkActive(pathname, link) ? "page" : undefined}>
                        <NavigationIcon name={icon} /><span>{label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
