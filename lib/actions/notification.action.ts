"use server";

import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/auth/authorization";

import {
    markCurrentNotificationAsRead,
    markAllCurrentNotificationsAsRead,
    getCurrentNotificationPreview,
    removeUserNotification,
} from "@/lib/services/notification.service";

export async function getNotificationPreviewAction() {
    return getCurrentNotificationPreview();
}

export async function markAllNotificationsAsReadAction(): Promise<void> {
    const result = await markAllCurrentNotificationsAsRead();
    if (!result.success) throw new Error(result.message);
    revalidateNotificationPages();
}

function revalidateNotificationPages() {
    for (const role of ["admin", "adviser", "student"]) {
        revalidatePath(`/dashboard/${role}/notifications`);
        revalidatePath(`/dashboard/${role}`);
    }
}

/**
 * Marks one of the authenticated user's
 * notifications as read.
 */
export async function markNotificationAsReadAction(
    notificationId: number
): Promise<void> {
    const result = await markCurrentNotificationAsRead(notificationId);

    // Stop if the operation fails.
    if (!result.success) {
        throw new Error(result.message);
    }

    revalidateNotificationPages();
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

    revalidatePath("/dashboard/student/notifications");
    revalidatePath("/dashboard/student");
}
