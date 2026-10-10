"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type DashboardNavigationProps = {
    links: Array<{ href: string; label: string }>;
};

export default function DashboardNavigation({ links }: DashboardNavigationProps) {
    const pathname = usePathname();
    return (
        <nav aria-label="Dashboard pages" className="dashboard-navigation">
            {links.map(({ href, label }) => (
                <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
                    {label}
                </Link>
            ))}
        </nav>
    );
}
