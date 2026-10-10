import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";

import DashboardHeader from "@/components/dashboard/dashboard-header";
import Link from "next/link";
import { getRoleName, ROLE_IDS } from "@/lib/auth/roles";

/**
 * Protected dashboard page.
 *
 * Only authenticated users with a valid session
 * can access this page.
 */
export default async function DashboardPage() {
    // Get the current session from the authentication cookie.
    const session = await getSession();

    // Redirect visitors without a valid session.
    if (!session) {
        redirect("/login");
    }

    return (
        <main className="dashboard-page">
            <DashboardHeader title="Dashboard" email={session.email} />

            <section className="dashboard-panel">
                <h2>{getRoleName(session.roleId) ?? "Account"} Workspace</h2>

                {session.roleId === ROLE_IDS.ADMIN ? (
                    <p><Link href="/dashboard/admin">Open Admin Dashboard</Link></p>
                ) : session.roleId === ROLE_IDS.ADVISER ? (
                    <p><Link href="/dashboard/adviser">Open Adviser Dashboard</Link></p>
                ) : session.roleId === ROLE_IDS.STUDENT ? (
                    <p><Link href="/dashboard/student">Open Student Dashboard</Link></p>
                ) : null}

                {[ROLE_IDS.ADMIN, ROLE_IDS.ADVISER, ROLE_IDS.STUDENT].some(role => role === session.roleId) && (
                    <p><Link href="/dashboard/guide">System Guide</Link></p>
                )}

            </section>
        </main>
    );
}
