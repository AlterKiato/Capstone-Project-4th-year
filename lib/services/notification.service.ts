import {
    createNotification,
    deleteNotification,
    findNotificationById,
    findNotificationsByUserId,
    markNotificationAsRead,
} from "@/lib/repositories/notification.repository";

import type { ServiceResult } from "@/types/auth";

/**
 * Notification information safely exposed
 * to application features and pages.
 */
export interface ManagedNotification {
    id: number;
    userId: number;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
}

/**
 * Retrieves all notifications belonging to
 * a specific user.
 */
export async function getUserNotifications(
    userId: number
): Promise<ServiceResult<ManagedNotification[]>> {
    const notifications = await findNotificationsByUserId(
        userId
    );

    return {
        success: true,
        message: "Notifications retrieved successfully.",
        data: notifications,
    };
}

/**
 * Creates a notification for a specific user.
 *
 * This function can be reused by future modules
 * such as submissions, feedback, and research
 * status updates.
 */
export async function sendNotification(
    userId: number,
    title: string,
    message: string
): Promise<ServiceResult<ManagedNotification>> {
    const notification = await createNotification(
        userId,
        title,
        message
    );

    return {
        success: true,
        message: "Notification created successfully.",
        data: notification,
    };
}

/**
 * Marks a notification as read.
 *
 * The ownership check ensures users can only
 * modify their own notifications.
 */
export async function markUserNotificationAsRead(
    notificationId: number,
    userId: number
): Promise<ServiceResult> {
    const notification = await findNotificationById(
        notificationId
    );

    if (!notification) {
        return {
            success: false,
            message: "Notification not found.",
        };
    }

    // Prevent users from modifying notifications
    // belonging to another account.
    if (notification.userId !== userId) {
        return {
            success: false,
            message: "You are not authorized to modify this notification.",
        };
    }

    // Avoid unnecessary database updates.
    if (notification.isRead) {
        return {
            success: true,
            message: "Notification is already marked as read.",
        };
    }

    await markNotificationAsRead(
        notificationId
    );

    return {
        success: true,
        message: "Notification marked as read.",
    };
}

/**
 * Deletes a notification.
 *
 * The ownership check ensures users can only
 * delete their own notifications.
 */
export async function removeUserNotification(
    notificationId: number,
    userId: number
): Promise<ServiceResult> {
    const notification = await findNotificationById(
        notificationId
    );

    if (!notification) {
        return {
            success: false,
            message: "Notification not found.",
        };
    }

    // Prevent users from deleting notifications
    // belonging to another account.
    if (notification.userId !== userId) {
        return {
            success: false,
            message: "You are not authorized to delete this notification.",
        };
    }

    await deleteNotification(
        notificationId
    );

    return {
        success: true,
        message: "Notification deleted successfully.",
    };
}