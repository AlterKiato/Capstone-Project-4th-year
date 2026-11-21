import { currentReportMainAdviser } from "@/lib/services/main-adviser-report.service";
import { getPeriodActivityReport } from "@/lib/services/period-activity.service";
import { reportResponse } from "@/lib/reporting/report-response";

export async function POST(request: Request) {
    return reportResponse(request, { authorize: currentReportMainAdviser, getReport: input => getPeriodActivityReport(input, "main"),
        deniedMessage: "Current Main Research Adviser access is required.", unavailableMessage: "Period activity reporting is unavailable. Please try again." });
}
