import "server-only";
import { getGroqAvailability } from "./groq-provider";
import { getLocalPilotApproval } from "./groq-pilot-config";
import { getResearchPilotConfiguration } from "./groq-research-pilot-config";
import { getAdminReportConfiguration } from "./groq-admin-report-config";

// Injected getter allows synthetic tests without reading real environment values.
// The resulting configuration is internal only; never serialize/log it.
export function createGroqKeyLoader(readKey: () => unknown) {
    return (scope: "application" | "local-pilot" | "research-pilot" | "admin-report") => {
        if (scope !== "application" && scope !== "local-pilot" && scope !== "research-pilot" && scope !== "admin-report") return null;
        if (scope === "admin-report" ? !getAdminReportConfiguration() : scope === "research-pilot" ? !getResearchPilotConfiguration()
            : scope === "application" ? !getGroqAvailability().enabled : !getLocalPilotApproval()) return null;
        try {
            const token = readKey();
            return typeof token === "string" && /^[A-Za-z0-9_-]{1,256}$/.test(token) ? { token } : null;
        } catch { return null; }
    };
}
export const loadGroqConfiguration = createGroqKeyLoader(() => process.env.GROQ_API_KEY);
