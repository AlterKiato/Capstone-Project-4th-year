import { ROLE_IDS } from "@/lib/auth/roles";

export type NavigationIcon = "home" | "document" | "group" | "book" | "bell" | "users" | "report" | "guide" | "menu" | "close" | "collapse" | "logout" | "settings";
export type DashboardLink = { href: string; label: string; icon: NavigationIcon; exact?: boolean };

export function dashboardDestination(roleId: number): string | null {
    switch (roleId) {
        case ROLE_IDS.STUDENT: return "/dashboard/student";
        case ROLE_IDS.ADVISER: return "/dashboard/adviser";
        case ROLE_IDS.ADMIN: return "/dashboard/admin";
        default: return null;
    }
}

export function dashboardLinks(roleId: number): DashboardLink[] {
    const repository: DashboardLink = { href: "/dashboard/repository", label: "Browse Repository", icon: "book" };
    const guide: DashboardLink = { href: "/dashboard/guide", label: "System Guide", icon: "guide" };
    const settings: DashboardLink = { href: "/dashboard/settings", label: "Settings", icon: "settings", exact: true };
    const destination = dashboardDestination(roleId);
    const home: DashboardLink = { href: destination ?? "/dashboard", label: "Dashboard", icon: "home", exact: true };
    switch (roleId) {
        case ROLE_IDS.STUDENT: return [home,
            { href: "/dashboard/student/submissions", label: "My Research & Submissions", icon: "document" },
            repository, guide, settings];
        case ROLE_IDS.ADVISER: return [home,
            { href: "/dashboard/adviser/groups", label: "Research Groups", icon: "group" },
            { href: "/dashboard/adviser/submissions", label: "Review Submissions", icon: "document" },
            repository, guide, settings];
        case ROLE_IDS.ADMIN: return [home,
            { href: "/dashboard/admin/users", label: "Manage Users", icon: "users" },
            { href: "/dashboard/admin/groups", label: "Manage Groups", icon: "group" },
            { href: "/dashboard/admin/repository", label: "Repository Management", icon: "document" },
            { href: "/dashboard/admin/reports", label: "Reports", icon: "report" }, repository,
            guide, settings];
        case ROLE_IDS.PANEL: return [home, repository, settings];
        default: return [];
    }
}
