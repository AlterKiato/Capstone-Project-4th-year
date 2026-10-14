import AdminAccountCreation from "@/components/dashboard/admin-account-creation";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import AdminNavigation from "@/components/dashboard/admin-navigation";
import { EligibilityDialog } from "@/components/dashboard/ai-governance-dialogs";
import { getActiveAIAccount } from "@/lib/auth/ai-authorization";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles"

import { getUsers } from "@/lib/services/user.service";
import { changeUserStatusAction, changeUserRoleAction } from "@/lib/actions/user.action";

/**
 * Admin User Management page.
 *
 * Displays all registered users.
 * This page is restricted to Admin users.
 */
export default async function AdminUsersPage() {
    // Ensure only Admin users can access this page.
    const session = await requireRole([
        ROLE_IDS.ADMIN,
    ]);

    // Retrieve all users through the service layer.
    if (!await getActiveAIAccount(ROLE_IDS.ADMIN)) redirect("/dashboard");
    const result = await getUsers();

    // Handle unexpected service failures.
    if (!result.success || !result.data) {
        return (
            <main className="dashboard-page admin-surface">
                <DashboardHeader title="User Management" email={session.email} />
                <AdminNavigation />

                <p className="form-message" role="alert">
                    {result.message}
                </p>
            </main>
        );
    }

    const users = result.data;

    return (
        <main className="dashboard-page admin-surface">
            <DashboardHeader title="User Management" email={session.email} />
            <AdminNavigation />

            <p>
                Manage registered system users.
            </p>

            <AdminAccountCreation />
            <section className="dashboard-panel">
            <h2 id="users-heading">Registered Users</h2>
            {users.length === 0 ? (
                <p>
                    No users found.
                </p>
            ) : (
                <div className="admin-table-scroll" role="region" aria-labelledby="users-heading" tabIndex={0}>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Created At</th>
                            <th>Actions</th>
                        </tr>
                    </thead>

                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td>
                                    {user.id}
                                </td>

                                <td>
                                    {user.firstName}{" "}
                                    {user.lastName}
                                </td>

                                <td>
                                    {user.email}
                                </td>

                                <td>
                                    <form
                                        action={async (formData) => {
                                            "use server";

                                            const roleId = Number(
                                                formData.get("roleId")
                                            );

                                            await changeUserRoleAction(
                                                user.id,
                                                roleId
                                            );
                                        }}
                                    >
                                        <select
                                            name="roleId"
                                            defaultValue={user.roleId}
                                            aria-label={`Role for ${user.firstName} ${user.lastName}`}
                                        >
                                            <option value={ROLE_IDS.ADMIN}>
                                                Admin
                                            </option>

                                            <option value={ROLE_IDS.ADVISER}>
                                                Adviser
                                            </option>

                                            <option value={ROLE_IDS.STUDENT}>
                                                Student
                                            </option>

                                            <option value={ROLE_IDS.PANEL}>
                                                Panel
                                            </option>
                                        </select>

                                        <button type="submit">
                                            Update Role
                                        </button>
                                    </form>
                                </td>

                                <td>
                                    {user.isActive
                                        ? "Active"
                                        : "Inactive"}
                                </td>

                                <td>
                                    {user.createdAt.toLocaleDateString()}
                                </td>

                                <td>
                                    <form
                                        action={async () => {
                                            "use server";

                                            await changeUserStatusAction(
                                                user.id,
                                                !user.isActive
                                            );
                                        }}
                                    >
                                        <button type="submit">
                                            {user.isActive
                                                ? "Deactivate"
                                                : "Activate"}
                                        </button>
                                    </form>
                                    {[1,2].includes(user.roleId) && <EligibilityDialog userId={user.id} />}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            )}
            </section>
        </main>
    );
}
