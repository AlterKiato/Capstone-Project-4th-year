import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import RegisterForm from "@/components/auth/register-form";
import Link from "next/link";

/**
 * Registration page.
 *
 * Redirects authenticated users to the dashboard.
 */
export default async function RegisterPage() {
    // Check whether the visitor already has a valid session.
    const session = await getSession();

    // Logged-in users should not register another account.
    if (session) {
        redirect("/dashboard");
    }

    return (
        <main className="auth-page">
            <p className="product-name">ThesiSHS AI</p>
            <h1>Create a Student account</h1>
            <p className="dashboard-welcome">Register to access your group’s research workspace.</p>
            <RegisterForm />
            <p className="auth-switch">Already have an account? <Link href="/login">Login</Link></p>
        </main>
    );
}
