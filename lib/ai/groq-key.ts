import "server-only";
import { getGroqAvailability } from "./groq-provider";
import { getLocalPilotApproval } from "./groq-pilot-config";
import { getResearchPilotConfiguration } from "./groq-research-pilot-config";

// Injected getter allows synthetic tests without reading real environment values.
// The resulting configuration is internal only; never serialize/log it.
export function createGroqKeyLoader(readKey: () => unknown) {
    return (scope: "application" | "local-pilot" | "research-pilot") => {
        if (scope !== "application" && scope !== "local-pilot" && scope !== "research-pilot") return null;
        if (scope === "research-pilot" ? !getResearchPilotConfiguration()
            : scope === "application" ? !getGroqAvailability().enabled : !getLocalPilotApproval()) return null;
        try {
            const token = readKey();
            return typeof token === "string" && /^[A-Za-z0-9_-]{1,256}$/.test(token) ? { token } : null;
        } catch { return null; }
    };
}
export const loadGroqConfiguration = createGroqKeyLoader(() => process.env.GROQ_API_KEY);
