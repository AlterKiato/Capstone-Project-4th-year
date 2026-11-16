import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import LoginForm from "@/components/auth/login-form";
import Link from "next/link";

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
        <main className="auth-page">
            <h1>Welcome back</h1>
            <p className="dashboard-welcome">Sign in to your research workspace.</p>
            <LoginForm />
            <p className="auth-switch">Need a Student account? <Link href="/register">Create an account</Link></p>
            <Link href="/" className="auth-home">Back to home</Link>
        </main>
    );
}
