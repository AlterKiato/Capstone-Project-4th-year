import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";

import LogoutButton from "@/components/auth/logout-button";

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

            <LogoutButton />
        </main>
    );
}