import { db } from "@/lib/db";

import { activityLogs } from "@/db/schema";

/**
 * Data required to create an activity log.
 */
export interface CreateActivityLogData {
    userId: number;

    action: string;

    description?: string;

    ipAddress?: string;
}

/**
 * Creates a new activity log record.
 */
export async function createActivityLog(
    data: CreateActivityLogData
) {
    const [activityLog] = await db
        .insert(activityLogs)
        .values({
            userId: data.userId,

            action: data.action,

            description: data.description,

            ipAddress: data.ipAddress,
        })
        .returning();

    return activityLog;
}