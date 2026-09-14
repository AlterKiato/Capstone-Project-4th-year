import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";

import { notifications } from "@/db/schema";

/**
 * Retrieves all notifications for a specific user.
 *
 * Notifications are ordered from newest to oldest.
 */
export async function findNotificationsByUserId(
    userId: number
) {
    return await db
        .select()
        .from(notifications)
        .where(
            eq(
                notifications.userId,
                userId
            )
        )
        .orderBy(
            desc(
                notifications.createdAt
            )
        );
}

/**
 * Finds a notification by its ID.
 */
export async function findNotificationById(
    id: number
) {
    const [notification] = await db
        .select()
        .from(notifications)
        .where(
            eq(
                notifications.id,
                id
            )
        );

    return notification;
}

/**
 * Creates a new notification.
 */
export async function createNotification(
    userId: number,
    title: string,
    message: string
) {
    const [notification] = await db
        .insert(notifications)
        .values({
            userId,
            title,
            message,
        })
        .returning();

    return notification;
}

/**
 * Marks a notification as read.
 */
export async function markNotificationAsRead(
    id: number
) {
    const [notification] = await db
        .update(notifications)
        .set({
            isRead: true,
        })
        .where(
            eq(
                notifications.id,
                id
            )
        )
        .returning();

    return notification;
}

/**
 * Deletes a notification.
 */
export async function deleteNotification(
    id: number
) {
    const [notification] = await db
        .delete(notifications)
        .where(
            eq(
                notifications.id,
                id
            )
        )
        .returning();

    return notification;
}