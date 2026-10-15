import { redirect } from "next/navigation";

import { getDashboardAccount } from "@/lib/services/dashboard-account.service";
import { dashboardDestination } from "@/lib/constants/dashboard-navigation";

import DashboardHeader from "@/components/dashboard/dashboard-header";
import { getRoleName } from "@/lib/auth/roles";

// Known role dashboards are destinations; Panel and other roles keep their workspace.
export default async function DashboardPage() {
    const session = await getDashboardAccount();

    if (!session) {
        return null;
    }

    const destination = dashboardDestination(session.roleId);
    if (destination) redirect(destination);

    return (
        <main className="dashboard-page">
            <DashboardHeader title="Dashboard" email={session.email} />

            <section className="dashboard-panel">
                <h2>{getRoleName(session.roleId) ?? "Account"} Workspace</h2>

            </section>
        </main>
    );
}
