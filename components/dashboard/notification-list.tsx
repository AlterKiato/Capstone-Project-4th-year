import type { ManagedNotification } from "@/lib/services/notification.service";
import { markNotificationAsReadAction, deleteNotificationAction } from "@/lib/actions/notification.action";

export default function NotificationList({ notifications }: { notifications: ManagedNotification[] }) {
    if (!notifications.length) return <p>You have no notifications.</p>;
    return <ul className="notification-records">
        {notifications.map(notification => <li key={notification.id}>
            <article aria-labelledby={`notification-${notification.id}`}>
                <h2 id={`notification-${notification.id}`}>{notification.title}</h2>
                <p className="record-text">{notification.message}</p>
                <p><strong>{notification.isRead ? "Read" : "Unread"}</strong> · Received <time dateTime={notification.createdAt.toISOString()}>{notification.createdAt.toLocaleString()}</time></p>
                <div className="surface-actions">
                    {!notification.isRead && <form action={async () => {
                        "use server";
                        await markNotificationAsReadAction(notification.id);
                    }}><button type="submit">Mark as Read</button></form>}
                    <form action={async () => {
                        "use server";
                        await deleteNotificationAction(notification.id);
                    }}><button type="submit">Delete</button></form>
                </div>
            </article>
        </li>)}
    </ul>;
}
