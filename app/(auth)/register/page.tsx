import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import RegisterForm from "@/components/auth/register-form";

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
        <main>
            <h1>Register</h1>

            <RegisterForm />
        </main>
    );
}