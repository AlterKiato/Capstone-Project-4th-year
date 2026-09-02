import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import LoginForm from "@/components/auth/login-form";

/**
 * Login page.
 *
 * Redirects authenticated users to the dashboard.
 */
export default async function LoginPage() {
    // Check whether the visitor already has a valid session.
    const session = await getSession();

    // Logged-in users should not access the login page.
    if (session) {
        redirect("/dashboard");
    }

    return (
        <main>
            <h1>Login</h1>

            <LoginForm />
        </main>
    );
}