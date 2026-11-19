import Link from "next/link";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import EvaluationTemplateManager from "@/components/dashboard/evaluation-template-manager";
import styles from "@/components/dashboard/adviser-submissions.module.css";
import { requireRole } from "@/lib/auth/authorization";
import { getCurrentMainAdviser } from "@/lib/auth/main-adviser";
import { ROLE_IDS } from "@/lib/auth/roles";

export default async function EvaluationCriteriaPage() {
    const account = await requireRole([ROLE_IDS.ADVISER]);
    const main = await getCurrentMainAdviser(account.userId);
    if (!main) return <main className={`dashboard-page ${styles.page}`}>
        <DashboardHeader title="Evaluation criteria" email={account.email} />
        <section className="dashboard-panel">
            <p>Assigned criteria will appear in delegated submission reviews when template assignment becomes available.</p>
            <Link className="context-detail" href="/dashboard/adviser/submissions">Review delegated submissions</Link>
        </section>
    </main>;
    const { listEvaluationTemplates } = await import("@/lib/services/evaluation-template.service");
    const initial = await listEvaluationTemplates({ includeArchived: true });
    return <main className={`dashboard-page ${styles.page}`}>
        <DashboardHeader title="Evaluation criteria" email={main.email} />
        <EvaluationTemplateManager initial={initial} />
    </main>;
}
