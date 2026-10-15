import {
    createNotification,
    deleteNotification,
    findNotificationById,
    findNotificationsByUserId,
    markNotificationAsRead,
    findNotificationPreview,
    markAllNotificationsAsRead,
} from "@/lib/repositories/notification.repository";
import { requireAuth } from "@/lib/auth/authorization";
import { getDashboardAccount } from "@/lib/services/dashboard-account.service";
import { ROLE_IDS } from "@/lib/auth/roles";
import { z } from "zod";

import {
    NOTIFICATION_TITLE,
} from "@/lib/constants/notification";

import type { ServiceResult } from "@/types/auth";

export type NotificationPreview = {
    recent: { id: number; title: string; message: string; isRead: boolean; createdAt: string }[];
    unreadCount: number;
};

async function notificationAccount() {
    const session = await requireAuth();
    const account = await getDashboardAccount();
    if (!account || !Object.values(ROLE_IDS).some(role => role === account.roleId)) return null;
    return { userId: session.userId, roleId: account.roleId };
}

export async function markAllCurrentNotificationsAsRead(): Promise<ServiceResult> {
    const account = await notificationAccount();
    if (!account) return { success: false, message: "Notification access could not be verified." };
    try {
        await markAllNotificationsAsRead(account.userId);
        return { success: true, message: "All notifications marked as read." };
    } catch {
        return { success: false, message: "Notifications could not be marked as read. Please try again." };
    }
}

export async function getCurrentNotificationPreview(): Promise<ServiceResult<NotificationPreview>> {
    const account = await notificationAccount();
    if (!account) return { success: false, message: "Notification access could not be verified." };
    try {
        const preview = await findNotificationPreview(account.userId);
        return { success: true, message: "Notifications loaded.", data: {
            recent: preview.recent.map(item => ({ ...item, createdAt: item.createdAt.toISOString() })),
            unreadCount: preview.unreadCount,
        } };
    } catch {
        return { success: false, message: "Notifications could not be loaded. Please try again." };
    }
}

export async function markCurrentNotificationAsRead(notificationId: number): Promise<ServiceResult> {
    const account = await notificationAccount();
    if (!account) return { success: false, message: "Notification access could not be verified." };
    if (!z.number().int().positive().safe().safeParse(notificationId).success)
        return { success: false, message: "Invalid notification." };
    try {
        return await markUserNotificationAsRead(notificationId, account.userId);
    } catch {
        return { success: false, message: "Notification could not be marked as read. Please try again." };
    }
}

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
    const notifications =
        await findNotificationsByUserId(
            userId
        );

    return {
        success: true,
        message:
            "Notifications retrieved successfully.",
        data: notifications,
    };
}

/**
 * Creates a generic notification for a
 * specific user.
 *
 * Database errors are converted into a failed
 * service result so notification failures can
 * be handled independently from core workflows.
 */
export async function sendNotification(
    userId: number,
    title: string,
    message: string
): Promise<ServiceResult<ManagedNotification>> {
    try {
        const notification =
            await createNotification(
                userId,
                title,
                message
            );

        if (!notification) {
            return {
                success: false,
                message:
                    "The notification could not be created.",
            };
        }

        return {
            success: true,
            message:
                "Notification created successfully.",
            data: notification,
        };
    } catch {
        return {
            success: false,
            message:
                "The notification could not be created.",
        };
    }
}

/**
 * Notifies a student that a research submission
 * has been approved by the Adviser.
 */
export async function notifyStudentSubmissionApproved(
    studentId: number,
    version: string,
    researchTitle: string
): Promise<ServiceResult<ManagedNotification>> {
    return sendNotification(
        studentId,
        NOTIFICATION_TITLE.SUBMISSION_APPROVED,
        `Your research submission ${version} for "${researchTitle}" has been approved by your Adviser.`
    );
}

/**
 * Notifies a student that a research submission
 * requires revision.
 */
export async function notifyStudentSubmissionRevisionRequired(
    studentId: number,
    version: string,
    researchTitle: string
): Promise<ServiceResult<ManagedNotification>> {
    return sendNotification(
        studentId,
        NOTIFICATION_TITLE.SUBMISSION_REVISION_REQUIRED,
        `Your research submission ${version} for "${researchTitle}" requires revision. Please review your Adviser's feedback.`
    );
}

/**
 * Notifies an Adviser that a student has submitted
 * a research submission for review.
 */
export async function notifyAdviserNewSubmission(
    adviserId: number,
    version: string,
    researchTitle: string
): Promise<ServiceResult<ManagedNotification>> {
    return sendNotification(
        adviserId,
        NOTIFICATION_TITLE.NEW_SUBMISSION,
        `A new research submission ${version} for "${researchTitle}" is ready for review.`
    );
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
    const notification =
        await findNotificationById(
            notificationId
        );

    if (!notification) {
        return {
            success: false,
            message:
                "Notification not found.",
        };
    }

    // Prevent users from modifying notifications
    // belonging to another account.
    if (
        notification.userId !== userId
    ) {
        return {
            success: false,
            message:
                "You are not authorized to modify this notification.",
        };
    }

    // Avoid unnecessary database updates.
    if (notification.isRead) {
        return {
            success: true,
            message:
                "Notification is already marked as read.",
        };
    }

    await markNotificationAsRead(
        notificationId
    );

    return {
        success: true,
        message:
            "Notification marked as read.",
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
    const notification =
        await findNotificationById(
            notificationId
        );

    if (!notification) {
        return {
            success: false,
            message:
                "Notification not found.",
        };
    }

    // Prevent users from deleting notifications
    // belonging to another account.
    if (
        notification.userId !== userId
    ) {
        return {
            success: false,
            message:
                "You are not authorized to delete this notification.",
        };
    }

    await deleteNotification(
        notificationId
    );

    return {
        success: true,
        message:
            "Notification deleted successfully.",
    };
}
