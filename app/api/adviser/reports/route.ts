import { currentReportMainAdviser, getMainAdviserReport } from "@/lib/services/main-adviser-report.service";
import { reportResponse } from "@/lib/reporting/report-response";

export async function POST(request: Request) {
    return reportResponse(request, { authorize: currentReportMainAdviser, getReport: getMainAdviserReport,
        deniedMessage: "Current Main Research Adviser access is required.", unavailableMessage: "Supervision reporting is unavailable. Please try again." });
}
