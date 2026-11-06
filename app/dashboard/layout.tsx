import LogoutButton from "@/components/auth/logout-button";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import NotificationProvider from "@/components/dashboard/notification-provider";
import { dashboardLinks } from "@/lib/constants/dashboard-navigation";
import { notificationHistoryHref } from "@/lib/constants/notification";
import { getDashboardAccount } from "@/lib/services/dashboard-account.service";
import { ResearchPushProvider } from "@/components/dashboard/research-push-enrollment";
import { pushConfiguration } from "@/lib/push/config";
import { ROLE_IDS } from "@/lib/auth/roles";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const account = await getDashboardAccount();
    if (!account) return <main className="dashboard-page">
        <h1>Workspace unavailable</h1>
        <p role="alert">Your account access could not be verified. Log out and sign in again, or contact your Admin.</p>
        <LogoutButton />
    </main>;
    const workspace = <NotificationProvider historyHref={notificationHistoryHref(account.roleId)}>
        <DashboardShell links={dashboardLinks(account.roleId)}>{children}</DashboardShell>
    </NotificationProvider>;
    return account.roleId === ROLE_IDS.STUDENT || account.roleId === ROLE_IDS.ADVISER
        ? <ResearchPushProvider userId={account.id} roleId={account.roleId} expiresAt={account.expiresAt} configured={pushConfiguration().available}>{workspace}</ResearchPushProvider>
        : workspace;
}
