import { eq, desc, count } from "drizzle-orm";

import { db } from "@/lib/db";

import {
    users,
    researchGroups,
    researchPapers,
    activityLogs,
} from "@/db/schema";

// import { ROLE_IDS } from "@/lib/auth/roles";

/**
 * Counts all registered users.
 */
export async function countUsers() {
    const result = await db
        .select({
            count: count(),
        })
        .from(users);

    return Number(result[0]?.count ?? 0);
}

/**
 * Counts users belonging to a specific role.
 */
export async function countUsersByRole(
    roleId: number
) {
    const result = await db
        .select({
            count: count(),
        })
        .from(users)
        .where(eq(users.roleId, roleId));

    return Number(result[0]?.count ?? 0);
}

/**
 * Counts all research groups.
 */
export async function countResearchGroups() {
    const result = await db
        .select({
            count: count(),
        })
        .from(researchGroups);

    return Number(result[0]?.count ?? 0);
}

/**
 * Counts all research papers.
 */
export async function countResearchPapers() {
    const result = await db
        .select({
            count: count(),
        })
        .from(researchPapers);

    return Number(result[0]?.count ?? 0);
}

/**
 * Gets the most recent system activities.
 */
export async function getRecentActivities(
    limit = 5
) {
    return await db
        .select({
            id: activityLogs.id,
            action: activityLogs.action,
            description: activityLogs.description,
            createdAt: activityLogs.createdAt,

            userId: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
        })
        .from(activityLogs)
        .innerJoin(
            users,
            eq(activityLogs.userId, users.id)
        )
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit);
}