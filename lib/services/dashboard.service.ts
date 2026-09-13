import {
    countUsers,
    countUsersByRole,
    countResearchGroups,
    countResearchPapers,
    getRecentActivities,
} from "@/lib/repositories/dashboard.repository";

import { ROLE_IDS } from "@/lib/auth/roles";

import type { ServiceResult } from "@/types/auth";

/**
 * Statistics displayed on the Admin Dashboard.
 */
export interface AdminDashboardStats {
    totalUsers: number;

    totalStudents: number;

    totalAdvisers: number;

    totalGroups: number;

    totalResearchPapers: number;
}

/**
 * Retrieves statistics for the Admin Dashboard.
 */
export async function getAdminDashboardStats(): Promise<
    ServiceResult<AdminDashboardStats>
> {
    const [
        totalUsers,
        totalStudents,
        totalAdvisers,
        totalGroups,
        totalResearchPapers,
    ] = await Promise.all([
        countUsers(),

        countUsersByRole(
            ROLE_IDS.STUDENT
        ),

        countUsersByRole(
            ROLE_IDS.ADVISER
        ),

        countResearchGroups(),

        countResearchPapers(),
    ]);

    return {
        success: true,

        message:
            "Admin dashboard statistics retrieved successfully.",

        data: {
            totalUsers,

            totalStudents,

            totalAdvisers,

            totalGroups,

            totalResearchPapers,
        },
    };
}

/**
 * Activity information displayed on the Admin Dashboard.
 */
export interface RecentActivity {
    id: number;

    action: string;

    description: string | null;

    createdAt: Date;

    userId: number;

    firstName: string;

    lastName: string;
}

/**
 * Retrieves recent system activities for the
 * Admin Dashboard.
 */
export async function getAdminRecentActivities(): Promise<
    ServiceResult<RecentActivity[]>
> {
    const activities = await getRecentActivities();

    return {
        success: true,

        message:
            "Recent activities retrieved successfully.",

        data: activities,
    };
}