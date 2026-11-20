import { currentReportAdmin, getAdminReport } from "@/lib/services/admin-report.service";
import { reportResponse } from "@/lib/reporting/report-response";

export async function POST(request: Request) {
    return reportResponse(request, { authorize: currentReportAdmin, getReport: getAdminReport,
        deniedMessage: "Admin reporting access is required.", unavailableMessage: "Admin reporting is unavailable. Please try again." });
}
