import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

import {
    getUserNotifications,
} from "@/lib/services/notification.service";

import {
    markNotificationAsReadAction,
    deleteNotificationAction,
} from "@/lib/actions/notification.action";

/**
 * Student Notification page.
 *
 * Displays notifications belonging only to
 * the currently authenticated Student.
 */
export default async function StudentNotificationsPage() {
    // Ensure only Student users can access this page.
    const session = await requireRole([
        ROLE_IDS.STUDENT,
    ]);

    // Retrieve notifications belonging to
    // the authenticated Student.
    const result =
        await getUserNotifications(
            session.userId
        );

    // Handle unexpected retrieval failures.
    if (
        !result.success ||
        !result.data
    ) {
        return (
            <main>
                <h1>
                    Student Notifications
                </h1>

                <p>
                    {result.message}
                </p>
            </main>
        );
    }

    const notifications =
        result.data;

    return (
        <main>
            <h1>
                Notifications
            </h1>

            <p>
                View and manage your
                research-related notifications.
            </p>

            {notifications.length === 0 ? (
                <p>
                    You have no notifications.
                </p>
            ) : (
                <ul>
                    {notifications.map(
                        (notification) => (
                            <li
                                key={
                                    notification.id
                                }
                            >
                                <article>
                                    <h2>
                                        {
                                            notification.title
                                        }
                                    </h2>

                                    <p>
                                        {
                                            notification.message
                                        }
                                    </p>

                                    <p>
                                        Status:{" "}
                                        {notification.isRead
                                            ? "Read"
                                            : "Unread"}
                                    </p>

                                    <p>
                                        Received:{" "}
                                        {notification.createdAt.toLocaleString()}
                                    </p>

                                    {!notification.isRead && (
                                        <form
                                            action={async () => {
                                                "use server";

                                                await markNotificationAsReadAction(
                                                    notification.id
                                                );
                                            }}
                                        >
                                            <button type="submit">
                                                Mark as Read
                                            </button>
                                        </form>
                                    )}

                                    <form
                                        action={async () => {
                                            "use server";

                                            await deleteNotificationAction(
                                                notification.id
                                            );
                                        }}
                                    >
                                        <button type="submit">
                                            Delete
                                        </button>
                                    </form>
                                </article>
                            </li>
                        )
                    )}
                </ul>
            )}
        </main>
    );
}