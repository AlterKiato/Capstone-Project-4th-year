import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import AdminGroups from "@/components/dashboard/admin-groups";
import { getResearchGroups } from "@/lib/services/research-group.services";
import styles from "@/components/dashboard/admin-management.module.css";

export default async function AdminGroupsPage() {
    const session = await requireRole([ROLE_IDS.ADMIN]);
    const result = await getResearchGroups();
    return <main className={`dashboard-page admin-surface ${styles.page}`}>
        <DashboardHeader title="Research Groups" email={session.email} />
        {result.success && result.data ? <AdminGroups groups={result.data.map(({ id, groupName, strand, section, schoolYear, adviserId, status }) => ({ id, groupName, strand, section, schoolYear, adviserId, status }))} />
            : <><p className="dashboard-context">Monitor and manage registered research groups.</p><p role="alert" className="form-message">{result.message}</p></>}
    </main>;
}
