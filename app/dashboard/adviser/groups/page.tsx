import { Suspense } from "react";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import AdviserGroups from "@/components/dashboard/adviser-groups";
import { getAdviserGroupsDirectory } from "@/lib/services/adviser-groups.service";
import styles from "@/components/dashboard/adviser-groups.module.css";
import DashboardSkeleton from "@/components/dashboard/dashboard-skeleton";

export default function AdviserGroupsPage() {
    return <Suspense fallback={<DashboardSkeleton page="groups" />}><GroupsDirectory /></Suspense>;
}

async function GroupsDirectory() {
    const data = await getAdviserGroupsDirectory();
    if (!data) return <main className="dashboard-page"><h1>Research Groups</h1><p role="alert">Your research groups could not be retrieved. Reload to try again.</p></main>;
    return <main className={`dashboard-page ${styles.page}`}>
        <DashboardHeader title="Research Groups" email={data.email} />
        <AdviserGroups groups={data.groups} />
    </main>;
}
