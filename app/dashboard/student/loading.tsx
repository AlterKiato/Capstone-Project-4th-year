"use client";

import { usePathname } from "next/navigation";
import DashboardSkeleton from "@/components/dashboard/dashboard-skeleton";

export default function Loading() {
    const pathname = usePathname();
    // This ancestor boundary also covers other Student pages. Keep their existing
    // neutral fallback, including when a nested loading boundary is not ready yet.
    if (pathname === "/dashboard/student") return <DashboardSkeleton page="student" />;
    if (pathname === "/dashboard/student/submissions") return <DashboardSkeleton page="submissions" />;
    if (pathname === "/dashboard/student/workspace") return <DashboardSkeleton page="workspace" />;
    return <main className="dashboard-page"><p role="status">Loading research information…</p></main>;
}
