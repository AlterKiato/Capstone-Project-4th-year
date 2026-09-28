import Link from "next/link";

type DashboardNavigationProps = {
    links: Array<{ href: string; label: string }>;
};

export default function DashboardNavigation({ links }: DashboardNavigationProps) {
    return (
        <nav aria-label="Dashboard pages" style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "20px 0" }}>
            {links.map(({ href, label }) => (
                <Link key={href} href={href} style={{ border: "1px solid #888", borderRadius: 6, padding: "8px 12px", textDecoration: "none" }}>
                    {label}
                </Link>
            ))}
        </nav>
    );
}
