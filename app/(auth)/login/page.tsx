import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import LoginForm from "@/components/auth/login-form";
import Link from "next/link";
import ThemeSelector from "@/components/theme-selector";

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
        <>
        <header className="auth-appearance" aria-label="Theme"><ThemeSelector /></header>
        <main className="auth-page">
            <p className="product-name">ThesiSHS AI</p>
            <h1>Login</h1>
            <p className="dashboard-welcome">Sign in to your research workspace.</p>
            <LoginForm />
            <p className="auth-switch">Need a Student account? <Link href="/register">Create an account</Link></p>
            <Link href="/" className="auth-home">Back to home</Link>
        </main>
        </>
    );
}
