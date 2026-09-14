"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/authorization";

import {
    markUserNotificationAsRead,
    removeUserNotification,
} from "@/lib/services/notification.service";

/**
 * Marks one of the authenticated user's
 * notifications as read.
 */
export async function markNotificationAsReadAction(
    notificationId: number
): Promise<void> {
    // Ensure the user is authenticated.
    const session = await requireAuth();

    // The service verifies that the notification
    // belongs to the authenticated user.
    const result = await markUserNotificationAsRead(
        notificationId,
        session.userId
    );

    // Stop if the operation fails.
    if (!result.success) {
        return;
    }

    // Refresh Admin notification pages.
    revalidatePath("/dashboard/admin/notifications");
    revalidatePath("/dashboard/admin");

    // Refresh Adviser notification pages.
    revalidatePath("/dashboard/adviser/notifications");
    revalidatePath("/dashboard/adviser");
}

/**
 * Deletes one of the authenticated user's
 * notifications.
 */
export async function deleteNotificationAction(
    notificationId: number
): Promise<void> {
    // Ensure the user is authenticated.
    const session = await requireAuth();

    // The service verifies that the notification
    // belongs to the authenticated user.
    const result = await removeUserNotification(
        notificationId,
        session.userId
    );

    // Stop if the operation fails.
    if (!result.success) {
        return;
    }

    // Refresh Admin notification pages.
    revalidatePath("/dashboard/admin/notifications");
    revalidatePath("/dashboard/admin");

    // Refresh Adviser notification pages.
    revalidatePath("/dashboard/adviser/notifications");
    revalidatePath("/dashboard/adviser");
}