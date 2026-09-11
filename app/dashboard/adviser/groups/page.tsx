import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";

import { getResearchGroupsByAdviser } from "@/lib/services/research-group.services";

import { createResearchGroupAction } from "@/lib/actions/research-group.action";

/**
 * Adviser Research Group Management page.
 *
 * Displays only the research groups belonging to
 * the currently authenticated Adviser.
 *
 * Advisers can also create new research groups.
 */
export default async function AdviserGroupsPage() {
    // Ensure that only Adviser users can access this page.
    const session = await requireRole([
        ROLE_IDS.ADVISER,
    ]);

    // Retrieve only the research groups owned
    // by the currently logged-in Adviser.
    const result = await getResearchGroupsByAdviser(
        session.userId
    );

    // Handle unexpected service failures.
    if (!result.success || !result.data) {
        return (
            <main>
                <h1>My Research Groups</h1>

                <p>
                    {result.message}
                </p>
            </main>
        );
    }

    const groups = result.data;

    return (
        <main>
            <h1>My Research Groups</h1>

            <p>
                Create and manage your research groups.
            </p>

            {/* Research Group Creation Form */}
            <section>
                <h2>
                    Create Research Group
                </h2>

                <form action={createResearchGroupAction}>
                    <div>
                        <label htmlFor="groupName">
                            Group Name
                        </label>

                        <input
                            id="groupName"
                            name="groupName"
                            type="text"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="strand">
                            Strand
                        </label>

                        <input
                            id="strand"
                            name="strand"
                            type="text"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="section">
                            Section
                        </label>

                        <input
                            id="section"
                            name="section"
                            type="text"
                            required
                        />
                    </div>

                    <div>
                        <label htmlFor="schoolYear">
                            School Year
                        </label>

                        <input
                            id="schoolYear"
                            name="schoolYear"
                            type="text"
                            required
                        />
                    </div>

                    <button type="submit">
                        Create Research Group
                    </button>
                </form>
            </section>

            {/* Adviser Research Groups */}
            <section>
                <h2>
                    My Groups
                </h2>

                {groups.length === 0 ? (
                    <p>
                        You have not created any research groups yet.
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
                                <th>Status</th>
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
                                        {group.status}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </main>
    );
}