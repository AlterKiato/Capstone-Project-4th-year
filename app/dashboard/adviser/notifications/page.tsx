import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

import { getUserNotifications } from "@/lib/services/notification.service";

import {
    markNotificationAsReadAction,
    deleteNotificationAction,
} from "@/lib/actions/notification.action";

/**
 * Adviser Notifications page.
 *
 * Displays notifications belonging to the
 * currently authenticated Adviser.
 */
export default async function AdviserNotificationsPage() {
    // Ensure only Adviser users can access this page.
    const session = await requireRole([
        ROLE_IDS.ADVISER,
    ]);

    // Retrieve notifications belonging to
    // the authenticated Adviser.
    const result = await getUserNotifications(
        session.userId
    );

    // Handle unexpected retrieval failures.
    if (!result.success || !result.data) {
        return (
            <main>
                <h1>Adviser Notifications</h1>

                <p>
                    {result.message}
                </p>
            </main>
        );
    }

    const notifications = result.data;

    return (
        <main>
            <h1>Adviser Notifications</h1>

            <p>
                View and manage your notifications.
            </p>

            {notifications.length === 0 ? (
                <p>
                    You have no notifications.
                </p>
            ) : (
                <ul>
                    {notifications.map((notification) => (
                        <li key={notification.id}>
                            <article>
                                <h2>
                                    {notification.title}
                                </h2>

                                <p>
                                    {notification.message}
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
                    ))}
                </ul>
            )}
        </main>
    );
}