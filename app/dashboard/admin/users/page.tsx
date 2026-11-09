import DashboardHeader from "@/components/dashboard/dashboard-header";
import AdminUsers from "@/components/dashboard/admin-users";
import AdminMainAdviser from "@/components/dashboard/admin-main-adviser";
import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getUsers } from "@/lib/services/user.service";
import { getMainAdviserConfiguration } from "@/lib/services/research-supervision.service";
import styles from "@/components/dashboard/admin-users.module.css";

export default async function AdminUsersPage() {
    const session = await requireRole([ROLE_IDS.ADMIN]);
    const [result, designation] = await Promise.all([getUsers(), getMainAdviserConfiguration()]);
    return <main className={`dashboard-page admin-surface ${styles.page}`}>
        <DashboardHeader title="User Management" email={session.email} />
        {designation.success && designation.data
            ? <AdminMainAdviser key={designation.data.revision} configuration={designation.data} />
            : <section className={`dashboard-panel ${styles.directory} ${styles.designation}`} aria-labelledby="main-adviser-heading"><h2 id="main-adviser-heading">Main Research Adviser</h2><p role="alert" className="form-message">{designation.message}</p></section>}
        {result.success && result.data
            ? <AdminUsers users={result.data.map(user => ({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, roleId: user.roleId, isActive: user.isActive, createdAt: user.createdAt.toISOString(), emailVerification: user.roleId !== ROLE_IDS.STUDENT ? "Not applicable" : user.emailVerifiedAt !== null ? "Verified" : "Unverified" }))} actorId={session.userId} />
            : <><p className="dashboard-context">Manage registered users and account access.</p><p className="form-message" role="alert">{result.message}</p></>}
    </main>;
}
