import { ROLE_IDS } from "@/lib/auth/roles";

export type NavigationIcon = "home" | "document" | "group" | "book" | "bell" | "users" | "report" | "guide" | "menu" | "close" | "collapse" | "logout" | "settings";
export type DashboardLink = { href: string; label: string; icon: NavigationIcon; exact?: boolean; bottomLabel?: string; bottomOrder?: number };

// Presentation metadata only. The server still supplies the authorized role's links.
export function mobileNavigation(links: DashboardLink[]) {
    const primary = links.filter(link => link.bottomLabel !== undefined).sort((a, b) => (a.bottomOrder ?? 0) - (b.bottomOrder ?? 0));
    return { primary, secondary: links.filter(link => link.bottomLabel === undefined) };
}

export function isDashboardLinkActive(pathname: string, link: DashboardLink) {
    return pathname === link.href || (!link.exact && pathname.startsWith(`${link.href}/`));
}

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
    const home: DashboardLink = { href: destination ?? "/dashboard", label: "Dashboard", icon: "home", exact: true,
        ...(destination ? { bottomLabel: "Dashboard", bottomOrder: 0 } : {}) };
    switch (roleId) {
        case ROLE_IDS.STUDENT: return [home,
            { href: "/dashboard/student/submissions", label: "My Research & Submissions", icon: "document", bottomLabel: "Submissions", bottomOrder: 1 },
            { href: "/dashboard/student/workspace", label: "Group Workspace", icon: "group", bottomLabel: "Workspace", bottomOrder: 2 },
            repository, guide, settings];
        case ROLE_IDS.ADVISER: return [home,
            { href: "/dashboard/adviser/groups", label: "Research Groups", icon: "group", bottomLabel: "Groups", bottomOrder: 2 },
            { href: "/dashboard/adviser/submissions", label: "Review Submissions", icon: "document", bottomLabel: "Submissions", bottomOrder: 1 },
            repository, guide, settings];
        case ROLE_IDS.ADMIN: return [home,
            { href: "/dashboard/admin/users", label: "Manage Users", icon: "users", bottomLabel: "Users", bottomOrder: 1 },
            { href: "/dashboard/admin/groups", label: "Manage Groups", icon: "group", bottomLabel: "Groups", bottomOrder: 2 },
            { href: "/dashboard/admin/repository", label: "Repository Management", icon: "document", bottomLabel: "Repository", bottomOrder: 3 },
            { href: "/dashboard/admin/reports", label: "Reports", icon: "report" }, repository,
            guide, settings];
        case ROLE_IDS.PANEL: return [home, repository, settings];
        default: return [];
    }
}
