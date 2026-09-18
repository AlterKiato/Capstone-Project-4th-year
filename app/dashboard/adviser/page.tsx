import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import Link from "next/link";

/**
 * Temporary Adviser-only page used to test RBAC.
 *
 * Only users with the Adviser role can access this page.
 */
export default async function AdviserPage() {
    const session = await requireRole([
        ROLE_IDS.ADVISER,
    ]);

    return (
        <main>
            <h1>Adviser Area</h1>

            <p>
                Welcome, {session.email}
            </p>

            <p>
                You have Adviser access.
            </p>

            <Link href="/dashboard/adviser/groups">
                Research Groups
            </Link>
        </main>
    );
}