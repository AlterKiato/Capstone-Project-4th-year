import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";

import LogoutButton from "@/components/auth/logout-button";
import Link from "next/link";
import { ROLE_IDS } from "@/lib/auth/roles";

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
        <main>
            <h1>Dashboard</h1>

            <p>Welcome, {session.email}</p>

            <p>Role ID: {session.roleId}</p>

            {session.roleId === ROLE_IDS.ADMIN ? (
                <p><Link href="/dashboard/admin">Open Admin Dashboard</Link></p>
            ) : session.roleId === ROLE_IDS.ADVISER ? (
                <p><Link href="/dashboard/adviser">Open Adviser Dashboard</Link></p>
            ) : session.roleId === ROLE_IDS.STUDENT ? (
                <p><Link href="/dashboard/student">Open Student Dashboard</Link></p>
            ) : null}

            <LogoutButton />
        </main>
    );
}
