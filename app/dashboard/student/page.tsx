import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

/**
 * Temporary Student-only page used to test RBAC.
 *
 * Only users with the Student role can access this page.
 */
export default async function StudentPage() {
    const session = await requireRole([
        ROLE_IDS.STUDENT,
    ]);

    return (
        <main>
            <h1>Student Area</h1>

            <p>
                Welcome, {session.email}
            </p>

            <p>
                You have Student access.
            </p>
        </main>
    );
}