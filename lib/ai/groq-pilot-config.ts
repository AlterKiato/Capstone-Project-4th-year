import "server-only";
import { getLocalGroqPilotAvailability } from "./groq-provider";
import { pilotApprovalSchema } from "@/lib/validations/ai-pilot";

// Operator-only manifest; never return/log it to clients. Not evidence of adulthood or consent.
export function getLocalPilotApproval(read = () => process.env.GROQ_LOCAL_PILOT_APPROVAL_JSON) {
    if (!getLocalGroqPilotAvailability().enabled || process.env.NODE_ENV !== "development") return null;
    try {
        const approval = pilotApprovalSchema.parse(JSON.parse(read() ?? "null"));
        const now = Date.now();
        return now >= Date.parse(approval.startsAt) && now < Date.parse(approval.endsAt) ? approval : null;
    } catch { return null; }
}
