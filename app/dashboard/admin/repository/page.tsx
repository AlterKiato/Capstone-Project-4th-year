import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getRepositoryManagementResult } from "@/lib/services/repository.service";
import RepositoryManagement from "./RepositoryManagement";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import styles from "@/components/dashboard/admin-management.module.css";

export default async function AdminRepositoryPage() {
    const session = await requireRole([ROLE_IDS.ADMIN]);
    const result = await getRepositoryManagementResult(session.userId);
    return <main className={`dashboard-page admin-surface ${styles.page}`}>
        <DashboardHeader title="Repository Management" email={session.email} />
        {result.success ? <RepositoryManagement {...result.data} /> : <><p className="dashboard-context">Manage approved research publication and repository visibility.</p><p role="alert" className="form-message">{result.message}</p></>}
    </main>;
}
