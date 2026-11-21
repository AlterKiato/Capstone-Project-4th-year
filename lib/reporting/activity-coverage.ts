import "server-only";
import { activityAvailability, type ActivityActivation } from "./period-activity";

// E4.B3 requires hosted writer verification and a reviewed cutover plus legacy ID ceilings.
// No environment fallback, inferred date or request field can activate reporting.
export const ACTIVITY_ACTIVATION: ActivityActivation = Object.freeze({ status: "unconfigured" });
export function currentActivityAvailability() { return activityAvailability(ACTIVITY_ACTIVATION); }
