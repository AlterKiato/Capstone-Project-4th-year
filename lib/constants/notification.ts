import { ROLE_IDS } from "@/lib/auth/roles";

export function notificationHistoryHref(roleId: number): string | null {
    switch (roleId) {
        case ROLE_IDS.ADMIN: return "/dashboard/admin/notifications";
        case ROLE_IDS.ADVISER: return "/dashboard/adviser/notifications";
        case ROLE_IDS.STUDENT: return "/dashboard/student/notifications";
        default: return null;
    }
}

/**
 * Notification titles used by the system.
 *
 * Centralizing notification titles keeps
 * notification messages consistent across
 * application features.
 */
export const NOTIFICATION_TITLE = {
    SUBMISSION_APPROVED:
        "Research Submission Approved",

    SUBMISSION_REVISION_REQUIRED:
        "Research Submission Revision Required",

    NEW_SUBMISSION:
        "New Research Submission",
} as const;

/**
 * Type representing a valid system notification title.
 */
export type NotificationTitle =
    (typeof NOTIFICATION_TITLE)[keyof typeof NOTIFICATION_TITLE];
