import { requireRole } from "@/lib/auth/authorization";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getRepositoryManagementData } from "@/lib/services/repository.service";
import RepositoryManagement from "./RepositoryManagement";

export default async function AdminRepositoryPage() {
    const session = await requireRole([ROLE_IDS.ADMIN]);
    const data = await getRepositoryManagementData(session.userId);
    if (!data) return <main><p>Repository management is not available for this account.</p></main>;
    return <RepositoryManagement {...data} />;
}
