import {
    createNotification,
    deleteNotification,
    findNotificationById,
    findNotificationsByUserId,
    markNotificationAsRead,
} from "@/lib/repositories/notification.repository";

import {
    NOTIFICATION_TITLE,
} from "@/lib/constants/notification";

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
