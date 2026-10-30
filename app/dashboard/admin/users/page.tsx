import DashboardHeader from "@/components/dashboard/dashboard-header";
import AdminUsers from "@/components/dashboard/admin-users";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getUsers } from "@/lib/services/user.service";
import styles from "@/components/dashboard/admin-users.module.css";

export default async function AdminUsersPage() {
    const session = await requireRole([ROLE_IDS.ADMIN]);
    const result = await getUsers();
    return <main className={`dashboard-page admin-surface ${styles.page}`}>
        <DashboardHeader title="User Management" email={session.email} />
        {result.success && result.data
            ? <AdminUsers users={result.data.map(user => ({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, roleId: user.roleId, isActive: user.isActive, createdAt: user.createdAt.toISOString(), emailVerification: user.roleId !== ROLE_IDS.STUDENT ? "Not applicable" : user.emailVerifiedAt !== null ? "Verified" : "Unverified" }))} actorId={session.userId} />
            : <><p className="dashboard-context">Manage registered users and account access.</p><p className="form-message" role="alert">{result.message}</p></>}
    </main>;
}
