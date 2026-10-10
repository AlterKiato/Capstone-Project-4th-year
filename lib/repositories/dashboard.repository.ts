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
export async function countUsers(executor: Pick<typeof db, "select"> = db) {
    const result = await executor
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
export async function countResearchGroups(executor: Pick<typeof db, "select"> = db) {
    const result = await executor
        .select({
            count: count(),
        })
        .from(researchGroups);

    return Number(result[0]?.count ?? 0);
}

/**
 * Counts all research papers.
 */
export async function countResearchPapers(executor: Pick<typeof db, "select"> = db) {
    const result = await executor
        .select({
            count: count(),
        })
        .from(researchPapers);

    return Number(result[0]?.count ?? 0);
}

/**
 * Gets the most recent system activities.
 */
export async function getRecentActivities() {
    // Deliberately omit actors, descriptions and IP addresses from oversight output.
    return db.select({
        id: activityLogs.id,
        action: activityLogs.action,
        createdAt: activityLogs.createdAt,
    }).from(activityLogs)
        .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
        .limit(5);
}

export async function groupUsersByRole() {
    return db.select({ roleId: users.roleId, count: count() })
        .from(users).groupBy(users.roleId);
}

export async function groupPapersByStatus(executor: Pick<typeof db, "select"> = db) {
    return executor.select({ status: researchPapers.status, count: count() })
        .from(researchPapers).groupBy(researchPapers.status);
}
