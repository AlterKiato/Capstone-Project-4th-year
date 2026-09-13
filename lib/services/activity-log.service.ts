import {
    createActivityLog,
} from "@/lib/repositories/activity-log.repository";

/**
 * Records a system activity.
 *
 * This service should be called after important
 * system actions are successfully completed.
 */
export async function logActivity(
    userId: number,
    action: string,
    description?: string
) {
    await createActivityLog({
        userId,
        action,
        description,
    });
}