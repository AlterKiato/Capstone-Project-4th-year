import LocalAIAssistance from "@/components/dashboard/local-ai-assistance";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import AdviserSubmissions from "@/components/dashboard/adviser-submissions";
import styles from "@/components/dashboard/adviser-submissions.module.css";
import { getAdviserSubmissionsDirectory } from "@/lib/services/adviser-submissions-ui.service";

export default async function AdviserSubmissionsPage() {
    const directory = await getAdviserSubmissionsDirectory();
    return <main className={`dashboard-page research-workspace ${styles.page}`}>
        <DashboardHeader title="Research Submissions" email={directory?.email ?? ""} />
        <p className="dashboard-context">Review submissions from your research groups.</p>
        {directory ? <AdviserSubmissions submissions={directory.submissions} /> : <p className="form-message" role="alert">Your submissions could not be retrieved. Reload to try again.</p>}
        <LocalAIAssistance feature="adviser" />
    </main>;
}
