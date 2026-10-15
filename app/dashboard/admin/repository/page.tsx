import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getRepositoryManagementData } from "@/lib/services/repository.service";
import RepositoryManagement from "./RepositoryManagement";
import DashboardHeader from "@/components/dashboard/dashboard-header";

export default async function AdminRepositoryPage() {
    const session = await requireRole([ROLE_IDS.ADMIN]);
    const data = await getRepositoryManagementData(session.userId);
    return <main className="dashboard-page admin-surface">
        <DashboardHeader title="Repository Management" email={session.email} />
        {data ? <RepositoryManagement {...data} /> : <p role="alert" className="form-message">Repository management is not available for this account.</p>}
    </main>;
}
