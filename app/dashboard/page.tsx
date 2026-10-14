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
            <section className="dashboard-panel installation-help" aria-labelledby="installation-heading">
                <h2 id="installation-heading">Use ThesiSHS AI as an app</h2>
                <p>Installation is optional. You can keep using your browser. An internet connection is required for research work, even after installation.</p>
                <details>
                    <summary>Installation instructions</summary>
                    <p><strong>Android Chrome:</strong> Open the browser menu and look for Install, Install and create shortcut, or Add to Home screen. Follow the available option.</p>
                    <p><strong>iPhone Safari:</strong> Open Share, then Add to Home Screen. Depending on your Safari version, Share may be inside the page menu. If Open as Web App is shown, turn it on, then tap Add.</p>
                    <p><strong>Desktop Chrome / Edge:</strong> Use the install control in the address bar when available. In Chrome, look under Cast, save, and share for Install page as app. In Edge, look under More tools and Apps for Install this site as an app.</p>
                    <p className="form-help">Menu names and availability vary by browser version and device. If no install option appears, continue in your browser. Opening the app uses the same dashboard and sign-in flow.</p>
                </details>
            </section>
        </main>
    );
}
