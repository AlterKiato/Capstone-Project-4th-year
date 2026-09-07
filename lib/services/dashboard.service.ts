import {
    countUsers,
    countUsersByRole,
    countResearchGroups,
    countResearchPapers,
    getRecentActivities,
} from "@/lib/repositories/dashboard.repository";

import { ROLE_IDS } from "@/lib/auth/roles";

/**
 * Gets all data required by the Admin dashboard.
 */
export async function getAdminDashboardData() {
    const [
        totalUsers,
        totalStudents,
        totalAdvisers,
        totalGroups,
        totalPapers,
        recentActivities,
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

        getRecentActivities(),
    ]);

    return {
        statistics: {
            totalUsers,
            totalStudents,
            totalAdvisers,
            totalGroups,
            totalPapers,
        },

        recentActivities,
    };
}