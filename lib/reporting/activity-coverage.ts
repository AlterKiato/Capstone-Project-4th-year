import "server-only";
import { activityAvailability, type ActivityActivation } from "./period-activity";

// Limited Preview policy: only a separately owner-approved canonical UTC start may be configured.
// No environment fallback, inferred date or request field can activate reporting.
export const ACTIVITY_ACTIVATION: ActivityActivation = Object.freeze({
    status: "configured", reportingStartUtc: "2026-11-21T17:00:00.000Z",
});
export function currentActivityAvailability() { return activityAvailability(ACTIVITY_ACTIVATION); }
