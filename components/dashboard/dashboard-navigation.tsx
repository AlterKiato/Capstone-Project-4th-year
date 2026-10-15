"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DashboardLink } from "@/lib/constants/dashboard-navigation";
import NavigationIcon from "./navigation-icon";

type DashboardNavigationProps = {
    links: DashboardLink[];
    onNavigate?: () => void;
};

export default function DashboardNavigation({ links, onNavigate }: DashboardNavigationProps) {
    const pathname = usePathname();
    return (
        <nav aria-label="Dashboard pages">
            {links.map(({ href, label, icon, exact }) => (
                <Link key={href} href={href} prefetch={false} aria-label={label} title={label} onNavigate={onNavigate}
                    aria-current={(pathname === href || (!exact && pathname.startsWith(`${href}/`))) ? "page" : undefined}>
                    <NavigationIcon name={icon} /><span>{label}</span>
                </Link>
            ))}
        </nav>
    );
}
