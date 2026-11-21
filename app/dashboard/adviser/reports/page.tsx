import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/authorization";
import { getCurrentMainAdviser } from "@/lib/auth/main-adviser";
import { ROLE_IDS } from "@/lib/auth/roles";
import { getMainAdviserReport } from "@/lib/services/main-adviser-report.service";
import DashboardHeader from "@/components/dashboard/dashboard-header";
import AdminReportControls from "@/components/dashboard/admin-report-controls";
import PeriodActivityControls from "@/components/dashboard/period-activity-controls";
import { currentActivityAvailability } from "@/lib/reporting/activity-coverage";
import { defaultActivityPeriods } from "@/lib/reporting/period-activity";

export default async function MainAdviserReportsPage() {
    const session = await requireRole([ROLE_IDS.ADVISER]);
    if (!await getCurrentMainAdviser(session.userId)) redirect("/dashboard/adviser");
    const result = await getMainAdviserReport({ reportType: "current-supervision-summary", selection: "all", sections: [], format: "preview" });
    if ((!result.ok && result.status === 403) || !await getCurrentMainAdviser(session.userId)) redirect("/dashboard/adviser");
    return <main className="dashboard-page">
        <DashboardHeader title="Research Supervision Reports" email={session.email} />
        <p className="dashboard-context">Institutional research supervision, including archived groups.</p>
        <p><Link href="/dashboard/adviser" className="context-row">Back to Adviser Dashboard</Link></p>
        <AdminReportControls kind="main" initialReport={result.ok ? result.report : null} initialError={result.ok ? undefined : result.message} />
        <PeriodActivityControls kind="main" availability={currentActivityAvailability()} defaults={defaultActivityPeriods()} />
    </main>;
}
