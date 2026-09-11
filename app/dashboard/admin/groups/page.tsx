import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

import {
    getResearchGroups,
} from "@/lib/services/research-group.services";

import {
    changeResearchGroupStatusAction,
} from "@/lib/actions/research-group.action";

/**
 * Admin Research Group Management page.
 *
 * Administrators have system-wide oversight of
 * research groups but do not create groups.
 *
 * Group creation and student assignment are handled
 * by Advisers.
 */
export default async function AdminGroupsPage() {
    // Ensure only Admin users can access this page.
    await requireRole([
        ROLE_IDS.ADMIN,
    ]);

    // Retrieve all research groups.
    const result = await getResearchGroups();

    // Handle unexpected service failures.
    if (!result.success || !result.data) {
        return (
            <main>
                <h1>Research Groups</h1>

                <p>
                    {result.message}
                </p>
            </main>
        );
    }

    const groups = result.data;

    return (
        <main>
            <h1>Research Groups</h1>

            <p>
                Monitor and manage research groups across
                the system.
            </p>

            {groups.length === 0 ? (
                <p>
                    No research groups found.
                </p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Group Name</th>
                            <th>Strand</th>
                            <th>Section</th>
                            <th>School Year</th>
                            <th>Adviser ID</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {groups.map((group) => (
                            <tr key={group.id}>
                                <td>
                                    {group.id}
                                </td>

                                <td>
                                    {group.groupName}
                                </td>

                                <td>
                                    {group.strand}
                                </td>

                                <td>
                                    {group.section}
                                </td>

                                <td>
                                    {group.schoolYear}
                                </td>

                                <td>
                                    {group.adviserId}
                                </td>

                                <td>
                                    {group.status}
                                </td>

                                <td>
                                    <form
                                        action={async () => {
                                            "use server";

                                            await changeResearchGroupStatusAction(
                                                group.id,
                                                group.status === "active"
                                                    ? "archived"
                                                    : "active"
                                            );
                                        }}
                                    >
                                        <button type="submit">
                                            {group.status === "active"
                                                ? "Archive"
                                                : "Reactivate"}
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </main>
    );
}