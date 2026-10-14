import DashboardNavigation from "./dashboard-navigation";

export default function AdminNavigation() {
    return <DashboardNavigation links={[
        { href: "/dashboard/admin", label: "Overview" },
        { href: "/dashboard/admin/users", label: "Manage Users" },
        { href: "/dashboard/admin/groups", label: "Manage Groups" },
        { href: "/dashboard/admin/repository", label: "Repository Management" },
        { href: "/dashboard/admin/reports", label: "Reports" },
        { href: "/dashboard/admin/notifications", label: "Notifications" },
        { href: "/dashboard/repository", label: "Browse Repository" },
    ]} />;
}
