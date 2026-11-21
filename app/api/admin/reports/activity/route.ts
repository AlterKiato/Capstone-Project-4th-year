import { currentReportAdmin } from "@/lib/services/admin-report.service";
import { getPeriodActivityReport } from "@/lib/services/period-activity.service";
import { reportResponse } from "@/lib/reporting/report-response";

export async function POST(request: Request) {
    return reportResponse(request, { authorize: currentReportAdmin, getReport: input => getPeriodActivityReport(input, "admin"),
        deniedMessage: "Admin reporting access is required.", unavailableMessage: "Period activity reporting is unavailable. Please try again." });
}
