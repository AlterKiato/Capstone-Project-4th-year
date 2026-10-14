import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getUserNotifications } from "@/lib/services/notification.service";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import DashboardNavigation from "@/components/dashboard/dashboard-navigation";
import NotificationList from "@/components/dashboard/notification-list";

export default async function NotificationsPage() {
    const session = await requireRole([ROLE_IDS.ADVISER]);
    const result = await getUserNotifications(session.userId);
    return (
        <main className="dashboard-page notification-page">
            <DashboardHeader title="Adviser Notifications" email={session.email} />
            <DashboardNavigation links={[
                { href: "/dashboard/adviser", label: "Overview" },
                { href: "/dashboard/adviser/notifications", label: "Notifications" },
                { href: "/dashboard/repository", label: "Browse Repository" },
            ]} />
            <p className="dashboard-context">View and manage notifications belonging to your account.</p>
            <section className="dashboard-panel">
                {!result.success || !result.data ? <p role="alert" className="form-message">{result.message}</p> :
                    <NotificationList notifications={result.data} />}
            </section>
        </main>
    );
}
