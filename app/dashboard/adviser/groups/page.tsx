import { Suspense } from "react";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import AdviserGroups from "@/components/dashboard/adviser-groups";
import { getAdviserGroupsDirectory } from "@/lib/services/adviser-groups.service";
import styles from "@/components/dashboard/adviser-groups.module.css";
import DashboardSkeleton from "@/components/dashboard/dashboard-skeleton";
import CoAdviserGroups from "@/components/dashboard/co-adviser-groups";
import { getCoAdviserWorkspace } from "@/lib/services/co-adviser.service";

export default function AdviserGroupsPage() {
    return <Suspense fallback={<DashboardSkeleton page="groups" />}><GroupsDirectory /></Suspense>;
}

async function GroupsDirectory() {
    const data = await getAdviserGroupsDirectory();
    if (!data) {
        const delegated = await getCoAdviserWorkspace();
        return delegated.success && delegated.data ? <CoAdviserGroups workspace={delegated.data} /> :
            <main className="dashboard-page"><DashboardHeader title="Research Groups" email="" /><p role="alert" className="form-message">{delegated.message}</p></main>;
    }
    return <main className={`dashboard-page ${styles.page}`}>
        <DashboardHeader title="Research Groups" email={data.email} />
        <AdviserGroups groups={data.groups} />
    </main>;
}
