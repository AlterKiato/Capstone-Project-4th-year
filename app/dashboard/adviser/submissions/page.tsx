import LocalAIAssistance from "@/components/dashboard/local-ai-assistance";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import AdviserSubmissions from "@/components/dashboard/adviser-submissions";
import styles from "@/components/dashboard/adviser-submissions.module.css";
import { getAdviserSubmissionsDirectory } from "@/lib/services/adviser-submissions-ui.service";
import { getCoAdviserWorkspace } from "@/lib/services/co-adviser.service";
import CoAdviserWorkspace from "@/components/dashboard/co-adviser-workspace";
import { redirect } from "next/navigation";
import { isTemplateView } from "@/lib/evaluation-templates";
import { EVALUATION_CRITERIA_HREF } from "@/lib/constants/dashboard-navigation";

export default async function AdviserSubmissionsPage({ searchParams }: { searchParams?: Promise<{ view?: string | string[] }> }) {
    if (isTemplateView((await searchParams)?.view)) redirect(EVALUATION_CRITERIA_HREF);
    const directory = await getAdviserSubmissionsDirectory();
    const delegated = directory ? null : await getCoAdviserWorkspace();
    return <main className={`dashboard-page research-workspace ${styles.page}`}>
        <DashboardHeader title="Research Submissions" email={directory?.email ?? delegated?.data?.email ?? ""} />
        {directory ? <><p className="dashboard-context">The current Main Research Adviser reviews institutional research submissions.</p><AdviserSubmissions submissions={directory.submissions} /></> :
            <CoAdviserWorkspace initial={delegated?.data ?? null} error={delegated?.success ? "" : delegated?.message} />}
        {directory && <LocalAIAssistance feature="adviser" />}
    </main>;
}
