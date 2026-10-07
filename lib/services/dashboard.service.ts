import "server-only";
import { getSession } from "@/lib/auth/session";
import { ROLE_IDS, ROLE_NAMES } from "@/lib/auth/roles";
import { RESEARCH_STATUS } from "@/lib/constants/research-status";
import { findUserById } from "@/lib/repositories/user.repository";
import {
    countUsers, countResearchGroups, countResearchPapers,
    groupUsersByRole, groupPapersByStatus, getRecentActivities,
} from "@/lib/repositories/dashboard.repository";
import { countPublishedResearch } from "@/lib/repositories/repository.repository";
import type { ServiceResult } from "@/types/auth";

export interface AdminDashboardStats {
    totalUsers: number;
    totalStudents: number;
    totalAdvisers: number;
    totalGroups: number;
    totalResearchPapers: number;
    totalPublishedPapers: number;
    usersByRole: { role: string; count: number }[];
    papersByStatus: { status: string; count: number }[];
}

// Identity is read from the verified session; stale roles and inactive accounts are denied.
async function isReportingAdmin() {
    const session = await getSession();
    if (!session || session.roleId !== ROLE_IDS.ADMIN ||
        !Number.isSafeInteger(session.userId) || session.userId <= 0) return false;
    const user = await findUserById(session.userId);
    return Boolean(user?.isActive && user.roleId === ROLE_IDS.ADMIN);
}

const unavailable = { success: false, message: "Admin reporting is unavailable." } as const;

export async function getAdminDashboardStats(): Promise<ServiceResult<AdminDashboardStats>> {
    try {
        if (!await isReportingAdmin()) return unavailable;
        const [totalUsers, totalGroups, totalResearchPapers, totalPublishedPapers, roles, statuses] = await Promise.all([
            countUsers(), countResearchGroups(), countResearchPapers(), countPublishedResearch(),
            groupUsersByRole(), groupPapersByStatus(),
        ]);
        const roleCount = (id: number) => roles.find(row => row.roleId === id)?.count ?? 0;
        const knownStatuses: string[] = Object.values(RESEARCH_STATUS);
        return {
            success: true, message: "Admin reporting retrieved successfully.",
            data: {
                totalUsers, totalGroups, totalResearchPapers, totalPublishedPapers,
                totalStudents: roleCount(ROLE_IDS.STUDENT),
                totalAdvisers: roleCount(ROLE_IDS.ADVISER),
                usersByRole: [
                    ...Object.entries(ROLE_NAMES).map(([id, role]) => ({ role, count: roleCount(Number(id)) })),
                    { role: "Other", count: roles.filter(row => !ROLE_NAMES[row.roleId]).reduce((sum, row) => sum + row.count, 0) },
                ],
                papersByStatus: [
                    ...knownStatuses.map(status => ({ status, count: statuses.find(row => row.status === status)?.count ?? 0 })),
                    { status: "Other", count: statuses.filter(row => !knownStatuses.includes(row.status)).reduce((sum, row) => sum + row.count, 0) },
                ],
            },
        };
    } catch { return unavailable; }
}

export interface RecentActivity {
    id: number;
    action: string;
    createdAt: Date;
}

export async function getAdminRecentActivities(): Promise<ServiceResult<RecentActivity[]>> {
    try {
        if (!await isReportingAdmin()) return unavailable;
        return { success: true, message: "Recent activities retrieved successfully.", data: await getRecentActivities() };
    } catch { return unavailable; }
}
